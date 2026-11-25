'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../dist/exchange-core');
const fields=[{id:1,name:'Quantidade',type:'number'},{id:2,name:'Prazo',type:'date'},{id:3,name:'Validado',type:'checkbox'},{id:4,name:'Total',type:'formula'},{id:5,name:'Status',type:'status'}];
const mapping={title:0,fields:[{field_id:1,column:1},{field_id:2,column:2},{field_id:3,column:3},{field_id:5,column:4}]};
test('parses BOM, quoted delimiters, escaped quotes, embedded newlines and CRLF',()=>{
 const p=E.parseCSV('\uFEFFNome;Texto\r\n"A;B";"linha 1\r\nlinha ""2"""\r\n',';');
 assert.deepEqual(p,{header:['Nome','Texto'],rows:[['A;B','linha 1\r\nlinha "2"']]});
});
test('rejects malformed quotes, inconsistent columns, empty headers and limits',()=>{
 for(const raw of ['A;B\n"x;y','A;B\nx','A;\nx;y','A;B\n"x"z;y'])assert.throws(()=>E.parseCSV(raw,';'));
 assert.throws(()=>E.parseCSV('A\n'+Array(201).fill('x').join('\n'),';'));
 assert.throws(()=>E.parseCSV('A\n'+'x'.repeat(500000),';'));
});
test('maps typed records including decimal comma, dates, zero and false',()=>{
 const p=E.prepare('Nome;Qtd;Prazo;Ok;Status\nPedido;0;29/02/2028;Não;concluído\nOutro;2,5;;;',';',mapping,fields);
 assert.equal(p.errors.length,0);assert.deepEqual(p.records,[{title:'Pedido',values:{1:0,2:'2028-02-29',3:false,5:'Concluído'}},{title:'Outro',values:{1:2.5}}]);
});
test('reports invalid fields without accepting calculated columns or duplicate mappings',()=>{
 const raw='Nome;Qtd;Prazo;Ok;Status\n;1.000,00;29/02/2027;talvez;outro';
 assert.equal(E.prepare(raw,';',mapping,fields).errors.length,5);
 assert.throws(()=>E.prepare(raw,';',{title:0,fields:[{field_id:4,column:1}]},fields));
 assert.throws(()=>E.prepare(raw,';',{title:0,fields:[mapping.fields[0],mapping.fields[0]]},fields));
});
test('export escapes quotes and neutralizes formula-like strings, preserves real negative numbers',()=>{
 const csv=E.encodeCSV(['=Nome','Número','Texto'],[['  +CMD',-2,'A"B'],['@teste',true,'\n=1']]);
 const p=E.parseCSV(csv,';');assert.deepEqual(p.header,["'=Nome",'Número','Texto']);assert.deepEqual(p.rows,[["'  +CMD",'-2','A"B'],["'@teste",'Sim',"'\n=1"]]);
});
