// Install once, under a transaction-scoped migration lock.
async function ensureAutomations(sql){
 const installed=await sql.query("SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='work_items'::regclass AND tgname='work_automation_v1') AS ok");
 if(installed[0]?.ok)return;
 await sql.query(`DO $migration$
 BEGIN
 PERFORM pg_advisory_xact_lock(86124014);
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='work_items'::regclass AND tgname='work_automation_v1') THEN RETURN; END IF;
 CREATE TABLE IF NOT EXISTS work_automations (
 id SERIAL PRIMARY KEY, board_id INTEGER NOT NULL REFERENCES work_boards(id) ON DELETE CASCADE,
 name TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE, trigger_config JSONB NOT NULL,
 condition_config JSONB NOT NULL, effect_config JSONB NOT NULL, created_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS work_automation_runs (
 id BIGSERIAL PRIMARY KEY, rule_id INTEGER REFERENCES work_automations(id) ON DELETE SET NULL,
 board_id INTEGER NOT NULL REFERENCES work_boards(id) ON DELETE CASCADE,
 item_id INTEGER REFERENCES work_items(id) ON DELETE SET NULL, rule_name TEXT NOT NULL,
 result TEXT NOT NULL CHECK(result IN ('success','failed')), detail TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE INDEX IF NOT EXISTS work_automations_board_idx ON work_automations(board_id) WHERE enabled;
 CREATE INDEX IF NOT EXISTS work_automation_runs_board_idx ON work_automation_runs(board_id,id DESC);
 EXECUTE $ddl$
 CREATE OR REPLACE FUNCTION work_execute_automation_v1() RETURNS trigger LANGUAGE plpgsql AS $fn$
 DECLARE rule work_automations%ROWTYPE; effect JSONB; k TEXT; outcome TEXT;
 BEGIN
 -- Automatic changes do not recursively trigger other automations.
 IF pg_trigger_depth()>1 THEN RETURN NEW; END IF;
 FOR rule IN SELECT * FROM work_automations WHERE board_id=NEW.board_id AND enabled ORDER BY id LOOP
 IF rule.trigger_config->>'type'='created' THEN
   IF TG_OP<>'INSERT' THEN CONTINUE; END IF;
 ELSIF rule.trigger_config->>'type'='field_changed' THEN
   IF TG_OP<>'UPDATE' THEN CONTINUE; END IF;
   k:=rule.trigger_config->>'field_id';
   IF COALESCE(OLD.values->k,'null'::jsonb) IS NOT DISTINCT FROM COALESCE(NEW.values->k,'null'::jsonb) THEN CONTINUE; END IF;
 ELSE CONTINUE;
 END IF;
 IF rule.condition_config->>'type'='status_equals' THEN
   IF (NEW.values->>(rule.condition_config->>'field_id')) IS DISTINCT FROM (rule.condition_config->>'value') THEN CONTINUE; END IF;
 ELSIF rule.condition_config->>'type'<>'always' THEN CONTINUE;
 END IF;
 effect:=rule.effect_config;
 BEGIN
 CASE effect->>'type'
 WHEN 'set_status' THEN
   k:=effect->>'field_id';
   IF NOT EXISTS(SELECT 1 FROM work_fields WHERE id=k::int AND board_id=NEW.board_id AND type='status') THEN RAISE EXCEPTION 'Campo inválido'; END IF;
   UPDATE work_items SET values=jsonb_set(values,ARRAY[k],effect->'value',true) WHERE id=NEW.id;
   outcome:='Status atualizado';
 WHEN 'move_group' THEN
   IF NOT EXISTS(SELECT 1 FROM work_groups WHERE id=(effect->>'group_id')::int AND board_id=NEW.board_id) THEN RAISE EXCEPTION 'Grupo inválido'; END IF;
   UPDATE work_items SET group_id=(effect->>'group_id')::int WHERE id=NEW.id;
   outcome:='Registro movido';
 WHEN 'create_item' THEN
   INSERT INTO work_items(board_id,title) VALUES(NEW.board_id,effect->>'title');
   outcome:='Registro criado';
 WHEN 'notify' THEN
   INSERT INTO notifications(user_id,task_id,type,title,message)
   SELECT id,NULL,'work_automation',rule.name,(effect->>'message')||' · '||NEW.title FROM app_users WHERE id=(effect->>'user_id')::int AND active;
   IF NOT FOUND THEN RAISE EXCEPTION 'Usuário indisponível'; END IF;
   outcome:='Notificação criada';
 ELSE RAISE EXCEPTION 'Ação inválida';
 END CASE;
 INSERT INTO work_automation_runs(rule_id,board_id,item_id,rule_name,result,detail) VALUES(rule.id,NEW.board_id,NEW.id,rule.name,'success',outcome);
 EXCEPTION WHEN OTHERS THEN
 -- Roll back only this rule's action, preserve the originating edit.
 INSERT INTO work_automation_runs(rule_id,board_id,item_id,rule_name,result,detail) VALUES(rule.id,NEW.board_id,NEW.id,rule.name,'failed','Ação não executada ('||SQLSTATE||')');
 END;
 END LOOP;
 RETURN NEW;
 END;
 $fn$;
 $ddl$;
 CREATE TRIGGER work_automation_v1 AFTER INSERT OR UPDATE OF values ON work_items FOR EACH ROW EXECUTE FUNCTION work_execute_automation_v1();
 END;
 $migration$`);
}
module.exports={ensureAutomations};
