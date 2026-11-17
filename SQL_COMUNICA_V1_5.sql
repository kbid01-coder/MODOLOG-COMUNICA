-- MODOLOG COMUNICA V1.5 - Sinalização WebRTC (somente metadados, nunca áudio)
create table if not exists public.comunica_rtc_signals (
 id bigint generated always as identity primary key,
 channel_id uuid not null references public.comunica_channels(id) on delete cascade,
 session_id uuid not null,
 from_user uuid not null,
 to_user uuid not null,
 kind text not null check (kind in ('join','offer','answer','ice')),
 payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists comunica_rtc_signals_poll_idx on public.comunica_rtc_signals(channel_id,session_id,to_user,id);
alter table public.comunica_rtc_signals enable row level security;
revoke all on public.comunica_rtc_signals from anon, authenticated;
-- Opcional: limpeza periódica de sinais antigos, sem afetar mensagens ou áudios.
-- delete from public.comunica_rtc_signals where created_at < now()-interval '1 day';
