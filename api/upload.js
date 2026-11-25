const { put } = require('@vercel/blob');
const { body, session, allowed, activity, unauth, forbidden } = require('./_core');
module.exports = async (req,res) => {
  try {
    if(req.method!=='POST') return res.status(405).end();
    const {sql,user}=await session(req); if(!user) return unauth(res); if(!allowed(user,'edit')) return forbidden(res);
    const {task_id,filename,content_type,data}=body(req); if(!task_id||!filename||!data) return res.status(400).json({error:'Anexo inválido.'});
    const safe=String(filename).replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100);
    const blob=await put(`tasks/${task_id}/${Date.now()}-${safe}`,Buffer.from(data,'base64'),{access:'private',contentType:content_type||'application/octet-stream',addRandomSuffix:true});
    await sql.query('INSERT INTO task_attachments (task_id,filename,pathname,content_type) VALUES ($1,$2,$3,$4)',[task_id,filename,blob.pathname,content_type||null]);
    await activity(sql,task_id,user.id,`Anexou ${filename}`); return res.status(201).json({ok:true});
  } catch(error){console.error(error);return res.status(500).json({error:'Não foi possível enviar o anexo.'});}
};
