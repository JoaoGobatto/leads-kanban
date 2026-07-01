import { NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/supabaseServer'

// Conexão do WhatsApp POR USUÁRIO (multi-tenant).
// Cada usuário tem a própria instância Evolution `user-<id>`, criada sob demanda,
// com webhook apontado para a Edge Function. A conexão é registrada em
// crm.whatsapp_connections (que é como o webhook roteia o lead para o dono).
//
// Requer Authorization: Bearer <access_token do Supabase> (enviado pelo app).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const base = process.env.EVOLUTION_URL
  const key = process.env.EVOLUTION_API_KEY
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET
  if (!base || !key || !supaUrl || !secret) {
    return NextResponse.json({ status: 'error', message: 'Servidor não configurado.' }, { status: 500 })
  }

  const authed = await getAuthedUser(req)
  if (!authed) {
    return NextResponse.json({ status: 'error', message: 'não autenticado' }, { status: 401 })
  }
  const { user, supa } = authed

  const evoHeaders = { apikey: key, 'Content-Type': 'application/json' }
  const webhookUrl = `${supaUrl}/functions/v1/whatsapp-webhook?secret=${secret}`

  try {
    // Reusa a conexão existente do usuário; senão cria a instância dele.
    const { data: conn } = await supa
      .from('whatsapp_connections')
      .select('instance_name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let instance = conn?.instance_name as string | undefined

    if (!instance) {
      instance = `user-${user.id}`
      // 1) cria a instância na Evolution
      await fetch(`${base}/instance/create`, {
        method: 'POST',
        headers: evoHeaders,
        body: JSON.stringify({ instanceName: instance, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
      })
      // 2) aponta o webhook (só MESSAGES_UPSERT) para a Edge Function
      await fetch(`${base}/webhook/set/${instance}`, {
        method: 'POST',
        headers: evoHeaders,
        body: JSON.stringify({
          webhook: { enabled: true, url: webhookUrl, byEvents: false, base64: false, events: ['MESSAGES_UPSERT'] },
        }),
      })
      // 3) registra a conexão (RLS: user_id = auth.uid())
      await supa.from('whatsapp_connections').insert({
        user_id: user.id,
        instance_name: instance,
        evolution_host: base,
        status: 'connecting',
      })
    }

    // estado da conexão
    const stRes = await fetch(`${base}/instance/connectionState/${instance}`, { headers: evoHeaders, cache: 'no-store' })
    if (stRes.ok) {
      const st = await stRes.json()
      const state = st?.instance?.state ?? st?.state
      if (state === 'open') {
        await supa
          .from('whatsapp_connections')
          .update({ status: 'connected' })
          .eq('user_id', user.id)
          .eq('instance_name', instance)
        return NextResponse.json({ status: 'connected' })
      }
    }

    // QR atual
    const cRes = await fetch(`${base}/instance/connect/${instance}`, { headers: evoHeaders, cache: 'no-store' })
    const c = cRes.ok ? await cRes.json() : null
    if (c?.instance?.state === 'open') {
      await supa
        .from('whatsapp_connections')
        .update({ status: 'connected' })
        .eq('user_id', user.id)
        .eq('instance_name', instance)
      return NextResponse.json({ status: 'connected' })
    }
    const qr: string | null = c?.base64 ?? c?.qrcode?.base64 ?? null
    return NextResponse.json({ status: 'connecting', qr })
  } catch (e) {
    return NextResponse.json(
      { status: 'error', message: e instanceof Error ? e.message : 'Falha ao falar com a Evolution' },
      { status: 502 },
    )
  }
}
