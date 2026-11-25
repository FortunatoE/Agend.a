const { get } = require('@vercel/blob');
const { session, unauth } = require('./_core');
module.exports = async (req,res) => {
  try {
    const {sql,user}=await session(req); if(!user) return unauth(res);
    const path=String(req.query.path||''); const row=(await sql.query('SELECT a.filename,a.pathname,a.content_type FROM task_attachments a JOIN tasks t ON t.id=a.task_id WHERE a.pathname=$1 AND ($3::boolean OR t.assignee_id=$2)',[path,user.id,Boolean(user.is_admin)]))[0];
    if(!row) return res.status(404).end(); const file=await get(row.pathname,{access:'private'}); if(!file) return res.status(404).end();
    const bytes=Buffer.from(await file.blob.arrayBuffer()); res.setHeader('Cache-Control','private, no-store'); res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Content-Type','application/octet-stream'); res.setHeader('Content-Disposition',`attachment; filename="${row.filename.replace(/"/g,'') }"`); return res.status(200).end(bytes);
  } catch(error){console.error(error);return res.status(500).end();}
};
