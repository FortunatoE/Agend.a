'use strict';
async function ensureTaskOwnership(sql){
 await ensureOwnerColumn(sql);
 await ensureTaskRules(sql);
}
async function ensureOwnerColumn(sql){
 const exists=await sql.query("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='assignee_id') AS ok");
 if(exists[0]?.ok)return;
 await sql.query(`DO $migration$
 BEGIN
 PERFORM pg_advisory_xact_lock(86124023);
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='assignee_id') THEN
 ALTER TABLE tasks ADD COLUMN assignee_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL;
 UPDATE tasks t SET assignee_id=u.id FROM
 (SELECT lower(trim(name)) AS name_key,min(id) AS id FROM app_users GROUP BY lower(trim(name)) HAVING count(*)=1) u
 WHERE lower(trim(t.assignee))=u.name_key;
 CREATE INDEX tasks_assignee_id_idx ON tasks(assignee_id,due_date);
 END IF;
 END;
 $migration$`);
}
async function ensureTaskRules(sql){
 const rows=await sql.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name IN ('created_by','recurrence_config')");
 if(rows[0]?.n===2)return;
 await sql.query(`DO $rules$ BEGIN
 PERFORM pg_advisory_xact_lock(86124024);
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='created_by') THEN
 ALTER TABLE tasks ADD COLUMN created_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL;
 IF to_regclass('public.task_activity') IS NOT NULL THEN
 UPDATE tasks t SET created_by=a.user_id FROM (SELECT task_id,min(user_id) user_id FROM task_activity WHERE detail='Criou a atividade' AND user_id IS NOT NULL GROUP BY task_id HAVING count(DISTINCT user_id)=1) a WHERE t.id=a.task_id;
 END IF;
 END IF;
 ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_config JSONB NOT NULL DEFAULT '{}';
 END; $rules$`);
}
const accessParams=u=>[u.id,Boolean(u.is_admin)];
async function findTask(sql,user,id){
 if(!Number.isSafeInteger(Number(id))||Number(id)<=0)return null;
 return (await sql.query('SELECT * FROM tasks WHERE id=$1 AND ($3::boolean OR assignee_id=$2)',[Number(id),...accessParams(user)]))[0]||null;
}
async function resolveAssignee(sql,user,data,existing){
 const specified=Object.hasOwn(data,'assignee_id')||Object.hasOwn(data,'assignee');
 if(existing&&!specified)return {id:existing.assignee_id,name:existing.assignee};
 if(!user.is_admin){
 if(data.assignee_id!=null&&Number(data.assignee_id)!==user.id||data.assignee!=null&&data.assignee!==user.name)return null;
 return {id:user.id,name:user.name};
 }
 if(data.assignee_id!=null){
 const id=Number(data.assignee_id);if(!Number.isSafeInteger(id)||id<=0)return null;
 return (await sql.query('SELECT id,name FROM app_users WHERE id=$1 AND active=true',[id]))[0]||null;
 }
 if(typeof data.assignee!=='string'||!data.assignee.trim())return null;
 const matches=await sql.query('SELECT id,name FROM app_users WHERE active=true AND lower(trim(name))=lower(trim($1))',[data.assignee]);
 return matches.length===1?matches[0]:null;
}
module.exports={ensureTaskOwnership,accessParams,findTask,resolveAssignee};
