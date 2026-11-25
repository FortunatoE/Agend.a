(function(root,factory){const m=factory();if(typeof module==='object'&&module.exports)module.exports=m;else root.AgendaBoard=m})(globalThis,function(){
 const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 function filterItems(items,fields,p){
 const q=normalize(p.query).trim();const status=fields.find(f=>f.type==='status');
 const rows=items.filter(i=>{
 if(p.group!==''&&p.group!=null&&String(i.group_id??'none')!==String(p.group))return false;
 if(p.status!==''&&p.status!=null&&(!status||String(i.values?.[status.id]??'none')!==p.status))return false;
 return !q||[i.title,i.external_id,...fields.filter(f=>!f.config?.restricted&&['text','number','status','date'].includes(f.type)).map(f=>i.values?.[f.id])].some(v=>normalize(v).includes(q));
 });
 const order=p.order||'group';
 return rows.sort((a,b)=>order==='title'?a.title.localeCompare(b.title,'pt-BR')||a.id-b.id:order==='newest'?b.id-a.id:order==='oldest'?a.id-b.id:(a.group_id??0)-(b.group_id??0)||a.id-b.id);
 }
 function pageItems(rows,page,size){const total=Math.max(1,Math.ceil(rows.length/size)),current=Math.min(total,Math.max(1,page));return {rows:rows.slice((current-1)*size,current*size),page:current,total}}
 return {filterItems,pageItems};
});
