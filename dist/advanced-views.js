/* Advanced views over the same board data. Preferences stay in this browser. */
const AV=AgendaAnalytics;
const avKey=(board,mode)=>'agenda-views-v1:'+current.id+':'+board.id+':'+mode;
function avPrefs(board,mode){try{return JSON.parse(localStorage.getItem(avKey(board,mode))||'{}')||{}}catch{return {}}}
function avSave(board,mode,p){try{localStorage.setItem(avKey(board,mode),JSON.stringify(p))}catch{}}
function avSelect(parent,label,options,value){const {wrap,sel}=wsSelectOptions(label,options);if(options.some(o=>String(o[0])===String(value)))sel.value=value;parent.append(wrap);return sel}
function avDate(value){return value?String(value).split('-').reverse().join('/'):'—'}
function avNumber(n){return n===null?'—':Number(n).toLocaleString('pt-BR',{maximumFractionDigits:2})}
function avCalendar(host,board,fields,items){
 const dates=fields.filter(f=>f.type==='date');if(!dates.length){host.append(node('p','Adicione um campo Data para usar o calendário.','notice'));return}
 const prefs=avPrefs(board,'calendar'),controls=node('div',undefined,'av-controls'),field=avSelect(controls,'Campo de data',dates.map(f=>[f.id,f.name]),prefs.field),today=new Date(),monthLabel=node('strong'),calendar=node('div',undefined,'av-calendar'),unscheduled=node('p',undefined,'sub');
 let year=today.getFullYear(),month=today.getMonth();
 function shift(n){const d=new Date(year,month+n,1);year=d.getFullYear();month=d.getMonth();draw()}
 controls.append(wsButton('‹',()=>shift(-1)),monthLabel,wsButton('›',()=>shift(1)),wsButton('Hoje',()=>{year=today.getFullYear();month=today.getMonth();draw()}));
 host.append(controls,calendar,unscheduled);
 function draw(){avSave(board,'calendar',{field:field.value});monthLabel.textContent=new Date(year,month,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});calendar.replaceChildren();
 for(const d of ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'])calendar.append(node('div',d,'av-weekday'));
 const events=new Map();let missing=0;for(const i of items){const d=i.values?.[field.value];if(AV.dayIndex(d)===null){missing++;continue}if(!events.has(d))events.set(d,[]);events.get(d).push(i)}
 for(const d of AV.monthGrid(year,month)){const cell=node('div',undefined,'av-day'+(d.inMonth?'':' av-other'));cell.append(node('b',String(Number(d.date.slice(-2)))));for(const i of events.get(d.date)||[]){const e=node('div',i.title,'event');e.title=i.title;cell.append(e)}calendar.append(cell)}
 unscheduled.textContent=missing+' registro(s) sem data válida neste filtro.'}
 field.onchange=draw;draw();
}
function avGantt(host,board,fields,items){
 const dates=fields.filter(f=>f.type==='date');if(!dates.length){host.append(node('p','Adicione campos Data para montar o cronograma.','notice'));return}
 const prefs=avPrefs(board,'gantt'),controls=node('div',undefined,'av-controls'),options=dates.map(f=>[f.id,f.name]);
 const start=avSelect(controls,'Início',options,prefs.start),end=avSelect(controls,'Fim',options,prefs.end||dates[1]?.id||dates[0].id);
 const relation=avSelect(controls,'Dependência (opcional)',[['','Sem vínculo'],...fields.filter(f=>f.type==='relation'&&f.config?.target_board_id===board.id).map(f=>[f.id,f.name])],prefs.relation);relation.required=false;
 const view=node('div'),summary=node('p',undefined,'sub');host.append(controls,summary,view);
 function draw(){avSave(board,'gantt',{start:start.value,end:end.value,relation:relation.value});view.replaceChildren();const {rows,invalid}=AV.schedule(items,start.value,end.value);
 summary.textContent=rows.length+' registros no cronograma · '+invalid.length+' sem datas válidas ou fim anterior ao início.';
 if(!rows.length){view.append(node('p','Nenhum período válido.','empty'));return}
 const from=rows[0].start,to=rows.reduce((max,r)=>Math.max(max,r.end),from),span=to-from+1;
 const warningMap=new Map((relation.value?AV.dependencyWarnings(rows,relation.value):[]).map(w=>[w.id,w]));
 const chart=node('div',undefined,'av-gantt');const header=node('div',undefined,'av-timeline-header');header.append(node('b','Registro / período'),node('span',avDate(AV.iso(from))+' — '+avDate(AV.iso(to))));chart.append(header);
 for(const row of rows){const line=node('div',undefined,'av-gantt-row'),name=node('div',undefined,'av-gantt-name'),track=node('div',undefined,'av-track'),bar=node('div',String(row.duration)+'d','av-gantt-bar'),w=warningMap.get(row.item.id);
 name.append(node('b',row.item.title),node('small',avDate(AV.iso(row.start))+' a '+avDate(AV.iso(row.end))));
 if(w?.conflicts.length||w?.missing.length)name.append(node('small',(w.conflicts.length?'Conflito de dependência · '+w.conflicts.length+' ': '')+(w.missing.length?'Vínculo fora do cronograma · '+w.missing.length:''),'av-warning'));
 bar.style.left=((row.start-from)/span*100)+'%';bar.style.width=(row.duration/span*100)+'%';bar.title=row.item.title+' · '+row.duration+' dias';track.append(bar);line.append(name,track);chart.append(line)}
 view.append(chart);if(relation.value)view.append(node('p','Vínculos são interpretados como predecessores; conflitos são avisos, não bloqueiam alterações. A pesquisa pode ocultar predecessores.','sub'));
 if(invalid.length){const d=node('details');d.append(node('summary','Registros fora do cronograma'));for(const i of invalid)d.append(node('p',i.title));view.append(d)}}
 start.onchange=end.onchange=relation.onchange=draw;draw();
}
function avWorkload(host,board,fields,items){
 const names=fields.filter(f=>f.type==='text');if(!names.length){host.append(node('p','Crie um campo Texto para identificar o responsável (um nome por registro).','notice'));return}
 const prefs=avPrefs(board,'workload'),controls=node('div',undefined,'av-controls'),person=avSelect(controls,'Responsável',names.map(f=>[f.id,f.name]),prefs.person),effort=avSelect(controls,'Esforço',[['','Contagem de registros'],...fields.filter(f=>['number','formula','rollup'].includes(f.type)).map(f=>[f.id,f.name])],prefs.effort);effort.required=false;
 const status=avSelect(controls,'Status',[['','Não filtrar concluídos'],...fields.filter(f=>f.type==='status').map(f=>[f.id,f.name])],prefs.status);status.required=false;
 const capLabel=node('label','Capacidade por responsável'),capacity=node('input');capacity.type='number';capacity.min='0.01';capacity.step='any';capacity.value=prefs.capacity||40;capLabel.append(capacity);controls.append(capLabel);
 const results=node('div');host.append(controls,results);
 function draw(){const c=Number(capacity.value);avSave(board,'workload',{person:person.value,effort:effort.value,status:status.value,capacity:capacity.value});results.replaceChildren();
 if(!Number.isFinite(c)||c<=0){results.append(node('p','Informe uma capacidade maior que zero.','notice'));return}
 const {rows,missingEffort}=AV.workload(items,person.value,effort.value,c,status.value,Boolean(status.value));
 results.append(node('p','Capacidade uniforme, na unidade do esforço escolhido. Considera todos os registros do filtro atual. '+missingEffort+' esforço(s) inválido(s) ou ausente(s) tratados como zero.','sub'));
 for(const row of rows){const box=node('div',undefined,'av-load'),labels=node('div',undefined,'av-load-label'),track=node('div',undefined,'bar'),fill=node('i');labels.append(node('b',row.name),node('span',avNumber(row.effort)+' / '+avNumber(c)+' · '+avNumber(row.utilization)+'% · '+row.count+' registros',row.utilization>100?'av-warning':''));fill.style.width=Math.min(100,row.utilization)+'%';if(row.utilization>100)fill.style.background='var(--red)';track.append(fill);box.append(labels,track);results.append(box)}
 if(!rows.length)results.append(node('p','Sem registros neste filtro.','empty'))}
 person.onchange=effort.onchange=status.onchange=capacity.oninput=draw;draw();
}
function avDashboard(host,board,fields,items){
 const prefs=avPrefs(board,'dashboard');let widgets=Array.isArray(prefs.widgets)?prefs.widgets.slice(0,20):[];
 const controls=node('div',undefined,'av-controls'),source=avSelect(controls,'Board de origem',wsState.boards.map(b=>[b.id,(wsState.workspaces.find(w=>w.id===b.workspace_id)?.name||'')+' / '+b.name]),board.id),op=avSelect(controls,'Indicador',[['count','Total de registros'],['done','Concluídos'],['completion','% concluído'],['sum','Soma'],['avg','Média'],['min','Mínimo'],['max','Máximo']],'count'),fieldHost=node('div'),grid=node('div',undefined,'av-widgets');controls.append(fieldHost);let field;
 function choose(){fieldHost.replaceChildren();const candidates=wsState.fields.filter(f=>f.board_id===Number(source.value)&&(op.value==='done'||op.value==='completion'?f.type==='status':['number','formula','rollup'].includes(f.type)));field=op.value==='count'?null:avSelect(fieldHost,'Campo',candidates.map(f=>[f.id,f.name]));}
 source.onchange=op.onchange=choose;choose();
 controls.append(wsButton('+ Indicador',()=>{if(widgets.length>=20)return toast('Limite de 20 indicadores.');if(op.value!=='count'&&!field?.value)return toast('Selecione um campo compatível.');widgets.push({board_id:Number(source.value),field_id:field?Number(field.value):null,op:op.value});save()},'primary'));
 host.append(controls,node('p','Painel personalizado por usuário neste navegador. A busca filtra os indicadores do Board atual; outros Boards usam todos os seus registros.','sub'),grid);
 const labels={count:'Total de registros',done:'Concluídos',completion:'% concluído',sum:'Soma',avg:'Média',min:'Mínimo',max:'Máximo'};
 function save(){avSave(board,'dashboard',{widgets});draw()}
 function draw(){grid.replaceChildren();const entries=widgets.length?widgets:[{board_id:board.id,op:'count',field_id:null}];
 entries.forEach((w,i)=>{const b=wsState.boards.find(b=>b.id===w.board_id),f=wsState.fields.find(f=>f.id===w.field_id&&f.board_id===w.board_id);if(!b||!labels[w.op]||(w.op!=='count'&&!f))return;
 const rows=b.id===board.id?items:wsState.items.filter(i=>i.board_id===b.id),value=AV.metric(rows,w.field_id,w.op),card=node('div',undefined,'stat');
 card.append(node('span',b.name+' · '+labels[w.op]+(f?' · '+f.name:'')),node('strong',avNumber(value)+(w.op==='completion'?'%':'')));
 if(widgets.length)card.append(wsButton('Remover',()=>{widgets.splice(i,1);save()}));grid.append(card)})}
 draw();
}
