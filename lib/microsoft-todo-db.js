'use strict';
const C=require('./microsoft-todo-core');
async function ensureMicrosoftTodo(sql){
 if((await sql.query("SELECT to_regclass('public.agenda_ms_task_map') IS NOT NULL AS ok"))[0]?.ok)return;
 await sql.query(`DO $migration$ BEGIN
 PERFORM pg_advisory_xact_lock(86124031);
 CREATE TABLE IF NOT EXISTS agenda_ms_oauth_state(
 state_hash TEXT PRIMARY KEY,user_id INT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,session_hash TEXT NOT NULL,verifier_cipher TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL);
 CREATE TABLE IF NOT EXISTS agenda_ms_connections(
 user_id INT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,account_id TEXT UNIQUE NOT NULL,account_name TEXT NOT NULL DEFAULT '',refresh_cipher TEXT,list_name TEXT NOT NULL,list_id TEXT,
 list_attempted BOOLEAN NOT NULL DEFAULT FALSE,lease_token TEXT,lease_until TIMESTAMPTZ,last_sync_at TIMESTAMPTZ,last_result JSONB NOT NULL DEFAULT '{}');
 CREATE TABLE IF NOT EXISTS agenda_ms_task_map(
 user_id INT NOT NULL REFERENCES agenda_ms_connections(user_id) ON DELETE CASCADE,task_id INT NOT NULL,marker TEXT NOT NULL UNIQUE,external_id TEXT,last_status TEXT,attempted BOOLEAN NOT NULL DEFAULT FALSE,checked_at TIMESTAMPTZ,
 PRIMARY KEY(user_id,task_id),UNIQUE(user_id,external_id));
 END; $migration$`);
}
const sessionHash=req=>C.hash((req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('agenda_session='))||'');
const stateContext=(user,state)=>'ms-state:'+user+':'+state;
const credentialContext=(user,account)=>'ms-refresh:'+user+':'+account;
async function startOAuth(sql,user,req,c){
 const state=C.random(),verifier=C.random(),digest=C.hash(state);
 await sql.query('DELETE FROM agenda_ms_oauth_state WHERE expires_at<NOW() OR user_id=$1',[user.id]);
 await sql.query("INSERT INTO agenda_ms_oauth_state(state_hash,user_id,session_hash,verifier_cipher,expires_at) VALUES($1,$2,$3,$4,NOW()+interval '10 minutes')",[digest,user.id,sessionHash(req),C.seal(verifier,c,stateContext(user.id,digest))]);
 return C.authUrl(c,state,verifier);
}
async function finishOAuth(sql,user,req,c){
 const {state,code,error}=req.query||{};
 if(typeof state!=='string'||state.length>128)return 'invalid';
 const digest=C.hash(state),s=(await sql.query('DELETE FROM agenda_ms_oauth_state WHERE state_hash=$1 AND user_id=$2 AND session_hash=$3 AND expires_at>NOW() RETURNING verifier_cipher',[digest,user.id,sessionHash(req)]))[0];
 if(!s||error||typeof code!=='string'||code.length>4096)return 'invalid';
 const tokens=await C.token(c,{grant_type:'authorization_code',code,code_verifier:C.unseal(s.verifier_cipher,c,stateContext(user.id,digest))});
 if(typeof tokens.refresh_token!=='string'||!tokens.refresh_token)return 'consent';
 const account=await C.graph(tokens.access_token,'me?$select=id,displayName');
 if(typeof account?.id!=='string'||!account.id||account.id.length>256)return 'invalid';
 const cipher=C.seal(tokens.refresh_token,c,credentialContext(user.id,account.id));
 try{
 const rows=await sql.query(`INSERT INTO agenda_ms_connections(user_id,account_id,account_name,refresh_cipher,list_name) VALUES($1,$2,$3,$4,$5)
 ON CONFLICT(user_id) DO UPDATE SET refresh_cipher=EXCLUDED.refresh_cipher,account_name=EXCLUDED.account_name
 WHERE agenda_ms_connections.account_id=EXCLUDED.account_id AND (agenda_ms_connections.lease_until IS NULL OR agenda_ms_connections.lease_until<NOW()) RETURNING user_id`,[user.id,account.id,String(account.displayName||'Conta Microsoft').slice(0,200),cipher,'Agend.a — Insumos-hub '+C.random().slice(0,8)]);
 return rows.length?'connected':'account-conflict';
 }catch(e){if(e.code==='23505')return 'account-conflict';throw e}
}
async function status(sql,user,c){
 const row=(await sql.query('SELECT account_name,refresh_cipher IS NOT NULL AS connected,list_name,list_id IS NOT NULL AS list_ready,last_sync_at,last_result,lease_until>NOW() AS busy FROM agenda_ms_connections WHERE user_id=$1',[user.id]))[0];
 const stale=(await sql.query('SELECT count(*)::int AS n FROM agenda_ms_task_map m LEFT JOIN tasks t ON t.id=m.task_id AND t.assignee_id=m.user_id WHERE m.user_id=$1 AND t.id IS NULL AND m.external_id IS NOT NULL',[user.id]))[0]?.n||0;
 return {configured:Boolean(c),connected:Boolean(row?.connected),account_name:row?.account_name||null,list_name:row?.list_name||null,list_ready:Boolean(row?.list_ready),last_sync_at:row?.last_sync_at||null,last_result:row?.last_result||{},busy:Boolean(row?.busy),stale};
}
async function ensureList(sql,conn,access){
 if(conn.list_id)return conn.list_id;
 const list=(await C.collection(access,'me/todo/lists')).find(l=>l.displayName===conn.list_name&&!l.isShared);
 if(list?.id){await sql.query('UPDATE agenda_ms_connections SET list_id=$2 WHERE user_id=$1',[conn.user_id,list.id]);return list.id}
 if(conn.list_attempted)throw new C.ProviderError(0,'list-uncertain');
 await sql.query('UPDATE agenda_ms_connections SET list_attempted=true WHERE user_id=$1',[conn.user_id]);
 let created;try{created=await C.graph(access,'me/todo/lists','POST',{displayName:conn.list_name})}catch(e){if(e.status>=400&&e.status<500&&e.status!==408)await sql.query('UPDATE agenda_ms_connections SET list_attempted=false WHERE user_id=$1',[conn.user_id]);throw e}
 if(!created?.id)throw new C.ProviderError(0,'list-uncertain');
 await sql.query('UPDATE agenda_ms_connections SET list_id=$2 WHERE user_id=$1',[conn.user_id,created.id]);return created.id;
}
async function importCompletion(sql,userId,t,m,remote){
 if(!C.shouldImport(t,m,remote,true))return false;
 const rows=await sql.query(`WITH changed AS (UPDATE tasks t SET status='concluída',progress=100 WHERE t.id=$1 AND t.assignee_id=$2 AND t.status=$3 AND EXISTS(SELECT 1 FROM app_users u WHERE u.id=$2 AND u.active AND (u.is_admin OR u.can_edit)) RETURNING id),
 history AS (INSERT INTO task_activity(task_id,user_id,detail) SELECT id,$2,'Concluiu via Microsoft To Do' FROM changed)
 SELECT id FROM changed`,[t.id,userId,t.status]);
 return rows.length>0;
}
async function sync(sql,user,c){
 const lease=C.random(),conn=(await sql.query("UPDATE agenda_ms_connections SET lease_token=$2,lease_until=NOW()+interval '3 minutes' WHERE user_id=$1 AND refresh_cipher IS NOT NULL AND (lease_until IS NULL OR lease_until<NOW()) RETURNING *",[user.id,lease]))[0];
 if(!conn)return {busy:true};
 const result={created:0,updated:0,completed:0,unchanged:0,pending:0,missing:0,uncertain:0,failed:0};let error=null;
 try{
 const tokens=await C.token(c,{grant_type:'refresh_token',refresh_token:C.unseal(conn.refresh_cipher,c,credentialContext(user.id,conn.account_id))});
 if(tokens.refresh_token)await sql.query('UPDATE agenda_ms_connections SET refresh_cipher=$3 WHERE user_id=$1 AND lease_token=$2',[user.id,lease,C.seal(tokens.refresh_token,c,credentialContext(user.id,conn.account_id))]);
 const access=tokens.access_token,list=await ensureList(sql,conn,access);
 // Never use a shared list. If the owner deletes it or shares it, stop instead of exporting data.
 const check=await C.graph(access,'me/todo/lists/'+encodeURIComponent(list));
 if(check?.isShared!==false||check?.isOwner!==true)throw new C.ProviderError(0,'list-not-private');
 const rows=await sql.query(`SELECT t.id,t.title,t.priority,t.status,t.due_date,m.external_id,m.marker,m.last_status,m.attempted,m.checked_at
 FROM tasks t LEFT JOIN agenda_ms_task_map m ON m.user_id=t.assignee_id AND m.task_id=t.id
 WHERE t.assignee_id=$1 AND (t.status<>'concluída' OR m.task_id IS NOT NULL)
 ORDER BY m.checked_at NULLS FIRST,t.id LIMIT 8`,[user.id]);
 let remoteCollection=null;const deadline=Date.now()+22000;
 for(const snapshot of rows){
 if(Date.now()>deadline){result.pending++;continue}
 const fresh=(await sql.query('SELECT id,title,priority,status,due_date FROM tasks WHERE id=$1 AND assignee_id=$2',[snapshot.id,user.id]))[0];if(!fresh)continue;
 let t=fresh,m=(await sql.query('SELECT * FROM agenda_ms_task_map WHERE user_id=$1 AND task_id=$2',[user.id,t.id]))[0];
 if(!m){m=(await sql.query('INSERT INTO agenda_ms_task_map(user_id,task_id,marker) VALUES($1,$2,$3) RETURNING *',[user.id,t.id,C.random()]))[0]}
 try{
 let remote=null;
 if(m.external_id){
 try{remote=await C.graph(access,C.taskPath(list,m.external_id))}catch(e){if(e.status===404){result.missing++;continue}throw e}
 }else if(m.attempted){
 if(!remoteCollection)remoteCollection=await C.collection(access,C.taskPath(list));
 const matches=remoteCollection.filter(x=>x.body?.contentType==='text'&&x.body?.content===C.markerText(m.marker));
 if(matches.length!==1){result.uncertain++;continue}
 remote=matches[0];
 await sql.query('UPDATE agenda_ms_task_map SET external_id=$3 WHERE user_id=$1 AND task_id=$2',[user.id,t.id,remote.id]);m.external_id=remote.id;
 }else{
 // Set the intent before issuing POST; an ambiguous response never causes an automatic duplicate POST.
 await sql.query('UPDATE agenda_ms_task_map SET attempted=true,last_status=$3 WHERE user_id=$1 AND task_id=$2',[user.id,t.id,t.status]);
 let created;try{created=await C.graph(access,C.taskPath(list),'POST',C.payload(t,m.marker))}catch(e){if(e.status>=400&&e.status<500&&e.status!==408)await sql.query('UPDATE agenda_ms_task_map SET attempted=false,last_status=NULL WHERE user_id=$1 AND task_id=$2',[user.id,t.id]);throw e}
 if(!created?.id){result.uncertain++;continue}
 await sql.query('UPDATE agenda_ms_task_map SET external_id=$3,last_status=$4 WHERE user_id=$1 AND task_id=$2',[user.id,t.id,created.id,t.status]);result.created++;continue;
 }
 if(!remote?.id){result.uncertain++;continue}
 if(await importCompletion(sql,user.id,t,m,remote)){result.completed++;t={...t,status:'concluída'}}
 // Recheck owner and latest status after the external read and before any outbound update.
 t=(await sql.query('SELECT id,title,priority,status,due_date FROM tasks WHERE id=$1 AND assignee_id=$2',[snapshot.id,user.id]))[0];if(!t)continue;
 const desired=C.payload(t,m.marker);delete desired.body; // Preserve personal notes added in the provider.
 if(!C.samePayload(remote,desired)){await C.graph(access,C.taskPath(list,remote.id),'PATCH',desired);result.updated++}else result.unchanged++;
 await sql.query('UPDATE agenda_ms_task_map SET last_status=$3 WHERE user_id=$1 AND task_id=$2',[user.id,t.id,t.status]);
 }catch(e){result.failed++;if(e.status===429||e.status===401||e.status===403){error=e.status===429?'rate-limit':'authorization';break}}
 finally{await sql.query('UPDATE agenda_ms_task_map SET checked_at=NOW() WHERE user_id=$1 AND task_id=$2',[user.id,t.id])}
 }
 }catch(e){error=e.kind&&e.kind!=='provider'?e.kind:e.status===429?'rate-limit':e.status===401||e.status===403||e.status===400?'authorization':'sync-failed'}
 finally{await sql.query('UPDATE agenda_ms_connections SET lease_token=NULL,lease_until=NULL,last_sync_at=NOW(),last_result=$3::jsonb WHERE user_id=$1 AND lease_token=$2',[user.id,lease,JSON.stringify({...result,error})])}
 return {...result,error};
}
module.exports={ensureMicrosoftTodo,startOAuth,finishOAuth,status,sync,importCompletion};
