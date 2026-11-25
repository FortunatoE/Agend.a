/* Integration center: CSV exchange using the authenticated Board API. */
function wsExchangePanel(host,board){
 host.replaceChildren();
 const EC=AgendaExchange;
 const heading=node('h2','Importação e exportação'),intro=node('p','Transfira dados de planilhas XLSX, CSV e TSV sem alterar a estrutura do quadro.','sub');host.append(heading,intro);
 const call=payload=>api('/api/workspaces',{method:'POST',body:JSON.stringify({action:'exchange',board_id:board.id,...payload})});
 const download=wsButton('Exportar CSV',async()=>{download.disabled=true;try{
 const result=await call({mode:'export'});
 const blob=new Blob([result.csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=(board.name.replace(/[^a-zA-Z0-9À-ÿ_-]+/g,'_')||'quadro')+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast(result.count+' registros exportados.');
 }catch(e){toast(e.message)}finally{download.disabled=false}},'primary');
 const xlsx=wsButton('Exportar Excel (.xlsx)',async()=>{xlsx.disabled=true;try{
 const result=await call({mode:'export',format:'xlsx'});const bytes=Uint8Array.from(atob(result.xlsx),c=>c.charCodeAt(0));
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');
 a.href=url;a.download=(board.name.replace(/[^a-zA-Z0-9À-ÿ_-]+/g,'_')||'quadro')+'.xlsx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast(result.count+' registros exportados.');
 }catch(e){toast(e.message)}finally{xlsx.disabled=false}},'primary');
 host.append(download,xlsx);
 if(wsCan('create',board.id)){
 const panel=node('div',undefined,'panel'),form=node('div',undefined,'form');panel.append(node('h3','Importar registros'),node('p','Até 200 registros por lote, 500 mil caracteres. A primeira linha deve conter os cabeçalhos. XLSX: primeira aba, até 1,5 MB, sem fórmulas; cole valores antes de importar. A importação cria novos registros e dispara regras de criação.','sub'),form);host.append(panel);
 const file=node('input');file.type='file';file.accept='.xlsx,.csv,.tsv,text/csv,text/tab-separated-values';file.setAttribute('aria-label','Selecionar arquivo de planilha');form.append(file);
 const delimiter=wsSelectOptions('Separador',[[';','Ponto e vírgula (Excel Brasil)'],[',','Vírgula'],['\t','Tabulação']]);form.append(delimiter.wrap);
 const group=wsSelectOptions('Grupo de destino',[['','Sem grupo'],...(wsState.groups||[]).filter(g=>g.board_id===board.id).map(g=>[g.id,g.name])]);group.sel.required=false;form.append(group.wrap);
 const mappingHost=node('div',undefined,'form'),previewHost=node('div'),status=node('p','','sub');form.append(status,mappingHost,previewHost);
 const fields=wsState.fields.filter(f=>f.board_id===board.id&&EC.supported.includes(f.type));
 let raw='',revision=0,requestId=null,readMapping=null,busy=false;
 const preview=wsButton('Validar e visualizar',async()=>{
 if(!readMapping||busy)return;const version=revision;preview.disabled=true;commit.disabled=true;previewHost.replaceChildren();
 try{const result=await call({mode:'preview',csv:raw,delimiter:delimiter.sel.value,mapping:readMapping()});if(version!==revision)return;
 previewHost.append(node('h4',result.count+' registros · '+result.errorCount+' erros'));
 if(result.errorCount){for(const e of result.errors)previewHost.append(node('p','Linha de dados '+e.row+' · '+e.field+': '+e.message,'av-warning'));if(result.errorCount>result.errors.length)previewHost.append(node('p','Mais erros não exibidos.','sub'))}
 const table=node('table'),head=node('tr');head.append(node('th','Título'));const selected=readMapping().fields.map(m=>fields.find(f=>f.id===m.field_id));for(const f of selected)head.append(node('th',f.name));const thead=node('thead');thead.append(head);table.append(thead);const tbody=node('tbody');
 for(const row of result.preview){const tr=node('tr');tr.append(node('td',row.title));for(const f of selected){const v=row.values[f.id];tr.append(node('td',typeof v==='boolean'?(v?'Sim':'Não'):String(v??'')))}tbody.append(tr)}table.append(tbody);previewHost.append(table);
 if(!result.errorCount&&result.count){requestId=requestId||crypto.randomUUID();commit.disabled=false}
 }catch(e){if(version===revision)previewHost.append(node('p',e.message,'notice'))}finally{if(version===revision)preview.disabled=false}
 });
 const commit=wsButton('Importar registros',async()=>{
 if(!requestId||busy||commit.disabled)return;
 if(!confirm('Criar os registros validados? Automações e workflows de criação poderão executar.'))return;
 busy=true;commit.disabled=true;preview.disabled=true;file.disabled=delimiter.sel.disabled=group.sel.disabled=true;mappingHost.querySelectorAll('select').forEach(s=>s.disabled=true);
 try{const result=await call({mode:'import',csv:raw,delimiter:delimiter.sel.value,mapping:readMapping(),group_id:group.sel.value?Number(group.sel.value):null,request_id:requestId});toast('Importação #'+result.id+' · '+result.row_count+' registros.');await wsLoad()}
 catch(e){toast(e.message);status.textContent='Envio não confirmado. Tente novamente sem mudar o lote para evitar duplicidade.';commit.disabled=false}
 finally{busy=false;preview.disabled=false;file.disabled=delimiter.sel.disabled=group.sel.disabled=false;mappingHost.querySelectorAll('select').forEach(s=>s.disabled=false)}
 },'primary');preview.disabled=commit.disabled=true;
 function invalidate(){revision++;requestId=null;commit.disabled=true;previewHost.replaceChildren();preview.disabled=!readMapping}
 function configure(){readMapping=null;invalidate();mappingHost.replaceChildren();status.textContent='';if(!raw)return;
 try{const parsed=EC.parseCSV(raw,delimiter.sel.value);status.textContent=parsed.rows.length+' registros detectados · '+parsed.header.length+' colunas.';
 const options=parsed.header.map((h,i)=>[i,(i+1)+' · '+h]),title=wsSelectOptions('Coluna do título',options);mappingHost.append(title.wrap);
 const known=parsed.header.findIndex(h=>['título','titulo','nome','atividade','registro'].includes(h.toLowerCase()));title.sel.value=known>=0?known:0;title.sel.onchange=invalidate;
 const mapped=[];for(const f of fields){const sel=wsSelectOptions(f.name+' ('+f.type+')',[['','Não importar'],...options]);sel.sel.required=false;const match=parsed.header.findIndex(h=>h.toLowerCase()===f.name.toLowerCase());sel.sel.value=match>=0?match:'';sel.sel.onchange=invalidate;mappingHost.append(sel.wrap);mapped.push({f,sel:sel.sel})}
 readMapping=()=>({title:Number(title.sel.value),fields:mapped.filter(m=>m.sel.value!=='').map(m=>({field_id:m.f.id,column:Number(m.sel.value)}))});preview.disabled=false;
 }catch(e){status.textContent=e.message}}
 file.onchange=async()=>{const version=++revision;raw='';readMapping=null;invalidate();mappingHost.replaceChildren();const selected=file.files[0];if(!selected)return;if(selected.size>2000000){status.textContent='Arquivo muito grande.';return}const readVersion=revision;
 try{let value;if(/\.xlsx$/i.test(selected.name)){
 if(selected.size>1500000)throw Error('XLSX acima de 1,5 MB.');
 status.textContent='Lendo planilha Excel…';const bytes=new Uint8Array(await selected.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 value=(await call({mode:'decode_xlsx',xlsx:btoa(binary)})).csv;
 if(readVersion!==revision)return;delimiter.sel.value=';';
 }else value=await selected.text();
 if(readVersion!==revision)return;raw=value;configure()}catch(e){if(readVersion===revision)status.textContent=e.message}};
 delimiter.sel.onchange=configure;group.sel.onchange=invalidate;
 const controls=node('div',undefined,'actions');controls.append(preview,commit);form.append(controls);
 }
 const history=node('div',undefined,'panel');history.append(node('h3','Histórico de importações'));host.append(history);
 call({mode:'history'}).then(({runs})=>{if(!runs.length)history.append(node('p','Nenhuma importação disponível.','empty'));for(const run of runs){const row=node('div',undefined,'comment');row.append(node('b','Lote #'+run.id+' · '+run.row_count+' registros'),node('p',(run.actor||'Usuário indisponível')+' · '+new Date(run.created_at).toLocaleString('pt-BR'),'sub'));history.append(row)}}).catch(e=>history.append(node('p',e.message,'notice')));
}
