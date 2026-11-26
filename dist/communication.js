/* Internal communication and scoped notes. */
let communicationVersion=0;
function communicationPanel(host){
 const version=++communicationVersion;host.replaceChildren(node('p','Carregando comunicados e anotações…','sub'));
 const request=(method,data)=>api('/api/communication',{method,body:JSON.stringify(data)});
 const when=v=>v?new Date(v).toLocaleString('pt-BR'):'—';
 const refresh=()=>communicationPanel(host);
 async function submit(button,method,data){button.disabled=true;try{await request(method,data);toast('Alteração registrada.','success');refresh()}catch(e){toast(e.message,'error');button.disabled=false}}
 api('/api/communication').then(s=>{
 if(version!==communicationVersion||!host.isConnected)return;
 host.replaceChildren();
 const received=node('div',undefined,'panel'),notes=node('div',undefined,'panel');received.append(node('h2','Meus recados e lembretes'));
 for(const c of s.received){const card=node('article',undefined,'comment communication-card');card.append(node('span',c.kind==='lembrete'?'Lembrete':'Recado','badge'),node('h3',c.title),node('small','Enviado: '+when(c.created_at),'sub'));
 if(c.seen_at){card.append(node('p',c.message),node('p','Visualizado: '+when(c.seen_at)+' · Feito: '+when(c.done_at),'sub'));if(!c.done_at){const done=wsButton('Feito',()=>submit(done,'PATCH',{action:'done',id:c.id}),'primary');card.append(done)}}
 else{const open=wsButton('Abrir comunicado',()=>submit(open,'PATCH',{action:'seen',id:c.id}));card.append(open)}
 received.append(card)}
 if(!s.received.length)received.append(node('p','Nenhum comunicado recebido.','empty'));
 host.append(received);
 function field(label,multiline=false){const wrap=node('label',label),input=node(multiline?'textarea':'input');input.required=true;input.maxLength=multiline?5000:150;if(multiline)input.rows=3;wrap.append(input);return {wrap,input}}
 function makeForm(heading,container){const form=node('form',undefined,'form'),title=field('Título'),message=field('Mensagem',true);form.append(node('h3',heading),title.wrap,message.wrap);container.append(form);return {form,title,message}}
 if(current?.is_admin){
 const admin=node('div',undefined,'panel');admin.append(node('h2','Enviar comunicação'));const {form,title,message}=makeForm('Novo comunicado',admin),kind=wsSelectOptions('Tipo',[['recado','Recado'],['lembrete','Lembrete']]),audience=wsSelectOptions('Destinatários',[['all','Todos os colaboradores ativos'],['one','Colaborador específico']]),recipient=wsSelectOptions('Colaborador',team.filter(u=>u.id!==current.id&&!u.is_admin).map(u=>[u.id,u.name]));
 function update(){recipient.wrap.hidden=audience.sel.value==='all';recipient.sel.disabled=recipient.wrap.hidden}audience.sel.onchange=update;update();
 const save=node('button','Enviar comunicado','primary');save.type='submit';form.append(kind.wrap,audience.wrap,recipient.wrap,save);form.onsubmit=e=>{e.preventDefault();submit(save,'POST',{action:'send',title:title.input.value,message:message.input.value,kind:kind.sel.value,audience:audience.sel.value,user_id:Number(recipient.sel.value)})};host.append(admin);
 const tracking=node('div',undefined,'panel');tracking.append(node('h2','Acompanhamento dos comunicados'));
 for(const c of s.sent){const card=node('div',undefined,'comment');card.append(node('h3',c.title),node('p',c.message),node('small','Enviado: '+when(c.created_at),'sub'));const table=node('table'),head=node('tr');for(const label of ['Colaborador','Visualizado','Feito'])head.append(node('th',label));const th=node('thead');th.append(head);table.append(th);const tb=node('tbody');for(const rec of c.recipients){const row=node('tr');row.append(node('td',rec.name||'Usuário'),node('td',when(rec.seen_at)),node('td',when(rec.done_at)));tb.append(row)}table.append(tb);const wrap=node('div',undefined,'work-grid');wrap.append(table);card.append(wrap);tracking.append(card)}if(!s.sent.length)tracking.append(node('p','Nenhum comunicado enviado.','empty'));host.append(tracking);
 const membership=node('details',undefined,'panel');membership.append(node('summary','Permissões de área para anotações'),node('p','Configure os vínculos reais dos colaboradores. O filtro visual de área não concede acesso.','sub'));
 for(const u of team.filter(u=>u.id!==current.id&&!u.is_admin)){const row=node('div',undefined,'communication-member');row.append(node('b',u.name));for(const a of s.areas){const label=node('label',undefined,'check'),c=node('input');c.type='checkbox';c.checked=s.members.some(m=>m.user_id===u.id&&m.area===a);c.onchange=async()=>{c.disabled=true;try{await request('POST',{action:'membership',user_id:u.id,area:a,enabled:c.checked});toast('Vínculo salvo.','success')}catch(e){c.checked=!c.checked;toast(e.message,'error')}finally{c.disabled=false}};label.append(c,document.createTextNode(a));row.append(label)}membership.append(row)}host.append(membership);
 }
 notes.append(node('h2','Anotações'));const {form,title,message}=makeForm('Nova anotação',notes),audience=wsSelectOptions('Visibilidade',[['team','Toda a equipe'],['area','Área específica'],['admins','Somente administradores e autor']]),allowedAreas=current?.is_admin?s.areas:s.areas.filter(a=>s.members.some(m=>m.area===a)),area=wsSelectOptions('Área',allowedAreas.map(a=>[a,a]));
 function updateArea(){area.wrap.hidden=audience.sel.value!=='area';area.sel.disabled=area.wrap.hidden}audience.sel.onchange=updateArea;updateArea();const save=node('button','Publicar anotação','primary');save.type='submit';form.append(audience.wrap,area.wrap,save);form.onsubmit=e=>{e.preventDefault();submit(save,'POST',{action:'note',title:title.input.value,message:message.input.value,audience:audience.sel.value,area:area.sel.value})};
 for(const n of s.notes){const card=node('article',undefined,'comment communication-card');card.append(node('span',n.audience==='team'?'Equipe':n.audience==='area'?n.area:'Administradores e autor','badge'),node('h3',n.title),node('p',n.message),node('small',n.author+' · '+when(n.created_at),'sub'));notes.append(card)}if(!s.notes.length)notes.append(node('p','Nenhuma anotação disponível.','empty'));host.append(notes);
 }).catch(e=>{if(version!==communicationVersion||!host.isConnected)return;host.replaceChildren(node('p',e.message,'notice'),wsButton('Tentar novamente',refresh))});
}
