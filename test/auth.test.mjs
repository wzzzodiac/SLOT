import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyJWT,requireAdmin} from '../src/auth.mjs';
import {b64url} from '../src/core.mjs';
test('admin identity requires a real signature, correct issuer/audience, expiry and owner',async()=>{
  const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='test-key';
  const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({keys:[jwk]});
  const now=Math.floor(Date.now()/1000),issuer='https://slot-test.cloudflareaccess.com';
  async function token(changes={},header={}){const h=b64url(new TextEncoder().encode(JSON.stringify({alg:'RS256',kid:'test-key',...header})));const p=b64url(new TextEncoder().encode(JSON.stringify({iss:issuer,aud:['test-aud'],exp:now+600,iat:now,email:'owner@example.com',...changes})));const signature=b64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(h+'.'+p))));return h+'.'+p+'.'+signature;}
  const options={issuer:[issuer],audience:'test-aud',jwksURL:issuer+'/cdn-cgi/access/certs'};
  try{
    const good=await token();assert.equal((await verifyJWT(good,options)).email,'owner@example.com');
    for(const changes of [{iss:'https://evil.example'},{aud:['other']},{exp:now-1},{nbf:now+999},{iat:now+999}])await assert.rejects(verifyJWT(await token(changes),options));
    await assert.rejects(verifyJWT(await token({}, {alg:'none'}),options));
    await assert.rejects(verifyJWT(good.slice(0,-10)+'AAAAAAAAAA',options));
    await assert.rejects(requireAdmin(new Request('https://slot.example/admin/',{headers:{'Cf-Access-Jwt-Assertion':await token({email:'attacker@example.com'})}}),{ACCESS_TEAM:'slot-test',ACCESS_AUD:'test-aud',ADMIN_EMAIL:'owner@example.com'}));
  }finally{globalThis.fetch=original;}
});
