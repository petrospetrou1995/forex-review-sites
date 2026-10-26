import {authorized,database,reply,validateBroker} from './_shared.js';
export async function onRequestPost({request,env}) {
  const db=database(env); if(!db) return reply({error:'Database not configured'},503);
  if(!(await authorized(request,env))) return reply({error:'Unauthorized'},401);
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json')) return reply({error:'JSON required'},415);
  const size=Number(request.headers.get('content-length')||0);
  if(size>65536) return reply({error:'Payload too large'},413);
  let body;try{const raw=await request.text();if(raw.length>65536)return reply({error:'Payload too large'},413);body=JSON.parse(raw);}catch{return reply({error:'Invalid JSON'},400)}
  if(!body||typeof body!=='object'||Array.isArray(body)||!['new_broker','broker_update','delete_broker'].includes(body.type)) return reply({error:'Unsupported update type'},400);
  const now=new Date().toISOString();let payload, id;
  try {
    if(body.type==='delete_broker') {
      id=body.payload?.id;
      if(typeof id!=='string'||!/^[a-z0-9_-]{1,80}$/.test(id)) throw new Error('Invalid broker id');
      payload={id};
    } else {payload=validateBroker(body.payload);id=payload.id;}
  }catch(error){return reply({error:error.message},400)}
  try {
    const prior=await db.prepare('SELECT data FROM brokers WHERE id=?').bind(id).first();
    if(body.type==='new_broker'&&prior) return reply({error:'Broker already exists'},409);
    if(body.type!=='new_broker'&&!prior) return reply({error:'Broker not found'},404);
    const next=body.type==='delete_broker'?null:body.type==='new_broker'?payload:validateBroker({...JSON.parse(prior.data),...payload});
    const actor='api-key';
    const statements=[
      body.type==='delete_broker'
        ?db.prepare('DELETE FROM brokers WHERE id=?').bind(id)
        :db.prepare('INSERT INTO brokers (id,data,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at').bind(id,JSON.stringify(next),now),
      db.prepare('INSERT INTO broker_events (kind,broker_id,payload,previous,actor,created_at) VALUES (?,?,?,?,?,?)').bind(body.type,id,JSON.stringify(payload),prior?.data||null,actor,now)
    ];
    await db.batch(statements);
    return reply({success:true,type:body.type,payload:next??payload,timestamp:now});
  }catch{return reply({error:'Update failed'},500)}
}
