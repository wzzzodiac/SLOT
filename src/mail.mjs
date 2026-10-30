import {b64url,createMIME,decrypt,randomToken} from './core.mjs';
import {claimMail,markSending} from './store.mjs';

export async function accessToken(env) {
  if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.TOKEN_ENCRYPTION_KEY||!env.MAILBOX)throw new Error('mail_not_configured');
  const record=await env.DB.prepare("SELECT value FROM settings WHERE key='gmail_refresh'").first();
  if(!record)throw new Error('gmail_not_connected');
  const refresh=await decrypt(env.TOKEN_ENCRYPTION_KEY,record.value);
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:refresh,grant_type:'refresh_token'}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error(response.status===400?'gmail_reconnect_required':'gmail_auth_unavailable');
  const result=await response.json(); if(typeof result.access_token!=='string')throw new Error('gmail_auth_unavailable');
  return result.access_token;
}

export async function dispatch(env, max = 3) {
  if(!env.DB)return;
  // Stale sending is inherently ambiguous; NEVER return it to pending.
  await env.DB.prepare("UPDATE outbox SET state='uncertain',error='Interrupted during Gmail delivery' WHERE state='sending' AND sending_at<?").bind(Date.now()-300000).run();
  for(let i=0;i<max;i++) {
    const now=Date.now(),lease=randomToken();
    const job=await claimMail(env.DB,now,lease); if(!job)return;
    let token,mime;
    try {
      token=await accessToken(env);
      const row=await env.DB.prepare('SELECT * FROM requests WHERE id=?').bind(job.request_id).first();
      mime=createMIME(row.id,JSON.parse(row.payload),row.created_at,env.MAILBOX);
    } catch(error) {
      const code=['gmail_reconnect_required','gmail_not_connected','mail_not_configured'].includes(error.message)?error.message:'mail_preparation_failed';
      const terminal=job.attempts>=5||code==='gmail_reconnect_required';
      await env.DB.prepare("UPDATE outbox SET state=?,available_at=?,lease=NULL,error=? WHERE request_id=? AND lease=? AND state='preparing'").bind(terminal?'failed':'pending',now+Math.min(3600000,30000*2**job.attempts),code,job.request_id,lease).run();
      continue;
    }
    if(!await markSending(env.DB,job.request_id,lease))continue;
    // Everything from this point may have reached Gmail. No blind retry.
    try {
      const result=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({raw:b64url(new TextEncoder().encode(mime))}),signal:AbortSignal.timeout(20000)});
      if(!result.ok) {
        // Explicit auth/validation rejection means Gmail did not accept this message.
        const certain=[400,401,403,404,413,429].includes(result.status);
        await env.DB.prepare("UPDATE outbox SET state=?,error=?,lease=NULL WHERE request_id=? AND lease=? AND state='sending'").bind(certain?'failed':'uncertain',certain?`gmail_rejected_${result.status}`:'gmail_delivery_unknown',job.request_id,lease).run();
        continue;
      }
      const sent=await result.json();
      if(typeof sent.id!=='string')throw new Error('Missing receipt');
      await env.DB.prepare("UPDATE outbox SET state='sent',gmail_id=?,error=NULL,lease=NULL WHERE request_id=? AND lease=? AND state='sending'").bind(sent.id,job.request_id,lease).run();
    } catch {
      await env.DB.prepare("UPDATE outbox SET state='uncertain',error='gmail_delivery_unknown',lease=NULL WHERE request_id=? AND lease=? AND state='sending'").bind(job.request_id,lease).run();
    }
  }
}
