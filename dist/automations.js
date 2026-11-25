/* Admin-only board automation editor. Uses the same API/session as the workspace. */
function wsAutomationPanel(host,board){
 host.replaceChildren();
 if(!current?.is_admin)return;
 host.append(node('h2','Automações do quadro'),node('p','Crie regras para executar ações automaticamente quando registros forem criados ou editados.','sub'));
 const rules=(wsState.automations||[]).filter(a=>a.board_id===board.id);
 const fields=wsState.fields.filter(f=>f.board_id===board.id);
 const groups=(wsState.groups||[]).filter(g=>g.board_id===board.id);
 const fieldName=id=>fields.find(f=>f.id===id)?.name||'Campo indisponível';
 const groupName=id=>groups.find(g=>g.id===id)?.name||'Grupo indisponível';
 const statusFields=fields.filter(f=>f.type==='status').map(f=>[f.id,f.name]);
 const editable=fields.filter(f=>['text','number','date','checkbox','status','relation'].includes(f.type)).map(f=>[f.id,f.name]);
 const statuses=['A fazer','Em andamento','Concluído'].map(s=>[s,s]);
 const users=team.map(u=>[u.id,u.name]);
 const form=node('form',undefined,'form'),builder=node('div',undefined,'panel');
 builder.append(node('h3','Nova automação'));
 const name=node('input');name.placeholder='Ex.: Encaminhar para revisão';name.required=true;name.maxLength=120;form.append(name);
 const select=(host,label,options)=>{const x=wsSelectOptions(label,options);host.append(x.wrap);return x.sel};
 const when=select(form,'QUANDO',[['created','Um registro for criado'],['field_changed','Um campo for alterado']]);
 const triggerHost=node('div',undefined,'form'),conditionHost=node('div',undefined,'form'),effectHost=node('div',undefined,'form');
 form.append(triggerHost,conditionHost);
 const action=select(form,'ENTÃO',[['set_status','Alterar status'],['move_group','Mover para grupo'],['create_item','Criar registro neste quadro'],['notify','Enviar notificação interna']]);
 form.append(effectHost);
 let readTrigger,readCondition,readEffect;
 function configureTrigger(){
 triggerHost.replaceChildren();conditionHost.replaceChildren();
 if(when.value==='field_changed'){
 const field=select(triggerHost,'Campo alterado',editable);
 readTrigger=()=>({type:'field_changed',field_id:Number(field.value)});
 const condition=select(conditionHost,'SE',[['always','Sem condição'],['status_equals','Status for igual a']]);
 const detail=node('div',undefined,'form');conditionHost.append(detail);
 const configure=()=>{detail.replaceChildren();if(condition.value==='always'){readCondition=()=>({type:'always'});return}const f=select(detail,'Campo status',statusFields),v=select(detail,'Valor',statuses);readCondition=()=>({type:'status_equals',field_id:Number(f.value),value:v.value})};
 condition.onchange=configure;configure();
 }else{readTrigger=()=>({type:'created'});readCondition=()=>({type:'always'});conditionHost.append(node('p','SE: sem condição','sub'))}
 }
 function configureEffect(){effectHost.replaceChildren();
 if(action.value==='set_status'){const f=select(effectHost,'Campo status',statusFields),v=select(effectHost,'Novo status',statuses);readEffect=()=>({type:'set_status',field_id:Number(f.value),value:v.value})}
 else if(action.value==='move_group'){const g=select(effectHost,'Grupo de destino',groups.map(g=>[g.id,g.name]));readEffect=()=>({type:'move_group',group_id:Number(g.value)})}
 else if(action.value==='create_item'){const t=node('input');t.placeholder='Título do novo registro';t.required=true;t.maxLength=120;effectHost.append(t);readEffect=()=>({type:'create_item',title:t.value})}
 else{const u=select(effectHost,'Destinatário',users),m=node('textarea');m.placeholder='Mensagem da notificação';m.required=true;m.maxLength=500;effectHost.append(m);readEffect=()=>({type:'notify',user_id:Number(u.value),message:m.value})}
 }
 when.onchange=configureTrigger;action.onchange=configureEffect;configureTrigger();configureEffect();
 const save=node('button','Criar automação','primary');save.type='submit';form.append(save);builder.append(form);host.append(builder);
 form.onsubmit=async e=>{e.preventDefault();save.disabled=true;const ok=await wsWrite('POST',{action:'automation',board_id:board.id,name:name.value,trigger:readTrigger(),condition:readCondition(),effect:readEffect()});if(!ok)save.disabled=false};
 const panel=node('div',undefined,'panel');panel.append(node('h3','Regras configuradas'));
 if(!rules.length)panel.append(node('p','Nenhuma automação criada.','empty'));
 for(const rule of rules){const t=rule.trigger_config,c=rule.condition_config,a=rule.effect_config,row=node('div',undefined,'comment');
 row.append(node('b',rule.name+(rule.enabled?' · Ativa':' · Pausada')));
 const trigger=t.type==='created'?'registro criado':'alterar '+fieldName(t.field_id);
 const condition=c.type==='always'?'sem condição':fieldName(c.field_id)+' = '+c.value;
 const effect=a.type==='set_status'?'Definir '+fieldName(a.field_id)+' como '+a.value:a.type==='move_group'?'Mover para '+groupName(a.group_id):a.type==='create_item'?'Criar '+a.title:'Notificar usuário';
 row.append(node('p','Quando '+trigger+' · Se '+condition+' · Então '+effect,'sub'));
 const controls=node('div',undefined,'actions');
 const toggle=wsButton(rule.enabled?'Pausar':'Ativar',async()=>{toggle.disabled=true;await wsWrite('PATCH',{action:'automation',id:rule.id,enabled:!rule.enabled})});
 controls.append(toggle,wsButton('Excluir',()=>{if(confirm('Excluir esta regra? O histórico será preservado.'))wsWrite('DELETE',{action:'automation',id:rule.id})}));row.append(controls);panel.append(row)}
 host.append(panel);
 const history=node('div',undefined,'panel');history.append(node('h3','Histórico recente'));
 const runs=(wsState.automationRuns||[]).filter(run=>run.board_id===board.id);
 if(!runs.length)history.append(node('p','Nenhuma execução registrada.','empty'));
 for(const run of runs){const row=node('div',undefined,'comment');row.append(node('b',run.rule_name+' · '+(run.result==='success'?'Sucesso':'Falha')),node('p',run.detail+' · Registro '+(run.item_id??'excluído'),'sub'),node('small',new Date(run.created_at).toLocaleString('pt-BR')));history.append(row)}host.append(history);
}
