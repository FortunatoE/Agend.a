'use strict';
async function ensureExchange(sql){
 const installed=await sql.query("SELECT to_regclass('public.work_import_runs') AS name");
 if(installed[0]?.name)return;
 await sql.query(`DO $migration$
 BEGIN
 PERFORM pg_advisory_xact_lock(86124018);
 CREATE TABLE IF NOT EXISTS work_import_runs(
 id BIGSERIAL PRIMARY KEY,board_id INTEGER NOT NULL REFERENCES work_boards(id) ON DELETE CASCADE,
 user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,request_id UUID NOT NULL,
 row_count INTEGER NOT NULL CHECK(row_count BETWEEN 1 AND 200),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(board_id,user_id,request_id));
 CREATE INDEX IF NOT EXISTS work_import_runs_board_idx ON work_import_runs(board_id,id DESC);
 END;
 $migration$`);
}
async function insertBatch(sql,args){
 return sql.query(`WITH actor AS MATERIALIZED (SELECT set_config('agenda.actor_id',$2::int::text,true)),
 reserved AS (INSERT INTO work_import_runs(board_id,user_id,request_id,row_count)
 SELECT $1,$2,$3::uuid,$4 FROM actor WHERE work_board_role($2,$1)>=2
 ON CONFLICT(board_id,user_id,request_id) DO NOTHING RETURNING id,row_count),
 inserted AS (INSERT INTO work_items(board_id,group_id,title,values)
 SELECT $1,$6,r.title,r.values FROM reserved CROSS JOIN jsonb_to_recordset($5::jsonb) AS r(title text,values jsonb) RETURNING id)
 SELECT reserved.id,reserved.row_count,(SELECT count(*)::int FROM inserted) AS inserted FROM reserved`,args);
}
module.exports={ensureExchange,insertBatch};
