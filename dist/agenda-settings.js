/* Agenda configuration and routine view. */
async function renderAreaSettings(host){
 const panel=node('div',undefined,'panel');panel.append(node('h2','Áreas de trabalho'),node('p','Renomear preserva os vínculos. A exclusão de áreas em uso é bloqueada.','sub'));host.append(panel);
 const rows=await api('/api/tasks?areas=1');if(!panel.isConnected)return;
 const create=node('form',undefined,'form'),label=node('label','Nova área'),input=node('input');input.required=true;input.maxLength=100;label.append(input);const add=node('button','Criar área','primary');add.type='submit';create.append(label,add);panel.append(create);
 async function change(btn,method,data){btn.disabled=true;try{await api('/api/communication',{method,body:JSON.stringify({action:'area_manage',...data})});await load();toast('Áreas atualizadas.','success')}catch(e){toast(e.message,'error')}finally{btn.disabled=false}}
 create.onsubmit=e=>{e.preventDefault();change(add,'POST',{name:input.value})};
 for(const a of rows){const form=node('form',undefined,'form'),row=node('div',undefined,'actions'),name=node('input');name.value=a.name;name.required=true;name.maxLength=100;name.setAttribute('aria-label','Nome da área '+a.name);const save=node('button','Salvar','plain');save.type='submit';const del=wsButton('Excluir',()=>{if(confirm('Excluir a área “'+a.name+'”?'))change(del,'DELETE',{id:a.id,confirm:true})},'ui-danger');row.append(name,save,del);form.append(row);form.onsubmit=e=>{e.preventDefault();change(save,'PATCH',{id:a.id,name:name.value})};panel.append(form)}
}
let routinePerson='';
function renderRoutineList(){
 const host=$('#routines'),panel=node('div',undefined,'panel'),a=scoped().filter(t=>t.recurrence!=='não se repete');
 panel.append(node('h2','Atividades recorrentes'));
 if(current?.is_admin){const members=[...new Map(a.filter(t=>t.assignee_id!=null).map(t=>[String(t.assignee_id),t.assignee])).entries()].sort((x,y)=>x[1].localeCompare(y[1],'pt-BR')),sel=wsSelectOptions('Responsável',[['','Todos os colaboradores'],['unlinked','Sem vínculo'],...members]);sel.sel.value=routinePerson;if(sel.sel.selectedIndex<0)sel.sel.value='';sel.sel.onchange=()=>{routinePerson=sel.sel.value;renderRoutineList()};panel.append(sel.wrap)}
 const rows=a.filter(t=>!current?.is_admin||!routinePerson||(routinePerson==='unlinked'?t.assignee_id==null:String(t.assignee_id)===routinePerson));
 for(const t of rows){const line=node('div',undefined,'routine'),name=node('div'),bar=node('div',undefined,'bar'),fill=node('i');name.append(wsButton(t.title,()=>detail(t.id).catch(e=>toast(e.message,'error')),'team-cal-task'),node('small',t.area+' · '+t.assignee+' · '+fmt(t.due_date),'sub'));if(AgendaDates.overdue(t))name.append(node('small','Prazo vencido','notice'));if(t.has_next)name.append(node('small','Ocorrência anterior','sub'));const progress=Math.max(0,Math.min(100,Number(t.progress)||0));fill.style.width=progress+'%';bar.append(fill);line.append(name,node('span',t.recurrence,'badge'),bar,node('span',progress+'%'));panel.append(line)}
 if(!rows.length)panel.append(node('p','Nenhuma rotina encontrada.','empty'));host.replaceChildren(panel);
}
let refreshTimer=null,refreshBusy=false;
function startAgendaRefresh(){
 if(refreshTimer)return;
 refreshTimer=setInterval(async()=>{if(refreshBusy||document.hidden||!current||$('#modal').classList.contains('open')||!['overview','kanban','calendar','routines','table'].includes(view)||document.activeElement?.matches('input,select,textarea')||typeof taskDragId!=='undefined'&&taskDragId!==null||typeof taskMovePending!=='undefined'&&taskMovePending)return;refreshBusy=true;try{await load()}catch(e){console.warn('Atualização automática indisponível')}finally{refreshBusy=false}},60000);
}
