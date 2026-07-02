'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Stage, Lead } from '@/lib/types'
import {
  fetchStages,
  fetchLeads,
  persistLeadMove,
  createTestLead,
  deleteLead,
  updateLead,
} from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthProvider'
import Board from './Board'
import ConnectWhatsApp from './ConnectWhatsApp'
import LeadDetail from './LeadDetail'

type Toast = { id: number; title: string; sub: string }

export default function BoardContainer() {
  const { user, signOut } = useAuth()
  const [stages, setStages] = useState<Stage[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showConnect, setShowConnect] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Lead | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const muteRealtimeUntil = useRef(0)
  const toastSeq = useRef(0)

  function pushToast(title: string, sub: string) {
    const id = ++toastSeq.current
    setToasts((t) => [...t, { id, title, sub }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000)
  }

  const reloadLeads = useCallback(async () => {
    try {
      setLeads(await fetchLeads())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar leads')
    }
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [s, l] = await Promise.all([fetchStages(), fetchLeads()])
        if (!active) return
        setStages(s)
        setLeads(l)
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Erro ao carregar dados')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  // Realtime: novo lead inbound (toast) ou qualquer mudança -> atualiza o board.
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('crm-leads')
      .on(
        'postgres_changes',
        { event: '*', schema: 'crm', table: 'leads', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const n = payload.new as { name?: string | null; phone?: string }
            pushToast('Novo lead 🟢', n.name || n.phone || 'Contato do WhatsApp')
          }
          if (Date.now() < muteRealtimeUntil.current) return
          reloadLeads()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, reloadLeads])

  async function handleLeadMove(leadId: string, toStageId: string, currentLeads: Lead[]) {
    setLeads(currentLeads)
    muteRealtimeUntil.current = Date.now() + 1500
    try {
      await persistLeadMove(currentLeads, leadId, toStageId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
      reloadLeads()
    }
  }

  async function handleCreateTest() {
    if (!user || stages.length === 0) return
    setCreating(true)
    try {
      await createTestLead(user.id, stages[0].id)
      await reloadLeads()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar lead de teste')
    } finally {
      setCreating(false)
    }
  }

  // Abre a confirmação in-app (substitui o confirm nativo do navegador).
  function handleDeleteLead(lead: Lead) {
    setPendingDelete(lead)
  }

  async function handleToggleRead(lead: Lead) {
    const next = !lead.is_read
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, is_read: next } : l))) // otimista
    muteRealtimeUntil.current = Date.now() + 1500
    try {
      await updateLead(lead.id, { is_read: next })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao marcar lead')
      reloadLeads()
    }
  }

  async function confirmDelete() {
    const lead = pendingDelete
    if (!lead) return
    const label = lead.name ?? lead.phone
    setPendingDelete(null)
    setLeads((prev) => prev.filter((l) => l.id !== lead.id)) // otimista
    muteRealtimeUntil.current = Date.now() + 1500
    try {
      await deleteLead(lead.id)
      pushToast('Lead removido', label)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao remover lead')
      reloadLeads()
    }
  }

  async function handleImport() {
    if (!user || stages.length === 0) return
    setImporting(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const res = await fetch('/api/whatsapp/import', {
        method: 'POST',
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      const data = await res.json()
      if (!data.ok) {
        pushToast('Falha na importação', data.message ?? 'erro')
        return
      }
      const contacts: { phone: string; name: string | null }[] = data.contacts ?? []
      if (contacts.length === 0) {
        pushToast('Nada para importar', 'nenhuma conversa encontrada')
        return
      }
      // Insere no board do usuário logado; ignora os que já existem (user_id + phone).
      const firstStage = stages[0].id
      const before = leads.length
      const rows = contacts.map((c, i) => ({
        user_id: user.id,
        stage_id: firstStage,
        phone: c.phone,
        name: c.name,
        source: 'whatsapp',
        position: i,
      }))
      const { error } = await supabase
        .from('leads')
        .upsert(rows, { onConflict: 'user_id,phone', ignoreDuplicates: true })
      if (error) {
        pushToast('Falha na importação', error.message)
        return
      }
      const fresh = await fetchLeads()
      setLeads(fresh)
      const added = fresh.length - before
      pushToast('Importação concluída', added > 0 ? `${added} novos leads` : 'tudo já estava importado')
    } catch {
      pushToast('Falha na importação', 'sem resposta do servidor')
    } finally {
      setImporting(false)
    }
  }

  // ---- métricas ----
  const stats = useMemo(() => {
    const total = leads.length
    const today = new Date().toDateString()
    const novosHoje = leads.filter((l) => new Date(l.created_at).toDateString() === today).length
    const fechadoStage = stages.find((s) => /fechad/i.test(s.name))
    const fechados = fechadoStage ? leads.filter((l) => l.stage_id === fechadoStage.id).length : 0
    const conv = total ? Math.round((fechados / total) * 100) : 0
    return { total, novosHoje, fechados, conv }
  }, [leads, stages])

  const selectedLead = selectedId ? leads.find((l) => l.id === selectedId) ?? null : null

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
        <div>
          <h1 className="text-base font-semibold text-neutral-100">Leads · WhatsApp</h1>
          <p className="text-xs text-neutral-500">{user?.email}</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowConnect(true)}
            className="btn-neon flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3.1.8.8-3-.2-.3A8 8 0 1 1 12 20Z" />
            </svg>
            Conectar
          </button>
          <button
            onClick={handleImport}
            disabled={importing}
            className="btn-ghost rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            {importing ? 'Importando…' : 'Importar conversas'}
          </button>
          <button
            onClick={handleCreateTest}
            disabled={creating || loading}
            className="btn-ghost rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            {creating ? 'Criando…' : '+ Teste'}
          </button>
          <button onClick={() => signOut()} className="btn-ghost rounded-lg px-3 py-1.5 text-xs font-medium">
            Sair
          </button>
        </div>
      </header>

      {/* barra de busca + métricas */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/5 px-5 py-2.5">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="m20 20-3-3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou número…"
            className="w-72 rounded-lg border border-white/10 bg-white/5 py-1.5 pl-9 pr-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Kpi label="Total" value={stats.total} />
          <Kpi label="Novos hoje" value={stats.novosHoje} accent />
          <Kpi label="Fechados" value={stats.fechados} />
          <Kpi label="Conversão" value={`${stats.conv}%`} />
        </div>
      </div>

      {error ? (
        <div className="border-b border-red-500/20 bg-red-500/10 px-5 py-2 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <main className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center font-mono text-xs uppercase tracking-[0.3em] text-emerald-400/60">
            carregando…
          </div>
        ) : (
          <Board
            stages={stages}
            initialLeads={leads}
            onLeadMove={handleLeadMove}
            onOpenLead={(l) => setSelectedId(l.id)}
            onDeleteLead={handleDeleteLead}
            onToggleRead={handleToggleRead}
            query={query}
          />
        )}
      </main>

      {pendingDelete && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-neutral-100">Excluir lead</h3>
            <p className="mt-2 text-sm text-neutral-400">
              Remover{' '}
              <span className="font-medium text-neutral-200">
                “{pendingDelete.name ?? pendingDelete.phone}”
              </span>
              ? Essa ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                className="btn-ghost rounded-lg px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/25"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {showConnect && <ConnectWhatsApp onClose={() => setShowConnect(false)} />}
      {selectedLead && (
        <LeadDetail
          lead={selectedLead}
          stages={stages}
          onClose={() => setSelectedId(null)}
          onChanged={reloadLeads}
        />
      )}

      {/* toasts */}
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="glass animate-float-up pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 shadow-[0_0_40px_-12px_rgba(16,185,129,0.6)]"
          >
            <span className="h-2 w-2 animate-pulse-glow rounded-full bg-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-neutral-100">{t.title}</p>
              <p className="text-xs text-neutral-400">{t.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="glass flex flex-col items-end rounded-lg px-3 py-1.5">
      <span
        className={[
          'font-mono text-sm font-bold leading-none',
          accent ? 'text-emerald-400' : 'text-neutral-100',
        ].join(' ')}
      >
        {value}
      </span>
      <span className="mt-0.5 text-[9px] uppercase tracking-wider text-neutral-500">{label}</span>
    </div>
  )
}
