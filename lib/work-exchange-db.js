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
module.exports={ensureExchange};
