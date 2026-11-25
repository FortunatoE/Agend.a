/* Administrative integration credentials. Secrets are shown only once. */
async function wsApiKeysPanel(host,board){
 host.replaceChildren();if(!current?.is_admin)return;
 host.append(node('h2','Credenciais de integração'),node('p','Cada chave pertence a um único Board e a um usuário. O acesso é revogado automaticamente se o usuário perder a permissão.','sub'));
 const call=payload=>api('/api/workspaces',{method:'POST',body:JSON.stringify({action:'api_keys',board_id:board.id,...payload})});
 const create=node('div',undefined,'panel'),form=node('form',undefined,'form'),nameLabel=node('label','Nome da integração'),name=node('input');
 name.required=true;name.maxLength=120;nameLabel.append(name);
 const owner=wsSelectOptions('Usuário responsável',team.map(u=>[u.id,u.name])),scope=wsSelectOptions('Escopo',[['read','Somente leitura'],['read_create','Leitura e criação'],['read_write','Leitura, criação e sincronização']]),daysLabel=node('label','Validade em dias (1–90)'),days=node('input');
 days.type='number';days.min='1';days.max='90';days.step='1';days.value='30';days.required=true;daysLabel.append(days);
 const save=node('button','Gerar credencial','primary');save.type='submit';form.append(nameLabel,owner.wrap,scope.wrap,daysLabel,save);create.append(node('h3','Nova chave de API'),form);host.append(create);
 const secret=node('div');host.append(secret);
 const docs=node('div',undefined,'panel');docs.append(node('h3','Endpoint REST'),node('p',location.origin+'/api/workspaces'),node('p','Authorization: Bearer <chave>','sub'),node('p','GET: registros em páginas de 100. Envie ?after=ID para continuar. POST: cria um registro com title, request_id (UUID v4), values (IDs dos campos) e group_id opcional. PATCH: sincroniza por external_id (escopo read_write), com title, request_id e values. GET ?events=1&after=0: consulta eventos do quadro. Limite de 60 requisições por minuto por chave.','sub'));host.append(docs);
 const list=node('div',undefined,'panel'),logs=node('div',undefined,'panel');host.append(list,logs);
 async function refresh(){try{const result=await call({mode:'list'});list.replaceChildren(node('h3','Credenciais'));logs.replaceChildren(node('h3','Últimas requisições'));
 for(const k of result.keys){const active=!k.revoked_at&&Date.parse(k.expires_at)>Date.now(),row=node('div',undefined,'comment');row.append(node('b',k.name+' · '+(active?'Ativa':'Inativa')),node('p',k.prefix+'… · '+k.owner_name+' · '+({read:'Leitura',read_create:'Leitura e criação',read_write:'Leitura e sincronização'}[k.scope]||k.scope),'sub'),node('p','Validade: '+new Date(k.expires_at).toLocaleString('pt-BR')+' · Último uso: '+(k.last_used_at?new Date(k.last_used_at).toLocaleString('pt-BR'):'Nunca'),'sub'));
 if(!k.revoked_at)row.append(wsButton('Revogar',async()=>{if(!confirm('Revogar permanentemente esta chave?'))return;try{await call({mode:'revoke',key_id:k.id});await refresh();toast('Chave revogada.')}catch(e){toast(e.message)}}));list.append(row)}
 if(!result.keys.length)list.append(node('p','Nenhuma credencial.','empty'));
 for(const l of result.logs){const row=node('div',undefined,'comment');row.append(node('b',l.name+' · '+l.method+' · HTTP '+l.status),node('small',new Date(l.created_at).toLocaleString('pt-BR')));logs.append(row)}
 if(!result.logs.length)logs.append(node('p','Nenhuma requisição registrada.','empty'));
 }catch(e){list.replaceChildren(node('p',e.message,'notice'))}}
 form.onsubmit=async e=>{e.preventDefault();save.disabled=true;secret.replaceChildren();try{
 const result=await call({mode:'create',name:name.value,owner_id:Number(owner.sel.value),scope:scope.sel.value,days:Number(days.value)});
 const panel=node('div',undefined,'panel'),value=node('input');value.readOnly=true;value.value=result.token;value.setAttribute('aria-label','Chave de API');
 panel.append(node('h3','Guarde a chave agora'),node('p','Ela não poderá ser recuperada depois. Armazene em um gerenciador de segredos; não inclua em código público.','sub'),value,wsButton('Copiar chave',async()=>{try{await navigator.clipboard.writeText(value.value);toast('Chave copiada.')}catch{value.select()}}),wsButton('Ocultar chave',()=>{value.value='';secret.replaceChildren()}));secret.append(panel);name.value='';await refresh();
 }catch(e){toast(e.message)}finally{save.disabled=false}};
 await refresh();
}
