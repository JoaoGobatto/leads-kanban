import { createClient } from '@supabase/supabase-js'

// Cliente Supabase para route handlers, autenticado COM O TOKEN DO USUÁRIO.
// As queries respeitam o RLS (auth.uid() = user_id). Aponta para o schema `crm`.
export function supaForToken(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: 'crm' },
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}

// Extrai o usuário a partir do header Authorization da requisição.
// Retorna { user, supa } ou null se não autenticado.
export async function getAuthedUser(req: Request) {
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null
  const supa = supaForToken(token)
  const {
    data: { user },
  } = await supa.auth.getUser(token)
  if (!user) return null
  return { user, supa, token }
}
