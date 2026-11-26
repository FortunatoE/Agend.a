const {database,session,body,allowed,unauth,forbidden}=require('./_core');
const {computeItems,validateConfig}=require('../lib/work-calculations');
const {ensureAutomations}=require('../lib/work-automation-db');
const {normalizeRule}=require('../lib/work-automation-rules');
const {ensureWorkflows}=require('../lib/work-workflow-db');
const {normalizeWorkflow}=require('../lib/work-workflow-rules');
const {ensureForms}=require('../lib/work-form-db');
const {normalizeForm,validateResponse}=require('../lib/work-form-rules');
const {ensureGovernance,getBoardRole,roleNumber}=require('../lib/work-governance-db');
const {canBoard,redactRestrictedFields}=require('../lib/work-access');
const {ensureExchange,insertBatch}=require('../lib/work-exchange-db');
const exchange=require('../dist/exchange-core');
const {ensureApiKeys,manageKeys,externalApi}=require('../lib/work-api-db');
const {ensureSync,ensureEvents}=require('../lib/work-sync-db');
const {templates,normalizeBulk,bulkWrite,createTemplate}=require('../lib/work-board-ops');
const {decodeWorkbook,encodeWorkbook}=require('../lib/work-xlsx');
const {ensureWebhooks,processWebhook,manageWebhooks}=require('../lib/work-webhook-db');
const {ensureBoardManagement,manageBoard}=require('../lib/work-board-management');
const {workerAuthorized}=require('../lib/work-webhook-rules');
const types=new Set(['text','number','date','checkbox','status','relation','lookup','rollup','formula']);
const clean=(v,n=120)=>typeof v==='string'?v.trim().slice(0,n):'';
const id=v=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null;
module.exports=async(req,res)=>{
 try{
 res.setHeader('Cache-Control','no-store');
 if(req.query?.worker==='webhooks'){
 if(req.method!=='POST')return res.status(405).end();
 if(!workerAuthorized(req))return res.status(401).json({error:'Credencial inválida.'});
 return res.status(200).json(await processWebhook(database()));
 }
 if(req.headers.authorization!==undefined)return await externalApi(database(),req,res,body);
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
 await ensureGovernance(sql);
 await ensureAutomations(sql);
 await ensureWorkflows(sql);
 await ensureForms(sql);
 await ensureExchange(sql);
 await ensureApiKeys(sql);
 await ensureSync(sql);
 await ensureEvents(sql);
 await ensureWebhooks(sql);
 await ensureBoardManagement(sql);
 if(req.method==='GET'){
 let [workspaces,boards,fields,items,groups]=await Promise.all(['workspaces','work_boards','work_fields','work_items','work_groups'].map(t=>sql.query('SELECT * FROM '+t+(t==='workspaces'?' WHERE $1::int IS NOT NULL':t==='work_boards'?' WHERE work_board_role($1,id)>0':' WHERE work_board_role($1,board_id)>0')+' ORDER BY id',[user.id])));
 const [automations,automationRuns]=user.is_admin?await Promise.all([sql.query('SELECT * FROM work_automations ORDER BY id'),sql.query('SELECT * FROM work_automation_runs ORDER BY id DESC LIMIT 200')]):[[],[]];
 const [workflows,workflowRuns]=user.is_admin?await Promise.all([sql.query('SELECT * FROM work_workflows ORDER BY id'),sql.query('SELECT * FROM work_workflow_runs ORDER BY id DESC LIMIT 200')]):[[],[]];
 let forms=await sql.query(user.is_admin?'SELECT * FROM work_forms ORDER BY id':'SELECT id,board_id,name,description,fields,group_id,enabled FROM work_forms WHERE enabled ORDER BY id');
 const formSubmissions=user.is_admin?await sql.query('SELECT s.*,u.name AS submitted_by_name FROM work_form_submissions s LEFT JOIN app_users u ON u.id=s.submitted_by ORDER BY s.id DESC LIMIT 200'):[];
 const roles=await sql.query('SELECT id,work_board_role($1,id) AS role FROM work_boards',[user.id]);
 const permissions=Object.fromEntries(roles.filter(r=>r.role>0).map(r=>[r.id,roleNumber[r.role]]));
 const visible=new Set(roles.filter(r=>r.role>0).map(r=>r.id));
 boards=boards.filter(b=>visible.has(b.id));workspaces=workspaces.filter(w=>user.is_admin||boards.some(b=>b.workspace_id===w.id));
 fields=fields.filter(f=>visible.has(f.board_id));items=items.filter(i=>visible.has(i.board_id));groups=groups.filter(g=>visible.has(g.board_id));forms=forms.filter(f=>visible.has(f.board_id));
 const safe=redactRestrictedFields(fields,computeItems(items,fields),visible);
 const [workspaceMembers,boardMembers,audit]=user.is_admin?await Promise.all([sql.query('SELECT * FROM work_workspace_members'),sql.query('SELECT * FROM work_board_members'),sql.query('SELECT a.*,u.name AS actor_name FROM work_audit a LEFT JOIN app_users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 200')]):[[],[],[]];
 const archivedBoards=user.is_admin?await sql.query('SELECT id,workspace_id,name,description,archived_at FROM work_boards WHERE archived_at IS NOT NULL ORDER BY name,id'):[];
 return res.status(200).json({workspaces,boards,archivedBoards,fields:safe.fields,items:safe.items,groups,permissions,workspaceMembers,boardMembers,audit,automations,automationRuns,workflows,workflowRuns,forms,formSubmissions});
 }
 const d=body(req);const action=d.action;
 const permitted=async(bid,verb)=>canBoard(user,await getBoardRole(sql,user,bid),verb);
 if(action==='board_manage')return manageBoard(sql,user,d,req.method,res);
 if(action==='workspace_manage'){
 if(!user.is_admin)return forbidden(res);
 const target=id(d.id);if(!target)return res.status(400).json({error:'Identificação inválida.'});
 const workspace=action==='workspace_manage',table=workspace?'workspaces':'work_boards';
 if(req.method==='PATCH'){
 const name=clean(d.name);if(!name)return res.status(400).json({error:'Informe o nome.'});
 try{const rows=await sql.query('UPDATE '+table+' SET name=$1 WHERE id=$2 RETURNING id,name',[name,target]);return rows.length?res.status(200).json(rows[0]):res.status(404).json({error:'Não encontrado.'})}catch(e){if(e.code==='23505')return res.status(409).json({error:'Já existe um ambiente com esse nome.'});throw e}
 }
 if(req.method==='DELETE'){
 if(d.confirm!==true)return res.status(400).json({error:'Confirme a exclusão.'});
 if(!workspace)return res.status(405).json({error:'Exclusão de quadros ainda não disponível; preserve os dados.'});
 try{const rows=await sql.query('DELETE FROM workspaces w WHERE w.id=$1 AND NOT EXISTS(SELECT 1 FROM work_boards b WHERE b.workspace_id=w.id) RETURNING id',[target]);return rows.length?res.status(200).json({ok:true}):res.status(409).json({error:'Workspace inexistente ou com quadros. A exclusão está bloqueada para preservar os dados.'})}catch(e){if(e.code==='23503')return res.status(409).json({error:'Workspace possui dependências.'});throw e}
 }
 return res.status(405).end();
 }
 if(action==='bulk'){
 if(req.method!=='PATCH')return res.status(405).end();
 const bid=id(d.board_id);let config;try{config=normalizeBulk(d)}catch(e){return res.status(400).json({error:e.message})}
 if(!bid||!await permitted(bid,config.mode==='delete'?'delete':'edit'))return forbidden(res);
 const count=await bulkWrite(sql,user.id,bid,config);
 return count===config.ids.length?res.status(200).json({count}):res.status(409).json({error:'Seleção inválida ou alterada; nenhum registro foi modificado.'});
 }
 if(action==='template'){
 if(req.method!=='POST')return res.status(405).end();
 if(!user.is_admin)return forbidden(res);
 const workspace=id(d.workspace_id),name=clean(d.name);
 if(!workspace||!name||!Object.hasOwn(templates,d.template)||!(await sql.query('SELECT id FROM workspaces WHERE id=$1',[workspace])).length)return res.status(400).json({error:'Ambiente, nome ou modelo inválido.'});
 return res.status(201).json(await createTemplate(sql,workspace,name,d.template));
 }
 if(action==='webhooks')return await manageWebhooks(sql,user,d,req.method,res);
 if(action==='api_keys')return await manageKeys(sql,user,d,req.method,res);
 if(action==='exchange'){
 if(req.method!=='POST')return res.status(405).end();
 const bid=id(d.board_id);
 if(!bid||!await permitted(bid,'read'))return forbidden(res);
 if(d.mode==='history'){
 const rows=await sql.query('SELECT r.id,r.row_count,r.created_at,u.name AS actor FROM work_import_runs r LEFT JOIN app_users u ON u.id=r.user_id WHERE r.board_id=$1 AND work_board_role($2,$1)>0 AND ($3::boolean OR r.user_id=$2) ORDER BY r.id DESC LIMIT 50',[bid,user.id,Boolean(user.is_admin)]);
 return res.status(200).json({runs:rows});
 }
 if(d.mode==='export'){
 const fields=await sql.query('SELECT f.* FROM work_fields f WHERE work_board_role($1,f.board_id)>0 ORDER BY f.id',[user.id]);
 const visibleRows=await sql.query('SELECT id FROM work_boards WHERE work_board_role($1,id)>0',[user.id]);
 const visible=new Set(visibleRows.map(b=>b.id));if(!visible.has(bid))return forbidden(res);
 const items=await sql.query('SELECT i.* FROM work_items i WHERE work_board_role($1,i.board_id)>0 ORDER BY i.id',[user.id]);
 const safe=redactRestrictedFields(fields,computeItems(items,fields),visible);
 const selected=safe.fields.filter(f=>f.board_id===bid&&!f.config?.restricted);
 const currentItems=safe.items.filter(i=>i.board_id===bid);
 if(currentItems.length>10000)return res.status(400).json({error:'Exportação limitada a 10 mil registros.'});
 const groups=await sql.query('SELECT id,name FROM work_groups WHERE board_id=$1 AND work_board_role($2,board_id)>0',[bid,user.id]);
 const titles=new Map(safe.items.map(i=>[i.id,i.title])),groupNames=new Map(groups.map(g=>[g.id,g.name]));
 const headers=['Título','Grupo',...selected.map(f=>f.name)],rows=currentItems.map(i=>[i.title,groupNames.get(i.group_id)||'',...selected.map(f=>f.type==='relation'?(i.values?.[f.id]||[]).map(k=>titles.get(k)).filter(Boolean):i.values?.[f.id])]);
 if(d.format==='xlsx'){
 if(currentItems.length>5000||headers.length>102)return res.status(400).json({error:'XLSX limitado a 5 mil registros e 100 campos.'});
 try{const xlsx=await encodeWorkbook(headers,rows,selected.map((f,i)=>f.type==='date'?i+2:-1).filter(i=>i>=0));return res.status(200).json({xlsx,count:currentItems.length})}catch(e){return res.status(400).json({error:e.message})}
 }
 const csv=exchange.encodeCSV(headers,rows);
 if(Buffer.byteLength(csv,'utf8')>3500000)return res.status(400).json({error:'Exportação excede o tamanho permitido.'});
 return res.status(200).json({csv,count:currentItems.length});
 }
 if(d.mode==='decode_xlsx'){
 if(!await permitted(bid,'create'))return forbidden(res);
 try{return res.status(200).json({csv:await decodeWorkbook(d.xlsx)})}catch(e){return res.status(400).json({error:e.message})}
 }
 if(!['preview','import'].includes(d.mode))return res.status(400).json({error:'Modo inválido.'});
 if(!await permitted(bid,'create'))return forbidden(res);
 const fields=await sql.query('SELECT * FROM work_fields WHERE board_id=$1',[bid]);
 let prepared;try{prepared=exchange.prepare(d.csv,d.delimiter,d.mapping,fields)}catch(e){return res.status(400).json({error:e.message})}
 if(d.mode==='preview')return res.status(200).json({count:prepared.records.length,preview:prepared.records.slice(0,10),errors:prepared.errors.slice(0,100),errorCount:prepared.errors.length});
 if(prepared.errors.length||!prepared.records.length)return res.status(400).json({error:'Corrija os erros e inclua pelo menos um registro.'});
 if(typeof d.request_id!=='string'||!(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(d.request_id)))return res.status(400).json({error:'Identificação de importação inválida.'});
 const group=d.group_id==null?null:id(d.group_id);
 if(d.group_id!=null&&(!group||!(await sql.query('SELECT id FROM work_groups WHERE id=$1 AND board_id=$2',[group,bid])).length))return res.status(400).json({error:'Grupo inválido.'});
 const args=[bid,user.id,d.request_id,prepared.records.length,JSON.stringify(prepared.records),group];
 const result=await insertBatch(sql,args);
 if(result.length)return res.status(201).json(result[0]);
 if(!await permitted(bid,'create'))return forbidden(res);
 const old=await sql.query('SELECT id,row_count FROM work_import_runs WHERE board_id=$1 AND user_id=$2 AND request_id=$3::uuid AND work_board_role($2,$1)>=2',args.slice(0,3));
 return old.length?res.status(200).json({...old[0],replayed:true}):res.status(409).json({error:'Importação não concluída.'});
 }
 if(action==='access'){
 if(!user.is_admin)return forbidden(res);
 if(req.method!=='PATCH')return res.status(405).end();
 const scope=d.scope, sid=id(d.scope_id);
 if(!['workspace','board'].includes(scope)||!sid)return res.status(400).json({error:'Escopo inválido.'});
 const table=scope==='workspace'?'workspaces':'work_boards',memberTable=scope==='workspace'?'work_workspace_members':'work_board_members',col=scope+'_id';
 const exists=await sql.query('SELECT id FROM '+table+' WHERE id=$1',[sid]);
 if(!exists.length)return res.status(404).json({error:'Escopo não encontrado.'});
 if(typeof d.restricted==='boolean'){
 await sql.query('WITH changed AS (UPDATE '+table+' SET restricted=$2 WHERE id=$1 RETURNING id) INSERT INTO work_audit('+col+',actor_id,event,detail) SELECT id,$3,\'visibility_changed\',jsonb_build_object(\'restricted\',$2::boolean) FROM changed',[sid,d.restricted,user.id]);
 }else{
 const uid=id(d.user_id);if(!uid||!['none','viewer','editor','manager'].includes(d.role)||!(await sql.query('SELECT id FROM app_users WHERE id=$1 AND active',[uid])).length)return res.status(400).json({error:'Usuário ou perfil inválido.'});
 if(d.role==='none')await sql.query('WITH changed AS (DELETE FROM '+memberTable+' WHERE '+col+'=$1 AND user_id=$2 RETURNING '+col+') INSERT INTO work_audit('+col+',actor_id,event,detail) SELECT '+col+',$3,\'membership_removed\',jsonb_build_object(\'user_id\',$2::int) FROM changed',[sid,uid,user.id]);
 else await sql.query('WITH changed AS (INSERT INTO '+memberTable+'('+col+',user_id,role) VALUES($1,$2,$3) ON CONFLICT('+col+',user_id) DO UPDATE SET role=EXCLUDED.role RETURNING '+col+') INSERT INTO work_audit('+col+',actor_id,event,detail) SELECT '+col+',$4,\'membership_changed\',jsonb_build_object(\'user_id\',$2::int,\'role\',$3::text) FROM changed',[sid,uid,d.role,user.id]);
 }
 return res.status(200).json({ok:true});
 }
 if(action==='comments'){
 const item=(await sql.query('SELECT id,board_id FROM work_items WHERE id=$1',[id(d.item_id)]))[0];
 if(!item||!await permitted(item.board_id,'read'))return res.status(404).json({error:'Registro não encontrado.'});
 if(req.method==='POST'){
 if(d.mode==='list')return res.status(200).json(await sql.query('SELECT c.*,u.name AS author FROM work_comments c LEFT JOIN app_users u ON u.id=c.user_id WHERE item_id=$1 AND work_board_role($2,$3)>0 ORDER BY c.id DESC LIMIT 100',[item.id,user.id,item.board_id]));
 const message=typeof d.message==='string'?d.message.trim():'';
 if(!message||message.length>2000)return res.status(400).json({error:'Informe um comentário de até 2000 caracteres.'});
 const mention=d.mention_id==null?null:id(d.mention_id);
 if(d.mention_id!=null&&(!mention||!(await sql.query('SELECT work_board_role($1,$2)>0 AS ok',[mention,item.board_id]))[0]?.ok))return res.status(400).json({error:'Destinatário sem acesso ao quadro.'});
 const result=await sql.query(`WITH added AS (INSERT INTO work_comments(item_id,user_id,message) SELECT $1,$2,$3 WHERE work_board_role($2,$4)>0 RETURNING id),
 logged AS (INSERT INTO work_audit(board_id,item_id,actor_id,event) SELECT $4,$1,$2,'comment_created' FROM added),
 notified AS (INSERT INTO notifications(user_id,task_id,type,title,message) SELECT $5,NULL,'work_mention','Nova menção','Você recebeu uma menção em um comentário. Consulte seus quadros.' FROM added WHERE $5::int IS NOT NULL AND $5<>$2 AND work_board_role($5,$4)>0)
 SELECT id FROM added`,[item.id,user.id,message,item.board_id,mention]);
 return result.length?res.status(201).json(result[0]):forbidden(res);
 }
 return res.status(405).end();
 }
 if(action==='form_submit'){
 if(req.method!=='POST')return res.status(405).end();
 if(!allowed(user,'create'))return forbidden(res);
 if(!id(d.form_id)||typeof d.request_id!=='string'||!(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(d.request_id)))return res.status(400).json({error:'Identificação de envio inválida.'});
 const params=[id(d.form_id),user.id,d.request_id];
 const previous=()=>sql.query('SELECT id,item_id FROM work_form_submissions WHERE form_id=$1 AND submitted_by=$2 AND request_id=$3::uuid',params);
 const form=(await sql.query('SELECT * FROM work_forms WHERE id=$1 AND enabled',[params[0]]))[0];
 if(!form||!await permitted(form.board_id,'create'))return res.status(404).json({error:'Formulário indisponível.'});
 const existing=await previous();if(existing.length)return res.status(200).json(existing[0]);
 const fields=await sql.query('SELECT * FROM work_fields WHERE board_id=$1',[form.board_id]);
 let response;try{response=validateResponse(form,d,fields)}catch(e){return res.status(400).json({error:e.message})}
 try{
 const result=await sql.query(`WITH actor AS MATERIALIZED (SELECT set_config('agenda.actor_id',$2::int::text,true)), live_form AS (SELECT f.id,f.board_id,f.group_id FROM work_forms f CROSS JOIN actor WHERE f.id=$1 AND f.enabled AND work_board_role($2,f.board_id)>=2 FOR SHARE OF f),
 new_item AS (INSERT INTO work_items(board_id,group_id,title,values) SELECT board_id,group_id,$4,$5::jsonb FROM live_form RETURNING id,board_id)
 INSERT INTO work_form_submissions(form_id,board_id,item_id,submitted_by,request_id,title,answers)
 SELECT $1,board_id,id,$2,$3::uuid,$4,$5::jsonb FROM new_item RETURNING id,item_id`,[...params,response.title,JSON.stringify(response.values)]);
 return result.length?res.status(201).json(result[0]):res.status(409).json({error:'Formulário pausado.'});
 }catch(e){if(e.code==='23505'){const existing=await previous();if(existing.length)return res.status(200).json(existing[0])}throw e}
 }
 if(action==='form'){
 if(!user.is_admin)return forbidden(res);
 if(req.method==='POST'){
 const board=id(d.board_id);
 if(!board||!(await sql.query('SELECT id FROM work_boards WHERE id=$1 AND archived_at IS NULL',[board])).length)return res.status(400).json({error:'Quadro inválido.'});
 const [fields,groups]=await Promise.all([sql.query('SELECT * FROM work_fields WHERE board_id=$1',[board]),sql.query('SELECT id,board_id FROM work_groups WHERE board_id=$1',[board])]);
 let form;try{form=normalizeForm(d,board,fields,groups)}catch(e){return res.status(400).json({error:e.message})}
 const result=await sql.query('INSERT INTO work_forms(board_id,name,description,fields,group_id,created_by) VALUES($1,$2,$3,$4::jsonb,$5,$6) RETURNING *',[board,form.name,form.description,JSON.stringify(form.fields),form.group_id,user.id]);
 return res.status(201).json(result[0]);
 }
 if(req.method==='PATCH'){
 if(!id(d.id)||typeof d.enabled!=='boolean')return res.status(400).json({error:'Formulário ou estado inválido.'});
 const result=await sql.query('UPDATE work_forms SET enabled=$1 WHERE id=$2 RETURNING *',[d.enabled,id(d.id)]);
 return result.length?res.status(200).json(result[0]):res.status(404).json({error:'Formulário não encontrado.'});
 }
 return res.status(405).end();
 }
 if(action==='workflow'){
 if(!user.is_admin)return forbidden(res);
 if(req.method==='POST'){
 const board=id(d.board_id);
 if(!board||!(await sql.query('SELECT id FROM work_boards WHERE id=$1',[board])).length)return res.status(400).json({error:'Quadro inválido.'});
 const [fields,groups,users]=await Promise.all([sql.query('SELECT id,board_id,type FROM work_fields WHERE board_id=$1',[board]),sql.query('SELECT id,board_id FROM work_groups WHERE board_id=$1',[board]),sql.query('SELECT id FROM app_users WHERE active')]);
 let flow;try{flow=normalizeWorkflow(d,board,fields,groups,users)}catch(e){return res.status(400).json({error:e.message})}
 const result=await sql.query('INSERT INTO work_workflows(board_id,name,trigger_config,steps,created_by) VALUES($1,$2,$3::jsonb,$4::jsonb,$5) RETURNING *',[board,flow.name,JSON.stringify(flow.trigger),JSON.stringify(flow.steps),user.id]);
 return res.status(201).json(result[0]);
 }
 if(req.method==='PATCH'){
 if(!id(d.id)||typeof d.enabled!=='boolean')return res.status(400).json({error:'Fluxo ou estado inválido.'});
 const result=await sql.query('UPDATE work_workflows SET enabled=$1 WHERE id=$2 RETURNING *',[d.enabled,id(d.id)]);
 return result.length?res.status(200).json(result[0]):res.status(404).json({error:'Fluxo não encontrado.'});
 }
 if(req.method==='DELETE'){
 if(!id(d.id))return res.status(400).json({error:'Fluxo inválido.'});
 await sql.query('DELETE FROM work_workflows WHERE id=$1',[id(d.id)]);return res.status(200).json({ok:true});
 }
 return res.status(405).end();
 }
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
 const [boards,fields]=await Promise.all([sql.query('SELECT id FROM work_boards WHERE archived_at IS NULL'),sql.query('SELECT * FROM work_fields')]);
 if(!boards.some(b=>b.id===boardId))return res.status(400).json({error:'Quadro não encontrado.'});
 let config;try{config=validateConfig(d.type,d.config,boardId,boards,fields)}catch(e){return res.status(400).json({error:e.message})}
 rows=await sql.query('INSERT INTO work_fields(board_id,name,type,config) VALUES($1,$2,$3,$4::jsonb) RETURNING *',[boardId,name,d.type,JSON.stringify(config)]);
 }
 else if(action==='group'){if(!user.is_admin)return forbidden(res);rows=await sql.query('INSERT INTO work_groups(board_id,name) VALUES($1,$2) RETURNING *',[id(d.board_id),name]);}
 else if(action==='item'){
 if(!await permitted(id(d.board_id),'create'))return forbidden(res);
 rows=await sql.query("WITH actor AS MATERIALIZED (SELECT set_config('agenda.actor_id',$3::int::text,true)) INSERT INTO work_items(board_id,title) SELECT $1,$2 FROM actor WHERE work_board_role($3,$1)>=2 RETURNING id",[id(d.board_id),name,user.id]);
 if(!rows.length)return forbidden(res);
 }
 else return res.status(400).json({error:'Ação inválida.'});
 return res.status(201).json(rows[0]);
 }
 if(req.method==='PATCH'){
 if(!allowed(user,'edit'))return forbidden(res);
 const item=(await sql.query('SELECT * FROM work_items WHERE id=$1',[id(d.id)]))[0];
 if(!item||!await permitted(item.board_id,'edit'))return res.status(404).json({error:'Registro não encontrado.'});
 if(action==='group_move'){
 const group=d.group_id===null?null:id(d.group_id);
 if(d.group_id!==null&&(!group||!(await sql.query('SELECT id FROM work_groups WHERE id=$1 AND board_id=$2',[group,item.board_id])).length))return res.status(400).json({error:'Grupo inválido para este quadro.'});
 const rows=await sql.query("WITH actor AS MATERIALIZED (SELECT set_config('agenda.actor_id',$3::int::text,true)) UPDATE work_items SET group_id=$1 FROM actor WHERE id=$2 AND work_board_role($3,board_id)>=2 RETURNING id",[group,item.id,user.id]);return rows.length?res.status(200).json(rows[0]):forbidden(res);
 }
 if(action==='rename'){const title=clean(d.name);if(!title)return res.status(400).json({error:'Informe um nome.'});const rows=await sql.query("WITH actor AS MATERIALIZED (SELECT set_config('agenda.actor_id',$3::int::text,true)) UPDATE work_items SET title=$1 FROM actor WHERE id=$2 AND work_board_role($3,board_id)>=2 RETURNING id",[title,item.id,user.id]);return rows.length?res.status(200).json(rows[0]):forbidden(res);}
 if(action!=='value')return res.status(400).json({error:'Ação inválida.'});
 const field=(await sql.query('SELECT * FROM work_fields WHERE id=$1 AND board_id=$2',[id(d.field_id),item.board_id]))[0];
 if(!field)return res.status(404).json({error:'Campo não encontrado.'});
 if(['lookup','rollup','formula'].includes(field.type))return res.status(400).json({error:'Este campo é calculado e não pode ser editado.'});
 let v=d.value,valid=v===null;
 if(field.type==='relation'&&!await permitted(field.config.target_board_id,'read'))return forbidden(res);
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
 const rows=await sql.query("WITH actor AS MATERIALIZED (SELECT set_config('agenda.actor_id',$4::int::text,true)) UPDATE work_items SET values=jsonb_set(values,ARRAY[$1::text],$2::jsonb,true) FROM actor WHERE id=$3 AND work_board_role($4,board_id)>=2 AND ($5::int IS NULL OR work_board_role($4,$5)>0) RETURNING id",[String(field.id),JSON.stringify(v),item.id,user.id,field.type==='relation'?field.config.target_board_id:null]);return rows.length?res.status(200).json(rows[0]):forbidden(res);
 }
 if(req.method==='DELETE'){
 if(!allowed(user,'delete'))return forbidden(res);
 if(action!=='item')return res.status(400).json({error:'Ação inválida.'});
 const rows=await sql.query("WITH actor AS MATERIALIZED (SELECT set_config('agenda.actor_id',$2::int::text,true)) DELETE FROM work_items USING actor WHERE id=$1 AND work_board_role($2,board_id)>=3 RETURNING id",[id(d.id),user.id]);return rows.length?res.status(200).json({ok:true}):forbidden(res);
 }
 res.setHeader('Allow','GET,POST,PATCH,DELETE');return res.status(405).end();
 }catch(e){console.error(e);return res.status(['23505','23503','23502'].includes(e.code)?400:500).json({error:'Não foi possível concluir a operação no quadro.'});}
};
