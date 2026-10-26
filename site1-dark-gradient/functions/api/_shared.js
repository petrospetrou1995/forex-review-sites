export function reply(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'
  } });
}
export function database(env) { return env?.BROKERS_DB?.prepare ? env.BROKERS_DB : null; }
export async function authorized(request, env) {
  const expected = env?.BROKER_ADMIN_API_KEY;
  const provided = request.headers.get('X-API-Key') || '';
  if (typeof expected !== 'string' || expected.length < 32 || !provided || provided.length !== expected.length) return false;
  const encoder = new TextEncoder();
  const [a,b] = await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(provided)),crypto.subtle.digest('SHA-256',encoder.encode(expected))]);
  const x=new Uint8Array(a),y=new Uint8Array(b); let diff=0;
  for(let i=0;i<x.length;i++) diff |= x[i]^y[i];
  return diff===0;
}
export function validateBroker(value) {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Broker must be an object');
  const keys=['id','name','rating','minDeposit','spreads','platforms','regulation','leverage','commission','currency'];
  if(Object.keys(value).some(k=>!keys.includes(k))) throw new Error('Unknown broker field');
  if(typeof value.id!=='string'|| !/^[a-z0-9_-]{1,80}$/.test(value.id)) throw new Error('Invalid broker id');
  if(typeof value.name!=='string'||!value.name.trim()||value.name.length>120) throw new Error('Invalid broker name');
  if(value.rating!==undefined && (typeof value.rating!=='number'||!Number.isFinite(value.rating)||value.rating<0||value.rating>5)) throw new Error('Invalid rating');
  if(value.minDeposit!==undefined && (typeof value.minDeposit!=='number'||!Number.isFinite(value.minDeposit)||value.minDeposit<0)) throw new Error('Invalid deposit');
  if(value.commission!==undefined && (typeof value.commission!=='number'||!Number.isFinite(value.commission)||value.commission<0)) throw new Error('Invalid commission');
  for(const field of ['platforms','regulation']) if(value[field]!==undefined && (!Array.isArray(value[field])||value[field].length>30||value[field].some(s=>typeof s!=='string'||s.length>100))) throw new Error('Invalid '+field);
  if(value.spreads!==undefined && (!value.spreads||typeof value.spreads!=='object'||Array.isArray(value.spreads)||Object.keys(value.spreads).length>50||Object.entries(value.spreads).some(([k,v])=>k.length>40||typeof v!=='number'||!Number.isFinite(v)||v<0))) throw new Error('Invalid spreads');
  for(const field of ['leverage','currency']) if(value[field]!==undefined && (typeof value[field]!=='string'||value[field].length>32)) throw new Error('Invalid '+field);
  return value;
}
