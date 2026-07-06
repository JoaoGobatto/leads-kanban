# Handover técnico — Kanban de Leads do WhatsApp

Documento para o dev que vai **integrar este sistema dentro de um app web existente**
(app web + Supabase próprio). Cobre arquitetura, migração do banco, deploy, integração
de UI e segurança.

> ⚠️ **Segredos não estão neste arquivo** (o repo é público). Os valores de
> `EVOLUTION_API_KEY`, `WHATSAPP_WEBHOOK_SECRET` e `SUPABASE_SERVICE_ROLE_KEY` são
> passados pelo dono, fora do repositório.

---

## 1. O que é

CRM em formato **kanban** para organizar leads que chegam pelo **WhatsApp**. Cada usuário
conecta o próprio WhatsApp (via QR), e cada mensagem inbound vira um card no board do dono,
em tempo real. Read-only em relação ao WhatsApp (só recebe; nunca envia) → menor risco de ban.

## 2. Arquitetura (componentes)

```
WhatsApp ──▶ Evolution API (self-host) ──webhook messages.upsert──▶ Supabase Edge Function ──▶ crm.leads
                   ▲                                                                              │
   cria instância + QR (server route)                                                  realtime  ▼
            App Next.js (TypeScript) ◀──────────────────────────────────────────────────────  Board
```

- **Front-end + rotas de servidor:** Next.js 16 (App Router) + React 19 + Tailwind v4,
  TypeScript. Drag-and-drop com `@dnd-kit`.
- **Back-end de dados:** Supabase (Postgres + Auth + Realtime + RLS), schema dedicado **`crm`**.
- **Webhook:** Supabase **Edge Function** (Deno/TS) que recebe o evento da Evolution e faz
  upsert em `crm.leads`, roteando pelo dono via `crm.whatsapp_connections`.
- **WhatsApp:** **Evolution API** self-host (Docker), uma **instância por usuário** (`user-<uuid>`).

**Multi-tenant:** tudo é isolado por `auth.uid()` via RLS. O webhook mapeia
`instance_name → user_id` pela tabela `crm.whatsapp_connections`.

## 3. O que está onde

- **Código do app:** este repositório (Next.js). Rotas de servidor em `src/app/api/whatsapp/`.
- **Schema do banco:** seção 5 abaixo (SQL pronto para rodar no Supabase de destino).
- **Edge Function:** código na seção 6.
- **Evolution API:** hospedada em Docker/EasyPanel (host + API key com o dono).

## 4. Plano de integração (app existente + Supabase deles)

O app existente é **web e já usa Supabase**. Isso torna o **login unificado de graça**:
apontando este kanban para o **Supabase do app**, o usuário logado no app **já é** o dono
dos leads (o RLS por `auth.uid()` faz o resto). Sem ponte de identidade.

Passos:
1. **Rodar o SQL da seção 5** no Supabase do app (cria o schema `crm`, isolado — não toca no
   resto do banco deles).
2. **Expor o schema `crm`** na API (Settings → API → Exposed schemas → adicionar `crm`).
3. **Fazer deploy da Edge Function** (seção 6) no Supabase do app + configurar o segredo.
4. **Configurar as variáveis** do app (seção 7) apontando para o Supabase e a Evolution deles.
5. **Encaixar a UI** (seção 8): portar os componentes (se o app for React) ou embutir/reconstruir.

## 5. Migração do banco (schema `crm`)

Rodar no **SQL Editor** do Supabase de destino (ou como migration):

