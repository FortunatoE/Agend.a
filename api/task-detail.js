const { body, session, allowed, activity, notifyAssignee, unauth, forbidden } = require('./_core');
module.exports = async (req,res) => {
  try {
    const {sql,user}=await session(req); if(!user) return unauth(res);
    const data=req.method==='GET'?req.query:body(req), taskId=Number(data.task_id||data.id); if(!taskId) return res.status(400).json({error:'Atividade inválida.'});
    if(req.method==='GET') {
      const [checklist,comments,attachments,history]=await Promise.all([
        sql.query('SELECT * FROM task_checklist WHERE task_id=$1 ORDER BY id',[taskId]),
        sql.query('SELECT c.*,COALESCE(u.name,\'Sistema\') author FROM task_comments c LEFT JOIN app_users u ON u.id=c.user_id WHERE c.task_id=$1 ORDER BY c.created_at DESC',[taskId]),
        sql.query('SELECT * FROM task_attachments WHERE task_id=$1 ORDER BY id DESC',[taskId]),
        sql.query('SELECT a.*,COALESCE(u.name,\'Sistema\') author FROM task_activity a LEFT JOIN app_users u ON u.id=a.user_id WHERE a.task_id=$1 ORDER BY a.created_at DESC',[taskId])
      ]); return res.status(200).json({checklist,comments,attachments,history});
    }
    const action=data.action;
    if(action==='comment') { if(!data.message?.trim()) return res.status(400).json({error:'Comentário vazio.'}); const task=(await sql.query('SELECT * FROM tasks WHERE id=$1',[taskId]))[0]; if(!task) return res.status(404).json({error:'Atividade não encontrada.'}); await sql.query('INSERT INTO task_comments (task_id,user_id,message) VALUES ($1,$2,$3)',[taskId,user.id,data.message.trim()]); await activity(sql,taskId,user.id,'Adicionou um comentário'); await notifyAssignee(sql,task,user.id,'comment','Novo comentário',`${user.name} comentou em “${task.title}”.`); return res.status(201).json({ok:true}); }
    if(!allowed(user,'edit')) return forbidden(res);
    if(action==='checklist_add') { await sql.query('INSERT INTO task_checklist (task_id,label) VALUES ($1,$2)',[taskId,data.label?.trim()||'Nova etapa']); await activity(sql,taskId,user.id,'Adicionou item ao checklist'); }
    if(action==='checklist_toggle') { await sql.query('UPDATE task_checklist SET done=NOT done WHERE id=$1 AND task_id=$2',[data.item_id,taskId]); await activity(sql,taskId,user.id,'Atualizou checklist'); }
    return res.status(200).json({ok:true});
  } catch(error){console.error(error);return res.status(500).json({error:'Não foi possível carregar os detalhes.'});}
};
