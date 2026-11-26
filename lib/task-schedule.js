'use strict';
const D=require('../dist/task-dates');
const kinds=['não se repete','diária','semanal','mensal','anual'];
function normalizeSchedule(kind,input,base){
 if(!kinds.includes(kind)||!D.key(base))throw Error('Recorrência ou prazo inválido.');
 const date=new Date(D.key(base)+'T00:00:00Z'),v=input??{};
 if(typeof v!=='object'||Array.isArray(v))throw Error('Configuração de recorrência inválida.');
 if(kind==='semanal'){const days=v.weekdays??[date.getUTCDay()];if(!Array.isArray(days)||!days.length||days.length>7||!days.every(d=>Number.isInteger(d)&&d>=0&&d<=6))throw Error('Selecione os dias da semana.');return {weekdays:[...new Set(days)].sort()}}
 if(kind==='mensal'||kind==='anual'){const day=v.day??date.getUTCDate(),month=v.month??date.getUTCMonth()+1;if(!Number.isInteger(day)||day<1||day>31||kind==='anual'&&(!Number.isInteger(month)||month<1||month>12))throw Error('Dia ou mês inválido.');return kind==='mensal'?{day}:{month,day}}
 return {};
}
function nextDate(value,kind,config){
 const k=D.key(value),c=normalizeSchedule(kind,config,k);if(kind==='não se repete')return null;
 if(kind==='diária')return D.add(k,1);
 if(kind==='semanal'){for(let n=1;n<=7;n++){const candidate=D.add(k,n);if(c.weekdays.includes(new Date(candidate+'T00:00:00Z').getUTCDay()))return candidate}}
 const d=new Date(k+'T00:00:00Z');
 for(let n=0;n<=12;n++){const month=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n,1));if(kind==='anual'&&month.getUTCMonth()+1!==c.month)continue;const last=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,0)).getUTCDate(),candidate=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),Math.min(c.day,last))).toISOString().slice(0,10);if(candidate>k)return candidate}
 throw Error('Não foi possível calcular a próxima ocorrência.');
}
const metadataKeys=['title','description','area','assignee','assignee_id','due_date','priority','recurrence','recurrence_config'];
const canManage=(user,t)=>Boolean(user.is_admin||user.can_edit&&t.assignee_id===user.id&&t.created_by===user.id);
const changesMetadata=d=>metadataKeys.some(k=>Object.hasOwn(d,k));
module.exports={normalizeSchedule,nextDate,canManage,changesMetadata,kinds};
