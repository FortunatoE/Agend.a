const { body, session, syncOverdueNotifications, unauth } = require('./_core');

module.exports = async (req,res) => {
  try {
    const {sql,user}=await session(req); if(!user) return unauth(res);
    if(req.method==='GET') {
      await syncOverdueNotifications(sql,user);
      const notifications=await sql.query('SELECT n.* FROM notifications n WHERE n.user_id=$1 AND (n.task_id IS NULL OR $2::boolean OR EXISTS(SELECT 1 FROM tasks t WHERE t.id=n.task_id AND t.assignee_id=$1)) ORDER BY n.created_at DESC LIMIT 50',[user.id,Boolean(user.is_admin)]);
      return res.status(200).json({notifications,unread:notifications.filter(item=>!item.read_at).length});
    }
    if(req.method==='PATCH') {
      const data=body(req);
      if(data.action==='read_all') await sql.query('UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL',[user.id]);
      else if(data.id) await sql.query('UPDATE notifications SET read_at=NOW() WHERE id=$1 AND user_id=$2',[data.id,user.id]);
      else return res.status(400).json({error:'Notificação inválida.'});
      return res.status(200).json({ok:true});
    }
    res.setHeader('Allow','GET,PATCH'); return res.status(405).end();
  } catch(error) { console.error(error); return res.status(500).json({error:'Não foi possível carregar as notificações.'}); }
};
