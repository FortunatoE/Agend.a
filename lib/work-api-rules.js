'use strict';
const supported=new Set(['text','number','date','checkbox','status']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function normalizeKey(d){
 const name=typeof d.name==='string'?d.name.trim():'';
 if(!name||name.length>120)throw Error('Informe um nome de até 120 caracteres.');
 if(!Number.isSafeInteger(d.owner_id)||d.owner_id<=0)throw Error('Selecione um usuário.');
 if(!['read','read_create'].includes(d.scope))throw Error('Escopo inválido.');
 if(!Number.isInteger(d.days)||d.days<1||d.days>90)throw Error('Validade de 1 a 90 dias.');
 return {name,owner_id:d.owner_id,scope:d.scope,days:d.days};
}
function normalizeRecord(d,fields){
 const title=typeof d.title==='string'?d.title.trim():'';
 if(!title||title.length>120)throw Error('Título obrigatório de até 120 caracteres.');
 if(typeof d.request_id!=='string'||!uuid.test(d.request_id))throw Error('request_id deve ser UUID v4.');
 if(d.group_id!=null&&(!Number.isSafeInteger(d.group_id)||d.group_id<=0))throw Error('Grupo inválido.');
 const input=d.values??{};
 if(typeof input!=='object'||!input||Array.isArray(input)||Object.keys(input).length>100)throw Error('Valores inválidos.');
 const allowed=new Map(fields.filter(f=>supported.has(f.type)).map(f=>[String(f.id),f]));
 const values={};
 for(const [id,v] of Object.entries(input)){
 const f=allowed.get(id);if(!f)throw Error('Campo não permitido: '+id);
 if(v===null)continue;
 let valid=false;
 if(f.type==='text')valid=typeof v==='string'&&v.length<=2000;
 if(f.type==='number')valid=typeof v==='number'&&Number.isFinite(v);
 if(f.type==='checkbox')valid=typeof v==='boolean';
 if(f.type==='status')valid=['A fazer','Em andamento','Concluído'].includes(v);
 if(f.type==='date')valid=typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 if(!valid)throw Error('Valor inválido no campo '+id);
 values[id]=v;
 }
 return {title,request_id:d.request_id,group_id:d.group_id??null,values};
}
function safeRead(fields,items){
 const visible=fields.filter(f=>supported.has(f.type));
 return {fields:visible.map(({id,name,type})=>({id,name,type})),items:items.map(i=>({id:i.id,title:i.title,group_id:i.group_id,created_at:i.created_at,values:Object.fromEntries(visible.filter(f=>Object.hasOwn(i.values||{},f.id)).map(f=>[f.id,i.values[f.id]]))}))};
}
module.exports={normalizeKey,normalizeRecord,safeRead,supported};
