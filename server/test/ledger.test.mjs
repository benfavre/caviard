import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Ledger, addMonths } from '../ledger.mjs';
const issuer = 'https://auth.1clic.pro';
const op = n => 'export-operation-' + String(n).padStart(4, '0');
function setup(now = Date.UTC(2026, 8, 23)) { const clock = { now }; const ledger = new Ledger(':memory:', { now: () => clock.now }); const account = ledger.account(issuer, 'person-a'); return { ledger, account, clock }; }
test('one trial per issuer/subject, independent accounts and no tenant email assumptions', () => {
 const {ledger,account}=setup(); assert.equal(ledger.balance(account.id).remaining,20);
 assert.equal(ledger.account(issuer,'person-a').id,account.id);
 assert.equal(ledger.balance(account.id).remaining,20);
 const other=ledger.account(issuer,'person-b'); assert.equal(ledger.balance(other.id).remaining,20);
 ledger.close();
});
test('twenty successful exports exhaust quota; imports and analysis have no debit API', () => {
 const {ledger,account}=setup();
 for(let i=0;i<20;i++){ledger.reserve(account.id,op(i));ledger.transition(account.id,op(i),'commit');}
 assert.equal(ledger.balance(account.id).remaining,0);
 assert.throws(()=>ledger.reserve(account.id,op(21)),{code:'quota_exhausted'}); ledger.close();
});
test('reserving and committing are idempotent; success cannot be self-refunded',()=>{
 const {ledger,account}=setup(); ledger.reserve(account.id,op(1));ledger.reserve(account.id,op(1));
 assert.equal(ledger.balance(account.id).remaining,19);assert.equal(ledger.balance(account.id).reserved,1);
 ledger.transition(account.id,op(1),'commit');ledger.transition(account.id,op(1),'commit');
 assert.equal(ledger.balance(account.id).remaining,19);assert.equal(ledger.balance(account.id).reserved,0);
 assert.throws(()=>ledger.transition(account.id,op(1),'release'),{code:'already_committed'});ledger.close();
});
test('failed/cancelled save releases once; an old operation cannot be resurrected',()=>{
 const {ledger,account}=setup();ledger.reserve(account.id,op(1));ledger.transition(account.id,op(1),'release');ledger.transition(account.id,op(1),'release');
 assert.equal(ledger.balance(account.id).remaining,20);
 assert.throws(()=>ledger.reserve(account.id,op(1)),{code:'operation_closed'});
 assert.throws(()=>ledger.transition(account.id,op(1),'commit'),{code:'operation_closed'});ledger.close();
});
test('operations cannot be read or committed across accounts',()=>{
 const {ledger,account}=setup();const other=ledger.account(issuer,'person-b');ledger.reserve(account.id,op(1));
 assert.throws(()=>ledger.transition(other.id,op(1),'commit'),{code:'operation_not_found'});
 assert.equal(ledger.balance(other.id).remaining,20);ledger.close();
});
test('spend earliest expiry first; exclude future and expired grants',()=>{
 const {ledger,account,clock}=setup();const start=clock.now;
 ledger.grant({id:'pack',account:account.id,kind:'volume',units:100,starts:start,ends:addMonths(start,12)});
 ledger.grant({id:'month',account:account.id,kind:'subscription',units:20,starts:start,ends:addMonths(start,1)});
 ledger.grant({id:'future',account:account.id,kind:'subscription',units:500,starts:addMonths(start,2),ends:addMonths(start,3)});
 ledger.reserve(account.id,op(1));ledger.transition(account.id,op(1),'commit');
 assert.equal(ledger.db.prepare('SELECT used FROM grants WHERE id=?').get('month').used,1);
 clock.now=addMonths(start,1);assert.equal(ledger.balance(account.id).remaining,120);
 clock.now=addMonths(start,12);assert.equal(ledger.balance(account.id).remaining,20);ledger.close();
});
test('calendar validity handles leap day and month boundaries',()=>{
 assert.equal(new Date(addMonths(Date.UTC(2024,1,29,12),12)).toISOString(),'2025-02-28T12:00:00.000Z');
 assert.equal(new Date(addMonths(Date.UTC(2026,0,31),1)).toISOString(),'2026-02-28T00:00:00.000Z');
});
test('reservation survives restart and pack expiry, then can settle exactly once',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'inklura-ledger-')),file=path.join(dir,'db.sqlite');let now=1000;
 let ledger=new Ledger(file,{now:()=>now});const account=ledger.account(issuer,'a');
 ledger.grant({id:'pack',account:account.id,kind:'volume',units:1,starts:1000,ends:2000});ledger.reserve(account.id,op(1));ledger.close();
 now=3000;ledger=new Ledger(file,{now:()=>now});ledger.transition(account.id,op(1),'commit');
 assert.equal(ledger.db.prepare('SELECT used FROM grants WHERE id=?').get('pack').used,1);ledger.close();rmSync(dir,{recursive:true});
});
test('two service connections share the same quota and cannot overspend',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'inklura-ledger-')),file=path.join(dir,'db.sqlite');
 const a=new Ledger(file),b=new Ledger(file),account=a.account(issuer,'a');
 for(let i=0;i<20;i++) (i%2?a:b).reserve(account.id,op(i));
 assert.throws(()=>a.reserve(account.id,op(21)),{code:'quota_exhausted'});
 assert.throws(()=>b.reserve(account.id,op(22)),{code:'quota_exhausted'});a.close();b.close();rmSync(dir,{recursive:true});
});
test('event deduplication and credit update are a single rollback-safe transaction',()=>{
 const {ledger,account,clock}=setup();
 assert.throws(()=>ledger.once('event-1',()=>{ledger.grant({id:'paid',account:account.id,kind:'volume',units:100,starts:clock.now,ends:addMonths(clock.now,12)});throw Error('crash');}));
 assert.equal(ledger.balance(account.id).remaining,20);
 assert.equal(ledger.once('event-1',()=>ledger.grant({id:'paid',account:account.id,kind:'volume',units:100,starts:clock.now,ends:addMonths(clock.now,12)})),true);
 assert.equal(ledger.once('event-1',()=>{throw Error('duplicate');}),false);assert.equal(ledger.balance(account.id).remaining,120);ledger.close();
});
test('reject malformed ids and grant collisions rather than crediting another account',()=>{
 const {ledger,account,clock}=setup();
 assert.throws(()=>ledger.reserve(account.id,'../../file'),{code:'invalid_operation'});
 const grant={id:'pack',account:account.id,kind:'volume',units:100,starts:clock.now,ends:addMonths(clock.now,12)};
 ledger.grant(grant);ledger.grant(grant);
 assert.throws(()=>ledger.grant({...grant,account:ledger.account(issuer,'b').id}),{code:'grant_conflict'});ledger.close();
});
