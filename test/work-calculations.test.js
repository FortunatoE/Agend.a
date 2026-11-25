'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {computeItems,validateConfig}=require('../lib/work-calculations');
const fields=[
 {id:1,board_id:1,type:'relation',config:{target_board_id:2}},
 {id:2,board_id:1,type:'lookup',config:{relation_field_id:1,target_field_id:'title'}},
 {id:3,board_id:1,type:'rollup',config:{relation_field_id:1,target_field_id:4,aggregate:'sum'}},
 {id:4,board_id:2,type:'number'},
 {id:5,board_id:1,type:'number'},
 {id:6,board_id:1,type:'number'},
 {id:7,board_id:1,type:'formula',config:{left_field_id:5,right_field_id:6,operator:'*'}},
 {id:8,board_id:1,type:'rollup',config:{relation_field_id:1,target_field_id:'title',aggregate:'count'}}
];
const items=[
 {id:1,board_id:1,title:'Pedido',values:{1:[2,3,99,4,2],5:4,6:5}},
 {id:2,board_id:2,title:'Produto A',values:{4:10}},
 {id:3,board_id:2,title:'Produto B',values:{4:20}},
 {id:4,board_id:3,title:'Outro quadro',values:{4:1000}}
];
test('relations deduplicate and omit missing or unrelated records; computed values are not persisted',()=>{
 const values=computeItems(items,fields)[0].values;
 assert.deepEqual(values[1],[2,3]);assert.deepEqual(values[2],['Produto A','Produto B']);
 assert.equal(values[3],30);assert.equal(values[7],20);assert.equal(values[8],2);
 assert.equal(items[0].values[3],undefined);
});
test('formula division by zero or missing values returns null',()=>{
 const fs=fields.map(f=>f.id===7?{...f,config:{...f.config,operator:'/'}}:f);
 for(const b of [0,null])assert.equal(computeItems([{...items[0],values:{5:4,6:b}}],fs)[0].values[7],null);
});
test('formula rejects cross-board operands; lookup rejects calculated target',()=>{
 assert.throws(()=>validateConfig('formula',{left_field_id:5,right_field_id:4,operator:'+'},1,[],fields));
 assert.throws(()=>validateConfig('lookup',{relation_field_id:1,target_field_id:7},1,[],fields));
});
test('valid configuration is normalized; count requires no target field',()=>{
 assert.deepEqual(validateConfig('relation',{target_board_id:2,extra:true},1,[{id:2}],fields),{target_board_id:2});
 assert.deepEqual(validateConfig('rollup',{relation_field_id:1,aggregate:'count'},1,[],fields),{relation_field_id:1,target_field_id:'title',aggregate:'count'});
});
