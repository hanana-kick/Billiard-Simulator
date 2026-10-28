import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {CANONICAL_LINEAR_LIMIT as VL,CANONICAL_SPIN_LIMIT as QL,canonicalNormWithin,canonicalVelocitySpinWithin,canonicalPositionWithin,CANONICAL_STATE_DOMAIN_WGSL} from '../src/direct-candidate/deterministic-state-domain.mjs';
import {createContactMath,CONTACT_MATH_WGSL} from '../src/direct-candidate/deterministic-checked-contact-math.mjs';
import {packSmoothSegments,runSmoothSegmentsCPU,createSmoothSegmentsGPU,smoothDerivativeProbeCPU,SMOOTH_ARITHMETIC_WGSL} from '../src/direct-candidate/deterministic-smooth-segment.mjs';
const Q=2**24;
const smooth=(state,id=1)=>({id,state,budgets:[2000,2000,20000,20000,20000,20000,20000],friction:Math.round(1.962*Q),rolling:Math.round(.358902439*Q),normalSpinDrag:Math.round(.279146341*Q),durationTicks:2048,maxAttempts:16});
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/canonical-domain-old-smooth.json',import.meta.url)));

test('canonical v8/q16 norms compare exact Q48 squares without component clipping',()=>{
 for(const limit of [VL,QL])for(const sign of [-1,1]){assert.equal(canonicalNormWithin([sign*(limit-1),0,0],limit),true);assert.equal(canonicalNormWithin([sign*limit,0,0],limit),true);assert.equal(canonicalNormWithin([sign*(limit+1),0,0],limit),false);assert.equal(canonicalNormWithin([sign*limit,1,0],limit),false);}
 assert.equal(canonicalVelocitySpinWithin([6*Q,6*Q,0],[0,0,0]),false);assert.equal(canonicalVelocitySpinWithin([0,0,0],[12*Q,12*Q,0]),false);
 for(const value of [-2147483648,2147483648,NaN,Infinity,.5])assert.equal(canonicalNormWithin([value,0,0],VL),false);
 const offset=new Int32Array([123,VL,0,0,456]);assert.equal(canonicalNormWithin(offset.subarray(1,4),VL),true);assert.deepEqual(Array.from(offset),[123,VL,0,0,456]);
 assert.equal(canonicalPositionWithin([4*Q,0,0]),true);assert.equal(canonicalPositionWithin([4*Q+1,0,0]),false);
 let seed=0x81920;for(let i=0;i<1000;i++){const v=Array.from({length:3},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed% (2*QL+1))-QL;}),limit=i%2?VL:QL,exact=v.reduce((s,x)=>s+BigInt(x)**2n,0n)<=BigInt(limit)**2n;assert.equal(canonicalNormWithin(v,limit),exact);}
});

test('checked contact arithmetic rejects accumulated overflow and INT_MIN without wrapping',()=>{
 let m=createContactMath();assert.equal(m.dot([64*Q,64*Q],[Q,Q]),0);assert.equal(m.bad,true);
 m=createContactMath();assert.deepEqual(m.cross([0,64*Q,64*Q],[0,Q,-Q]),[0,0,0]);assert.equal(m.bad,true);
 for(const operation of [m=>m.add(-2147483648,1),m=>m.mul(-2147483648,0),m=>m.div(-2147483648,Q),m=>m.norm([-2147483648,0,0]),m=>m.cone(QL,QL)]){m=createContactMath();operation(m);assert.equal(m.bad,true);}
});

test('old accepted smooth fast-path fixture retains every result and diagnostic word',()=>{
 const rows=Uint32Array.from(fixtures.rows),actual=runSmoothSegmentsCPU(rows);assert.deepEqual(Array.from(actual),fixtures.expected);
});

test('smooth state splits position/linear/spin domains and retains material caps',()=>{
 for(const [axis,limit] of [[0,4*Q],[2,VL],[4,QL],[6,QL]])for(const delta of [-1,0,1]){const state=[0,0,0,0,0,0,0];state[axis]=limit+delta;const run=()=>packSmoothSegments([smooth(state)]);if(delta>0)assert.throws(run);else assert.doesNotThrow(run);}
 assert.throws(()=>packSmoothSegments([smooth([0,0,6*Q,6*Q,Q,0,0])]));assert.throws(()=>packSmoothSegments([smooth([0,0,0,0,12*Q,12*Q,0])]));
 assert.throws(()=>packSmoothSegments([{...smooth([0,0,Q,0,Q,0,0]),rolling:4*Q+1}]));assert.throws(()=>packSmoothSegments([{...smooth([0,0,Q,0,Q,0,0]),friction:16*Q+1}]));
 const rows=packSmoothSegments([smooth([0,0,6*Q,0,0,7*Q,0])]),storage=new Uint32Array(rows.length+9);storage.set(rows,5);assert.deepEqual(runSmoothSegmentsCPU(storage.subarray(5,5+rows.length)),runSmoothSegmentsCPU(rows));
 for(const index of [8,10,12,14]){const forged=rows.slice();forged[index]=0x80000000;assert.throws(()=>runSmoothSegmentsCPU(forged));}
});

