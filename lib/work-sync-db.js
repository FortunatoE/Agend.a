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
module.exports={ensureSync};
