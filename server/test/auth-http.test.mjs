import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { generateKeyPair, SignJWT } from 'jose';
import { createAuthenticator, INKLURA_ISSUER } from '../auth.mjs';
import { createApi } from '../http.mjs';
import { Ledger } from '../ledger.mjs';
import { Payments } from '../payments.mjs';
const {privateKey,publicKey}=await generateKeyPair('RS256');
const clientId='test-inklura-pdf-client';
async function token(overrides={}){return new SignJWT({scope:'openid profile',...overrides}).setProtectedHeader({alg:'RS256'}).setSubject('user-a').setIssuer(INKLURA_ISSUER).setAudience(clientId).setIssuedAt().setExpirationTime('1h').sign(privateKey);}
test('valid Inklura access JWT is accepted; signature/audience/issuer/expiry are verified',async()=>{
 const authenticate=createAuthenticator({clientId,keySet:publicKey});
 assert.deepEqual(await authenticate('Bearer '+await token()),{issuer:INKLURA_ISSUER,subject:'user-a'});
 for(const bad of [undefined,'Bearer nope','Bearer '+await token({scope:undefined})]) await assert.rejects(()=>authenticate(bad));
 for(const signed of [new SignJWT({scope:'openid'}).setIssuer('https://evil.test').setAudience(clientId).setSubject('a').setIssuedAt().setExpirationTime('1h'),new SignJWT({scope:'openid'}).setIssuer(INKLURA_ISSUER).setAudience('other-app').setSubject('a').setIssuedAt().setExpirationTime('1h'),new SignJWT({scope:'openid'}).setIssuer(INKLURA_ISSUER).setAudience(clientId).setSubject('a').setIssuedAt().setExpirationTime(1)]) {
  const raw=await signed.setProtectedHeader({alg:'RS256'}).sign(privateKey);await assert.rejects(()=>authenticate('Bearer '+raw),{code:'session_expired'});
 }
 const forged=(await token()).split('.');forged[2]='fake';await assert.rejects(()=>authenticate('Bearer '+forged.join('.')),{code:'session_expired'});
});
test('unconfigured account service fails closed',async()=>{await assert.rejects(()=>createAuthenticator({clientId:'',keySet:publicKey})('Bearer any'),{code:'accounts_not_configured'});});
test('HTTP account/export flow rejects uploads, forged identity, cross-origin and disabled purchases',async()=>{
 const ledger=new Ledger(),payments=new Payments({ledger,publicUrl:'http://127.0.0.1'});
 const server=createApi({ledger,payments,clientId,publicUrl:'http://127.0.0.1/api/inklura-pdf',authenticate:createAuthenticator({clientId,keySet:publicKey})});
 server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port+'/api/inklura-pdf';
 const headers={Authorization:'Bearer '+await token(),'Content-Type':'application/json'};
 try {
  assert.equal((await fetch(base+'/v1/account')).status,401);
  const account=await(await fetch(base+'/v1/account',{headers})).json();assert.equal(account.remaining,20);
  const post=(p,data,h=headers)=>fetch(base+p,{method:'POST',headers:h,body:JSON.stringify(data)});
  assert.equal((await post('/v1/exports/reserve',{operation:'operation-123456789',pdf:'not allowed'})).status,400);
  assert.equal((await post('/v1/exports/reserve',{operation:'operation-123456789'},{...headers,Origin:'https://evil.test'})).status,403);
  assert.equal((await post('/v1/exports/reserve',{operation:'operation-123456789'})).status,200);
  assert.equal((await post('/v1/exports/commit',{operation:'operation-123456789'})).status,200);
  assert.equal((await(await fetch(base+'/v1/account',{headers})).json()).remaining,19);
  assert.equal((await post('/v1/checkout',{planId:'volume-100',operation:'checkout-123456789'})).status,503);
  assert.equal((await fetch(base+'/billing/success')).status,200);
  assert.equal((await(await fetch(base+'/v1/account',{headers})).json()).remaining,19,'success redirect cannot grant credits');
  assert.equal((await post('/v1/exports/reserve',{operation:'x'.repeat(5000)})).status,413);
  assert.equal((await fetch(base+'/v1/config')).headers.get('cache-control'),'no-store');
 }finally{await new Promise(resolve=>server.close(resolve));ledger.close();}
});

