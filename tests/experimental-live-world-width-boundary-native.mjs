/** Synthetic width/isolation unit only: no physical trajectory or outcome proof. */
import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {liftGuardedCandidatePhase} from '../src/direct-candidate/experimental-guarded-storage-lift.mjs';
import {lowerLiveWorldPlans,liveBoundsResultGateSource} from '../src/direct-candidate/experimental-live-world-batch.mjs';
import {guardLiveCushionIndirect} from '../src/direct-candidate/experimental-live-indirect.mjs';
const scalarSource='@group(0) @binding(0) var<storage,read> input:array<u32>;@group(0) @binding(1) var<storage,read_write> output:array<u32>;@compute @workgroup_size(1) fn main(){output[0]=input[input[0]];output[1]+=3u;}';
const scalar=liftGuardedCandidatePhase(scalarSource,[{stride:8,base:2,length:4},{stride:8,base:1,length:4}],[4,4]);
const later=liftGuardedCandidatePhase('@group(0) @binding(0) var<storage,read_write> output:array<u32>;@compute @workgroup_size(1) fn main(){output[0]+=1u;}',[{stride:8,base:1,length:4}],[4]);
const indirect=guardLiveCushionIndirect(liftGuardedCandidatePhase('@group(0) @binding(0) var<storage,read_write> output:array<u32>;@compute @workgroup_size(16) fn main(@builtin(global_invocation_id) id:vec3<u32>){output[id.x]+=1u;}',[64],[64]),{stride:8,offset:20,bound:4});
async function originalCopy(count){
 const plan={kind:'synthetic-copy-width-unit',strikeBackend:'staged',allocations:[{size:32,usage:140,initial:new Uint8Array(32),external:null},{size:32,usage:140,initial:new Uint8Array(32),external:null}],definitions:[],commands:[{kind:'copy',source:0,sourceOffset:4,target:1,targetOffset:8,size:12}],readback:1};
 const lowered=await lowerLiveWorldPlans(Array(count).fill(plan),{candidateLocalAllocations:[0,1]});assert.equal(lowered.commands.length,1);const command=lowered.commands[0];assert.equal(command.x,1);assert.equal(command.entries[0].size,32*count);assert.equal(command.entries[1].size,32*count);return lowered.definitions[command.definition].code;
}
test('native N32/N33 scalar/copy/fault/size16-indirect boundaries isolate lane31 and lane32',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:30000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice();let exactWords=0,cases=0;
 try{
  const pipeline=async code=>{const module=device.createShaderModule({code}),info=await module.getCompilationInfo();assert.deepEqual(info.messages.filter(x=>x.type==='error'),[]);return device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});};
  const first=await pipeline(scalar.code),second=await pipeline(later.code),gate=await pipeline(liveBoundsResultGateSource(8)),indirectPipeline=await pipeline(indirect.code),copy32=await originalCopy(32),copy33=await originalCopy(33);assert.equal(copy32,copy33,'Width changes binding extents, not generated copy arithmetic');const copy=await pipeline(copy32);
  for(const [n,poison]of [[32,31],[33,31],[33,32]])for(const invalid of [[3,1,1],[4,0,1],[4,1,2]]){
   const owned=[],alloc=(data,usage=140)=>{const b=device.createBuffer({size:typeof data==='number'?data:data.byteLength,usage});owned.push(b);if(typeof data!=='number')device.queue.writeBuffer(b,0,data);return b;};
   try{
    const ids=Uint32Array.from({length:n},(_,i)=>i===32?0xffffffff:0x80000000+i),input=new Uint32Array(8*n).fill(777),output=new Uint32Array(8*n).fill(888),copied=new Uint32Array(8*n).fill(999),result=new Uint32Array(8*n).fill(0x12345678),indirectOutput=new Uint32Array(64*n).fill(7),args=new Uint32Array(8*n),scalarExpected=output.slice(),copyExpected=copied.slice(),resultExpected=result.slice(),indirectExpected=indirectOutput.slice(),indirectResultExpected=result.slice();
    for(let i=0;i<n;i++){
     input.set([i===poison?4:1,1000+i,2000+i,3000+i],8*i+2);output.set([10,20,30,40],8*i+1);scalarExpected.set([i===poison?0:1001+i,23,30,40],8*i+1);copyExpected.set([i===poison?0:1001+i,23,30],8*i+2);
     const compact=[ids[i],1,0,1],gated=i===poison?[ids[i],4,4,0x80000000]:compact;result.set(compact,8*i+4);resultExpected.set(gated,8*i+4);indirectResultExpected.set(gated,8*i+4);
     const active=i%2===0;args.set(i===poison?invalid:[active?4:0,1,1],i*8+5);if(active&&i!==poison)indirectExpected.fill(8,i*64,(i+1)*64);
    }
    const a=alloc(input),b=alloc(output),dest=alloc(copied),fault=alloc(new Uint32Array(n)),r=alloc(result),idBuffer=alloc(ids),io=alloc(indirectOutput),ifault=alloc(new Uint32Array(n)),config=alloc(args),ir=alloc(result),expectedFault=new Uint32Array(n),expectedIndirectFault=new Uint32Array(n);expectedFault[poison]=1;expectedIndirectFault[poison]=2;
    const expected=[scalarExpected,copyExpected,expectedFault,resultExpected,indirectExpected,expectedIndirectFault,indirectResultExpected],buffers=[b,dest,fault,r,io,ifault,ir],words=expected.reduce((sum,x)=>sum+x.length,0),read=alloc(words*4,9),encoder=device.createCommandEncoder();
    const dispatch=(p,bs,x,y=1)=>{const pass=encoder.beginComputePass();pass.setPipeline(p);pass.setBindGroup(0,device.createBindGroup({layout:p.getBindGroupLayout(0),entries:bs.map((buffer,binding)=>({binding,resource:{buffer}}))}));pass.dispatchWorkgroups(x,y);pass.end();};
    dispatch(first,[a,b,fault],1,n);dispatch(second,[b,fault],1,n);dispatch(copy,[b,dest],1,n);dispatch(gate,[fault,r,idBuffer],n);dispatch(indirectPipeline,[io,ifault,config],4,n);dispatch(gate,[ifault,ir,idBuffer],n);
    let offset=0;buffers.forEach((buffer,i)=>{encoder.copyBufferToBuffer(buffer,0,read,offset,expected[i].byteLength);offset+=expected[i].byteLength;});device.queue.submit([encoder.finish()]);await read.mapAsync(1);const got=new Uint32Array(read.getMappedRange()).slice();read.unmap();let cursor=0;expected.forEach((part,i)=>{assert.deepEqual(got.slice(cursor,cursor+part.length),part,JSON.stringify({n,poison,invalid,buffer:i}));cursor+=part.length;});exactWords+=got.length;cases++;
   }finally{owned.forEach(b=>b.destroy());}
  }
  t.diagnostic(JSON.stringify({cases,exactWords,widths:[32,33],poisonedLanes:[31,32],scalarOnePast:true,neighborPaddingPreserved:true,generatedCopyPaddedX:true,stickyFinalUnsupported:true,indirectSize16:true,partialXAndBadYZRejected:true,highCandidateIds:true,physicalParityQualified:false,runtimeWidthGateChanged:false}));
 }finally{device.destroy();gpu.destroy?.();}
});
