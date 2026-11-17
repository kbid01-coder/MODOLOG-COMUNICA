const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export async function onRequestPost({request,env}){
try{
 const url=env.SUPABASE_URL,key=env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY,pub=env.SUPABASE_ANON_KEY||env.SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key||!pub)throw new Error('Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_ANON_KEY no Cloudflare');
 const b=await request.json(),action=b.action;const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
 async function db(path,method='GET',body){const r=await fetch(url+path,{method,headers:{...headers,...(method!=='GET'?{Prefer:'return=representation'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});if(!r.ok)throw new Error((await r.text()).slice(0,350));const t=await r.text();return t?JSON.parse(t):null}
 if(action==='login'){
  const r=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:pub,'Content-Type':'application/json'},body:JSON.stringify({email:b.email,password:b.password})});const x=await r.json();if(!r.ok)return json({error:'Credenciais inválidas'},401);
  const p=await identity(x.user.id);if(!p)return json({error:'Usuário sem acesso ao COMUNICA'},403);return json({access_token:x.access_token,refresh_token:x.refresh_token});
 }
 if(action==='refresh_session'){
  const rt=String(b.refresh_token||'');if(!rt||rt.length>4096)return json({error:'Sessão expirada'},401);
  const r=await fetch(url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:pub,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:rt})});
  const x=await r.json();if(!r.ok)return json({error:'Sessão expirada. Entre novamente.'},401);
  const p=await identity(x.user.id);if(!p)return json({error:'Usuário sem acesso ao COMUNICA'},403);
  return json({access_token:x.access_token,refresh_token:x.refresh_token});
 }
 async function identity(id){const a=await db('/rest/v1/modolog_profiles?id=eq.'+encodeURIComponent(id)+'&select=id,name,role,active');if(a?.[0]?.active)return {id,name:a[0].name,role:a[0].role,admin:['master','admin'].includes(a[0].role)};const c=await db('/rest/v1/comunica_users?id=eq.'+encodeURIComponent(id)+'&select=id,name,role,active');if(c?.[0]?.active)return {id,name:c[0].name,role:c[0].role,admin:false};return null}
 const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');if(!token)return json({error:'Login necessário'},401);
 const auth=await fetch(url+'/auth/v1/user',{headers:{apikey:pub,Authorization:'Bearer '+token}});if(!auth.ok)return json({error:'Sessão expirada. Entre novamente.'},401);const user=await auth.json(),p=await identity(user.id);if(!p)return json({error:'Usuário sem permissão'},403);
 const admin=()=>{if(!p.admin)throw new Error('Somente administradores podem realizar esta ação')};
 const member=async id=>{const c=await db('/rest/v1/comunica_channels?id=eq.'+encodeURIComponent(id)+'&select=id,is_general');if(!c.length)throw Error('Canal inexistente');if(!c[0].is_general){const m=await db('/rest/v1/comunica_members?channel_id=eq.'+encodeURIComponent(id)+'&user_id=eq.'+encodeURIComponent(p.id)+'&select=user_id');if(!m.length&&!p.admin)throw Error('Sem acesso a este canal')}return c[0]};
 if(action==='me')return json({user:p});
 if(action==='channels'){const cs=await db('/rest/v1/comunica_channels?select=id,name,is_general&order=created_at.asc');const ms=await db('/rest/v1/comunica_members?user_id=eq.'+encodeURIComponent(p.id)+'&select=channel_id');const allowed=new Set(ms.map(m=>m.channel_id));return json({channels:cs.filter(c=>p.admin||c.is_general||allowed.has(c.id))})}
 if(action==='messages'){await member(b.channel_id);const rows=await db('/rest/v1/comunica_messages?channel_id=eq.'+encodeURIComponent(b.channel_id)+'&select=id,user_id,sender,body,created_at&order=created_at.desc&limit=100');return json({messages:rows.reverse()})}
 if(action==='send'){await member(b.channel_id);const body=String(b.body||'').trim();if(!body||body.length>4000)throw Error('Mensagem inválida');await db('/rest/v1/comunica_messages','POST',{channel_id:b.channel_id,user_id:p.id,sender:p.name,body});return json({ok:true})}

 if(action==='ptt_status'){
  await member(b.channel_id);
  const locks=await db('/rest/v1/comunica_ptt_locks?channel_id=eq.'+encodeURIComponent(b.channel_id)+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&select=user_id,sender,expires_at,lease_id');
  return json({busy:!!locks.length,sender:locks[0]?.sender||null,user_id:locks[0]?.user_id||null,session:locks[0]?.lease_id||null});
 }
 if(action==='ptt_claim'){
  await member(b.channel_id);
  const lease=crypto.randomUUID();
  const r=await db('/rest/v1/rpc/comunica_ptt_claim','POST',{p_channel:b.channel_id,p_user:p.id,p_sender:p.name,p_lease:lease});
  return json({granted:r===true,lease:r===true?lease:null});
 }
 if(action==='ptt_renew'){
  await member(b.channel_id);
  if(!/^[0-9a-f-]{36}$/i.test(String(b.lease||'')))throw Error('Identificador inválido');
  const r=await db('/rest/v1/rpc/comunica_ptt_renew','POST',{p_channel:b.channel_id,p_user:p.id,p_lease:b.lease});
  return json({ok:r===true});
 }
 if(action==='ptt_release'){
  await member(b.channel_id);
  if(!/^[0-9a-f-]{36}$/i.test(String(b.lease||'')))throw Error('Identificador inválido');
  await db('/rest/v1/rpc/comunica_ptt_release','POST',{p_channel:b.channel_id,p_user:p.id,p_lease:b.lease});return json({ok:true});
 }
 if(action==='rtc_presence'){
  await member(b.channel_id);
  const up=await fetch(url+'/rest/v1/comunica_rtc_presence?on_conflict=channel_id,user_id',{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({channel_id:b.channel_id,user_id:p.id,last_seen:new Date().toISOString()})});if(!up.ok)throw Error('Presença WebRTC: '+(await up.text()).slice(0,150));
  const cutoff=new Date(Date.now()-12000).toISOString();
  const rows=await db('/rest/v1/comunica_rtc_presence?channel_id=eq.'+encodeURIComponent(b.channel_id)+'&last_seen=gt.'+encodeURIComponent(cutoff)+'&select=user_id');
  return json({peers:rows.map(x=>x.user_id).filter(id=>id!==p.id)});
 }
 if(action==='rtc_signal'){
  await member(b.channel_id);
  const lease=String(b.session||''),target=String(b.to||''),kind=String(b.kind||'');
  if(!/^[0-9a-f-]{36}$/i.test(lease)||!/^[0-9a-f-]{36}$/i.test(target)||!['join','offer','answer','ice'].includes(kind))throw Error('Sinalização inválida');
  if(!/^[0-9a-f-]{36}$/i.test(String(b.channel_id||'')))throw Error('Canal WebRTC inválido');
  if(target===p.id)throw Error('Destino inválido');
  const cutoff=new Date(Date.now()-12000).toISOString();
  const rows=await db('/rest/v1/comunica_rtc_presence?channel_id=eq.'+encodeURIComponent(b.channel_id)+'&user_id=eq.'+encodeURIComponent(target)+'&last_seen=gt.'+encodeURIComponent(cutoff)+'&select=user_id');
  if(!rows.length)throw Error('Aparelho não está ativo no canal');
  const payload=b.payload||{};
  if(JSON.stringify(payload).length>12000)throw Error('Sinal muito grande');
  await db('/rest/v1/comunica_rtc_signals','POST',{channel_id:b.channel_id,session_id:b.channel_id,from_user:p.id,to_user:target,kind,payload});
  return json({ok:true});
 }
 if(action==='rtc_poll'){
  await member(b.channel_id);
  const lease=String(b.session||''),since=Number(b.since||0);
  if(!/^[0-9a-f-]{36}$/i.test(String(b.channel_id||''))||!Number.isSafeInteger(since)||since<0)throw Error('Consulta inválida');
  const rows=await db('/rest/v1/comunica_rtc_signals?channel_id=eq.'+encodeURIComponent(b.channel_id)+'&session_id=eq.'+encodeURIComponent(b.channel_id)+'&to_user=eq.'+encodeURIComponent(p.id)+'&id=gt.'+since+'&created_at=gt.'+encodeURIComponent(new Date(Date.now()-20000).toISOString())+'&select=id,from_user,kind,payload&order=id.asc&limit=100');
  return json({items:rows});
 }
 if(action==='voice_list'){await member(b.channel_id);const rows=await db('/rest/v1/comunica_voice?channel_id=eq.'+encodeURIComponent(b.channel_id)+'&select=id,user_id,sender,created_at&order=id.desc&limit=25');return json({items:rows.reverse()})}
 if(action==='voice_send'){
  await member(b.channel_id);
  const content=String(b.content||''),mime=String(b.mime||'');
  if(content.length>1400000||!/^audio\/(webm|mp4|ogg)(;|$)/.test(mime))throw Error('Formato ou tamanho de áudio inválido');
  const raw=Uint8Array.from(atob(content),c=>c.charCodeAt(0));if(raw.length>1000000||raw.length<200)throw Error('Áudio inválido');
  const ext=mime.startsWith('audio/mp4')?'mp4':mime.startsWith('audio/ogg')?'ogg':'webm';
  const path=b.channel_id+'/'+crypto.randomUUID()+'.'+ext;
  const upload=await fetch(url+'/storage/v1/object/comunica-voice/'+path,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':mime,'x-upsert':'false'},body:raw});
  if(!upload.ok)throw Error('Falha ao armazenar áudio: '+(await upload.text()).slice(0,120));
  await db('/rest/v1/comunica_voice','POST',{channel_id:b.channel_id,user_id:p.id,sender:p.name,path});return json({ok:true});
 }
 if(action==='voice_url'){
  await member(b.channel_id);const id=Number(b.id);if(!Number.isSafeInteger(id)||id<1)throw Error('Áudio inválido');
  const rows=await db('/rest/v1/comunica_voice?id=eq.'+id+'&channel_id=eq.'+encodeURIComponent(b.channel_id)+'&select=path');if(!rows.length)throw Error('Áudio não encontrado');
  const r=await fetch(url+'/storage/v1/object/sign/comunica-voice/'+rows[0].path,{method:'POST',headers,body:JSON.stringify({expiresIn:60})});
  if(!r.ok)throw Error('Não foi possível abrir o áudio');const x=await r.json();return json({url:url+'/storage/v1'+x.signedURL});
 }
 if(action==='create_channel'){admin();const name=String(b.name||'').trim();if(name.length<3||name.length>100)throw Error('Informe um nome entre 3 e 100 caracteres');await db('/rest/v1/comunica_channels','POST',{name,is_general:false,created_by:p.id});return json({ok:true})}
 if(action==='create_user'){admin();const name=String(b.name||'').trim(),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');if(!name||!email.includes('@')||password.length<8)throw Error('Nome, e-mail e senha de 8 caracteres são obrigatórios');const r=await fetch(url+'/auth/v1/admin/users',{method:'POST',headers,body:JSON.stringify({email,password,email_confirm:true,user_metadata:{name}})});const u=await r.json();if(!r.ok)throw Error(u.msg||u.message||'Falha ao criar usuário');try{await db('/rest/v1/comunica_users','POST',{id:u.id,name,email,role:'operador',active:true})}catch(e){await fetch(url+'/auth/v1/admin/users/'+encodeURIComponent(u.id),{method:'DELETE',headers});throw e}return json({ok:true})}
 return json({error:'Ação desconhecida'},400);
}catch(e){return json({error:e.message||'Erro inesperado'},400)}
}
