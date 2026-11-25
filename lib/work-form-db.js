'use strict';
async function ensureForms(sql){
 const installed=await sql.query("SELECT to_regclass('public.work_form_submissions') AS name");
 if(installed[0]?.name)return;
 await sql.query(`DO $migration$
 BEGIN
 PERFORM pg_advisory_xact_lock(86124016);
 CREATE TABLE IF NOT EXISTS work_forms(
 id SERIAL PRIMARY KEY,board_id INTEGER NOT NULL REFERENCES work_boards(id) ON DELETE CASCADE,
 name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',fields JSONB NOT NULL,
 group_id INTEGER REFERENCES work_groups(id) ON DELETE SET NULL,enabled BOOLEAN NOT NULL DEFAULT TRUE,
 created_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 );
 CREATE TABLE IF NOT EXISTS work_form_submissions(
 id BIGSERIAL PRIMARY KEY,form_id INTEGER NOT NULL REFERENCES work_forms(id),
 board_id INTEGER NOT NULL REFERENCES work_boards(id) ON DELETE CASCADE,
 item_id INTEGER REFERENCES work_items(id) ON DELETE SET NULL,
 submitted_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
 request_id UUID NOT NULL,title TEXT NOT NULL,answers JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(form_id,submitted_by,request_id)
 );
 CREATE INDEX IF NOT EXISTS work_forms_board_idx ON work_forms(board_id);
 CREATE INDEX IF NOT EXISTS work_form_submissions_form_idx ON work_form_submissions(form_id,id DESC);
 END;
 $migration$`);
}
module.exports={ensureForms};
