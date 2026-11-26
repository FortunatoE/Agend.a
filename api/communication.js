'use strict';
const {session,body,unauth,forbidden}=require('./_core');
const areas=['Administrativo','Logística · Defensivo','Logística · Adubo','Planejamento'];
const validId=v=>Number.isSafeInteger(v)&&v>0;
const clean=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
async function ensureCommunication(sql){
 if((await sql.query("SELECT to_regclass('public.agenda_notes') AS ready"))[0]?.ready)return;
 await sql.query(`DO $migration$ BEGIN
 PERFORM pg_advisory_xact_lock(86124025);
 CREATE TABLE IF NOT EXISTS agenda_communications(id SERIAL PRIMARY KEY,author_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,title TEXT NOT NULL,message TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('recado','lembrete')),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS agenda_recipients(communication_id INTEGER NOT NULL REFERENCES agenda_communications(id) ON DELETE CASCADE,user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,seen_at TIMESTAMPTZ,done_at TIMESTAMPTZ,PRIMARY KEY(communication_id,user_id));
 CREATE INDEX IF NOT EXISTS agenda_recipients_user_idx ON agenda_recipients(user_id,communication_id);
 CREATE TABLE IF NOT EXISTS agenda_area_members(user_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE,area TEXT NOT NULL,PRIMARY KEY(user_id,area));
 CREATE TABLE IF NOT EXISTS agenda_notes(id SERIAL PRIMARY KEY,author_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,title TEXT NOT NULL,message TEXT NOT NULL,audience TEXT NOT NULL CHECK(audience IN ('team','area','admins')),area TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CHECK((audience='area')=(area IS NOT NULL)));
 END; $migration$`);
}
module.exports=async(req,res)=>{
 try{
 res.setHeader('Cache-Control','private, no-store');
 const {sql,user}=await session(req);if(!user)return unauth(res);await ensureCommunication(sql);
 if(req.method==='GET'){
 const received=await sql.query(`SELECT c.*,r.seen_at,r.done_at FROM agenda_communications c JOIN agenda_recipients r ON r.communication_id=c.id WHERE r.user_id=$1 ORDER BY c.id DESC LIMIT 200`,[user.id]);
 const sent=user.is_admin?await sql.query(`SELECT c.*,COALESCE(jsonb_agg(jsonb_build_object('id',r.user_id,'name',u.name,'seen_at',r.seen_at,'done_at',r.done_at) ORDER BY u.name) FILTER(WHERE r.user_id IS NOT NULL),'[]'::jsonb) recipients FROM agenda_communications c LEFT JOIN agenda_recipients r ON r.communication_id=c.id LEFT JOIN app_users u ON u.id=r.user_id GROUP BY c.id ORDER BY c.id DESC LIMIT 200`):[];
 const notes=await sql.query(`SELECT n.*,COALESCE(u.name,'Usuário') author FROM agenda_notes n LEFT JOIN app_users u ON u.id=n.author_id WHERE $2::boolean OR n.author_id=$1 OR n.audience='team' OR (n.audience='area' AND EXISTS(SELECT 1 FROM agenda_area_members m WHERE m.user_id=$1 AND m.area=n.area)) ORDER BY n.id DESC LIMIT 200`,[user.id,Boolean(user.is_admin)]);
 const members=await sql.query(user.is_admin?'SELECT m.user_id,m.area FROM agenda_area_members m':'SELECT m.user_id,m.area FROM agenda_area_members m WHERE m.user_id=$1',user.is_admin?[]:[user.id]);
 return res.status(200).json({received,sent,notes,members,areas});
 }
 const d=body(req);
 if(req.method==='POST'&&d.action==='send'){
 if(!user.is_admin)return forbidden(res);
 const title=clean(d.title,150),message=clean(d.message,5000);
 if(!title||!message||!['recado','lembrete'].includes(d.kind)||!['all','one'].includes(d.audience)||d.audience==='one'&&!validId(d.user_id))return res.status(400).json({error:'Informe o título, mensagem e destinatário.'});
 const rows=await sql.query(`WITH targets AS MATERIALIZED (SELECT id FROM app_users WHERE active AND NOT is_admin AND ($4::boolean OR id=$5)), c AS (INSERT INTO agenda_communications(author_id,title,message,kind) SELECT $1,$2,$3,$6 WHERE EXISTS(SELECT 1 FROM targets) RETURNING id), r AS (INSERT INTO agenda_recipients(communication_id,user_id) SELECT c.id,t.id FROM c CROSS JOIN targets RETURNING communication_id,user_id), n AS (INSERT INTO notifications(user_id,task_id,type,title,message) SELECT user_id,NULL,'communication','Novo comunicado','Consulte a central de recados e lembretes.' FROM r) SELECT c.id,(SELECT count(*)::int FROM r) recipients FROM c`,[user.id,title,message,d.audience==='all',d.audience==='all'?null:d.user_id,d.kind]);
 return rows.length?res.status(201).json(rows[0]):res.status(400).json({error:'Nenhum colaborador ativo selecionado.'});
 }
 if(req.method==='PATCH'&&['seen','done'].includes(d.action)){
 if(!validId(d.id))return res.status(400).json({error:'Comunicado inválido.'});
 const rows=await sql.query('UPDATE agenda_recipients SET seen_at=COALESCE(seen_at,NOW())'+(d.action==='done'?',done_at=COALESCE(done_at,NOW())':'')+' WHERE communication_id=$1 AND user_id=$2 RETURNING seen_at,done_at',[d.id,user.id]);
 return rows.length?res.status(200).json(rows[0]):res.status(404).json({error:'Comunicado indisponível.'});
 }
 if(req.method==='POST'&&d.action==='note'){
 const title=clean(d.title,150),message=clean(d.message,5000);
 if(!title||!message||!['team','area','admins'].includes(d.audience)||d.audience==='area'&&!areas.includes(d.area))return res.status(400).json({error:'Anotação ou visibilidade inválida.'});
 const rows=await sql.query(`INSERT INTO agenda_notes(author_id,title,message,audience,area) SELECT $1,$2,$3,$4,$5 WHERE $4<>'area' OR $6::boolean OR EXISTS(SELECT 1 FROM agenda_area_members WHERE user_id=$1 AND area=$5) RETURNING id`,[user.id,title,message,d.audience,d.audience==='area'?d.area:null,Boolean(user.is_admin)]);
 return rows.length?res.status(201).json(rows[0]):forbidden(res);
 }
 if(req.method==='POST'&&d.action==='membership'){
 if(!user.is_admin)return forbidden(res);
 if(!validId(d.user_id)||!areas.includes(d.area)||typeof d.enabled!=='boolean')return res.status(400).json({error:'Vínculo inválido.'});
 if(d.enabled)await sql.query('INSERT INTO agenda_area_members(user_id,area) SELECT id,$2 FROM app_users WHERE id=$1 AND active ON CONFLICT DO NOTHING',[d.user_id,d.area]);else await sql.query('DELETE FROM agenda_area_members WHERE user_id=$1 AND area=$2',[d.user_id,d.area]);
 return res.status(200).json({ok:true});
 }
 return res.status(405).json({error:'Ação indisponível.'});
 }catch(e){console.error(e);return res.status(500).json({error:'Não foi possível acessar a comunicação.'})}
};
module.exports.ensureCommunication=ensureCommunication;
