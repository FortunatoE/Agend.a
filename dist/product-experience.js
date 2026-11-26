/* Shared, local SVG icon set (no external requests), shell and accessibility helpers. */
const uiPaths={
 dashboard:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
 folders:'<path d="M3 7V5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2M3 9h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
 table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M10 4v16"/>',
 kanban:'<rect x="3" y="4" width="5" height="15" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h2m4 0h2m-8 3h2"/>',
 repeat:'<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
 chart:'<path d="M3 3v18h18M8 16v-4m5 4V8m5 8V5"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M10 3h4l.8 3 2 .9 2.8-.8 2 3.5-2.1 2.1v2.4l2.1 2.1-2 3.5-2.8-.8-2 .9-.8 3h-4l-.8-3-2-.9-2.8.8-2-3.5 2.1-2.1v-2.4L2.4 9.6l2-3.5 2.8.8 2-.9Z" transform="translate(1 0) scale(.92)"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0"/>',
 moon:'<path d="M20.9 13.4A9 9 0 1 1 10.6 3.1 7 7 0 0 0 20.9 13.4Z"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
 key:'<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-4-4 2-2m-5-1 2-2"/>',
 logout:'<path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5m4-5 5-4-5-4m5 4H9"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 collapse:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m7-12-4 4 4 4"/>',
 expand:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m4-12 4 4-4 4"/>',
 check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 alert:'<path d="m12 3 10 18H2Z M12 9v4m0 4h.01"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 x:'<path d="m6 6 12 12M6 18 18 6"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
 message:'<path d="M21 11a9 9 0 0 1-9 9H3l2-4a9 9 0 1 1 16-5Z"/>',
 clip:'<path d="m8 12 6-6a3 3 0 1 1 4 4l-8 8a5 5 0 0 1-7-7l8-8"/>',
 trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
 edit:'<path d="m4 16-1 5 5-1L20 8l-4-4ZM14 6l4 4"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
 upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
 workflow:'<rect x="8" y="2" width="8" height="6" rx="1"/><rect x="2" y="16" width="8" height="6" rx="1"/><rect x="14" y="16" width="8" height="6" rx="1"/><path d="M12 8v4H6v4m6-4h6v4"/>',
 shield:'<path d="M12 2 3 6v6c0 5 4 8 9 10 5-2 9-5 9-10V6Z"/><path d="m8 12 3 3 5-6"/>',
 form:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8m-8 4h8m-8 4h5"/>',
 arrow:'<path d="m9 18 6-6-6-6"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>'
};
function uiIcon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','ui-icon');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.innerHTML=uiPaths[name]||uiPaths.info;return svg}
function uiDecorate(b,icon,label=b.textContent){b.replaceChildren(uiIcon(icon),node('span',label));return b}
function uiButtonIcon(label){
 const exact={'Tabela':'table','Kanban':'kanban','Calendário':'calendar','Gantt':'chart','Carga':'user','Resumo':'chart','Dashboard':'dashboard','Formulários':'form','Importar / Exportar':'download','Automações':'workflow','Workflows':'workflow','Acesso e auditoria':'shield','API e integrações':'key','Comentários':'message','Editar nome':'edit','Excluir':'trash','Excluir selecionados':'trash','Exportar CSV':'download','Exportar Excel (.xlsx)':'download','Importar registros':'upload','Fechar':'x','Usar modelo':'folders'};
 return exact[label]||(label.startsWith('+ ')?'plus':null);
}
function uiIconOnly(b,icon,label){b.replaceChildren(uiIcon(icon));b.title=label;b.setAttribute('aria-label',label);return b}
const uiNav={overview:'dashboard',workspaces:'folders',table:'table',kanban:'kanban',calendar:'calendar',routines:'repeat',reports:'chart',communication:'message',settings:'settings'};
let uiToastTimer,uiTaskFilter='all',uiReturnFocus=null,uiDialog=null,uiLastFocus=null;
function uiToast(message,kind='info'){
 const host=$('#toast');clearTimeout(uiToastTimer);host.replaceChildren(uiIcon(kind==='error'?'alert':kind==='success'?'check':'info'),node('span',String(message)));
 host.classList.toggle('ui-error',kind==='error');host.setAttribute('role',kind==='error'?'alert':'status');host.setAttribute('aria-live',kind==='error'?'assertive':'polite');
 const close=uiIconOnly(wsButton('',()=>host.classList.remove('show')),'x','Fechar aviso');host.append(close);host.classList.add('show');if(kind!=='error')uiToastTimer=setTimeout(()=>host.classList.remove('show'),5000);
}
function uiRefreshShell(){
 document.querySelectorAll('.nav button[data-view]').forEach(b=>{if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
 const dark=document.documentElement.dataset.theme==='dark';uiIconOnly($('#theme'),dark?'sun':'moon',dark?'Ativar tema claro':'Ativar tema escuro');
}
function uiNotificationBadge(){
 const b=$('#notifications'),n=inbox.filter(i=>!i.read_at).length;uiIconOnly(b,'bell',n?n+' notificações não lidas':'Notificações');if(n)b.append(node('span',n>99?'99+':String(n),'ui-count'));
}
function uiSearch(){
 const d=node('div',undefined,'dialog'),label=node('label','Buscar atividades e quadros'),input=node('input'),list=node('div',undefined,'ui-search-results'),status=node('p','Buscando quadros autorizados…','sub');
 input.type='search';input.placeholder='Nome, descrição ou responsável';input.setAttribute('aria-label','Buscar atividades e quadros');label.append(input);d.append(node('h2','Busca global'),label,status,list,wsButton('Fechar',closeModal));
 let boards=[],spaces=[];const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 function draw(){const q=norm(input.value).trim();list.replaceChildren();if(!q){list.append(node('p','Digite para localizar atividades ou quadros.','sub'));return}
 const matches=tasks.filter(t=>[t.title,t.description,t.assignee,t.area].some(v=>norm(v).includes(q))).slice(0,15);
 const found=boards.filter(b=>norm(b.name).includes(q)).slice(0,15);
 for(const t of matches)list.append(uiDecorate(wsButton(t.title,()=>{closeModal();detail(t.id).catch(e=>uiToast(e.message,'error'))}),'table',t.title+' · '+(t.area||'Atividade')));
 for(const b of found)list.append(uiDecorate(wsButton(b.name,()=>{closeModal();wsId=b.workspace_id;boardId=b.id;wsMode='table';view='workspaces';render()}),'folders',b.name+' · '+(spaces.find(w=>w.id===b.workspace_id)?.name||'Workspace')));
 if(!matches.length&&!found.length)list.append(node('p','Nenhum resultado encontrado.','empty'))}
 input.oninput=draw;$('#modal').replaceChildren(d);$('#modal').classList.add('open');draw();input.focus();
 api('/api/workspaces').then(s=>{boards=s.boards||[];spaces=s.workspaces||[];status.textContent='Pesquisa por atividades e nomes de quadros.';draw()}).catch(()=>{status.textContent='Quadros indisponíveis; pesquisa de atividades disponível.'});
}
function uiInit(){
 const header=$('#app header'),brand=header.querySelector('.brand');const text=[...brand.childNodes].find(n=>n.nodeType===3);if(text){const s=node('span',text.textContent,'ui-brand-text');text.replaceWith(s)}
 const brandRow=node('div',undefined,'ui-brand-row');brand.replaceWith(brandRow);brandRow.append(brand);
 const toggle=node('button',undefined,'ui-shell-toggle');toggle.type='button';brandRow.append(toggle);
 function collapse(state){$('#app').classList.toggle('ui-collapsed',state);toggle.setAttribute('aria-expanded',String(!state));uiIconOnly(toggle,state?'expand':'collapse',state?'Expandir menu':'Recolher menu');try{localStorage.setItem('agenda-sidebar',state?'1':'0')}catch{}}
 let collapsed=false;try{collapsed=localStorage.getItem('agenda-sidebar')==='1'}catch{}collapse(collapsed);toggle.onclick=()=>collapse(!$('#app').classList.contains('ui-collapsed'));
 const search=wsButton('',uiSearch,'ui-search');search.append(uiIcon('search'),node('span','Buscar','ui-nav-text'),node('kbd','Ctrl K'));search.setAttribute('aria-label','Busca global');header.insertBefore(search,header.querySelector('.nav'));
 const nav=header.querySelector('.nav');nav.setAttribute('aria-label','Navegação principal');
 for(const b of nav.querySelectorAll('button[data-view]')){const title=b.textContent;uiDecorate(b,uiNav[b.dataset.view],title);b.lastChild.className='ui-nav-text';b.setAttribute('aria-label',title);b.title=title}
 for(const [id,label] of [['overview','Início'],['workspaces','Espaços de trabalho'],['table','Atividades'],['routines','Gestão']])nav.insertBefore(node('div',label,'ui-nav-label'),nav.querySelector('[data-view="'+id+'"]'));
 uiIconOnly($('#password'),'key','Alterar senha');uiIconOnly($('#logout'),'logout','Sair');uiNotificationBadge();uiRefreshShell();uiDecorate($('#newTask'),'plus','Nova atividade');
 const pass=$('#loginPassword'),wrap=node('span',undefined,'ui-password-row');pass.replaceWith(wrap);wrap.append(pass);const show=wsButton('',()=>{const visible=pass.type==='password';pass.type=visible?'text':'password';uiIconOnly(show,'eye',visible?'Ocultar senha':'Mostrar senha');show.setAttribute('aria-pressed',String(visible))},'ui-password-toggle');uiIconOnly(show,'eye','Mostrar senha');show.setAttribute('aria-pressed','false');wrap.append(show);
 $('#loginError').setAttribute('role','alert');
 const modal=$('#modal'),app=$('#app');
 document.addEventListener('focusin',e=>{if(!modal.contains(e.target)&&e.target!==document.body)uiLastFocus=e.target});
 const observer=new MutationObserver(()=>{
 const d=modal.classList.contains('open')?modal.querySelector('.dialog'):null;
 if(d&&d!==uiDialog){if(!uiDialog)uiReturnFocus=uiLastFocus;uiDialog=d;d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.tabIndex=-1;const heading=d.querySelector('h2,h3');if(heading){heading.id='ui-dialog-title';d.setAttribute('aria-labelledby',heading.id)}else d.setAttribute('aria-label','Janela de diálogo');app.inert=true;$('#loginScreen').inert=true;if(!d.contains(document.activeElement))(d.querySelector('input:not([type=hidden]),select,textarea,button')||d).focus()}
 else if(!d&&uiDialog){uiDialog=null;app.inert=false;$('#loginScreen').inert=false;if(uiReturnFocus?.isConnected)uiReturnFocus.focus();uiReturnFocus=null;modal.classList.remove('ui-drawer')}
 });observer.observe(modal,{attributes:true,attributeFilter:['class'],childList:true});
 document.addEventListener('keydown',e=>{
 if(uiDialog&&e.key==='Escape'){e.preventDefault();closeModal();return}
 if(uiDialog&&e.key==='Tab'){const all=[...uiDialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex="0"]')].filter(x=>x.getClientRects().length);if(!all.length){e.preventDefault();uiDialog.focus();return}const first=all[0],last=all.at(-1);if(e.shiftKey&&(document.activeElement===first||!uiDialog.contains(document.activeElement))){e.preventDefault();last.focus()}else if(!e.shiftKey&&(document.activeElement===last||!uiDialog.contains(document.activeElement))){e.preventDefault();first.focus()}return}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&current&&!uiDialog){e.preventDefault();uiSearch()}
 });
}
function uiDashboard(){
 const a=scoped(),D=AgendaDates,done=a.filter(t=>t.status==='concluída').length,late=a.filter(t=>D.overdue(t)).length,progress=a.filter(t=>t.status==='andamento').length;
 const host=$('#overview'),stats=node('div',undefined,'stats');
 function open(filterName){uiTaskFilter=filterName;view='table';render()}
 for(const [label,val,desc,icon,filterName] of [['Atividades',a.length,'Na área selecionada','table','all'],['Em andamento',progress,'Em execução','clock','andamento'],['Concluídas',done,Math.round(done/(a.length||1)*100)+'% do total','check','concluída'],['Atrasadas',late,'Prazo vencido','alert','late']]){
 const b=wsButton('',()=>open(filterName),'stat ui-kpi'+(filterName==='late'?' ui-kpi-late':'')),h=node('div',undefined,'ui-kpi-head');h.append(node('span',label),uiIcon(icon));b.append(h,node('strong',String(val)),node('em',desc));stats.append(b)}
 const grid=node('div',undefined,'grid2'),next=node('div',undefined,'panel'),dist=node('div',undefined,'panel'),list=node('div',undefined,'list');next.append(node('h2','Próximas entregas'),list);
 const upcoming=D.upcoming(a).slice(0,8);for(const t of upcoming){const b=wsButton('',()=>detail(t.id).catch(e=>uiToast(e.message,'error')),'item ui-item'),body=node('div',undefined,'ui-item-body');body.append(node('b',t.title),node('small',(t.area||'')+' · '+(t.assignee||'Sem responsável')));b.append(uiIcon('calendar'),body,node('time',fmt(t.due_date)),uiIcon('arrow'));list.append(b)}if(!upcoming.length)list.append(node('p','Nenhuma entrega futura nesta área.','empty'));
 dist.append(node('h2','Distribuição por status'));const bar=node('div',undefined,'ui-distribution');bar.setAttribute('aria-hidden','true');dist.append(bar);
 const colors=['var(--muted)','var(--info)','var(--amber)','var(--green)'];for(const [i,s] of statuses.entries()){const count=a.filter(t=>t.status===s).length,c=s==='concluída'?'var(--green)':s==='andamento'?'var(--info)':colors[i%colors.length];if(count){const seg=node('span');seg.style.flex=String(count);seg.style.background=c;bar.append(seg)}const row=node('div',undefined,'ui-status-row'),sw=node('span',undefined,'ui-swatch');sw.style.background=c;row.append(sw,node('span',labels[s]||s),node('strong',String(count)));dist.append(row)}
 dist.append(node('p','Atrasos são uma condição de prazo e podem ocorrer em diferentes status.','sub'));grid.append(next,dist);host.replaceChildren(stats,grid);weeklyOverview(host);
}
function uiReports(){
 const data=scoped(),host=$('#reports'),areasPanel=node('div',undefined,'panel'),people=node('div',undefined,'panel');
 areasPanel.append(node('h2','Conclusão por área'));const names=[...new Set(data.map(t=>t.area).filter(Boolean))];function row(label,count,total,description){const r=node('div',undefined,'report'),bar=node('div',undefined,'bar'),fill=node('i');fill.style.width=Math.round(count/(total||1)*100)+'%';bar.append(fill);r.append(node('b',label),bar,node('span',description));return r}
 for(const a of names){const ts=data.filter(t=>t.area===a),done=ts.filter(t=>t.status==='concluída').length;areasPanel.append(row(a,done,ts.length,done+'/'+ts.length+' concluídas'))}if(!names.length)areasPanel.append(node('p','Nenhuma atividade nesta área.','empty'));
 people.append(node('h2','Atividades abertas por responsável'));const members=[...new Set([...(current?.is_admin?team.map(u=>u.name):[current?.name]),...data.map(t=>t.assignee||'Sem responsável')].filter(Boolean))],counts=members.map(name=>[name,data.filter(t=>(t.assignee||'Sem responsável')===name&&t.status!=='concluída').length]).sort((a,b)=>b[1]-a[1]);const max=Math.max(1,...counts.map(x=>x[1]));for(const [name,n] of counts)people.append(row(name,n,max,n+' abertas'));if(!counts.length)people.append(node('p','Nenhum responsável disponível.','empty'));people.append(node('p','Barras proporcionais ao maior número de atividades abertas; não representam capacidade de trabalho.','sub'));host.replaceChildren(areasPanel,people);
}
