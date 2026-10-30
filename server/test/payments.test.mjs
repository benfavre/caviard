import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { Ledger, addMonths } from '../ledger.mjs';
import { WebPurchases } from '../web-purchases.mjs';
import { createHmac } from 'node:crypto';
import { Payments } from '../payments.mjs';
const billing={name:'Société de test',line1:'1 rue Exemple',city:'Rennes',postalCode:'35000',country:'FR'};
const signing=new Stripe('sk_test_fixture'),secret='whsec_fixture_for_automated_tests';
function fixture({enabled=true}={}) {
 const now=Date.now(),ledger=new Ledger(':memory:',{now:()=>now}),account=ledger.account('https://auth.1clic.pro','user-a');
 let calls=0, sent;const refunds=[],cancellations=[];
 const checkout={customer_details:{address:{country:'FR',postal_code:'35000'}},id:'cs_fixture',created:Math.floor(now/1000),status:'open',url:'https://checkout.stripe.com/c/pay/test',customer:'cus_fixture',mode:'payment',payment_status:'paid',client_reference_id:account.id,payment_intent:'pi_fixture',metadata:{inkluraPdfAccount:account.id,inkluraPdfOrder:'order-1234567890'},line_items:{data:[{quantity:1,price:{id:'price_volume'}}],has_more:false}};
 const subscription={id:'sub_fixture',customer:'cus_fixture',metadata:{inkluraPdfAccount:account.id,inkluraPdfOrder:'order-month-1234567890',inkluraPdfPlan:'business-20'}};
 const start=Math.floor(now/1000),end=Math.floor(addMonths(now,1)/1000);
 const invoice={customer_address:{country:'FR',postal_code:'35000'},id:'in_fixture',status:'paid',billing_reason:'subscription_cycle',customer:'cus_fixture',parent:{subscription_details:{subscription:'sub_fixture'}},lines:{data:[{quantity:1,pricing:{price_details:{price:'price_month'}},period:{start,end}}],has_more:false}};
 const stripe={webhooks:signing.webhooks,taxRates:{retrieve:async()=>({active:true,country:'FR',percentage:20,inclusive:false,livemode:false})},refunds:{create:async(body,options)=>{refunds.push({body,options});return{id:'re_fixture'};}},invoicePayments:{list:()=>({async *[Symbol.asyncIterator](){yield {payment:{type:'payment_intent',payment_intent:'pi_invoice'}};}})}, prices:{retrieve:async id=>({id,active:true,currency:'eur',unit_amount:id==='price_month'?490:2900,tax_behavior:'exclusive',...(id==='price_month'?{recurring:{interval:'month',interval_count:1}}:{})})}, customers:{create:async()=>({id:'cus_fixture'}),update:async()=>({id:'cus_fixture'}),retrieve:async()=>({id:'cus_fixture',name:'Cabinet Exemple',email:'client@exemple.fr',address:{country:'FR',postal_code:'35000',line1:'2 rue du Test',city:'Rennes'}})}, checkout:{sessions:{create:async body=>{calls++;sent=body;Object.assign(checkout,{metadata:body.metadata,mode:body.mode});return checkout;},retrieve:async()=>checkout}},subscriptions:{retrieve:async()=>subscription,cancel:async id=>{cancellations.push(id);subscription.status='canceled';return subscription;}},invoices:{retrieve:async()=>invoice},charges:{retrieve:async()=>({customer:'cus_fixture'})},billingPortal:{sessions:{create:async()=>({url:'https://billing.stripe.com/p/session/test'})}}};
 const payments=new Payments({ledger,stripe,webhookSecret:secret,priceIds:{'volume-100':'price_volume','business-20':'price_month'},enabled,franceTaxRate:'txr_france',portalConfiguration:'bpc_fixture',publicUrl:'https://outils.inklura.fr/api/inklura-pdf'});
 const event=async(type,obj={id:checkout.id},id='evt_'+type)=>{const payload=JSON.stringify({id,type,created:Math.floor(now/1000),livemode:false,data:{object:obj}});const signature=signing.webhooks.generateTestHeaderString({payload,secret});return payments.webhook(Buffer.from(payload),signature);};
 const checkoutFor=payments.checkout.bind(payments);payments.checkout=(account,plan,operation,details=billing,web)=>checkoutFor(account,plan,operation,details,web);
 return {ledger,account,stripe,payments,checkout,subscription,invoice,event,refunds,cancellations,get sent(){return sent;},get calls(){return calls;}};
}
test('checkout ignores client amounts, uses configured price and remains idempotent',async()=>{
 const f=fixture();await f.payments.checkout(f.account.id,'volume-100','order-1234567890');await f.payments.checkout(f.account.id,'volume-100','order-1234567890');assert.equal(f.calls,1);assert.equal(f.ledger.balance(f.account.id).remaining,20);
 await assert.rejects(()=>f.payments.checkout(f.account.id,'volume-999','order-2222222222'),{code:'offer_not_available'});f.ledger.close();
});
test('purchases default off, require webhook configuration, and live mode requires explicit activation',async()=>{
 const f=fixture({enabled:false});await assert.rejects(()=>f.payments.checkout(f.account.id,'volume-100','order-1234567890'),{code:'purchases_not_enabled'});
 assert.equal(new Payments({ledger:f.ledger,stripe:f.stripe,webhookSecret:secret,enabled:true,live:true}).enabled,false);f.ledger.close();
});
test('paid volume webhook adds exactly 100 for twelve calendar months; replay and alternate event cannot double credit',async()=>{
 const f=fixture();await f.payments.checkout(f.account.id,'volume-100','order-1234567890');
 await f.event('checkout.session.completed');await f.event('checkout.session.completed');await f.event('checkout.session.async_payment_succeeded');
 assert.equal(f.ledger.balance(f.account.id).remaining,120);
 const grant=f.ledger.db.prepare('SELECT * FROM grants WHERE id=?').get('checkout:cs_fixture');assert.equal(grant.ends,addMonths(grant.starts,12));f.ledger.close();
});
test('unpaid checkout adds nothing; delayed paid notification fulfills once',async()=>{
 const f=fixture();await f.payments.checkout(f.account.id,'volume-100','order-1234567890');f.checkout.payment_status='unpaid';await f.event('checkout.session.completed');assert.equal(f.ledger.balance(f.account.id).remaining,20);
 f.checkout.payment_status='paid';await f.event('checkout.session.async_payment_succeeded');assert.equal(f.ledger.balance(f.account.id).remaining,120);f.ledger.close();
});
test('unsigned, tampered and wrong-environment webhook cannot credit',async()=>{
 const f=fixture();await assert.rejects(()=>f.payments.webhook(Buffer.from('{}'),'invalid'),{code:'invalid_webhook_signature'});
 const payload=JSON.stringify({id:'evt_live',livemode:true,type:'noop',data:{object:{}}});await assert.rejects(()=>f.payments.webhook(Buffer.from(payload),signing.webhooks.generateTestHeaderString({payload,secret})),{code:'wrong_payment_environment'});assert.equal(f.ledger.balance(f.account.id).remaining,20);f.ledger.close();
});
test('wrong account and wrong price fail closed without acknowledging fulfillment',async()=>{
 const f=fixture();await f.payments.checkout(f.account.id,'volume-100','order-1234567890');f.checkout.client_reference_id='other';await assert.rejects(()=>f.event('checkout.session.completed'),{code:'checkout_account_mismatch'});
 f.checkout.client_reference_id=f.account.id;f.checkout.line_items.data[0].price.id='wrong';await assert.rejects(()=>f.event('checkout.session.completed'),{code:'checkout_price_mismatch'});assert.equal(f.ledger.balance(f.account.id).remaining,20);f.ledger.close();
});
test('monthly paid invoice grants once per period, checkout gives no second quota',async()=>{
 const f=fixture();await f.payments.checkout(f.account.id,'business-20','order-month-1234567890');f.checkout.line_items.data[0].price.id='price_month';
 await f.event('checkout.session.completed');assert.equal(f.ledger.balance(f.account.id).remaining,20);
 await f.event('invoice.paid',{id:f.invoice.id});await f.event('invoice.paid',{id:f.invoice.id},'evt_other_for_same_period');
 assert.equal(f.ledger.balance(f.account.id).remaining,40);
 const previous=f.invoice.lines.data[0].period;f.invoice.lines.data[0].period={start:previous.end,end:Math.floor(addMonths(previous.end*1000,1)/1000)};
 await f.event('invoice.paid',{id:'in_next'},'evt_next');assert.equal(f.ledger.balance(f.account.id).remaining,40,'future quota cannot be used early');f.ledger.close();
});
test('pending subscription resumes after app restart; expired checkout frees its slot',async()=>{
 const f=fixture();await f.payments.checkout(f.account.id,'business-20','order-month-1234567890');await f.payments.checkout(f.account.id,'business-20','order-another-123456');assert.equal(f.calls,1);
 await f.event('checkout.session.expired');assert.equal(f.ledger.db.prepare('SELECT state FROM orders').get().state,'expired');f.ledger.close();
});
test('ambiguous Stripe creation failure resumes with original idempotency key',async()=>{
 const f=fixture();const create=f.stripe.checkout.sessions.create;const keys=[];let failed=false;
 f.stripe.checkout.sessions.create=async(body,options)=>{keys.push(options.idempotencyKey);if(!failed){failed=true;throw new Error('network timeout');}return create(body,options);};
 await assert.rejects(()=>f.payments.checkout(f.account.id,'business-20','original-order-123456'));
 await f.payments.checkout(f.account.id,'business-20','restart-order-123456');assert.equal(keys[0],keys[1]);assert.equal(f.checkout.metadata.inkluraPdfOrder,'original-order-123456');f.ledger.close();
});
test('an active subscription prevents a second checkout',async()=>{
 const f=fixture();await f.payments.checkout(f.account.id,'business-20','order-month-1234567890');await f.event('invoice.paid',{id:f.invoice.id});
 await assert.rejects(()=>f.payments.checkout(f.account.id,'business-20','second-order-123456'),{code:'subscription_already_exists'});f.ledger.close();
});
test('refund pauses exports for review; cancellation does not destroy paid period credits',async()=>{
 const f=fixture();await f.payments.checkout(f.account.id,'volume-100','order-1234567890');await f.event('checkout.session.completed');
 await f.event('customer.subscription.deleted',{id:'unused'});assert.equal(f.ledger.balance(f.account.id).remaining,120);
 await f.event('charge.refunded',{customer:'cus_fixture'});assert.equal(f.ledger.balance(f.account.id).blocked,true);assert.throws(()=>f.ledger.reserve(f.account.id,'export-1234567890'),{code:'account_under_review'});f.ledger.close();
});
test('current Stripe invoice status gates credits; an open invoice never grants quota',async()=>{
 const f=fixture();await f.payments.checkout(f.account.id,'business-20','order-month-1234567890');f.invoice.status='open';
 await f.event('invoice.paid',{id:f.invoice.id});assert.equal(f.ledger.balance(f.account.id).remaining,20);
 f.invoice.status='paid';await f.event('invoice.paid',{id:f.invoice.id},'evt_confirmed_paid');assert.equal(f.ledger.balance(f.account.id).remaining,40);f.ledger.close();
});
test('late paid invoice for a canceled subscription cannot restore the active subscription lock',async()=>{
 const f=fixture();await f.payments.checkout(f.account.id,'business-20','order-month-1234567890');f.subscription.status='canceled';
 await f.event('invoice.paid',{id:f.invoice.id});assert.equal(f.ledger.getAccount(f.account.id).subscription,null);assert.equal(f.ledger.balance(f.account.id).remaining,40);f.ledger.close();
});
test('approved price amount and exclusive tax behavior are mandatory before checkout',async()=>{
 const f=fixture(), retrieve=f.stripe.prices.retrieve;
 for(const override of [{unit_amount:1},{tax_behavior:'inclusive'},{currency:'usd'},{recurring:{interval:'year'}}]) {
  f.stripe.prices.retrieve=async id=>({...await retrieve(id),...override});
  await assert.rejects(()=>f.payments.checkout(f.account.id,'volume-100','order-wrong-price-1234'),{code:'offer_misconfigured'});
 }
 assert.equal(f.calls,0);f.ledger.close();
});
test('shared Stripe account ignores unrelated checkouts and subscriptions',async()=>{
 const f=fixture();f.checkout.metadata={};f.subscription.metadata={};
 assert.equal((await f.event('checkout.session.completed')).ignored,true);
 assert.equal((await f.event('invoice.paid',{id:'other_invoice'})).ignored,true);
 assert.equal(f.ledger.balance(f.account.id).remaining,20);f.ledger.close();
});
test('billing portal always uses the dedicated Inklura PDF configuration',async()=>{
 const f=fixture();await f.payments.checkout(f.account.id,'volume-100','order-1234567890');
 let sent;f.stripe.billingPortal.sessions.create=async body=>{sent=body;return {url:'https://billing.stripe.com/p/session/test'};};
 await f.payments.portal(f.account.id);assert.equal(sent.configuration,'bpc_fixture');assert.equal(sent.customer,'cus_fixture');
 f.payments.portalConfiguration=undefined;await assert.rejects(()=>f.payments.portal(f.account.id),{code:'portal_not_configured'});f.ledger.close();
});
test('France billing is validated before Stripe, including overseas and malformed address rejection',async()=>{
 const f=fixture();let contacted=false;f.stripe.taxRates.retrieve=async()=>{contacted=true;throw Error('must not contact Stripe');};
 for(const details of [null,{}, {...billing,country:'BE'}, {...billing,postalCode:'97100'}, {...billing,postalCode:'98000'}, {...billing,name:''}, {...billing,extra:'field'}]) {
  await assert.rejects(()=>f.payments.checkout(f.account.id,'volume-100','france-order-1234567',details));
 }
 assert.equal(contacted,false);assert.equal(f.calls,0);f.ledger.close();
});
test('fixed French VAT is attached to both one-off and recurring prices with complete billing',async()=>{
 const f=fixture();await f.payments.checkout(f.account.id,'volume-100','france-order-1234567');
 assert.deepEqual(f.sent.line_items,[{price:'price_volume',quantity:1,tax_rates:['txr_france']}]);
 assert.equal(f.sent.automatic_tax,undefined);assert.equal(f.sent.invoice_creation,undefined);assert.deepEqual(f.sent.payment_method_types,['card']);
 assert.match(f.sent.custom_text.submit.message,/France métropolitaine/);
 f.checkout.id='cs_month';await f.payments.checkout(f.account.id,'business-20','france-month-1234567');assert.deepEqual(f.sent.line_items[0].tax_rates,['txr_france']);
 f.stripe.taxRates.retrieve=async()=>({active:true,country:'FR',percentage:0,inclusive:false,livemode:false});
 await assert.rejects(()=>f.payments.checkout(f.account.id,'volume-100','france-bad-tax-1234567'),{code:'tax_misconfigured'});f.ledger.close();
});
test('a foreign address substituted in Stripe receives no credits and its payment is refunded idempotently',async()=>{
 const f=fixture();await f.payments.checkout(f.account.id,'volume-100','france-order-1234567');f.checkout.customer_details.address.country='BE';
 await f.event('checkout.session.completed');await f.event('checkout.session.completed');
 assert.equal(f.refunds.length,1);assert.equal(f.refunds[0].body.payment_intent,'pi_fixture');
 assert.equal(f.ledger.balance(f.account.id).remaining,20);assert.equal(f.ledger.balance(f.account.id).blocked,true);
 assert.equal(f.ledger.db.prepare('SELECT state FROM orders').get().state,'country_rejected');f.ledger.close();
});
test('foreign subscription invoice cancels renewal, refunds through the current invoice payment API and cannot grant quota',async()=>{
 const f=fixture();await f.payments.checkout(f.account.id,'business-20','order-month-1234567890');f.invoice.customer_address.postal_code='97400';
 await f.event('invoice.paid',{id:f.invoice.id});await f.event('invoice.paid',{id:f.invoice.id});
 assert.deepEqual(f.cancellations,['sub_fixture']);assert.equal(f.refunds.length,1);assert.equal(f.refunds[0].body.payment_intent,'pi_invoice');
 assert.equal(f.ledger.balance(f.account.id).remaining,20);assert.equal(f.ledger.getAccount(f.account.id).subscription,null);f.ledger.close();
});
test('completed zero-total coupon order grants once, incomplete or nonzero orders do not', async () => {
 const f=fixture(); await f.payments.checkout(f.account.id,'volume-100','order-coupon-123456');
 assert.equal(f.sent.allow_promotion_codes,true);
 f.checkout.payment_status='no_payment_required'; f.checkout.payment_intent=null;
 for (const [status,amount_total] of [['open',0],['complete',100],['complete',null]]) {
  Object.assign(f.checkout,{status,amount_total}); await f.event('checkout.session.completed',{},`evt_${status}_${amount_total}`);
  assert.equal(f.ledger.balance(f.account.id).remaining,20);
 }
 Object.assign(f.checkout,{status:'complete',amount_total:0});
 await f.event('checkout.session.completed',{},'evt_free');await f.event('checkout.session.completed',{},'evt_free_replay');
 assert.equal(f.ledger.balance(f.account.id).remaining,120);f.ledger.close();
});
test('zero-total foreign checkout is rejected without attempting a nonexistent refund',async()=>{
 const f=fixture();await f.payments.checkout(f.account.id,'volume-100','order-free-foreign123');
 Object.assign(f.checkout,{status:'complete',payment_status:'paid',amount_total:0,payment_intent:null});f.checkout.customer_details.address.country='BE';
 await f.event('checkout.session.completed');assert.equal(f.refunds.length,0);assert.equal(f.ledger.balance(f.account.id).remaining,20);
 assert.equal(f.ledger.db.prepare('SELECT state FROM orders').get().state,'country_rejected');f.ledger.close();
});

