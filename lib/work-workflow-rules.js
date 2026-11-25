'use strict';
const {normalizeRule}=require('./work-automation-rules');
function normalizeWorkflow(data,board,fields,groups,users){
 const name=typeof data.name==='string'?data.name.trim().slice(0,120):'';
 if(!name)throw Error('Informe o nome do fluxo.');
 const trigger=data.trigger||{};
 const basic=['text','number','date','checkbox','status','relation'];
 if(!['created','field_changed'].includes(trigger.type))throw Error('Gatilho inválido.');
 if(trigger.type==='field_changed'&&!fields.some(f=>f.id===trigger.field_id&&f.board_id===board&&basic.includes(f.type)))throw Error('Selecione um campo editável deste quadro.');
 const cleanTrigger=trigger.type==='created'?{type:'created'}:{type:'field_changed',field_id:trigger.field_id};
 if(!Array.isArray(data.steps)||!data.steps.length||data.steps.length>10)throw Error('Configure de 1 a 10 etapas.');
 let total=0;
 function effect(a){
 if(++total>20)throw Error('Limite de 20 ações por fluxo.');
 return normalizeRule({name,trigger:cleanTrigger,condition:{type:'always'},effect:a},board,fields,groups,users).effect;
 }
 function branch(actions){
 if(!Array.isArray(actions)||actions.length>5)throw Error('Cada caminho suporta até 5 ações.');
 return actions.map(effect);
 }
 const steps=data.steps.map(step=>{
 if(step?.type==='action')return {type:'action',effect:effect(step.effect)};
 if(step?.type==='condition'){
 if(!fields.some(f=>f.id===step.field_id&&f.board_id===board&&f.type==='status')||!['A fazer','Em andamento','Concluído'].includes(step.value))throw Error('Condição de status inválida.');
 const yes=branch(step.yes),no=branch(step.no);
 if(!yes.length&&!no.length)throw Error('Adicione uma ação em pelo menos um caminho.');
 return {type:'condition',field_id:step.field_id,value:step.value,yes,no};
 }
 throw Error('Etapa inválida.');
 });
 return {name,trigger:cleanTrigger,steps};
}
module.exports={normalizeWorkflow};
