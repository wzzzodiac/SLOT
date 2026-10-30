export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const CODE_RE = /^[A-Za-z0-9_-]{22}$/;
export const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function b64url(bytes) {
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export function decode64(s) {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('Invalid encoding');
  return Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
}
export const randomToken = (size = 16) => b64url(crypto.getRandomValues(new Uint8Array(size)));
export async function sha256(text) { return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))); }
export async function keyedHash(secret, value) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))));
}
function clean(value, max, field, multiline = false) {
  if (typeof value !== 'string') throw new HttpError(400, `Check ${field}.`);
  const text = value.trim().normalize('NFC');
  if (!text || [...text].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text) || (!multiline && /[\r\n]/.test(text))) throw new HttpError(400, `Check ${field}.`);
  return text;
}
const berlin = new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function berlinToUTC(local) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new HttpError(400, 'Choose a date and time.');
  const base = Date.parse(local + ':00Z');
  if (!Number.isFinite(base) || new Date(base).toISOString().slice(0,16) !== local) throw new HttpError(400, 'Choose a valid date.');
  // For the supported modern Europe/Berlin dates these are the only offsets.
  // Round-tripping rejects nonexistent spring times and ambiguous autumn times.
  const matches = [60,120].map(offset => base-offset*60000).filter(ms => berlin.format(ms).replace(' ','T') === local);
  if (matches.length !== 1) throw new HttpError(400, 'That time changes with daylight saving. Pick another time.');
  return matches[0];
}
export function validateSubmission(body, now = Date.now()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400,'Check your request.');
  const allowed = new Set(['code','requestId','name','date','time','description']);
  if (Object.keys(body).some(key => !allowed.has(key))) throw new HttpError(400,'Unexpected field.');
  if (typeof body.code!=='string'||!CODE_RE.test(body.code)) throw new HttpError(403,'That code is unavailable. Ask Walter for a new one.');
  if (typeof body.requestId!=='string'||!ID_RE.test(body.requestId)) throw new HttpError(400,'Refresh and try again.');
  const name = clean(body.name,80,'your name');
  const description = clean(body.description,500,'the note',true);
  if (typeof body.date !== 'string' || typeof body.time !== 'string') throw new HttpError(400,'Choose a date and time.');
  const start = berlinToUTC(`${body.date}T${body.time}`);
  if (start < now+15*60000 || start > now+180*86400000) throw new HttpError(400,'Pick a time from 15 minutes to 180 days ahead.');
  return { name, description, start, end:start+30*60000, zone:'Europe/Berlin' };
}
function icalText(value) { return value.replaceAll('\\','\\\\').replaceAll('\r\n','\n').replaceAll('\r','\n').replaceAll('\n','\\n').replaceAll(';','\\;').replaceAll(',','\\,'); }
export function foldLine(line) {
  let out = '', current = '', size = 0;
  for (const char of line) {
    const len = new TextEncoder().encode(char).length;
    if (size+len > 75) { out += current+'\r\n'; current=' '; size=1; }
    current+=char; size+=len;
  }
  return out+current;
}
const icalDate = n => new Date(n).toISOString().replaceAll('-','').replaceAll(':','').replace(/\.\d{3}Z$/, 'Z');
export function createICS(id, proposal, createdAt) {
  if (!ID_RE.test(id)) throw new Error('Invalid event identifier');
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SLOT//Private proposals//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${id}@slot.invalid`,`DTSTAMP:${icalDate(createdAt)}`,`DTSTART:${icalDate(proposal.start)}`,`DTEND:${icalDate(proposal.end)}`,`SUMMARY:${icalText('Time with '+proposal.name)}`,`DESCRIPTION:${icalText(proposal.description)}`,'END:VEVENT','END:VCALENDAR',''].map(foldLine).join('\r\n');
}
export function createMIME(id, proposal, createdAt, recipient) {
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(recipient) || /[\r\n]/.test(recipient)) throw new Error('Invalid configured mailbox');
  const boundary = `slot_${id}`;
  const when = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',dateStyle:'full',timeStyle:'short'}).format(proposal.start);
  const text = `${proposal.name} wants a little of your time.\n\n${when} (Europe/Berlin)\n30 minutes\n\n${proposal.description}\n\nOpen the attached .ics if you want to add it. This is a proposal, not a confirmed booking.\n\nSLOT / ${id}`;
  const enc = s => { const bytes=new TextEncoder().encode(s); let raw=''; for(const b of bytes)raw+=String.fromCharCode(b); return btoa(raw).match(/.{1,76}/g)?.join('\r\n') ?? ''; };
  return [`From: ${recipient}`,`To: ${recipient}`,'Subject: SLOT - Someone wants a little time',`Message-ID: <${id}@slot.invalid>`,'MIME-Version: 1.0',`Content-Type: multipart/mixed; boundary="${boundary}"`,'',`--${boundary}`,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',enc(text),`--${boundary}`,'Content-Type: text/calendar; charset=UTF-8','Content-Disposition: attachment; filename="a-little-time.ics"','Content-Transfer-Encoding: base64','',enc(createICS(id,proposal,createdAt)),`--${boundary}--`,''].join('\r\n');
}
export async function encrypt(secret, plaintext) {
  const raw = decode64(secret); if(raw.length!==32) throw new Error('Invalid encryption configuration');
  const key = await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt']);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('SLOT.gmail.refresh.v1')},key,new TextEncoder().encode(plaintext));
  return `${b64url(iv)}.${b64url(new Uint8Array(cipher))}`;
}
export async function decrypt(secret, value) {
  const [iv,cipher] = value.split('.');
  const key=await crypto.subtle.importKey('raw',decode64(secret),'AES-GCM',false,['decrypt']);
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode64(iv),additionalData:new TextEncoder().encode('SLOT.gmail.refresh.v1')},key,decode64(cipher)));
}
