/* Authenticated forms, bound to existing board fields. */
function wsFormModal(def){
 if(!def?.enabled||!can('create'))return toast('Formulário indisponível para seu perfil.');
 const modal=$('#modal'),dialog=node('div',undefined,'dialog'),form=node('form',undefined,'form'),readers=new Map();
 dialog.append(node('h2',def.name),node('p',def.description||'Preencha as informações abaixo.','sub'));
 const titleLabel=node('label','Título do registro *'),title=node('input');title.required=true;title.maxLength=120;titleLabel.append(title);form.append(titleLabel);
 for(const q of def.fields){
 const f=wsState.fields.find(f=>f.id===q.field_id&&f.board_id===def.board_id);
 if(!f)return toast('Formulário desatualizado. Consulte o administrador.');
 const label=node('label',f.name+(q.required?' *':''));let input;
 if(f.type==='status'||f.type==='checkbox'){
 input=node('select');const options=f.type==='status'?[['','Selecione'],['A fazer','A fazer'],['Em andamento','Em andamento'],['Concluído','Concluído']]:[['','Selecione'],['true','Sim'],['false','Não']];
 for(const [v,t] of options){const o=node('option',t);o.value=v;input.append(o)}
 }else if(f.type==='text'){input=node('textarea');input.rows=2;input.maxLength=2000}
 else{input=node('input');input.type=f.type;if(f.type==='number')input.step='any'}
 input.required=q.required;label.append(input);form.append(label);
 readers.set(f.id,()=>input.value===''?null:f.type==='number'?Number(input.value):f.type==='checkbox'?input.value==='true':input.value);
 }
 const error=node('p','','error'),actions=node('div',undefined,'actions'),submit=node('button','Enviar resposta','primary');submit.type='submit';actions.append(wsButton('Cancelar',closeModal),submit);form.append(error,actions);dialog.append(form);modal.replaceChildren(dialog);modal.classList.add('open');
 let requestId=crypto.randomUUID();
 form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;error.textContent='';
 try{
 const result=await api('/api/workspaces',{method:'POST',body:JSON.stringify({action:'form_submit',form_id:def.id,request_id:requestId,title:title.value,answers:Object.fromEntries([...readers].map(([k,read])=>[k,read()]))})});
 dialog.replaceChildren(node('h2','Resposta registrada'),node('p','Seu envio foi registrado com sucesso.','sub'),node('p','Protocolo #'+result.id),wsButton('Fechar',closeModal,'primary'));
 await wsLoad();
 }catch(e){error.textContent=e.message;submit.disabled=false}
 };
}
function wsFormsPanel(host,board){
 host.replaceChildren();host.append(node('h2','Formulários'),node('p','Colete informações diretamente nos registros deste quadro.','sub'));
 const definitions=(wsState.forms||[]).filter(f=>f.board_id===board.id);
 if(current?.is_admin){
 const panel=node('div',undefined,'panel'),form=node('form',undefined,'form');
 panel.append(node('h3','Criar formulário'),form);host.append(panel);
 const nameLabel=node('label','Nome'),name=node('input');name.required=true;name.maxLength=120;nameLabel.append(name);
 const descLabel=node('label','Descrição'),desc=node('textarea');desc.maxLength=1000;descLabel.append(desc);
 const group=wsSelectOptions('Grupo de destino',[['','Sem grupo'],...(wsState.groups||[]).filter(g=>g.board_id===board.id).map(g=>[g.id,g.name])]);group.sel.required=false;
 form.append(nameLabel,descLabel,group.wrap,node('p','O título é sempre obrigatório. Selecione os campos adicionais e marque os obrigatórios.','sub'));
 const fields=wsState.fields.filter(f=>f.board_id===board.id&&['text','number','date','checkbox','status'].includes(f.type));const questions=[];
 for(const f of fields){
 const row=node('div',undefined,'item'),chosen=node('input'),required=node('input');chosen.type=required.type='checkbox';required.disabled=true;const a=node('label',undefined,'check'),b=node('label',undefined,'check');
 a.append(chosen,document.createTextNode(f.name));b.append(required,document.createTextNode('Obrigatório'));
 chosen.onchange=()=>{required.disabled=!chosen.checked;if(!chosen.checked)required.checked=false};
 row.append(a,b);form.append(row);questions.push({id:f.id,chosen,required});
 }
 if(!fields.length)form.append(node('p','Sem campos adicionais. O formulário coletará apenas o título.','sub'));
 const save=node('button','Criar formulário','primary');save.type='submit';form.append(save);
 form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{await api('/api/workspaces',{method:'POST',body:JSON.stringify({action:'form',board_id:board.id,name:name.value,description:desc.value,group_id:group.sel.value?Number(group.sel.value):null,fields:questions.filter(q=>q.chosen.checked).map(q=>({field_id:q.id,required:q.required.checked}))})});await wsLoad();toast('Formulário criado.')}catch(e){toast(e.message);save.disabled=false}};
 }
 const list=node('div',undefined,'panel');list.append(node('h3','Formulários disponíveis'));host.append(list);
 if(!definitions.length)list.append(node('p','Nenhum formulário disponível.','empty'));
 for(const f of definitions){
 const row=node('div',undefined,'comment');row.append(node('b',f.name+' · '+(f.enabled?'Ativo':'Pausado')),node('p',f.description||'Sem descrição','sub'));
 const controls=node('div',undefined,'actions');
 if(f.enabled&&can('create'))controls.append(wsButton('Responder',()=>wsFormModal(f),'primary'));
 if(f.enabled)controls.append(wsButton('Copiar link interno',async()=>{try{const url=new URL(location.pathname,location.origin);url.searchParams.set('form',f.id);await navigator.clipboard.writeText(url.href);toast('Link copiado. Requer login e permissão de criação.')}catch(e){toast('Não foi possível copiar o link.')}}));
 if(current?.is_admin)controls.append(wsButton(f.enabled?'Pausar':'Ativar',()=>wsWrite('PATCH',{action:'form',id:f.id,enabled:!f.enabled})));
 row.append(controls);list.append(row);
 }
 if(current?.is_admin){const history=node('div',undefined,'panel');history.append(node('h3','Envios recentes'));host.append(history);
 const submissions=(wsState.formSubmissions||[]).filter(s=>s.board_id===board.id);
 if(!submissions.length)history.append(node('p','Nenhuma resposta registrada.','empty'));
 for(const s of submissions){const row=node('div',undefined,'comment'),def=definitions.find(f=>f.id===s.form_id);row.append(node('b','#'+s.id+' · '+s.title),node('p',(def?.name||'Formulário')+' · '+(s.submitted_by_name||'Usuário indisponível')+' · '+new Date(s.created_at).toLocaleString('pt-BR'),'sub'),node('small','Registro '+(s.item_id??'excluído')));const details=node('details');details.append(node('summary','Respostas originais'));for(const [id,v] of Object.entries(s.answers||{})){const f=wsState.fields.find(f=>f.id===Number(id)&&f.board_id===board.id);details.append(node('p',(f?.name||'Campo '+id)+': '+(typeof v==='boolean'?(v?'Sim':'Não'):String(v))))}row.append(details);history.append(row)}
 }
}
let wsLinkHandled=false;
function wsOpenFormLink(){
 if(wsLinkHandled)return;wsLinkHandled=true;
 const id=Number(new URLSearchParams(location.search).get('form'));if(!Number.isSafeInteger(id)||id<=0)return;
 const form=(wsState.forms||[]).find(f=>f.id===id&&f.enabled),board=wsState.boards.find(b=>b.id===form?.board_id);
 if(!form||!board||!can('create'))return toast('Formulário indisponível para seu perfil.');
 wsId=board.workspace_id;boardId=board.id;wsMode='forms';wsDraw();wsFormModal(form);
}
