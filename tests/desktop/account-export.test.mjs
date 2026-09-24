import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, rename, unlink, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AccountExports } from '../../electron/account-export.mjs';
// Simulated remote ledger models committed/reserved state across network faults.
async function fixture(override){
 const directory=await mkdtemp(path.join(tmpdir(),'inklura-export-'));const states=new Map();
 const controller={account:{accountId:'owner-a'},refresh:async()=>{},request:async(url,{operation})=>{
  const action=url.split('/').at(-1),state=states.get(operation);
  if(override){const result=await override({action,operation,state,states});if(result!==undefined)return result;}
  if(action==='reserve'){if(!state)states.set(operation,'reserved');return {state:states.get(operation)};}
  if(!state){const e=new Error('missing');e.code='operation_not_found';throw e;}
  if(action==='commit')states.set(operation,'committed');
  if(action==='release'){if(state==='committed'){const e=new Error('committed');e.code='already_committed';throw e;}states.set(operation,'released');}
  return {state:states.get(operation)};
 }};
 const options={directory:path.join(directory,'journal'),account:controller};return{directory,controller,states,options,exports:new AccountExports(options),file:path.join(directory,'result.pdf'),cleanup:()=>rm(directory,{recursive:true,force:true})};
}
const bytes=Buffer.from('%PDF-1.7\nsynthetic export\n%%EOF');
test('successful native save consumes one credit and leaves no pending journal',async()=>{
 const f=await fixture();try{const result=await f.exports.save(f.file,bytes);assert.equal(result.saved,true);assert.equal(result.accountingPending,false);assert.deepEqual(await readFile(f.file),bytes);assert.deepEqual([...f.states.values()],['committed']);assert.deepEqual(await f.exports.entries(),[]);}finally{await f.cleanup();}
});
test('disk write failure releases the credit and preserves the original target',async()=>{
 const f=await fixture();await writeFile(f.file,'previous content');const io={readFile,rename,unlink,mkdir,writeFile:async(file,...args)=>{if(path.basename(file).startsWith('.inklura-'))throw Object.assign(Error('disk full'),{code:'ENOSPC'});return writeFile(file,...args);}};
 try{const exports=new AccountExports({...f.options,io});await assert.rejects(()=>exports.save(f.file,bytes),/disk full/);assert.equal(await readFile(f.file,'utf8'),'previous content');assert.deepEqual([...f.states.values()],['released']);}finally{await f.cleanup();}
});
test('lost reservation response is reconciled without charging an unsaved export',async()=>{
 const f=await fixture(({action,operation,states})=>{if(action==='reserve'){states.set(operation,'reserved');throw Error('connection lost');}});
 try{await assert.rejects(()=>f.exports.save(f.file,bytes),/connection lost/);assert.deepEqual([...f.states.values()],['released']);await assert.rejects(()=>readFile(f.file),{code:'ENOENT'});}finally{await f.cleanup();}
});
test('an identical pre-existing PDF is not charged when reservation acknowledgement is lost',async()=>{
 const f=await fixture(({action,operation,states})=>{if(action==='reserve'){states.set(operation,'reserved');throw Error('connection lost');}});
 try{await writeFile(f.file,bytes);await assert.rejects(()=>f.exports.save(f.file,bytes));assert.deepEqual([...f.states.values()],['released']);assert.deepEqual(await readFile(f.file),bytes);}finally{await f.cleanup();}
});
test('saved export survives a commit outage; next launch settles the same operation once',async()=>{
 let offline=true;const f=await fixture(({action})=>{if(action==='commit'&&offline)throw Error('offline');});
 try{const result=await f.exports.save(f.file,bytes);assert.equal(result.saved,true);assert.equal(result.accountingPending,true);assert.deepEqual([...f.states.values()],['reserved']);offline=false;const reopened=new AccountExports(f.options);await reopened.reconcile();assert.deepEqual([...f.states.values()],['committed']);assert.deepEqual(await reopened.entries(),[]);}finally{await f.cleanup();}
});
test('a lost successful commit response retries idempotently, never releases the saved PDF',async()=>{
 let fail=true;const f=await fixture(({action,operation,states})=>{if(action==='commit'&&fail){states.set(operation,'committed');throw Error('lost response');}});
 try{assert.equal((await f.exports.save(f.file,bytes)).accountingPending,true);fail=false;await f.exports.reconcile();assert.deepEqual([...f.states.values()],['committed']);assert.equal(f.states.size,1);}finally{await f.cleanup();}
});
test('another signed-in account cannot reconcile the previous owner’s exports',async()=>{
 const f=await fixture(({action})=>{if(action==='commit')throw Error('offline');});
 try{await f.exports.save(f.file,bytes);f.controller.account={accountId:'owner-b'};await f.exports.reconcile();assert.deepEqual([...f.states.values()],['reserved']);assert.equal((await f.exports.entries()).length,1);}finally{await f.cleanup();}
});
test('PDF bytes, local filename and document digest never enter the billing API',async()=>{
 const calls=[];const f=await fixture(({action,operation})=>{calls.push({action,operation});});
 try{await f.exports.save(f.file,bytes);for(const call of calls){assert.match(call.operation,/^[a-f0-9-]{36}$/);assert.deepEqual(Object.keys(call),['action','operation']);}}finally{await f.cleanup();}
});
test('rename failure does not charge when an identical target already exists',async()=>{
 const f=await fixture();await writeFile(f.file,bytes);const io={readFile,writeFile,unlink,mkdir,rename:async(from,to)=>{if(from.includes('.inklura-'))throw Error('target locked');return rename(from,to);}};
 try{const exports=new AccountExports({...f.options,io});await assert.rejects(()=>exports.save(f.file,bytes),/target locked/);assert.deepEqual([...f.states.values()],['released']);assert.deepEqual(await readFile(f.file),bytes);}finally{await f.cleanup();}
});
test('failed save refreshes the displayed balance after releasing its reservation',async()=>{
 const f=await fixture();let refreshes=0;f.controller.refresh=async()=>{refreshes++;};
 const io={readFile,rename,unlink,mkdir,writeFile:async(file,...args)=>{if(path.basename(file).startsWith('.inklura-'))throw Error('disk full');return writeFile(file,...args);}};
 try{await assert.rejects(()=>new AccountExports({...f.options,io}).save(f.file,bytes),/disk full/);assert.equal(refreshes,2);assert.deepEqual([...f.states.values()],['released']);}finally{await f.cleanup();}
});
test('a missing reservation for an already saved PDF retains the recovery journal',async()=>{
 const f=await fixture(({action})=>{if(action==='commit')throw Object.assign(Error('missing'),{code:'operation_not_found'});});
 try{assert.equal((await f.exports.save(f.file,bytes)).accountingPending,true);assert.equal((await f.exports.entries()).length,1);}finally{await f.cleanup();}
});
