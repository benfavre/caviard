import test from 'node:test';
import assert from 'node:assert/strict';
import { AccountController, accountApiUrl } from '../../electron/account.mjs';
const base='https://outils.inklura.fr/api/inklura-pdf';
const config={enabled:true,issuer:'https://auth.1clic.pro',clientId:'fixture-client',deviceEndpoint:'https://auth.1clic.pro/oauth2/device',tokenEndpoint:'https://auth.1clic.pro/oauth2/token',plans:[]};
const device={device_code:'private-device-code',user_code:'ABCD-EFGH',verification_uri_complete:'https://auth.1clic.pro/device?user_code=ABCD-EFGH',expires_in:600,interval:5};
const tokens={access_token:'private-access-token',refresh_token:'private-refresh-token',token_type:'Bearer',expires_in:3600};
const account={accountId:'account-fixture',remaining:20,reserved:0,plans:[],paymentsEnabled:false};
const response=(data,status=200)=>({ok:status<400,status,text:async()=>JSON.stringify(data)});
function create(override){const timers=[],opened=[],requests=[];const controller=new AccountController({apiUrl:base,openExternal:async url=>opened.push(url),setTimer:(_fn,ms)=>{timers.push(ms);return timers.length;},clearTimer:()=>{},fetcher:async(url,options)=>{requests.push({url,options});if(override){const r=await override(url,options);if(r)return r;}return response(url.endsWith('/config')?config:url.endsWith('/device')?device:url.endsWith('/token')?tokens:account);}});return{controller,timers,opened,requests};}
test('only dedicated HTTPS service is allowed in production; loopback override is development only',()=>{
 assert.equal(accountApiUrl(base),base);assert.equal(accountApiUrl(undefined),null);
 for(const value of ['https://evil.test','http://outils.inklura.fr/api/inklura-pdf','https://outils.inklura.fr.evil.test/api/inklura-pdf',base+'?url=evil','https://user@outils.inklura.fr/api/inklura-pdf','http://127.0.0.1:4387'])assert.throws(()=>accountApiUrl(value));
 assert.equal(accountApiUrl('http://127.0.0.1:4387',true),'http://127.0.0.1:4387');
});
test('device login opens Inklura browser page, polls, and never exposes tokens to renderer',async()=>{
 const f=create();await f.controller.initialize();await f.controller.signIn();assert.equal(f.controller.snapshot().userCode,'ABCD-EFGH');assert.equal(f.timers[0],5000);assert.equal(f.opened[0],'https://manage.inklura.fr/manage/device?user_code=ABCD-EFGH');
 await f.controller.poll();assert.equal(f.controller.snapshot().phase,'signed-in');assert.equal(f.controller.snapshot().account.remaining,20);
 const snapshot=JSON.stringify(f.controller.snapshot());for(const secret of ['private-device-code','private-access-token','private-refresh-token'])assert.ok(!snapshot.includes(secret));
 assert.ok(f.requests.every(r=>r.options.redirect==='error'));f.controller.dispose();
});
test('pending and slow_down honor provider polling rules',async()=>{
 let polls=0;const f=create(url=>url.endsWith('/token')?response({error:'invalid_grant',error_description:++polls===1?'authorization_pending':'slow_down'},400):null);
 await f.controller.initialize();await f.controller.signIn();await f.controller.poll();assert.equal(f.controller.phase,'waiting');await f.controller.poll();assert.equal(f.timers.at(-1),10000);f.controller.dispose();
});
test('verification URI injection cannot open an arbitrary website',async()=>{
 const f=create(url=>url.endsWith('/device')?response({...device,verification_uri_complete:'https://evil.test/phish'}):null);await f.controller.initialize();await f.controller.signIn();assert.equal(f.opened.length,0);assert.equal(f.controller.phase,'signed-out');f.controller.dispose();
});
test('cancelled login ignores late token response',async()=>{
 let resolve;const f=create(url=>url.endsWith('/token')?new Promise(r=>{resolve=r;}):null);await f.controller.initialize();await f.controller.signIn();const pending=f.controller.poll();await new Promise(r=>setImmediate(r));f.controller.cancel();resolve(response(tokens));await pending;assert.equal(f.controller.tokens,null);assert.equal(f.controller.phase,'signed-out');f.controller.dispose();
});
test('logout ignores an in-flight account response',async()=>{
 let resolve;const f=create(url=>url.endsWith('/account')?new Promise(r=>{resolve=r;}):null);await f.controller.initialize();f.controller.acceptTokens(tokens);const pending=f.controller.refresh();await new Promise(r=>setImmediate(r));f.controller.logout();resolve(response(account));await pending;assert.equal(f.controller.account,null);assert.equal(f.controller.phase,'signed-out');f.controller.dispose();
});
test('logout during token renewal cannot restore the previous session',async()=>{
 let resolve;const f=create(url=>url.endsWith('/token')?new Promise(r=>{resolve=r;}):null);await f.controller.initialize();f.controller.acceptTokens({...tokens,expires_in:1});
 const pending=f.controller.refresh();await new Promise(r=>setImmediate(r));f.controller.logout();resolve(response(tokens));await pending;
 assert.equal(f.controller.tokens,null);assert.equal(f.controller.account,null);assert.equal(f.controller.phase,'signed-out');assert.ok(!f.requests.some(r=>r.url.endsWith('/account')));f.controller.dispose();
});
test('disabled billing does not call checkout or open Stripe',async()=>{
 const f=create();await f.controller.initialize();f.controller.acceptTokens(tokens);await f.controller.refresh();await assert.rejects(()=>f.controller.checkout('volume-100'));assert.equal(f.opened.length,0);assert.ok(!f.requests.some(r=>r.url.endsWith('/checkout')));f.controller.dispose();
});
test('wrong identity-provider config is rejected before collecting credentials',async()=>{
 const f=create(url=>url.endsWith('/config')?response({...config,tokenEndpoint:'https://evil.test/token'}):null);await f.controller.initialize();assert.equal(f.controller.phase,'error');assert.equal(f.opened.length,0);f.controller.dispose();
});
test('sign-in reconciles pending credits before publishing the final balance',async()=>{
 let remaining=19, reconciled=0;
 const f=create(url=>url.endsWith('/account')?response({...account,remaining,reserved:20-remaining}):null);
 f.controller.onSignedIn=async()=>{assert.equal(f.controller.account.accountId,account.accountId);reconciled++;remaining=20;};
 await f.controller.initialize();await f.controller.signIn();await f.controller.poll();
 assert.equal(reconciled,1);assert.equal(f.controller.snapshot().account.remaining,20);assert.equal(f.controller.snapshot().account.reserved,0);f.controller.dispose();
});
test('revoked refresh tokens clear the expired session and allow a new login',async()=>{
 const f=create(url=>url.endsWith('/token')?response({error:'invalid_grant'},400):null);
 await f.controller.initialize();f.controller.acceptTokens({...tokens,expires_in:1});f.controller.account=account;f.controller.phase='signed-in';
 await assert.rejects(()=>f.controller.refresh(),{code:'session_expired'});
 assert.equal(f.controller.phase,'signed-out');assert.equal(f.controller.tokens,null);assert.equal(f.controller.account,null);f.controller.dispose();
});
test('an expired access token without a refresh token clears the session',async()=>{
 const f=create();await f.controller.initialize();f.controller.acceptTokens({...tokens,refresh_token:undefined,expires_in:1});
 await assert.rejects(()=>f.controller.refresh(),{code:'session_expired'});assert.equal(f.controller.phase,'signed-out');assert.equal(f.controller.tokens,null);f.controller.dispose();
});

test('Manage-hosted provider responses are accepted without forwarding their query or path',async()=>{
 const f=create(url=>url.endsWith('/device')?response({...device,verification_uri_complete:'https://manage.inklura.fr/elsewhere?user_code=WRONG&redirect=https://evil.test'}):null);
 await f.controller.initialize();await f.controller.signIn();assert.equal(f.opened[0],'https://manage.inklura.fr/manage/device?user_code=ABCD-EFGH');f.controller.dispose();
});
test('provider fallback URI still opens Manage with the public code prefilled',async()=>{
 const f=create(url=>url.endsWith('/device')?response({...device,verification_uri_complete:undefined,verification_uri:'https://auth.1clic.pro/device'}):null);
 await f.controller.initialize();await f.controller.signIn();assert.equal(f.opened[0],'https://manage.inklura.fr/manage/device?user_code=ABCD-EFGH');f.controller.dispose();
});
