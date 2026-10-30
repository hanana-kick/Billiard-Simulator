import {restoreEndpointCacheDelta} from './helpers/reviewed-endpoint-cache-delta.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {mmq2RawFixture} from './fixtures/canonical-selected-mmq2-raw.mjs';
import {snapshotCanonicalWorldContinuation} from '../src/direct-candidate/canonical-world-continuation.mjs';
import {packRollingTailScene} from '../src/direct-candidate/deterministic-rolling-tail.mjs';
import {packVerifiedCushionRailMap} from '../src/direct-candidate/deterministic-world-cushion-commit.mjs';
import {packCushionResolverV2Inputs} from '../src/direct-candidate/deterministic-cushion-resolver-v2-inputs.mjs';
import {createCushionResolverV2GPU} from '../src/direct-candidate/deterministic-cushion-resolver-v2.mjs';
import {createLiveWorldCaptureDevice} from '../src/direct-candidate/experimental-live-world-capture.mjs';
const baseline=JSON.parse(await readFile(new URL('./fixtures/cushion-v2-input-baseline.json',import.meta.url),'utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex');
const jsonHash=x=>sha(JSON.stringify(x));
const hulls0=snapshotCanonicalWorldContinuation(mmq2RawFixture().binding).hulls;
function request(changed=false){const hulls=hulls0.map((h,i)=>{h=h.slice();if(changed){h[1]+=100;h[2]=i+3;}return h;});const scene=packRollingTailScene({provenance:'actual-finite-table-roster',hulls,staticBounds:[],clothTop:0,clothFootprint:[-1.42,1.42,-.71,.71]});const rails=packVerifiedCushionRailMap(hulls,Array.from(new Int32Array(scene.buffer).slice(4,8)));return {scene,hulls,rails,bodyCount:changed?3:4,material:{mass:changed?.22:.21,restitution:changed?.7:.8,friction:changed?.12:.14,clothRestitution:0,clothFriction:changed?.25:.2,...(changed?{maxExtensionTicks:32,maxPenetrationQuanta:96,approachMarginQuanta:2,maxPointErrorQuanta:32,maxNormalErrorQuanta:2048,maxIterations:64,residualBudgetQuanta:96}:{})},options:changed?{releaseTicks:37,maxNodes:123,maxInitialPenetrationQuanta:63}:{}};}
async function capture(factory,args){const r=createLiveWorldCaptureDevice({allowCushionIndirect:true}),labels=new Map(),writes=[];const create=r.device.createBuffer,write=r.device.queue.writeBuffer;r.device.createBuffer=d=>{const b=create(d);if(d.label)labels.set(b.id,d.label);return b;};r.device.queue.writeBuffer=(b,...rest)=>{writes.push(b.id);return write(b,...rest);};const engine=await factory(r.device,args.material),stateBuffer=r.device.createBuffer({size:1024,usage:140}),denseBuffer=r.device.createBuffer({size:1024,usage:140}),descriptorBuffer=r.device.createBuffer({size:args.bodyCount*320,usage:140}),contextBuffer=r.device.createBuffer({size:640,usage:140});const bank=engine.createBank({...args,stateBuffer,denseBuffer,descriptorBuffer,contextBuffer});try{bank.encode(r.device.createCommandEncoder());return {buffers:r.buffers.map(b=>({size:b.size,usage:b.usage,bytes:b.bytes})),commands:r.commands,definitions:r.pipelines.map(p=>({code:p.module.code,layout:p.layout,entryPoint:p.entryPoint})),labels,writes,submits:r.submits};}finally{bank.destroy();}}
for(const changed of [false,true])test(`independent old factory bytes/sources/schedule match current ${changed?'changed':'default'} inputs`,async()=>{const args=request(changed),old=baseline.cases[changed?'changed':'default'],now=await capture(createCushionResolverV2GPU,args),packed=packCushionResolverV2Inputs(args),restored=restoreEndpointCacheDelta(now);assert.equal(old.submits,0);assert.equal(now.submits,0);assert.deepEqual(restored.buffers.map(b=>({size:b.size,usage:b.usage,sha256:sha(b.bytes)})),old.buffers);assert.equal(jsonHash(restored.commands),old.commandsSha256);assert.equal(jsonHash(restored.definitions),old.modulesSha256);assert.equal(jsonHash(now.writes),old.writesSha256);assert.equal(now.commands.length,old.commandCount);assert.equal(now.definitions.length,old.moduleCount);assert.equal(now.writes.length,old.writeCount);assert.equal(now.labels.size,17);
 const named={scene:packed.scene,rails:packed.rails,queryConfig:packed.queryConfig,mergeConfig:packed.mergeConfig,releaseConfig:packed.releaseConfig,...Object.fromEntries(packed.hulls.map((x,i)=>['hull:'+i,x])),...Object.fromEntries(packed.materials.map((x,i)=>['material:'+i,x])),...Object.fromEntries(packed.releaseConfigs.map((x,i)=>['release:'+i,x]))};
 for(const [id,label]of now.labels){const x=named[label.replace('wasm-input:cushion-v2:','')];assert.ok(x,label);assert.deepEqual(now.buffers[id].bytes,new Uint8Array(x.buffer,x.byteOffset,x.byteLength));}assert.deepEqual(Array.from(packed.queryConfig),[0,changed?123:256,0,1,1,0,1,1]);for(const [i,b]of now.buffers.entries())if(!now.writes.includes(i))assert.ok(b.bytes.every(x=>x===0));
});
test('packer returns independent snapshots and preserves original admission refusals',async()=>{const a=request(),p=packCushionResolverV2Inputs(a);const scene=a.scene.slice(),hull=a.hulls[0].slice(),rails=a.rails.slice();p.scene.fill(1);p.hulls[0].fill(2);p.rails.fill(3);assert.deepEqual(a.scene,scene);assert.deepEqual(a.hulls[0],hull);assert.deepEqual(a.rails,rails);
 for(const patch of [{bodyCount:2},{options:{releaseTicks:0}},{options:{maxNodes:1025}},{options:{maxNodes:1024}},{options:{maxInitialPenetrationQuanta:0}},{material:{...a.material,maxIterations:0}},{rails:new Uint32Array(a.rails.length)}]){assert.throws(()=>packCushionResolverV2Inputs({...a,...patch}));await assert.rejects(()=>capture(createCushionResolverV2GPU,{...a,...patch}));}
});
test('all exported WGSL source bytes are unchanged from independent baseline',async()=>{const current=await import('../src/direct-candidate/deterministic-cushion-resolver-v2.mjs');assert.equal(baseline.sourceRevision,'715b503f57f6962d99c7a85a787995284960ee8b');assert.deepEqual(Object.keys(current).filter(name=>name.endsWith('_WGSL')).sort(),Object.keys(baseline.exportedWgslSha256).sort());for(const [name,value]of Object.entries(baseline.exportedWgslSha256))assert.equal(sha(current[name]),value,name);const helper=await readFile(new URL('../src/direct-candidate/deterministic-cushion-resolver-v2-inputs.mjs',import.meta.url),'utf8');assert.doesNotMatch(helper,/createBuffer|queue\.writeBuffer|createCushionResolverV2GPU|CaptureDevice/);});

test('reviewed endpoint-cache inverse rejects unrelated source, view, scratch and dispatch changes',async()=>{
 const now=await capture(createCushionResolverV2GPU,request());
 const base={definitions:now.definitions,commands:now.commands,buffers:now.buffers};
 const cacheIndex=base.definitions.findIndex(d=>d.code.includes('var<storage,read_write> endpointCache'));
 assert.ok(cacheIndex>=0);const commandIndex=base.commands.findIndex(c=>c.kind==='dispatch'&&c.pipeline===cacheIndex);
 const cacheId=base.commands[commandIndex].entries[4].buffer;
 for(const mutate of [
  x=>{x.definitions[cacheIndex].code+=' ';},
  x=>{x.commands[commandIndex].entries[4].size=4092;},
  x=>{x.commands[commandIndex].entries[4].offset=4;},
  x=>{x.commands[commandIndex].indirect.offset=12;},
  x=>{x.buffers[cacheId].bytes[4095]=1;},
  x=>{x.buffers[cacheId].usage=128;},
  x=>{const unrelated=x.commands.find(c=>c.kind==='dispatch'&&c.pipeline!==cacheIndex&&c.entries.length<7);unrelated.entries[0].buffer=cacheId;},
  x=>{x.commands.push({kind:'copy',source:cacheId,target:0,size:4,sourceOffset:0,targetOffset:0});},
 ]){const altered=structuredClone(base);mutate(altered);assert.throws(()=>restoreEndpointCacheDelta(altered));}
 // The inverse itself does not mutate the captured current graph.
 const before=jsonHash(base);restoreEndpointCacheDelta(base);assert.equal(jsonHash(base),before);
});
