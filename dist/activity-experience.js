/* Personal activity authoring, weekly matrix and workspace management. */
function taskCanManage(t){return Boolean(current?.is_admin||current?.can_edit&&Number(t.assignee_id)===Number(current.id)&&t.created_by!=null&&Number(t.created_by)===Number(current.id))}
function manageSpace(space,isWorkspace){
 if(!current?.is_admin)return;
 const d=node('div',undefined,'dialog'),form=node('form',undefined,'form'),label=node('label','Nome'),input=node('input');input.value=space.name;input.required=true;input.maxLength=120;label.append(input);
 const save=node('button','Salvar','primary');save.type='submit';form.append(label,save,wsButton('Cancelar',closeModal));d.append(node('h2',isWorkspace?'Editar workspace':'Editar quadro'),form);
 form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{await api('/api/workspaces',{method:'PATCH',body:JSON.stringify({action:isWorkspace?'workspace_manage':'board_manage',id:space.id,name:input.value})});closeModal();await wsLoad();toast('Nome atualizado.','success')}catch(e){toast(e.message,'error')}finally{save.disabled=false}};
 $('#modal').replaceChildren(d);$('#modal').classList.add('open');
}
async function deleteWorkspace(space){
 if(!current?.is_admin)return;
 if(wsState.boards.some(b=>b.workspace_id===space.id))return toast('Exclusão bloqueada: este workspace possui quadros.','error');
 if(!confirm('Excluir o workspace vazio “'+space.name+'”?'))return;
 try{await api('/api/workspaces',{method:'DELETE',body:JSON.stringify({action:'workspace_manage',id:space.id,confirm:true})});wsId=null;boardId=null;await wsLoad();toast('Workspace excluído.','success')}catch(e){toast(e.message,'error')}
}
function setupRecurrence(form,config={}){
 const kind=form.querySelector('#recurrence'),due=form.querySelector('#dueDate'),host=node('div',undefined,'form');kind.closest('label').after(host);
 let read=()=>({}),initial=config;
 function draw(){
 host.replaceChildren();const k=kind.value,d=AgendaDates.key(due.value),date=d?new Date(d+'T00:00:00Z'):null;
 if(k==='semanal'){
 const group=node('fieldset');group.append(node('legend','Dias da semana'));const checks=[];
 for(const [i,label] of [[1,'Seg'],[2,'Ter'],[3,'Qua'],[4,'Qui'],[5,'Sex'],[6,'Sáb'],[0,'Dom']]){const wrap=node('label',undefined,'check'),c=node('input');c.type='checkbox';c.value=i;c.checked=(initial.weekdays||[date?.getUTCDay()??1]).includes(i);checks.push(c);wrap.append(c,document.createTextNode(label));group.append(wrap)}host.append(group);read=()=>({weekdays:checks.filter(c=>c.checked).map(c=>Number(c.value))});
 }else if(k==='mensal'||k==='anual'){
 const day=wsSelectOptions('Dia do mês',Array.from({length:31},(_,i)=>[i+1,String(i+1)]));day.sel.value=initial.day||date?.getUTCDate()||1;let month;
 if(k==='anual'){month=wsSelectOptions('Mês',Array.from({length:12},(_,i)=>[i+1,AgendaDates.format('2026-'+String(i+1).padStart(2,'0')+'-01',{month:'long'})]));month.sel.value=initial.month||(date?date.getUTCMonth()+1:1);host.append(month.wrap)}
 host.append(day.wrap,node('p','Em meses mais curtos, será usado o último dia do mês.','sub'));read=()=>({day:Number(day.sel.value),...(month?{month:Number(month.sel.value)}:{})});
 }else read=()=>({});
 if(k!=='não se repete')host.append(node('p','O prazo informado é a primeira ocorrência. A próxima será criada ao concluir a atual.','sub'));
 }
 kind.onchange=()=>{initial={};draw()};draw();return ()=>read();
}
function openActivityEditor(t=null){
 if(t?!taskCanManage(t):!can('create'))return toast('Você não tem permissão para editar esta atividade.','error');
 $('#modal').classList.remove('ui-drawer');$('#modal').innerHTML=taskModal();const form=$('#taskForm'),submit=form.querySelector('.primary');
 if(t){$('#modal h2').textContent='Editar atividade';submit.textContent='Salvar atividade';for(const [id,value] of [['title',t.title],['description',t.description],['areaSelect',t.area],['dueDate',AgendaDates.key(t.due_date)||''],['priority',t.priority],['recurrence',t.recurrence]])$('#'+id).value=value??'';$('#assignee').value=t.assignee_id??''}
 else $('#dueDate').value=AgendaDates.today();
 if(!current?.is_admin)$('#assignee').disabled=true;
 const schedule=setupRecurrence(form,t?.recurrence_config||{});
 $('#modal').classList.add('open');
 form.onsubmit=async e=>{e.preventDefault();if(submit.disabled)return;const recurrence_config=schedule();if($('#recurrence').value==='semanal'&&!recurrence_config.weekdays.length)return toast('Selecione pelo menos um dia da semana.','error');submit.disabled=true;try{const data={title:$('#title').value,description:$('#description').value,area:$('#areaSelect').value,assignee_id:Number($('#assignee').value),due_date:$('#dueDate').value,priority:$('#priority').value,recurrence:$('#recurrence').value,recurrence_config};if(t)data.id=t.id;await api('/api/tasks',{method:t?'PATCH':'POST',body:JSON.stringify(data)});closeModal();await load();toast('Atividade salva.','success')}catch(e){toast(e.message,'error')}finally{submit.disabled=false}};
}
function activityManagement(t){
 const host=$('#taskManage');if(!host)return;
 if(taskCanManage(t))host.append(wsButton('Editar atividade',()=>openActivityEditor(t)));
 else host.append(node('p','Atividade atribuída: dados protegidos. Você pode registrar andamento e conclusão conforme sua permissão.','sub'));
 if(current?.is_admin||taskCanManage(t)&&can('delete'))host.append(wsButton('Excluir atividade',async()=>{if(!confirm('Excluir esta atividade e seus detalhes?'))return;try{await api('/api/tasks',{method:'DELETE',body:JSON.stringify({id:t.id})});closeModal();await load();toast('Atividade excluída.','success')}catch(e){toast(e.message,'error')}},'ui-danger'));
}
let overviewWeek=null;
function weeklyOverview(host){
 const D=AgendaDates,now=D.today();overviewWeek=overviewWeek||D.weekStart(now);const start=overviewWeek,days=Array.from({length:7},(_,i)=>D.add(start,i));
 const panel=node('div',undefined,'panel'),controls=node('div',undefined,'tc-toolbar team-cal-controls'),scroll=node('div',undefined,'team-cal-scroll'),table=node('table',undefined,'team-cal-table overview-week-table');
 panel.append(node('h2',current?.is_admin?'Agenda semanal da equipe':'Minha agenda semanal'),node('p','Atividades cadastradas com prazo na semana.','sub'));
 const nav=(n)=>{overviewWeek=D.add(start,n*7);uiDashboard()},prev=wsButton('‹',()=>nav(-1)),next=wsButton('›',()=>nav(1));prev.setAttribute('aria-label','Semana anterior');next.setAttribute('aria-label','Próxima semana');
 controls.append(prev,next,wsButton('Hoje',()=>{overviewWeek=D.weekStart(now);uiDashboard()}),node('b',D.format(start,{day:'numeric',month:'short'})+' – '+D.format(days[6],{day:'numeric',month:'short',year:'numeric'})));
 const head=node('thead'),h=node('tr');for(const label of ['Atividade','Responsável','Situação','Notas']){const th=node('th',label);th.scope='col';h.append(th)}for(const k of days){const th=node('th',D.format(k,{weekday:'short',day:'2-digit',month:'2-digit'}));th.scope='col';if(k===now)th.classList.add('team-cal-today');h.append(th)}head.append(h);table.append(head);
 const body=node('tbody'),items=scoped().filter(t=>days.includes(D.key(t.due_date))).sort((a,b)=>String(a.assignee||'').localeCompare(String(b.assignee||''),'pt-BR')||a.title.localeCompare(b.title,'pt-BR'));
 for(const t of items){const tr=node('tr'),title=node('th');title.scope='row';title.append(wsButton(t.title,()=>detail(t.id).catch(e=>toast(e.message,'error')),'team-cal-task'),node('small',t.priority+' · '+t.recurrence,'sub'));tr.append(title,node('td',t.assignee||'Sem responsável'));const st=node('td');st.append(node('span',labels[t.status]||t.status,'badge'));tr.append(st,node('td',t.description||'—'));
 for(const day of days){const cell=node('td');if(day===now)cell.classList.add('team-cal-today');if(D.key(t.due_date)===day){const done=t.status==='concluída',late=D.overdue(t,now),label=done?'Concluída':late?'Atrasada':'Pendente',b=wsButton(done?'✓':late?'!':'·',()=>detail(t.id).catch(e=>toast(e.message,'error')),'team-cal-mark '+(done?'done':late?'late':'pending'));b.title=label;b.setAttribute('aria-label',t.title+' · '+day+' · '+label);cell.append(b)}else cell.append(node('span','–','team-cal-mark none'));tr.append(cell)}body.append(tr)}
 table.append(body);scroll.append(table);if(!items.length)scroll.append(node('p','Nenhuma atividade com prazo nesta semana.','empty'));panel.append(controls,scroll);host.append(panel);
}
