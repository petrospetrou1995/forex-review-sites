import {verifyAccess} from '../../admin/_middleware.js';
import {database,reply} from '../_shared.js';
import {onRequestPost as update} from '../update.js';
export async function onRequest({request,env}) {
  if(!await verifyAccess(request,env))return reply({error:'Unauthorized'},401);
  const db=database(env); if(!db)return reply({error:'Database not configured'},503);
  const url=new URL(request.url);const route=url.pathname.replace(/\/$/,'');
  if(request.method==='GET'&&route.endsWith('/events')){
    const {results=[]}=await db.prepare('SELECT id,kind,broker_id,previous,payload,actor,created_at FROM broker_events ORDER BY id DESC LIMIT 100').all();
    return reply({events:results.map(({previous,payload,...x})=>({...x,previous:previous?JSON.parse(previous):null,payload:JSON.parse(payload)}))});
  }
  if(request.method==='GET'&&route.endsWith('/brokers')){
    const {results=[]}=await db.prepare('SELECT data FROM brokers ORDER BY id LIMIT 500').all();
    return reply({brokers:results.map(row=>JSON.parse(row.data))});
  }
  if(request.method==='POST'&&route.endsWith('/update')){
    if(!env.BROKER_ADMIN_API_KEY || env.BROKER_ADMIN_API_KEY.length<32) return reply({error:'Server key not configured'},503);
    const modified=new Request(request,{headers:new Headers(request.headers)});
    modified.headers.set('X-API-Key',env.BROKER_ADMIN_API_KEY);
    return update({request:modified,env});
  }
  return reply({error:'Not found'},404);
}
