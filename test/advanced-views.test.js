'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../dist/analytics-core');
const items=[
{id:1,values:{1:'2026-11-01',2:'2026-11-03',3:'Ana',4:12,5:'Concluído',6:[]}},
{id:2,values:{1:'2026-11-03',2:'2026-11-04',3:'Ana',4:35,5:'Em andamento',6:[1,99]}},
{id:3,values:{1:'2026-11-06',2:'2026-11-05',3:'',4:null,5:'A fazer'}}
];
test('UTC date validation, leap years and monthly grid',()=>{
 assert.equal(A.dayIndex('2027-02-29'),null);
 assert.equal(A.iso(A.dayIndex('2028-02-29')),'2028-02-29');
 const grid=A.monthGrid(2026,10);assert.equal(grid.length,42);assert.equal(grid[0].date,'2026-11-01');assert.equal(grid.filter(x=>x.inMonth).length,30);
});
test('inclusive schedule and invalid date ranges',()=>{
 const s=A.schedule(items,1,2);assert.deepEqual(s.rows.map(r=>r.duration),[3,2]);assert.deepEqual(s.invalid.map(i=>i.id),[3]);
});
test('dependency warnings distinguish overlap and absent predecessor',()=>{
 const s=A.schedule(items,1,2);const w=A.dependencyWarnings(s.rows,6)[1];assert.deepEqual(w.conflicts,[1]);assert.deepEqual(w.missing,[99]);
});
test('workload measures overload, optional exclusion and missing effort',()=>{
 const all=A.workload(items,3,4,40,5,false);assert.equal(all.rows[0].effort,47);assert.equal(all.rows[0].utilization,117.5);assert.equal(all.missingEffort,1);
 const open=A.workload(items,3,4,40,5,true);assert.equal(open.rows[0].effort,35);assert.equal(open.rows[0].count,1);
 assert.equal(A.workload(items,3,'',2,5,false).rows[0].effort,2);
});
test('dashboard metrics ignore null and distinguish zero from empty',()=>{
 assert.equal(A.metric(items,4,'sum'),47);assert.equal(A.metric(items,4,'avg'),23.5);assert.equal(A.metric(items,4,'min'),12);assert.equal(A.metric(items,4,'max'),35);assert.equal(A.metric(items,5,'done'),1);assert.equal(A.metric([],4,'avg'),null);assert.equal(A.metric([],4,'sum'),0);assert.equal(A.metric(items,null,'count'),3);
});
