'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Lead } from '@/lib/types'
import Avatar from './Avatar'

// Formata o telefone E.164 (ex: 5511988887777) para algo legível.
function formatPhone(phone: string): string {
  const m = phone.match(/^55(\d{2})(\d{4,5})(\d{4})$/)
  if (m) return `(${m[1]}) ${m[2]}-${m[3]}`
  return phone
}

export default function LeadCard({
  lead,
  overlay = false,
  accent = '#34d399',
  onOpen,
  onDelete,
  onToggleRead,
}: {
  lead: Lead
  overlay?: boolean
  accent?: string
  onOpen?: (lead: Lead) => void
  onDelete?: (lead: Lead) => void
  onToggleRead?: (lead: Lead) => void
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  // posição (fixed) do menu quando aberto; null = fechado
  const [menu, setMenu] = useState<{ top: number; right: number } | null>(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { type: 'lead', lead },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    borderLeft: `2px solid ${accent}`,
  }

  const waLink = `https://wa.me/${lead.phone.replace(/\D/g, '')}`
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  function openMenu(e: React.MouseEvent) {
    stop(e)
    if (menu) {
      setMenu(null)
      return
    }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setMenu({ top: r.bottom + 4, right: window.innerWidth - r.right })
  }

  // Fecha o menu ao rolar (o portal é fixo e descolaria do card) ou redimensionar.
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [menu])

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen?.(lead)}
      className={[
        'lead-card group relative cursor-grab touch-none rounded-xl p-3 active:cursor-grabbing',
        isDragging && !overlay ? 'opacity-40' : '',
        overlay ? 'rotate-2 shadow-[0_20px_50px_-12px_rgba(16,185,129,0.6)]' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <Avatar name={lead.name} phone={lead.phone} photoUrl={lead.photo_url} />
        <div className="min-w-0 flex-1">
          <p className="truncate pr-5 text-sm font-semibold text-neutral-100">
            {lead.name ?? formatPhone(lead.phone)}
          </p>
          <p className="truncate font-mono text-[11px] text-neutral-500">
            {formatPhone(lead.phone)}
          </p>
        </div>
        {!lead.is_read ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-emerald-400"
            style={{ boxShadow: '0 0 8px #34d399' }}
            title="Não lida"
          />
        ) : null}
      </div>

      {lead.notes ? (
        <p className="mt-2 line-clamp-2 border-t border-white/5 pt-2 text-xs text-neutral-400">
          {lead.notes}
        </p>
      ) : null}

      {/* botão de ações (o menu é renderizado em portal, fora da coluna, pra não ser cortado) */}
      {!overlay && (
        <button
          ref={btnRef}
          onClick={openMenu}
          onPointerDown={stop}
          aria-label="Ações"
          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md text-neutral-500 opacity-0 transition-opacity hover:bg-white/10 hover:text-neutral-200 group-hover:opacity-100"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <circle cx="5" cy="12" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>
      )}

      {menu &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[55]" onClick={() => setMenu(null)} />
            <div
              style={{ position: 'fixed', top: menu.top, right: menu.right }}
              className="z-[56] w-40 overflow-hidden rounded-lg border border-white/10 bg-neutral-900 py-1 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.85)]"
            >
              <button
                onClick={() => {
                  setMenu(null)
                  onToggleRead?.(lead)
                }}
                className="block w-full px-3 py-1.5 text-left text-xs text-neutral-200 hover:bg-white/10"
              >
                {lead.is_read ? 'Marcar como não lida' : 'Marcar como lida'}
              </button>
              <button
                onClick={() => {
                  setMenu(null)
                  onOpen?.(lead)
                }}
                className="block w-full px-3 py-1.5 text-left text-xs text-neutral-200 hover:bg-white/10"
              >
                Editar
              </button>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenu(null)}
                className="block w-full px-3 py-1.5 text-left text-xs text-emerald-300 hover:bg-white/10"
              >
                Abrir WhatsApp
              </a>
              <button
                onClick={() => {
                  setMenu(null)
                  onDelete?.(lead)
                }}
                className="block w-full px-3 py-1.5 text-left text-xs text-red-300 hover:bg-red-500/15"
              >
                Excluir
              </button>
            </div>
          </>,
          document.body,
        )}
    </div>
  )
}
