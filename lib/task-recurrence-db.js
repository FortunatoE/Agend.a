'use strict';
const {nextDate,normalizeSchedule,kinds}=require('./task-schedule');
const D=require('../dist/task-dates');
async function reconcileRoutines(sql,user,limit=100){
 const today=(await sql.query("SELECT (now() AT TIME ZONE 'America/Cuiaba')::date::text AS day"))[0].day;
 let created=0;
 // Process bounded batches; the unique generated_from key makes parallel runs safe.
 for(let pass=0;pass<Math.ceil(limit/25)&&created<limit;pass++){
 const rows=await sql.query("SELECT t.* FROM tasks t WHERE ($2::boolean OR t.assignee_id=$1) AND t.recurrence=ANY($3::text[]) AND t.due_date<$4::date AND NOT EXISTS(SELECT 1 FROM tasks c WHERE c.generated_from=t.id) ORDER BY t.due_date,t.id LIMIT 100",[user.id,Boolean(user.is_admin),kinds.slice(1),today]);
 let batch=0;
 for(const t of rows){
 if(created>=limit)break;
 let next,config;try{config=normalizeSchedule(t.recurrence,t.recurrence_config,t.due_date);next=nextDate(t.due_date,t.recurrence,config)}catch{continue}
 if(!next||next>today)continue;
 const result=await sql.query(`WITH src AS MATERIALIZED (SELECT * FROM tasks WHERE id=$1 AND due_date=$2::date AND recurrence=$3 AND recurrence_config=$4::jsonb AND ($8::boolean OR assignee_id=$7) FOR UPDATE), child AS (
 INSERT INTO tasks(title,description,area,assignee,due_date,priority,recurrence,status,progress,generated_from,assignee_id,created_by,recurrence_config)
 SELECT title,description,area,assignee,$5::date,priority,recurrence,'todo',0,id,assignee_id,created_by,$6::jsonb FROM src
 ON CONFLICT(generated_from) DO NOTHING RETURNING id,generated_from),
 history AS (INSERT INTO task_activity(task_id,user_id,detail) SELECT generated_from,NULL,'Nova ocorrência automática: '||$5 FROM child)
 SELECT id FROM child`,[t.id,D.key(t.due_date),t.recurrence,JSON.stringify(t.recurrence_config||{}),next,JSON.stringify(config),user.id,Boolean(user.is_admin)]);
 if(result.length){created++;batch++}
 }
 if(!batch)break;
 }
 await sql.query(`INSERT INTO notifications(user_id,task_id,type,title,message)
 SELECT u.id,t.id,'overdue','Atividade não realizada','Prazo vencido: '||t.title FROM tasks t JOIN app_users u ON u.active AND (u.id=t.assignee_id OR u.is_admin)
 WHERE ($2::boolean OR t.assignee_id=$1) AND t.due_date<$3::date AND t.status<>'concluída' AND (u.id=$1 OR $2::boolean)
 ON CONFLICT DO NOTHING`,[user.id,Boolean(user.is_admin),today]);
 return {created,today};
}
module.exports={reconcileRoutines};
