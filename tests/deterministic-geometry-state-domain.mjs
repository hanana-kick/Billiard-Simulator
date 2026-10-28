import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {Q,r,body,candidate,cloth,flight,hulls,config,oldGlobals,oldLandings} from './fixtures/canonical-geometry-fixtures.mjs';
import {packCushionMotion} from '../src/direct-candidate/deterministic-cushion-time.mjs';
import {packCushionResponseState,runCushionResponseCPU,createCushionResponseGPU,CUSHION_RESPONSE_WGSL} from '../src/direct-candidate/deterministic-cushion-response.mjs';
import {runGlobalCushionCPU,createGlobalCushionGPU,GLOBAL_EXCLUSION_WGSL,GLOBAL_SELECT_WGSL} from '../src/direct-candidate/deterministic-global-cushion.mjs';
import {packLanding3D,runLanding3DCPU,createLanding3DGPU,LANDING_3D_ROOT_WGSL,LANDING_3D_RESPONSE_WGSL} from '../src/direct-candidate/deterministic-landing-3d.mjs';
import {validCanonicalSpinMode} from '../src/direct-candidate/deterministic-canonical-spin.mjs';
import {canonicalVelocitySpinWithin} from '../src/direct-candidate/deterministic-state-domain.mjs';
import {packDirectionalCandidates} from '../src/direct-candidate/deterministic-directional-event.mjs';
import {runIntrinsicCushionCPU,createIntrinsicCushionGPU} from '../src/direct-candidate/deterministic-intrinsic-cushion.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
const hashes=x=>Object.fromEntries(Object.entries(x).filter(([,v])=>v instanceof Uint32Array).map(([k,v])=>[k,hash(v)]));
const offset=v=>{const s=new Uint32Array(v.length+8);s.fill(0xffffffff);s.set(v,4);return s.subarray(4,v.length+4);};
const clone=x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,v.slice()]));
const responseRows=b=>[packCushionMotion([{...b.motion,horizonTicks:65535}]),packCushionResponseState([b.state])];
const highLandings=packLanding3D([
 flight({id:101,velocity:[7.5,-1,0],q:[3,12,8]}),
 flight({id:102,velocity:[-7.5,-1,0],q:[0,16,0]}),
 flight({id:103,velocity:[0,-1,7.5],q:[0,0,-16]}),
 flight({id:104,velocity:[8,0,0],q:[0,0,0]})
]);
const newGlobals=[candidate(body({velocity:[7.5,0,0]},{q:[0,15,0],cushionFriction:.15,clothFriction:.2})),candidate(body({velocity:[8,0,0],acceleration:[16,0,0]})),candidate(body({}, {q:[0,16,0],qRate:[0,64,0]})),candidate(body(),{boundaries:[{body:0,kind:1,value:24,rate:-96}]}),candidate(body({velocity:[8,0,0]},{q:[0,12,0]}))];
const sceneDefinition={provenance:'prepared-finite-cloth-and-static-bounds',ballCount:3,radius:r,mass:.21,y:r,z:0,clothTop:0,clothFootprint:[-1.42,1.42,-.71,.71],restitution:.8,pairFriction:.2,clothFriction:.2,staticBounds:[],motionMaterial:{gravity:9.81,clothFriction:.2,rollingLength:.00045,spinLength:.00035}};
const intrinsic=packDirectionalCandidates([{id:1,provenance:'prepared-supported-collinear-direction',horizonTicks:65535,maxNodes:256,maxIterations:128,residualBudgetQuanta:64,clothRestitution:.2,bodies:[{position:[1.34001,r,0],direction:[1,0],speed:8,surfaceSpeed:-16,radius:r,mass:.21},...[-.5,.5].map(x=>({position:[x,r,.3],direction:[1,0],speed:0,surfaceSpeed:0,radius:r,mass:.21}))]}],sceneDefinition);
const intrinsicDefinition={scene:intrinsic.scene,hulls,response:{provenance:'prepared-source-combined-cushion-material',restitution:.82,friction:.15,maxPointErrorQuanta:8,maxNormalErrorQuanta:1024},admission:config,exclusionNodes:256};

