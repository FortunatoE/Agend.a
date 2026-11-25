'use strict';
// A separate scope is required for upsert. Existing keys cannot acquire it implicitly.
async function ensureSync(sql){
 if((await sql.query("SELECT to_regprocedure('work_sync_upsert(integer,uuid,text,text,jsonb,integer,boolean)') IS NOT NULL AS ok"))[0]?.ok)return;
 await sql.query(`DO $migration$
 BEGIN
 PERFORM pg_advisory_xact_lock(86124020);
 IF to_regprocedure('work_sync_upsert(integer,uuid,text,text,jsonb,integer,boolean)') IS NOT NULL THEN RETURN; END IF;
 ALTER TABLE work_api_keys DROP CONSTRAINT IF EXISTS work_api_keys_scope_check;
 ALTER TABLE work_api_keys ADD CONSTRAINT work_api_keys_scope_check CHECK(scope IN ('read','read_create','read_write'));
 ALTER TABLE work_items ADD COLUMN IF NOT EXISTS external_id TEXT;
 CREATE UNIQUE INDEX IF NOT EXISTS work_items_external_key ON work_items(board_id,external_id);
 CREATE TABLE IF NOT EXISTS work_sync_requests(
 key_id INTEGER NOT NULL REFERENCES work_api_keys(id) ON DELETE CASCADE,
 request_id UUID NOT NULL,item_id INTEGER NOT NULL,created BOOLEAN NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(key_id,request_id));
 EXECUTE $ddl$
 CREATE FUNCTION work_sync_upsert(kid integer,rid uuid,external_key text,new_title text,new_values jsonb,new_group integer,has_group boolean)
 RETURNS TABLE(item_id integer,created boolean,replayed boolean)
 LANGUAGE plpgsql AS $fn$
 DECLARE k work_api_keys%ROWTYPE; current_item integer; prior work_sync_requests%ROWTYPE; inserted boolean; changed_id integer;
 BEGIN
 SELECT a.* INTO k FROM work_api_keys a JOIN app_users u ON u.id=a.owner_id
 WHERE a.id=kid AND a.scope='read_write' AND a.revoked_at IS NULL AND a.expires_at>NOW() AND u.active
 AND (u.is_admin OR (u.can_create AND u.can_edit)) AND work_board_role(a.owner_id,a.board_id)>=2 FOR UPDATE OF a;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT s.* INTO prior FROM work_sync_requests s WHERE s.key_id=kid AND s.request_id=rid;
 IF FOUND THEN RETURN QUERY SELECT prior.item_id,prior.created,true;RETURN; END IF;
 IF new_group IS NOT NULL AND NOT EXISTS(SELECT 1 FROM work_groups WHERE id=new_group AND board_id=k.board_id) THEN RETURN; END IF;
 -- Serialize the same external identity even across different credentials.
 PERFORM pg_advisory_xact_lock(hashtextextended(k.board_id::text||':'||external_key,86124020));
 PERFORM set_config('agenda.actor_id',k.owner_id::text,true);
 SELECT i.id INTO current_item FROM work_items i WHERE i.board_id=k.board_id AND i.external_id=external_key FOR UPDATE;
 IF FOUND THEN
 UPDATE work_items i SET title=new_title,values=i.values||new_values,group_id=CASE WHEN has_group THEN new_group ELSE i.group_id END
 WHERE i.id=current_item RETURNING i.id INTO changed_id;
 inserted:=false;
 ELSE
 INSERT INTO work_items(board_id,external_id,title,values,group_id)
 VALUES(k.board_id,external_key,new_title,new_values,new_group) RETURNING id INTO changed_id;
 inserted:=true;
 END IF;
 INSERT INTO work_sync_requests(key_id,request_id,item_id,created) VALUES(kid,rid,changed_id,inserted);
 RETURN QUERY SELECT changed_id,inserted,false;
 END;
 $fn$;
 $ddl$;
 END;
 $migration$`);
}
async function ensureEvents(sql){
 if((await sql.query("SELECT to_regclass('public.work_sync_events') AS name"))[0]?.name)return;
 await sql.query(`DO $migration$
 BEGIN
 PERFORM pg_advisory_xact_lock(86124021);
 IF to_regclass('public.work_sync_events') IS NOT NULL THEN RETURN; END IF;
 CREATE TABLE work_event_counters(board_id INTEGER PRIMARY KEY REFERENCES work_boards(id) ON DELETE CASCADE,last_seq BIGINT NOT NULL);
 CREATE TABLE work_sync_events(board_id INTEGER NOT NULL REFERENCES work_boards(id) ON DELETE CASCADE,seq BIGINT NOT NULL,
 item_id INTEGER NOT NULL,event TEXT NOT NULL CHECK(event IN ('created','updated','deleted')),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(board_id,seq));
 EXECUTE $ddl$
 CREATE FUNCTION work_capture_event_v1() RETURNS trigger LANGUAGE plpgsql AS $fn$
 DECLARE bid INTEGER; iid INTEGER; event_seq BIGINT; kind TEXT;
 BEGIN
 IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
 IF TG_OP='DELETE' THEN bid:=OLD.board_id;iid:=OLD.id;kind:='deleted';
 ELSIF TG_OP='INSERT' THEN bid:=NEW.board_id;iid:=NEW.id;kind:='created';
 ELSE bid:=NEW.board_id;iid:=NEW.id;kind:='updated';END IF;
 IF EXISTS(SELECT 1 FROM work_boards WHERE id=bid) THEN
 INSERT INTO work_event_counters(board_id,last_seq) VALUES(bid,1)
 ON CONFLICT(board_id) DO UPDATE SET last_seq=work_event_counters.last_seq+1 RETURNING last_seq INTO event_seq;
 INSERT INTO work_sync_events(board_id,seq,item_id,event) VALUES(bid,event_seq,iid,kind);
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
 END;
 $fn$;
 $ddl$;
 CREATE TRIGGER work_00_event_v1 AFTER INSERT OR UPDATE OR DELETE ON work_items FOR EACH ROW EXECUTE FUNCTION work_capture_event_v1();
 END;
 $migration$`);
}
module.exports={ensureSync,ensureEvents};
