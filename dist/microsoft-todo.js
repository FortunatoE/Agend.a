/* Microsoft To Do: explicit account consent and bounded personal sync. */
const msEndpoint=action=>'/api/tasks?microsoft='+action;
let msSyncBusy=false,msTimer=null,msPanelVersion=0;
const msPref=()=> 'agend-ms-auto-'+current.id;
function msAuto(){try{return localStorage.getItem(msPref())==='1'}catch{return false}}
async function msRun(button,quiet=false){
 if(msSyncBusy)return;msSyncBusy=true;if(button)button.disabled=true;
 try{
 const s=await api(msEndpoint('status'));if(!s.configured||!s.connected||s.busy)return;
 const result=await api(msEndpoint('sync'),{method:'POST',body:'{}'});
 if(!quiet)toast(result.error?'Sincronização parcial: '+msError(result.error):'Sincronização registrada.','info');
 if(view==='settings')await settings();else if(!$('#modal').classList.contains('open')&&['myday','overview','table','kanban','calendar','routines'].includes(view))await load();
 }catch(e){if(!quiet)toast(e.message,'error')}finally{msSyncBusy=false;if(button)button.disabled=false}
}
function msError(k){return ({'authorization':'Reconecte a conta e verifique as permissões.','rate-limit':'Limite temporário da Microsoft; tente novamente mais tarde.','list-not-private':'A lista não é privada ou não pertence à conta.','list-uncertain':'Criação da lista não confirmada. Verifique no To Do; não será duplicada.','list-too-large':'Lista excede o limite de recuperação.','network':'Falha de comunicação com a Microsoft.','sync-failed':'Falha de sincronização.'})[k]||'Não foi possível confirmar a operação.'}
async function renderMicrosoftSettings(host){
 const version=++msPanelVersion,p=node('section',undefined,'panel');p.append(node('h2','Integrações · Microsoft To Do'),node('p','Conecte sua própria conta corporativa e sincronize somente suas atividades.','sub'),node('p','Carregando…','sub'));host.append(p);
 try{
 const s=await api(msEndpoint('status'));if(!p.isConnected||version!==msPanelVersion)return;
 p.replaceChildren(node('h2','Integrações · Microsoft To Do'),node('p','A Agend.a continua sendo a fonte do planejamento.','sub'));
 if(s.configured!==true){p.append(node('p','Integração indisponível: configuração do Microsoft Entra pendente.','notice'));return}
 if(!s.connected){
 p.append(node('p',s.account_name?'Conta desconectada: '+s.account_name:'Nenhuma conta conectada.','sub'));
 p.append(node('p','Ao conectar e sincronizar, títulos, prazos, prioridades e status das suas atividades serão copiados para uma lista privada da Microsoft. Descrições, anexos, checklists e dados de outros usuários não serão enviados.','sub'));
 const b=wsButton(s.account_name?'Reconectar mesma conta':'Conectar conta Microsoft',async()=>{b.disabled=true;try{const x=await api(msEndpoint('connect'),{method:'POST',body:'{}'});const u=new URL(x.url);if(u.origin!=='https://login.microsoftonline.com')throw Error('Destino inválido.');location.assign(u.href)}catch(e){toast(e.message,'error');b.disabled=false}},'primary');p.append(b);return;
 }
 p.append(node('b','Conectado: '+s.account_name),node('p','Lista: '+s.list_name,'sub'),node('p',s.last_sync_at?'Última tentativa: '+new Date(s.last_sync_at).toLocaleString('pt-BR'):'Ainda não sincronizado.','sub'));
 const result=s.last_result||{};
 p.append(node('p','Último lote: '+(result.created||0)+' criada(s), '+(result.updated||0)+' atualizada(s), '+(result.completed||0)+' concluída(s) importada(s).','sub'));
 if(result.error)p.append(node('p',msError(result.error),'notice'));
 if(result.missing||result.uncertain||result.failed||result.pending)p.append(node('p','Pendências do lote: '+(result.missing||0)+' ausentes, '+(result.uncertain||0)+' não confirmadas, '+(result.failed||0)+' falhas, '+(result.pending||0)+' restantes.','notice'));
 if(s.stale)p.append(node('p',s.stale+' cópia(s) externa(s) de atividades removidas ou reatribuídas. Remova-as manualmente no To Do. Não podem concluir atividades de outro usuário.','notice'));
 const auto=node('input');auto.type='checkbox';auto.checked=msAuto();const wrap=node('label','');wrap.append(auto,document.createTextNode(' Sincronizar a cada 5 minutos enquanto esta sessão estiver aberta e visível'));auto.onchange=()=>{try{localStorage.setItem(msPref(),auto.checked?'1':'0')}catch{}};
 p.append(wrap,node('p','A sincronização envia pequenos lotes. Não há execução em segundo plano com o navegador fechado.','sub'));
 const actions=node('div',undefined,'actions'),run=wsButton('Sincronizar agora',()=>msRun(run),'primary');run.disabled=Boolean(s.busy);
 const reconnect=wsButton('Reconectar',async()=>{try{const x=await api(msEndpoint('connect'),{method:'POST',body:'{}'});const u=new URL(x.url);if(u.origin!=='https://login.microsoftonline.com')throw Error('Destino inválido.');location.assign(u.href)}catch(e){toast(e.message,'error')}});
 const disconnect=wsButton('Desconectar',async()=>{if(!confirm('Desconectar esta conta? As tarefas já copiadas permanecem no Microsoft To Do.'))return;try{await api(msEndpoint('disconnect'),{method:'POST',body:'{}'});try{localStorage.removeItem(msPref())}catch{}await settings();toast('Conta desconectada.','success')}catch(e){toast(e.message,'error')}});
 actions.append(run,reconnect,disconnect);p.append(actions);
 }catch(e){if(p.isConnected&&version===msPanelVersion)p.replaceChildren(node('h2','Integrações · Microsoft To Do'),node('p','Não foi possível consultar a integração.','sub'),wsButton('Tentar novamente',()=>settings()))}
}
function startMicrosoftTodo(){
 if(msTimer)return;
 msTimer=setInterval(()=>{if(!current||document.hidden||!msAuto()||msSyncBusy||$('#modal').classList.contains('open')||!['myday','overview','table','kanban','calendar','routines'].includes(view)||document.activeElement?.matches('input,select,textarea')||typeof taskDragId!=='undefined'&&taskDragId!==null||typeof dayBusy!=='undefined'&&dayBusy)return;msRun(null,true)},300000);
 const params=new URLSearchParams(location.search),result=params.get('ms_todo');if(result){params.delete('ms_todo');history.replaceState(null,'',location.pathname+(params.size?'?'+params.toString():'')+location.hash);view='settings';render();toast(result==='connected'?'Conta Microsoft vinculada.':result==='account-conflict'?'Conta já vinculada a outro usuário ou diferente da conta anterior.':'Não foi possível conectar; confira a autorização. ',result==='connected'?'success':'error')}
}
