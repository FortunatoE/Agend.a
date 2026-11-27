'use strict';
const crypto=require('node:crypto');
const SCOPES='https://graph.microsoft.com/Tasks.ReadWrite https://graph.microsoft.com/User.Read offline_access';
const GRAPH='https://graph.microsoft.com';
const random=()=>crypto.randomBytes(32).toString('base64url');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const challenge=v=>crypto.createHash('sha256').update(v).digest('base64url');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function config(env=process.env){
 const tenant=env.MS_TODO_TENANT_ID,client=env.MS_TODO_CLIENT_ID,secret=env.MS_TODO_CLIENT_SECRET,key=env.MS_TODO_ENCRYPTION_KEY;
 let url;try{url=new URL(env.MS_TODO_REDIRECT_URI)}catch{return null}
 if(!uuid.test(tenant||'')||!uuid.test(client||'')||!secret||!/^[a-f0-9]{64}$/i.test(key||'')||url.protocol!=='https:'||url.username||url.password||url.hash||url.pathname!=='/api/tasks'||url.search!=='?microsoft=callback')return null;
 return {tenant,client,secret,key:Buffer.from(key,'hex'),redirect:url.href,origin:url.origin,authority:'https://login.microsoftonline.com/'+tenant+'/oauth2/v2.0'};
}
function seal(value,c,context){
 const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',c.key,nonce);
 cipher.setAAD(Buffer.from(context));
 const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 return [nonce,cipher.getAuthTag(),data].map(x=>x.toString('base64url')).join('.');
}
function unseal(value,c,context){
 const parts=value.split('.').map(x=>Buffer.from(x,'base64url'));if(parts.length!==3||parts[0].length!==12||parts[1].length!==16)throw Error('invalid credential');
 const d=crypto.createDecipheriv('aes-256-gcm',c.key,parts[0]);d.setAAD(Buffer.from(context));d.setAuthTag(parts[1]);return Buffer.concat([d.update(parts[2]),d.final()]).toString('utf8');
}
function authUrl(c,state,verifier){return c.authority+'/authorize?'+new URLSearchParams({client_id:c.client,response_type:'code',response_mode:'query',redirect_uri:c.redirect,scope:SCOPES,state,code_challenge:challenge(verifier),code_challenge_method:'S256',prompt:'select_account'})}
class ProviderError extends Error{constructor(status,kind='provider'){super(kind);this.status=status;this.kind=kind}}
async function request(url,options,fetcher=fetch){
 let res;try{res=await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(6000)})}catch{throw new ProviderError(0,'network')}
 if(!res.ok)throw new ProviderError(res.status);
 if(res.status===204)return null;
 try{return await res.json()}catch{throw new ProviderError(0,'invalid-response')}
}
async function token(c,values,fetcher=fetch){
 const result=await request(c.authority+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.client,client_secret:c.secret,scope:SCOPES,redirect_uri:c.redirect,...values})},fetcher);
 if(typeof result.access_token!=='string'||!result.access_token||result.token_type?.toLowerCase()!=='bearer')throw new ProviderError(0,'invalid-token');
 return result;
}
function graphUrl(path){
 const u=new URL(path,GRAPH+'/v1.0/');
 if(u.origin!==GRAPH||!u.pathname.startsWith('/v1.0/')||u.username||u.password||u.hash)throw Error('invalid Graph destination');
 return u.href;
}
async function graph(access,path,method='GET',data,fetcher=fetch){
 return request(graphUrl(path),{method,headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})},fetcher);
}
async function collection(access,path,fetcher=fetch){
 const rows=[];let next=path;
 for(let i=0;i<12&&next;i++){const r=await graph(access,next,'GET',undefined,fetcher);if(!Array.isArray(r?.value))throw new ProviderError(0,'invalid-response');rows.push(...r.value);next=r['@odata.nextLink']}
 if(next)throw new ProviderError(0,'list-too-large');return rows;
}
const taskPath=(list,id)=>'me/todo/lists/'+encodeURIComponent(list)+'/tasks'+(id?'/'+encodeURIComponent(id):'');
const markerText=m=>'Agend.a · vínculo '+m;
const {key:dateKey}=require('../dist/task-dates');
function payload(t,marker){
 const day=dateKey(t.due_date);
 return {title:String(t.title).slice(0,255),body:{contentType:'text',content:markerText(marker)},importance:t.priority==='alta'?'high':t.priority==='baixa'?'low':'normal',status:t.status==='concluída'?'completed':t.status==='andamento'||t.status==='revisão'?'inProgress':'notStarted',...(day?{dueDateTime:{dateTime:day+'T12:00:00',timeZone:'Central Brazilian Standard Time'}}:{})};
}
function shouldImport(t,m,remote,canEdit){return Boolean(canEdit&&remote.status==='completed'&&m.last_status&&m.last_status!=='concluída'&&t.status===m.last_status&&t.status!=='concluída')}
function samePayload(remote,desired){
 return remote.title===desired.title&&remote.importance===desired.importance&&remote.status===desired.status&&(!desired.dueDateTime||String(remote.dueDateTime?.dateTime||'').slice(0,10)===desired.dueDateTime.dateTime.slice(0,10));
}
module.exports={config,random,hash,challenge,seal,unseal,authUrl,token,graph,graphUrl,collection,taskPath,markerText,payload,shouldImport,samePayload,ProviderError};
