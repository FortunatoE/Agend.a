/* Personal daily execution view; no team-wide counters, even for administrators. */
function myDayKey(value=new Date()){
 const d=value instanceof Date?value:new Date(value);if(!Number.isFinite(+d))return null;
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;
}
let dayRenderVersion=0,dayBusy=false;
function myDay(){
 const version=++dayRenderVersion,host=$('#myday'),D=AgendaDates,now=myDayKey(),mine=tasks.filter(t=>t.assignee_id!=null&&Number(t.assignee_id)===Number(current.id));
 const priority={alta:0,'média':1,normal:2,baixa:3};
 const sort=(a,b)=>(D.key(a.due_date)||'').localeCompare(D.key(b.due_date)||'')||(priority[a.priority]??9)-(priority[b.priority]??9)||a.title.localeCompare(b.title,'pt-BR');
 const late=mine.filter(t=>D.overdue(t,now)).sort(sort),due=mine.filter(t=>D.key(t.due_date)===now&&t.status!=='concluída').sort(sort),done=mine.filter(t=>t.status==='concluída'&&t.completed_at&&myDayKey(t.completed_at)===now).sort(sort),planned=mine.filter(t=>D.key(t.due_date)===now),plannedDone=planned.filter(t=>t.status==='concluída').length;
 const intro=node('div',undefined,'panel day-intro');intro.append(node('h2','O que preciso fazer hoje?'),node('p',due.length+' atividade(s) de hoje e '+late.length+' pendência(s) anterior(es).','sub'));
 const stats=node('div',undefined,'stats');let remindersCount;
 for(const [name,count,desc,icon] of [['Para hoje',due.length,'Aguardando execução','calendar'],['Atrasadas',late.length,'Prazos anteriores','alert'],['Concluídas hoje',done.length,'Horário real registrado','check'],['Comunicados pendentes','…','Recados e lembretes','bell']]){
 const card=node('div',undefined,'stat'),head=node('div',undefined,'ui-kpi-head'),value=node('strong',String(count));head.append(node('span',name),uiIcon(icon));card.append(head,value,node('em',desc));if(icon==='bell')remindersCount=value;stats.append(card)}
 const progress=node('div',undefined,'panel day-progress'),bar=node('progress');bar.max=Math.max(1,planned.length);bar.value=plannedDone;bar.setAttribute('aria-label','Progresso das atividades previstas para hoje');
 progress.append(node('h2','Progresso diário'),bar,node('p',plannedDone+' de '+planned.length+' atividades previstas para hoje concluídas.','sub'));
 function list(title,rows,kind){
 const panel=node('section',undefined,'panel day-list');const h=node('div',undefined,'day-list-head');h.append(uiIcon(kind==='late'?'alert':kind==='done'?'check':'calendar'),node('h2',title));panel.append(h);
 for(const t of rows){const row=node('article',undefined,'day-task'),info=node('div',undefined,'day-task-info');info.append(wsButton(t.title,()=>detail(t.id).catch(e=>toast(e.message,'error')),'day-task-title'),node('small',(t.area||'')+' · '+(t.recurrence||'Pontual')+' · '+(t.priority||'normal'),'sub'));
 if(t.description)info.append(node('p',t.description,'sub'));
 const meta=node('div',undefined,'day-task-meta');meta.append(node('span',kind==='done'?'Concluída às '+new Date(t.completed_at).toLocaleTimeString('pt-BR',{timeZone:'America/Cuiaba',hour:'2-digit',minute:'2-digit'}):'Prazo: '+fmt(t.due_date),'sub'));if(kind==='late')meta.append(node('span','Prazo vencido','tk-overdue'));
 if(kind!=='done'&&can('edit')){const b=wsButton('Concluir',async()=>{if(dayBusy)return;dayBusy=true;b.disabled=true;try{await api('/api/tasks',{method:'PATCH',body:JSON.stringify({id:t.id,status:'concluída'})});await load();toast('Conclusão registrada.','success')}catch(e){toast(e.message,'error');b.disabled=false}finally{dayBusy=false}},'plain');meta.append(b)}
 row.append(info,meta);panel.append(row)}
 if(!rows.length)panel.append(node('p',kind==='late'?'Nenhuma pendência anterior.':kind==='done'?'Nenhuma conclusão registrada hoje.':'Nenhuma atividade pendente para hoje.','empty'));return panel;
 }
 const comm=node('section',undefined,'panel day-list');comm.append(node('h2','Recados e lembretes'),node('p','Carregando…','sub'));
 host.replaceChildren(intro,stats,list('Pendências anteriores',late,'late'),list('Atividades de hoje',due,'today'),comm,progress,list('Concluídas hoje',done,'done'));
 api('/api/communication').then(s=>{
 if(version!==dayRenderVersion||view!=='myday')return;
 const messages=(s.received||[]).filter(c=>!c.done_at);remindersCount.textContent=String(messages.length);comm.replaceChildren(node('h2','Recados e lembretes'));
 for(const c of messages){const row=node('article',undefined,'day-task'),info=node('div',undefined,'day-task-info');info.append(node('b',c.title),node('small',c.kind==='lembrete'?'Lembrete':'Recado','sub'));if(c.seen_at)info.append(node('p',c.message||'','sub'));const b=wsButton(c.seen_at?'Feito':'Abrir comunicado',async()=>{b.disabled=true;try{await api('/api/communication',{method:'PATCH',body:JSON.stringify({id:c.id,action:c.seen_at?'done':'seen'})});myDay()}catch(e){toast(e.message,'error');b.disabled=false}},'plain');row.append(info,b);comm.append(row)}
 if(!messages.length)comm.append(node('p','Nenhum comunicado pendente.','empty'));
 }).catch(()=>{if(version!==dayRenderVersion||view!=='myday')return;remindersCount.textContent='—';comm.replaceChildren(node('h2','Recados e lembretes'),node('p','Não foi possível carregar os comunicados.','sub'),wsButton('Tentar novamente',myDay))});
}
