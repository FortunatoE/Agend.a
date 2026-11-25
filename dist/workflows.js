/* Workflow builder: ordered steps, with two conditional paths. */
function wsWorkflowPanel(host,board){
 host.replaceChildren();if(!current?.is_admin)return;
 host.append(node('h2','Workflows'),node('p','Combine ações e decisões em um fluxo automático. As etapas executam na ordem definida.','sub'));
 const fields=wsState.fields.filter(f=>f.board_id===board.id),groups=(wsState.groups||[]).filter(g=>g.board_id===board.id);
 const statusFields=fields.filter(f=>f.type==='status').map(f=>[f.id,f.name]),statuses=['A fazer','Em andamento','Concluído'].map(s=>[s,s]);
 const editable=fields.filter(f=>['text','number','date','checkbox','status','relation'].includes(f.type)).map(f=>[f.id,f.name]);
 const select=(parent,label,options)=>{const x=wsSelectOptions(label,options);parent.append(x.wrap);return x.sel};
 const input=(parent,label,max)=>{const l=node('label',label),x=node('input');x.required=true;x.maxLength=max;l.append(x);parent.append(l);return x};
 const builder=node('div',undefined,'panel'),form=node('form',undefined,'form');
 builder.append(node('h3','Novo fluxo'));host.append(builder);builder.append(form);
 const name=input(form,'Nome do fluxo',120),trigger=select(form,'Gatilho',[['created','Registro criado'],['field_changed','Campo alterado']]);
 const triggerHost=node('div');form.append(triggerHost);let readTrigger;
 function configTrigger(){triggerHost.replaceChildren();if(trigger.value==='created')readTrigger=()=>({type:'created'});else{const f=select(triggerHost,'Campo alterado',editable);readTrigger=()=>({type:'field_changed',field_id:Number(f.value)})}}
 trigger.onchange=configTrigger;configTrigger();
 const stepsHost=node('div',undefined,'form'),entries=[];form.append(stepsHost);
 function actionEditor(parent){
 const box=node('div',undefined,'form');parent.append(box);
 const kind=select(box,'Ação',[['set_status','Alterar status'],['move_group','Mover para grupo'],['create_item','Criar registro'],['notify','Notificar usuário']]),config=node('div',undefined,'form');box.append(config);let read;
 function configure(){config.replaceChildren();
 if(kind.value==='set_status'){const f=select(config,'Campo',statusFields),v=select(config,'Status',statuses);read=()=>({type:kind.value,field_id:Number(f.value),value:v.value})}
 else if(kind.value==='move_group'){const g=select(config,'Grupo',groups.map(g=>[g.id,g.name]));read=()=>({type:kind.value,group_id:Number(g.value)})}
 else if(kind.value==='create_item'){const t=input(config,'Título do novo registro',120);read=()=>({type:kind.value,title:t.value})}
 else{const u=select(config,'Usuário',team.map(u=>[u.id,u.name])),m=input(config,'Mensagem',500);read=()=>({type:kind.value,user_id:Number(u.value),message:m.value})}}
 kind.onchange=configure;configure();return {box,read:()=>read()};
 }
 function branch(parent,label){
 const box=node('div',undefined,'panel'),actions=node('div',undefined,'form'),entries=[];box.append(node('h4',label),actions);parent.append(box);
 box.append(wsButton('+ Ação',()=>{if(entries.length>=5)return toast('Limite de 5 ações por caminho.');const e=actionEditor(actions);entries.push(e);e.box.append(wsButton('Remover ação',()=>{entries.splice(entries.indexOf(e),1);e.box.remove()}))}));
 return ()=>entries.map(e=>e.read());
 }
 function refreshOrder(){entries.forEach((e,i)=>{e.heading.textContent='Etapa '+(i+1);e.up.disabled=i===0;e.down.disabled=i===entries.length-1;stepsHost.append(e.box)})}
 function addStep(){
 if(entries.length>=10)return toast('Limite de 10 etapas.');
 const box=node('div',undefined,'panel'),heading=node('h4'),controls=node('div',undefined,'actions'),kind=select(box,'Tipo de etapa',[['action','Ação'],['condition','Decisão de status']]),config=node('div',undefined,'form');box.prepend(heading);box.append(controls,config);const e={box,heading,read:null,up:null,down:null};
 e.up=wsButton('↑ Subir',()=>{const i=entries.indexOf(e);if(i>0){[entries[i-1],entries[i]]=[entries[i],entries[i-1]];refreshOrder()}});
 e.down=wsButton('↓ Descer',()=>{const i=entries.indexOf(e);if(i<entries.length-1){[entries[i],entries[i+1]]=[entries[i+1],entries[i]];refreshOrder()}});
 controls.append(e.up,e.down,wsButton('Remover etapa',()=>{entries.splice(entries.indexOf(e),1);box.remove();refreshOrder()}));
 function configure(){config.replaceChildren();if(kind.value==='action'){const a=actionEditor(config);e.read=()=>({type:'action',effect:a.read()})}else{const f=select(config,'Se o campo',statusFields),v=select(config,'For igual a',statuses),yes=branch(config,'SIM · ações'),no=branch(config,'NÃO · ações');e.read=()=>({type:'condition',field_id:Number(f.value),value:v.value,yes:yes(),no:no()})}}
 kind.onchange=configure;configure();entries.push(e);refreshOrder();
 }
 form.append(wsButton('+ Adicionar etapa',addStep));addStep();
 const save=node('button','Publicar fluxo','primary');save.type='submit';form.append(save);
 form.onsubmit=async e=>{e.preventDefault();if(!entries.length)return toast('Adicione uma etapa.');save.disabled=true;const ok=await wsWrite('POST',{action:'workflow',board_id:board.id,name:name.value,trigger:readTrigger(),steps:entries.map(e=>e.read())});if(!ok)save.disabled=false};
 const list=node('div',undefined,'panel');list.append(node('h3','Fluxos configurados'));host.append(list);
 const flows=(wsState.workflows||[]).filter(f=>f.board_id===board.id);
 const fieldName=id=>fields.find(f=>f.id===id)?.name||'Campo indisponível';
 const effectLabel=e=>e.type==='set_status'?'Alterar '+fieldName(e.field_id)+' para '+e.value:e.type==='move_group'?'Mover para '+(groups.find(g=>g.id===e.group_id)?.name||'Grupo indisponível'):e.type==='create_item'?'Criar '+e.title:'Enviar notificação';
 if(!flows.length)list.append(node('p','Nenhum fluxo configurado.','empty'));
 for(const f of flows){const row=node('div',undefined,'comment');row.append(node('b',f.name+' · '+(f.enabled?'Ativo':'Pausado')),node('p','Gatilho: '+(f.trigger_config.type==='created'?'Registro criado':fieldName(f.trigger_config.field_id)+' alterado'),'sub'));
 const steps=node('ol');for(const s of f.steps){const li=node('li',s.type==='action'?effectLabel(s.effect):'Se '+fieldName(s.field_id)+' = '+s.value);if(s.type==='condition'){li.append(node('p','Sim: '+(s.yes.map(effectLabel).join(' → ')||'Sem ação'),'sub'),node('p','Não: '+(s.no.map(effectLabel).join(' → ')||'Sem ação'),'sub'))}steps.append(li)}row.append(steps);
 const controls=node('div',undefined,'actions'),toggle=wsButton(f.enabled?'Pausar':'Ativar',async()=>{toggle.disabled=true;await wsWrite('PATCH',{action:'workflow',id:f.id,enabled:!f.enabled})});controls.append(toggle,wsButton('Excluir',()=>{if(confirm('Excluir o fluxo? O histórico será preservado.'))wsWrite('DELETE',{action:'workflow',id:f.id})}));row.append(controls);list.append(row)}
 const history=node('div',undefined,'panel');history.append(node('h3','Histórico de execução'));host.append(history);
 const runs=(wsState.workflowRuns||[]).filter(r=>r.board_id===board.id);
 if(!runs.length)history.append(node('p','Nenhuma execução registrada.','empty'));
 for(const r of runs){const row=node('div',undefined,'comment');row.append(node('b',r.workflow_name+' · '+(r.result==='success'?'Sucesso':'Falha — ações revertidas')),node('small',new Date(r.created_at).toLocaleString('pt-BR')+' · Registro '+(r.item_id??'excluído')));for(const t of r.trace||[])row.append(node('p','Etapa '+t.step+' · '+t.detail,'sub'));history.append(row)}
}