test('public checkout is a restricted POST redirect, keeps its recovery cookie and isolates server bridge routes', async () => {
 const ledger = new Ledger(), payments = new Payments({ ledger });
 const receipts = [], secret = 'a'.repeat(64);
 const webPurchases = { checkout: async (plan, previous, issued, buyer) => { receipts.push({plan,previous}); if (buyer !== null) throw new Error('unexpected buyer'); issued(secret); return { url: 'https://checkout.stripe.com/c/pay/fixture' }; }, authenticate: () => { throw new Error('not signed'); } };
 const server = createApi({ ledger, payments, webPurchases, clientId, publicUrl: 'http://127.0.0.1/api/inklura-pdf', authenticate: createAuthenticator({clientId,keySet:publicKey}) });
 server.listen(0, '127.0.0.1'); await once(server, 'listening');
 const base = 'http://127.0.0.1:' + server.address().port + '/api/inklura-pdf';
 const send = (body, origin = 'https://pdf.inklura.fr') => fetch(base + '/web/checkout', { method: 'POST', redirect: 'manual', headers: { origin, 'content-type': 'application/x-www-form-urlencoded', cookie: '__Host-pdf-purchase=' + secret }, body });
 try {
  assert.equal((await send('planId=volume-100', 'https://evil.test')).status, 403);
  assert.equal((await send('planId=volume-100&amount=1')).status, 400);
  assert.equal((await send('planId=volume-100&planId=business-20')).status, 400);
  assert.equal((await send('planId=volume-100&email=a@b.fr&email=c@d.fr')).status, 400);
  assert.equal((await send('planId=volume-100&email=bad&line1=x')).status, 303, 'invalid prefill never blocks the payment');
  receipts.length = 0;
  const result = await send('planId=volume-100');
  assert.equal(result.status, 303); assert.equal(result.headers.get('location'), 'https://checkout.stripe.com/c/pay/fixture');
  assert.match(result.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
  assert.deepEqual(receipts, [{ plan: 'volume-100', previous: secret }]);
  const resume = await fetch(base + '/web/resume', { redirect: 'manual', headers: { cookie: '__Host-pdf-purchase=' + secret } });
  assert.equal(resume.headers.get('location'), 'https://manage.inklura.fr/pdf/billing?claim=' + secret);
  assert.equal(resume.headers.get('referrer-policy'), 'no-referrer');
  assert.equal((await fetch(base + '/web/account', { method: 'POST', headers: { origin: 'https://manage.inklura.fr' } })).status, 403);
 } finally { await new Promise(resolve => server.close(resolve)); ledger.close(); }
});

test('PDF deletion requires an authenticated explicit confirmation and cannot target another subject', async () => {
 const { AccountDeletion } = await import('../account-deletion.mjs');
 const ledger = new Ledger(), payments = new Payments({ ledger }), accountDeletion = new AccountDeletion({ ledger, payments });
 const server = createApi({ ledger, payments, accountDeletion, clientId, publicUrl:'http://127.0.0.1', authenticate:createAuthenticator({clientId,keySet:publicKey}) });
 server.listen(0,'127.0.0.1'); await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port, headers={Authorization:'Bearer '+await token(),'Content-Type':'application/json'};
 const post=(data,h=headers)=>fetch(base+'/v1/account/deletion',{method:'POST',headers:h,body:JSON.stringify(data)});
 try {
  await fetch(base+'/v1/account',{headers});
  const other=ledger.account(INKLURA_ISSUER,'other-subject');
  assert.equal((await post({confirmation:'SUPPRIMER MON COMPTE PDF'},{})).status,401);
  assert.equal((await post({confirmation:'SUPPRIMER MON COMPTE PDF'},{...headers,Origin:'https://evil.test'})).status,403);
  assert.equal((await post({confirmation:'SUPPRIMER MON COMPTE PDF',subject:'other-subject'})).status,400);
  assert.equal((await post({confirmation:'yes'})).status,400);
  assert.equal((await post({confirmation:'SUPPRIMER MON COMPTE PDF'})).status,202);
  await accountDeletion.run();
  assert.equal((await fetch(base+'/v1/account',{headers})).status,410);
  assert.deepEqual(await (await fetch(base+'/v1/account/deletion',{headers})).json(),{state:'deleted'});
  assert.equal((await post({confirmation:'SUPPRIMER MON COMPTE PDF'})).status,200);
  assert.equal(ledger.balance(other.id).remaining,20);
 } finally { await new Promise(resolve=>server.close(resolve)); await accountDeletion.running; ledger.close(); }
});
