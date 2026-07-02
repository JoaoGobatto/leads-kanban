// Tipos centrais do Kanban de leads.
// Espelham as tabelas do schema `crm` no Supabase (criadas depois).

export type Stage = {
  id: string
  name: string
  position: number
  color: string | null
}

export type Lead = {
  id: string
  name: string | null
  phone: string
  photo_url: string | null
  stage_id: string | null
  position: number
  source: string
  notes: string | null
  is_read: boolean
  created_at: string
}
