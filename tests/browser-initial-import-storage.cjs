'use strict';
// Storage ownership checks only. No native engine, decoder or GPU is required.
const {test,before}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
let M,Data;
before(async()=>{M=await import('../src/browser-initial-import/four-ball.mjs');Data=await import('../src/browser-initial-import/exact-data.mjs');});
const ordinary=()=>({snapshot:new Uint8Array([1,2,3]),capture:{application:{}}});
const project=x=>M.projectInitialFourBall({...x,decoded:x.decoded??{state:{fields:[]}}});
const sharedError=e=>e.code==='initial-import-contract'&&/shared storage|non-shared ArrayBuffer|prototype/i.test(e.message);
async function rejectedBeforeClone(run,input,expected){
 const nativeClone=globalThis.structuredClone;let clones=0;
 globalThis.structuredClone=()=>{clones++;throw Error('Unexpected clone before ownership rejection');};
 try{await assert.rejects(run(input),expected);assert.equal(clones,0);}finally{globalThis.structuredClone=nativeClone;}
}
test('both public entries reject SAB-backed snapshots before cloning or decoding, without writing storage',async()=>{
 for(const run of [project,x=>M.importInitialFourBall({decodeSnapshot(){throw Error('Unexpected decoder call');}},x)]){
  const shared=new SharedArrayBuffer(16),whole=new Uint8Array(shared);whole.set([11,12,13,14,15,16]);
  const input={...ordinary(),snapshot:new Uint8Array(shared,2,3)},before=Array.from(whole);
  await rejectedBeforeClone(run,input,sharedError);assert.deepEqual(Array.from(whole),before);assert.equal(input.snapshot.buffer,shared);
 }
});
test('raw SAB, every view family and DataView are rejected recursively inside capture or typed state',async()=>{
 const storage=new SharedArrayBuffer(32),views=[storage,new Uint8Array(storage,2,3),new Uint8ClampedArray(storage),new Int8Array(storage),new Int16Array(storage),new Uint16Array(storage),new Int32Array(storage),new Uint32Array(storage),new Float32Array(storage),new Float64Array(storage),new DataView(storage,4,8),new BigInt64Array(storage),new BigUint64Array(storage)];
 new Uint8Array(storage).set([1,3,5,7]);const bytes=Array.from(new Uint8Array(storage));
 for(const value of views){
  const input=ordinary();input.capture.application.nested={array:[{storage:value}]};const nested=input.capture.application.nested;
  await rejectedBeforeClone(x=>M.importInitialFourBall({decodeSnapshot(){throw Error('Unexpected decode');}},x),input,sharedError);
  await rejectedBeforeClone(project,input,sharedError);assert.equal(input.capture.application.nested,nested);
  const typed=ordinary();typed.decoded={state:{fields:[['metadata',{value:{storage:value}}]]}};
  await rejectedBeforeClone(project,typed,sharedError);assert.equal(typed.decoded.state.fields[0][1].value.storage,value);
 }
 assert.deepEqual(Array.from(new Uint8Array(storage)),bytes);
});
test('intrinsic view storage checks and prototype guards reject cross-realm shared data',async()=>{
 const values=vm.runInNewContext('[new SharedArrayBuffer(8),new Uint8Array(new SharedArrayBuffer(8)),new DataView(new SharedArrayBuffer(8))]');
 for(const storage of values){const x=ordinary();x.capture.application.extra=storage;await rejectedBeforeClone(project,x,sharedError);}
});
test('own, nested, non-enumerable and inherited accessors are rejected without calling getters',async()=>{
 for(const where of ['snapshot','capture','typed','nonenumerable','inherited','view']){
  const input=ordinary();input.decoded={state:{fields:[]}};let reads=0;
  const get=()=>{reads++;return new SharedArrayBuffer(8);};
  if(where==='snapshot')Object.defineProperty(input,'snapshot',{get,enumerable:true});
  if(where==='capture')Object.defineProperty(input.capture.application,'later',{get,enumerable:true});
  if(where==='typed')Object.defineProperty(input.decoded.state,'later',{get,enumerable:true});
  if(where==='nonenumerable')Object.defineProperty(input.capture.application,'later',{get,enumerable:false});
  if(where==='inherited')Object.setPrototypeOf(input.capture.application,{get later(){return get();}});
  if(where==='view')Object.defineProperty(input.snapshot,'buffer',{get,enumerable:true});
  const expected=e=>e.code==='initial-import-contract'&&/accessor|prototype/.test(e.message);
  await rejectedBeforeClone(x=>M.projectInitialFourBall(x),input,expected);assert.equal(reads,0);
  await rejectedBeforeClone(x=>M.importInitialFourBall({decodeSnapshot(){throw Error('Unexpected decode');}},x),input,expected);
  assert.equal(reads,0);
 }
});
test('cycles terminate, shared data inside a cycle still rejects and ordinary ArrayBuffer/view graphs are allowed',()=>{
 const buffer=new ArrayBuffer(16),root={a:new Uint8Array(buffer),b:new DataView(buffer),nested:Object.create(null)};root.self=root;root.nested.parent=root;
 assert.doesNotThrow(()=>Data.assertOwnedInputData(root));assert.equal(root.self,root);assert.equal(root.a.buffer,buffer);
 root.nested.shared=new SharedArrayBuffer(8);assert.throws(()=>Data.assertOwnedInputData(root),sharedError);
 for(const value of [new Map([['hidden',new SharedArrayBuffer(8)]]),new Set([new SharedArrayBuffer(8)]),new Date(),Object.create({custom:true})])assert.throws(()=>Data.assertOwnedInputData({value}),/prototype|container/);
});
test('Proxy reflection failures become rejection, without reading thrown error metadata',()=>{
 let codeReads=0,trapCalls=0;const error={get code(){codeReads++;throw Error('Do not read untrusted error accessors');}};
 const proxy=new Proxy({},{getPrototypeOf(){trapCalls++;throw error;}});
 assert.throws(()=>Data.assertOwnedInputData({proxy}),e=>e.code==='initial-import-contract'&&/inspection failed/.test(e.message));assert.equal(trapCalls,1);assert.equal(codeReads,0);
});

test('canonicalized clone rejects disguised shared internal-slot types before any await or decoder call',async()=>{
 const shared=new SharedArrayBuffer(8),values=[shared,new Map([['nested',shared]]),new Set([shared]),new WebAssembly.Memory({initial:1,maximum:1,shared:true})];
 for(const value of values){
  Object.setPrototypeOf(value,Object.prototype);
  const copied=structuredClone(value);assert.notEqual(Object.getPrototypeOf(copied),Object.prototype,'Clone canonicalizes the hidden internal-slot type');
  const input=ordinary();input.capture.application.game={lastResult:value};
  const expected=e=>e.code==='initial-import-contract'&&/prototype|shared storage/i.test(e.message);
  for(const run of [project,x=>M.importInitialFourBall({decodeSnapshot(){throw Error('Unexpected decode');}},x)]){
   const clone=globalThis.structuredClone;let calls=0;globalThis.structuredClone=value=>{calls++;return clone(value);};
   try{const pending=run(input);assert.equal(calls,1,'One synchronous canonicalization, then rejection before the first await');await assert.rejects(pending,expected);}finally{globalThis.structuredClone=clone;}
  }
  assert.equal(Object.getPrototypeOf(value),Object.prototype);assert.equal(input.capture.application.game.lastResult,value);
 }
});
