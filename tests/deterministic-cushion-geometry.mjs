import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {packCushionHull,validateCushionHull,packCushionQueries,runCushionQueriesCPU,createCushionGeometryGPU,CUSHION_GEOMETRY} from '../src/direct-candidate/deterministic-cushion-geometry.mjs';
const require=createRequire(import.meta.url),R=require('../vendor/rapier.cjs');await R.init();require('../src/math.js');require('../src/physics.js');
const lab=new globalThis.PhysicsLab(R),hulls=lab.statics.filter(o=>o.kind==='cushion').map((o,id)=>({id,materialId:7,vertices:o.vertices.slice(),indices:o.indices.slice()}));lab.dispose();
const Q=2**24,scene=packCushionHull(hulls[0]),radius=.03075;
const fixture=(id,center,extra={})=>({id,center,radius,...extra});
const noseX=1.42-Math.sqrt(radius**2-(radius-.0399)**2);
const cases=[fixture(0,[noseX,radius,0]),fixture(1,[1.43,.11,.17]),fixture(2,[1.48,.03,.12]),fixture(3,[1.37,.0399,.77]),fixture(4,[1.44,.04,0]),fixture(5,[1.3,.0399,1.1]),fixture(6,[1.3,.03,0],{maxFeatures:1}),fixture(7,[1.42,.0399,0]),fixture(8,[1.39,.03,.71]),fixture(9,[0,.2,0]),fixture(10,[1.43,-.04,.13])];
const sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],add=(a,b)=>a.map((x,i)=>x+b[i]),scale=(a,t)=>a.map(x=>x*t);
function reference(center,asset=scene){
 const s=new Int32Array(asset.buffer,asset.byteOffset,asset.length),p=center.map(x=>Math.floor(x*Q+.5)/Q);let best={d:Infinity};
 const consider=q=>{const d=Math.hypot(...sub(p,q));if(d<best.d)best={d,q,n:scale(sub(p,q),1/d)};};
 for(let i=0;i<asset[4];i++)consider(Array.from(s.slice(18+64*i,21+64*i),x=>x/Q));
 for(let i=asset[4];i<asset[4]+asset[5];i++){const b=16+64*i,a=Array.from(s.slice(b+2,b+5),x=>x/Q),at=16+64*asset[b+14],z=Array.from(s.slice(at+2,at+5),x=>x/Q),d=sub(z,a);consider(add(a,scale(d,Math.max(0,Math.min(1,dot(sub(p,a),d)/dot(d,d))))));}
 for(let i=asset[4]+asset[5];i<asset[3];i++){const at=16+64*i,vs=[0,1,2].map(j=>Array.from(s.slice(at+16+12*j,at+19+12*j),x=>x/Q)),n=cross(sub(vs[1],vs[0]),sub(vs[2],vs[0])),q=sub(p,scale(n,dot(sub(p,vs[0]),n)/dot(n,n)));if(vs.every((v,j)=>dot(cross(sub(vs[(j+1)%3],v),sub(q,v)),n)>=-1e-18))consider(q);}
 return best;
}
function check(rows,out){const os=new Int32Array(out.buffer,out.byteOffset,out.length),rs=new Int32Array(rows.buffer,rows.byteOffset,rows.length);let unique=0;for(let i=0;i<rows.length/16;i++){const b=i*32;if(![1,6].includes(out[b+1]))continue;const p=Array.from(rs.slice(i*16+2,i*16+5),x=>x/Q),ref=reference(p);assert.ok(os[b+8]/Q<=ref.d+1e-13,`lower ${i}`);assert.ok(os[b+9]/Q>=ref.d-1e-13,`upper ${i}`);if(out[b+1]===1){unique++;for(let j=0;j<3;j++){assert.ok(os[b+12+2*j]/Q<=ref.q[j]+1e-12&&os[b+13+2*j]/Q>=ref.q[j]-1e-12,`point ${i}/${j}`);assert.ok(os[b+18+2*j]/Q<=ref.n[j]+1e-11&&os[b+19+2*j]/Q>=ref.n[j]-1e-11,`normal ${i}/${j}`);}}}return unique;}
let seed=20261027;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
const varied=Array.from({length:256},(_,i)=>fixture(100+i,[1.1+.6*random(),-.2+.5*random(),-.95+1.9*random()]));
const extremes=Array.from({length:8},(_,i)=>fixture(2000+i,[0,1,2].map(j=>(i>>j)&1?4:-4)));
const all=[...cases,...varied,...extremes,...[-2,-1,0,1,2].map((x,i)=>fixture(1000+i,[noseX+x/Q,radius,.71+x/Q]))];
test('actual source hull assets canonicalize independently of vertex/triangle order',()=>{
 for(const h of hulls){const packed=packCushionHull(h);validateCushionHull(packed);assert.equal(packed[4],8);assert.equal(packed[5],18);assert.equal(packed[6],12);const n=h.vertices.length/3,vertices=Array.from({length:n},(_,i)=>h.vertices.slice((n-1-i)*3,(n-i)*3)).flat(),triangles=Array.from({length:h.indices.length/3},(_,i)=>h.indices.slice(3*i,3*i+3)).reverse().flatMap(([a,b,c])=>[n-1-b,n-1-c,n-1-a]);assert.deepEqual(packCushionHull({...h,vertices,indices:triangles}),packed);}
 const corrupt=scene.slice();corrupt[21]++;assert.throws(()=>validateCushionHull(corrupt));assert.throws(()=>packCushionHull({...hulls[0],indices:hulls[0].indices.slice(3)}));assert.throws(()=>packCushionHull({...hulls[0],vertices:hulls[0].vertices.map(()=>0)}));
});
test('actual nose edge has downward normal; finite faces, ends, vertices and uncertainty stay honest',()=>{
 const rows=packCushionQueries(all),out=runCushionQueriesCPU(rows,scene),s=new Int32Array(out.buffer);assert.equal(out[1],1);assert.equal(out[5],2);assert.ok(s[10]<=0&&s[11]>=0,'nominal tangency remains a signed gap interval');assert.ok(s[20]<-.29*Q&&s[21]<-.29*Q);assert.equal(out[4*32+1],4);assert.equal(out[4*32+2],2);assert.equal(out[6*32+1],5);assert.equal(out[7*32+1],4);assert.equal(out[7*32+2],3);assert.ok(check(rows,out)>100);const kinds=new Set();for(let i=0;i<out.length;i+=32)if(out[i+1]===1)kinds.add(out[i+5]);assert.deepEqual([...kinds].sort(),[1,2,3]);
 // An infinite x wall would report zero gap; the finite rail endpoint is distant.
 const finite=runCushionQueriesCPU(packCushionQueries([fixture(99,[noseX,radius,1.1])]),scene);assert.ok(new Int32Array(finite.buffer)[8]>.3*Q);
 assert.ok(out.some((x,i)=>i%32===1&&x===6),'feature transition remains uncertain');
});
test('encoded arithmetic range, reserved words, budget and buffer offsets are checked',()=>{
 assert.throws(()=>packCushionQueries([fixture(1,[5,0,0])]));assert.throws(()=>packCushionQueries([fixture(1,[0,0,0],{maxFeatures:0})]));const rows=packCushionQueries(cases),padded=new Uint32Array(rows.length+8);padded.set(rows,4);assert.deepEqual(runCushionQueriesCPU(padded.subarray(4,4+rows.length),scene),runCushionQueriesCPU(rows,scene));const paddedScene=new Uint32Array(scene.length+6);paddedScene.set(scene,3);assert.deepEqual(runCushionQueriesCPU(rows,paddedScene.subarray(3,3+scene.length)),runCushionQueriesCPU(rows,scene));for(const [at,value] of [[2,0x80000000],[5,0],[6,1],[1,97]]){const bad=rows.slice(0,16);bad[at]=value;assert.equal(runCushionQueriesCPU(bad,scene)[1],4);}
});
test('immutable GPU scene snapshot is captured before the first await',async()=>{
 let release;const gate=new Promise(resolve=>release=resolve),uploads=[];const device={pushErrorScope(){},async popErrorScope(){return null;},createShaderModule(){return {async getCompilationInfo(){await gate;return {messages:[]};}};},async createComputePipelineAsync(){return {};},createBuffer(){return {destroy(){}};},queue:{writeBuffer(_b,_offset,words){uploads.push(words.slice());}}};
 const source=scene.slice(),pending=createCushionGeometryGPU(device,source);source.fill(0);release();const kernel=await pending;assert.deepEqual(uploads[0],scene);kernel.dispose();
});
test('native actual-hull feature queries exactly match every CPU output word',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:60000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice();let kernel;
 try{const asset=scene.slice(),pending=createCushionGeometryGPU(device,asset);asset.fill(0);kernel=await pending;const rows=packCushionQueries(all),cpu=runCushionQueriesCPU(rows,scene),{result,metrics}=await kernel.run(rows);assert.deepEqual(result,cpu);const padded=new Uint32Array(rows.length+8);padded.set(rows,4);assert.deepEqual((await kernel.run(padded.subarray(4,rows.length+4))).result,cpu);const reverse=packCushionQueries([...all].reverse());assert.deepEqual((await kernel.run(reverse)).result,runCushionQueriesCPU(reverse,scene));const changed=rows.slice();changed[2]++;const changedOut=(await kernel.run(changed)).result;assert.deepEqual(changedOut,runCushionQueriesCPU(changed,scene));assert.deepEqual(changedOut.slice(32),cpu.slice(32));const guards=rows.slice(0,64);guards[2]=0x80000000;guards[16+5]=0;guards[32+6]=1;guards[48+1]=97;assert.deepEqual((await kernel.run(guards)).result,runCushionQueriesCPU(guards,scene));t.diagnostic(JSON.stringify({compileMs:kernel.compileMs,shaderBytes:kernel.shaderBytes,words:cpu.length,exactCPUAndGPU:true,...metrics}));}
 finally{kernel?.dispose();device.destroy();gpu.destroy?.();}
});
