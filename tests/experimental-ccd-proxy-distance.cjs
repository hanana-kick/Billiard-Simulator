'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const P=require('../src/experimental-ccd-proxy-distance'),S=require('../src/experimental-ccd-proxy-distance-kernel'),C=require('../src/experimental-ccd-proxy-distance-cpu'),{cases,cube,tetra,item}=require('./experimental-ccd-proxy-distance-cases.cjs');
const Reducers=require('../src/experimental-ccd-proxy-distance-reducers');
const f=Math.fround,close=(a,b,tol=2e-6)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const vec=(a,b,tol)=>a.forEach((x,i)=>close(x,b[i],tol));
function reduced(points,query) {
  const k=C.createKernel([[0,0,0]]),vertices=points.map((p,i)=>{const w=k.V3(...p.map((x,j)=>f(x-query[j])));return k.Vertex(w,k.V3(0,0,0),w,0,i,0);});
  while(vertices.length<4)vertices.push(k.emptyVertex());
  const original=k.Simplex(vertices,points.length,true),s=k.solve(original);
  assert.deepEqual(Reducers.reduce(original),s,'scalar graph/direct source reducer parity');
  return {s,k,indices:s.v.slice(0,s.count).map(v=>v.indexA),weights:s.v.slice(0,s.count).map(v=>v.a)};
}
test('CPU artifact is generated from the exact same complete WGSL control flow',()=>{
  assert.equal(fs.readFileSync(path.join(__dirname,'../src/experimental-ccd-proxy-distance-cpu.js'),'utf8'),S.cpuArtifact());
  const code=P.shaderSource();assert.ok(code.includes('while (iteration < 32u)'));assert.ok(code.includes(S.wgslKernel(Reducers.wgsl())));assert.ok(!/\bdot\(|\bcross\(|\bnormalize\(/.test(code));
  assert.equal(P.CAPABILITY.physicsIntegration,false);assert.equal(P.CAPABILITY.productDefaultActivation,false);
});
test('all 1/2/3/4-simplex regions preserve source vertex order and weights',()=>{
  const segment=[[0,0,0],[2,0,0]],tri=[[0,0,0],[2,0,0],[0,2,0]];
  const checks=[
    [1,[[2,3,4]],[0,0,0],[0],[1]],
    [2,segment,[-1,1,0],[0],[1]],[2,segment,[3,1,0],[1],[1]],[2,segment,[.5,1,0],[0,1],[.75,.25]],
    [3,tri,[-1,-1,1],[0],[1]],[3,tri,[3,-1,1],[1],[1]],[3,tri,[-1,3,1],[2],[1]],
    [3,tri,[1,-1,1],[0,1],[.5,.5]],[3,tri,[2,2,1],[1,2],[.5,.5]],[3,tri,[-1,1,1],[2,0],[.5,.5]],
    [3,tri,[.5,.5,1],[0,1,2],[.5,.25,.25]],
    [4,tetra,[-1,-1,-1],[0],[1]],[4,tetra,[3,-.5,-.5],[1],[1]],[4,tetra,[-.5,3,-.5],[2],[1]],[4,tetra,[-.5,-.5,3],[3],[1]],
    [4,tetra,[1,-1,-1],[0,1],[.5,.5]],[4,tetra,[-1,1,-1],[0,2],[.5,.5]],[4,tetra,[-1,-1,1],[0,3],[.5,.5]],
    [4,tetra,[2,2,-1],[1,2],[.5,.5]],[4,tetra,[-1,2,2],[2,3],[.5,.5]],[4,tetra,[2,-1,2],[3,1],[.5,.5]],
    [4,tetra,[.5,.5,-1],[0,2,1],[.5,.25,.25]],[4,tetra,[.5,-1,.5],[0,1,3],[.5,.25,.25]],
    [4,tetra,[-1,.5,.5],[0,3,2],[.5,.25,.25]],[4,tetra,[1,1,1],[1,2,3],[1/3,1/3,1/3]],
    [4,tetra,[.25,.25,.25],[0,1,2,3],[.625,.125,.125,.125]]
  ];
  for(const [n,points,q,indices,weights] of checks) {const r=reduced(points,q);assert.equal(r.s.solved,true,`${n} ${q}`);assert.deepEqual(r.indices,indices,`${n} ${q}`);vec(r.weights,weights);}
});
test('degenerate tetrahedron signals failure rather than claiming interior overlap',()=>{
  const r=reduced([[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0]],[.1,.2,0]);assert.equal(r.s.solved,false);assert.equal(r.s.count,4);
});
test('scalar graph reducer lowering matches direct source on independent seeded simplex holdouts',()=>{
  const k=C.createKernel([[0,0,0]]);let seed=0x1234abcd;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let n=2;n<=4;n++)for(let i=0;i<600;i++) {
    const vertices=Array.from({length:4},(_,j)=>{const w=k.V3(f(rand()*8-4),f(rand()*8-4),f(rand()*8-4));return k.Vertex(w,w,w,f(rand()),j,0);});
    const original=k.Simplex(vertices,n,true);assert.deepEqual(Reducers.reduce(original),k.solve(original),`count ${n} holdout ${i}`);
  }
});
test('source support uses first-point-relative projections with strict first-tie ordering',()=>{
  const k=C.createKernel([[1000000,0,0],[1000001,1,0],[1000001,-1,0],[999999,0,0]]);
  assert.equal(k.support(k.V3(1,0,0)),1);assert.equal(k.support(k.V3(0,0,0)),0);assert.equal(k.support(k.V3(-1,0,0)),3);
});
test('cache validates count and both index arrays and uses source metric ratio boundaries',()=>{
  const base=item('cache',cube,[2,.3,.7]);
  for(const edit of [c=>c.count=4,c=>{c.count=2;c.indexA[1]=8;},c=>{c.count=2;c.indexB[1]=1;}]) {const input=structuredClone(base);edit(input.cache);const out=P.reference(input);assert.equal(out.cacheAccepted,false);assert.equal(out.cacheFlushed,false);}
  for(const [metric,flushed] of [[1,false],[4,false],[f(.9999999),true],[f(4.0000005),true]]) {const input={...base,cache:{count:2,metric,indexA:[0,1,7],indexB:[0,0,0]}};const out=P.reference(input);assert.equal(out.cacheAccepted,true);assert.equal(out.cacheFlushed,flushed,metric);}
  const one=P.reference({...base,cache:{count:1,metric:0,indexA:[6,7,7],indexB:[0,9,9]}});assert.equal(one.cacheAccepted,true);assert.equal(one.cacheFlushed,true);
});
test('overlap exits preserve every incoming cache byte and are not distance-only flags',()=>{
  for(const translation of [[0,0,0],[1,0,0],[.25,.25,.25]]) {const input=item('overlap',translation[0]===.25?tetra:cube,translation,{cache:{count:0,metric:-4,indexA:[7,6,5],indexB:[9,8,7]}});const before=structuredClone(input);const out=P.reference(input);assert.equal(out.overlap,true);assert.equal(out.cacheWritten,false);assert.equal(out.distance,0);assert.deepEqual(out.normal,[0,0,0]);assert.deepEqual(out.cache,input.cache);assert.deepEqual(input,before);}
});
test('CPU generated kernel handles ordered arbitrary hulls, warm starts, and transformed ball ZERO',()=>{
  for(const input of cases()) {
    const before=structuredClone(input),a=P.reference(input),b=P.reference(input);assert.deepEqual(a,b,input.id);assert.deepEqual(input,before,input.id);assert.ok(a.iterations<=32,input.id);assert.ok(a.cache.count<=3||!a.cacheWritten,input.id);
    assert.equal(a.cacheWritten,!a.overlap,input.id);
    if(a.cacheWritten) {const warmed=P.reference({...input,cache:a.cache});close(warmed.distance,a.distance,2e-5);}
  }
  const out=P.reference(item('cube',cube,[2,0,0]));assert.deepEqual(out.pointA,[1,0,0]);assert.deepEqual(out.pointB,[2,0,0]);assert.equal(out.distance,1);assert.equal(out.cache.count,2);assert.deepEqual(out.cache.indexA,[6,1,0]);assert.equal(out.iterations,2);
});
test('malformed data and unsupported radii fail closed without a host or GPU fallback',()=>{
  const base=item('valid',cube,[2,0,0]);for(const edit of [x=>x.pointsA=[],x=>x.pos12.translation[0]=NaN,x=>x.pos12.rotation=[0,0,0,0],x=>x.useRadii=true,x=>x.cache.count=256,x=>x.cache.indexA=[0,0],x=>x.pointsA[0][0]=1/3]) {const input=structuredClone(base);edit(input);assert.throws(()=>P.reference(input));}
});
function nativeCases() {
  const inputs=cases(),more=[];for(const input of inputs) {const out=P.reference(input);more.push({...input,id:input.id+'-warm',cache:out.cache});}return [...inputs,...more];
}
function compare(a,b,label,max={value:0}) {
  const bits=x=>{const v=new Float32Array([x]);return new Uint32Array(v.buffer)[0];};
  const numeric=(x,y,p)=>{max.value=Math.max(max.value,Math.abs(x-f(y)));assert.equal(bits(x),bits(f(y)),p+' f32 bits');};
  for(const k of ['iterations'])assert.equal(a[k],b[k],label+'.'+k);
  assert.equal(a.cache.count,b.cache.count,label+'.cache.count');assert.deepEqual(a.cache.indexA,b.cache.indexA,label+'.cache.indexA');assert.deepEqual(a.cache.indexB,b.cache.indexB,label+'.cache.indexB');
  for(const k of ['pointA','pointB','normal'])a[k].forEach((v,i)=>numeric(v,b[k][i],label+'.'+k+i));
  numeric(a.distance,b.distance,label+'.distance');numeric(a.cache.metric,b.cache.metric,label+'.cache.metric');return max;
}
test('native pinned-source differential proxy-distance cases',{skip:!process.env.PARRY_PROXY_DISTANCE_PROBE,timeout:120000},t=>{
  const inputs=nativeCases(),wire=inputs.map(s=>({proxy_a:{points:s.pointsA,radius:0},proxy_b:{points:[[0,0,0]],radius:0},pos12:{...s.pos12,padding:0},use_radii:false,cache:{metric:s.cache.metric,count:s.cache.count,index_a:s.cache.indexA,index_b:s.cache.indexB}}));
  const run=spawnSync(process.env.PARRY_PROXY_DISTANCE_PROBE,['--proxy-distance'],{input:JSON.stringify(wire),encoding:'utf8',maxBuffer:16*1024*1024});assert.equal(run.status,0,run.stderr);const oracle=JSON.parse(run.stdout);assert.equal(oracle.schema,'pinned-parry-active-ccd-proxy-distance-v1');assert.equal(oracle.sourceRevision,'b716d375efc0201003f0cd9ef7168eee0b62c177');assert.equal(oracle.items.length,inputs.length);const max={value:0};
  inputs.forEach((input,i)=>{const q=oracle.items[i];compare(P.reference(input),{pointA:q.point_a,pointB:q.point_b,normal:q.normal,distance:q.distance,iterations:q.iterations,cache:{metric:q.cache.metric,count:q.cache.count,indexA:q.cache.index_a,indexB:q.cache.index_b}},input.id,max);});t.diagnostic(JSON.stringify({cases:inputs.length,maxAbsoluteError:max.value}));
});
test('actual WGSL runs the same reducers, support ordering, cache, and overlap paths',{skip:!process.env.GPU_NATIVE_MODULE&&process.env.REQUIRE_WEBGPU!=='1',timeout:180000},async t=>{
  assert.ok(process.env.GPU_NATIVE_MODULE,'Explicit actual WebGPU module required');const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter,'Actual Vulkan adapter required');const device=await adapter.requestDevice(),max={value:0};
  try {for(const input of cases()) {const stage=await P.createGpuStage(device,{pointsA:input.pointsA});try {const cpu=P.reference(input),gpu=await stage.step(input);compare(gpu,cpu,input.id,max);for(const k of ['overlap','cacheWritten','terminationCode','cacheAccepted','cacheFlushed','finalCount'])assert.equal(gpu[k],cpu[k],input.id+'.'+k);const warmInput={...input,cache:gpu.cache};compare(await stage.step(warmInput),P.reference(warmInput),input.id+'-warm',max);} finally {stage.dispose();}}} finally {device.destroy();}t.diagnostic(JSON.stringify({cases:cases().length*2,maxAbsoluteError:max.value}));
});
