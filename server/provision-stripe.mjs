import Stripe from 'stripe';
import { stripeLiveMode } from './stripe-mode.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { DOCUMENT_PLANS } from '../electron/commerce-catalog.mjs';
process.on('uncaughtException', error => { console.error('Stripe setup failed: ' + String(error.message).replace(/(?:sk|rk|whsec)_[A-Za-z0-9_]+/g, '[redacted]')); process.exit(1); });
const env=process.env;
const key=env.STRIPE_SECRET_KEY;
if (!key || !env.INKLURA_PDF_EXPECTED_STRIPE_ACCOUNT) throw Error('Dedicated Stripe account configuration required');
const live=stripeLiveMode(key,env.INKLURA_PDF_STRIPE_MODE);
if(live && !process.argv.includes('--live'))throw Error('Live catalog setup requires --live');
const stripe=new Stripe(key,{maxNetworkRetries:2,timeout:20000});
const account=await stripe.accounts.retrieve();
if(account.id!==env.INKLURA_PDF_EXPECTED_STRIPE_ACCOUNT)throw Error('Wrong Stripe account: no changes made');
if((await stripe.balance.retrieve()).livemode!==live)throw Error('Stripe account environment differs from configured mode: no changes made');
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9);
if(!output)throw Error('Private --output=path required');
let previous={};try{previous=JSON.parse(await readFile(output,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(previous.account && previous.account!==account.id)throw Error('Output belongs to another account');
const result={...previous,account:account.id,live,prices:{...previous.prices}};
const save=()=>writeFile(output,JSON.stringify(result,null,2)+'\n',{mode:0o600});
if(process.argv.includes('--france')) {
 const rates=await stripe.taxRates.list({active:true,limit:100});
 let rate=rates.data.find(r=>r.metadata?.inkluraProduct==='inklura-pdf' && r.country==='FR' && r.percentage===20 && !r.inclusive);
 if(!rate)rate=await stripe.taxRates.create({display_name:'TVA',description:'Inklura PDF — France métropolitaine',country:'FR',jurisdiction:'France',percentage:20,inclusive:false,tax_type:'vat',metadata:{inkluraProduct:'inklura-pdf'}},{idempotencyKey:'inklura-pdf:fr-vat-20:v1'});
 result.franceTaxRate=rate.id;await save();
}
for(const plan of DOCUMENT_PLANS){
 const lookup='inklura_pdf_'+plan.id.replaceAll('-','_')+'_v1';
 const found=await stripe.prices.list({lookup_keys:[lookup],active:true,limit:2});
 if(found.data.length>1)throw Error('Ambiguous existing price');
 let price=found.data[0];
 if(!price){
  const product=await stripe.products.create({id:lookup,name:'Inklura PDF · '+plan.label,description:plan.documents+' PDF '+(plan.kind==='volume'?'valables 12 mois par compte':'par mois et par compte'),tax_code:'txcd_10202003',metadata:{inkluraProduct:'inklura-pdf',planId:plan.id}}, {idempotencyKey:lookup+':product'});
  price=await stripe.prices.create({product:product.id,lookup_key:lookup,currency:'eur',unit_amount:plan.priceCentsHt,tax_behavior:'exclusive',...(plan.kind==='subscription'?{recurring:{interval:'month',interval_count:1}}:{}),metadata:{inkluraProduct:'inklura-pdf',planId:plan.id}},{idempotencyKey:lookup+':price'});
 }
 if(price.unit_amount!==plan.priceCentsHt || price.currency!=='eur' || price.tax_behavior!=='exclusive' || (plan.kind==='subscription' ? price.recurring?.interval!=='month' || price.recurring?.interval_count!==1 : !!price.recurring))throw Error('Existing price differs from approved catalog');
 result.prices[plan.id]=price.id;await save();console.log('Verified '+plan.id+': '+plan.priceCentsHt+' EUR cents excluding tax');
}
if(!result.portalConfiguration){
 const portal=await stripe.billingPortal.configurations.create({business_profile:{headline:'Inklura PDF — compte et facturation'},default_return_url:'https://outils.inklura.fr/inklura-pdf',features:{customer_update:{enabled:true,allowed_updates:['email','address','tax_id']},invoice_history:{enabled:true},payment_method_update:{enabled:true},subscription_cancel:{enabled:true,mode:'at_period_end'},subscription_update:{enabled:false}},metadata:{inkluraProduct:'inklura-pdf'}},{idempotencyKey:'inklura-pdf:portal:v1'});
 result.portalConfiguration=portal.id;await save();
}
if(process.argv.includes('--france')) {
 await stripe.billingPortal.configurations.update(result.portalConfiguration,{features:{customer_update:{enabled:true,allowed_updates:['email']}}});
}
const url='https://outils.inklura.fr/api/inklura-pdf/v1/stripe/webhook';
if(!result.webhookSecret){
 const hooks=await stripe.webhookEndpoints.list({limit:100});
 if(hooks.data.some(h=>h.url===url))throw Error('Webhook already exists: recover its secret before proceeding');
 const apiVersion=hooks.data.map(h=>h.api_version).filter(Boolean).sort().at(-1) || '2026-08-26.dahlia';
 const hook=await stripe.webhookEndpoints.create({url,description:'Inklura PDF account credits',api_version:apiVersion,enabled_events:['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.expired','invoice.paid','customer.subscription.deleted','charge.refunded','charge.dispute.created'],metadata:{inkluraProduct:'inklura-pdf'}},{idempotencyKey:'inklura-pdf:webhook:v1:'+apiVersion});
 result.webhookApiVersion=apiVersion;result.webhookId=hook.id;result.webhookSecret=hook.secret;await save();
}
console.log('Catalog, dedicated billing portal and webhook configured. Purchases remain controlled by the service activation flags.');
