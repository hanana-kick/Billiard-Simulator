import test from 'node:test';
import assert from 'node:assert/strict';
import {packCreatedWorldTemplate} from '../src/resident-candidate/world-state.mjs';
import {generateWorldHPlan,worldHCommands,WORLD_H_CAPABILITY} from '../src/resident-candidate/world-h.mjs';
import {createWholeHOracle,DEFAULT_WHOLE_H_RULE,projectWorldComparison,firstWorldMismatch,assertWorldEquivalent,WHOLE_H_COMPARISON_COVERAGE} from './resident-candidate-whole-h-fixture.mjs';
let pending;
const fixture=()=>pending??=(async()=>{const oracle=await createWholeHOracle();try{const template=await packCreatedWorldTemplate(oracle.seed,{rule:DEFAULT_WHOLE_H_RULE}),initial=oracle.initial,initialScoring=oracle.scoring(),first=await oracle.step(),second=await oracle.step();return{seed:oracle.seed,template,initial,initialScoring,first,second};}finally{oracle.dispose();}})();
test('unchanged original created world advances two authentic h without prepared receipts',async()=>{
 const f=await fixture();assert.equal(DEFAULT_WHOLE_H_RULE.maxOuterSteps,15360);assert.equal(DEFAULT_WHOLE_H_RULE.maxOuterSteps*f.seed.cueInitial.application.dt,16,'production 16-second horizon, not the old 12.5-second fixture cap');for(const [index,row]of[f.first,f.second].entries()){assert.equal(row.snapshot.frame,index+1);assert.equal(row.snapshot.outerStep,0);assert.equal(row.snapshot.outerSubstep,index+1);assert.equal(row.snapshot.time,index?f.first.snapshot.time+row.snapshot.lastStep.h:f.initial.time+row.snapshot.lastStep.h);assert.equal(row.scoring.accumulator.steps,0);assert.equal(row.scoring.status,'running');assert.equal(row.snapshot.cue.present,true);}
 assert.notDeepEqual(f.first.snapshot.cue.cue.shaft.translation,f.initial.cue.cue.shaft.pose.translation,'genuine cue solver movement');assert.notDeepEqual(f.second.snapshot.cue.cue.shaft.rotation,f.first.snapshot.cue.cue.shaft.rotation,'genuine recurrent joint solve');assert.ok(f.first.snapshot.balls.every(b=>b.state.sleeping),'This initial gate honestly contains sleeping balls, not claimed strike coverage');assert.equal(f.template.state[5],0,'Expected CPU recurrence never mutates GPU initial bank');
});
test('initial bank independent semantic projection and relocated candidate diagnostic agree',async()=>{
 const f=await fixture(),groups=['balls','cue','caches','journal','roster','bvh','clock','rules'],args={template:f.template,seed:f.seed,expected:f.initial,scoring:f.initialScoring,groups};const p=projectWorldComparison({...args,words:f.template.state});assertWorldEquivalent(p.actual,p.expected,'actual created initial semantics');
 const size=f.template.state.length,words=new Uint32Array(size*2);words.set(f.template.state);words.set(f.template.state,size);for(const at of f.template.relocations)words[size+at]+=size;const p2=projectWorldComparison({...args,words,base:size});assertWorldEquivalent(p2.actual,p.expected,'relocated initial semantics');
 const cacheRow=10*16,cacheAt=size+f.template.segments.caches.offset+f.template.sharedGeometry[f.template.geometryOffsets.catalog+cacheRow+7]+313;const saved=words[cacheAt];assert.equal(saved,0x3f800000,'original absent convex recycle quaternion identity');words[cacheAt]=0;const brokenCache=projectWorldComparison({...args,words,base:size});assert.equal(firstWorldMismatch(brokenCache.actual,brokenCache.expected).path,'$.caches[10].recycleRotation[3]');words[cacheAt]=saved;
 words[size+f.template.segments.bodies.offset]^=1;const changed=projectWorldComparison({...args,words,base:size});assert.equal(firstWorldMismatch(changed.actual,changed.expected).path,'$.balls[0].linear[0]');assertWorldEquivalent(projectWorldComparison({...args,words}).actual,p.expected,'adjacent bank untouched');
});
test('complete first-h comparator exposes every represented source owner, with bounded exact diagnostics',async()=>{
 const f=await fixture(),p=projectWorldComparison({words:f.template.state,template:f.template,seed:f.seed,expected:f.first.snapshot,scoring:f.first.scoring});assert.deepEqual(Object.keys(p.actual),['balls','cue','caches','cueCloth','journal','roster','scene','bvh','clock','rules','game']);assert.deepEqual(Object.keys(p.expected),Object.keys(p.actual));assert.equal(p.actual.caches.length,26);assert.equal(p.expected.scene.bodies.length,23);assert.equal(p.expected.journal.lifetimes.length,p.expected.journal.edges.length);assert.ok(firstWorldMismatch(p.actual,p.expected),'unadvanced bank must not pass evolved source oracle');
 for(const owner of Object.keys(p.expected)){const a=structuredClone(p.expected);a[owner]={bad:true};const d=firstWorldMismatch(a,p.expected);assert.match(d.path,new RegExp('^\\$\\.'+owner+'(?:\\.|\\[|$)'));}
 assert.deepEqual(firstWorldMismatch({v:[0]},{v:[-0]}),{path:'$.v[0]',actual:0,expected:-0});assert.throws(()=>assertWorldEquivalent({word:0x00000001},{word:0},'subnormal'),/subnormal first mismatch.*word/);assert.equal(WHOLE_H_COMPARISON_COVERAGE.hardwarePerformance,false);assert.equal(WHOLE_H_COMPARISON_COVERAGE.rawCreation,false);
});
test('whole-h shader link and fixed source-capacity schedule are host-only qualification, not native evidence',async()=>{
 const f=await fixture(),p=generateWorldHPlan(f.template,{count:2});assert.equal(p.kind,'resident-source-world-h-plan');assert.equal(p.stateWords,f.template.state.length);assert.equal(p.fixedTailWords,f.template.fixedCcd.length);assert.equal(p.scratchWords,f.template.numericScratchWords);assert.deepEqual(p.bindingTypes,['storage','read-only-storage','read-only-storage','storage','read-only-storage']);assert.equal(WORLD_H_CAPABILITY.nativeWholeHQualified,false);
 const names=new Set(p.pipelines.map(x=>x.name));for(const name of['begin-h','collision-broad-begin','narrow-commit','ball-solver-scatter','pass-seal','application-post-finish','application-outer-finish'])assert.ok(names.has(name),name);let commands=0;for(const i of worldHCommands(p)){assert.ok(i>=0&&i<p.pipelines.length);commands++;}assert.ok(commands>p.pipelines.length);for(const pipeline of p.pipelines){assert.match(pipeline.code,/@compute/);assert.doesNotMatch(pipeline.code,/undefinedu|NaNu|hostForward|mapAsync/);}
});

