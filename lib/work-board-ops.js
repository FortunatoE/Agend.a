'use strict';
const templates={
 project:{name:'Projetos',groups:['Backlog','Em execução','Finalizados'],fields:[['Status','status'],['Responsável','text'],['Início','date'],['Prazo','date'],['Horas planejadas','number']]},
 routine:{name:'Rotinas operacionais',groups:['Pendências','Em andamento','Conferidos'],fields:[['Status','status'],['Responsável','text'],['Prazo','date'],['Validado','checkbox'],['Observações','text']]},
 requests:{name:'Solicitações',groups:['Recebidas','Em análise','Finalizadas'],fields:[['Status','status'],['Solicitante','text'],['Prazo','date'],['Quantidade','number'],['Descrição','text']]}
};
function normalizeBulk(d){
 if(!Array.isArray(d.ids)||d.ids.length<1||d.ids.length>100||!d.ids.every(n=>Number.isInteger(n)&&n>0&&n<=2147483647))throw Error('Selecione de 1 a 100 registros.');
 const ids=[...new Set(d.ids)];
 if(d.mode==='group'){if(d.group_id!==null&&(!Number.isInteger(d.group_id)||d.group_id<=0))throw Error('Grupo inválido.');return {ids,mode:'group',group_id:d.group_id}}
 if(d.mode==='status'){if(!Number.isInteger(d.field_id)||d.field_id<=0||![null,'A fazer','Em andamento','Concluído'].includes(d.value))throw Error('Status inválido.');return {ids,mode:'status',field_id:d.field_id,value:d.value}}
 if(d.mode==='delete')return {ids,mode:'delete'};
 throw Error('Operação inválida.');
}
async function bulkWrite(sql,uid,bid,data){
 const d=normalizeBulk(data);
 const params=[uid,bid,d.ids];
 const gate="work_board_role($1,$2)>="+(d.mode==='delete'?3:2);
 let mutation,extra='';
 if(d.mode==='group'){params.push(d.group_id);extra=' AND ($4::int IS NULL OR EXISTS(SELECT 1 FROM work_groups WHERE id=$4 AND board_id=$2))';mutation='UPDATE work_items i SET group_id=$4 FROM authorized a WHERE i.board_id=$2 AND i.id=ANY($3::int[]) RETURNING i.id'}
 if(d.mode==='status'){params.push(String(d.field_id),JSON.stringify(d.value));extra=" AND EXISTS(SELECT 1 FROM work_fields WHERE id=$4::text::int AND board_id=$2 AND type='status')";mutation='UPDATE work_items i SET values=jsonb_set(i.values,ARRAY[$4::text],$5::jsonb,true) FROM authorized a WHERE i.board_id=$2 AND i.id=ANY($3::int[]) RETURNING i.id'}
 if(d.mode==='delete')mutation='DELETE FROM work_items i USING authorized a WHERE i.board_id=$2 AND i.id=ANY($3::int[]) RETURNING i.id';
 const rows=await sql.query(`WITH locked AS MATERIALIZED (SELECT id FROM work_items WHERE board_id=$2 AND id=ANY($3::int[]) AND ${gate} ORDER BY id FOR UPDATE),
 authorized AS MATERIALIZED (SELECT set_config('agenda.actor_id',$1::int::text,true) WHERE (SELECT count(*) FROM locked)=cardinality($3::int[]) AND ${gate}${extra}),
 changed AS (${mutation}) SELECT count(*)::int AS count FROM changed`,params);
 return rows[0].count;
}
async function createTemplate(sql,workspace,name,template){
 if(!Object.hasOwn(templates,template))throw Error('Modelo inválido.');
 const t=templates[template];
 const rows=await sql.query(`WITH board AS (INSERT INTO work_boards(workspace_id,name) VALUES($1,$2) RETURNING id),
 fields AS (INSERT INTO work_fields(board_id,name,type) SELECT b.id,f.name,f.type FROM board b CROSS JOIN jsonb_to_recordset($3::jsonb) AS f(name text,type text)),
 groups AS (INSERT INTO work_groups(board_id,name) SELECT b.id,g.name FROM board b CROSS JOIN unnest($4::text[]) AS g(name))
 SELECT id FROM board`,[workspace,name,JSON.stringify(t.fields.map(([name,type])=>({name,type}))),t.groups]);
 return rows[0];
}
module.exports={templates,normalizeBulk,bulkWrite,createTemplate};