```sql
create schema if not exists crm;

-- Tabelas -------------------------------------------------------------
create table crm.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  created_at timestamptz not null default now()
);

create table crm.stages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  position   int  not null default 0,
  color      text,
  created_at timestamptz not null default now()
);

create table crm.leads (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  stage_id   uuid references crm.stages(id) on delete set null,
  position   int  not null default 0,
  name       text,
  phone      text not null,
  photo_url  text,
  source     text not null default 'whatsapp',
  notes      text,
  is_read    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index leads_user_phone_uniq on crm.leads (user_id, phone);

create table crm.whatsapp_connections (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  instance_name  text not null,
  evolution_host text,
  phone_number   text,
  status         text not null default 'disconnected'
                 check (status in ('disconnected','connecting','connected')),
  qr_code        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- updated_at automático ------------------------------------------------
create or replace function crm.touch_updated_at() returns trigger
  language plpgsql set search_path to '' as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_leads_touch       before update on crm.leads
  for each row execute function crm.touch_updated_at();
create trigger trg_connections_touch before update on crm.whatsapp_connections
  for each row execute function crm.touch_updated_at();

-- Novo usuário -> profile + 5 estágios padrão --------------------------
create or replace function crm.handle_new_user() returns trigger
  language plpgsql security definer set search_path to 'crm','public' as $$
begin
  insert into crm.profiles (id, email) values (new.id, new.email)
    on conflict (id) do nothing;
  insert into crm.stages (user_id, name, position, color) values
    (new.id, 'Novo',        0, '#3b82f6'),
    (new.id, 'Em conversa', 1, '#eab308'),
    (new.id, 'Qualificado', 2, '#a855f7'),
    (new.id, 'Fechado',     3, '#22c55e'),
    (new.id, 'Perdido',     4, '#ef4444');
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function crm.handle_new_user();
-- NOTA: se o app já tem um trigger próprio em auth.users, apenas ADICIONE
-- este; não substitua o existente.

-- RLS (isolamento por usuário) -----------------------------------------
alter table crm.profiles             enable row level security;
alter table crm.stages               enable row level security;
alter table crm.leads                enable row level security;
alter table crm.whatsapp_connections enable row level security;

create policy "own profile"     on crm.profiles
  for all using (auth.uid() = id)      with check (auth.uid() = id);
create policy "own stages"      on crm.stages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own leads"       on crm.leads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own connections" on crm.whatsapp_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Grants para os papéis da API -----------------------------------------
grant usage on schema crm to anon, authenticated, service_role;
grant all on all tables in schema crm to authenticated, service_role;
grant usage, select on all sequences in schema crm to authenticated, service_role;
alter default privileges in schema crm
  grant all on tables to authenticated, service_role;

-- Realtime em crm.leads ------------------------------------------------
alter publication supabase_realtime add table crm.leads;
alter table crm.leads replica identity full;
```

Depois: **Settings → API → Exposed schemas** → adicionar **`crm`** (senão o PostgREST não
enxerga o schema).

## 6. Edge Function `whatsapp-webhook`

Recebe `messages.upsert` da Evolution e cria/atualiza o lead. Usa o `service_role` (bypassa
RLS) e mapeia a instância → dono. Deploy: `supabase functions deploy whatsapp-webhook --no-verify-jwt`.

> **Melhoria recomendada vs. a versão atual:** o segredo do webhook deve vir de uma
> **env/secret** (`supabase secrets set WHATSAPP_WEBHOOK_SECRET=...`), não hardcoded.
> A versão abaixo já lê de env.

```ts
import { createClient } from "jsr:@supabase/supabase-js@2";

const SECRET = Deno.env.get("WHATSAPP_WEBHOOK_SECRET")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { db: { schema: "crm" }, auth: { persistSession: false } },
);

function extractPhone(jid: string): string | null {
  if (!jid.endsWith("@s.whatsapp.net")) return null;      // só DMs (ignora grupos/@lid)
  const digits = jid.split("@")[0].split(":")[0].replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

async function handleMessage(instance: string, data: any) {
  const key = data?.key;
  if (!key || key.fromMe === true) return { skipped: "outbound" };
  const phone = key.remoteJid ? extractPhone(key.remoteJid) : null;
  if (!phone) return { skipped: "not-a-dm" };
  const name: string | null = data?.pushName ?? null;

  const { data: conn } = await supabase.from("whatsapp_connections")
    .select("user_id").eq("instance_name", instance).maybeSingle();
  if (!conn) return { skipped: "unknown-instance", instance };
  const userId = conn.user_id;

  const { data: stage } = await supabase.from("stages")
    .select("id").eq("user_id", userId).order("position").limit(1).maybeSingle();
  const { data: last } = await supabase.from("leads")
    .select("position").eq("user_id", userId).eq("stage_id", stage?.id ?? null)
    .order("position", { ascending: false }).limit(1).maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { error } = await supabase.from("leads").insert({
    user_id: userId, stage_id: stage?.id ?? null, phone, name,
    source: "whatsapp", position, is_read: false,
  });
  if (error) {
    if (error.code === "23505") { // lead já existe -> volta a "não lido", sem mover o card
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), is_read: false };
      if (name) patch.name = name;
      await supabase.from("leads").update(patch).eq("user_id", userId).eq("phone", phone);
      return { updated: phone };
    }
    return { error: error.message };
  }
  return { created: phone };
}

Deno.serve(async (req) => {
  if (req.method === "GET") return new Response("ok");
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") ?? req.headers.get("x-webhook-secret");
  if (secret !== SECRET) return new Response("unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  if (String(body?.event ?? "").toLowerCase().replace(/_/g, ".") !== "messages.upsert")
    return new Response(JSON.stringify({ ignored: true }), { status: 200 });

  const instance = body?.instance ?? body?.instanceName ?? "";
  const payload = body?.data;
  const items = Array.isArray(payload) ? payload
    : Array.isArray(payload?.messages) ? payload.messages : [payload];
  const results = [];
  for (const item of items) {
    try { results.push(await handleMessage(instance, item)); }
    catch (e) { results.push({ error: String(e) }); }
  }
  return new Response(JSON.stringify({ ok: true, results }), { status: 200 });
});
```

