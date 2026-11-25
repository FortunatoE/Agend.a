const crypto = require('crypto');
const { body, database, session, digest, verifyPassword, publicUser, unauth } = require('./_core');
const cookie = (token, maxAge) => `agenda_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
module.exports = async (req,res) => {
  try {
    const current = await session(req); const sql = current.sql;
    if (req.method === 'GET') return res.status(200).json({user:publicUser(current.user)});
    const payload = body(req);
    if (payload.action === 'logout') { res.setHeader('Set-Cookie',cookie('',0)); return res.status(200).json({ok:true}); }
    if (payload.action !== 'login') return res.status(400).json({error:'Ação inválida.'});
    const rows = await sql.query('SELECT * FROM app_users WHERE username=$1 AND active=true', [String(payload.username || '').trim().toLowerCase()]);
    const user = rows[0]; if (!user || !verifyPassword(String(payload.password || ''),user)) return res.status(401).json({error:'Usuário ou senha inválidos.'});
    const token = crypto.randomBytes(32).toString('base64url'), expires = new Date(Date.now()+7*24*60*60*1000);
    await sql.query('DELETE FROM app_sessions WHERE expires_at<NOW() OR user_id=$1',[user.id]);
    await sql.query('INSERT INTO app_sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3)',[digest(token),user.id,expires]);
    res.setHeader('Set-Cookie',cookie(token,7*24*60*60)); return res.status(200).json({user:publicUser(user)});
  } catch (error) { console.error(error); return res.status(500).json({error:'Não foi possível processar o acesso.'}); }
};
