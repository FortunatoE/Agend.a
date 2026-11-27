'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../lib/microsoft-todo-core');
const env={MS_TODO_TENANT_ID:'11111111-1111-1111-1111-111111111111',MS_TODO_CLIENT_ID:'22222222-2222-2222-2222-222222222222',MS_TODO_CLIENT_SECRET:'test-only',MS_TODO_ENCRYPTION_KEY:'11'.repeat(32),MS_TODO_REDIRECT_URI:'https://example.com/api/tasks?microsoft=callback'};
test('Microsoft OAuth requires a fixed organizational tenant and secure callback',()=>{
 const c=C.config(env);assert.ok(c);
 assert.equal(C.config({...env,MS_TODO_TENANT_ID:'common'}),null);
 assert.equal(C.config({...env,MS_TODO_REDIRECT_URI:'http://example.com/api/tasks?microsoft=callback'}),null);
 assert.equal(C.config({...env,MS_TODO_ENCRYPTION_KEY:'bad'}),null);
 const state=C.random(),verifier=C.random(),u=new URL(C.authUrl(c,state,verifier));
 assert.equal(u.origin,'https://login.microsoftonline.com');assert.equal(u.searchParams.get('state'),state);assert.equal(u.searchParams.get('code_challenge'),C.challenge(verifier));assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.ok(u.searchParams.get('scope').includes('Tasks.ReadWrite'));assert.ok(!u.searchParams.has('client_secret'));
});
test('encrypted credentials are randomized and bound to account context',()=>{
 const c=C.config(env),a=C.seal('refresh-secret',c,'user:1'),b=C.seal('refresh-secret',c,'user:1');
 assert.notEqual(a,b);assert.equal(C.unseal(a,c,'user:1'),'refresh-secret');assert.throws(()=>C.unseal(a,c,'user:2'));assert.throws(()=>C.unseal(a,{...c,key:Buffer.alloc(32,9)},'user:1'));
});
test('Graph refuses external destinations and safely encodes provider IDs',()=>{
 assert.equal(C.graphUrl('me/todo/lists'),'https://graph.microsoft.com/v1.0/me/todo/lists');
 assert.throws(()=>C.graphUrl('https://example.com/v1.0/me'));assert.throws(()=>C.graphUrl('https://graph.microsoft.com/beta/me'));
 assert.ok(C.taskPath('x/y','a?b').includes('x%2Fy/tasks/a%3Fb'));
});
test('Graph collection pagination never leaks credentials to another origin',async()=>{
 let n=0;await assert.rejects(()=>C.collection('fake','me/todo/lists',async()=>{n++;return new Response(JSON.stringify({value:[], '@odata.nextLink':'https://example.com/v1.0/me'}),{status:200})}));assert.equal(n,1);
});
test('task payload contains minimal metadata and no remote recurrence or description',()=>{
 const t={id:1,title:'Conferir estoque',description:'segredo',due_date:'2026-11-27T00:00:00Z',priority:'alta',status:'todo',recurrence:'diária'};
 const p=C.payload(t,'opaque');assert.equal(p.status,'notStarted');assert.equal(p.importance,'high');assert.equal(p.dueDateTime.dateTime,'2026-11-27T12:00:00');assert.equal(p.body.content,C.markerText('opaque'));assert.ok(!JSON.stringify(p).includes('segredo'));assert.ok(!Object.hasOwn(p,'recurrence'));
});
test('remote completion is accepted only for unchanged open status and editable owner',()=>{
 const remote={status:'completed'},m={last_status:'todo'};
 assert.equal(C.shouldImport({status:'todo'},m,remote,true),true);
 assert.equal(C.shouldImport({status:'andamento'},m,remote,true),false);
 assert.equal(C.shouldImport({status:'todo'},m,remote,false),false);
 assert.equal(C.shouldImport({status:'todo'},{last_status:'concluída'},remote,true),false);
});