test('stable geometry admits exact signed axis boundaries and rejects one-quantum norm excess',()=>{
 for(const sign of [-1,1])for(const delta of [-1,0,1]){
  const speed=sign*(8*Q+delta)/Q,spin=sign*(16*Q+delta)/Q;
  const linear=()=>candidate(body({velocity:[speed,0,0]}));
  const surface=()=>packCushionResponseState([body({}, {q:[0,spin,0]}).state]);
  const landingV=()=>packLanding3D([flight({velocity:[speed,0,0]})]);
  const landingQ=()=>packLanding3D([flight({q:[0,spin,0]})]);
  for(const f of [linear,surface,landingV,landingQ])delta<=0?assert.doesNotThrow(f):assert.throws(f);
 }
 for(const v of [[6,6,0],[8,1/Q,0],[-8,0,-1/Q]]){
  assert.throws(()=>candidate(body({velocity:v})));
  assert.throws(()=>packLanding3D([flight({velocity:[v[0],0,v[1]||v[2]]})]));
 }
 for(const q of [[12,12,0],[16,1/Q,0],[-16,0,-1/Q]]){
  assert.throws(()=>packCushionResponseState([body({}, {q}).state]));
  assert.throws(()=>packLanding3D([flight({q})]));
 }
 assert.equal(validCanonicalSpinMode(0,[8*Q,1,0],[0,0,0],[0,0,0],[0,0,0]),false);
 assert.equal(validCanonicalSpinMode(0,[0,0,0],[0,0,0],[16*Q,0,1],[0,0,0]),false);
 assert.equal(validCanonicalSpinMode(3,[8*Q,0,0],[0,0,0],[0,0,-8*Q],[0,0,0]),true);
});

test('landing keeps vertical, gap, gravity and position proofs while allowing horizontal/full spin range',()=>{
 const rows=highLandings.subarray(0,3*32),scene=cloth({friction:0}),out=runLanding3DCPU(rows,scene),s=new Int32Array(out.result.buffer);
 for(let i=0;i<3;i++){const z=i*96,b=i*32;assert.equal(out.result[z+1],8);assert.equal(s[z+64],new Int32Array(rows.buffer,rows.byteOffset,rows.length)[b+7]);assert.ok(canonicalVelocitySpinWithin(s.slice(z+64,z+67),s.slice(z+67,z+70)));}
 const full=runLanding3DCPU(highLandings,scene);assert.equal(full.result[3*96+1],4,'gravity pushes the exact 8 m/s input out of domain, never clips');
 assert.throws(()=>packLanding3D([flight({velocity:[0,1+1/Q,0]})]));
 assert.throws(()=>cloth({gravity:16+1/Q}));
 assert.throws(()=>packLanding3D([flight({position:[4+1/Q,1/32,0]})]));
 const largeGap=runLanding3DCPU(packLanding3D([flight({position:[0,1/32+1/8+1/Q,0]})]),cloth());assert.equal(largeGap.roots[1],4);assert.equal(largeGap.roots[2],1);
 assert.equal(new Int32Array(out.result.buffer)[96+68],16*Q,'normal-axis spin is retained exactly');
});

test('global V-C boundary is 24 and unchanged rate 96; advanced out-of-domain state never responds',()=>{
 for(const value of [-24,24-1/Q,24])assert.doesNotThrow(()=>candidate(body(),{boundaries:[{body:0,kind:1,value,rate:96}]}));
 for(const sign of [-1,1])for(const delta of [-1,0,1]){const f=()=>candidate(body(),{boundaries:[{body:0,kind:2,value:sign*(16+delta/Q),rate:96}]});delta<=0?assert.doesNotThrow(f):assert.throws(f);}
 const invalidKind2=candidate(body(),{boundaries:[{body:0,kind:2,value:16,rate:0}]});invalidKind2.limits[18]++;assert.throws(()=>runGlobalCushionCPU(invalidKind2,hulls,config));
 assert.throws(()=>candidate(body(),{boundaries:[{body:0,kind:1,value:24+1/Q,rate:0}]}));
 assert.throws(()=>candidate(body(),{boundaries:[{body:0,kind:1,value:24,rate:96+1/Q}]}));
 for(const index of [1,2]){const out=runGlobalCushionCPU(newGlobals[index],hulls,config);assert.equal(out.state[12],0);assert.equal(out.state[2],2);assert.equal(out.state[9],6);assert.equal(out.response.some(Boolean),false);const s=new Int32Array(out.state.buffer);assert.ok(!canonicalVelocitySpinWithin(s.slice(36,39),s.slice(39,42)),'attempted out-of-domain values retained, not clipped');}
 const accepted=runGlobalCushionCPU(newGlobals[4],hulls,config);assert.equal(accepted.state[1],8,'speed 8 / surface spin 12 reaches a genuine coupled response');assert.equal(accepted.response[1],1);assert.ok(canonicalVelocitySpinWithin(new Int32Array(accepted.response.buffer).slice(8,11),new Int32Array(accepted.response.buffer).slice(11,14)));
 const bound=runIntrinsicCushionCPU(intrinsic.rows,intrinsicDefinition),l=new Int32Array(bound.input.limits.buffer);assert.equal(l[18],24*Q);assert.deepEqual(bound,runIntrinsicCushionCPU(offset(intrinsic.rows),intrinsicDefinition));
});

