import {database,reply} from './_shared.js';
export async function onRequestGet({request,env}) {
  const db=database(env); if(!db) return reply({error:'Database not configured'},503);
  try {
    const since=new URL(request.url).searchParams.get('since');
    if(since!==null) {
      const ms=Date.parse(since); if(!Number.isFinite(ms)) return reply({error:'Invalid since timestamp'},400);
      const {results=[]}=await db.prepare('SELECT kind AS type, payload, created_at AS timestamp FROM broker_events WHERE created_at > ? ORDER BY id ASC LIMIT 500').bind(new Date(ms).toISOString()).all();
      return reply({updates:results.map(r=>({type:r.type,payload:JSON.parse(r.payload),timestamp:r.timestamp}))});
    }
    const {results=[]}=await db.prepare('SELECT data FROM brokers ORDER BY id LIMIT 500').all();
    return reply({brokers:results.map(r=>JSON.parse(r.data)),stats:{totalBrokers:results.length},lastSync:new Date().toISOString()});
  } catch { return reply({error:'Unable to retrieve broker data'},500); }
}
export async function onRequestHead(context) {
  const db=database(context.env);
  return new Response(null,{status:db?200:503,headers:{'Cache-Control':'no-store'}});
}
