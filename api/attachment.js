const { get } = require('@vercel/blob');
const { session, unauth } = require('./_core');
module.exports = async (req,res) => {
  try {
    const {sql,user}=await session(req); if(!user) return unauth(res);
    const path=String(req.query.path||''); const row=(await sql.query('SELECT filename,pathname,content_type FROM task_attachments WHERE pathname=$1',[path]))[0];
    if(!row) return res.status(404).end(); const file=await get(row.pathname,{access:'private'}); if(!file) return res.status(404).end();
    const bytes=Buffer.from(await file.blob.arrayBuffer()); res.setHeader('Content-Type',row.content_type||'application/octet-stream'); res.setHeader('Content-Disposition',`inline; filename="${row.filename.replace(/"/g,'') }"`); return res.status(200).end(bytes);
  } catch(error){console.error(error);return res.status(500).end();}
};
