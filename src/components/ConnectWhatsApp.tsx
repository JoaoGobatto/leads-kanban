'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Status = 'loading' | 'connecting' | 'connected' | 'error'

// Modal de conexão do WhatsApp: faz polling de /api/whatsapp, exibe o QR e
// detecta automaticamente quando o aparelho parear (status 'connected').
export default function ConnectWhatsApp({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<Status>('loading')
  const [qr, setQr] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const closedRef = useRef(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let stopped = false

    async function tick() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const res = await fetch('/api/whatsapp', {
          cache: 'no-store',
          headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
        })
        const data = await res.json()
        if (stopped) return

        if (data.status === 'connected') {
          setStatus('connected')
          setQr(null)
          setTimeout(() => {
            if (!closedRef.current) onClose()
          }, 1800)
          return // para o polling
        }
        if (data.status === 'error') {
          setStatus('error')
          setMessage(data.message ?? 'Erro ao conectar')
        } else {
          setStatus('connecting')
          if (data.qr) setQr(data.qr)
        }
      } catch {
        if (!stopped) {
          setStatus('error')
          setMessage('Sem resposta do servidor')
        }
      }
      timer = setTimeout(tick, 5000) // QR atualiza sozinho a cada 5s
    }

    tick()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [onClose])

  useEffect(() => {
    return () => {
      closedRef.current = true
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass animate-float-up w-full max-w-sm rounded-2xl p-6 shadow-[0_0_60px_-15px_rgba(16,185,129,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="accent-gradient text-lg font-bold">Conectar WhatsApp</h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-500">
              pareamento de dispositivo
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost flex h-7 w-7 items-center justify-center rounded-lg text-sm"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center">
          {status === 'loading' && (
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-400/60">
              gerando qr…
            </p>
          )}

          {status === 'connecting' && (
            <>
              <div className="relative rounded-2xl border border-emerald-400/30 bg-white p-3 shadow-[0_0_40px_-10px_rgba(16,185,129,0.6)]">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt="QR code do WhatsApp" className="h-56 w-56" />
                ) : (
                  <div className="flex h-56 w-56 items-center justify-center">
                    <span className="font-mono text-xs text-neutral-400">atualizando…</span>
                  </div>
                )}
                {/* cantos estilo "scanner" */}
                <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-tl-lg border-l-2 border-t-2 border-emerald-400" />
                <span className="pointer-events-none absolute right-1 top-1 h-5 w-5 rounded-tr-lg border-r-2 border-t-2 border-emerald-400" />
                <span className="pointer-events-none absolute bottom-1 left-1 h-5 w-5 rounded-bl-lg border-b-2 border-l-2 border-emerald-400" />
                <span className="pointer-events-none absolute bottom-1 right-1 h-5 w-5 rounded-br-lg border-b-2 border-r-2 border-emerald-400" />
              </div>
              <div className="text-sm text-neutral-300">
                <p className="font-medium text-neutral-200">WhatsApp → Aparelhos conectados</p>
                <p className="text-neutral-500">→ Conectar aparelho → aponte para o QR</p>
              </div>
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                <span className="h-2 w-2 animate-pulse-glow rounded-full bg-emerald-400" />
                aguardando leitura
              </p>
            </>
          )}

          {status === 'connected' && (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 shadow-[0_0_40px_-6px_rgba(16,185,129,0.8)]">
                <svg
                  viewBox="0 0 24 24"
                  className="h-10 w-10 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-base font-semibold text-emerald-400 text-glow">
                WhatsApp conectado!
              </p>
              <p className="text-sm text-neutral-400">
                Os leads que chegarem vão aparecer no board automaticamente.
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <p className="text-sm font-medium text-red-400">Não foi possível conectar</p>
              <p className="font-mono text-[11px] text-neutral-500">{message}</p>
              <button
                onClick={() => location.reload()}
                className="btn-ghost mt-2 rounded-lg px-3 py-1.5 text-xs font-medium"
              >
                Tentar de novo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
