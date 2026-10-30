import {decode64,HttpError} from './core.mjs';
const keyCache = new Map();
export async function verifyJWT(token, {issuer,audience,jwksURL}) {
  if(typeof token!=='string'||token.length>12000) throw new HttpError(401,'Sign in to continue.');
  const parts=token.split('.'); if(parts.length!==3) throw new HttpError(401,'Sign in to continue.');
  let head,payload;
  try { head=JSON.parse(new TextDecoder().decode(decode64(parts[0]))); payload=JSON.parse(new TextDecoder().decode(decode64(parts[1]))); } catch { throw new HttpError(401,'Sign in to continue.'); }
  const now=Date.now()/1000;
  if(head.alg!=='RS256'||typeof head.kid!=='string'||!Number.isFinite(payload.exp)||payload.exp<=now||payload.exp>now+86400*8||payload.nbf>now+30||payload.iat>now+30||!issuer.includes(payload.iss)||!(Array.isArray(payload.aud)?payload.aud:[payload.aud]).includes(audience)) throw new HttpError(401,'Sign in to continue.');
  let cached=keyCache.get(jwksURL);
  if(!cached||cached.expires<now||!cached.keys.some(k=>k.kid===head.kid)) {
    const response=await fetch(jwksURL,{signal:AbortSignal.timeout(8000)});
    if(!response.ok) throw new HttpError(503,'Sign-in verification is unavailable.');
    const data=await response.json(); if(!Array.isArray(data.keys))throw new HttpError(503,'Sign-in verification is unavailable.');
    cached={keys:data.keys,expires:now+600}; keyCache.set(jwksURL,cached);
  }
  const jwk=cached.keys.find(k=>k.kid===head.kid&&k.kty==='RSA');
  if(!jwk)throw new HttpError(401,'Sign in to continue.');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode64(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))throw new HttpError(401,'Sign in to continue.');
  return payload;
}
export async function requireAdmin(request,env) {
  if(!env.ACCESS_TEAM||!env.ACCESS_AUD||!env.ADMIN_EMAIL||!/^[a-z0-9-]+$/.test(env.ACCESS_TEAM)) throw new HttpError(503,'Private access is not configured yet.');
  const issuer=`https://${env.ACCESS_TEAM}.cloudflareaccess.com`;
  const identity=await verifyJWT(request.headers.get('Cf-Access-Jwt-Assertion'),{issuer:[issuer],audience:env.ACCESS_AUD,jwksURL:issuer+'/cdn-cgi/access/certs'});
  if(typeof identity.email!=='string'||identity.email.toLowerCase()!==env.ADMIN_EMAIL.toLowerCase())throw new HttpError(403,'This page is private.');
  return identity;
}
