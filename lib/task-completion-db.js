'use strict';
async function ensureTaskCompletion(sql){
 if((await sql.query("SELECT to_regclass('public.tasks') IS NOT NULL AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='agenda_task_completion_v1' AND tgrelid='tasks'::regclass) AS ok"))[0]?.ok)return;
 await sql.query(`DO $migration$ BEGIN
 PERFORM pg_advisory_xact_lock(86124027);
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='agenda_task_completion_v1' AND tgrelid='tasks'::regclass) THEN RETURN; END IF;
 ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
 UPDATE tasks t SET completed_at=h.finished FROM (SELECT task_id,max(created_at) finished FROM task_activity WHERE detail='Alterou status para concluída' GROUP BY task_id) h WHERE t.id=h.task_id AND t.status='concluída' AND t.completed_at IS NULL;
 EXECUTE $ddl$
 CREATE OR REPLACE FUNCTION agenda_task_completion_v1() RETURNS trigger LANGUAGE plpgsql AS $fn$
 BEGIN
 IF NEW.status='concluída' AND OLD.status IS DISTINCT FROM NEW.status THEN NEW.completed_at=clock_timestamp();
 ELSIF NEW.status<>'concluída' THEN NEW.completed_at=NULL;
 ELSE NEW.completed_at=OLD.completed_at;
 END IF;
 RETURN NEW;
 END;
 $fn$;
 $ddl$;
 CREATE TRIGGER agenda_task_completion_v1 BEFORE UPDATE OF status ON tasks FOR EACH ROW EXECUTE FUNCTION agenda_task_completion_v1();
 END; $migration$`);
}
module.exports={ensureTaskCompletion};
