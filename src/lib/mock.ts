import type { Stage, Lead } from './types'

// Dados de teste para validar o board antes de plugar o Supabase real.
// As 5 colunas padrão são as mesmas que o banco vai criar para cada user.

export const MOCK_STAGES: Stage[] = [
  { id: 'novo', name: 'Novo', position: 0, color: '#3b82f6' },
  { id: 'conversa', name: 'Em conversa', position: 1, color: '#eab308' },
  { id: 'qualificado', name: 'Qualificado', position: 2, color: '#a855f7' },
  { id: 'fechado', name: 'Fechado', position: 3, color: '#22c55e' },
  { id: 'perdido', name: 'Perdido', position: 4, color: '#ef4444' },
]

export const MOCK_LEADS: Lead[] = [
  { id: 'l1', name: 'Maria Souza', phone: '5511988887777', photo_url: null, stage_id: 'novo', position: 0, source: 'whatsapp', notes: null, is_read: true, created_at: '2026-06-11T09:00:00Z' },
  { id: 'l2', name: 'João Pereira', phone: '5521977776666', photo_url: null, stage_id: 'novo', position: 1, source: 'whatsapp', notes: null, is_read: true, created_at: '2026-06-11T09:15:00Z' },
  { id: 'l3', name: 'Ana Lima', phone: '5531966665555', photo_url: null, stage_id: 'conversa', position: 0, source: 'whatsapp', notes: 'Pediu orçamento', is_read: true, created_at: '2026-06-10T14:00:00Z' },
  { id: 'l4', name: 'Carlos Mendes', phone: '5541955554444', photo_url: null, stage_id: 'qualificado', position: 0, source: 'whatsapp', notes: null, is_read: true, created_at: '2026-06-09T11:30:00Z' },
  { id: 'l5', name: 'Beatriz Rocha', phone: '5551944443333', photo_url: null, stage_id: 'fechado', position: 0, source: 'whatsapp', notes: 'Fechou plano anual', is_read: true, created_at: '2026-06-08T16:45:00Z' },
]
