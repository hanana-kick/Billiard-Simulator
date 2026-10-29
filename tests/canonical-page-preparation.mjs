import test from 'node:test';import assert from 'node:assert/strict';
import {createCanonicalPreparationScope,awaitCanonicalPreparation,CANONICAL_PREPARATION_HIDDEN_MESSAGE} from '../src/direct-candidate/canonical-page-preparation.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
function page(){const document=new EventTarget(),window=new EventTarget();document.hidden=false;document.visibilityState='visible';return {document,window,hide(){document.hidden=true;document.visibilityState='hidden';document.dispatchEvent(new Event('visibilitychange'));},show(){document.hidden=false;document.visibilityState='visible';document.dispatchEvent(new Event('visibilitychange'));}};}
test('hidden entry and pagehide abort only active preparation; showing never resumes it',()=>{
 const p=page();p.hide();const hidden=createCanonicalPreparationScope(p);assert.throws(()=>hidden.check(),e=>e.name==='AbortError'&&e.message===CANONICAL_PREPARATION_HIDDEN_MESSAGE);hidden.dispose();
 p.show();const active=createCanonicalPreparationScope(p);active.check();p.hide();assert.throws(()=>active.check(),{name:'AbortError'});p.show();assert.throws(()=>active.check(),{name:'AbortError'});active.dispose();
 const retry=createCanonicalPreparationScope(p);retry.check();p.window.dispatchEvent(new Event('pagehide'));assert.equal(retry.signal.aborted,true);retry.dispose();
 const completed=createCanonicalPreparationScope(p);completed.dispose();p.hide();assert.equal(completed.signal.aborted,false);
});
test('caller abort remains an AbortError and listeners are detached',()=>{
 const p=page(),a=new AbortController(),scope=createCanonicalPreparationScope({...p,signal:a.signal});a.abort('manual');assert.throws(()=>scope.check(),e=>e.name==='AbortError'&&e.message==='manual');scope.dispose();scope.dispose();
 const b=new AbortController(),done=createCanonicalPreparationScope({signal:b.signal});done.dispose();b.abort();assert.equal(done.signal.aborted,false);
});
test('waiting native device cancellation returns promptly, destroys only late orphan, and ignores late errors',async()=>{
 const p=page(),scope=createCanonicalPreparationScope(p),old=deferred();let destroyed=0;const result=awaitCanonicalPreparation(old.promise,scope.signal,device=>device.destroy());p.hide();await assert.rejects(result,{name:'AbortError'});
 p.show();const next=createCanonicalPreparationScope(p),current={destroy(){throw Error('must retain retry device');}};assert.equal(await awaitCanonicalPreparation(Promise.resolve(current),next.signal,device=>device.destroy()),current);
 old.resolve({destroy(){destroyed++;}});await new Promise(r=>setImmediate(r));assert.equal(destroyed,1);scope.dispose();next.dispose();
 const a=new AbortController(),late=deferred(),promise=awaitCanonicalPreparation(late.promise,a.signal);a.abort();await assert.rejects(promise,{name:'AbortError'});late.reject(Error('late native rejection'));await new Promise(r=>setImmediate(r));
});
