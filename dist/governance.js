/* Governance and collaboration for dynamic boards. */
function wsCan(action,bid=boardId){
 if(current?.is_admin)return true;
 const role=wsState.permissions?.[bid];
 if(action==='read'||action==='comment')return Boolean(role);
 if(action==='delete')return role==='manager'&&can('delete');
 return ['editor','manager'].includes(role)&&can(action);
}
function wsAccessPanel(host,scope,target){
 if(!current?.is_admin)return;
 const title=scope==='workspace'?'Workspace':'Board';
 host.append(node('h3','Acesso · '+title+' '+target.name),node('p','Restrições do workspace e do quadro são cumulativas. Administradores mantêm acesso.','sub'));
 const toggle=wsButton(target.restricted?'Tornar compartilhado':'Restringir a membros',async()=>{if(!confirm(target.restricted?'Permitir acesso a todos que atendam às demais permissões?':'Restringir acesso aos membros cadastrados?'))return;toggle.disabled=true;await wsWrite('PATCH',{action:'access',scope,scope_id:target.id,restricted:!target.restricted});if(scope==='workspace')closeModal()});
 host.append(node('p',target.restricted?'Restrito':'Compartilhado'),toggle);
 const form=node('form',undefined,'form'),users=wsSelectOptions('Colaborador',team.map(u=>[u.id,u.name])),roles=wsSelectOptions('Perfil neste escopo',[['viewer','Leitor'],['editor','Editor'],['manager','Gestor'],['none','Remover permissão explícita']]);
 const save=node('button','Salvar perfil','primary');save.type='submit';form.append(users.wrap,roles.wrap,save);host.append(form);
 form.onsubmit=async e=>{e.preventDefault();save.disabled=true;const ok=await wsWrite('PATCH',{action:'access',scope,scope_id:target.id,user_id:Number(users.sel.value),role:roles.sel.value});if(ok&&scope==='workspace')closeModal();else if(!ok)save.disabled=false};
 const members=(scope==='workspace'?wsState.workspaceMembers:wsState.boardMembers)||[];
 const list=node('div',undefined,'panel');list.append(node('h4','Membros com perfil explícito'));
 for(const m of members.filter(m=>m[scope+'_id']===target.id)){list.append(node('p',(team.find(u=>u.id===m.user_id)?.name||'Usuário '+m.user_id)+' · '+({viewer:'Leitor',editor:'Editor',manager:'Gestor'}[m.role])))}
 if(!members.some(m=>m[scope+'_id']===target.id))list.append(node('p','Nenhum perfil explícito.','sub'));host.append(list);
}
function wsWorkspaceAccess(target){
 const d=node('div',undefined,'dialog');d.append(wsButton('Fechar',closeModal));wsAccessPanel(d,'workspace',target);$('#modal').replaceChildren(d);$('#modal').classList.add('open');
}
function wsGovernancePanel(host,board){
 host.replaceChildren();wsAccessPanel(host,'board',board);
 const audit=node('div',undefined,'panel');audit.append(node('h3','Auditoria recente'));
 const labels={item_created:'Registro criado',item_updated:'Registro atualizado',item_deleted:'Registro excluído',comment_created:'Comentário criado',visibility_changed:'Visibilidade alterada',membership_changed:'Perfil alterado',membership_removed:'Perfil removido'};
 const entries=(wsState.audit||[]).filter(a=>a.board_id===board.id||a.workspace_id===board.workspace_id);
 for(const a of entries){const row=node('div',undefined,'comment');row.append(node('b',labels[a.event]||a.event),node('p',(a.actor_name||'Sistema / não identificado')+(a.item_id?' · Registro '+a.item_id:'')+(a.detail?.automatic?' · Automático':''),'sub'),node('small',new Date(a.created_at).toLocaleString('pt-BR')));audit.append(row)}
 if(!entries.length)audit.append(node('p','Nenhuma alteração registrada.','empty'));host.append(audit);
}
async function wsComments(item){
 if(!wsCan('comment',item.board_id))return toast('Sem acesso ao registro.');
 const d=node('div',undefined,'dialog'),list=node('div'),form=node('form',undefined,'form'),label=node('label','Comentário'),message=node('textarea');message.required=true;message.maxLength=2000;label.append(message);
 const mention=wsSelectOptions('Notificar colaborador (opcional)',[['','Sem menção'],...team.map(u=>[u.id,u.name])]);mention.sel.required=false;
 const submit=node('button','Enviar comentário','primary');submit.type='submit';form.append(label,mention.wrap,submit);
 d.append(wsButton('Fechar',closeModal),node('h2',item.title),node('h3','Comentários'),list,form);$('#modal').replaceChildren(d);$('#modal').classList.add('open');
 async function refresh(){try{const comments=await api('/api/workspaces',{method:'POST',body:JSON.stringify({action:'comments',mode:'list',item_id:item.id})});list.replaceChildren();for(const c of comments){const row=node('div',undefined,'comment');row.append(node('b',c.author||'Usuário indisponível'),node('p',c.message),node('small',new Date(c.created_at).toLocaleString('pt-BR')));list.append(row)}if(!comments.length)list.append(node('p','Nenhum comentário.','empty'))}catch(e){list.replaceChildren(node('p',e.message,'notice'))}}
 form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{await api('/api/workspaces',{method:'POST',body:JSON.stringify({action:'comments',item_id:item.id,message:message.value,mention_id:mention.sel.value?Number(mention.sel.value):null})});message.value='';mention.sel.value='';await refresh();toast('Comentário registrado.')}catch(e){toast(e.message)}finally{submit.disabled=false}};
 await refresh();
}