const webSecret = 'fixture-web-bridge-secret-at-least-32-characters';
function website(f) { return new WebPurchases({ ledger: f.ledger, payments: f.payments, secret: webSecret }); }
async function webOrder(f, web, plan = 'volume-100') {
 const result = await web.checkout(plan);
 const purchase = f.ledger.db.prepare('SELECT * FROM web_purchases').get();
 f.checkout.client_reference_id = purchase.account;
 f.subscription.metadata = { ...f.sent.metadata };
 return { ...result, purchase };
}
test('pay-first checkout collects billing at Stripe, creates no trial, and resumes the same private receipt', async () => {
 const f = fixture(), web = website(f);
 const { receipt, purchase } = await webOrder(f, web);
 assert.equal(f.ledger.balance(purchase.account).remaining, 0);
 assert.equal(f.sent.success_url, 'https://manage.inklura.fr/pdf/billing?claim=' + receipt);
 assert.equal(f.sent.cancel_url, 'https://pdf.inklura.fr/tarifs?checkout=cancel');
 assert.equal(f.sent.billing_address_collection, 'required');
 assert.ok(!JSON.stringify(purchase).includes(receipt));
 assert.equal((await web.checkout('volume-100', receipt)).receipt, receipt);
 assert.equal(f.calls, 1);
 assert.equal(f.ledger.balance(f.account.id).remaining, 20);
 f.ledger.close();
});
test('purchase claimed before webhook is credited automatically once, with canonical export debit and refund protection', async () => {
 const f = fixture(), web = website(f), { receipt, purchase } = await webOrder(f, web);
 assert.equal(web.claim(f.account.id, receipt).state, 'linked');
 assert.equal(web.account(f.account.id).pendingPurchases, 1);
 assert.equal(f.ledger.balance(f.account.id).remaining, 20, 'claim is never payment evidence');
 await f.event('checkout.session.completed');
 await f.event('checkout.session.async_payment_succeeded');
 assert.equal(web.claim(f.account.id, receipt).state, 'linked');
 assert.equal(f.ledger.balance(f.account.id).remaining, 120);
 assert.equal(web.account(f.account.id).pendingPurchases, 0);
 f.ledger.reserve(f.account.id, 'web-export-123456789');
 f.ledger.transition(f.account.id, 'web-export-123456789', 'commit');
 assert.equal(f.ledger.balance(f.account.id).remaining, 119);
 assert.equal(f.ledger.db.prepare('SELECT used FROM grants WHERE account=?').get(purchase.account).used, 1);
 await f.event('charge.refunded', { customer: 'cus_fixture' });
 assert.equal(f.ledger.balance(f.account.id).blocked, true);
 assert.throws(() => f.ledger.reserve(f.account.id, 'web-export-blocked123'), { code: 'account_under_review' });
 await assert.rejects(() => f.payments.checkout(f.account.id, 'volume-100', 'web-buy-blocked-123'), { code: 'account_under_review' });
 f.ledger.close();
});
test('paid purchase can be claimed later; possession is required and another identity cannot steal or inspect it', async () => {
 const f = fixture(), web = website(f), { receipt, purchase } = await webOrder(f, web);
 await f.event('checkout.session.completed');
 assert.equal(f.ledger.balance(f.account.id).remaining, 20);
 const other = f.ledger.account('https://auth.1clic.pro', 'other');
 assert.throws(() => web.claim(other.id, '0'.repeat(64)), { code: 'invalid_receipt' });
 web.claim(f.account.id, receipt);
 assert.throws(() => web.claim(other.id, receipt), { code: 'invalid_receipt' });
 await assert.rejects(() => web.portal(other.id, purchase.account), { code: 'account_not_found' });
 assert.equal(web.account(other.id).billing.length, 0);
 assert.equal(f.ledger.balance(f.account.id).remaining, 120);
 f.ledger.close();
});
test('linked web subscription renewals reach the same account, block desktop duplicates and retain paid credits after cancellation', async () => {
 const f = fixture(), web = website(f), { receipt, purchase } = await webOrder(f, web, 'business-20');
 f.checkout.line_items.data[0].price.id = 'price_month';
 web.claim(f.account.id, receipt);
 await assert.rejects(() => f.payments.checkout(f.account.id, 'business-20', 'another-sub-12345678'), { code: 'subscription_already_exists' });
 await f.event('checkout.session.completed');
 await f.event('invoice.paid', { id: f.invoice.id });
 assert.equal(f.ledger.balance(f.account.id).remaining, 40);
 await f.event('invoice.paid', { id: f.invoice.id }, 'evt_invoice_replay');
 assert.equal(f.ledger.balance(f.account.id).remaining, 40);
 let sent;
 f.stripe.billingPortal.sessions.create = async body => { sent = body; return { url: 'https://billing.stripe.com/p/session/test' }; };
 await web.portal(f.account.id, purchase.account);
 assert.equal(sent.customer, 'cus_fixture'); assert.equal(sent.return_url, 'https://manage.inklura.fr/pdf/billing');
 await f.event('customer.subscription.deleted', { id: f.subscription.id });
 assert.equal(f.ledger.balance(f.account.id).remaining, 40);
 assert.equal(web.account(f.account.id).billing[0].subscription, false);
 f.ledger.close();
});
test('a foreign web purchase is refunded and cannot be claimed', async () => {
 const f = fixture(), web = website(f), { receipt } = await webOrder(f, web);
 f.checkout.customer_details.address.country = 'BE';
 await f.event('checkout.session.completed');
 assert.throws(() => web.claim(f.account.id, receipt), { code: 'account_under_review' });
 assert.equal(f.refunds.length, 1); assert.equal(f.ledger.balance(f.account.id).remaining, 20);
 f.ledger.close();
});
test('signed server bridge binds identity, body, route and expiry; disabled configuration fails closed', async () => {
 const f = fixture(), web = website(f), path = '/web/account', raw = JSON.stringify({ subject: '12345678-1234-1234-1234-123456789abc' });
 const timestamp = String(Date.now());
 const auth = 'PDF-Web ' + timestamp + ':' + createHmac('sha256', webSecret).update(timestamp + '\n' + path + '\n' + raw).digest('base64url');
 const accepted = web.authenticate(path, raw, auth);
 assert.equal(accepted.account.issuer, 'https://auth.1clic.pro');
 assert.throws(() => web.authenticate('/web/portal', raw, auth), { code: 'invalid_web_signature' });
 assert.throws(() => web.authenticate(path, raw.replace('123456789abc', '123456789def'), auth), { code: 'invalid_web_signature' });
 web.now = () => Date.now() + 61000;
 assert.throws(() => web.authenticate(path, raw, auth), { code: 'invalid_web_signature' });
 const disabled = new WebPurchases({ ledger: f.ledger, payments: f.payments });
 await assert.rejects(() => disabled.checkout('volume-100'), { code: 'purchases_not_enabled' });
 f.ledger.close();
});
test('website invoice selection uses the exact purchase customer even when another source has a subscription', async () => {
 const f = fixture(), web = website(f), { receipt, purchase } = await webOrder(f, web, 'business-20');
 web.claim(f.account.id, receipt);
 f.ledger.db.prepare('UPDATE accounts SET customer=? WHERE id=?').run('cus_desktop', f.account.id);
 f.ledger.db.prepare('UPDATE accounts SET subscription=? WHERE id=?').run('sub_fixture', purchase.account);
 const selected = [];
 f.stripe.billingPortal.sessions.create = async body => { selected.push(body.customer); return {url:'https://billing.stripe.com/p/session/test'}; };
 await web.portal(f.account.id, f.account.id);
 await web.portal(f.account.id, purchase.account);
 assert.deepEqual(selected, ['cus_desktop', 'cus_fixture']);
 f.ledger.close();
});
test('later paid renewal on a claimed purchase creates one new quota and cannot duplicate it', async () => {
 const f = fixture(), web = website(f), { receipt } = await webOrder(f, web, 'business-20');
 web.claim(f.account.id, receipt);
 await f.event('invoice.paid', {id:f.invoice.id});
 const line = f.invoice.lines.data[0];
 line.period = { start: line.period.end, end: Math.floor(addMonths(line.period.end * 1000, 1) / 1000) };
 f.invoice.id = 'in_renewal';
 await f.event('invoice.paid', {id:f.invoice.id}, 'evt_renewal');
 await f.event('invoice.paid', {id:f.invoice.id}, 'evt_renewal_retry');
 const grants = f.ledger.db.prepare("SELECT total FROM grants WHERE kind='subscription'").all();
 assert.equal(grants.length, 2); assert.equal(grants.reduce((n,g)=>n+g.total,0),40);
 assert.equal(f.ledger.balance(f.account.id).remaining,40,'future renewal quota cannot be spent early');
 f.ledger.close();
});
test('ambiguous guest Stripe failure retains the same receipt and checkout idempotency key for retry', async () => {
 const f=fixture(), web=website(f), create=f.stripe.checkout.sessions.create, keys=[];
 let receipt;
 f.stripe.checkout.sessions.create=async (body, options)=>{ keys.push(options.idempotencyKey); if(keys.length===1) throw Error('timeout'); return create(body, options); };
 await assert.rejects(()=>web.checkout('volume-100',null,value=>{receipt=value;}));
 await web.checkout('volume-100',receipt);
 assert.equal(keys[0],keys[1]); assert.equal(f.ledger.db.prepare('SELECT count(*) AS n FROM web_purchases').get().n,1);
 f.ledger.close();
});
test('existing desktop identity keeps paid credits and export history when a web purchase is attached', async () => {
 const f = fixture(), web = website(f);
 const existing = f.ledger.account('https://auth.1clic.pro', '12345678-1234-1234-1234-123456789abc');
 const now = f.ledger.now();
 f.ledger.grant({id:'prior-paid-pack',account:existing.id,kind:'volume',units:500,starts:now,ends:addMonths(now,12)});
 f.ledger.reserve(existing.id,'existing-export-123456');
 f.ledger.transition(existing.id,'existing-export-123456','commit');
 assert.equal(f.ledger.balance(existing.id).remaining,519);
 const {receipt} = await webOrder(f,web);
 await f.event('checkout.session.completed');
 const path='/web/claim',raw=JSON.stringify({subject:existing.subject,receipt}),timestamp=String(Date.now());
 const signature=createHmac('sha256',webSecret).update(timestamp+'\n'+path+'\n'+raw).digest('base64url');
 const authenticated=web.authenticate(path,raw,'PDF-Web '+timestamp+':'+signature);
 assert.equal(authenticated.account.id,existing.id,'web login resolves the same issuer/subject as desktop');
 web.claim(authenticated.account.id,authenticated.data.receipt);
 web.claim(authenticated.account.id,authenticated.data.receipt);
 await f.event('checkout.session.async_payment_succeeded');
 assert.equal(f.ledger.balance(existing.id).remaining,619,'100 purchased credits are added exactly once');
 assert.equal(f.ledger.db.prepare("SELECT count(*) AS n FROM grants WHERE account=? AND kind='trial'").get(existing.id).n,1);
 assert.equal(f.ledger.db.prepare('SELECT state FROM exports WHERE account=?').get(existing.id).state,'committed');
 assert.equal(f.ledger.balance(f.account.id).remaining,20,'unrelated accounts remain unchanged');
 f.ledger.close();
});
test('annual website subscription: yearly price, one invoice grants 12 monthly quotas without carry-over',async()=>{
 const f=fixture();f.payments.priceIds['annual-20']='price_year';f.payments.priceIds['annual-100']='price_year_100';
 f.stripe.prices.retrieve=async id=>({id,active:true,currency:'eur',unit_amount:id==='price_year_100'?14900:4900,tax_behavior:'exclusive',recurring:{interval:'year',interval_count:1}});
 await f.payments.checkout(f.account.id,'annual-20','order-year-1234567890');assert.equal(f.sent.mode,'subscription');
 const now=f.checkout.created*1000,start=Math.floor(now/1000),end=Math.floor(addMonths(now,12)/1000);
 Object.assign(f.subscription.metadata,{inkluraPdfOrder:'order-year-1234567890',inkluraPdfPlan:'annual-20'});
 f.invoice.lines.data[0]={quantity:1,pricing:{price_details:{price:'price_year'}},period:{start,end}};
 await f.event('invoice.paid',{id:f.invoice.id});
 const grants=f.ledger.db.prepare("SELECT * FROM grants WHERE kind='subscription' ORDER BY starts").all();
 assert.equal(grants.length,12);assert.ok(grants.every(g=>g.total===20));
 assert.equal(grants[0].starts,start*1000);assert.equal(grants[11].ends,end*1000);
 for(let i=1;i<12;i++)assert.equal(grants[i].starts,grants[i-1].ends);
 // Trial (20) + the current month only (20): later months are not usable yet.
 assert.equal(f.ledger.balance(f.account.id).remaining,40);
 await assert.rejects(()=>f.payments.checkout(f.account.id,'annual-100','second-year-123456'),{code:'subscription_already_exists'});
 // Replayed invoice: no extra credits.
 await f.event('invoice.paid',{id:f.invoice.id},'evt_again');assert.equal(f.ledger.db.prepare("SELECT count(*) AS n FROM grants WHERE kind='subscription'").get().n,12);
 f.ledger.close();
});
test('annual plan rejects a monthly Stripe price and a monthly plan rejects a yearly one',async()=>{
 const f=fixture();f.payments.priceIds['annual-20']='price_month';
 await assert.rejects(()=>f.payments.checkout(f.account.id,'annual-20','order-year-1234567890'),{code:'offer_misconfigured'});f.ledger.close();
});
test('desktop catalog does not list website-only annual plans',async()=>{
 const f=fixture();assert.ok(f.payments.catalog().every(p=>!p.id.startsWith('annual-')));f.ledger.close();
});
test('panier buyer details prefill the Stripe customer and reach the paid sale; renewals are recorded once',async()=>{
 const { webBuyer } = await import('../france-billing.mjs');
 const f=fixture(), web=website(f);let updated;f.stripe.customers.update=async(id,body)=>{updated=body;return{id};};
 const form=new URLSearchParams({planId:'annual-20',intent:'a'.repeat(36),email:'Client@Exemple.fr',name:'Jeanne Client',company:'Cabinet Exemple',line1:'2 rue du Test',postalCode:'35 000',city:'Rennes'});
 const buyer=webBuyer(form);assert.equal(buyer.name,'Cabinet Exemple');assert.equal(buyer.address.postal_code,'35000');assert.equal(buyer.email,'client@exemple.fr');
 assert.throws(()=>webBuyer(new URLSearchParams({email:'x@y.fr',name:'A B',line1:'1 rue',postalCode:'97400',city:'Saint-Denis'})),{code:'france_only'});
 assert.equal(webBuyer(new URLSearchParams({planId:'volume-100'})),null);
 await web.checkout('volume-100',undefined,()=>{},buyer);
 const purchase=f.ledger.db.prepare('SELECT * FROM web_purchases').get();f.checkout.client_reference_id=purchase.account;
 assert.equal(updated.email,'client@exemple.fr');assert.equal(updated.address.city,'Rennes');assert.equal(f.sent.metadata.inkluraPdfIntent,'a'.repeat(36));
 Object.assign(f.checkout,{amount_total:3480,currency:'eur',total_details:{amount_tax:580},customer_details:{name:'Cabinet Exemple',email:'client@exemple.fr',address:{country:'FR',postal_code:'35000',line1:'2 rue du Test',city:'Rennes'}}});
 await f.event('checkout.session.completed');await f.event('checkout.session.completed',{id:f.checkout.id},'evt_replay');
 let {sales}=web.sales(0);assert.equal(sales.length,1);
 assert.deepEqual([sales[0].kind,sales[0].channel,sales[0].plan,sales[0].amount_total,sales[0].amount_tax,sales[0].buyer.intent,sales[0].buyer.company],['first','web','volume-100',3480,580,'a'.repeat(36),'Cabinet Exemple']);
 assert.equal(web.sales(sales[0].seq).sales.length,0);
 assert.throws(()=>web.sales(-1),{code:'invalid_request'});f.ledger.close();
});
test('subscription renewal invoice is recorded as a renewal sale, the first invoice is not',async()=>{
 const f=fixture();await f.payments.checkout(f.account.id,'business-20','order-month-1234567890');
 Object.assign(f.invoice,{billing_reason:'subscription_create',total:588,total_excluding_tax:490,currency:'eur',customer_name:'A',customer_email:'a@b.fr'});
 await f.event('invoice.paid',{id:f.invoice.id});assert.equal(f.ledger.db.prepare('SELECT count(*) n FROM sales').get().n,0);
 f.invoice.billing_reason='subscription_cycle';f.invoice.id='in_cycle';await f.event('invoice.paid',{id:'in_cycle'},'evt_cycle');
 const sale=f.ledger.db.prepare('SELECT * FROM sales').get();assert.deepEqual([sale.kind,sale.channel,sale.amount_tax,sale.stripe_invoice],['renewal','app',98,'in_cycle']);f.ledger.close();
});
test('a canceled subscription that was sold is recorded for the invoicing worker',async()=>{
 const f=fixture(),web=website(f),{purchase}=await webOrder(f,web,'business-20');f.checkout.line_items.data[0].price.id='price_month';
 Object.assign(f.checkout,{subscription:'sub_fixture',amount_total:588,currency:'eur'});await f.event('checkout.session.completed');
 await f.event('customer.subscription.deleted',{id:'sub_other'},'evt_other');await f.event('customer.subscription.deleted',{id:'sub_fixture',customer:'cus_fixture',ended_at:1700000000});
 const rows=web.sales(0).sales;assert.deepEqual(rows.map(r=>r.kind),['first','cancel']);assert.equal(rows[1].account,purchase.account);assert.equal(rows[1].period_end,1700000000000);f.ledger.close();
});

