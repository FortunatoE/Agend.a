'use strict';
async function ensureAreas(sql){
 const ready=await sql.query("SELECT to_regclass('public.agenda_areas') IS NOT NULL AND EXISTS(SELECT 1 FROM pg_constraint WHERE conname='agenda_task_area_fk' AND conrelid='tasks'::regclass) AND EXISTS(SELECT 1 FROM pg_constraint WHERE conname='agenda_note_area_fk') AND EXISTS(SELECT 1 FROM pg_constraint WHERE conname='agenda_member_area_fk') AS ok");
 if(ready[0]?.ok)return;
 await sql.query(`DO $areas$ BEGIN
 PERFORM pg_advisory_xact_lock(86124026);
 CREATE TABLE IF NOT EXISTS agenda_areas(id SERIAL PRIMARY KEY,name TEXT NOT NULL UNIQUE CHECK(length(trim(name)) BETWEEN 1 AND 100 AND lower(trim(name))<>'todas'));
 CREATE UNIQUE INDEX IF NOT EXISTS agenda_areas_name_ci ON agenda_areas(lower(name));
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='agenda_task_area_fk' AND conrelid='tasks'::regclass) THEN
 INSERT INTO agenda_areas(name) VALUES('Administrativo'),('Logística · Defensivo'),('Logística · Adubo'),('Planejamento') ON CONFLICT DO NOTHING;
 INSERT INTO agenda_areas(name) SELECT DISTINCT area FROM tasks WHERE area IS NOT NULL AND length(trim(area)) BETWEEN 1 AND 100 AND lower(trim(area))<>'todas' ON CONFLICT DO NOTHING;
 -- Preserve legacy spelling where names differ only by case.
 UPDATE tasks t SET area=a.name FROM agenda_areas a WHERE lower(t.area)=lower(a.name) AND t.area<>a.name;
 ALTER TABLE tasks ADD CONSTRAINT agenda_task_area_fk FOREIGN KEY(area) REFERENCES agenda_areas(name) ON UPDATE CASCADE ON DELETE RESTRICT;
 END IF;
 IF to_regclass('public.agenda_notes') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='agenda_note_area_fk') THEN
 INSERT INTO agenda_areas(name) SELECT DISTINCT area FROM agenda_notes WHERE area IS NOT NULL ON CONFLICT DO NOTHING;
 ALTER TABLE agenda_notes ADD CONSTRAINT agenda_note_area_fk FOREIGN KEY(area) REFERENCES agenda_areas(name) ON UPDATE CASCADE ON DELETE RESTRICT;
 END IF;
 IF to_regclass('public.agenda_area_members') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='agenda_member_area_fk') THEN
 INSERT INTO agenda_areas(name) SELECT DISTINCT area FROM agenda_area_members ON CONFLICT DO NOTHING;
 ALTER TABLE agenda_area_members ADD CONSTRAINT agenda_member_area_fk FOREIGN KEY(area) REFERENCES agenda_areas(name) ON UPDATE CASCADE ON DELETE RESTRICT;
 END IF;
 END; $areas$`);
}
async function listAreas(sql){return await sql.query('SELECT id,name FROM agenda_areas ORDER BY name,id')}
async function manageArea(sql,user,d,method,res){
 if(!user.is_admin)return res.status(403).json({error:'Acesso administrativo necessário.'});
 const name=typeof d.name==='string'?d.name.trim():'',id=Number(d.id);
 if(method!=='POST'&&(!Number.isSafeInteger(id)||id<=0))return res.status(400).json({error:'Área inválida.'});
 if(method!=='DELETE'&&(!name||name.length>100||name.toLowerCase()==='todas'))return res.status(400).json({error:'Informe um nome válido; Todas é um filtro reservado.'});
 try{
 let rows;if(method==='POST')rows=await sql.query('INSERT INTO agenda_areas(name) VALUES($1) RETURNING id,name',[name]);
 else if(method==='PATCH')rows=await sql.query('UPDATE agenda_areas SET name=$1 WHERE id=$2 RETURNING id,name',[name,id]);
 else if(method==='DELETE'&&d.confirm===true)rows=await sql.query('DELETE FROM agenda_areas WHERE id=$1 RETURNING id',[id]);
 else return res.status(400).json({error:'Operação inválida ou exclusão não confirmada.'});
 return rows.length?res.status(method==='POST'?201:200).json(rows[0]):res.status(404).json({error:'Área não encontrada.'});
 }catch(e){if(e.code==='23505')return res.status(409).json({error:'Já existe uma área com esse nome.'});if(e.code==='23503')return res.status(409).json({error:'Área possui atividades, anotações ou colaboradores vinculados. Transfira ou remova os vínculos antes de excluir.'});throw e}
}
module.exports={ensureAreas,listAreas,manageArea};
