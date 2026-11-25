const {session,body,allowed,unauth,forbidden}=require('./_core');
const {computeItems,validateConfig}=require('../lib/work-calculations');
const {ensureAutomations}=require('../lib/work-automation-db');
const {normalizeRule}=require('../lib/work-automation-rules');
const types=new Set(['text','number','date','checkbox','status','relation','lookup','rollup','formula']);
const clean=(v,n=120)=>typeof v==='string'?v.trim().slice(0,n):'';
const id=v=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null;
module.exports=async(req,res)=>{
 try{
 const {sql,user}=await session(req);if(!user)return unauth(res);
 await sql.query("CREATE TABLE IF NOT EXISTS workspaces (id SERIAL PRIMARY KEY,name TEXT NOT NULL UNIQUE,created_at TIMESTAMPTZ DEFAULT NOW())");
 await sql.query("CREATE TABLE IF NOT EXISTS work_boards (id SERIAL PRIMARY KEY,workspace_id INTEGER NOT NULL REFERENCES workspaces(id),name TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT NOW())");
 await sql.query("CREATE TABLE IF NOT EXISTS work_fields (id SERIAL PRIMARY KEY,board_id INTEGER NOT NULL REFERENCES work_boards(id) ON DELETE CASCADE,name TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('text','number','date','checkbox','status')),UNIQUE(board_id,name))");
 await sql.query("CREATE TABLE IF NOT EXISTS work_items (id SERIAL PRIMARY KEY,board_id INTEGER NOT NULL REFERENCES work_boards(id) ON DELETE CASCADE,title TEXT NOT NULL,values JSONB NOT NULL DEFAULT '{}',created_at TIMESTAMPTZ DEFAULT NOW())");
 await sql.query("CREATE TABLE IF NOT EXISTS work_groups (id SERIAL PRIMARY KEY,board_id INTEGER NOT NULL REFERENCES work_boards(id) ON DELETE CASCADE,name TEXT NOT NULL,UNIQUE(board_id,name))");
 await sql.query("ALTER TABLE work_items ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES work_groups(id) ON DELETE SET NULL");
 await sql.query("CREATE INDEX IF NOT EXISTS work_items_board_idx ON work_items(board_id)");
 await sql.query("CREATE INDEX IF NOT EXISTS work_groups_board_idx ON work_groups(board_id)");
 await sql.query("ALTER TABLE work_fields ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'");
 await sql.query(`DO $migration$
 BEGIN
 PERFORM pg_advisory_xact_lock(86124013);
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='work_fields'::regclass AND conname='work_fields_type_v2_check') THEN
 ALTER TABLE work_fields DROP CONSTRAINT IF EXISTS work_fields_type_check;
 ALTER TABLE work_fields ADD CONSTRAINT work_fields_type_v2_check CHECK(type IN ('text','number','date','checkbox','status','relation','lookup','rollup','formula'));
 END IF;
 END;
 $migration$`);
 await ensureAutomations(sql);
 if(req.method==='GET'){
 const [workspaces,boards,fields,items,groups]=await Promise.all(['workspaces','work_boards','work_fields','work_items','work_groups'].map(t=>sql.query('SELECT * FROM '+t+' ORDER BY id')));
 const [automations,automationRuns]=user.is_admin?await Promise.all([sql.query('SELECT * FROM work_automations ORDER BY id'),sql.query('SELECT * FROM work_automation_runs ORDER BY id DESC LIMIT 200')]):[[],[]];
 return res.status(200).json({workspaces,boards,fields,items:computeItems(items,fields),groups,automations,automationRuns});
 }
 const d=body(req);const action=d.action;
 if(action==='automation'){
 if(!user.is_admin)return forbidden(res);
 if(req.method==='POST'){
 const board=id(d.board_id);
 if(!board||!(await sql.query('SELECT id FROM work_boards WHERE id=$1',[board])).length)return res.status(400).json({error:'Quadro inválido.'});
 const [fields,groups,users]=await Promise.all([sql.query('SELECT id,board_id,type FROM work_fields WHERE board_id=$1',[board]),sql.query('SELECT id,board_id FROM work_groups WHERE board_id=$1',[board]),sql.query('SELECT id FROM app_users WHERE active')]);
 let rule;try{rule=normalizeRule(d,board,fields,groups,users)}catch(e){return res.status(400).json({error:e.message})}
 const result=await sql.query('INSERT INTO work_automations(board_id,name,trigger_config,condition_config,effect_config,created_by) VALUES($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6) RETURNING *',[board,rule.name,JSON.stringify(rule.trigger),JSON.stringify(rule.condition),JSON.stringify(rule.effect),user.id]);
 return res.status(201).json(result[0]);
 }
 if(req.method==='PATCH'){
 if(!id(d.id)||typeof d.enabled!=='boolean')return res.status(400).json({error:'Automação ou estado inválido.'});
 const result=await sql.query('UPDATE work_automations SET enabled=$1 WHERE id=$2 RETURNING *',[d.enabled,id(d.id)]);
 return result.length?res.status(200).json(result[0]):res.status(404).json({error:'Automação não encontrada.'});
 }
 if(req.method==='DELETE'){
 if(!id(d.id))return res.status(400).json({error:'Automação inválida.'});
 await sql.query('DELETE FROM work_automations WHERE id=$1',[id(d.id)]);return res.status(200).json({ok:true});
 }
 return res.status(405).end();
 }
 if(req.method==='POST'){
 if(!allowed(user,'create'))return forbidden(res);
 const name=clean(d.name);
 if(!name)return res.status(400).json({error:'Informe um nome.'});
 let rows;
 if(action==='workspace') {if(!user.is_admin)return forbidden(res);rows=await sql.query('INSERT INTO workspaces(name) VALUES($1) RETURNING *',[name]);}
 else if(action==='board') {if(!user.is_admin)return forbidden(res);rows=await sql.query('INSERT INTO work_boards(workspace_id,name) VALUES($1,$2) RETURNING *',[id(d.workspace_id),name]);}
 else if(action==='field'){
 if(!user.is_admin)return forbidden(res);
 const boardId=id(d.board_id);if(!boardId||!types.has(d.type))return res.status(400).json({error:'Quadro ou tipo inválido.'});
 const [boards,fields]=await Promise.all([sql.query('SELECT id FROM work_boards'),sql.query('SELECT * FROM work_fields')]);
 if(!boards.some(b=>b.id===boardId))return res.status(400).json({error:'Quadro não encontrado.'});
 let config;try{config=validateConfig(d.type,d.config,boardId,boards,fields)}catch(e){return res.status(400).json({error:e.message})}
 rows=await sql.query('INSERT INTO work_fields(board_id,name,type,config) VALUES($1,$2,$3,$4::jsonb) RETURNING *',[boardId,name,d.type,JSON.stringify(config)]);
 }
 else if(action==='group'){if(!user.is_admin)return forbidden(res);rows=await sql.query('INSERT INTO work_groups(board_id,name) VALUES($1,$2) RETURNING *',[id(d.board_id),name]);}
 else if(action==='item')rows=await sql.query('INSERT INTO work_items(board_id,title) VALUES($1,$2) RETURNING *',[id(d.board_id),name]);
 else return res.status(400).json({error:'Ação inválida.'});
 return res.status(201).json(rows[0]);
 }
 if(req.method==='PATCH'){
 if(!allowed(user,'edit'))return forbidden(res);
 const item=(await sql.query('SELECT * FROM work_items WHERE id=$1',[id(d.id)]))[0];
 if(!item)return res.status(404).json({error:'Registro não encontrado.'});
 if(action==='group_move'){
 const group=d.group_id===null?null:id(d.group_id);
 if(d.group_id!==null&&(!group||!(await sql.query('SELECT id FROM work_groups WHERE id=$1 AND board_id=$2',[group,item.board_id])).length))return res.status(400).json({error:'Grupo inválido para este quadro.'});
 return res.status(200).json((await sql.query('UPDATE work_items SET group_id=$1 WHERE id=$2 RETURNING *',[group,item.id]))[0]);
 }
 if(action==='rename'){const title=clean(d.name);if(!title)return res.status(400).json({error:'Informe um nome.'});return res.status(200).json((await sql.query('UPDATE work_items SET title=$1 WHERE id=$2 RETURNING *',[title,item.id]))[0]);}
 if(action!=='value')return res.status(400).json({error:'Ação inválida.'});
 const field=(await sql.query('SELECT * FROM work_fields WHERE id=$1 AND board_id=$2',[id(d.field_id),item.board_id]))[0];
 if(!field)return res.status(404).json({error:'Campo não encontrado.'});
 if(['lookup','rollup','formula'].includes(field.type))return res.status(400).json({error:'Este campo é calculado e não pode ser editado.'});
 let v=d.value,valid=v===null;
 if(field.type==='relation'&&v!==null){
 if(!Array.isArray(v)||v.length>200||!v.every(n=>Number.isSafeInteger(n)&&n>0))return res.status(400).json({error:'Selecione até 200 registros válidos.'});
 v=[...new Set(v)];
 const targets=await sql.query('SELECT id FROM work_items WHERE board_id=$1 AND id=ANY($2::int[])',[field.config.target_board_id,v]);
 valid=targets.length===v.length;
 }
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
