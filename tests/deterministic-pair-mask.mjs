import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import * as baseline from '../src/direct-candidate/deterministic-axial.mjs';
import {withConstantPairMask} from './deterministic-pair-mask-fixture.mjs';
// The measured variant is constructed ONLY in this test. Runtime stays baseline.
const moduleURL=new URL('../src/direct-candidate/deterministic-axial.mjs',import.meta.url);
const source=await readFile(moduleURL,'utf8');
const maskedSource=withConstantPairMask(source).replace("'./source-law-collinear-segment.mjs'",JSON.stringify(new URL('./source-law-collinear-segment.mjs',moduleURL).href));
const masked=await import('data:text/javascript;base64,'+Buffer.from(maskedSource).toString('base64'));
const Q=2**24;
function corpus(mode,count=300){
 const rows=new Uint32Array(count*48),s=new Int32Array(rows.buffer);
 for(let k=0;k<count;k++){
  const b=k*48;rows.set([k,4,40000+(k%1000),2048,0,0,0,0],b);
  for(let i=0;i<4;i++){
   const at=b+8+i*10;
   s[at]=Math.round([0,.09,.5,.8][i]*Q)+(k%19);s[at+9]=Q/32;
   s[at+1]=mode==='common-motion'?Q:mode==='all-active'?Math.round((1-i*.5)*Q):(i===0?Q:0);
   s[at+2]=mode==='common-motion'?-Q:mode==='all-active'?(i%2?Q:-Q):(i===0?-Q:0);
   // Spins vary independently; they cannot change an already-encoded phase's
   // relative position when its relative velocity/acceleration are zero.
   s[at+4]=(k+i)%31;s[at+5]=-5*2**20;s[at+8]=2**20;
  }
 }return rows;
}
const modes=['one-moving','all-active','common-motion'];
function work(rows,result){let baselinePairs=0,maskedPairs=0;const s=new Int32Array(rows.buffer,rows.byteOffset,rows.length);
 for(let b=0;b<rows.length;b+=48){let active=0;for(let i=0;i<rows[b+1];i++)for(let j=i+1;j<rows[b+1];j++)if(s[b+9+i*10]!==s[b+9+j*10]||s[b+10+i*10]!==s[b+10+j*10])active++;
  baselinePairs+=result[b+6]*6;maskedPairs+=result[b+6]*active;
 }return {baselineNodePairBounds:baselinePairs,maskedNodePairBounds:maskedPairs};}
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
test('constant-relative pairs preserve every state/status/work word, including near-boundary and invalid inputs',()=>{
 for(const mode of modes){const rows=corpus(mode);assert.deepEqual(masked.runAxialIntegerCPU(rows),baseline.runAxialIntegerCPU(rows));}
 const rows=corpus('common-motion',8),s=new Int32Array(rows.buffer);
 s[18]=s[8]+2*s[17]; // Initial touch still rejected; culling never bypasses it.
 s[48+18]=s[48+8]+2*s[48+17]+1; // One quantum separated remains constant.
 s[2*48+19]++; // Equal acceleration, NONzero relative velocity must stay active.
 s[3*48+20]++; // Equal velocity, NONzero relative acceleration must stay active.
 rows[4*48+3]=1;rows[5*48+8]=0x80000000;rows[6*48+1]=5;rows[7*48+4]=1;
 assert.deepEqual(masked.runAxialIntegerCPU(rows),baseline.runAxialIntegerCPU(rows));
 assert.equal(masked.runAxialIntegerCPU(rows)[1],4);
});
test('bounded warmed paired CPU/native mask measurements',{skip:process.env.RUN_PAIR_MASK_BENCH!=='1',timeout:30000},async t=>{
 const receipt={kind:'exact-constant-relative-pair-mask',rowsPerWorkload:300,warmup:3,samples:7,physicalModelChanged:false,runs:[]};
 let device,engines,gpuOwner;
 if(process.env.REQUIRE_WEBGPU==='1'){
  const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
  gpuOwner=create(['backend=vulkan']);const adapter=await gpuOwner.requestAdapter();assert.ok(adapter);device=await adapter.requestDevice();
  engines=[await baseline.createAxialIntegerGPU(device),await masked.createAxialIntegerGPU(device)];
  receipt.adapter=Object.fromEntries(['vendor','architecture','device','description'].map(k=>[k,adapter.info[k]]));
 }
 try{for(const mode of modes){const rows=corpus(mode),expected=baseline.runAxialIntegerCPU(rows),cpu=[[],[]],gpu=[[],[]],wall=[[],[]];
  const methods=[baseline.runAxialIntegerCPU,masked.runAxialIntegerCPU];
  for(let rep=-3;rep<7;rep++)for(const which of rep%2===0?[0,1]:[1,0]){
   let began=performance.now(),out;for(let n=0;n<5;n++)out=methods[which](rows);const elapsed=(performance.now()-began)/5;assert.deepEqual(out,expected);if(rep>=0)cpu[which].push(elapsed);
   if(engines){began=performance.now();const result=await engines[which].run(rows);const total=performance.now()-began;assert.deepEqual(result.result,expected);if(rep>=0){gpu[which].push(result.metrics.submitToDoneMs);wall[which].push(total);}}
  }
  receipt.runs.push({mode,comparedWords:expected.length,...work(rows,expected),cpuMs:cpu.map(median),nativeSubmitToDoneMs:engines?gpu.map(median):null,nativeWholeCallMs:engines?wall.map(median):null,order:'baseline,mask'});
 }}finally{device?.destroy();}
 t.diagnostic(JSON.stringify(receipt));if(process.env.PAIR_MASK_RECEIPT)await writeFile(process.env.PAIR_MASK_RECEIPT,JSON.stringify(receipt,null,2)+'\n');
});
