import { NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/supabaseServer'

// Busca as conversas (DMs) existentes da instância DO USUÁRIO LOGADO e devolve a
// lista de contatos (telefone + nome). NÃO grava no banco — o app insere no board
// do usuário (respeitando o RLS).
//
// Requer Authorization: Bearer <access_token do Supabase>.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type EvoChat = { remoteJid?: string }
type EvoContact = { remoteJid?: string; pushName?: string | null }

export async function POST(req: Request) {
  const base = process.env.EVOLUTION_URL
  const key = process.env.EVOLUTION_API_KEY
  if (!base || !key) {
    return NextResponse.json({ ok: false, message: 'Evolution não configurada no servidor.' }, { status: 500 })
  }

  const authed = await getAuthedUser(req)
  if (!authed) {
    return NextResponse.json({ ok: false, message: 'não autenticado' }, { status: 401 })
  }
  const { user, supa } = authed

  // instância do usuário
  const { data: conn } = await supa
    .from('whatsapp_connections')
    .select('instance_name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const instance = (conn?.instance_name as string | undefined) ?? `user-${user.id}`

  const evoHeaders = { apikey: key, 'Content-Type': 'application/json' }

  try {
    const [chatsRes, contactsRes] = await Promise.all([
      fetch(`${base}/chat/findChats/${instance}`, { method: 'POST', headers: evoHeaders, body: '{}', cache: 'no-store' }),
      fetch(`${base}/chat/findContacts/${instance}`, { method: 'POST', headers: evoHeaders, body: '{}', cache: 'no-store' }),
    ])
    if (!chatsRes.ok) {
      return NextResponse.json({ ok: false, message: `Evolution chats ${chatsRes.status}` }, { status: 502 })
    }
    const chats: EvoChat[] = await chatsRes.json()
    const contacts: EvoContact[] = contactsRes.ok ? await contactsRes.json() : []

    const nameMap = new Map<string, string>()
    for (const c of contacts) {
      if (c.remoteJid && c.pushName) nameMap.set(c.remoteJid, c.pushName)
    }

    const seen = new Set<string>()
    const out: { phone: string; name: string | null }[] = []
    for (const c of chats) {
      const jid = c.remoteJid
      if (!jid || !jid.endsWith('@s.whatsapp.net')) continue
      const phone = jid.split('@')[0].split(':')[0].replace(/\D/g, '')
      if (phone.length < 8 || seen.has(phone)) continue
      seen.add(phone)
      out.push({ phone, name: nameMap.get(jid) ?? null })
    }

    return NextResponse.json({ ok: true, contacts: out })
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : 'Falha ao buscar conversas' },
      { status: 502 },
    )
  }
}
