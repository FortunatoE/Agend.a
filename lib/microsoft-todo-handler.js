'use strict';
const {session,body,unauth}=require('../api/_core');
const C=require('./microsoft-todo-core'),D=require('./microsoft-todo-db');
function redirect(res,c,result){
 res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Location',c.origin+'/?ms_todo='+encodeURIComponent(result));return res.status(303).end();
}
async function handleMicrosoftTodo(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','no-referrer');
 const c=C.config(),action=req.query?.microsoft;
 try{
 const {sql,user}=await session(req);if(!user)return unauth(res);
 if(!c)return action==='status'&&req.method==='GET'?res.status(200).json({configured:false,connected:false}):res.status(503).json({error:'Integração Microsoft ainda não configurada.'});
 if(action==='callback'&&req.method==='GET'){await D.ensureMicrosoftTodo(sql);try{return redirect(res,c,await D.finishOAuth(sql,user,req,c))}catch{return redirect(res,c,'failed')}}
 if(action==='status'&&req.method==='GET'){await D.ensureMicrosoftTodo(sql);return res.status(200).json(await D.status(sql,user,c))}
 if(req.method!=='POST')return res.status(405).end();
 if(req.headers.origin!==c.origin||!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))return res.status(403).json({error:'Origem da solicitação inválida.'});
 await D.ensureMicrosoftTodo(sql);
 if(action==='connect')return res.status(200).json({url:await D.startOAuth(sql,user,req,c)});
 if(action==='sync'){
 const s=await D.status(sql,user,c);if(!s.connected)return res.status(409).json({error:'Conecte sua conta Microsoft primeiro.'});
 const result=await D.sync(sql,user,c);return res.status(result.busy?409:200).json(result.busy?{error:'Já existe uma sincronização em andamento.'}:result);
 }
 if(action==='disconnect'){
 const rows=await sql.query("UPDATE agenda_ms_connections SET refresh_cipher=NULL WHERE user_id=$1 AND (lease_until IS NULL OR lease_until<NOW()) RETURNING user_id",[user.id]);
 if(!rows.length)return res.status(409).json({error:'Conta não encontrada ou sincronização em andamento.'});
 await sql.query('DELETE FROM agenda_ms_oauth_state WHERE user_id=$1',[user.id]);return res.status(200).json({ok:true});
 }
 return res.status(404).json({error:'Ação inválida.'});
 }catch(e){console.error('Microsoft To Do:',e.code||e.kind||'integration-error');return res.status(500).json({error:'Não foi possível concluir a operação Microsoft To Do.'})}
}
module.exports={handleMicrosoftTodo};
