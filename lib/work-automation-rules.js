'use strict';
function normalizeRule(data,board,fields,groups,users){
 const positive=v=>Number.isSafeInteger(v)&&v>0;
 const status=['A fazer','Em andamento','Concluído'];
 const field=(id,type)=>positive(id)&&fields.some(f=>f.id===id&&f.board_id===board&&(!type||f.type===type));
 const name=typeof data.name==='string'?data.name.trim().slice(0,120):'';
 const trigger=data.trigger||{},condition=data.condition||{},action=data.effect||{};
 if(!name)throw Error('Informe o nome da automação.');
 if(!['created','field_changed'].includes(trigger.type))throw Error('Gatilho inválido.');
 if(trigger.type==='field_changed'&&(!field(trigger.field_id)||!fields.some(f=>f.id===trigger.field_id&&['text','number','date','checkbox','status','relation'].includes(f.type))))throw Error('Selecione um campo editável do quadro.');
 if(!['always','status_equals'].includes(condition.type))throw Error('Condição inválida.');
 if(condition.type==='status_equals'&&(trigger.type==='created'||!field(condition.field_id,'status')||!status.includes(condition.value)))throw Error('Selecione um status válido para a condição.');
 let effect;
 if(action.type==='set_status'){
 if(!field(action.field_id,'status')||!status.includes(action.value))throw Error('Selecione o campo e o novo status.');
 effect={type:action.type,field_id:action.field_id,value:action.value};
 }else if(action.type==='move_group'){
 if(!positive(action.group_id)||!groups.some(g=>g.id===action.group_id&&g.board_id===board))throw Error('Selecione um grupo do quadro.');
 effect={type:action.type,group_id:action.group_id};
 }else if(action.type==='create_item'){
 const title=typeof action.title==='string'?action.title.trim().slice(0,120):'';
 if(!title)throw Error('Informe o título do novo registro.');
 effect={type:action.type,title};
 }else if(action.type==='notify'){
 if(!positive(action.user_id)||!users.some(u=>u.id===action.user_id))throw Error('Selecione um usuário ativo.');
 const message=typeof action.message==='string'?action.message.trim().slice(0,500):'';
 if(!message)throw Error('Informe a mensagem.');
 effect={type:action.type,user_id:action.user_id,message};
 }else throw Error('Ação inválida.');
 return {name,trigger:trigger.type==='created'?{type:'created'}:{type:'field_changed',field_id:trigger.field_id},condition:condition.type==='always'?{type:'always'}:{type:'status_equals',field_id:condition.field_id,value:condition.value},effect};
}
module.exports={normalizeRule};