function promoStripe(f, { coupon = { id: 'cpn_free', valid: true, percent_off: 100, duration: 'once' }, code = 'PACKOFFERT', extra = {} } = {}) {
 f.stripe.promotionCodes = { list: async ({ code: asked }) => ({ data: asked === code ? [{ id: 'promo_fixture', code, active: true, promotion: { type: 'coupon', coupon: coupon.id }, times_redeemed: 0, max_redemptions: 5, ...extra }] : [] }) };
 f.stripe.coupons = { retrieve: async () => coupon };
}
test('promotion code: totals, case-insensitive lookup, unknown/expired/other-product codes refused', async () => {
 const f = fixture(); promoStripe(f);
 const free = await f.payments.promotion('volume-100', ' packoffert ');
 assert.deepEqual([free.code, free.discountCentsHt, free.totalCentsTtc, free.free], ['PACKOFFERT', 2900, 0, true]);
 await assert.rejects(() => f.payments.promotion('volume-100', 'NOPE123'), { code: 'promo_invalid' });
 await assert.rejects(() => f.payments.promotion('volume-100', '<x>'), { code: 'promo_invalid' });
 promoStripe(f, { extra: { expires_at: 1 } });
 await assert.rejects(() => f.payments.promotion('volume-100', 'PACKOFFERT'), { code: 'promo_invalid' });
 promoStripe(f, { coupon: { id: 'cpn', valid: true, percent_off: 100, applies_to: { products: ['prod_other'] } } });
 f.stripe.prices.retrieve = async id => ({ id, product: 'prod_pack', active: true, currency: 'eur', unit_amount: 2900, tax_behavior: 'exclusive' });
 await assert.rejects(() => f.payments.promotion('volume-100', 'PACKOFFERT'), { code: 'promo_not_applicable' });
 promoStripe(f, { coupon: { id: 'cpn', valid: true, amount_off: 1000, currency: 'eur' } });
 const ten = await f.payments.promotion('volume-100', 'PACKOFFERT');
 assert.deepEqual([ten.totalCentsHt, ten.taxCents, ten.totalCentsTtc, ten.free], [1900, 380, 2280, false]);
 f.ledger.close();
});
test('website checkout applies the code as a discount, a new code opens a new session, and the sale keeps the discount', async () => {
 const f = fixture(), web = website(f); promoStripe(f);
 const { receipt } = await web.checkout('volume-100', null, () => {}, null, 'PACKOFFERT');
 assert.deepEqual(f.sent.discounts, [{ promotion_code: 'promo_fixture' }]);
 assert.equal(f.sent.allow_promotion_codes, undefined);
 assert.equal(f.sent.metadata.inkluraPdfPromo, 'PACKOFFERT');
 f.stripe.customers.create = async () => ({ id: 'cus_second' }); f.checkout.id = 'cs_second';
 await web.checkout('volume-100', receipt, () => {}, null, null);
 assert.equal(f.calls, 2);
 assert.equal(f.sent.allow_promotion_codes, true);
 f.ledger.close();
 const g = fixture(), web2 = website(g); promoStripe(g);
 await web2.checkout('volume-100', null, () => {}, null, 'PACKOFFERT');
 const purchase = g.ledger.db.prepare('SELECT * FROM web_purchases').get();
 g.checkout.client_reference_id = purchase.account;
 Object.assign(g.checkout, { payment_status: 'no_payment_required', status: 'complete', amount_total: 0, amount_subtotal: 2900, total_details: { amount_tax: 0, amount_discount: 2900 }, payment_intent: null });
 await g.event('checkout.session.completed');
 const sale = g.ledger.db.prepare('SELECT * FROM sales').get();
 assert.deepEqual([sale.amount_total, sale.amount_subtotal, sale.amount_discount, sale.promo_code], [0, 2900, 2900, 'PACKOFFERT']);
 assert.equal(g.ledger.balance(purchase.account).remaining, 100);
 g.ledger.close();
});

