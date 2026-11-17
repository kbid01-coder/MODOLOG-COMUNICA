-- MODOLOG COMUNICA V1.0 — executar no projeto Supabase usado pelo Checklist
-- Não modifica modolog_profiles nem as tabelas dos outros aplicativos.
create table if not exists public.comunica_users (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null, email text not null unique,
 role text not null default 'operador' check(role in ('operador')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.comunica_channels (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 is_general boolean not null default false,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create unique index if not exists comunica_one_general on public.comunica_channels(is_general) where is_general;
create table if not exists public.comunica_members (
 channel_id uuid not null references public.comunica_channels(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key(channel_id,user_id)
);
create table if not exists public.comunica_messages (
 id bigint generated always as identity primary key,
 channel_id uuid not null references public.comunica_channels(id) on delete cascade,
 user_id uuid not null references auth.users(id),
 sender text not null,
 body text not null check(length(body) between 1 and 4000),
 created_at timestamptz not null default now()
);
create index if not exists comunica_messages_channel_time on public.comunica_messages(channel_id,created_at desc);
create table if not exists public.comunica_announcements (
 id bigint generated always as identity primary key,
 title text not null, body text not null,
 author_id uuid references auth.users(id),
 created_at timestamptz not null default now()
);
insert into public.comunica_channels(name,is_general)
select 'Canal Geral — MODOLOG',true
where not exists(select 1 from public.comunica_channels where is_general=true);
-- O acesso aos dados é realizado exclusivamente pela função Cloudflare autenticada.
-- Negar acesso direto ao cliente anon/authenticated; não criar políticas permissivas.
alter table public.comunica_users enable row level security;
alter table public.comunica_channels enable row level security;
alter table public.comunica_members enable row level security;
alter table public.comunica_messages enable row level security;
alter table public.comunica_announcements enable row level security;
revoke all on public.comunica_users,public.comunica_channels,public.comunica_members,public.comunica_messages,public.comunica_announcements from anon,authenticated;
