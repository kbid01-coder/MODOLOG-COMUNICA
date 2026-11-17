-- Executar no SQL Editor do projeto Supabase MODOLOG.
-- Renova apenas a reserva do proprio transmissor; nao altera outras tabelas.
create or replace function public.comunica_ptt_renew(p_channel uuid,p_user uuid,p_lease uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update public.comunica_ptt_locks
 set expires_at=now()+interval '18 seconds'
 where channel_id=p_channel and user_id=p_user and lease_id=p_lease and expires_at>now();
 return found;
end $$;
revoke all on function public.comunica_ptt_renew(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.comunica_ptt_renew(uuid,uuid,uuid) to service_role;
