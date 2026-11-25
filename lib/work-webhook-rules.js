'use strict';
const crypto=require('node:crypto');
function destinations(raw=process.env.AGEND_WEBHOOK_DESTINATIONS||'{}'){
 let data;try{data=JSON.parse(raw)}catch{return new Map()}
 const map=new Map();
 for(const [alias,d] of Object.entries(data||{})){
 if(!/^[a-zA-Z0-9_-]{1,60}$/.test(alias)||typeof d?.url!=='string'||typeof d.secret!=='string'||d.secret.length<32)continue;
 try{const url=new URL(d.url);if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||url.hash||url.search||/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/i.test(url.hostname)||!url.hostname.includes('.'))continue;
 map.set(alias,{url:url.href,secret:d.secret})}catch{}
 }return map;
}
function signedPayload(row,secret,now=Math.floor(Date.now()/1000)){
 const deliveryId='agd:'+row.id+':'+row.seq;
 const body=JSON.stringify({id:deliveryId,board_id:row.board_id,cursor:String(row.seq),event:row.event,item_id:row.item_id,created_at:row.created_at});
 const signature=crypto.createHmac('sha256',secret).update(now+'.'+body).digest('hex');
 return {body,headers:{'Content-Type':'application/json','X-Agend-Delivery':deliveryId,'X-Agend-Timestamp':String(now),'X-Agend-Signature':'sha256='+signature}};
}
function retryDelay(attempt){return Math.min(60,2**Math.max(0,attempt-1))}
function workerAuthorized(req,secret=process.env.AGEND_WEBHOOK_WORKER_SECRET){
 const h=req.headers.authorization;if(typeof secret!=='string'||secret.length<32||typeof h!=='string')return false;
 const expected=Buffer.from('Bearer '+secret),actual=Buffer.from(h);
 return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);
}
async function sendWebhook(row,destination,fetcher=fetch){
 const signed=signedPayload(row,destination.secret);
 try{
 const response=await fetcher(destination.url,{method:'POST',headers:signed.headers,body:signed.body,redirect:'error',signal:AbortSignal.timeout(5000)});
 if(response.body)await response.body.cancel().catch(()=>{});
 return {ok:response.ok,status:response.status};
 }catch{return {ok:false,status:null}}
}
module.exports={destinations,signedPayload,retryDelay,workerAuthorized,sendWebhook};
