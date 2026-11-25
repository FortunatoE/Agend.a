'use strict';
async function ensureGovernance(sql){
 const installed=await sql.query("SELECT to_regprocedure('work_board_role(integer,integer)') IS NOT NULL AS ok");
 if(installed[0]?.ok)return;
 await sql.query(`DO $migration$
 BEGIN
 PERFORM pg_advisory_xact_lock(86124017);
 IF to_regprocedure('work_board_role(integer,integer)') IS NOT NULL THEN RETURN; END IF;
 ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS restricted BOOLEAN NOT NULL DEFAULT FALSE;
 ALTER TABLE work_boards ADD COLUMN IF NOT EXISTS restricted BOOLEAN NOT NULL DEFAULT FALSE;
 CREATE TABLE IF NOT EXISTS work_workspace_members(
 workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('viewer','editor','manager')),PRIMARY KEY(workspace_id,user_id));
 CREATE TABLE IF NOT EXISTS work_board_members(
 board_id INTEGER NOT NULL REFERENCES work_boards(id) ON DELETE CASCADE,user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('viewer','editor','manager')),PRIMARY KEY(board_id,user_id));
 CREATE TABLE IF NOT EXISTS work_audit(
 id BIGSERIAL PRIMARY KEY,board_id INTEGER REFERENCES work_boards(id) ON DELETE SET NULL,
 workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL,item_id INTEGER,
 actor_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,event TEXT NOT NULL,detail JSONB NOT NULL DEFAULT '{}',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS work_comments(
 id BIGSERIAL PRIMARY KEY,item_id INTEGER NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
 user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,message TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE INDEX IF NOT EXISTS work_audit_board_idx ON work_audit(board_id,id DESC);
 CREATE INDEX IF NOT EXISTS work_comments_item_idx ON work_comments(item_id,id DESC);
 EXECUTE $ddl$
 CREATE FUNCTION work_board_role(uid INTEGER,bid INTEGER) RETURNS INTEGER LANGUAGE sql STABLE AS $fn$
 SELECT COALESCE((SELECT CASE WHEN u.is_admin THEN 3 ELSE LEAST(
 CASE wm.role WHEN 'viewer' THEN 1 WHEN 'editor' THEN 2 WHEN 'manager' THEN 3 ELSE CASE WHEN w.restricted THEN 0 ELSE 3 END END,
 CASE bm.role WHEN 'viewer' THEN 1 WHEN 'editor' THEN 2 WHEN 'manager' THEN 3 ELSE CASE WHEN b.restricted THEN 0 ELSE 3 END END) END
 FROM work_boards b JOIN workspaces w ON w.id=b.workspace_id CROSS JOIN app_users u
 LEFT JOIN work_workspace_members wm ON wm.workspace_id=w.id AND wm.user_id=u.id
 LEFT JOIN work_board_members bm ON bm.board_id=b.id AND bm.user_id=u.id
 WHERE b.id=bid AND u.id=uid AND u.active),0)
 $fn$;
 $ddl$;
 EXECUTE $ddl$
 CREATE FUNCTION work_audit_item_v1() RETURNS trigger LANGUAGE plpgsql AS $fn$
 DECLARE actor INTEGER;
 BEGIN
 actor:=NULLIF(current_setting('agenda.actor_id',true),'')::int;
 IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
 IF TG_OP='DELETE' THEN
 INSERT INTO work_audit(board_id,item_id,actor_id,event,detail) VALUES(OLD.board_id,OLD.id,actor,'item_deleted','{}');
 RETURN OLD;
 END IF;
 INSERT INTO work_audit(board_id,item_id,actor_id,event,detail) VALUES(NEW.board_id,NEW.id,actor,CASE WHEN TG_OP='INSERT' THEN 'item_created' ELSE 'item_updated' END,jsonb_build_object('automatic',pg_trigger_depth()>1));
 RETURN NEW;
 END;
 $fn$;
 $ddl$;
 UPDATE notifications SET title='Atualização de processo',message='Uma regra automática foi executada. Consulte os quadros aos quais você tem acesso.' WHERE type IN ('work_automation','work_workflow');
 CREATE TRIGGER work_audit_item_v1 AFTER INSERT OR UPDATE OR DELETE ON work_items FOR EACH ROW EXECUTE FUNCTION work_audit_item_v1();
 END;
 $migration$`);
}
const roleNumber={0:'none',1:'viewer',2:'editor',3:'manager'};
async function getBoardRole(sql,user,boardId){
 const rows=await sql.query('SELECT work_board_role($1,$2) AS role',[user.id,boardId]);
 return roleNumber[rows[0]?.role]||'none';
}
module.exports={ensureGovernance,getBoardRole,roleNumber};
