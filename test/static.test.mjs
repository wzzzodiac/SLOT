import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bundledAsset} from '../src/static.mjs';
import worker from '../src/worker.mjs';
const request=(path,method='GET')=>new Request('https://worker.example'+path,{method});
test('bundled routes preserve MIME, CSP, private cache policy and real 404s',async()=>{
  for(const [path,type]of [['/','text/html'],['/style.css','text/css'],['/app.js','text/javascript'],['/icon.svg','image/svg+xml'],['/privacy.html','text/html'],['/admin/','text/html'],['/admin/admin.js','text/javascript']]){const r=bundledAsset(request(path));assert.equal(r.status,200);assert.ok(r.headers.get('Content-Type').startsWith(type));assert.ok(r.headers.get('Content-Security-Policy').includes("frame-ancestors 'none'"));if(path.startsWith('/admin'))assert.equal(r.headers.get('Cache-Control'),'private, no-store');}
  for(const path of ['/unknown','/admin/unknown','/%61dmin/'])assert.equal(bundledAsset(request(path)).status,404);
  assert.equal(bundledAsset(request('/admin')).headers.get('Location'),'/admin/');
  assert.equal(bundledAsset(request('/app.js','POST')).status,405);
  assert.equal(await bundledAsset(request('/','HEAD')).text(),'');
});
test('bundled fallback cannot bypass private authorization or hide unknown API paths',async()=>{
  for(const path of ['/admin','/admin/','/admin/index.html','/admin/admin.js','/admin/admin.css','/api/admin/status','/api/admin/gmail/callback'])assert.equal((await worker.fetch(request(path),{},{})).status,503);
  assert.equal((await worker.fetch(request('/api/missing'),{},{})).status,404);
});
