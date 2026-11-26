/* Legacy task calendar and Kanban — separate from dynamic Boards. */
let taskCalendarAnchor=null,taskDragId=null,taskMovePending=false;
function legacyCalendar(){
 if(calendarMode==='equipe'&&current?.is_admin)return teamCalendar();
 if(calendarMode==='equipe')calendarMode='mensal';
 const D=AgendaDates,host=$('#calendar'),now=D.today();taskCalendarAnchor=taskCalendarAnchor||now;
 const anchor=taskCalendarAnchor,{byDay,missing}=D.index(scoped()),tabs=node('div',undefined,'tabs'),panel=node('div',undefined,'panel'),toolbar=node('div',undefined,'tc-toolbar');
 const modes=[...(current?.is_admin?[['equipe','Equipe · mensal']]:[]),['anual','Anual'],['mensal','Mensal'],['semanal','Semanal'],['diário','Diário']];
 for(const [m,label] of modes)tabs.append(wsButton(label,()=>setCalendar(m),'tab '+(m===calendarMode?'active':'')));
 const nav=(delta)=>{taskCalendarAnchor=D.shift(anchor,calendarMode,delta);legacyCalendar()};
 const prev=wsButton('‹',()=>nav(-1)),next=wsButton('›',()=>nav(1));prev.setAttribute('aria-label','Período anterior');next.setAttribute('aria-label','Próximo período');
 const start=D.weekStart(anchor);
 const title=calendarMode==='anual'?anchor.slice(0,4):calendarMode==='mensal'?D.format(anchor,{month:'long',year:'numeric'}):calendarMode==='semanal'?D.format(start,{day:'numeric',month:'short'})+' – '+D.format(D.add(start,6),{day:'numeric',month:'short',year:'numeric'}):D.format(anchor,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
 toolbar.append(prev,next,wsButton('Hoje',()=>{taskCalendarAnchor=now;legacyCalendar()}),node('h2',title,'tc-title'));
 const picker=node('input');picker.type='date';picker.value=anchor;picker.setAttribute('aria-label','Ir para data');picker.onchange=()=>{if(D.key(picker.value)){taskCalendarAnchor=picker.value;legacyCalendar()}};toolbar.append(picker);panel.append(toolbar);
 const weekdays=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
 const openDay=k=>{taskCalendarAnchor=k;calendarMode='diário';legacyCalendar()};
 function event(t,full=false){
 const b=wsButton(t.title,()=>detail(t.id).catch(e=>toast(e.message)),'tc-event '+(t.status==='concluída'?'tc-done':D.overdue(t,now)?'tc-late':t.priority==='alta'?'tc-priority':''));
 b.title=t.title+' · '+(labels[t.status]||t.status)+' · '+(t.assignee||'Sem responsável');
 if(full){b.append(node('small',(t.area||'')+' · '+(t.assignee||'Sem responsável')+' · '+(labels[t.status]||t.status)))}
 return b;
 }
 function month(k,mini=false){
 const grid=node('div',undefined,'tc-grid'+(mini?' tc-mini':''));
 for(const w of weekdays)grid.append(node('div',mini?w.slice(0,1):w,'tc-weekday'));
 for(const d of D.monthDays(k)){
 const cell=node('div',undefined,'tc-cell'+(!d.inMonth?' tc-other':'')+(d.key===now?' tc-today':''));
 const n=wsButton(String(Number(d.key.slice(-2))),()=>openDay(d.key),'tc-day');n.setAttribute('aria-label',D.format(d.key,{day:'numeric',month:'long',year:'numeric'}));cell.append(n);
 const items=byDay.get(d.key)||[];
 if(mini){if(d.inMonth&&items.length){n.classList.add('tc-has');n.title=items.length+' atividade(s)';cell.append(node('span',String(items.length),'tc-mini-count'))}}
 else{for(const t of items.slice(0,3))cell.append(event(t));if(items.length>3)cell.append(wsButton('+'+(items.length-3)+' atividades',()=>openDay(d.key),'tc-more'))}
 grid.append(cell);
 }return grid;
 }
 if(calendarMode==='anual'){
 const year=node('div',undefined,'tc-year');for(let i=1;i<=12;i++){
 const k=anchor.slice(0,4)+'-'+String(i).padStart(2,'0')+'-01',tile=node('div',undefined,'tc-month');
 const count=[...byDay].filter(([d])=>d.slice(0,7)===k.slice(0,7)).reduce((a,[,list])=>a+list.length,0);
 const head=node('div',undefined,'tc-month-head');head.append(wsButton(D.format(k,{month:'long'}),()=>{taskCalendarAnchor=k;calendarMode='mensal';legacyCalendar()},'tc-month-link'),node('span',count+' ativ.','sub'));tile.append(head,month(k,true));year.append(tile);
 }panel.append(year);
 }else if(calendarMode==='mensal'){const scroll=node('div',undefined,'tc-scroll');scroll.append(month(anchor));panel.append(scroll)}
 else if(calendarMode==='semanal'){const scroll=node('div',undefined,'tc-scroll'),grid=node('div',undefined,'tc-grid tc-week');for(let i=0;i<7;i++){const k=D.add(start,i);grid.append(node('div',weekdays[i]+' '+D.format(k,{day:'2-digit',month:'2-digit'}),'tc-weekday'+(k===now?' tc-today':'')))}
 for(let i=0;i<7;i++){const k=D.add(start,i),cell=node('div',undefined,'tc-cell'+(k===now?' tc-today':'')),items=byDay.get(k)||[];cell.append(wsButton('Ver dia',()=>openDay(k),'tc-more'));for(const t of items)cell.append(event(t,true));if(!items.length)cell.append(node('p','Sem atividades','sub'));grid.append(cell)}scroll.append(grid);panel.append(scroll)}
 else{const list=node('div',undefined,'tc-agenda'),items=byDay.get(anchor)||[];list.append(node('p',items.length+' atividade(s) com prazo neste dia.','sub'));for(const t of items)list.append(event(t,true));if(!items.length)list.append(node('div','Nenhuma atividade prevista.','empty'));panel.append(list)}
 const legend=node('div',undefined,'tc-legend');for(const [cls,label] of [['','Atividade'],['tc-done','Concluída'],['tc-late','Atrasada'],['tc-priority','Prioridade alta']])legend.append(node('span',label,'tc-event '+cls));panel.append(legend);
 if(missing.length){const info=node('details');info.append(node('summary',missing.length+' atividade(s) sem prazo válido'));for(const t of missing)info.append(event(t,true));panel.append(info)}
 host.replaceChildren(tabs,panel);
}
async function moveLegacyTask(id,status){
 if(!can('edit')||taskMovePending||!statuses.includes(status))return;
 const t=tasks.find(t=>Number(t.id)===Number(id));if(!t||t.status===status)return;
 taskMovePending=true;
 try{const result=await api('/api/tasks',{method:'PATCH',body:JSON.stringify({id:t.id,status})});tasks=tasks.map(x=>x.id===t.id?{...x,...result}:x);if(result.generated&&!tasks.some(x=>x.id===result.generated.id))tasks.push(result.generated);toast(result.generated?'Rotina concluída e próxima ocorrência criada.':'Status atualizado.');try{await load()}catch(e){render();toast('Status salvo; não foi possível atualizar todos os dados.')}}catch(e){toast(e.message)}finally{taskMovePending=false;if(view==='kanban')legacyKanban()}
}
let showPastRoutines=false;
function legacyKanban(){
 const host=$('#kanban'),panel=node('div',undefined,'panel'),board=node('div',undefined,'board tk-board'),editable=can('edit');
 panel.append(node('h2','Fluxo de trabalho'),node('p',editable?'Arraste os cartões entre colunas para alterar o status. Use o seletor no celular ou teclado.':'Consulte as atividades por status. Seu perfil não permite alterações.','sub'),board);
 const old=scoped().filter(t=>t.has_next);const toggle=wsButton(showPastRoutines?'Ocultar ocorrências anteriores':'Exibir ocorrências anteriores ('+old.length+')',()=>{showPastRoutines=!showPastRoutines;legacyKanban()});panel.insertBefore(toggle,board);
 const overdue=old.filter(t=>AgendaDates.overdue(t));if(overdue.length)panel.insertBefore(node('p',overdue.length+' ocorrência(s) anterior(es) não realizada(s). Consulte o histórico.','notice'),board);
 for(const s of statuses){
 const items=scoped().filter(t=>t.status===s&&(showPastRoutines||!t.has_next)),col=node('div',undefined,'col'),h=node('h3',labels[s]);col.dataset.status=s;h.append(node('span',String(items.length),'count'));col.append(h);
 if(editable){col.ondragover=e=>{if(taskDragId===null||taskMovePending)return;e.preventDefault();e.dataTransfer.dropEffect='move';col.classList.add('tk-target')};col.ondragleave=e=>{if(!col.contains(e.relatedTarget))col.classList.remove('tk-target')};col.ondrop=e=>{e.preventDefault();col.classList.remove('tk-target');const id=taskDragId;taskDragId=null;if(id!==null)moveLegacyTask(id,s)}}
 for(const t of items){
 const c=node('article',undefined,'card '+(t.priority==='alta'?'high':t.priority==='média'?'medium':''));c.dataset.taskId=t.id;
 const title=wsButton(t.title,()=>detail(t.id).catch(e=>toast(e.message)),'tk-title');c.append(title,node('p',t.description||''));
 const meta=node('div',undefined,'meta');meta.append(node('span',t.assignee||''),node('span',fmt(t.due_date)));c.append(meta);if(AgendaDates.overdue(t))c.append(node('span','Prazo vencido','notice'));if(t.recurrence!=='não se repete')c.append(node('small',t.recurrence,'badge'));
 if(editable){c.draggable=!taskMovePending;c.ondragstart=e=>{taskDragId=t.id;e.dataTransfer.setData('text/plain',String(t.id));e.dataTransfer.effectAllowed='move';c.classList.add('tk-dragging')};c.ondragend=()=>{taskDragId=null;c.classList.remove('tk-dragging');board.querySelectorAll('.tk-target').forEach(x=>x.classList.remove('tk-target'))};
 const sel=node('select');sel.setAttribute('aria-label','Mover '+t.title);for(const st of statuses){const opt=node('option',labels[st]);opt.value=st;sel.append(opt)}sel.value=s;sel.disabled=taskMovePending;sel.onchange=()=>{const target=sel.value;sel.value=s;moveLegacyTask(t.id,target)};c.append(sel)}
 col.append(c);
 }if(!items.length)col.append(node('div','Sem atividades','empty'));board.append(col);
 }host.replaceChildren(panel);
}