// Coordinator-only actual native gate. Expected CPU snapshots never enter any
// GPU buffer. It starts from the authenticated CREATED source, not raw strikes.
// Fixed command order is encoded without intermediate state reads or branches.
test('actual native created first h and recurrent h equal independent untouched source',{
 skip:process.env.RUN_RESIDENT_WORLD_H_GPU!=='1',timeout:900000
},async t=>{
 const {createNativeOwner}=await import('./resident-candidate-gpu-support.mjs');
 const {generateCueCanonicalBridgeWGSL}=await import('../src/resident-candidate/cue-bridge.mjs');
 const {NUMERIC_PROFILE}=await import('../src/resident-candidate/numeric-profile.mjs');
 const {compareWorldBank}=await import('./resident-candidate-whole-h-fixture.mjs');
 const count=Number(process.env.RESIDENT_WORLD_H_BANKS??2),frames=Number(process.env.RESIDENT_WORLD_H_STEPS??1);assert.ok(Number.isInteger(count)&&count>=1&&count<=4);assert.ok(Number.isInteger(frames)&&frames>=1&&frames<=1230);
 const checkpoints=frames<=8?Array.from({length:frames},(_,i)=>i+1):[1,frames];
 const oracle=await createWholeHOracle(),expected=new Map();let owner;const resources=[];let scoped=false,submitted=false;
 try{
  const template=await packCreatedWorldTemplate(oracle.seed,{rule:DEFAULT_WHOLE_H_RULE});
  for(let i=1;i<=frames;i++){const row=await oracle.step();if(checkpoints.includes(i))expected.set(i,row);}
  const profile=process.env.RESIDENT_WORLD_H_NUMERIC_PROFILE??NUMERIC_PROFILE.PRESERVED_F32,coupledTransport=process.env.RESIDENT_WORLD_H_COUPLED_TRANSPORT??'staged',cueTransport=process.env.RESIDENT_WORLD_H_CUE_TRANSPORT??'staged',applicationTransport=process.env.RESIDENT_WORLD_H_APPLICATION_TRANSPORT??'staged',ccdTransport=process.env.RESIDENT_WORLD_H_CCD_TRANSPORT??'staged',plan=generateWorldHPlan(template,{count,numericProfile:profile,coupledTransport,cueTransport,applicationTransport,ccdTransport}),commands=Array.from(worldHCommands(plan));
  const state=new Uint32Array(count*template.state.length+template.fixedCcd.length);
  for(let candidate=0;candidate<count;candidate++){const base=candidate*template.state.length;state.set(template.state,base);for(const pointer of template.relocations)state[base+pointer]+=base;state[base+4]=candidate;}
  state.set(template.fixedCcd,count*template.state.length);
  owner=await createNativeOwner('resident authentic created whole h');const device=owner.device;
  console.log(JSON.stringify({stage:'world-h-native-begin',createdInput:true,rawInput:false,count,frames,profile,transport:plan.transport,pipelines:plan.pipelines.length,commandsPerH:commands.length,checkpoints,noIntermediateMapping:true,maxDispatchesPerSubmission:1024,adapter:owner.adapterInfo}));
  const make=(size,usage)=>{const b=device.createBuffer({size,usage});resources.push(b);return b;};
  const inputs=[state,template.program,template.sharedGeometry,new Uint32Array(count*template.numericScratchWords),new Uint32Array(16)];
  const buffers=inputs.map((a,i)=>{assert.ok(a.byteLength<=device.limits.maxStorageBufferBindingSize,'actual binding '+i+' capacity');const b=make(a.byteLength,128|8|4);device.queue.writeBuffer(b,0,a);return b;});
  assert.ok(state.byteLength*checkpoints.length<=device.limits.maxBufferSize,'exact diagnostic checkpoint capacity');
  const read=make(state.byteLength*checkpoints.length,1|8),groupLayout=device.createBindGroupLayout({entries:plan.bindingTypes.map((type,binding)=>({binding,visibility:4,buffer:{type}}))}),layout=device.createPipelineLayout({bindGroupLayouts:[groupLayout]}),group=device.createBindGroup({layout:groupLayout,entries:buffers.map((buffer,binding)=>({binding,resource:{buffer}}))});
  device.pushErrorScope('validation');scoped=true;
  const pipelineCompileStarted=performance.now();let completedPipelineCompiles=0;
  const compile=async(name,code)=>{const started=performance.now();console.log(JSON.stringify({stage:'compile-start',name,bytes:code.length}));const module=device.createShaderModule({code,label:name}),info=await module.getCompilationInfo();assert.deepEqual(info.messages.filter(m=>m.type==='error').map(m=>`${m.lineNum}:${m.linePos} ${m.message}`),[],name+' WGSL');console.log(JSON.stringify({stage:'pipeline-start',name}));const p=await device.createComputePipelineAsync({layout,compute:{module,entryPoint:'main'}});completedPipelineCompiles++;console.log(JSON.stringify({stage:'pipeline-ready',name,compileWallMs:performance.now()-started,timingKind:'host-wall-clock-not-gpu-timestamp'}));return p;};
  const init=await compile('created-cue-canonical-initial-only',`@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;${generateCueCanonicalBridgeWGSL()}\n@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=${count}u){return;}let b=gid.x*${template.state.length}u;let status=rc_cue_to_canonical(b+${template.segments.cue.offset}u,b+${template.segments.bodies.offset}u);rc_state[b+2u]=select(4u,1u,status==1u);}`);
  const pipelines=[];for(const p of plan.pipelines)pipelines.push(await compile(p.name,p.code));
  console.log(JSON.stringify({stage:'pipeline-compilation-total',pipelines:completedPipelineCompiles,compileWallMs:performance.now()-pipelineCompileStarted,timingKind:'host-wall-clock-not-gpu-timestamp',hardwarePerformanceClaim:false}));
  // Bounded command buffers only. Submission boundaries never inspect state;
  // all candidates and scratch retain the same device allocations across h.
  for(let frame=1;frame<=frames;frame++){
   const hStarted=performance.now();let encodeWallMs=0,queueDrainWallMs=0,queueSubmitWallMs=0;
   let cursor=0,initialize=frame===1,submissions=0;
   while(cursor<commands.length||initialize){
    const encodeStarted=performance.now();const encoder=device.createCommandEncoder({label:'source h '+frame+' chunk '+submissions}),pass=encoder.beginComputePass();pass.setBindGroup(0,group);let dispatched=0,previous=-1;
    if(initialize){pass.setPipeline(init);pass.dispatchWorkgroups(count);initialize=false;dispatched++;}
    for(;cursor<commands.length&&dispatched<1024;cursor++,dispatched++){const index=commands[cursor];if(previous!==index){pass.setPipeline(pipelines[index]);previous=index;}pass.dispatchWorkgroups(count);}pass.end();
    const checkpoint=checkpoints.indexOf(frame);if(cursor===commands.length&&checkpoint>=0)encoder.copyBufferToBuffer(buffers[0],0,read,checkpoint*state.byteLength,state.byteLength);
    const commandBuffer=encoder.finish();encodeWallMs+=performance.now()-encodeStarted;const submitStarted=performance.now();device.queue.submit([commandBuffer]);queueSubmitWallMs+=performance.now()-submitStarted;submitted=true;const drainStarted=performance.now();await device.queue.onSubmittedWorkDone();queueDrainWallMs+=performance.now()-drainStarted;submissions++;
   }
   console.log(JSON.stringify({stage:'world-h-submitted',frame,submissions,commands:commands.length,dispatches:commands.length+(frame===1?1:0),initializationDispatches:frame===1?1:0,encodeWallMs,queueSubmitWallMs,queueDrainWallMs,encodeAndDrainWallMs:performance.now()-hStarted,timingKind:'host-wall-clock-not-gpu-timestamp',hardwarePerformanceClaim:false,mapped:false}));
  }
  // One mapping AFTER every requested h. These diagnostic GPU copies are not
  // restored, rebound, or used to choose the immutable recurrence schedule.
  await read.mapAsync(1);const snapshots=new Uint32Array(read.getMappedRange().slice(0));read.unmap();
  for(const [checkpoint,frame]of checkpoints.entries()){
   const actual=snapshots.subarray(checkpoint*state.length,(checkpoint+1)*state.length),wanted=expected.get(frame);
   for(let candidate=0;candidate<count;candidate++){const base=candidate*template.state.length;console.log(JSON.stringify({stage:'world-h-boundary',frame,candidate,status:actual[base+2],reason:actual[base+3],hSequence:actual[base+5],worldHDetail:actual[base+template.segments.worldH.offset+3],applicationPhase:actual[base+template.segments.worldApplication.offset+2]}));try{compareWorldBank({words:actual,base,template,seed:oracle.seed,expected:wanted.snapshot,scoring:wanted.scoring});}catch(error){let groupDifferences;try{const projection=projectWorldComparison({words:actual,base,template,seed:oracle.seed,expected:wanted.snapshot,scoring:wanted.scoring});groupDifferences=Object.keys(projection.expected).map(name=>({owner:name,mismatch:firstWorldMismatch(projection.actual[name],projection.expected[name],'$.'+name)}));}catch(projectionError){groupDifferences=[{projectionError:projectionError.message}];}console.log(JSON.stringify({stage:'world-h-all-owner-differences',frame,candidate,groups:groupDifferences}));const{writeFileSync}=await import('node:fs');const path=process.env.RESIDENT_WORLD_H_ACTUAL_PATH??'/tmp/resident-world-h-native-actual.bin';writeFileSync(path,new Uint8Array(actual.buffer,actual.byteOffset,actual.byteLength));writeFileSync(path+'.json',JSON.stringify({createdInput:true,rawInput:false,frame,candidate,count,profile,transport:plan.transport,stateWords:template.state.length,fixedTailWords:template.fixedCcd.length,sourceIdentity:template.sourceIdentity,segments:template.segments,groupDifferences,statusRows:Array.from({length:count},(_,i)=>{const b=i*template.state.length;return{id:actual[b+4],status:actual[b+2],reason:actual[b+3],hSequence:actual[b+5],worldH:Array.from(actual.slice(b+template.segments.worldH.offset,b+template.segments.worldH.offset+8))};}),error:error.message},null,2));console.log(JSON.stringify({stage:'failed-boundary-artifact',path,metadata:path+'.json'}));throw error;}}
  }
  assert.equal(await device.popErrorScope(),null,'whole-h device validation');scoped=false;t.diagnostic(JSON.stringify({createdInput:true,rawInput:false,count,frames,transport:plan.transport,checkpoints,noIntermediateMapping:true,fullShot:false,hardwarePerformance:false}));
 }finally{oracle.dispose();if(owner){if(scoped)await owner.device.popErrorScope();if(submitted)await owner.device.queue.onSubmittedWorkDone();for(const b of resources){try{b.unmap();}catch{}b.destroy();}owner.release();}}
});