test('raw norm corruption, INT_MIN, reserved metadata, offsets and shared buffers preserve validation',()=>{
 const input=candidate();for(const [part,index,value]of [['motion',7,8*Q+1],['states',8,16*Q+1],['states',9,0x80000000],['states',25,1],['limits',18,24*Q+1]]){const bad=clone(input);if(part==='limits'){bad.limits[4]=1;bad.limits[16]=0;bad.limits[17]=1;}bad[part][index]=value;assert.throws(()=>runGlobalCushionCPU(bad,hulls,config));}
 const raw=packLanding3D([flight()]);for(const [index,value]of [[7,8*Q+1],[10,16*Q+1],[11,0x80000000],[8,Q+1],[16,1]]){const bad=raw.slice();bad[index]=value;assert.throws(()=>runLanding3DCPU(offset(bad),cloth()));}
 const [motion,state]=responseRows(body());const bad=state.slice();bad[8]=16*Q;bad[9]=1;assert.throws(()=>runCushionResponseCPU(motion,offset(bad),hulls[0],config));
 assert.deepEqual(runGlobalCushionCPU(Object.fromEntries(Object.entries(input).map(([k,v])=>[k,offset(v)])),hulls,config),runGlobalCushionCPU(input,hulls,config));
 assert.deepEqual(runLanding3DCPU(offset(highLandings),offset(cloth())),runLanding3DCPU(highLandings,cloth()));
 for(const which of ['motion','states','limits']){const shared=clone(input);shared[which]=new Uint32Array(new SharedArrayBuffer(input[which].byteLength));shared[which].set(input[which]);assert.throws(()=>runGlobalCushionCPU(shared,hulls,config));}
});

test('old supported inputs retain every output word and each composite includes domain helper once',()=>{
 const old=JSON.parse(fs.readFileSync(new URL('./fixtures/canonical-geometry-old-hashes.json',import.meta.url),'utf8'));
 assert.deepEqual(oldGlobals.map(x=>hashes(runGlobalCushionCPU(x,hulls,config))),old.global);
 assert.deepEqual(hashes(runLanding3DCPU(oldLandings,cloth())),old.landing);
 for(const shader of [CUSHION_RESPONSE_WGSL,GLOBAL_EXCLUSION_WGSL,GLOBAL_SELECT_WGSL,LANDING_3D_ROOT_WGSL,LANDING_3D_RESPONSE_WGSL])assert.equal((shader.match(/fn canonicalNormWithin\(/g)||[]).length,1);
});

test('native widened stable geometry is byte-identical, including failure and immutable async offsets',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:180000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice();const kernels=[];let words=0;
 try{
  const global=await createGlobalCushionGPU(device,hulls,config);kernels.push(global);
  for(const input of [...oldGlobals,...newGlobals]){const view=Object.fromEntries(Object.entries(input).map(([k,v])=>[k,offset(v)])),pending=global.run(view);Object.values(view).forEach(v=>v.fill(0));const actual=await pending,cpu=runGlobalCushionCPU(input,hulls,config);for(const k of ['state','time','admission','records','response']){assert.deepEqual(actual[k],cpu[k],k);words+=cpu[k].length;}}
  const invalid=clone(oldGlobals[0]);invalid.motion[7]=8*Q+1;await assert.rejects(global.run(invalid));
  const response=await createCushionResponseGPU(device,hulls[0],config);kernels.push(response);for(const b of [body({velocity:[8,0,0]},{q:[0,12,0]}),body({velocity:[7.5,0,0]},{q:[0,15,0],cushionFriction:.15,clothFriction:.2}),body({velocity:[8,0,0],acceleration:[16,0,0]})]){const [m,s]=responseRows(b),cpu=runCushionResponseCPU(m,s,hulls[0],config).response,actual=await response.run(offset(m),offset(s));assert.deepEqual(actual.response,cpu);words+=cpu.length;}
  for(const scene of [cloth(),cloth({friction:0})]){const landing=await createLanding3DGPU(device,scene);kernels.push(landing);for(const rows of [oldLandings,highLandings]){const view=offset(rows),pending=landing.run(view);view.fill(0);const actual=await pending,cpu=runLanding3DCPU(rows,scene);for(const k of ['roots','result']){assert.deepEqual(actual[k],cpu[k],k);words+=cpu[k].length;}}}
  const intrinsicGPU=await createIntrinsicCushionGPU(device,intrinsicDefinition);kernels.push(intrinsicGPU);const actual=await intrinsicGPU.run(intrinsic.rows),cpu=runIntrinsicCushionCPU(intrinsic.rows,intrinsicDefinition);for(const k of ['state','time','admission','records','response','prepared','sourceRows']){assert.deepEqual(actual[k],cpu[k],k);words+=cpu[k].length;}assert.deepEqual(actual.input,cpu.input);
  t.diagnostic(JSON.stringify({exactCPUAndGPU:true,words}));
 }finally{kernels.reverse().forEach(k=>k.dispose());device.destroy();gpu.destroy?.();}
});
