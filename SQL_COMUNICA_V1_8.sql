-- Executar UMA VEZ no SQL Editor do Supabase antes de publicar V1.8.
create table if not exists public.comunica_user_presence (
 user_id uuid primary key,
 last_seen timestamptz not null default now()
);
create index if not exists comunica_user_presence_recent on public.comunica_user_presence(last_seen);
create table if not exists public.comunica_direct_invites (
 recipient_id uuid primary key,
 caller_id uuid not null,
 channel_id uuid not null references public.comunica_channels(id) on delete cascade,
 updated_at timestamptz not null default now()
);
create index if not exists comunica_direct_invites_recent on public.comunica_direct_invites(updated_at);
alter table public.comunica_user_presence enable row level security;
alter table public.comunica_direct_invites enable row level security;
revoke all on public.comunica_user_presence from anon,authenticated;
revoke all on public.comunica_direct_invites from anon,authenticated;
-- A API Cloudflare utiliza a chave de serviço e valida o usuário autenticado.
