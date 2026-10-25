import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Floor from '../src/experimental-world-stepper.js';
import Lifecycle from '../src/experimental-world-lifecycle.js';
import Pair from '../src/experimental-cloth-island-world.js';
import Graph from '../src/experimental-arithmetic-graph.js';
import {createNarrowPrograms,generateNarrowphaseWGSL,packFloorNarrow,NARROW_LAYOUT} from '../src/resident-candidate/narrowphase.mjs';
import {executeLowered,generateNumericLibraryWGSL} from '../src/resident-candidate/numeric-program.mjs';
import {createNativeOwner,dispatchWords} from './resident-candidate-gpu-support.mjs';

// Existing independent lifecycle suite's authored cache fixture, not a new
// weakened floor model. Do not import its tests or create an actual GPU there.
const originalFixture=readFileSync(new URL('./floor-cache-lifecycle.cjs',import.meta.url),'utf8');
const fixtureSource=originalFixture.slice(originalFixture.indexOf('function synthetic(){'),originalFixture.indexOf('\nasync function prepare('));
const synthetic=new Function('f','zero','identity',fixtureSource+';return synthetic;')(Math.fround,()=>[0,0,0],()=>[0,0,0,1]);
const bitWords=a=>new Uint32Array(a.buffer,a.byteOffset,a.length);
async function originalPrepare(input){const p=Lifecycle.createReferencePreparedContactStage(input),token={};p.claim(token);try{return await p.prepare(input,token);}finally{p.abort(token);p.release(token);p.dispose();}}
const bundle=createNarrowPrograms();

test('unchanged source geometry graphs are lowered, not replaced with analytic toy formulas',()=>{
 assert.equal(bundle.entries.floor.plan.nodes.length,357);assert.equal(bundle.entries.pair.plan.nodes.length,517);
 const floor=synthetic();for(const y of [.5,.501,.525,.625,2]){floor.translation[1]=Math.fround(y);const input=Floor.pack(floor),e=bundle.entries.floor;assert.deepEqual(bitWords(executeLowered(e.compiled,input,{testOnly:true})),bitWords(Graph.execute(input,e.plan)));}
 assert.ok(bundle.scratchWords<400);assert.equal(Pair.geometryPlan(true).outputs.length,bundle.entries.pair.plan.outputs.length);
});
test('floor packing preserves manifold absence and exact u32 contact ids',()=>{
 const s=synthetic(),a=packFloorNarrow(s);assert.equal(a.length,NARROW_LAYOUT.floorWords);assert.equal(a[128],0);assert.equal(a[129],0);assert.equal(a[132],0);assert.equal(new Float32Array(a.buffer)[118],s.contactRecycleDistance);
 s.contactId=0x80000000;s.topology={...s.topology,pairPresent:true,manifoldPresent:true,pointPresent:true,active:true,recycleValid:true};const b=packFloorNarrow(s);assert.equal(b[136],0x80000000);assert.deepEqual(Array.from(b.subarray(128,133)),[1,1,1,1,1]);
});

test('actual native floor cache births, empty retention, recycling and contact loss match original owner',async t=>{
 if(process.env.REQUIRE_WEBGPU!=='1')return t.skip('assigned serial native GPU slot required');
 const cases=[];const base=synthetic();
 for(const height of [.5,.50001,.501,.502,.525,.625,2])for(const retained of [false,true]){
  const s=structuredClone(base);s.translation[1]=Math.fround(height);
  if(retained){Object.assign(s.topology,{pairPresent:true,manifoldPresent:true,pointPresent:true,active:true,recycleValid:true});s.impulse=Math.fround(.2);s.warmImpulse=Math.fround(.1);}
  const expected=await originalPrepare(s);cases.push({input:s,expected});
 }
 // Recurring empty cache is passed back as an initial component only here; in
 // the full owner these same fields remain resident across actual h steps.
 for(const c of cases.slice(0,8)){const s=c.expected.state;cases.push({input:s,expected:await originalPrepare(s)});}
 const stride=160,states=new Uint32Array(stride*cases.length).fill(0x12345678),facts=new Uint32Array(cases.length);
 cases.forEach((c,i)=>{states.set(packFloorNarrow(c.input),i*stride);facts[i]=Number(c.expected.state.topology.pairPresent);});
 const code=`@group(0) @binding(0) var<storage,read> rc_program:array<u32>;
@group(0) @binding(1) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;
@group(0) @binding(3) var<storage,read> facts:array<u32>;
${generateNumericLibraryWGSL()}\n${generateNarrowphaseWGSL(bundle)}
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=arrayLength(&facts)){return;}let result=rc_narrow_floor(gid.x*${stride}u,gid.x*${bundle.scratchWords}u,0u,facts[gid.x],1u);}`;
 const owner=await createNativeOwner('resident source floor lifecycle');
 try{const [,actual]=await dispatchWords(owner,{code,buffers:[{input:bundle.program},{input:states,readback:true},{words:bundle.scratchWords*cases.length},{input:facts}],workgroups:cases.length});
 for(const[candidate,c]of cases.entries()){
  const expected=packFloorNarrow(c.expected.state),a=actual.subarray(candidate*stride,candidate*stride+144);
  for(let j=0;j<137;j++){if(j===119)continue;assert.equal(a[j],expected[j],`case${candidate} word${j}: ${new Float32Array(a.buffer,a.byteOffset,a.length)[j]} vs ${new Float32Array(expected.buffer)[j]}`);}
  assert.equal(a[137],0);assert.equal(a[138],Number(c.expected.metadata.geometryRefreshed));for(let j=144;j<stride;j++)assert.equal(actual[candidate*stride+j],0x12345678,'candidate guard');
 }
 t.diagnostic(JSON.stringify({cases:cases.length,cacheBitsExact:true,fullWorld:false}));
 }finally{owner.release();}
});
