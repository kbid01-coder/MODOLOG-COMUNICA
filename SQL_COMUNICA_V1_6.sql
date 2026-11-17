-- Execute uma vez no SQL Editor do Supabase antes de publicar V1.6.0.
create table if not exists public.comunica_rtc_presence (
 channel_id uuid not null references public.comunica_channels(id) on delete cascade,
 user_id uuid not null,
 last_seen timestamptz not null default now(),
 primary key(channel_id,user_id)
);
create index if not exists comunica_rtc_presence_recent on public.comunica_rtc_presence(channel_id,last_seen);
alter table public.comunica_rtc_presence enable row level security;
revoke all on public.comunica_rtc_presence from anon, authenticated;
-- Atualização atômica de presença via REST (POST com upsert)
