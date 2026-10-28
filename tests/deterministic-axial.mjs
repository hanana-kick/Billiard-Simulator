import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {AXIAL_INTEGER,packSourceAxialCandidates,runAxialIntegerCPU,multiplyWide,createAxialIntegerGPU} from '../src/direct-candidate/deterministic-axial.mjs';
import {prepareCollinearSegment,evaluateCollinearMotion} from '../src/direct-candidate/source-law-collinear-segment.mjs';
const material={gravity:9.81,clothFriction:.2,rollingLength:.00045,spinLength:.00035};
const body=(p,v=0,c=0,spin=0,r=.03075)=>({id:1,position:[p,r,0],velocity:[v,0,0],angular:[0,spin,-c/r],radius:r,mass:.21,provenance:'prepared-flat-constant-load'});
const candidate=(id,bodies,extra={})=>({id,bodies,material,duration:.04,geometryHorizon:.04,geometryProvenance:'prepared-no-static-contact-interval',...extra});
const cases=[
 candidate(1,[body(0,1,.2),body(.09),body(.5,1,-.5,10)]),
 candidate(2,[body(0,1,.2),body(.11,-.5,-.1),body(.5)]),
 candidate(3,[body(0,.01,-1),body(.5),body(1)]),
 candidate(4,[body(0,1,.2),body(.09),body(.5,1,.2),body(.59)]),
 candidate(5,[body(0),body(.5),body(1)]),
 candidate(6,[body(0,1,.2),body(.09),body(.5)],{maxNodes:1}),
 candidate(7,[body(0,.0625,-1,0,1/32),body(2/32+1/1024,0,0,0,1/32),body(.5,0,0,0,1/32)],{material:{...material,gravity:10,clothFriction:.2}}),
];
const holdouts=Array.from({length:64},(_,i)=>{
 const v=.4+(i%13)*.1,target=-.2-(i%7)*.05,when=.004+(i%11)*.001;
 return candidate(100+i,[body(-.2,v,.2*v),body(-.2+.0615+(v-target)*when,target,.2*target),body(.8,0,0,2),body(1.2,-.5,-.1)],{duration:.02,geometryHorizon:.02});
});
const packed=()=>packSourceAxialCandidates(cases);
test('bounded wide products are exact, including carries and signed extremes as magnitudes',()=>{
 let seed=123456789;const random=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
 for(const [a,b] of [[0xffffffff,0xffffffff],[0x80000000,0xffffffff],...Array.from({length:1000},()=>[random(),random()])]){
  const [lo,hi]=multiplyWide(a,b),exact=BigInt(a)*BigInt(b);assert.equal(BigInt(lo)+(BigInt(hi)<<32n),exact);
 }
});
test('original-law integer segment brackets moving pairs and advances every sphere at one global time',()=>{
 const {rows,provenance}=packed(),result=runAxialIntegerCPU(rows),s=new Int32Array(result.buffer);
 assert.deepEqual(cases.map((_,i)=>result[i*48+1]),[1,1,2,4,2,5,4]);
 assert.equal(result[3*48+2],2);assert.equal(result[6*48+2],3);
 assert.ok(s[2*48+8]<0,'velocity reversal is integrated, not mistaken for stop');
 assert.ok(s[8+2*10]>Math.round(.5*2**24));assert.ok(s[8+2*10+4]<10*2**20,'uninvolved spin advances');
 let largestPositionError=0,largestAngularError=0;
 for(let k=0;k<cases.length;k++)if([1,2].includes(result[k*48+1])){
  const time=result[k*48+3]/2**20;
  cases[k].bodies.forEach((b,i)=>{
   const reference=evaluateCollinearMotion(prepareCollinearSegment(b,cases[k].material),time),at=k*48+8+i*10;
   const pe=Math.abs(reference.position[0]-s[at]/2**24);largestPositionError=Math.max(largestPositionError,pe);assert.ok(pe<=provenance[k].endpointPositionErrorBound);
   assert.ok(Math.abs(reference.velocity[0]-s[at+1]/2**24)<=provenance[k].endpointVelocityErrorBound);
   for(let j=0;j<3;j++){const e=Math.abs(reference.angular[j]-s[at+3+j]/2**20);largestAngularError=Math.max(largestAngularError,e);assert.ok(e<=provenance[k].endpointAngularErrorBound);}
  });
 }
 assert.ok(largestPositionError<2e-7);assert.ok(largestAngularError<2e-6);
 // Permuting the bodies changes pair indices, not selected time or state identity.
 const permutation=candidate(9,[cases[1].bodies[2],cases[1].bodies[0],cases[1].bodies[1]]);
 const perm=runAxialIntegerCPU(packSourceAxialCandidates([permutation]).rows);
 assert.equal(perm[3],result[48+3]);assert.deepEqual(perm.slice(18,28),result.slice(56,66));
});
test('off-axis/grazing geometry, crossed regimes, malformed rows and overflow fail closed',()=>{
 assert.throws(()=>packSourceAxialCandidates([{...cases[0],geometryProvenance:undefined}]),/geometry/);
 assert.throws(()=>packSourceAxialCandidates([{...cases[0],bodies:[{...body(0,1,.2),position:[0,.03075,.01]},body(.09),body(.5)]}]),/lane/);
 assert.throws(()=>packSourceAxialCandidates([{...cases[0],bodies:[body(0,100,.2),body(.09),body(.5)]}]),/domain/);
 assert.throws(()=>packSourceAxialCandidates([{...cases[0],bodies:[body(0,1,.999),body(.09),body(.5)]}]),/regime/);
 const rows=packed().rows.slice(0,48);rows[8]=0x80000000;const out=runAxialIntegerCPU(rows);assert.equal(out[1],4);assert.equal(out[2],1);assert.deepEqual(out.slice(8),rows.slice(8));
 assert.throws(()=>runAxialIntegerCPU(rows.slice(1)),/48-word/);
 const nativeRadius=packSourceAxialCandidates([{...cases[0],bodies:cases[0].bodies.map(b=>({...b,collisionRadius:.031}))}]);assert.equal(nativeRadius.rows[17],Math.round(.031*2**24));
 assert.throws(()=>packSourceAxialCandidates([{...cases[0],bodies:cases[0].bodies.map(b=>({...b,collisionRadius:NaN}))}]),/collision radius/);
});
test('holdout brackets and global states satisfy independent exact integer polynomial checks',()=>{
 const {rows}=packSourceAxialCandidates(holdouts),result=runAxialIntegerCPU(rows),s=new Int32Array(rows.buffer),o=new Int32Array(result.buffer),scale=1n<<40n;
 const numerator=(at,t)=>BigInt(s[at])*scale+(BigInt(s[at+1])*BigInt(t)<<20n)+BigInt(s[at+2])*BigInt(t)**2n;
 let selected=0;
 for(let b=0;b<rows.length;b+=48){
  if(result[b+1]!==1)continue;selected++;
  const event=result[b+5],a=b+8+(event>>>2)*10,c=b+8+(event&3)*10,r=BigInt(s[a+9]+s[c+9])*scale;
  const dl=numerator(c,result[b+3])-numerator(a,result[b+3]),du=numerator(c,result[b+4])-numerator(a,result[b+4]);
  assert.ok(dl>r||dl< -r);assert.ok(du<=r&&du>= -r);assert.equal(result[b+4]-result[b+3],1);
  for(let i=0;i<rows[b+1];i++){const at=b+8+i*10,n=numerator(at,result[b+3]),encoded=BigInt(o[at])*scale;assert.ok(n>=encoded&&n-encoded<2n*scale);}
 }
 assert.equal(selected,45); //19 near-boundary boxes deliberately remain unsupported, not guessed contacts.
 assert.equal(Array.from({length:64},(_,i)=>result[i*48+1]).filter(x=>x===4).length,19);
});
test('native WGSL and CPU match EVERY output word, without float arithmetic',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:30000},async t=>{
 assert.ok(process.env.GPU_NATIVE_MODULE);const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
 const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice();
 try{
  const {rows}=packSourceAxialCandidates([...cases,...holdouts]),invalid=rows.slice(0,48);invalid[8]=0x80000000;
  const batch=new Uint32Array(rows.length+48);batch.set(rows);batch.set(invalid,rows.length);
  const cpuStart=performance.now();const cpu=runAxialIntegerCPU(batch);const cpuMs=performance.now()-cpuStart;const engine=await createAxialIntegerGPU(device),result=await engine.run(batch);assert.deepEqual(result.result,cpu);
  const padded=new Uint32Array(batch.length+16);padded.fill(0xffffffff);padded.set(batch,8);const view=padded.subarray(8,8+batch.length);
  assert.deepEqual(runAxialIntegerCPU(view),cpu);const again=await engine.run(view);assert.deepEqual(again.result,cpu);
  await assert.rejects(engine.run(batch.slice(1)),/48-word/);
  const statuses=Object.fromEntries([1,2,4,5].map(status=>[status,Array.from({length:cpu.length/48},(_,i)=>cpu[i*48+1]).filter(x=>x===status).length]));
  const bulkCases=Array.from({length:1024},(_,i)=>{
   const v=.4+((i*17)%127)*.01,target=-.2-((i*13)%47)*.01,when=.004+((i*29)%101)*.0001;
   return candidate(1000+i,[body(-.2,v,.2*v),body(-.2+.0615+(v-target)*when,target,.2*target),body(.8,0,0,2),body(1.2,-.5,-.1)],{duration:.02,geometryHorizon:.02,maxNodes:128});
  });
  const bulkRows=packSourceAxialCandidates(bulkCases).rows;runAxialIntegerCPU(bulkRows);
  const bulkStart=performance.now(),bulkCPU=runAxialIntegerCPU(bulkRows),bulkCpuMs=performance.now()-bulkStart;
  const bulkGPU=await engine.run(bulkRows);assert.deepEqual(bulkGPU.result,bulkCPU);assert.equal(bulkCPU.length,49152);
  const bulk={candidates:1024,comparedWords:bulkCPU.length,exactWords:true,maxNodes:128,cpuMs:bulkCpuMs,metrics:bulkGPU.metrics,intervalNodes:Array.from({length:1024},(_,i)=>bulkCPU[i*48+6]).reduce((a,b)=>a+b,0),statuses:Object.fromEntries([1,2,4,5].map(status=>[status,Array.from({length:1024},(_,i)=>bulkCPU[i*48+1]).filter(x=>x===status).length]))};
  const receipt={bulk,statuses,profile:'prepared-original-law-axial-integer-v1',cases:batch.length/48,comparedWords:cpu.length,exactWords:true,cpuMs,intervalNodes:Array.from({length:cpu.length/48},(_,i)=>cpu[i*48+6]).reduce((a,b)=>a+b,0),compileMs:engine.compileMs,shaderBytes:engine.shaderBytes,metrics:again.metrics,positionQuantum:1/2**24,timeQuantum:1/2**20,maxDuration:65535/2**20,physicalAcceptance:false,adapter:Object.fromEntries(['vendor','architecture','device','description'].map(k=>[k,adapter.info[k]]))};t.diagnostic(JSON.stringify(receipt));
  if(process.env.DETERMINISTIC_AXIAL_RECEIPT){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.DETERMINISTIC_AXIAL_RECEIPT,JSON.stringify(receipt,null,2)+'\n');}
 }finally{device.destroy();}
});
