const { body, session, allowed, activity, notifyAssignee, unauth, forbidden } = require('./_core');
function nextDate(value, recurrence) {
  const [year,month,day] = String(value).slice(0,10).split('-').map(Number);
  if (recurrence === 'diária') return new Date(Date.UTC(year,month-1,day+1)).toISOString().slice(0,10);
  if (recurrence === 'semanal') return new Date(Date.UTC(year,month-1,day+7)).toISOString().slice(0,10);
  const months = recurrence === 'mensal' ? 1 : 12;
  const rawMonth = month - 1 + months, targetYear = year + Math.floor(rawMonth / 12), targetMonth = rawMonth % 12;
  const lastDay = new Date(Date.UTC(targetYear,targetMonth+1,0)).getUTCDate();
  return new Date(Date.UTC(targetYear,targetMonth,Math.min(day,lastDay))).toISOString().slice(0,10);
}
module.exports = async (req,res) => {
  try {
    const {sql,user}=await session(req); if(!user) return unauth(res);
    if(req.method==='GET') return res.status(200).json(await sql.query('SELECT * FROM tasks ORDER BY due_date ASC NULLS LAST,id DESC'));
    const data=body(req);
    if(req.method==='POST') {
      if(!allowed(user,'create')) return forbidden(res);
      const {title,description='',area,assignee,due_date,priority='normal',recurrence='não se repete'}=data;
      if(!title||!area||!assignee||!due_date) return res.status(400).json({error:'Título, área, responsável e prazo são obrigatórios.'});
      const rows=await sql.query('INSERT INTO tasks (title,description,area,assignee,due_date,priority,recurrence) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',[title,description,area,assignee,due_date,priority,recurrence]);
      await activity(sql,rows[0].id,user.id,'Criou a atividade');
      await notifyAssignee(sql,rows[0],user.id,'assigned','Nova atividade atribuída',`${user.name} atribuiu “${rows[0].title}” para você.`);
      return res.status(201).json(rows[0]);
    }
    if(req.method==='PATCH') {
      if(!allowed(user,'edit')) return forbidden(res);
      const {id,status,progress,title,description,area,assignee,due_date,priority,recurrence}=data; if(!id) return res.status(400).json({error:'Atividade inválida.'});
      const current=(await sql.query('SELECT * FROM tasks WHERE id=$1',[id]))[0]; if(!current) return res.status(404).json({error:'Atividade não encontrada.'});
      const nextStatus=status||current.status, nextProgress=nextStatus==='concluída'?100:Math.max(0,Math.min(100,Number(progress ?? current.progress)));
      const rows=await sql.query('UPDATE tasks SET title=$1,description=$2,area=$3,assignee=$4,due_date=$5,priority=$6,recurrence=$7,status=$8,progress=$9 WHERE id=$10 RETURNING *',[
        title??current.title,description??current.description,area??current.area,assignee??current.assignee,due_date??current.due_date,priority??current.priority,recurrence??current.recurrence,nextStatus,nextProgress,id
      ]);
      const updated = rows[0];
      if (updated.assignee !== current.assignee) await notifyAssignee(sql,updated,user.id,'assigned','Atividade atribuída a você',`${user.name} atribuiu “${updated.title}” para você.`);
      else if (nextStatus !== current.status) await notifyAssignee(sql,updated,user.id,'status','Status atualizado',`A atividade “${updated.title}” avançou para ${nextStatus}.`);
      let generated = null;
      if (current.status !== 'concluída' && nextStatus === 'concluída' && updated.recurrence !== 'não se repete' && updated.due_date) {
        const nextDue = nextDate(updated.due_date, updated.recurrence);
        const created = await sql.query('INSERT INTO tasks (title,description,area,assignee,due_date,priority,recurrence,status,progress,generated_from) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9) ON CONFLICT (generated_from) DO NOTHING RETURNING *',[
          updated.title,updated.description,updated.area,updated.assignee,nextDue,updated.priority,updated.recurrence,'todo',current.id
        ]);
        generated = created[0] || null;
        if (generated) await activity(sql,current.id,user.id,`Gerou automaticamente a próxima rotina para ${nextDue}`);
      }
      await activity(sql,id,user.id,status&&status!==current.status?`Alterou status para ${nextStatus}`:'Editou a atividade'); return res.status(200).json({...updated,generated});
    }
    if(req.method==='DELETE') {
      if(!allowed(user,'delete')) return forbidden(res); if(!data.id) return res.status(400).json({error:'Atividade inválida.'});
      await sql.query('DELETE FROM tasks WHERE id=$1',[data.id]); return res.status(200).json({ok:true});
    }
    res.setHeader('Allow','GET,POST,PATCH,DELETE'); return res.status(405).end();
  } catch(error){console.error(error);return res.status(500).json({error:'Não foi possível acessar as atividades.'});}
};
