'use strict';
const ExcelJS=require('exceljs');
const yauzl=require('yauzl');
const {parseCSV,MAX_CHARS}=require('../dist/exchange-core');
const MAX_FILE=1500000,MAX_ZIP=12000000;
function validateZip(buffer){
 return new Promise((resolve,reject)=>{
 yauzl.fromBuffer(buffer,{lazyEntries:true,validateEntrySizes:true},(err,zip)=>{
 if(err)return reject(Error('Arquivo XLSX inválido.'));
 let entries=0,total=0,actual=0,done=false;
 const fail=()=>{if(!done){done=true;zip.close();reject(Error('Arquivo XLSX inválido ou acima dos limites de segurança.'))}};
 zip.on('error',fail);zip.on('end',()=>{if(!done){done=true;resolve()}});
 zip.on('entry',entry=>{
 if(++entries>400||entry.uncompressedSize>MAX_ZIP||(total+=entry.uncompressedSize)>MAX_ZIP||entry.generalPurposeBitFlag&1||/vbaProject|externalLinks|embeddings/i.test(entry.fileName))return fail();
 if(entry.fileName.endsWith('/'))return zip.readEntry();
 zip.openReadStream(entry,(err,stream)=>{
 if(err)return fail();
 stream.on('data',chunk=>{actual+=chunk.length;if(actual>MAX_ZIP){stream.destroy();fail()}});
 stream.on('error',fail);stream.on('end',()=>{if(!done)zip.readEntry()});
 });
 });zip.readEntry();
 });
 });
}
function cellText(cell){
 const v=cell.value;
 if(v==null)return '';
 if(v instanceof Date){if(!Number.isFinite(v.valueOf()))throw Error('Data inválida.');return v.toISOString().slice(0,10)}
 if(typeof v==='string'||typeof v==='number'||typeof v==='boolean')return String(v);
 if(typeof v==='object'&&Array.isArray(v.richText))return v.richText.map(x=>x.text||'').join('');
 throw Error('A planilha contém fórmula, erro ou célula especial. Cole os valores antes de importar.');
}
const quote=v=>'"'+String(v).replace(/"/g,'""')+'"';
async function decodeWorkbook(encoded){
 if(typeof encoded!=='string'||encoded.length>Math.ceil(MAX_FILE/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error('Arquivo XLSX inválido ou acima de 1,5 MB.');
 const buffer=Buffer.from(encoded,'base64');if(buffer.length>MAX_FILE)throw Error('Arquivo acima de 1,5 MB.');
 await validateZip(buffer);
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer);
 const ws=workbook.worksheets[0];if(!ws||ws.rowCount>201||ws.columnCount>100||!ws.columnCount)throw Error('A primeira aba deve ter cabeçalho, até 200 registros e 100 colunas.');
 let csv='';
 for(let i=1;i<=ws.rowCount;i++){
 const row=ws.getRow(i),values=Array.from({length:ws.columnCount},(_,j)=>quote(cellText(row.getCell(j+1))));
 csv+=(i>1?'\r\n':'')+values.join(';');if(csv.length>MAX_CHARS)throw Error('Conteúdo acima de 500 mil caracteres.');
 }
 parseCSV(csv,';');return csv;
}
async function encodeWorkbook(headers,rows,dateColumns=[]){
 const workbook=new ExcelJS.Workbook(),ws=workbook.addWorksheet('Registros',{views:[{state:'frozen',ySplit:1}]});
 ws.addRow(headers);
 ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
 ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF168353'}};
 for(const values of rows){ws.addRow(values.map((v,i)=>Array.isArray(v)?v.join(' | '):dateColumns.includes(i)&&typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?new Date(v+'T00:00:00Z'):v??null))}
 for(const i of dateColumns)ws.getColumn(i+1).numFmt='dd/mm/yyyy';
 for(let i=1;i<=headers.length;i++)ws.getColumn(i).width=Math.min(45,Math.max(15,String(headers[i-1]).length+3));
 ws.autoFilter={from:{row:1,column:1},to:{row:1,column:headers.length}};
 const bytes=await workbook.xlsx.writeBuffer();if(bytes.length>2500000)throw Error('Exportação XLSX excede o tamanho permitido.');
 return Buffer.from(bytes).toString('base64');
}
module.exports={decodeWorkbook,encodeWorkbook};
