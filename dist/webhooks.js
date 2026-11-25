/* Webhook subscriptions use infrastructure-defined aliases, never arbitrary URLs. */
async function wsWebhooksPanel(host,board){
 if(!current?.is_admin)return;
 const panel=node('div',undefined,'panel'),list=node('div'),logs=node('div'),config=node('div',undefined,'form');
 panel.append(node('h3','Webhooks e entregas'),node('p','Eventos mínimos de criação, atualização e exclusão. Destinos HTTPS e segredos são configurados na infraestrutura.','sub'),config,list,logs);host.append(panel);
 const call=payload=>api('/api/workspaces',{method:'POST',body:JSON.stringify({action:'webhooks',board_id:board.id,...payload})});
 async function run(payload){try{const result=await call(payload);let message='Configuração salva.';if(payload.mode==='process')message=!result.processed?'Nenhum evento pronto para envio.':result.success?'Evento entregue.':'Falha registrada.';toast(message);await refresh()}catch(e){toast(e.message)}}
 async function refresh(){
 try{const state=await call({mode:'list'});config.replaceChildren();list.replaceChildren();logs.replaceChildren(node('h4','Tentativas recentes'));
 if(state.destinations.length){const dest=wsSelectOptions('Destino autorizado',state.destinations.map(x=>[x,x]));config.append(dest.wrap,wsButton('Ativar novo destino',()=>run({mode:'create',destination:dest.sel.value})))}
 else config.append(node('p','Nenhum destino configurado no ambiente. Solicite a configuração de AGEND_WEBHOOK_DESTINATIONS.','sub'));
 const process=wsButton('Processar próximo evento',async()=>{if(!confirm('Enviar o próximo evento a um destino externo configurado para este quadro?'))return;process.disabled=true;await run({mode:'process'});process.disabled=false});config.append(process);
 for(const s of state.subscriptions){const row=node('div',undefined,'comment');row.append(node('b',s.destination+' · '+(!s.enabled?'Pausado':s.blocked?'Bloqueado após falhas':'Ativo')),node('p','Cursor '+s.cursor+' · '+s.attempts+' tentativa(s) pendente(s)','sub'));
 row.append(wsButton(s.enabled?'Pausar':'Retomar',()=>run({mode:s.enabled?'pause':'resume',id:s.id})));if(s.blocked||s.attempts)row.append(wsButton('Liberar nova tentativa',()=>run({mode:'retry',id:s.id})));list.append(row)}
 if(!state.subscriptions.length)list.append(node('p','Nenhuma inscrição.','empty'));
 for(const l of state.logs){const row=node('div',undefined,'comment');row.append(node('b',l.destination+' · Evento '+l.event_seq+' · '+(l.success?'Entregue':'Falha')),node('small','Tentativa '+l.attempt+' · '+(l.http_status?'HTTP '+l.http_status:'Sem resposta')+' · '+new Date(l.created_at).toLocaleString('pt-BR')));logs.append(row)}
 if(!state.logs.length)logs.append(node('p','Nenhuma tentativa registrada.','empty'));
 }catch(e){config.replaceChildren(node('p',e.message,'notice'))}}
 await refresh();
}
