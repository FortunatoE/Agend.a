/* Product experience: board filters, bulk operations, templates. */
const boardPrefs=new Map();
function wsBoardPrefs(id){if(!boardPrefs.has(id))boardPrefs.set(id,{query:'',group:'',status:'',order:'group',page:1,size:25,selected:new Set()});return boardPrefs.get(id)}
function wsTemplateModal(workspace){
 const dialog=node('div',undefined,'dialog'),form=node('form',undefined,'form'),name=node('input');
 name.required=true;name.maxLength=120;name.placeholder='Nome do novo quadro';
 const template=wsSelectOptions('Modelo',[['project','Projetos'],['routine','Rotinas operacionais'],['requests','Solicitações']]);
 form.append(template.wrap,name,node('p','Cria campos e grupos prontos para uso, sem copiar registros ou regras.','sub'));
 const save=node('button','Criar quadro','primary');save.type='submit';form.append(wsButton('Cancelar',closeModal),save);
 form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{const result=await api('/api/workspaces',{method:'POST',body:JSON.stringify({action:'template',workspace_id:workspace,name:name.value,template:template.sel.value})});boardId=result.id;wsMode='table';closeModal();await wsLoad();toast('Quadro criado.')}catch(e){toast(e.message);save.disabled=false}};
 dialog.append(node('h2','Criar a partir de modelo'),form);$('#modal').replaceChildren(dialog);$('#modal').classList.add('open');
}
function wsBoardFilters(host,b,fields,groups,p,draw){
 const bar=node('div',undefined,'bp-filters');
 const search=node('input');search.type='search';search.placeholder='Buscar registros e valores';search.value=p.query;search.setAttribute('aria-label','Buscar registros e valores');
 const group=wsSelectOptions('Grupo',[['','Todos'],['none','Sem grupo'],...groups.map(g=>[g.id,g.name])]);group.sel.value=p.group;
 const status=wsSelectOptions('Status',[['','Todos'],['none','Sem status'],...['A fazer','Em andamento','Concluído'].map(s=>[s,s])]);status.sel.value=p.status;status.sel.disabled=!fields.some(f=>f.type==='status');
 const order=wsSelectOptions('Ordenar',[['group','Grupo'],['title','Nome'],['newest','Mais recentes'],['oldest','Mais antigos']]);order.sel.value=p.order;
 const change=()=>{p.query=search.value;p.group=group.sel.value;p.status=status.sel.value;p.order=order.sel.value;p.page=1;p.selected.clear();draw()};
 search.oninput=change;group.sel.onchange=status.sel.onchange=order.sel.onchange=change;
 bar.append(search,group.wrap,status.wrap,order.wrap,wsButton('Limpar filtros',()=>{search.value='';group.sel.value=status.sel.value='';order.sel.value='group';change()}));host.append(bar);
}
function wsBulkBar(host,b,p,groups,status,draw){
 const box=node('div',undefined,'bp-bulk');host.append(box);
 const render=()=>{box.replaceChildren();box.append(node('strong',p.selected.size+' selecionado(s)'));
 if(!p.selected.size)return;
 const run=async config=>{if(!confirm('Aplicar a operação a '+p.selected.size+' registros? Automações podem ser executadas.'))return;try{const r=await api('/api/workspaces',{method:'PATCH',body:JSON.stringify({action:'bulk',board_id:b.id,ids:[...p.selected],...config})});p.selected.clear();toast(r.count+' registros processados.');await wsLoad()}catch(e){toast(e.message)}};
 if(wsCan('edit',b.id)){
 const g=wsSelectOptions('Mover para',[['','Sem grupo'],...groups.map(g=>[g.id,g.name])]);box.append(g.wrap,wsButton('Mover',()=>run({mode:'group',group_id:g.sel.value?Number(g.sel.value):null})));
 if(status){const st=wsSelectOptions('Novo status',[['','Sem status'],...['A fazer','Em andamento','Concluído'].map(s=>[s,s])]);box.append(st.wrap,wsButton('Aplicar status',()=>run({mode:'status',field_id:status.id,value:st.sel.value||null})))}
 }
 if(wsCan('delete',b.id))box.append(wsButton('Excluir selecionados',()=>run({mode:'delete'})));
 box.append(wsButton('Desmarcar',()=>{p.selected.clear();draw()}));
 };render();return render;
}
function wsBoardPager(host,p,filtered,draw){
 const pg=AgendaBoard.pageItems(filtered,p.page,p.size);p.page=pg.page;
 const bar=node('div',undefined,'bp-pager'),size=wsSelectOptions('Por página',[25,50,100].map(n=>[n,String(n)]));size.sel.value=p.size;size.sel.onchange=()=>{p.size=Number(size.sel.value);p.page=1;draw()};
 const prev=wsButton('Anterior',()=>{p.page--;draw()}),next=wsButton('Próxima',()=>{p.page++;draw()});prev.disabled=p.page<=1;next.disabled=p.page>=pg.total;
 bar.append(node('span',filtered.length+' registros · Página '+pg.page+' de '+pg.total),size.wrap,prev,next);host.append(bar);return pg.rows;
}
