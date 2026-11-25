'use strict';
function computeItems(items,fields){
 const itemById=new Map(items.map(i=>[Number(i.id),i]));
 const fieldById=new Map(fields.map(f=>[Number(f.id),f]));
 const boardFields=new Map();
 for(const f of fields){if(!boardFields.has(f.board_id))boardFields.set(f.board_id,[]);boardFields.get(f.board_id).push(f)}
 const related=(i,f)=>Array.isArray(i.values?.[f.id])?[...new Set(i.values[f.id])].map(v=>itemById.get(Number(v))).filter(t=>t&&t.board_id===f.config?.target_board_id):[];
 const num=v=>typeof v==='number'&&Number.isFinite(v);
 return items.map(i=>{
 const values={...i.values};
 for(const f of boardFields.get(i.board_id)||[]){
 const c=f.config||{};
 if(f.type==='relation'){values[f.id]=related(i,f).map(t=>t.id);continue}
 if(f.type==='formula'){
 const a=i.values?.[c.left_field_id],b=i.values?.[c.right_field_id];
 let v=null;
 if(num(a)&&num(b)){switch(c.operator){case '+':v=a+b;break;case '-':v=a-b;break;case '*':v=a*b;break;case '/':v=b===0?null:a/b;break}}
 values[f.id]=num(v)?v:null;continue;
 }
 if(f.type==='lookup'||f.type==='rollup'){
 const link=fieldById.get(c.relation_field_id);
 const targets=link&&link.type==='relation'&&link.board_id===i.board_id?related(i,link):[];
 const found=targets.map(t=>c.target_field_id==='title'?t.title:t.values?.[c.target_field_id]).filter(v=>v!==null&&v!==undefined);
 if(f.type==='lookup'){values[f.id]=found;continue}
 const ns=found.filter(num);let v=null;
 switch(c.aggregate){case 'count':v=targets.length;break;case 'sum':v=ns.reduce((a,b)=>a+b,0);break;case 'avg':v=ns.length?ns.reduce((a,b)=>a+b,0)/ns.length:null;break;case 'min':v=ns.reduce((a,b)=>a===null||b<a?b:a,null);break;case 'max':v=ns.reduce((a,b)=>a===null||b>a?b:a,null);break}
 values[f.id]=num(v)?v:null;
 }
 }
 return {...i,values};
 });
}
function validateConfig(type,config,boardId,boards,fields){
 const c=config||{}, f=id=>fields.find(x=>x.id===id);
 if(type==='relation'){
 if(!Number.isInteger(c.target_board_id)||!boards.some(b=>b.id===c.target_board_id))throw Error('Quadro de destino inválido.');
 return {target_board_id:c.target_board_id};
 }
 if(type==='formula'){
 if(!['+','-','*','/'].includes(c.operator)||[c.left_field_id,c.right_field_id].some(id=>f(id)?.board_id!==boardId||f(id)?.type!=='number'))throw Error('Selecione dois campos numéricos do quadro e uma operação.');
 return {left_field_id:c.left_field_id,right_field_id:c.right_field_id,operator:c.operator};
 }
 if(type==='lookup'||type==='rollup'){
 const link=f(c.relation_field_id);
 if(!link||link.board_id!==boardId||link.type!=='relation')throw Error('Selecione um relacionamento deste quadro.');
 const target=f(c.target_field_id),count=type==='rollup'&&c.aggregate==='count';
 if(!count&&c.target_field_id!=='title'&&(!target||target.board_id!==link.config?.target_board_id||!['text','number','date','checkbox','status'].includes(target.type)))throw Error('Campo de destino inválido.');
 if(type==='lookup')return {relation_field_id:link.id,target_field_id:c.target_field_id};
 if(!['count','sum','avg','min','max'].includes(c.aggregate)||(!count&&target?.type!=='number'))throw Error('Selecione uma agregação e um campo numérico de destino.');
 return {relation_field_id:link.id,target_field_id:count?'title':target.id,aggregate:c.aggregate};
 }
 return {};
}
module.exports={computeItems,validateConfig};
