'use strict';
async function ensureWorkflows(sql){
 const installed=await sql.query("SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='work_items'::regclass AND tgname='work_workflow_v2') AS ok");
 if(installed[0]?.ok)return;
 await sql.query(`DO $migration$
 BEGIN
 PERFORM pg_advisory_xact_lock(86124015);
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='work_items'::regclass AND tgname='work_workflow_v2') THEN RETURN; END IF;
 CREATE TABLE IF NOT EXISTS work_workflows (
 id SERIAL PRIMARY KEY,board_id INTEGER NOT NULL REFERENCES work_boards(id) ON DELETE CASCADE,
 name TEXT NOT NULL,enabled BOOLEAN NOT NULL DEFAULT TRUE,trigger_config JSONB NOT NULL,steps JSONB NOT NULL,
 created_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS work_workflow_runs (
 id BIGSERIAL PRIMARY KEY,workflow_id INTEGER REFERENCES work_workflows(id) ON DELETE SET NULL,
 board_id INTEGER NOT NULL REFERENCES work_boards(id) ON DELETE CASCADE,item_id INTEGER REFERENCES work_items(id) ON DELETE SET NULL,
 workflow_name TEXT NOT NULL,result TEXT NOT NULL CHECK(result IN ('success','failed')),trace JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE INDEX IF NOT EXISTS work_workflows_board_idx ON work_workflows(board_id) WHERE enabled;
 CREATE INDEX IF NOT EXISTS work_workflow_runs_board_idx ON work_workflow_runs(board_id,id DESC);
 EXECUTE $ddl$
 CREATE OR REPLACE FUNCTION work_execute_workflow_v2() RETURNS trigger LANGUAGE plpgsql AS $fn$
 DECLARE flow work_workflows%ROWTYPE; step JSONB; effect JSONB; effects JSONB; trace_log JSONB;
 current_values JSONB; matched BOOLEAN; step_number INT; field_key TEXT; outcome TEXT;
 BEGIN
 IF pg_trigger_depth()>1 THEN RETURN NEW; END IF;
 FOR flow IN SELECT * FROM work_workflows WHERE board_id=NEW.board_id AND enabled ORDER BY id LOOP
 IF flow.trigger_config->>'type'='created' THEN
 IF TG_OP<>'INSERT' THEN CONTINUE; END IF;
 ELSIF flow.trigger_config->>'type'='field_changed' THEN
 IF TG_OP<>'UPDATE' THEN CONTINUE; END IF;
 field_key:=flow.trigger_config->>'field_id';
 IF COALESCE(OLD.values->field_key,'null'::jsonb) IS NOT DISTINCT FROM COALESCE(NEW.values->field_key,'null'::jsonb) THEN CONTINUE; END IF;
 ELSE CONTINUE;
 END IF;
 trace_log:='[]'::jsonb;step_number:=0;
 BEGIN
 FOR step IN SELECT value FROM jsonb_array_elements(flow.steps) LOOP
 step_number:=step_number+1;
 IF step->>'type'='condition' THEN
 SELECT values INTO current_values FROM work_items WHERE id=NEW.id;
 matched:=(current_values->>(step->>'field_id')) IS NOT DISTINCT FROM (step->>'value');
 trace_log:=trace_log||jsonb_build_array(jsonb_build_object('step',step_number,'type','condition','detail',CASE WHEN matched THEN 'Sim' ELSE 'Não' END));
 effects:=CASE WHEN matched THEN step->'yes' ELSE step->'no' END;
 ELSIF step->>'type'='action' THEN effects:=jsonb_build_array(step->'effect');
 ELSE RAISE EXCEPTION 'Etapa inválida';
 END IF;
 FOR effect IN SELECT value FROM jsonb_array_elements(effects) LOOP
 CASE effect->>'type'
 WHEN 'set_status' THEN
 field_key:=effect->>'field_id';
 IF NOT EXISTS(SELECT 1 FROM work_fields WHERE id=field_key::int AND board_id=NEW.board_id AND type='status') OR effect->>'value' NOT IN ('A fazer','Em andamento','Concluído') THEN RAISE EXCEPTION 'Campo ou status inválido'; END IF;
 UPDATE work_items SET values=jsonb_set(values,ARRAY[field_key],effect->'value',true) WHERE id=NEW.id;
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
 SELECT id,NULL,'work_workflow','Atualização de processo','Uma regra automática foi executada. Consulte seus quadros.' FROM app_users WHERE id=(effect->>'user_id')::int AND active AND work_board_role(id,NEW.board_id)>0;
 IF NOT FOUND THEN RAISE EXCEPTION 'Usuário indisponível'; END IF;
 outcome:='Notificação criada';
 ELSE RAISE EXCEPTION 'Ação inválida';
 END CASE;
 trace_log:=trace_log||jsonb_build_array(jsonb_build_object('step',step_number,'type','action','detail',outcome));
 END LOOP;
 END LOOP;
 INSERT INTO work_workflow_runs(workflow_id,board_id,item_id,workflow_name,result,trace) VALUES(flow.id,NEW.board_id,NEW.id,flow.name,'success',trace_log);
 EXCEPTION WHEN OTHERS THEN
 -- All effects of this workflow roll back, but the originating edit remains.
 INSERT INTO work_workflow_runs(workflow_id,board_id,item_id,workflow_name,result,trace)
 VALUES(flow.id,NEW.board_id,NEW.id,flow.name,'failed',jsonb_build_array(jsonb_build_object('step',step_number,'type','error','detail','Fluxo revertido ('||SQLSTATE||')')));
 END;
 END LOOP;
 RETURN NEW;
 END;
 $fn$;
 $ddl$;
 DROP TRIGGER IF EXISTS work_workflow_v1 ON work_items;
 CREATE TRIGGER work_workflow_v2 AFTER INSERT OR UPDATE OF values ON work_items FOR EACH ROW EXECUTE FUNCTION work_execute_workflow_v2();
 END;
 $migration$`);
}
module.exports={ensureWorkflows};
