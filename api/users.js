const { body, database, session, allowed, forbidden, unauth, passwordHash, publicUser } = require('./_core');
module.exports = async (req,res) => {
  try {
    const {sql,user} = await session(req); if (!user) return unauth(res); if (!user.is_admin) return forbidden(res);
    if (req.method === 'GET') { const rows=await sql.query('SELECT id,username,name,is_admin,can_create,can_edit,can_delete,active,created_at FROM app_users ORDER BY is_admin DESC,name'); return res.status(200).json(rows); }
    const data=body(req);
    if (req.method === 'POST') {
      const {username,name,password,is_admin=false,can_create=true,can_edit=true,can_delete=false}=data;
      if(!username||!name||!password) return res.status(400).json({error:'Preencha nome, usuário e senha.'});
      const p=passwordHash(password); const rows=await sql.query('INSERT INTO app_users (username,name,password_salt,password_hash,is_admin,can_create,can_edit,can_delete) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,username,name,is_admin,can_create,can_edit,can_delete,active',[username.trim().toLowerCase(),name.trim(),p.salt,p.hash,is_admin,can_create,can_edit,can_delete]);
      return res.status(201).json(rows[0]);
    }
    if (req.method === 'PATCH') {
      if(!data.id) return res.status(400).json({error:'Usuário inválido.'});
      await sql.query('UPDATE app_users SET is_admin=$1,can_create=$2,can_edit=$3,can_delete=$4,active=$5 WHERE id=$6',[!!data.is_admin,!!data.can_create,!!data.can_edit,!!data.can_delete,data.active!==false,data.id]);
      return res.status(200).json({ok:true});
    }
    res.setHeader('Allow','GET,POST,PATCH'); return res.status(405).end();
  } catch(error){ console.error(error); return res.status(500).json({error:'Não foi possível atualizar os acessos.'}); }
};
