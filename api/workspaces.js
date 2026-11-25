const {session,body,allowed,unauth,forbidden}=require('./_core');
const types=new Set(['text','number','date','checkbox','status']);
const clean=(v,n=120)=>typeof v==='string'?v.trim().slice(0,n):'';
const id=v=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null;
module.exports=async(req,res)=>{
 try{
 const {sql,user}=await session(req);if(!user)return unauth(res);
 await sql.query("CREATE TABLE IF NOT EXISTS workspaces (id SERIAL PRIMARY KEY,name TEXT NOT NULL UNIQUE,created_at TIMESTAMPTZ DEFAULT NOW())");
 await sql.query("CREATE TABLE IF NOT EXISTS work_boards (id SERIAL PRIMARY KEY,workspace_id INTEGER NOT NULL REFERENCES workspaces(id),name TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT NOW())");
 await sql.query("CREATE TABLE IF NOT EXISTS work_fields (id SERIAL PRIMARY KEY,board_id INTEGER NOT NULL REFERENCES work_boards(id) ON DELETE CASCADE,name TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('text','number','date','checkbox','status')),UNIQUE(board_id,name))");
 await sql.query("CREATE TABLE IF NOT EXISTS work_items (id SERIAL PRIMARY KEY,board_id INTEGER NOT NULL REFERENCES work_boards(id) ON DELETE CASCADE,title TEXT NOT NULL,values JSONB NOT NULL DEFAULT '{}',created_at TIMESTAMPTZ DEFAULT NOW())");
 if(req.method==='GET'){
 const [workspaces,boards,fields,items]=await Promise.all(['workspaces','work_boards','work_fields','work_items'].map(t=>sql.query('SELECT * FROM '+t+' ORDER BY id')));
 return res.status(200).json({workspaces,boards,fields,items});
 }
 const d=body(req);const action=d.action;
 if(req.method==='POST'){
 if(!allowed(user,'create'))return forbidden(res);
 const name=clean(d.name);
 if(!name)return res.status(400).json({error:'Informe um nome.'});
 let rows;
 if(action==='workspace') {if(!user.is_admin)return forbidden(res);rows=await sql.query('INSERT INTO workspaces(name) VALUES($1) RETURNING *',[name]);}
 else if(action==='board') {if(!user.is_admin)return forbidden(res);rows=await sql.query('INSERT INTO work_boards(workspace_id,name) VALUES($1,$2) RETURNING *',[id(d.workspace_id),name]);}
 else if(action==='field'){if(!user.is_admin)return forbidden(res);if(!types.has(d.type))return res.status(400).json({error:'Tipo inválido.'});rows=await sql.query('INSERT INTO work_fields(board_id,name,type) VALUES($1,$2,$3) RETURNING *',[id(d.board_id),name,d.type]);}
 else if(action==='item')rows=await sql.query('INSERT INTO work_items(board_id,title) VALUES($1,$2) RETURNING *',[id(d.board_id),name]);
 else return res.status(400).json({error:'Ação inválida.'});
 return res.status(201).json(rows[0]);
 }
 if(req.method==='PATCH'){
 if(!allowed(user,'edit'))return forbidden(res);
 const item=(await sql.query('SELECT * FROM work_items WHERE id=$1',[id(d.id)]))[0];
 if(!item)return res.status(404).json({error:'Registro não encontrado.'});
 if(action==='rename'){const title=clean(d.name);if(!title)return res.status(400).json({error:'Informe um nome.'});return res.status(200).json((await sql.query('UPDATE work_items SET title=$1 WHERE id=$2 RETURNING *',[title,item.id]))[0]);}
 if(action!=='value')return res.status(400).json({error:'Ação inválida.'});
 const field=(await sql.query('SELECT * FROM work_fields WHERE id=$1 AND board_id=$2',[id(d.field_id),item.board_id]))[0];
 if(!field)return res.status(404).json({error:'Campo não encontrado.'});
 let v=d.value,valid=v===null;
 if(v!==null){
 if(field.type==='text'){valid=typeof v==='string'&&v.length<=2000;}
 if(field.type==='number')valid=typeof v==='number'&&Number.isFinite(v);
 if(field.type==='checkbox')valid=typeof v==='boolean';
 if(field.type==='status')valid=['A fazer','Em andamento','Concluído'].includes(v);
 if(field.type==='date')valid=typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 }
 if(!valid)return res.status(400).json({error:'Valor incompatível com o campo.'});
 return res.status(200).json((await sql.query("UPDATE work_items SET values=jsonb_set(values,ARRAY[$1::text],$2::jsonb,true) WHERE id=$3 RETURNING *",[String(field.id),JSON.stringify(v),item.id]))[0]);
 }
 if(req.method==='DELETE'){
 if(!allowed(user,'delete'))return forbidden(res);
 if(action!=='item')return res.status(400).json({error:'Ação inválida.'});
 await sql.query('DELETE FROM work_items WHERE id=$1',[id(d.id)]);return res.status(200).json({ok:true});
 }
 res.setHeader('Allow','GET,POST,PATCH,DELETE');return res.status(405).end();
 }catch(e){console.error(e);return res.status(['23505','23503','23502'].includes(e.code)?400:500).json({error:'Não foi possível concluir a operação no quadro.'});}
};