test('panier buyers are not asked again at Stripe: stored address checked, card-only details ignored (activ #1105)',async()=>{
 const { webBuyer } = await import('../france-billing.mjs');
 const f=fixture(), web=website(f);
 const buyer=webBuyer(new URLSearchParams({email:'client@exemple.fr',name:'Jeanne Client',company:'Cabinet Exemple',taxId:'fr 12 345678901',line1:'2 rue du Test',postalCode:'35000',city:'Rennes'}));
 assert.equal(buyer.taxId,'FR12345678901');
 assert.throws(()=>webBuyer(new URLSearchParams({email:'x@y.fr',name:'A B',taxId:'BE0123456789',line1:'1 rue',postalCode:'35000',city:'Rennes'})),{code:'invalid_buyer'});
 await web.checkout('volume-100',undefined,()=>{},buyer);
 const purchase=f.ledger.db.prepare('SELECT * FROM web_purchases').get();f.checkout.client_reference_id=purchase.account;
 assert.equal(f.sent.billing_address_collection,'auto');assert.equal(f.sent.tax_id_collection,undefined);assert.equal(f.sent.customer_update,undefined);assert.equal(f.sent.metadata.inkluraPdfBuyer,'1');
 Object.assign(f.checkout,{amount_total:3480,currency:'eur',customer_details:{name:'J CLIENT',email:'client@exemple.fr',address:{country:'FR',postal_code:null,line1:null,city:null}}});
 await f.event('checkout.session.completed');
 const sale=web.sales(0).sales[0];assert.equal(sale.name,'Cabinet Exemple');assert.equal(sale.address.line1,'2 rue du Test');assert.equal(sale.buyer.taxId,'FR12345678901');
 assert.equal(f.ledger.balance(purchase.account).remaining,100);f.ledger.close();
});
test('a panier buyer whose stored address is not in metropolitan France is refunded',async()=>{
 const { webBuyer } = await import('../france-billing.mjs');
 const f=fixture(), web=website(f);
 await web.checkout('volume-100',undefined,()=>{},webBuyer(new URLSearchParams({email:'c@e.fr',name:'A B',line1:'2 rue',postalCode:'35000',city:'Rennes'})));
 f.checkout.client_reference_id=f.ledger.db.prepare('SELECT * FROM web_purchases').get().account;
 f.stripe.customers.retrieve=async()=>({id:'cus_fixture',address:{country:'BE',postal_code:'1000',line1:'x',city:'Bruxelles'}});
 assert.equal((await f.event('checkout.session.completed')).rejected,'france_only');assert.equal(f.refunds.length,1);f.ledger.close();
});
test('without panier details (no JavaScript) Stripe still collects the billing address and tax id',async()=>{
 const f=fixture(), web=website(f);await webOrder(f,web);
 assert.equal(f.sent.billing_address_collection,'required');assert.deepEqual(f.sent.tax_id_collection,{enabled:true});assert.deepEqual(f.sent.customer_update,{address:'auto',name:'auto'});f.ledger.close();
});

test('a receipt reveals the buyer e-mail only until the purchase is claimed',async()=>{
 const { webBuyer } = await import('../france-billing.mjs');
 const f=fixture(), web=website(f);
 const { receipt } = await web.checkout('volume-100',undefined,()=>{},webBuyer(new URLSearchParams({email:'Client@Exemple.fr',name:'Jeanne Client',line1:'2 rue',postalCode:'35000',city:'Rennes'})));
 assert.deepEqual(web.receipt(receipt),{plan:web.receipt(receipt).plan,linked:false,email:'client@exemple.fr',name:'Jeanne Client'});
 assert.throws(()=>web.receipt('0'.repeat(64)),{code:'invalid_receipt'});assert.throws(()=>web.receipt('x'),{code:'invalid_receipt'});
 web.claim(f.account.id,receipt);assert.equal(web.receipt(receipt).email,null);assert.equal(web.receipt(receipt).linked,true);f.ledger.close();
});
