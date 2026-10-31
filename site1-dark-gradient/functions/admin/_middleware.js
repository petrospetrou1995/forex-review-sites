// Cloudflare Access must also protect /admin/* and /api/admin/* with an Access application policy.
// This middleware independently verifies the signed JWT, issuer, expiry, and audience.
const reject=()=>new Response('Unauthorized',{status:401,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
export async function verifyAccess(request,env) {
  const team=env.ACCESS_TEAM_DOMAIN, audience=env.ACCESS_AUD;
  if(!team||!audience||!/^https:\/\/[a-z0-9.-]+$/i.test(team)) return false;
  const token=request.headers.get('Cf-Access-Jwt-Assertion')||'';
  const segments=token.split('.'); if(segments.length!==3) return false;
  try {
    const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
    const header=JSON.parse(new TextDecoder().decode(decode(segments[0])));
    const payload=JSON.parse(new TextDecoder().decode(decode(segments[1])));
    const issuer=team.replace(/\/$/,'');
    const now=Math.floor(Date.now()/1000);
    if(header.alg!=='RS256'||typeof header.kid!=='string'||payload.iss!==issuer||!Array.isArray(payload.aud)||!payload.aud.includes(audience)||!Number.isFinite(payload.exp)||payload.exp<=now||!Number.isFinite(payload.iat)||payload.iat>now+60||(payload.nbf!==undefined&&(!Number.isFinite(payload.nbf)||payload.nbf>now))||typeof payload.sub!=='string'||!payload.sub) return false;
    const response=await fetch(issuer+'/cdn-cgi/access/certs');
    if(!response.ok) return false;
    const jwks=await response.json();
    const jwk=jwks.keys?.find(k=>k.kid===header.kid&&k.kty==='RSA');
    if(!jwk) return false;
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(segments[2]),new TextEncoder().encode(segments[0]+'.'+segments[1]));
  }catch{return false}
}
export async function onRequest({request,env,next}) {
  if(!await verifyAccess(request,env))return reject();
  const response=await next();
  response.headers.set('Cache-Control','no-store');response.headers.set('X-Robots-Tag','noindex');
  return response;
}
