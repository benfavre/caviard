import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { Ledger, addMonths } from '../ledger.mjs';
import { Payments } from '../payments.mjs';
const signing=new Stripe('sk_test_fixture'),secret='whsec_fixture_for_automated_tests';
function fixture({enabled=true}={}) {
 const now=Date.now(),ledger=new Ledger(':memory:',{now:()=>now}),account=ledger.account('https://auth.1clic.pro','user-a');
 let calls=0;
 const checkout={id:'cs_fixture',created:Math.floor(now/1000),status:'open',url:'https://checkout.stripe.com/c/pay/test',customer:'cus_fixture',mode:'payment',payment_status:'paid',client_reference_id:account.id,payment_intent:'pi_fixture',metadata:{inkluraPdfAccount:account.id,inkluraPdfOrder:'order-1234567890'},line_items:{data:[{quantity:1,price:{id:'price_volume'}}],has_more:false}};
 const subscription={id:'sub_fixture',customer:'cus_fixture',metadata:{inkluraPdfAccount:account.id,inkluraPdfOrder:'order-month-1234567890',inkluraPdfPlan:'business-20'}};
 const start=Math.floor(now/1000),end=Math.floor(addMonths(now,1)/1000);
 const invoice={id:'in_fixture',status:'paid',billing_reason:'subscription_cycle',customer:'cus_fixture',parent:{subscription_details:{subscription:'sub_fixture'}},lines:{data:[{quantity:1,pricing:{price_details:{price:'price_month'}},period:{start,end}}],has_more:false}};
 const stripe={webhooks:signing.webhooks, prices:{retrieve:async id=>({id,active:true,currency:'eur',unit_amount:id==='price_month'?490:2900,tax_behavior:'exclusive',...(id==='price_month'?{recurring:{interval:'month',interval_count:1}}:{})})}, customers:{create:async()=>({id:'cus_fixture'})}, checkout:{sessions:{create:async body=>{calls++;Object.assign(checkout,{metadata:body.metadata,mode:body.mode});return checkout;},retrieve:async()=>checkout}},subscriptions:{retrieve:async()=>subscription},invoices:{retrieve:async()=>invoice},charges:{retrieve:async()=>({customer:'cus_fixture'})},billingPortal:{sessions:{create:async()=>({url:'https://billing.stripe.com/p/session/test'})}}};
 const payments=new Payments({ledger,stripe,webhookSecret:secret,priceIds:{'volume-100':'price_volume','business-20':'price_month'},enabled,portalConfiguration:'bpc_fixture',publicUrl:'https://outils.inklura.fr/api/inklura-pdf'});
 const event=async(type,obj={id:checkout.id},id='evt_'+type)=>{const payload=JSON.stringify({id,type,created:Math.floor(now/1000),livemode:false,data:{object:obj}});const signature=signing.webhooks.generateTestHeaderString({payload,secret});return payments.webhook(Buffer.from(payload),signature);};
 return {ledger,account,stripe,payments,checkout,subscription,invoice,event,get calls(){return calls;}};
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
