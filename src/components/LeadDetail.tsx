'use client'

import { useEffect, useState } from 'react'
import type { Lead, Stage } from '@/lib/types'
import { updateLead, deleteLead } from '@/lib/api'
import Avatar from './Avatar'

function formatPhone(phone: string): string {
  const m = phone.match(/^55(\d{2})(\d{4,5})(\d{4})$/)
  if (m) return `(${m[1]}) ${m[2]}-${m[3]}`
  return phone
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function LeadDetail({
  lead,
  stages,
  onClose,
  onChanged,
}: {
  lead: Lead
  stages: Stage[]
  onClose: () => void
  onChanged: () => void
}) {
  const [name, setName] = useState(lead.name ?? '')
  const [notes, setNotes] = useState(lead.notes ?? '')
  const [stageId, setStageId] = useState(lead.stage_id ?? '')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    setName(lead.name ?? '')
    setNotes(lead.notes ?? '')
    setStageId(lead.stage_id ?? '')
    setConfirmDel(false)
  }, [lead])

  // Fecha com ESC.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const dirty =
    name !== (lead.name ?? '') || notes !== (lead.notes ?? '') || stageId !== (lead.stage_id ?? '')

  async function handleSave() {
    setSaving(true)
    try {
      await updateLead(lead.id, {
        name: name.trim() || null,
        notes: notes.trim() || null,
        stage_id: stageId || null,
      })
      setSavedAt(Date.now())
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await deleteLead(lead.id)
      onChanged()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const waLink = `https://wa.me/${lead.phone.replace(/\D/g, '')}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass animate-float-up flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl shadow-[0_0_80px_-20px_rgba(16,185,129,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center gap-3 border-b border-white/10 p-5">
          <Avatar name={lead.name} phone={lead.phone} photoUrl={lead.photo_url} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-neutral-100">
              {lead.name ?? formatPhone(lead.phone)}
            </p>
            <p className="truncate font-mono text-xs text-neutral-500">{formatPhone(lead.phone)}</p>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost flex h-7 w-7 items-center justify-center rounded-lg text-sm"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* corpo rolável */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-neon flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3.1.8.8-3-.2-.3A8 8 0 1 1 12 20Z" />
            </svg>
            Abrir conversa no WhatsApp
          </a>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-mono uppercase tracking-wider text-neutral-500">Origem</p>
              <p className="mt-1 font-medium capitalize text-neutral-200">{lead.source}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-mono uppercase tracking-wider text-neutral-500">Entrou em</p>
              <p className="mt-1 font-medium text-neutral-200">{formatDate(lead.created_at)}</p>
            </div>
          </div>

          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-400">
            Nome
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sem nome"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-neutral-100 outline-none focus:border-emerald-400/60"
            />
          </label>

          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-400">
            Etapa
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-neutral-100 outline-none focus:border-emerald-400/60"
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id} className="bg-neutral-900">
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium uppercase tracking-wider text-neutral-400">
            Anotações
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Detalhes da conversa, próximos passos…"
              className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-neutral-100 outline-none focus:border-emerald-400/60"
            />
          </label>
        </div>

        {/* footer fixo */}
        <div className="flex items-center gap-2 border-t border-white/10 p-5">
          {confirmDel ? (
            <>
              <span className="text-xs text-red-300">Remover este lead?</span>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="ml-auto rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/25"
              >
                Sim, remover
              </button>
              <button
                onClick={() => setConfirmDel(false)}
                className="btn-ghost rounded-lg px-3 py-1.5 text-xs"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setConfirmDel(true)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-red-300/80 hover:bg-red-500/10"
              >
                Remover
              </button>
              <button
                onClick={handleSave}
                disabled={!dirty || saving}
                className="btn-neon ml-auto rounded-lg px-4 py-1.5 text-xs"
              >
                {saving ? 'Salvando…' : savedAt && !dirty ? 'Salvo ✓' : 'Salvar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
