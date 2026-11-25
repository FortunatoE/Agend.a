'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalizeKey,normalizeRecord,normalizeSync,eventCursor,safeRead}=require('../lib/work-api-rules');
const fields=[{id:1,name:'Quantidade',type:'number'},{id:2,name:'Validado',type:'checkbox'},{id:3,name:'Prazo',type:'date'},{id:4,name:'Vínculo',type:'relation'},{id:5,name:'Total',type:'formula'},{id:6,name:'Status',type:'status'}];
const key={name:' ERP ',owner_id:2,scope:'read_create',days:30};
const record={title:' Pedido ',request_id:'00000000-0000-4000-8000-000000000001',values:{1:0,2:false,3:'2028-02-29',6:'A fazer'}};
test('validates credential scope, owner and expiration',()=>{assert.equal(normalizeKey(key).name,'ERP');for(const bad of [{scope:'admin'},{days:91},{days:0},{owner_id:'2'},{name:' '}])assert.throws(()=>normalizeKey({...key,...bad}))});
test('validates record payload and preserves false and zero',()=>{assert.deepEqual(normalizeRecord(record,fields),{title:'Pedido',request_id:record.request_id,group_id:null,values:record.values})});
test('rejects calculated or foreign fields, invalid dates, IDs and values',()=>{for(const values of [{4:[1]},{5:9},{99:'x'},{1:'0'},{2:0},{3:'2027-02-29'},{6:'x'}])assert.throws(()=>normalizeRecord({...record,values},fields));assert.throws(()=>normalizeRecord({...record,request_id:'invalid'},fields));assert.throws(()=>normalizeRecord({...record,group_id:'1'},fields))});
test('external reads expose only basic fields and permitted values',()=>{const result=safeRead(fields,[{id:1,title:'A',values:{1:5,4:[99],5:123,99:'secret'}}]);assert.deepEqual(result.fields.map(f=>f.id),[1,2,3,6]);assert.deepEqual(result.items[0].values,{1:5})});

test('sync scope is explicit; external identity and partial updates preserve null',()=>{
 assert.equal(normalizeKey({...key,scope:'read_write'}).scope,'read_write');
 const sync=normalizeSync({...record,external_id:' ERP-001 ',values:{1:null,2:false}},fields);
 assert.equal(sync.external_id,'ERP-001');assert.deepEqual(sync.values,{1:null,2:false});assert.equal(sync.has_group,false);
 assert.equal(normalizeSync({...record,external_id:'ERP-001',group_id:null},fields).has_group,true);
 for(const id of ['',42,'x'.repeat(121),'a\nb'])assert.throws(()=>normalizeSync({...record,external_id:id},fields));
});
test('event cursor preserves bigint precision and rejects malformed values',()=>{
 assert.equal(eventCursor('9223372036854775807'),'9223372036854775807');assert.equal(eventCursor(undefined),'0');
 for(const v of ['-1','1.5','1e3','9223372036854775808','01'])assert.throws(()=>eventCursor(v));
});
