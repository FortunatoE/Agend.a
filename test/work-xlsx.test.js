'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const ExcelJS=require('exceljs');
const {decodeWorkbook,encodeWorkbook}=require('../lib/work-xlsx');
const {parseCSV}=require('../dist/exchange-core');
test('XLSX round trip preserves zero, false, text, date and formula-like text',async()=>{
 const encoded=await encodeWorkbook(['Título','Número','Sim/Não','Data','Texto'],[['Pedido',0,false,'2028-02-29','=1+1']],[3]);
 const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(encoded,'base64'));
 const row=book.worksheets[0].getRow(2);assert.equal(row.getCell(2).value,0);assert.equal(row.getCell(3).value,false);assert.equal(row.getCell(5).value,'=1+1');
 const data=parseCSV(await decodeWorkbook(encoded),';');assert.deepEqual(data.rows,[['Pedido','0','false','2028-02-29','=1+1']]);
});
test('XLSX decoder rejects formula cells, non-ZIP files and excess rows',async()=>{
 await assert.rejects(()=>decodeWorkbook(Buffer.from('not a workbook').toString('base64')));
 const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Importar');sheet.addRow(['Título']);sheet.addRow([{formula:'1+1',result:2}]);
 await assert.rejects(async()=>decodeWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64')));
 const oversized=await encodeWorkbook(['Título'],Array.from({length:201},(_,i)=>['Registro '+i]));
 await assert.rejects(()=>decodeWorkbook(oversized));
});
