'use client'

import { createClient } from '@supabase/supabase-js'

// Cliente único do browser. Aponta para o schema `crm` por padrão,
// então `supabase.from('leads')` já resolve para crm.leads.
// O auth usa endpoints próprios do Supabase (não é afetado por db.schema).
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    db: { schema: 'crm' },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
)
