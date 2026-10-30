import {HttpError,randomToken,sha256,keyedHash,parseSubmission,validateTimeWindow,encrypt} from './core.mjs';
import {consume} from './store.mjs';
import {requireAdmin,verifyJWT} from './auth.mjs';
import {dispatch} from './mail.mjs';

const secureHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...secureHeaders,'Content-Type':'application/json; charset=utf-8'}});
function sameOrigin(request) { if(request.headers.get('Origin')!==new URL(request.url).origin)throw new HttpError(403,'Reload this page and try again.'); }
async function bodyJSON(request) {
  if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))throw new HttpError(415,'Send JSON only.');
  if(Number(request.headers.get('Content-Length'))>8192)throw new HttpError(413,'That note is too large.');
  const reader=request.body?.getReader(); if(!reader)throw new HttpError(400,'Check the form.');
  const chunks=[]; let length=0;
  try { while(true) { const {done,value}=await reader.read(); if(done)break; length+=value.byteLength; if(length>8192){await reader.cancel();throw new HttpError(413,'That note is too large.');} chunks.push(value); } } finally {reader.releaseLock();}
  const bytes=new Uint8Array(length); let pos=0; for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new HttpError(400,'Check the form.');}
}
async function rateLimit(request,env) {
  if(!env.RATE_SECRET)throw new HttpError(503,'The mailbox is taking a break. Try later.');
  const now=Date.now(),window=Math.floor(now/300000);
  const ip=request.headers.get('CF-Connecting-IP')??'local';
  const key=await keyedHash(env.RATE_SECRET,`submit:${window}:${ip}`);
  const row=await env.DB.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,(window+1)*300000).first();
  if(row.count>20)throw new HttpError(429,'Easy, astronaut. Try again in a few minutes.');
}
async function publicSubmit(request,env,ctx) {
  const origin=request.headers.get('Origin');
  if(origin!==env.PUBLIC_ORIGIN&&origin!==new URL(request.url).origin)throw new HttpError(403,'Use the SLOT page to send this.');
  if(!env.DB)throw new HttpError(503,'The mailbox is not open yet.');
  await rateLimit(request,env);
  const body=await bodyJSON(request),now=Date.now();
  const proposal=parseSubmission(body),hash=await sha256(body.code);
  // An authenticated, unchanged retry keeps the original acceptance time.
  // consume still checks its digest, so this cannot change an old proposal.
  const previous=await env.DB.prepare('SELECT created_at FROM requests WHERE id=? AND code_hash=?').bind(body.requestId,hash).first();
  validateTimeWindow(proposal,previous?.created_at??now);
  // Do not spend invitations while owner authorization is incomplete.
  if(!env.MAILBOX||!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.TOKEN_ENCRYPTION_KEY||!await env.DB.prepare("SELECT key FROM settings WHERE key='gmail_refresh'").first())throw new HttpError(503,'The mailbox is not open yet. Your code was not used.');
  const result=await consume(env.DB,{id:body.requestId,hash,digest:await sha256(JSON.stringify(proposal)),proposal,now,limit:Math.min(100,Math.max(1,Number(env.DAILY_SEND_LIMIT)||20))});
  await dispatch(env,1);
  const delivery=await env.DB.prepare('SELECT state FROM outbox WHERE request_id=?').bind(body.requestId).first();
  return json({...result,delivery:delivery?.state??'pending'},202);
}
async function oauthCallback(request,env) {
  const url=new URL(request.url),state=url.searchParams.get('state'),code=url.searchParams.get('code');
  const cookie=request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-slot_oauth='))?.split('=')[1];
  if(!state||!code||state!==cookie||!/^[A-Za-z0-9_-]{43}$/.test(state))throw new HttpError(400,'Connection expired. Start again from the private page.');
  const valid=await env.DB.prepare('DELETE FROM oauth_states WHERE hash=? AND expires_at>? RETURNING hash').bind(await sha256(state),Date.now()).first();
  if(!valid)throw new HttpError(400,'Connection expired. Start again.');
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,code,grant_type:'authorization_code',redirect_uri:url.origin+'/api/admin/gmail/callback'}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new HttpError(400,'Google connection failed. Start again.');
  const tokens=await response.json();
  const identity=await verifyJWT(tokens.id_token,{issuer:['https://accounts.google.com','accounts.google.com'],audience:env.GOOGLE_CLIENT_ID,jwksURL:'https://www.googleapis.com/oauth2/v3/certs'});
  if(identity.email?.toLowerCase()!==env.MAILBOX?.toLowerCase()||identity.email_verified!==true||!tokens.refresh_token||!tokens.scope?.split(' ').includes('https://www.googleapis.com/auth/gmail.send'))throw new HttpError(403,'Connect the configured owner mailbox only.');
  const value=await encrypt(env.TOKEN_ENCRYPTION_KEY,tokens.refresh_token);
  await env.DB.prepare("INSERT INTO settings(key,value) VALUES('gmail_refresh',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(value).run();
  return new Response(null,{status:303,headers:{...secureHeaders,Location:'/admin/','Set-Cookie':'__Host-slot_oauth=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0'}});
}
async function admin(request,env) {
  await requireAdmin(request,env);
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/admin/gmail/callback'&&request.method==='GET')return oauthCallback(request,env);
  if(path==='/api/admin/status'&&request.method==='GET') {
    const connected=!!await env.DB.prepare("SELECT key FROM settings WHERE key='gmail_refresh'").first();
    const mail=await env.DB.prepare('SELECT state,count(*) AS count FROM outbox GROUP BY state').all();
    const codes=await env.DB.prepare('SELECT hash,label,expires_at,revoked_at,used_request_id FROM invitations WHERE expires_at>? ORDER BY created_at DESC LIMIT 30').bind(Date.now()).all();
    return json({connected,mail:mail.results,codes:codes.results,oauthConfigured:!!env.GOOGLE_CLIENT_ID&&!!env.GOOGLE_CLIENT_SECRET&&!!env.TOKEN_ENCRYPTION_KEY});
  }
  if(request.method!=='POST')throw new HttpError(405,'Use POST.');
  sameOrigin(request);
  if(path==='/api/admin/gmail/connect') {
    if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.TOKEN_ENCRYPTION_KEY||!env.MAILBOX)throw new HttpError(503,'OAuth is not configured.');
    const state=randomToken(32);
    await env.DB.prepare('INSERT INTO oauth_states(hash,expires_at) VALUES(?,?)').bind(await sha256(state),Date.now()+600000).run();
    const auth=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    for(const [k,v]of Object.entries({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:url.origin+'/api/admin/gmail/callback',response_type:'code',scope:'openid email https://www.googleapis.com/auth/gmail.send',access_type:'offline',prompt:'consent',state,login_hint:env.MAILBOX}))auth.searchParams.set(k,v);
    const res=json({url:auth.href}); res.headers.set('Set-Cookie',`__Host-slot_oauth=${state}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`); return res;
  }
  if(path==='/api/admin/codes') {
    const body=await bodyJSON(request);
    if(![15,30].includes(body.minutes)||typeof body.label!=='string'||body.label.length>40||/[\r\n\u0000-\u001f]/.test(body.label))throw new HttpError(400,'Choose 15 or 30 minutes and a short label.');
    const count=await env.DB.prepare('SELECT count(*) AS n FROM invitations WHERE created_at>?').bind(Date.now()-3600000).first();
    if(count.n>=30)throw new HttpError(429,'Enough passes for now. Try later.');
    const code=randomToken(),now=Date.now(),expiresAt=now+body.minutes*60000;
    await env.DB.prepare('INSERT INTO invitations(hash,label,created_at,expires_at) VALUES(?,?,?,?)').bind(await sha256(code),body.label,now,expiresAt).run();
    return json({code,expiresAt},201);
  }
  if(path==='/api/admin/revoke') {
    const body=await bodyJSON(request); if(typeof body.hash!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(body.hash))throw new HttpError(400,'Invalid pass.');
    await env.DB.prepare('UPDATE invitations SET revoked_at=? WHERE hash=? AND used_request_id IS NULL').bind(Date.now(),body.hash).run();
    return json({revoked:true});
  }
  throw new HttpError(404,'Not found.');
}
export default {
  async fetch(request,env,ctx) {
    const url=new URL(request.url),origin=request.headers.get('Origin'); let response;
    try {
      if(url.pathname.startsWith('/api/admin/'))response=await admin(request,env);
      else if(url.pathname==='/admin'||url.pathname.startsWith('/admin/')) {
        await requireAdmin(request,env); response=await env.ASSETS.fetch(request);
      } else if(url.pathname==='/api/submit') {
        if(request.method==='OPTIONS') {
          if(origin!==env.PUBLIC_ORIGIN&&origin!==url.origin)throw new HttpError(403,'Origin not allowed.');
          response=new Response(null,{status:204,headers:{...secureHeaders,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}});
        } else if(request.method==='POST')response=await publicSubmit(request,env,ctx);
        else throw new HttpError(405,'Use POST.');
      } else if(url.pathname==='/api/health')response=json({service:'SLOT',version:'0.1.0'});
      else if(url.pathname.startsWith('/api/'))throw new HttpError(404,'Not found.');
      else response=await env.ASSETS.fetch(request);
    } catch(error) {
      response=json({error:error instanceof HttpError?error.message:'The mailbox hit a snag. Try later.'},error instanceof HttpError?error.status:503);
    }
    const out=new Response(response.body,response);
    if(url.pathname==='/api/submit'&&(origin===env.PUBLIC_ORIGIN||origin===url.origin)){out.headers.set('Access-Control-Allow-Origin',origin);out.headers.set('Vary','Origin');}
    return out;
  },
  async scheduled(controller,env,ctx) {
    ctx.waitUntil((async()=>{await dispatch(env);const now=Date.now();await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now-86400000).run();await env.DB.prepare('DELETE FROM oauth_states WHERE expires_at<?').bind(now).run();})());
  }
};
