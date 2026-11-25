'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeRule}=require('../lib/work-automation-rules');
const fields=[{id:1,board_id:1,type:'status'},{id:2,board_id:1,type:'formula'},{id:3,board_id:2,type:'status'}];
const groups=[{id:1,board_id:1},{id:2,board_id:2}];
const users=[{id:7}];
const base={name:'  Mover  ',trigger:{type:'field_changed',field_id:1},condition:{type:'status_equals',field_id:1,value:'Concluído'},effect:{type:'move_group',group_id:1}};
const normalize=d=>normalizeRule(d,1,fields,groups,users);
test('normalizes valid rules and strips extra data',()=>{assert.equal(normalize({...base,extra:true}).name,'Mover');assert.deepEqual(normalize(base).effect,{type:'move_group',group_id:1})});
test('rejects other board fields and groups and calculated triggers',()=>{
 assert.throws(()=>normalize({...base,trigger:{type:'field_changed',field_id:2}}));
 assert.throws(()=>normalize({...base,trigger:{type:'field_changed',field_id:3}}));
 assert.throws(()=>normalize({...base,effect:{type:'move_group',group_id:2}}));
 assert.throws(()=>normalize({...base,effect:{type:'set_status',field_id:3,value:'Concluído'}}));
});
test('supports creation and internal notification, rejects missing recipient',()=>{
 assert.deepEqual(normalize({...base,trigger:{type:'created'},condition:{type:'always'},effect:{type:'create_item',title:'Nova tarefa'}}).effect,{type:'create_item',title:'Nova tarefa'});
 assert.equal(normalize({...base,effect:{type:'notify',user_id:7,message:'Pronto'}}).effect.user_id,7);
 assert.throws(()=>normalize({...base,effect:{type:'notify',user_id:8,message:'Pronto'}}));
 assert.throws(()=>normalize({...base,trigger:{type:'created'}}));
});
test('rejects invalid statuses, unknown actions, empty titles and nonnumeric IDs',()=>{
 assert.throws(()=>normalize({...base,condition:{type:'status_equals',field_id:1,value:'Outro'}}));
 assert.throws(()=>normalize({...base,effect:{type:'create_item',title:'  '}}));
 assert.throws(()=>normalize({...base,effect:{type:'webhook'}}));
 assert.throws(()=>normalize({...base,effect:{type:'move_group',group_id:'1'}}));
});
