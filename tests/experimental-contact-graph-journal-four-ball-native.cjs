'use strict';
// Source-backed prepared graph component gate. Native pose/geometry observations
// are explicit component inputs; this is NOT self-driven whole-shot recurrence.
const{test,before,after}=require('node:test'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),fs=require('node:fs'),crypto=require('node:crypto');
const J=require('../src/experimental-contact-graph-journal'),Native=require('./four-ball-prepared-journal-native-fixture.cjs');
const files=[require.resolve('../src/experimental-contact-graph-journal'),require.resolve('./four-ball-prepared-journal-native-fixture.cjs'),__filename],hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),frozen=new Map(files.map(p=>[p,hash(p)]));
let replay;before(async()=>{replay=await Native.capturePreparedTransitions();});after(()=>{for(const[p,h]of frozen)assert.equal(hash(p),h,'Frozen component source: '+p);});
const same=(a,b)=>a.index===b.index&&a.generation===b.generation;
async function run(device,t){const j=device?await J.createGpuStage(device,replay.seed):J.createReferenceStage(replay.seed),token={};j.claim(token);let projection=j.createProjection(token),adds=0,deletes=0,relocations=0,activated=0;
 try{for(const[frame,n]of replay.frames.entries()){
  const broad=await j.prepare(n.before,token);assert.deepEqual(broad.graph.edges.map(({active,...e})=>e),n.graph.edges.map(({active,...e})=>e),'native source dense identities at frame '+frame);assert.deepEqual(broad.graph.adjacency,n.graph.adjacency,'native source directional graph at frame '+frame);
  const transitions=n.graph.edges.flatMap((e,i)=>e.active!==broad.graph.edges[i].active?[{collider1:e.collider1,collider2:e.collider2,active:e.active}]:[]);activated+=transitions.filter(v=>v.active&&v.collider1.index>=16).length;
  j.narrowTransitions(transitions,token);await j.postSolve(n.after,token);const v=J.viewReceipt(broad.receipt);assert.deepEqual(v.after.edges,n.graph.edges,'native source active graph at frame '+frame);assert.deepEqual(v.after.proxies,n.graph.bodies.map(b=>({min:b.min,max:b.max})),'native source fat proxies at frame '+frame);assert.deepEqual(v.contactEvents,n.contactEvents,'native contact event order at frame '+frame);adds+=v.broadPhaseEvents.filter(e=>e.kind==='AddPair').length;deletes+=v.broadPhaseEvents.filter(e=>e.kind==='DeletePair').length;relocations+=v.operations.filter(e=>e.kind==='edge-relocated').length;projection=J.projectReceipts([broad.receipt],projection,j.backend).projection;j.commit(token);assert.deepEqual(J.projectionSnapshot(projection),j.snapshot());
 }
 assert.ok(adds>=3,'actual native fourth sphere has two lifetimes');assert.ok(deletes>=3);assert.ok(relocations>=1,'actual source dense swap-remove exercised');assert.ok(activated>=1,'actual source geometry activation exercised');assert.ok(replay.frames.some(n=>n.graph.edges.some(e=>same(e.collider2,replay.seed.bodies[3].pair))));
 t.diagnostic(JSON.stringify({backend:j.backend,...replay.evidence,adds,deletes,relocations,activated,scope:'Exact native prepared Journal graph/proxy/event component comparison only; not four-ball world admission or whole-shot parity'}));
 }finally{j.abort(token);j.release(token);j.dispose();}}
let referencePassed=false;
test('prepared N=4 CPU Journal matches independent original-mode native graph transitions',{timeout:120000},async t=>{await run(null,t);referencePassed=true;});
test('prepared N=4 actual WGSL Journal matches the same independent native graph transitions',{timeout:120000,skip:!process.env.GPU_NATIVE_MODULE&&process.env.REQUIRE_WEBGPU!=='1'},async t=>{assert.equal(referencePassed,true);assert.ok(process.env.GPU_NATIVE_MODULE);const{create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice();try{await run(device,t);}finally{device.destroy();}});
