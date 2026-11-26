'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalizeSchedule,nextDate,canManage,changesMetadata}=require('../lib/task-schedule');
test('weekly recurrence supports selected weekdays and wraparound',()=>{
 assert.deepEqual(normalizeSchedule('semanal',{weekdays:[5,1,1]},'2026-11-25'),{weekdays:[1,5]});
 assert.equal(nextDate('2026-11-25','semanal',{weekdays:[1,5]}),'2026-11-27');
 assert.equal(nextDate('2026-11-27','semanal',{weekdays:[1,5]}),'2026-11-30');
 assert.throws(()=>normalizeSchedule('semanal',{weekdays:[]},'2026-11-25'));
});
test('monthly and annual recurrences preserve requested day after shorter months',()=>{
 assert.equal(nextDate('2026-01-31','mensal',{day:31}),'2026-02-28');
 assert.equal(nextDate('2026-02-28','mensal',{day:31}),'2026-03-31');
 assert.equal(nextDate('2027-02-28','anual',{month:2,day:29}),'2028-02-29');
 assert.equal(nextDate('2026-11-25T00:00:00.000Z','anual',{month:12,day:15}),'2026-12-15');
 assert.throws(()=>normalizeSchedule('anual',{month:13,day:1},'2026-01-01'));
});
test('only creator and assignee may edit metadata; admin retains control',()=>{
 const member={id:2,can_edit:true},admin={id:1,is_admin:true};
 assert.equal(canManage(member,{created_by:1,assignee_id:2}),false);
 assert.equal(canManage(member,{created_by:2,assignee_id:3}),false);
 assert.equal(canManage(member,{created_by:null,assignee_id:2}),false);
 assert.equal(canManage(member,{created_by:2,assignee_id:2}),true);
 assert.equal(canManage(admin,{created_by:null,assignee_id:3}),true);
 assert.equal(changesMetadata({id:2,status:'concluída'}),false);
 assert.equal(changesMetadata({id:2,recurrence_config:{}}),true);
});
