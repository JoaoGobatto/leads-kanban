'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { Stage, Lead } from '@/lib/types'
import Column from './Column'
import LeadCard from './LeadCard'

type Props = {
  stages: Stage[]
  initialLeads: Lead[]
  // Chamado quando um lead muda de coluna ou posição.
  // Recebe o array já reordenado para persistir a ordem correta.
  onLeadMove?: (leadId: string, toStageId: string, currentLeads: Lead[]) => void
  onOpenLead?: (lead: Lead) => void
  onDeleteLead?: (lead: Lead) => void
  onToggleRead?: (lead: Lead) => void
  query?: string
}

export default function Board({
  stages,
  initialLeads,
  onLeadMove,
  onOpenLead,
  onDeleteLead,
  onToggleRead,
  query = '',
}: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Sincroniza com dados novos (ex: lead inbound via realtime),
  // mas nunca durante um arraste para não "pular" o card na mão do user.
  useEffect(() => {
    if (!activeId) setLeads(initialLeads)
  }, [initialLeads, activeId])

  const sensors = useSensors(
    // Exige mover 6px antes de iniciar o drag, para não atrapalhar cliques.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const activeLead = useMemo(() => leads.find((l) => l.id === activeId) ?? null, [leads, activeId])

  // Em qual coluna está um id (seja id de coluna ou de lead).
  function containerOf(id: string): string | null {
    if (stages.some((s) => s.id === id)) return id
    return leads.find((l) => l.id === id)?.stage_id ?? null
  }

  function lastIndexOfContainer(arr: Lead[], stageId: string): number {
    let idx = -1
    for (let i = 0; i < arr.length; i++) if (arr[i].stage_id === stageId) idx = i
    return idx
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  // Move o card entre colunas em tempo real enquanto arrasta.
  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const activeContainer = containerOf(activeId)
    const overContainer = containerOf(overId)
    if (!activeContainer || !overContainer || activeContainer === overContainer) return

    setLeads((prev) => {
      const moving = prev.find((l) => l.id === activeId)
      if (!moving) return prev
      const without = prev.filter((l) => l.id !== activeId)
      const moved: Lead = { ...moving, stage_id: overContainer }

      let insertAt: number
      if (stages.some((s) => s.id === overId)) {
        insertAt = lastIndexOfContainer(without, overContainer) + 1
      } else {
        insertAt = without.findIndex((l) => l.id === overId)
        if (insertAt === -1) insertAt = without.length
      }
      without.splice(insertAt, 0, moved)
      return without
    })
  }

  // Finaliza: reordena dentro da coluna e persiste.
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const activeContainer = containerOf(activeId)
    const overContainer = containerOf(overId)
    if (!activeContainer || !overContainer) return

    let next = leads
    if (activeContainer === overContainer && activeId !== overId) {
      const ids = leads.map((l) => l.id)
      const oldIndex = ids.indexOf(activeId)
      const newIndex = ids.indexOf(overId)
      if (oldIndex !== -1 && newIndex !== -1) {
        next = arrayMove(leads, oldIndex, newIndex)
        setLeads(next)
      }
    }

    onLeadMove?.(activeId, overContainer, next)
  }

  const q = query.trim().toLowerCase()
  const matches = (l: Lead) => {
    if (!q) return true
    const digits = q.replace(/\D/g, '')
    const byName = (l.name ?? '').toLowerCase().includes(q)
    const byPhone = digits.length > 0 && l.phone.includes(digits)
    return byName || byPhone
  }
  const leadsByStage = (stageId: string) =>
    leads.filter((l) => l.stage_id === stageId && matches(l))

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-5 overflow-x-auto px-6 py-5">
        {stages.map((stage) => (
          <Column
            key={stage.id}
            stage={stage}
            leads={leadsByStage(stage.id)}
            onOpenLead={onOpenLead}
            onDeleteLead={onDeleteLead}
            onToggleRead={onToggleRead}
          />
        ))}
      </div>
      <DragOverlay>{activeLead ? <LeadCard lead={activeLead} overlay /> : null}</DragOverlay>
    </DndContext>
  )
}
