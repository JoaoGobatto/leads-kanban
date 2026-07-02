import { supabase } from './supabase'
import type { Stage, Lead } from './types'

export async function fetchStages(): Promise<Stage[]> {
  const { data, error } = await supabase
    .from('stages')
    .select('id, name, position, color')
    .order('position', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('id, name, phone, photo_url, stage_id, position, source, notes, is_read, created_at')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Persiste a movimentação: grava o stage do lead movido e renumera
// a posição de todos os leads das colunas afetadas (origem e destino).
export async function persistLeadMove(
  allLeads: Lead[],
  leadId: string,
  toStageId: string,
): Promise<void> {
  const moved = allLeads.find((l) => l.id === leadId)
  if (!moved) return

  // Colunas que precisam ter a ordem reescrita.
  const affected = new Set<string>([toStageId])
  // (origem já está embutida em allLeads, pois o array reflete o estado pós-drag)

  const updates: { id: string; stage_id: string; position: number }[] = []
  for (const stageId of affected) {
    const inStage = allLeads.filter((l) => l.stage_id === stageId)
    inStage.forEach((l, idx) => {
      updates.push({ id: l.id, stage_id: stageId, position: idx })
    })
  }
  // Garante o stage do lead movido mesmo se a coluna tiver só ele.
  if (!updates.some((u) => u.id === leadId)) {
    updates.push({ id: leadId, stage_id: toStageId, position: 0 })
  }

  // Atualiza cada linha afetada (poucas por movimento).
  await Promise.all(
    updates.map((u) =>
      supabase.from('leads').update({ stage_id: u.stage_id, position: u.position }).eq('id', u.id),
    ),
  )
}

// Atualiza campos editáveis de um lead (nome, notas, etapa).
export async function updateLead(
  id: string,
  patch: Partial<Pick<Lead, 'name' | 'notes' | 'stage_id' | 'is_read'>>,
): Promise<void> {
  const { error } = await supabase.from('leads').update(patch).eq('id', id)
  if (error) throw error
}

// Remove um lead.
export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) throw error
}

// Cria um lead de teste na primeira coluna (simula um lead chegando do WhatsApp).
const NOMES = ['Lucas', 'Fernanda', 'Rafael', 'Juliana', 'Bruno', 'Camila', 'Diego', 'Patrícia']
const SOBRENOMES = ['Silva', 'Santos', 'Oliveira', 'Costa', 'Almeida', 'Ribeiro', 'Carvalho']

export async function createTestLead(userId: string, firstStageId: string): Promise<void> {
  const nome = `${NOMES[Math.floor(Math.random() * NOMES.length)]} ${
    SOBRENOMES[Math.floor(Math.random() * SOBRENOMES.length)]
  }`
  const phone = '55' + Math.floor(11000000000 + Math.random() * 88999999999).toString()
  const { error } = await supabase.from('leads').insert({
    user_id: userId,
    stage_id: firstStageId,
    name: nome,
    phone,
    source: 'teste',
    position: 0,
  })
  if (error) throw error
}
