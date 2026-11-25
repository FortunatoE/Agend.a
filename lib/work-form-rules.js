'use strict';
const supported=['text','number','date','checkbox','status'];
const statuses=['A fazer','Em andamento','Concluído'];
function normalizeForm(data,board,fields,groups){
 const name=typeof data.name==='string'?data.name.trim():'';
 if(!name||name.length>120)throw Error('Informe um nome de até 120 caracteres.');
 const description=typeof data.description==='string'?data.description.trim():'';
 if(description.length>1000)throw Error('Descrição muito longa.');
 if(!Array.isArray(data.fields)||data.fields.length>30)throw Error('Selecione até 30 campos.');
 const seen=new Set();
 const questions=data.fields.map(q=>{
 const f=fields.find(f=>f.id===q?.field_id&&f.board_id===board&&supported.includes(f.type));
 if(!f||seen.has(f.id)||typeof q.required!=='boolean')throw Error('Campo inválido ou duplicado.');
 seen.add(f.id);return {field_id:f.id,required:q.required};
 });
 const group=data.group_id??null;
 if(group!==null&&!groups.some(g=>g.id===group&&g.board_id===board))throw Error('Grupo de destino inválido.');
 return {name,description,fields:questions,group_id:group};
}
function validateResponse(form,data,fields){
 const title=typeof data.title==='string'?data.title.trim():'';
 if(!title||title.length>120)throw Error('Informe o título do registro (até 120 caracteres).');
 const answers=data.answers;
 if(!answers||typeof answers!=='object'||Array.isArray(answers))throw Error('Respostas inválidas.');
 const allowed=new Set(form.fields.map(q=>String(q.field_id)));
 if(Object.keys(answers).some(k=>!allowed.has(k)))throw Error('Resposta contém campo não configurado.');
 const values={};
 for(const q of form.fields){
 const f=fields.find(f=>f.id===q.field_id&&f.board_id===form.board_id&&supported.includes(f.type));
 if(!f)throw Error('Formulário desatualizado. Solicite revisão ao administrador.');
 let v=Object.hasOwn(answers,String(f.id))?answers[f.id]:null;
 if(typeof v==='string')v=v.trim();
 if(v===null||v===''){if(q.required)throw Error('Preencha '+f.name+'.');continue}
 let valid=false;
 if(f.type==='text')valid=typeof v==='string'&&v.length<=2000;
 if(f.type==='number')valid=typeof v==='number'&&Number.isFinite(v);
 if(f.type==='checkbox')valid=typeof v==='boolean';
 if(f.type==='status')valid=statuses.includes(v);
 if(f.type==='date')valid=typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 if(!valid)throw Error('Valor inválido em '+f.name+'.');
 values[f.id]=v;
 }
 return {title,values};
}
module.exports={normalizeForm,validateResponse};