const largeVectors=[[24*Q+1,-3*Q-1],[Q/2+1,Q/4-1],[Math.round(.03*Q)+1,-Math.round(.02*Q)-1]];
test('large normalized derivatives use outward coefficient rescaling, including odd negative words',()=>{
 for(const vectors of [largeVectors,[[16*Q+1,1],[1,Q+1],[0,0]]])for(const [lo,hi] of [[0,32768],[8192,16384]]){const r=smoothDerivativeProbeCPU(...vectors,lo,hi);assert.equal(r.scaled,true);assert.equal(r.bad,false);assert.ok(r.bounds);for(let k=0;k<=128;k++){const t=(lo+(hi-lo)*k/128)/32768,u=vectors[0].map((v,i)=>(v+vectors[1][i]*t+vectors[2][i]*t*t)/Q),du=vectors[1].map((v,i)=>(v+2*vectors[2][i]*t)/Q),n=Math.hypot(...u),cross=u[0]*du[1]-u[1]*du[0],d=[-u[1]*cross/n**3,u[0]*cross/n**3];for(let i=0;i<2;i++)assert.ok(d[i]>=r.bounds[i][0]/Q&&d[i]<=r.bounds[i][1]/Q,`${t}/${i}`);}}
 const singular=smoothDerivativeProbeCPU([12*Q,0],[-24*Q,0],[0,0],0,32768);assert.equal(singular.bounds,null);assert.equal(singular.scaled,true);
 const small=smoothDerivativeProbeCPU([Q,0],[0,Q/2],[0,0],0,8192);assert.equal(small.scaled,false);
});

test('recorded source raw witnesses enter smooth continuation unchanged, without clipping',()=>{
 const witnesses=JSON.parse(readFileSync(new URL('./fixtures/canonical-raw-state-witnesses.json',import.meta.url)));
 for(const witness of witnesses.cases){assert.equal(witness.status,1);assert.equal(witness.reason,0);const {position:p,velocity:v,q}=witness,state=[p[0],p[2],v[0],v[2],q[0],q[2],q[1]];assert.equal(v[1],0);assert.ok(canonicalVelocitySpinWithin(v,q));assert.ok(state.slice(2).some(x=>Math.abs(x)>4*Q));const rows=packSmoothSegments([smooth(state,witness.input.id)]);assert.deepEqual(Array.from(new Int32Array(rows.buffer).slice(8,15)),state);assert.equal(runSmoothSegmentsCPU(rows)[1],1);}
});

async function probeGPU(device){
 const code=SMOOTH_ARITHMETIC_WGSL+`@compute @workgroup_size(1) fn main(){bad=false;let r=normalDerivative(vec2<i32>(${largeVectors[0]}),vec2<i32>(${largeVectors[1]}),vec2<i32>(${largeVectors[2]}),0,32768);output[0]=select(0,1,r.valid);output[1]=select(0,1,bad);output[2]=r.axes[0].x;output[3]=r.axes[0].y;output[4]=r.axes[1].x;output[5]=r.axes[1].y;output[6]=select(0,1,canonicalNormWithin(vec3<i32>(134217728,1,0),134217728));output[7]=select(0,1,canonicalNormWithin(vec3<i32>(268435456,0,0),268435456));bad=false;let cross=crossq(vec3<i32>(0,1073741824,1073741824),vec3<i32>(0,16777216,-16777216));output[8]=cross.x;output[9]=select(0,1,bad);}`;
 const module=device.createShaderModule({code}),info=await module.getCompilationInfo();assert.deepEqual(info.messages.filter(x=>x.type==='error'),[]);const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}),output=device.createBuffer({size:40,usage:128|4}),read=device.createBuffer({size:40,usage:1|8});try{const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:1,resource:{buffer:output}}]}),encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();encoder.copyBufferToBuffer(output,0,read,0,40);device.queue.submit([encoder.finish()]);await read.mapAsync(1);const actual=Array.from(new Int32Array(read.getMappedRange()));read.unmap();const cpu=smoothDerivativeProbeCPU(...largeVectors,0,32768);assert.deepEqual(actual,[1,0,...cpu.bounds.flat(),0,1,0,1]);}finally{output.destroy();read.destroy();}
}
test('widened smooth states and arithmetic probes are every-word identical on native GPU',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:180000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice();try{await probeGPU(device);const extra=[smooth([0,0,6*Q,0,0,7*Q,0],900),smooth([0,0,7*Q,0,0,15*Q,0],901),smooth([0,0,0,0,16*Q,0,0],902),smooth([0,0,0,0,0,0,16*Q],903)],rows=new Uint32Array(fixtures.rows.length+extra.length*64);rows.set(fixtures.rows);rows.set(packSmoothSegments(extra),fixtures.rows.length);const engine=await createSmoothSegmentsGPU(device),expected=runSmoothSegmentsCPU(rows),actual=await engine.run(rows);assert.deepEqual(actual.output,expected);t.diagnostic(JSON.stringify({cases:rows.length/64,words:expected.length+10,exactWords:true,compileMs:engine.compileMs}));}finally{device.destroy();}
});
