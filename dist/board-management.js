/* Administrator-only board lifecycle. Archive hides records until restored. */
function boardManageDialog(board){
 if(!current?.is_admin)return;
 const d=node('div',undefined,'dialog'),form=node('form',undefined,'form'),name=node('input'),description=node('textarea'),label=node('label','Nome do quadro'),descLabel=node('label','Descrição');
 name.value=board.name;name.required=true;name.maxLength=120;description.value=board.description||'';description.maxLength=2000;description.rows=4;label.append(name);descLabel.append(description);
 const save=node('button','Salvar quadro','primary');save.type='submit';form.append(label,descLabel,save,wsButton('Cancelar',closeModal));
 form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{await api('/api/workspaces',{method:'PATCH',body:JSON.stringify({action:'board_manage',id:board.id,name:name.value,description:description.value})});closeModal();await wsLoad();toast('Quadro atualizado.','success')}catch(e){toast(e.message,'error')}finally{save.disabled=false}};
 d.append(node('h2','Editar quadro'),form);$('#modal').replaceChildren(d);$('#modal').classList.add('open');
}
async function boardArchive(board,restore=false){
 if(!current?.is_admin||!confirm((restore?'Restaurar':'Arquivar')+' o quadro “'+board.name+'”? '+(restore?'O quadro voltará aos ambientes ativos.':'Os registros e vínculos serão preservados, mas o quadro ficará fora da navegação ativa.')))return;
 try{await api('/api/workspaces',{method:'PATCH',body:JSON.stringify({action:'board_manage',id:board.id,mode:restore?'restore':'archive'})});boardId=restore?board.id:null;await wsLoad();toast(restore?'Quadro restaurado.':'Quadro arquivado.','success')}catch(e){toast(e.message,'error')}
}
function boardDeleteDialog(board){
 if(!current?.is_admin)return;
 const d=node('div',undefined,'dialog'),form=node('form',undefined,'form'),label=node('label','Digite o nome exato do quadro'),input=node('input');input.required=true;input.autocomplete='off';label.append(input);
 const save=node('button','Excluir definitivamente','ui-danger');save.type='submit';save.disabled=true;input.oninput=()=>save.disabled=input.value!==board.name;
 d.append(node('h2','Excluir quadro'),node('p','A exclusão definitiva é permitida somente para quadros arquivados sem registros, histórico, integrações ou dependências. Campos, grupos e permissões do quadro excluído serão removidos.','sub'),node('b',board.name));form.append(label,save,wsButton('Cancelar',closeModal));d.append(form);
 form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{await api('/api/workspaces',{method:'DELETE',body:JSON.stringify({action:'board_manage',id:board.id,confirm:true,confirmation:input.value})});closeModal();await wsLoad();toast('Quadro excluído.','success')}catch(e){toast(e.message,'error');save.disabled=false}};
 $('#modal').replaceChildren(d);$('#modal').classList.add('open');
}
function boardActionMenu(board,archived=false){
 const details=node('details',undefined,'board-action-menu'),summary=node('summary','⋯');summary.title='Ações do quadro '+board.name;summary.setAttribute('aria-label','Ações do quadro '+board.name);details.append(summary);
 const actions=node('div',undefined,'board-action-list');actions.append(wsButton('Editar quadro',()=>boardManageDialog(board)));
 if(archived)actions.append(wsButton('Restaurar quadro',()=>boardArchive(board,true)),wsButton('Excluir quadro',()=>boardDeleteDialog(board),'ui-danger'));
 else actions.append(wsButton('Arquivar quadro',()=>boardArchive(board)));
 details.append(actions);return details;
}
function boardSidebarEntry(board,archived=false){
 const row=node('div',undefined,'board-sidebar-entry');
 if(archived)row.append(node('span',board.name,'sub'));
 else row.append(wsButton(board.name,()=>{boardId=board.id;wsDraw()},'ws-link'+(boardId===board.id?' selected':'')));
 if(current?.is_admin)row.append(boardActionMenu(board,archived));return row;
}
