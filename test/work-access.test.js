'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {roleFor,canBoard,redactRestrictedFields}=require('../lib/work-access');
const user={id:1,can_create:true,can_edit:true,can_delete:true};
const w={id:1,restricted:true},b={id:2,workspace_id:1,restricted:true};
test('restricted workspace and board require both grants and never escalate',()=>{
 assert.equal(roleFor(user,w,b,null,'manager'),'none');
 assert.equal(roleFor(user,w,b,'manager',null),'none');
 assert.equal(roleFor(user,w,b,'viewer','manager'),'viewer');
 assert.equal(roleFor(user,w,b,'editor','manager'),'editor');
 assert.equal(roleFor(user,w,b,'manager','viewer'),'viewer');
 assert.equal(roleFor({...user,is_admin:true},w,b,null,null),'manager');
});
test('shared scopes preserve global permissions; explicit role narrows access',()=>{
 assert.equal(roleFor(user,{...w,restricted:false},{...b,restricted:false},null,null),'manager');
 assert.equal(roleFor(user,{...w,restricted:false},{...b,restricted:false},'viewer',null),'viewer');
 assert.equal(roleFor(user,w,{...b,workspace_id:99},'manager','manager'),'none');
 assert.equal(canBoard({...user,can_delete:false},'manager','delete'),false);
 assert.equal(canBoard(user,'editor','delete'),false);
 assert.equal(canBoard(user,'viewer','create'),false);
 assert.equal(canBoard(user,'viewer','comment'),true);
 assert.equal(canBoard(user,'none','read'),false);
});
test('restricted relations redact IDs, lookup, rollup and field metadata',()=>{
 const fields=[{id:1,board_id:2,type:'relation',config:{target_board_id:9}},{id:2,board_id:2,type:'lookup',config:{relation_field_id:1,target_field_id:99}},{id:3,board_id:2,type:'rollup',config:{relation_field_id:1}},{id:4,board_id:2,type:'number',config:{}}];
 const result=redactRestrictedFields(fields,[{id:3,board_id:2,values:{1:[80],2:['secret'],3:100,4:7}}],new Set([2]));
 assert.deepEqual(result.items[0].values,{4:7});
 assert.deepEqual(result.fields[0].config,{restricted:true});
 assert.deepEqual(result.fields[1].config,{restricted:true});
 assert.deepEqual(result.fields[2].config,{restricted:true});
 assert.deepEqual(result.fields[3].config,{});
});
test('visible relationship data is retained',()=>{
 const fields=[{id:1,board_id:2,type:'relation',config:{target_board_id:9}}],items=[{id:3,board_id:2,values:{1:[80]}}];
 const result=redactRestrictedFields(fields,items,new Set([2,9]));assert.deepEqual(result.items,items);assert.deepEqual(result.fields,fields);
});
