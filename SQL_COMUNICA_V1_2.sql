-- MODOLOG COMUNICA V1.2 — mensagens curtas de voz PTT
-- Executar uma única vez no Supabase SQL Editor
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('comunica-voice','comunica-voice',false,1000000,ARRAY['audio/webm','audio/mp4','audio/ogg'])
on conflict (id) do nothing;
create table if not exists public.comunica_voice (
 id bigint generated always as identity primary key,
 channel_id uuid not null references public.comunica_channels(id) on delete cascade,
 user_id uuid not null references auth.users(id),
 sender text not null,
 path text not null,
 created_at timestamptz not null default now()
);
create index if not exists comunica_voice_channel_idx on public.comunica_voice(channel_id,id desc);
alter table public.comunica_voice enable row level security;
revoke all on public.comunica_voice from anon,authenticated;
-- A API Cloudflare verifica login e participação antes de ler/gravar.
