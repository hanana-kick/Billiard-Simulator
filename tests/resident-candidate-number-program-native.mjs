// Explicit fixed component roles. Native execution never opens oracle artifacts.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {serialize,deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const sha=x=>createHash('sha256').update(x).digest('hex');
const INPUT='150a37ca1da6a22cc8b3cefb0006ca5fb79afe635bbc6e0b3cd934a69bec3faa';
const SOURCE='f935fd56ce5df233869ce0e0158e708b684b6b749eb1dbae1ebb05a3be9caf6d';
const LENGTHS=[127176,874992,25408,27264,32,254024];
const wrapper='\n@group(0) @binding(6) var<storage,read> rc_call:array<u32>;\n@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x!=0u){return;}rc_raw_program_step(rc_call[0],rc_call[1],rc_call[2],rc_call[3]);}\n';
const keys=(x,want)=>assert.deepEqual(Object.keys(x).sort(),[...want].sort());
const save=(dir,name,bytes)=>{writeFileSync(join(dir,name),bytes,{flag:'wx'});return sha(bytes);};
const json=(dir,name,x)=>save(dir,name,JSON.stringify(x,null,2)+'\n');
export function assertNumberProgramNativePlan(p){
 keys(p,['kind','componentInputSha256','canonicalSource','canonicalSourceSha256','shader','shaderSha256','cases','work']);
 assert.equal(p.kind,'resident-number-program-fixed-native-plan-v1');assert.equal(p.componentInputSha256,INPUT);assert.equal(sha(p.canonicalSource),SOURCE);assert.equal(p.canonicalSourceSha256,SOURCE);assert.equal(p.shader,p.canonicalSource+wrapper);assert.equal(sha(p.shader),p.shaderSha256);
 assert.deepEqual(p.work,{cases:3,passes:2,dispatches:6,workgroups:1,workgroupSize:1,finalMaps:1,physicalHorizonChanged:false,rawWorldInput:false});assert.equal(p.cases.length,3);
 for(const [i,c]of p.cases.entries()){keys(c,['index','args','bindings']);assert.equal(c.index,i);assert.deepEqual(c.args,[[812879,54976,55744,20000],[810263,54976,55744,20000],[814569,54976,55744,20000]][i]);assert.equal(c.bindings.length,6);for(let n=0;n<6;n++)assert.ok(c.bindings[n] instanceof Uint32Array&&c.bindings[n].length===LENGTHS[n],'exact source logical binding length '+n);assert.deepEqual(Array.from(c.bindings[0].slice(55744,55748)),[0,0,0,0]);}
 return p;
}
export function prepareNumberProgramNative(componentPath,out){
 assert.equal(existsSync(out),false);const bytes=readFileSync(componentPath);assert.equal(sha(bytes),INPUT);const c=deserialize(bytes);assert.equal(c.kind,'resident-number-program-call-inputs-v1');assert.equal(c.rawWorldInput,false);assert.equal(c.worldResidentSequenceQualified,false);assert.equal(sha(c.canonicalSource),SOURCE);
 const plan={kind:'resident-number-program-fixed-native-plan-v1',componentInputSha256:INPUT,canonicalSource:c.canonicalSource,canonicalSourceSha256:SOURCE,shader:c.canonicalSource+wrapper,shaderSha256:sha(c.canonicalSource+wrapper),cases:c.cases.map(x=>({index:x.index,args:x.args,bindings:[x.state,...[1,2,3,4,5].map(i=>x.readonlyBindings[i])]})),work:{cases:3,passes:2,dispatches:6,workgroups:1,workgroupSize:1,finalMaps:1,physicalHorizonChanged:false,rawWorldInput:false}};
 assertNumberProgramNativePlan(plan);mkdirSync(out,{recursive:false});const planSha256=save(out,'plan.v8',serialize(plan));json(out,'manifest.json',{kind:plan.kind,planSha256,componentInputSha256:INPUT,shaderSha256:plan.shaderSha256,canonicalSourceSha256:SOURCE,work:plan.work,initialOnlyComponentCases:true,expectedFileOpened:false});return{planSha256,shaderSha256:plan.shaderSha256,work:plan.work};
}
export async function runNumberProgramNative(planPath,planSha256,out){
 assert.equal(process.env.REQUIRE_WEBGPU,'1');assert.equal(process.env.RUN_RESIDENT_NUMBER_PROGRAM_NATIVE,'fixed-six-dispatches');assert.equal(existsSync(out),false);
 const bytes=readFileSync(planPath);assert.equal(sha(bytes),planSha256);const p=assertNumberProgramNativePlan(deserialize(bytes));
 for(const name of['PhysicsLab','LabController','ShotSearchCore'])assert.equal(globalThis[name],undefined,'lean native role');
 const {createNativeOwner}=await import('./resident-candidate-gpu-support.mjs');const owner=await createNativeOwner('exact post-impact Number-program component');const device=owner.device,owned=[],trace=x=>console.log(JSON.stringify(x));let scoped=false,submitted=false;
 mkdirSync(out,{recursive:false});
 trace({stage:'owned-adapter-ready',adapter:owner.adapterInfo,deviceLimits:Object.fromEntries(['maxStorageBufferBindingSize','maxBufferSize','maxStorageBuffersPerShaderStage','maxComputeInvocationsPerWorkgroup'].map(k=>[k,device.limits[k]])),planSha256,expectedFileOpened:false});
 const stats={dispatches:0,submissions:0,copies:0,mappings:0,initialWrites:0,passes:[]};
 const allocate=(size,usage,label)=>{assert.ok(Number.isSafeInteger(size)&&size>0&&size<=device.limits.maxBufferSize);if(usage&128)assert.ok(size<=device.limits.maxStorageBufferBindingSize);const b=device.createBuffer({size,usage,label});owned.push(b);return b;};
 try{
  assert.ok(device.limits.maxStorageBuffersPerShaderStage>=7);device.pushErrorScope('validation');scoped=true;
  const layout=device.createBindGroupLayout({entries:[0,1,2,3,4,6,7].map(binding=>({binding,visibility:4,buffer:{type:[0,3,7].includes(binding)?'storage':'read-only-storage'}}))});
  const module=device.createShaderModule({code:p.shader,label:'exact original Number-program call'}),info=await module.getCompilationInfo();assert.deepEqual(info.messages.filter(x=>x.type==='error'),[]);trace({stage:'preflight-pass',shaderSha256:p.shaderSha256,bytes:p.shader.length,computeDispatches:0});
  const began=performance.now();trace({stage:'pipeline-start',computeDispatches:0,memory:process.memoryUsage(),resource:process.resourceUsage()});
  const pipeline=await device.createComputePipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[layout]}),compute:{module,entryPoint:'main'}}),compileWallMs=performance.now()-began;
  const compileValidation=await device.popErrorScope();scoped=false;assert.equal(compileValidation,null);trace({stage:'pipeline-ready',compileWallMs,computeDispatches:0,memory:process.memoryUsage(),resource:process.resourceUsage()});
  device.pushErrorScope('validation');scoped=true;
  const wordsPerCase=LENGTHS.reduce((n,x)=>n+x,0),totalWords=wordsPerCase*6,read=allocate(totalWords*4,1|8,'single final component read');
  // Every fresh pass/case allocation succeeds before any source call runs.
  const cases=[];for(let pass=0;pass<2;pass++)for(const c of p.cases){const buffers=c.bindings.map((a,i)=>allocate(a.byteLength,128|8|4,`pass${pass} case${c.index} binding${i}`)),args=allocate(16,128|8,'actual source arguments');const group=device.createBindGroup({layout,entries:[...buffers.map((buffer,i)=>({binding:i===5?7:i,resource:{buffer}})),{binding:6,resource:{buffer:args}}]});cases.push({pass,index:c.index,buffers,args,group});}
  for(const c of cases){const source=p.cases[c.index];source.bindings.forEach((a,i)=>{device.queue.writeBuffer(c.buffers[i],0,a);stats.initialWrites++;});device.queue.writeBuffer(c.args,0,new Uint32Array(source.args));stats.initialWrites++;}
  trace({stage:'all-allocations-ready',peakAllocatedBytes:owned.reduce((n,b)=>n+b.size,0),uploadsSealed:true,work:p.work});
  for(let passIndex=0;passIndex<2;passIndex++){
   const start=performance.now(),encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);
   for(const c of cases.filter(c=>c.pass===passIndex)){pass.setBindGroup(0,c.group);pass.dispatchWorkgroups(1);stats.dispatches++;}pass.end();
   for(const c of cases.filter(c=>c.pass===passIndex)){let offset=(c.pass*3+c.index)*wordsPerCase;for(let i=0;i<6;i++){encoder.copyBufferToBuffer(c.buffers[i],0,read,offset*4,LENGTHS[i]*4);offset+=LENGTHS[i];stats.copies++;}}
   const encodeWallMs=performance.now()-start,submitAt=performance.now();device.queue.submit([encoder.finish()]);submitted=true;stats.submissions++;const submitWallMs=performance.now()-submitAt,drainAt=performance.now();await device.queue.onSubmittedWorkDone();const drainWallMs=performance.now()-drainAt;
   const row={pass:passIndex,encodeWallMs,submitWallMs,queueDrainWallMs:drainWallMs,wallMs:performance.now()-start,timingKind:'host-wall-includes-copies-not-gpu-timestamp'};stats.passes.push(row);trace({stage:'fixed-pass-complete',...row});
  }
  const mapAt=performance.now();await read.mapAsync(1);stats.mappings++;const words=new Uint32Array(read.getMappedRange().slice(0));read.unmap();stats.readbackWallMs=performance.now()-mapAt;
  const validation=await device.popErrorScope();scoped=false;assert.equal(validation,null);
  const actual={kind:'resident-number-program-native-actual-v1',planSha256,componentInputSha256:INPUT,shaderSha256:p.shaderSha256,adapter:owner.adapterInfo??null,compileWallMs,stats,cases:cases.map(c=>{let offset=(c.pass*3+c.index)*wordsPerCase;return{pass:c.pass,index:c.index,bindings:LENGTHS.map(n=>{const a=words.slice(offset,offset+n);offset+=n;return a;})};}),scope:{componentOnly:true,rawWorldInput:false,wholeWorldRecurrence:false,fullRest:false,hardwareQualification:false}};
  const actualSha256=save(out,'actual.v8',serialize(actual));json(out,'manifest.json',{kind:actual.kind,actualSha256,planSha256,componentInputSha256:INPUT,shaderSha256:p.shaderSha256,compileWallMs,stats,expectedFileOpened:false,parity:'pending-independent-assertion'});trace({stage:'fixed-native-component-finished',actualSha256,compileWallMs,stats,expectedFileOpened:false});return actualSha256;
 }finally{if(scoped)try{await device.popErrorScope();}catch{}if(submitted)try{await device.queue.onSubmittedWorkDone();}catch{}for(const b of owned){try{b.unmap();}catch{}b.destroy();}owner.release();}
}
export function assertNumberProgramNative(actualDir,componentDir,outPath){
 const manifest=JSON.parse(readFileSync(join(actualDir,'manifest.json'))),bytes=readFileSync(join(actualDir,'actual.v8'));assert.equal(sha(bytes),manifest.actualSha256);const actual=deserialize(bytes);
 const inputBytes=readFileSync(join(componentDir,'call-inputs.v8'));assert.equal(sha(inputBytes),INPUT);const input=deserialize(inputBytes),expectedBytes=readFileSync(join(componentDir,'assertions.v8'));assert.equal(sha(expectedBytes),'da6e74597b14cef854d4f769ea4ec11e02e5182e447c26775f68b0c6ab98955f');const expected=deserialize(expectedBytes);assert.equal(expected.inputSha256,INPUT);
 assert.equal(actual.kind,'resident-number-program-native-actual-v1');assert.equal(actual.componentInputSha256,INPUT);assert.equal(actual.cases.length,6);assert.equal(actual.stats.dispatches,6);assert.equal(actual.stats.mappings,1);
 for(const [i,c]of actual.cases.entries()){assert.equal(c.pass,Math.floor(i/3));assert.equal(c.index,i%3);assert.equal(c.bindings.length,6);assert.deepEqual(c.bindings[0],expected.captures[c.index].afterState,'complete native state including unrelated words');for(let j=1;j<6;j++)assert.deepEqual(c.bindings[j],input.cases[c.index].readonlyBindings[j],'complete unchanged binding '+j);}
 const receipt={kind:'resident-number-program-native-component-pass-v1',status:'pass',actualSha256:manifest.actualSha256,planSha256:actual.planSha256,componentInputSha256:INPUT,expectedSha256:sha(expectedBytes),shaderSha256:actual.shaderSha256,passes:2,callsPerPass:3,allStateAndUnwrittenBindingsExact:true,sourceBudgets:[20000,20000,20000],componentOnly:true,rawWorldInput:false,wholeWorldRecurrenceQualified:false,fullRest:false,native1024:false,hardwarePerformance:false};writeFileSync(outPath,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});return receipt;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const[mode,...args]=process.argv.slice(2);try{if(mode==='prepare'){assert.equal(args.length,2);console.log(JSON.stringify(prepareNumberProgramNative(...args.map(x=>resolve(x)))));}else if(mode==='gpu'){assert.equal(args.length,3);await runNumberProgramNative(resolve(args[0]),args[1],resolve(args[2]));}else if(mode==='assert'){assert.equal(args.length,3);console.log(JSON.stringify(assertNumberProgramNative(...args.map(x=>resolve(x)))));}else throw Error('Explicit prepare/gpu/assert required');}catch(error){console.error(error);process.exitCode=1;}
}
