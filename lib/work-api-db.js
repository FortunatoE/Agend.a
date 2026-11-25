'use strict';
const crypto=require('node:crypto');
const {normalizeKey,normalizeRecord,safeRead}=require('./work-api-rules');
const hash=token=>crypto.createHash('sha256').update(token).digest('hex');
async function ensureApiKeys(sql){
 if((await sql.query("SELECT to_regclass('public.work_api_requests') AS name"))[0]?.name)return;
 await sql.query(`DO $migration$
 BEGIN
 PERFORM pg_advisory_xact_lock(86124019);
 CREATE TABLE IF NOT EXISTS work_api_keys(
 id SERIAL PRIMARY KEY,board_id INTEGER NOT NULL REFERENCES work_boards(id) ON DELETE CASCADE,
 owner_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 name TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,prefix TEXT NOT NULL,
 scope TEXT NOT NULL CHECK(scope IN ('read','read_create')),expires_at TIMESTAMPTZ NOT NULL,
 revoked_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 last_used_at TIMESTAMPTZ,rate_window TIMESTAMPTZ,rate_count INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS work_api_logs(
 id BIGSERIAL PRIMARY KEY,key_id INTEGER NOT NULL REFERENCES work_api_keys(id) ON DELETE CASCADE,
 method TEXT NOT NULL,status INTEGER NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE INDEX IF NOT EXISTS work_api_logs_key_idx ON work_api_logs(key_id,id DESC);
 CREATE TABLE IF NOT EXISTS work_api_requests(
 key_id INTEGER NOT NULL REFERENCES work_api_keys(id) ON DELETE CASCADE,
 request_id UUID NOT NULL,item_id INTEGER NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(key_id,request_id));
 END;
 $migration$`);
}
const live="k.revoked_at IS NULL AND k.expires_at>NOW() AND u.active AND work_board_role(k.owner_id,k.board_id)>0";
async function manageKeys(sql,user,d,method,res){
 if(!user.is_admin)return res.status(403).json({error:'Acesso administrativo necessário.'});
 if(method!=='POST')return res.status(405).end();
 const board=Number(d.board_id);
 if(!Number.isSafeInteger(board)||board<=0||!(await sql.query('SELECT id FROM work_boards WHERE id=$1',[board])).length)return res.status(404).json({error:'Board indisponível.'});
 if(d.mode==='list'){
 const keys=await sql.query('SELECT k.id,k.name,k.prefix,k.scope,k.expires_at,k.revoked_at,k.last_used_at,k.created_at,k.owner_id,u.name AS owner_name FROM work_api_keys k JOIN app_users u ON u.id=k.owner_id WHERE k.board_id=$1 ORDER BY k.id DESC',[board]);
 const logs=await sql.query('SELECT l.id,l.method,l.status,l.created_at,k.name FROM work_api_logs l JOIN work_api_keys k ON k.id=l.key_id WHERE k.board_id=$1 ORDER BY l.id DESC LIMIT 100',[board]);
 return res.status(200).json({keys,logs});
 }
 if(d.mode==='create'){
 let config;try{config=normalizeKey(d)}catch(e){return res.status(400).json({error:e.message})}
 const owner=(await sql.query('SELECT id,is_admin,can_create,work_board_role(id,$2) AS role FROM app_users WHERE id=$1 AND active',[config.owner_id,board]))[0];
 if(!owner||owner.role<1||(config.scope==='read_create'&&(owner.role<2||(!owner.is_admin&&!owner.can_create))))return res.status(400).json({error:'Usuário sem permissão suficiente neste Board.'});
 const token='agd_'+crypto.randomBytes(32).toString('hex'),prefix=token.slice(0,12);
 const rows=await sql.query("INSERT INTO work_api_keys(board_id,owner_id,name,token_hash,prefix,scope,expires_at) VALUES($1,$2,$3,$4,$5,$6,NOW()+$7::int*INTERVAL '1 day') RETURNING id,expires_at",[board,config.owner_id,config.name,hash(token),prefix,config.scope,config.days]);
 return res.status(201).json({...rows[0],token});
 }
 if(d.mode==='revoke'){
 const rows=await sql.query('UPDATE work_api_keys SET revoked_at=COALESCE(revoked_at,NOW()) WHERE board_id=$1 AND id=$2 RETURNING id',[board,Number(d.key_id)]);
 return rows.length?res.status(200).json({ok:true}):res.status(404).json({error:'Credencial não encontrada.'});
 }
 return res.status(400).json({error:'Modo inválido.'});
}
async function authenticate(sql,token){
 const rows=await sql.query(`UPDATE work_api_keys k SET rate_window=date_trunc('minute',NOW()),rate_count=CASE WHEN k.rate_window=date_trunc('minute',NOW()) THEN k.rate_count+1 ELSE 1 END,last_used_at=NOW()
 FROM app_users u WHERE k.token_hash=$1 AND u.id=k.owner_id AND ${live} AND (k.rate_window IS DISTINCT FROM date_trunc('minute',NOW()) OR k.rate_count<60)
 RETURNING k.id,k.board_id,k.owner_id,k.scope`,[hash(token)]);
 if(rows.length)return {key:rows[0]};
 const known=await sql.query(`SELECT k.id FROM work_api_keys k JOIN app_users u ON u.id=k.owner_id WHERE k.token_hash=$1 AND ${live}`,[hash(token)]);
 return {status:known.length?429:401};
}
async function externalApi(sql,req,res,body){
 res.setHeader('Cache-Control','no-store');
 const match=typeof req.headers.authorization==='string'&&/^Bearer (agd_[0-9a-f]{64})$/.exec(req.headers.authorization);
 if(!match)return res.status(401).json({error:'Credencial inválida.'});
 const auth=await authenticate(sql,match[1]);
 if(!auth.key){if(auth.status===429)res.setHeader('Retry-After','60');return res.status(auth.status).json({error:auth.status===429?'Limite de 60 requisições por minuto.':'Credencial inválida ou expirada.'})}
 const key=auth.key;
 async function reply(status,data){try{await sql.query('INSERT INTO work_api_logs(key_id,method,status) VALUES($1,$2,$3)',[key.id,['GET','POST'].includes(req.method)?req.method:'OTHER',status])}catch{}return res.status(status).json(data)}
 try{
 if(req.method==='GET'){
 const cursor=Number(req.query?.after??0);
 if(!Number.isSafeInteger(cursor)||cursor<0||cursor>2147483647)return reply(400,{error:'Cursor inválido.'});
 const rows=await sql.query(`SELECT b.id,b.name,
 COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM work_fields f WHERE f.board_id=b.id AND f.type IN ('text','number','date','checkbox','status')),'[]') AS fields,
 COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM (SELECT id,title,group_id,created_at,values FROM work_items WHERE board_id=b.id AND id>$2 ORDER BY id LIMIT 101)i),'[]') AS items,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',g.id,'name',g.name) ORDER BY g.id) FROM work_groups g WHERE g.board_id=b.id),'[]') AS groups
 FROM work_api_keys k JOIN app_users u ON u.id=k.owner_id JOIN work_boards b ON b.id=k.board_id WHERE k.id=$1 AND ${live}`,[key.id,cursor]);
 if(!rows.length)return reply(403,{error:'Acesso revogado.'});
 const row=rows[0],page=row.items.slice(0,100),data=safeRead(row.fields,page);
 return reply(200,{board:{id:row.id,name:row.name},groups:row.groups,...data,next_after:row.items.length>100?page[page.length-1].id:null});
 }
 if(req.method!=='POST')return reply(405,{error:'Use GET ou POST.'});
 if(key.scope!=='read_create')return reply(403,{error:'Credencial somente leitura.'});
 let d;try{d=body(req);if(JSON.stringify(d).length>250000)throw Error('Requisição muito grande.')}catch(e){return reply(400,{error:'Corpo inválido ou muito grande.'})}
 const fields=await sql.query('SELECT id,type FROM work_fields WHERE board_id=$1',[key.board_id]);
 let record;try{record=normalizeRecord(d,fields)}catch(e){return reply(400,{error:e.message})}
 if(record.group_id!==null&&!(await sql.query('SELECT id FROM work_groups WHERE id=$1 AND board_id=$2',[record.group_id,key.board_id])).length)return reply(400,{error:'Grupo inválido.'});
 const params=[key.id,record.request_id,record.title,JSON.stringify(record.values),record.group_id];
 const rows=await sql.query(`WITH authorized AS MATERIALIZED (
 SELECT k.id,k.board_id,set_config('agenda.actor_id',k.owner_id::text,true) AS actor
 FROM work_api_keys k JOIN app_users u ON u.id=k.owner_id
 WHERE k.id=$1 AND ${live} AND k.scope='read_create' AND work_board_role(k.owner_id,k.board_id)>=2 AND (u.is_admin OR u.can_create)
 AND ($5::int IS NULL OR EXISTS(SELECT 1 FROM work_groups WHERE id=$5 AND board_id=k.board_id))),
 reserved AS (INSERT INTO work_api_requests(key_id,request_id,item_id)
 SELECT id,$2::uuid,nextval(pg_get_serial_sequence('work_items','id'))::int FROM authorized ON CONFLICT DO NOTHING RETURNING key_id,item_id),
 inserted AS (INSERT INTO work_items(id,board_id,title,values,group_id)
 SELECT r.item_id,a.board_id,$3,$4::jsonb,$5 FROM reserved r JOIN authorized a ON a.id=r.key_id RETURNING id)
 SELECT id FROM inserted`,params);
 if(rows.length)return reply(201,{id:rows[0].id});
 const previous=await sql.query(`SELECT r.item_id FROM work_api_requests r JOIN work_api_keys k ON k.id=r.key_id JOIN app_users u ON u.id=k.owner_id WHERE k.id=$1 AND r.request_id=$2::uuid AND ${live} AND k.scope='read_create' AND work_board_role(k.owner_id,k.board_id)>=2 AND (u.is_admin OR u.can_create)`,params.slice(0,2));
 return previous.length?reply(200,{id:previous[0].item_id,replayed:true}):reply(403,{error:'Permissão de criação indisponível.'});
 }catch(e){return reply(500,{error:'Não foi possível processar a integração.'})}
}
module.exports={ensureApiKeys,manageKeys,externalApi,authenticate,hash};
