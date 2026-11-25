(function(root,factory){const core=factory();if(typeof module==='object'&&module.exports)module.exports=core;else root.AgendaExchange=core;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const supported=['text','number','date','checkbox','status'];
 const MAX_ROWS=200,MAX_CHARS=500000,MAX_COLS=100;
 function parseCSV(raw,delimiter){
 if(typeof raw!=='string'||raw.length>MAX_CHARS)throw Error('Arquivo excede 500 mil caracteres.');
 if(![',',';','\t'].includes(delimiter))throw Error('Separador inválido.');
 const text=raw.replace(/^\uFEFF/,'');let rows=[],row=[],value='',quoted=false,closed=false;
 function cell(){row.push(value);if(row.length>MAX_COLS)throw Error('Limite de 100 colunas.');value='';closed=false}
 function line(){cell();if(row.some(v=>v.trim()!=='')){rows.push(row);if(rows.length>MAX_ROWS+1)throw Error('Limite de 200 registros por importação.')}row=[]}
 for(let i=0;i<text.length;i++){
 const c=text[i];
 if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++}else{quoted=false;closed=true}}else value+=c;continue}
 if(c===delimiter){cell();continue}
 if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;line();continue}
 if(closed)throw Error('Caractere inválido após aspas.');
 if(c==='"'){if(value!=='')throw Error('Aspas inválidas no CSV.');quoted=true;continue}
 value+=c;
 }
 if(quoted)throw Error('Campo com aspas não encerradas.');
 if(value!==''||row.length||closed)line();
 if(!rows.length)throw Error('Arquivo vazio.');
 const header=rows.shift().map(h=>h.trim());
 if(header.some(h=>!h))throw Error('Todos os cabeçalhos precisam de nome.');
 if(rows.some(r=>r.length!==header.length))throw Error('Há registros com número incorreto de colunas.');
 return {header,rows};
 }
 function typed(value,type){
 const v=value.trim();if(v==='')return null;
 if(type==='text'){if(v.length>2000)throw Error('Texto excede 2000 caracteres.');return v}
 if(type==='number'){
 if(!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(v))throw Error('Número inválido; não use separador de milhares.');
 const n=Number(v.replace(',','.'));if(!Number.isFinite(n))throw Error('Número inválido.');return n;
 }
 if(type==='date'){
 const d=/^\d{2}\/\d{2}\/\d{4}$/.test(v)?v.split('/').reverse().join('-'):v;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)throw Error('Data inválida (DD/MM/AAAA ou AAAA-MM-DD).');return d;
 }
 if(type==='checkbox'){const a=v.toLowerCase();if(['sim','true','1','verdadeiro'].includes(a))return true;if(['não','nao','false','0','falso'].includes(a))return false;throw Error('Use Sim ou Não.')}
 if(type==='status'){const a=['A fazer','Em andamento','Concluído'].find(x=>x.toLowerCase()===v.toLowerCase());if(!a)throw Error('Status inválido.');return a}
 throw Error('Tipo não importável.');
 }
 function prepare(raw,delimiter,mapping,fields){
 const {header,rows}=parseCSV(raw,delimiter);
 if(!mapping||!Array.isArray(mapping.fields)||mapping.fields.length>MAX_COLS)throw Error('Mapeamento inválido.');
 const column=n=>Number.isInteger(n)&&n>=0&&n<header.length;
 if(!column(mapping.title))throw Error('Selecione a coluna de título.');
 const seen=new Set(),mapped=mapping.fields.map(m=>{
 const f=fields.find(f=>f.id===m?.field_id&&supported.includes(f.type));
 if(!f||!column(m.column)||seen.has(f.id))throw Error('Mapeamento de campo inválido ou duplicado.');
 seen.add(f.id);return {...m,field:f};
 });
 const errors=[],records=[];
 rows.forEach((row,index)=>{
 const title=row[mapping.title].trim(),values={};
 if(!title||title.length>120)errors.push({row:index+2,field:'Título',message:'Informe até 120 caracteres.'});
 for(const m of mapped){try{const v=typed(row[m.column],m.field.type);if(v!==null)values[m.field.id]=v}catch(e){errors.push({row:index+2,field:m.field.name,message:e.message})}}
 records.push({title,values});
 });
 return {header,records,errors};
 }
 function csvCell(value){
 let text=typeof value==='boolean'?(value?'Sim':'Não'):value==null?'':Array.isArray(value)?value.map(x=>typeof x==='boolean'?(x?'Sim':'Não'):String(x)).join(' | '):String(value);
 if(typeof value!=='number'&&/^[\s\u0000-\u001f]*[=+\-@]/.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
 }
 function encodeCSV(headers,rows){return '\uFEFF'+[headers,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n')}
 return {supported,MAX_ROWS,MAX_CHARS,parseCSV,typed,prepare,encodeCSV};
});
