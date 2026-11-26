const { body, session, allowed, activity, notifyAssignee, unauth, forbidden } = require('./_core');
const {findTask,resolveAssignee,accessParams}=require('../lib/task-ownership');
const {key:dateKey}=require('../dist/task-dates');
const {nextDate,normalizeSchedule,canManage,changesMetadata}=require('../lib/task-schedule');
module.exports = async (req,res) => {
  try {
    const {sql,user}=await session(req); if(!user) return unauth(res);
    res.setHeader('Cache-Control','private, no-store');
    if(req.method==='GET') return res.status(200).json(await sql.query('SELECT * FROM tasks WHERE ($2::boolean OR assignee_id=$1) ORDER BY due_date ASC NULLS LAST,id DESC',accessParams(user)));
    const data=body(req);
    if(req.method==='POST') {
      if(!allowed(user,'create')) return forbidden(res);
      const {title,description='',area,assignee,due_date,priority='normal',recurrence='não se repete'}=data;
      if(!title||!area||!dateKey(due_date)) return res.status(400).json({error:'Título, área, responsável e prazo são obrigatórios.'});
      const owner=await resolveAssignee(sql,user,data);if(!owner)return res.status(400).json({error:'Responsável inválido ou não autorizado.'});
      let config;try{config=normalizeSchedule(recurrence,data.recurrence_config,due_date)}catch(e){return res.status(400).json({error:e.message})}
      const rows=await sql.query('INSERT INTO tasks (title,description,area,assignee,due_date,priority,recurrence,assignee_id,created_by,recurrence_config) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING *',[title,description,area,owner.name,dateKey(due_date),priority,recurrence,owner.id,user.id,JSON.stringify(config)]);
      await activity(sql,rows[0].id,user.id,'Criou a atividade');
      await notifyAssignee(sql,rows[0],user.id,'assigned','Nova atividade atribuída',`${user.name} atribuiu “${rows[0].title}” para você.`);
      return res.status(201).json(rows[0]);
    }
    if(req.method==='PATCH') {
      if(!allowed(user,'edit')) return forbidden(res);
      const {id,status,progress,title,description,area,assignee,due_date,priority,recurrence}=data; if(!id) return res.status(400).json({error:'Atividade inválida.'});
      const current=await findTask(sql,user,id); if(!current) return res.status(404).json({error:'Atividade não encontrada.'});
      const metadata=changesMetadata(data);if(metadata&&!canManage(user,current))return forbidden(res);
      const owner=await resolveAssignee(sql,user,data,current);if(!owner)return forbidden(res);
      if(due_date!=null&&!dateKey(due_date))return res.status(400).json({error:'Prazo inválido.'});
      const nextStatus=status||current.status;if(!['todo','andamento','revisão','concluída'].includes(nextStatus)||!Number.isFinite(Number(progress??current.progress)))return res.status(400).json({error:'Status ou progresso inválido.'});const nextProgress=nextStatus==='concluída'?100:Math.round(Math.max(0,Math.min(100,Number(progress ?? current.progress))));
      let config=current.recurrence_config||{};if(metadata){try{config=normalizeSchedule(recurrence??current.recurrence,data.recurrence_config??(recurrence&&recurrence!==current.recurrence?{}:config),due_date??current.due_date)}catch(e){return res.status(400).json({error:e.message})}}
      const rows=await sql.query('UPDATE tasks SET title=CASE WHEN $15::boolean THEN $1 ELSE title END,description=CASE WHEN $15 THEN $2 ELSE description END,area=CASE WHEN $15 THEN $3 ELSE area END,assignee=CASE WHEN $15 THEN $4 ELSE assignee END,due_date=CASE WHEN $15 THEN $5::date ELSE due_date END,priority=CASE WHEN $15 THEN $6 ELSE priority END,recurrence=CASE WHEN $15 THEN $7 ELSE recurrence END,status=$8,progress=$9,assignee_id=CASE WHEN $15 THEN $11::int ELSE assignee_id END,recurrence_config=CASE WHEN $15 THEN $14::jsonb ELSE recurrence_config END WHERE id=$10 AND ($13::boolean OR (assignee_id=$12 AND (NOT $15::boolean OR created_by=$12))) RETURNING *',[
        title??current.title,description??current.description,area??current.area,owner.name,due_date==null?current.due_date:dateKey(due_date),priority??current.priority,recurrence??current.recurrence,nextStatus,nextProgress,id,owner.id,...accessParams(user),JSON.stringify(config),metadata
      ]);
      const updated = rows[0];if(!updated)return res.status(404).json({error:'Atividade não encontrada.'});
      if (updated.assignee_id !== current.assignee_id) await notifyAssignee(sql,updated,user.id,'assigned','Atividade atribuída a você',`${user.name} atribuiu “${updated.title}” para você.`);
      else if (nextStatus !== current.status) await notifyAssignee(sql,updated,user.id,'status','Status atualizado',`A atividade “${updated.title}” avançou para ${nextStatus}.`);
      let generated = null;
      if (nextStatus === 'concluída' && updated.recurrence !== 'não se repete' && updated.due_date) {
        const nextDue = nextDate(updated.due_date, updated.recurrence,updated.recurrence_config);
        const created = await sql.query('INSERT INTO tasks (title,description,area,assignee,due_date,priority,recurrence,status,progress,generated_from,assignee_id,created_by,recurrence_config) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,$11,$12::jsonb) ON CONFLICT (generated_from) DO NOTHING RETURNING *',[
          updated.title,updated.description,updated.area,updated.assignee,nextDue,updated.priority,updated.recurrence,'todo',current.id,updated.assignee_id,updated.created_by,JSON.stringify(normalizeSchedule(updated.recurrence,updated.recurrence_config,updated.due_date))
        ]);
        generated = created[0] || null;
        if (generated) await activity(sql,current.id,user.id,`Gerou automaticamente a próxima rotina para ${nextDue}`);
      }
      await activity(sql,id,user.id,status&&status!==current.status?`Alterou status para ${nextStatus}`:'Editou a atividade'); return res.status(200).json({...updated,generated});
    }
    if(req.method==='DELETE') {
      if(!allowed(user,'delete')) return forbidden(res); if(!data.id) return res.status(400).json({error:'Atividade inválida.'});
      const deleted=await sql.query('DELETE FROM tasks WHERE id=$1 AND ($3::boolean OR (assignee_id=$2 AND created_by=$2)) RETURNING id',[data.id,...accessParams(user)]);if(!deleted.length)return res.status(404).json({error:'Atividade não encontrada.'}); return res.status(200).json({ok:true});
    }
    res.setHeader('Allow','GET,POST,PATCH,DELETE'); return res.status(405).end();
  } catch(error){console.error(error);return res.status(500).json({error:'Não foi possível acessar as atividades.'});}
};
