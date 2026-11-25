(function(root,factory){
 const core=factory();
 if(typeof module==='object'&&module.exports)module.exports=core;
 else root.AgendaAnalytics=core;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const DAY=86400000;
 function dayIndex(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const ms=Date.parse(value+'T00:00:00Z');
 if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==value)return null;
 return ms/DAY;
 }
 const iso=n=>new Date(n*DAY).toISOString().slice(0,10);
 function monthGrid(year,month){
 const first=Date.UTC(year,month,1)/DAY;
 const start=first-new Date(first*DAY).getUTCDay();
 return Array.from({length:42},(_,i)=>({date:iso(start+i),inMonth:new Date((start+i)*DAY).getUTCMonth()===month}));
 }
 function schedule(items,startField,endField){
 const rows=[],invalid=[];
 for(const i of items){
 const a=dayIndex(i.values?.[startField]),b=dayIndex(i.values?.[endField]);
 if(a===null||b===null||b<a){invalid.push(i);continue}
 rows.push({item:i,start:a,end:b,duration:b-a+1});
 }
 rows.sort((a,b)=>a.start-b.start||a.end-b.end||a.item.id-b.item.id);
 return {rows,invalid};
 }
 function dependencyWarnings(rows,relationField){
 const byId=new Map(rows.map(r=>[r.item.id,r]));
 return rows.map(row=>{
 const raw=row.item.values?.[relationField];
 const ids=Array.isArray(raw)?raw:[];
 return {id:row.item.id,conflicts:ids.filter(id=>byId.has(id)&&byId.get(id).end>=row.start),missing:ids.filter(id=>!byId.has(id))};
 });
 }
 function workload(items,personField,effortField,capacity,statusField,excludeDone=false){
 const map=new Map();let missingEffort=0;
 for(const i of items){
 if(excludeDone&&statusField&&i.values?.[statusField]==='Concluído')continue;
 const raw=i.values?.[personField],name=typeof raw==='string'&&raw.trim()?raw.trim():'Sem responsável';
 const v=effortField?i.values?.[effortField]:1;
 const valid=typeof v==='number'&&Number.isFinite(v)&&v>=0;
 if(!valid)missingEffort++;
 const row=map.get(name)||{name,count:0,effort:0};
 row.count++;row.effort+=valid?v:0;map.set(name,row);
 }
 return {rows:[...map.values()].map(r=>({...r,utilization:capacity>0?r.effort/capacity*100:null})).sort((a,b)=>b.effort-a.effort||a.name.localeCompare(b.name)),missingEffort};
 }
 function metric(items,field,op){
 if(op==='count')return items.length;
 if(op==='done')return items.filter(i=>i.values?.[field]==='Concluído').length;
 if(op==='completion')return items.length?items.filter(i=>i.values?.[field]==='Concluído').length/items.length*100:0;
 const vals=items.map(i=>i.values?.[field]).filter(v=>typeof v==='number'&&Number.isFinite(v));
 if(op==='sum')return vals.reduce((a,b)=>a+b,0);
 if(!vals.length)return null;
 if(op==='avg')return vals.reduce((a,b)=>a+b,0)/vals.length;
 if(op==='min')return vals.reduce((a,b)=>Math.min(a,b));
 if(op==='max')return vals.reduce((a,b)=>Math.max(a,b));
 return null;
 }
 return {dayIndex,iso,monthGrid,schedule,dependencyWarnings,workload,metric};
});
