const { session, unauth } = require('./_core');

module.exports = async (req,res) => {
  try {
    const {sql,user}=await session(req); if(!user) return unauth(res);
    if(req.method!=='GET') { res.setHeader('Allow','GET'); return res.status(405).end(); }
    return res.status(200).json(await sql.query('SELECT id,name,is_admin FROM app_users WHERE active=true ORDER BY name'));
  } catch(error) { console.error(error); return res.status(500).json({error:'Não foi possível carregar a equipe.'}); }
};
