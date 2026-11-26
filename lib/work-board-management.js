'use strict';
async function ensureBoardManagement(sql){
 if((await sql.query("SELECT to_regprocedure('work_delete_unused_board(integer,text,integer)') IS NOT NULL AS ok"))[0]?.ok)return;
 await sql.query(`DO $migration$ BEGIN
 PERFORM pg_advisory_xact_lock(86124028);
 IF to_regprocedure('work_delete_unused_board(integer,text,integer)') IS NOT NULL THEN RETURN; END IF;
 ALTER TABLE work_boards ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
 ALTER TABLE work_boards ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
 EXECUTE $ddl$
 CREATE OR REPLACE FUNCTION work_board_role(uid INTEGER,bid INTEGER) RETURNS INTEGER LANGUAGE sql STABLE AS $fn$
 SELECT COALESCE((SELECT CASE WHEN u.is_admin THEN 3 ELSE LEAST(
 CASE wm.role WHEN 'viewer' THEN 1 WHEN 'editor' THEN 2 WHEN 'manager' THEN 3 ELSE CASE WHEN w.restricted THEN 0 ELSE 3 END END,
 CASE bm.role WHEN 'viewer' THEN 1 WHEN 'editor' THEN 2 WHEN 'manager' THEN 3 ELSE CASE WHEN b.restricted THEN 0 ELSE 3 END END) END
 FROM work_boards b JOIN workspaces w ON w.id=b.workspace_id CROSS JOIN app_users u
 LEFT JOIN work_workspace_members wm ON wm.workspace_id=w.id AND wm.user_id=u.id
 LEFT JOIN work_board_members bm ON bm.board_id=b.id AND bm.user_id=u.id
 WHERE b.id=bid AND u.id=uid AND u.active AND b.archived_at IS NULL),0)
 $fn$;
 $ddl$;
 EXECUTE $ddl$
 CREATE FUNCTION work_delete_unused_board(bid INTEGER,confirmation TEXT,actor INTEGER) RETURNS TEXT LANGUAGE plpgsql AS $fn$
 DECLARE b work_boards%ROWTYPE;
 BEGIN
 IF NOT EXISTS(SELECT 1 FROM app_users WHERE id=actor AND active AND is_admin) THEN RETURN 'forbidden'; END IF;
 -- Serialize with inserts of fields and foreign-key references to the board.
 LOCK TABLE work_fields IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO b FROM work_boards WHERE id=bid FOR UPDATE;
 IF NOT FOUND THEN RETURN 'missing'; END IF;
 IF confirmation IS DISTINCT FROM b.name THEN RETURN 'confirmation'; END IF;
 IF b.archived_at IS NULL THEN RETURN 'archive'; END IF;
 IF EXISTS(SELECT 1 FROM work_items WHERE board_id=bid)
 OR EXISTS(SELECT 1 FROM work_fields WHERE board_id<>bid AND config->>'target_board_id'=bid::text)
 OR EXISTS(SELECT 1 FROM work_automations WHERE board_id=bid)
 OR EXISTS(SELECT 1 FROM work_automation_runs WHERE board_id=bid)
 OR EXISTS(SELECT 1 FROM work_workflows WHERE board_id=bid)
 OR EXISTS(SELECT 1 FROM work_workflow_runs WHERE board_id=bid)
 OR EXISTS(SELECT 1 FROM work_forms WHERE board_id=bid)
 OR EXISTS(SELECT 1 FROM work_form_submissions WHERE board_id=bid)
 OR EXISTS(SELECT 1 FROM work_import_runs WHERE board_id=bid)
 OR EXISTS(SELECT 1 FROM work_api_keys WHERE board_id=bid)
 OR EXISTS(SELECT 1 FROM work_webhook_subscriptions WHERE board_id=bid)
 OR EXISTS(SELECT 1 FROM work_sync_events WHERE board_id=bid)
 OR EXISTS(SELECT 1 FROM work_audit WHERE board_id=bid AND event IN ('item_created','item_updated','item_deleted','comment_created'))
 THEN RETURN 'dependencies'; END IF;
 INSERT INTO work_audit(workspace_id,actor_id,event,detail) VALUES(b.workspace_id,actor,'board_deleted',jsonb_build_object('board_id',b.id,'name',b.name));
 DELETE FROM work_boards WHERE id=bid;
 RETURN 'ok';
 END;
 $fn$;
 $ddl$;
 END; $migration$`);
}
async function manageBoard(sql,user,d,method,res){
 if(!user.is_admin)return res.status(403).json({error:'Acesso administrativo necessário.'});
 const bid=Number(d.id);if(!Number.isSafeInteger(bid)||bid<=0)return res.status(400).json({error:'Quadro inválido.'});
 if(method==='PATCH'){
 if(d.mode==='archive'||d.mode==='restore'){
 const rows=await sql.query("WITH changed AS (UPDATE work_boards SET archived_at=CASE WHEN $2::boolean THEN COALESCE(archived_at,NOW()) ELSE NULL END WHERE id=$1 RETURNING *) , logged AS (INSERT INTO work_audit(board_id,workspace_id,actor_id,event,detail) SELECT id,workspace_id,$3,CASE WHEN $2 THEN 'board_archived' ELSE 'board_restored' END,'{}'::jsonb FROM changed) SELECT * FROM changed",[bid,d.mode==='archive',user.id]);
 return rows.length?res.status(200).json(rows[0]):res.status(404).json({error:'Quadro não encontrado.'});
 }
 const name=typeof d.name==='string'?d.name.trim():'',description=typeof d.description==='string'?d.description.trim():null;
 if(!name||name.length>120||description!==null&&description.length>2000)return res.status(400).json({error:'Nome ou descrição inválidos.'});
 const rows=await sql.query("WITH changed AS (UPDATE work_boards SET name=$2,description=COALESCE($3,description) WHERE id=$1 RETURNING *), logged AS (INSERT INTO work_audit(board_id,workspace_id,actor_id,event,detail) SELECT id,workspace_id,$4,'board_edited','{}'::jsonb FROM changed) SELECT * FROM changed",[bid,name,description,user.id]);
 return rows.length?res.status(200).json(rows[0]):res.status(404).json({error:'Quadro não encontrado.'});
 }
 if(method==='DELETE'){
 if(d.confirm!==true||typeof d.confirmation!=='string')return res.status(400).json({error:'Digite o nome do quadro para confirmar.'});
 const result=(await sql.query('SELECT work_delete_unused_board($1,$2,$3) AS result',[bid,d.confirmation,user.id]))[0]?.result;
 if(result==='ok')return res.status(200).json({ok:true});
 const errors={missing:[404,'Quadro não encontrado.'],forbidden:[403,'Acesso administrativo necessário.'],confirmation:[400,'O nome de confirmação não corresponde.'],archive:[409,'Arquive o quadro antes de excluir.'],dependencies:[409,'O quadro possui registros, histórico, integrações ou dependências. Mantenha-o arquivado para preservar os dados.']};
 const [code,message]=errors[result]||[409,'Exclusão bloqueada.'];return res.status(code).json({error:message});
 }
 return res.status(405).end();
}
module.exports={ensureBoardManagement,manageBoard};