**IMPORTANTE:** a Edge Function precisa ser deployada **sem verificação de JWT** (a Evolution
não manda JWT do Supabase); a auth dela é o `?secret=` na URL. O grant do `service_role` no
schema `crm` (já incluído na seção 5) é obrigatório, senão dá `permission denied for schema crm`.

## 7. Variáveis de ambiente do app (Next.js)

| Variável | Onde é usada | Secreta? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + build | não (pública) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + build | não (publishable) |
| `EVOLUTION_URL` | rotas de servidor | não (URL) |
| `EVOLUTION_API_KEY` | rotas de servidor | **SIM** |
| `WHATSAPP_WEBHOOK_SECRET` | (usado ao criar instância/webhook) | **SIM** |

As `NEXT_PUBLIC_*` são embutidas no **build** (passar como build args no Docker/EasyPanel).
As demais são lidas em **runtime** pelos route handlers (`src/app/api/whatsapp/*`).
Ver `Dockerfile` (base `node:20-slim`, `output: 'standalone'`).

## 8. Integração da UI no app existente

**Componentes principais** (em `src/components/`): `BoardContainer` (orquestra tudo),
`Board`/`Column`/`LeadCard` (kanban + dnd), `LeadDetail` (painel editar/excluir),
`ConnectWhatsApp` (modal do QR). Dados/estado em `src/lib/` (`api.ts`, `supabase.ts`,
`supabaseServer.ts`, `types.ts`).

- **Se o app for React/Next:** portar os componentes e o `src/lib`. Trocar o client
  `src/lib/supabase.ts` para usar a instância de Supabase/sessão do app (o usuário logado do
  app vira o dono dos leads — não instanciar um segundo auth). Rotas de servidor
  (`/api/whatsapp`, `/api/whatsapp/import`) precisam de um backend Node/edge equivalente que
  guarde a `EVOLUTION_API_KEY`.
- **Se for outra stack (Vue/Angular/PHP/etc.):** duas opções — (a) **embutir** este app
  Next.js como iframe/subdomínio apontando para o mesmo Supabase (login compartilhado via
  sessão Supabase); ou (b) **reconstruir a UI** na stack do app reaproveitando 100% do back
  (Supabase + Evolution + Edge Function) — a lógica de dados está em `src/lib/api.ts`.

**Auth:** o segredo é o app e o kanban compartilharem a **mesma sessão Supabase**. Não criar
um segundo login.

## 9. Evolution API (WhatsApp)

- Uma **instância por usuário**: `user-<auth.uid()>`, criada sob demanda pela rota
  `src/app/api/whatsapp/route.ts` (GET) quando o usuário clica em "Conectar".
- Essa rota também **seta o webhook** da instância apontando para a Edge Function:
  `https://<PROJECT>.supabase.co/functions/v1/whatsapp-webhook?secret=<WHATSAPP_WEBHOOK_SECRET>`
  com `events: ["MESSAGES_UPSERT"]`, e grava a linha em `crm.whatsapp_connections`.
- Endpoints Evolution usados: `POST /instance/create`, `POST /webhook/set/{inst}`,
  `GET /instance/connectionState/{inst}`, `GET /instance/connect/{inst}` (QR),
  `POST /chat/findChats/{inst}` e `POST /chat/findContacts/{inst}` (import).
- A Evolution pode ser reaproveitada (mesmo host) ou subir uma nova; o que importa é o
  webhook de cada instância apontar para a Edge Function do Supabase de destino.

## 10. Segurança / checklist de handover

- [ ] Trocar/rotacionar `EVOLUTION_API_KEY` e `WHATSAPP_WEBHOOK_SECRET` após o handover.
- [ ] Mover o segredo do webhook para env/secret (feito na versão da seção 6).
- [ ] Dar acesso ao dev via **convite** (membro no Supabase/EasyPanel), não senha pessoal.
- [ ] Confirmar o fluxo de **confirmação de e-mail** no Supabase de destino (signup).
- [ ] Conferar RLS ativo em todas as tabelas `crm` (a seção 5 já ativa).
```
