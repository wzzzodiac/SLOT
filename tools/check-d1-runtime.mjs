import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {consume} from '../src/store.mjs';
const runtime=new Miniflare(convertV4MiniflareOptions({workers:[{name:'slot-test',modules:true,script:'export default { fetch(){ return new Response("test"); } };',d1Databases:['DB'],compatibilityDate:'2026-10-30'}]}));
try{
  const db=await runtime.getD1Database('DB');
  const directory=new URL('../migrations/',import.meta.url);
  // batch prepared statements preserve trigger bodies as single statements.
  for(const file of (await readdir(directory)).filter(f=>f.endsWith('.sql')).sort()){
    const source=await readFile(new URL(file,directory),'utf8');
    const statements=source.split(/(CREATE TRIGGER[\s\S]*?END;)/g).flatMap(part=>part.trim().startsWith('CREATE TRIGGER')?[part.trim()]:part.split(';').map(s=>s.trim()).filter(Boolean));
    await db.batch(statements.map(s=>db.prepare(s)));
  }
  const now=Date.now();
  await db.prepare('INSERT INTO invitations(hash,created_at,expires_at)VALUES(?,?,?)').bind('runtime-test-hash',now,now+60000).run();
  const results=await Promise.allSettled(Array.from({length:50},()=>consume(db,{id:crypto.randomUUID(),hash:'runtime-test-hash',digest:'same',proposal:{name:'Synthetic runtime test'},now})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await db.prepare('SELECT count(*) n FROM requests').first()).n,1);
  assert.equal((await db.prepare('SELECT count(*) n FROM outbox').first()).n,1);
  console.log('Actual workerd/D1 runtime: 50 competing consumers, one request, one outbox. Passed.');
}finally{await runtime.dispose();}
