-- Executar no SQL Editor do projeto Supabase MODOLOG.
create table if not exists public.comunica_ptt_locks (
 channel_id uuid primary key references public.comunica_channels(id) on delete cascade,
 user_id uuid not null,
 sender text not null,
 lease_id uuid not null,
 expires_at timestamptz not null
);
revoke all on public.comunica_ptt_locks from anon, authenticated;
alter table public.comunica_ptt_locks enable row level security;
create or replace function public.comunica_ptt_claim(p_channel uuid,p_user uuid,p_sender text,p_lease uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_channel::text, 0));
 delete from public.comunica_ptt_locks where channel_id=p_channel and expires_at<=now();
 if exists(select 1 from public.comunica_ptt_locks where channel_id=p_channel) then return false; end if;
 insert into public.comunica_ptt_locks(channel_id,user_id,sender,lease_id,expires_at)
 values(p_channel,p_user,left(p_sender,150),p_lease,now()+interval '18 seconds');
 return true;
end $$;
create or replace function public.comunica_ptt_release(p_channel uuid,p_user uuid,p_lease uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 delete from public.comunica_ptt_locks where channel_id=p_channel and user_id=p_user and lease_id=p_lease;
end $$;
revoke all on function public.comunica_ptt_claim(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.comunica_ptt_release(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.comunica_ptt_claim(uuid,uuid,text,uuid) to service_role;
grant execute on function public.comunica_ptt_release(uuid,uuid,uuid) to service_role;
