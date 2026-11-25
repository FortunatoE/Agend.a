(function(root,factory){const m=factory();if(typeof module==='object'&&module.exports)module.exports=m;else root.AgendaDates=m})(globalThis,function(){
 const DAY=86400000;
 function key(value){
 if(value instanceof Date){if(!Number.isFinite(+value))return null;value=value.toISOString()}
 if(typeof value!=='string')return null;
 const m=/^(\d{4}-\d{2}-\d{2})(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/.exec(value.trim());
 if(!m)return null;
 const time=Date.parse(m[1]+'T00:00:00Z');return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===m[1]?m[1]:null;
 }
 const date=k=>new Date(k+'T00:00:00Z');
 const iso=d=>d.toISOString().slice(0,10);
 const today=(d=new Date())=>[String(d.getFullYear()).padStart(4,'0'),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 const format=(k,options)=>date(k).toLocaleDateString('pt-BR',{...options,timeZone:'UTC'});
 const label=v=>{const k=key(v);return k?format(k,{day:'2-digit',month:'short'}):v==null||v===''?'Sem prazo':'Prazo inválido'};
 function add(k,n){return iso(new Date(+date(k)+n*DAY))}
 function weekStart(k){return add(k,-((date(k).getUTCDay()+6)%7))}
 function monthDays(k){const d=date(k),first=k.slice(0,7)+'-01',start=weekStart(first);return Array.from({length:42},(_,i)=>{const day=add(start,i);return {key:day,inMonth:day.slice(0,7)===first.slice(0,7)}})}
 function shift(k,mode,n){
 if(mode==='diário'||mode==='semanal')return add(k,n*(mode==='semanal'?7:1));
 const d=date(k),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n*(mode==='anual'?12:1));
 const end=new Date(+d);end.setUTCMonth(end.getUTCMonth()+1,0);d.setUTCDate(Math.min(day,end.getUTCDate()));return iso(d);
 }
 function index(tasks){const byDay=new Map(),missing=[];for(const t of tasks){const k=key(t.due_date);if(!k){missing.push(t);continue}if(!byDay.has(k))byDay.set(k,[]);byDay.get(k).push(t)}return {byDay,missing}}
 function upcoming(tasks,now=today()){return tasks.filter(t=>t.status!=='concluída'&&key(t.due_date)&&key(t.due_date)>=now).sort((a,b)=>key(a.due_date).localeCompare(key(b.due_date))||a.id-b.id)}
 function overdue(t,now=today()){const k=key(t.due_date);return Boolean(k&&k<now&&t.status!=='concluída')}
 return {key,today,format,label,add,weekStart,monthDays,shift,index,upcoming,overdue};
});
