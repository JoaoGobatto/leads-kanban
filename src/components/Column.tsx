'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Stage, Lead } from '@/lib/types'
import LeadCard from './LeadCard'

export default function Column({
  stage,
  leads,
  onOpenLead,
  onDeleteLead,
}: {
  stage: Stage
  leads: Lead[]
  onOpenLead?: (lead: Lead) => void
  onDeleteLead?: (lead: Lead) => void
}) {
  // A coluna inteira é uma área de drop, para aceitar cards mesmo quando vazia.
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { type: 'column', stageId: stage.id },
  })

  const color = stage.color ?? '#34d399'

  return (
    <div className="glass flex max-h-full w-72 shrink-0 flex-col overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
        />
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-neutral-200">
          {stage.name}
        </h2>
        <span className="ml-auto rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] font-medium text-neutral-400">
          {String(leads.length).padStart(2, '0')}
        </span>
      </div>

      {/* linha divisória com leve gradiente */}
      <div className="mx-4 h-px bg-gradient-to-r from-white/10 via-white/5 to-transparent" />

      <div
        ref={setNodeRef}
        className={[
          'flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto rounded-b-2xl p-2.5 transition-all',
          isOver ? 'drop-active' : '',
        ].join(' ')}
      >
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              accent={color}
              onOpen={onOpenLead}
              onDelete={onDeleteLead}
            />
          ))}
        </SortableContext>
        {leads.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/10 py-8">
            <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-600">
              vazio
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
