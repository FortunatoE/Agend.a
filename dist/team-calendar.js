/* Monthly management matrix: actual task due dates, not inferred occurrences. */
function renderTaskReassign(task){
 const host=$('#taskReassign');if(!host||!current?.is_admin)return;
 const members=assignees(),sel=wsSelectOptions('Vincular responsável',[['','Selecione um usuário'],...members.map(u=>[u.id,u.name+' (#'+u.id+')'])]);sel.sel.value=task.assignee_id??'';
 const save=wsButton('Salvar responsável',async()=>{if(!sel.sel.value)return toast('Selecione um responsável.','error');save.disabled=true;try{await api('/api/tasks',{method:'PATCH',body:JSON.stringify({id:task.id,assignee_id:Number(sel.sel.value)})});await load();await detail(task.id);toast('Responsável atualizado.','success')}catch(e){toast(e.message,'error')}finally{save.disabled=false}},'plain');
 host.append(sel.wrap,save);
}
let teamCalendarPerson='',teamCalendarQuery='';
function teamCalendar(){
 if(!current?.is_admin){calendarMode='mensal';legacyCalendar();return}
 const D=AgendaDates,host=$('#calendar'),now=D.today();taskCalendarAnchor=taskCalendarAnchor||now;
 const anchor=taskCalendarAnchor,month=anchor.slice(0,7),first=month+'-01',days=D.monthDays(first).filter(x=>x.inMonth).map(x=>x.key),tabs=node('div',undefined,'tabs');
 for(const [mode,label] of [['equipe','Equipe · mensal'],['anual','Anual'],['mensal','Mensal'],['semanal','Semanal'],['diário','Diário']])tabs.append(wsButton(label,()=>setCalendar(mode),'tab '+(mode===calendarMode?'active':'')));
 const heading=node('div',undefined,'team-cal-heading');heading.append(node('h2','Acompanhamento da equipe'),node('p','Prazos e situação das atividades reais no mês selecionado. Cada linha representa uma atividade cadastrada.','sub'));
 const stats=node('div',undefined,'stats'),panel=node('div',undefined,'panel'),controls=node('div',undefined,'tc-toolbar team-cal-controls'),tableWrap=node('div',undefined,'team-cal-scroll');
 const nav=n=>{taskCalendarAnchor=D.shift(anchor,'mensal',n);teamCalendar()};
 const prev=wsButton('‹',()=>nav(-1)),next=wsButton('›',()=>nav(1));prev.setAttribute('aria-label','Mês anterior');next.setAttribute('aria-label','Próximo mês');
 const search=node('input');search.type='search';search.placeholder='Buscar atividade…';search.value=teamCalendarQuery;search.setAttribute('aria-label','Buscar atividade');
 const all=scoped(),people=[...new Map([...assignees().map(u=>[String(u.id),u.name]),...all.filter(t=>t.assignee_id!=null).map(t=>[String(t.assignee_id),t.assignee])]).entries()].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR'));
 const person=wsSelectOptions('Responsável',[['','Todos os membros'],['unlinked','Sem vínculo'],...people]);person.sel.value=teamCalendarPerson;if(person.sel.selectedIndex<0)person.sel.value='';
 controls.append(prev,node('h2',D.format(first,{month:'long',year:'numeric'}),'tc-title'),next,wsButton('Hoje',()=>{taskCalendarAnchor=now;teamCalendar()}),search,person.wrap);
 const exportButton=wsButton('Exportar CSV',()=>{const rows=filtered();const csv=AgendaExchange.encodeCSV(['Atividade','Responsável','Situação','Notas',...days],rows.map(t=>[t.title,t.assignee,labels[t.status]||t.status,t.description||'',...days.map(k=>D.key(t.due_date)===k?status(t).label:'')]));const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='agenda-equipe-'+month+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)},'plain');controls.append(exportButton);
 function filtered(){const q=search.value.trim().toLocaleLowerCase('pt-BR');return all.filter(t=>D.key(t.due_date)?.slice(0,7)===month&&(!person.sel.value||(person.sel.value==='unlinked'?t.assignee_id==null:String(t.assignee_id)===person.sel.value))&&(!q||[t.title,t.assignee,t.description].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(q)))).sort((a,b)=>String(a.assignee).localeCompare(String(b.assignee),'pt-BR')||a.title.localeCompare(b.title,'pt-BR')||a.id-b.id)}
 function status(t){return t.status==='concluída'?{key:'done',symbol:'✓',label:'Concluída'}:D.overdue(t,now)?{key:'late',symbol:'!',label:'Atrasada'}:{key:'pending',symbol:'·',label:'Pendente'}}
 function draw(){const rows=filtered();stats.replaceChildren();for(const [label,value,cls,desc] of [['Atividades cadastradas',rows.length,'all','No mês e filtros selecionados'],['Concluídas',rows.filter(t=>status(t).key==='done').length,'done','Atividades com prazo neste mês'],['Atrasadas',rows.filter(t=>status(t).key==='late').length,'late','Prazo vencido e não concluída'],['Pendentes',rows.filter(t=>status(t).key==='pending').length,'pending','Prazo atual ou futuro']]){
 const card=node('div',undefined,'stat team-cal-stat '+cls);card.append(node('span',label),node('strong',String(value)),node('em',desc));stats.append(card)}
 const table=node('table',undefined,'team-cal-table'),thead=node('thead'),tr=node('tr');for(const h of ['Atividade','Responsável','Situação','Notas']){const th=node('th',h);th.scope='col';tr.append(th)}
 for(const day of days){const th=node('th',String(Number(day.slice(-2))));th.scope='col';th.title=D.format(day,{weekday:'long',day:'numeric',month:'long'});if(day===now)th.classList.add('team-cal-today');tr.append(th)}thead.append(tr);table.append(thead);const body=node('tbody');
 for(const t of rows){const tr=node('tr'),title=node('th');title.scope='row';title.append(wsButton(t.title,()=>detail(t.id).catch(e=>toast(e.message,'error')),'team-cal-task'),node('small',(t.priority||'normal')+' · '+(t.recurrence||'não se repete'),'sub'));tr.append(title,node('td',(t.assignee||'Sem responsável')+(t.assignee_id==null?' (sem vínculo)':'')));
 const state=node('td');state.append(node('span',labels[t.status]||t.status,'badge'));tr.append(state);const notes=node('td',t.description||'—');notes.title=t.description||'';tr.append(notes);
 for(const day of days){const td=node('td');if(day===now)td.classList.add('team-cal-today');if(D.key(t.due_date)===day){const st=status(t),b=wsButton(st.symbol,()=>detail(t.id).catch(e=>toast(e.message,'error')),'team-cal-mark '+st.key);b.setAttribute('aria-label',t.title+' · '+day+' · '+st.label);b.title=st.label;td.append(b)}else{const span=node('span','–','team-cal-mark none');span.setAttribute('aria-label','Sem atividade prevista');td.append(span)}tr.append(td)}body.append(tr)}
 table.append(body);tableWrap.replaceChildren(table);if(!rows.length)tableWrap.append(node('p','Nenhuma atividade com prazo neste mês para os filtros selecionados.','empty'));exportButton.disabled=!rows.length;
 }
 search.oninput=()=>{teamCalendarQuery=search.value;draw()};person.sel.onchange=()=>{teamCalendarPerson=person.sel.value;draw()};
 const legend=node('div',undefined,'team-cal-legend');for(const [cls,label] of [['done','✓ Concluída'],['late','! Atrasada'],['pending','· Pendente'],['none','– Sem prazo neste dia']])legend.append(node('span',label,'team-cal-mark '+cls));
 panel.append(controls,tableWrap);host.replaceChildren(tabs,heading,stats,legend,panel);draw();
}
