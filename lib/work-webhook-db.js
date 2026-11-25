'use strict';
const crypto=require('node:crypto');
const {destinations,retryDelay,sendWebhook}=require('./work-webhook-rules');
async function ensureWebhooks(sql){
 if((await sql.query("SELECT to_regclass('public.work_webhook_attempts') AS name"))[0]?.name)return;
 await sql.query(`DO $migration$
 BEGIN
 PERFORM pg_advisory_xact_lock(86124022);
 CREATE TABLE IF NOT EXISTS work_webhook_subscriptions(
 id SERIAL PRIMARY KEY,board_id INTEGER NOT NULL REFERENCES work_boards(id) ON DELETE CASCADE,
 destination TEXT NOT NULL,enabled BOOLEAN NOT NULL DEFAULT TRUE,blocked BOOLEAN NOT NULL DEFAULT FALSE,
 cursor BIGINT NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,next_attempt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 lease_token UUID,lease_until TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(board_id,destination));
 CREATE TABLE IF NOT EXISTS work_webhook_attempts(
 id BIGSERIAL PRIMARY KEY,subscription_id INTEGER NOT NULL REFERENCES work_webhook_subscriptions(id) ON DELETE CASCADE,
 event_seq BIGINT NOT NULL,attempt INTEGER NOT NULL,success BOOLEAN NOT NULL,http_status INTEGER,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE INDEX IF NOT EXISTS work_webhook_attempts_subscription_idx ON work_webhook_attempts(subscription_id,id DESC);
 END;
 $migration$`);
}
async function claimWebhook(sql,board=null){
 const token=crypto.randomUUID();
 const rows=await sql.query(`WITH candidate AS MATERIALIZED (
 SELECT s.id,e.seq,e.item_id,e.event,e.created_at FROM work_webhook_subscriptions s
 CROSS JOIN LATERAL (SELECT seq,item_id,event,created_at FROM work_sync_events WHERE board_id=s.board_id AND seq>s.cursor ORDER BY seq LIMIT 1)e
 WHERE s.enabled AND NOT s.blocked AND s.next_attempt<=NOW() AND (s.lease_until IS NULL OR s.lease_until<NOW()) AND ($1::int IS NULL OR s.board_id=$1)
 ORDER BY s.next_attempt,s.id LIMIT 1 FOR UPDATE OF s SKIP LOCKED),
 claimed AS (UPDATE work_webhook_subscriptions s SET lease_token=$2::uuid,lease_until=NOW()+INTERVAL '60 seconds'
 FROM candidate c WHERE s.id=c.id RETURNING s.id,s.board_id,s.destination,s.attempts,c.seq,c.item_id,c.event,c.created_at)
 SELECT * FROM claimed`,[board,token]);
 return rows.length?{...rows[0],lease_token:token}:null;
}
async function finishWebhook(sql,row,result){
 const attempt=row.attempts+1;
 const rows=await sql.query(`WITH completed AS (
 UPDATE work_webhook_subscriptions SET cursor=CASE WHEN $4::boolean THEN $3::bigint ELSE cursor END,
 attempts=CASE WHEN $4::boolean THEN 0 ELSE $5::int END,blocked=NOT $4::boolean AND $5>=5,
 next_attempt=CASE WHEN $4::boolean THEN NOW() ELSE NOW()+$6::int*INTERVAL '1 minute' END,
 lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2::uuid RETURNING id),
 logged AS (INSERT INTO work_webhook_attempts(subscription_id,event_seq,attempt,success,http_status)
 SELECT id,$3::bigint,$5,$4,$7 FROM completed)
 SELECT id FROM completed`,[row.id,row.lease_token,String(row.seq),Boolean(result.ok),attempt,retryDelay(attempt),result.status]);
 return rows.length>0;
}
async function processWebhook(sql,board=null,configured=destinations(),sender=sendWebhook){
 const row=await claimWebhook(sql,board);if(!row)return {processed:false};
 const destination=configured.get(row.destination);
 const result=destination?await sender(row,destination):{ok:false,status:null};
 const saved=await finishWebhook(sql,row,result);
 return {processed:true,success:result.ok,recorded:saved};
}
async function manageWebhooks(sql,user,d,method,res){
 if(!user.is_admin)return res.status(403).json({error:'Acesso administrativo necessário.'});
 if(method!=='POST')return res.status(405).end();
 const bid=Number(d.board_id);if(!Number.isSafeInteger(bid)||bid<=0||!(await sql.query('SELECT id FROM work_boards WHERE id=$1',[bid])).length)return res.status(404).json({error:'Board indisponível.'});
 const configured=destinations();
 if(d.mode==='list'){
 const subscriptions=await sql.query('SELECT id,destination,enabled,blocked,cursor::text,attempts,next_attempt,lease_until FROM work_webhook_subscriptions WHERE board_id=$1 ORDER BY id',[bid]);
 const logs=await sql.query('SELECT a.id,s.destination,a.event_seq::text,a.attempt,a.success,a.http_status,a.created_at FROM work_webhook_attempts a JOIN work_webhook_subscriptions s ON s.id=a.subscription_id WHERE s.board_id=$1 ORDER BY a.id DESC LIMIT 100',[bid]);
 return res.status(200).json({destinations:[...configured.keys()],subscriptions,logs});
 }
 if(d.mode==='create'){
 if(!configured.has(d.destination))return res.status(400).json({error:'Destino não configurado na infraestrutura.'});
 const rows=await sql.query('INSERT INTO work_webhook_subscriptions(board_id,destination,cursor) VALUES($1,$2,COALESCE((SELECT last_seq FROM work_event_counters WHERE board_id=$1),0)) ON CONFLICT(board_id,destination) DO NOTHING RETURNING id',[bid,d.destination]);
 return rows.length?res.status(201).json(rows[0]):res.status(409).json({error:'Destino já vinculado.'});
 }
 if(d.mode==='process')return res.status(200).json(await processWebhook(sql,bid,configured));
 if(['pause','resume','retry'].includes(d.mode)){
 const id=Number(d.id);if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'Identificação inválida.'});
 const set=d.mode==='pause'?'enabled=false':d.mode==='resume'?'enabled=true':'blocked=false,attempts=0,next_attempt=NOW()';
 const rows=await sql.query('UPDATE work_webhook_subscriptions SET '+set+' WHERE board_id=$1 AND id=$2 AND (lease_until IS NULL OR lease_until<NOW()) RETURNING id',[bid,id]);
 return rows.length?res.status(200).json({ok:true}):res.status(409).json({error:'Inscrição indisponível ou em processamento.'});
 }
 return res.status(400).json({error:'Modo inválido.'});
}
module.exports={ensureWebhooks,claimWebhook,finishWebhook,processWebhook,manageWebhooks};
