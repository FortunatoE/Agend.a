'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeWorkflow}=require('../lib/work-workflow-rules');
const fields=[{id:1,board_id:1,type:'status'},{id:2,board_id:2,type:'status'},{id:3,board_id:1,type:'formula'}],groups=[{id:1,board_id:1},{id:2,board_id:2}],users=[{id:7}];
const status={type:'set_status',field_id:1,value:'Concluído'},move={type:'move_group',group_id:1},notify={type:'notify',user_id:7,message:'Pronto'};
const action={type:'action',effect:status},decision={type:'condition',field_id:1,value:'Concluído',yes:[move,notify],no:[{type:'create_item',title:'Revisar'}]};
const base={name:' Revisão ',trigger:{type:'created'},steps:[action,decision]};
const validate=d=>normalizeWorkflow(d,1,fields,groups,users);
test('normalizes ordered steps, both conditional branches and trigger',()=>{
 const f=validate(base);assert.equal(f.name,'Revisão');assert.deepEqual(f.steps,[action,decision]);assert.deepEqual(f.trigger,{type:'created'});
});
test('rejects fields from other boards, computed triggers and invalid branch effects',()=>{
 assert.throws(()=>validate({...base,trigger:{type:'field_changed',field_id:2}}));
 assert.throws(()=>validate({...base,trigger:{type:'field_changed',field_id:3}}));
 assert.throws(()=>validate({...base,steps:[{...decision,field_id:2}]}));
 assert.throws(()=>validate({...base,steps:[{...decision,yes:[{type:'move_group',group_id:2}]}]}));
});
test('rejects empty workflows, branches and excess steps or actions',()=>{
 assert.throws(()=>validate({...base,steps:[]}));
 assert.throws(()=>validate({...base,steps:[{...decision,yes:[],no:[]}]}));
 assert.throws(()=>validate({...base,steps:Array(11).fill(action)}));
 assert.throws(()=>validate({...base,steps:[{...decision,yes:Array(6).fill(move)}]}));
 assert.throws(()=>validate({...base,steps:Array(7).fill(decision)}));
});
test('supports empty alternate path and status change trigger',()=>{
 const f=validate({...base,trigger:{type:'field_changed',field_id:1},steps:[{...decision,no:[]}]});
 assert.deepEqual(f.trigger,{type:'field_changed',field_id:1});assert.deepEqual(f.steps[0].no,[]);
});
