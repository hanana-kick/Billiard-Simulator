// Coordinator-only native qualification. No source state, predicate receipt or
// expected future is uploaded. Created input remains distinct from raw input.
import test from 'node:test';
import assert from 'node:assert/strict';
import {compileWorldDevicePc,WORLD_DEVICE_PC as PC} from '../src/resident-candidate/world-device-pc.mjs';
import {generateWorldHPlan,worldHCommands} from '../src/resident-candidate/world-h.mjs';
import {packCreatedWorldTemplate} from '../src/resident-candidate/world-state.mjs';
import {generateCueCanonicalBridgeWGSL} from '../src/resident-candidate/cue-bridge.mjs';
import {NUMERIC_PROFILE} from '../src/resident-candidate/numeric-profile.mjs';
import {createWholeHOracle,DEFAULT_WHOLE_H_RULE,compareWorldBank,projectWorldComparison,firstWorldMismatch} from './resident-candidate-whole-h-fixture.mjs';

// Test epoch handoff only: do not reset an unfinished cursor. The next fixed
// sweep block may continue it, but its prior/final checkpoint then fails the
// exact requested h gate. No host reads or branch choose this handoff.
function resumeSource(pc){
 const signature='@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>)';
 assert.ok(pc.begin.code.includes(signature));
 return pc.begin.code.replace(signature,'fn rc_pc_test_begin(gid:vec3<u32>)')+`\n@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=${pc.count}u){return;}let bank=gid.x*${pc.stateWords}u;let cb=${pc.controlTailBase}u+gid.x*${pc.controlWords}u;if(rc_state[cb+4u]!=2u){return;}if(rc_state[bank+5u]!=rc_state[cb+5u]+rc_state[cb+7u]){rc_pc_fail(cb,1u);return;}rc_pc_test_begin(gid);}`;
}

test('native device-PC source first/recurrent h preserve independent original represented owners',{
 skip:process.env.RUN_RESIDENT_WORLD_PC_GPU!=='1',timeout:900000
},async t=>{
 const {createNativeOwner}=await import('./resident-candidate-gpu-support.mjs');
 const count=Number(process.env.RESIDENT_WORLD_PC_BANKS??2),frames=Number(process.env.RESIDENT_WORLD_PC_STEPS??2),sweeps=Number(process.env.RESIDENT_WORLD_PC_SWEEPS??256),chunkSize=1024;
 assert.ok(Number.isInteger(count)&&count>=1&&count<=4);assert.ok(Number.isInteger(frames)&&frames>=1&&frames<=8);assert.ok(Number.isInteger(sweeps)&&sweeps>=1&&sweeps<=65536);
 const epochMode=process.env.RESIDENT_WORLD_PC_EPOCH_MODE??'single';assert.ok(['single','per-h'].includes(epochMode));const checkpoints=epochMode==='single'?[frames]:Array.from({length:frames},(_,i)=>i+1),sweepsPerBlock=sweeps*(epochMode==='single'?frames:1);
 const profile=process.env.RESIDENT_WORLD_PC_NUMERIC_PROFILE??NUMERIC_PROFILE.PRESERVED_F32;
 const transports={cueTransport:process.env.RESIDENT_WORLD_PC_CUE_TRANSPORT??'flat',coupledTransport:process.env.RESIDENT_WORLD_PC_COUPLED_TRANSPORT??'micro',applicationTransport:process.env.RESIDENT_WORLD_PC_APPLICATION_TRANSPORT??'flat',ccdTransport:process.env.RESIDENT_WORLD_PC_CCD_TRANSPORT??'staged',queryTransport:process.env.RESIDENT_WORLD_PC_QUERY_TRANSPORT??'staged'};
 const oracle=await createWholeHOracle(),expected=[];let owner,scoped=false,submitted=false;const resources=[];
 try{
  const template=await packCreatedWorldTemplate(oracle.seed,{rule:DEFAULT_WHOLE_H_RULE});for(let i=0;i<frames;i++)expected.push(await oracle.step());
  const source=generateWorldHPlan(template,{count,numericProfile:profile,...transports}),pc=compileWorldDevicePc(source,{programBase:template.program.length,controlTailBase:count*template.state.length+template.fixedCcd.length,maxH:epochMode==='single'?frames:1}),state=new Uint32Array(pc.totalStateWords),program=new Uint32Array(template.program.length+pc.bytecode.length);
  program.set(template.program);program.set(pc.bytecode,pc.programBase);for(let candidate=0;candidate<count;candidate++){const base=candidate*template.state.length;state.set(template.state,base);for(const at of template.relocations)state[base+at]+=base;state[base+4]=candidate;}state.set(template.fixedCcd,count*template.state.length);
  const sourceCommands=Array.from(worldHCommands(source)).length,commandsPerH=pc.sweep.length*sweeps+1,commandsPerBlock=pc.sweep.length*sweepsPerBlock+1;
  owner=await createNativeOwner('resident source device-PC recurrence');const device=owner.device;
  console.log(JSON.stringify({stage:'device-pc-native-begin',createdInput:true,rawInput:false,count,frames,sweeps,epochMode,checkpoints,sweepsPerBlock,sourceCommandsPerH:sourceCommands,commandsPerH,sourceCapsUnchanged:true,transport:source.transport,profile,pcInstructions:pc.instructions,pcStackDepth:pc.depthUsed,controlWordsPerCandidate:pc.controlWords,oneFinalMap:true,intermediateHostDecisions:false,adapter:owner.adapterInfo}));
  const make=(size,usage)=>{const b=device.createBuffer({size,usage});resources.push(b);return b;},inputs=[state,program,template.sharedGeometry,new Uint32Array(count*template.numericScratchWords),new Uint32Array(16)],buffers=inputs.map((a,i)=>{assert.ok(a.byteLength<=device.limits.maxStorageBufferBindingSize,'actual storage binding '+i);const b=make(a.byteLength,128|8|4);device.queue.writeBuffer(b,0,a);return b;}),read=make(state.byteLength*checkpoints.length,1|8);
  const groupLayout=device.createBindGroupLayout({entries:pc.bindingTypes.map((type,binding)=>({binding,visibility:4,buffer:{type}}))}),layout=device.createPipelineLayout({bindGroupLayouts:[groupLayout]}),group=device.createBindGroup({layout:groupLayout,entries:buffers.map((buffer,binding)=>({binding,resource:{buffer}}))});
  device.pushErrorScope('validation');scoped=true;const compileStarted=performance.now();let compiled=0;
  const compile=async(name,code)=>{const started=performance.now();console.log(JSON.stringify({stage:'compile-start',name,bytes:code.length}));const module=device.createShaderModule({code,label:name}),info=await module.getCompilationInfo();assert.deepEqual(info.messages.filter(m=>m.type==='error').map(m=>`${m.lineNum}:${m.linePos} ${m.message}`),[],name+' WGSL');console.log(JSON.stringify({stage:'pipeline-start',name}));const p=await device.createComputePipelineAsync({layout,compute:{module,entryPoint:'main'}});compiled++;console.log(JSON.stringify({stage:'pipeline-ready',name,compileWallMs:performance.now()-started,timingKind:'host-wall-not-gpu-timestamp'}));return p;};
  const initial=await compile('created-canonical-initial-only',`@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;${generateCueCanonicalBridgeWGSL()}\n@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=${count}u){return;}let b=gid.x*${template.state.length}u;let result=rc_cue_to_canonical(b+${template.segments.cue.offset}u,b+${template.segments.bodies.offset}u);rc_state[b+2u]=select(4u,1u,result==1u);}`),begin=await compile(pc.begin.name,pc.begin.code),resume=epochMode==='per-h'&&frames>1?await compile('device-pc-completed-epoch-resume',resumeSource(pc)):null,pipelines=[];
  for(const p of pc.pipelines)pipelines.push(await compile(p.name,p.code));console.log(JSON.stringify({stage:'device-pc-compiled',pipelines:compiled,compileWallMs:performance.now()-compileStarted,hardwarePerformanceClaim:false}));
  for(let frame=0;frame<checkpoints.length;frame++){
   const started=performance.now(),total=commandsPerBlock+(frame===0?1:0);let cursor=0,submissions=0,encodeWallMs=0,queueDrainWallMs=0;
   while(cursor<total){const encodeStarted=performance.now(),encoder=device.createCommandEncoder({label:'device PC h '+(frame+1)+' fixed chunk '+submissions}),pass=encoder.beginComputePass();pass.setBindGroup(0,group);
    for(let n=0;n<chunkSize&&cursor<total;n++,cursor++){
     let pipeline;if(frame===0&&cursor===0)pipeline=initial;else{const command=cursor-(frame===0?1:0);pipeline=command===0?(frame===0?begin:resume):pipelines[pc.sweep[(command-1)%pc.sweep.length]];}pass.setPipeline(pipeline);pass.dispatchWorkgroups(count);
    }pass.end();if(cursor===total)encoder.copyBufferToBuffer(buffers[0],0,read,frame*state.byteLength,state.byteLength);const command=encoder.finish();encodeWallMs+=performance.now()-encodeStarted;device.queue.submit([command]);submitted=true;const drain=performance.now();await device.queue.onSubmittedWorkDone();queueDrainWallMs+=performance.now()-drain;submissions++;
   }
   console.log(JSON.stringify({stage:'device-pc-h-submitted',frame:checkpoints[frame],epochMode,sweeps:sweepsPerBlock,dispatches:total,submissions,encodeWallMs,queueDrainWallMs,wallMs:performance.now()-started,timingKind:'host-wall-not-gpu-timestamp',mapped:false}));
  }
  await read.mapAsync(1);const snapshots=new Uint32Array(read.getMappedRange().slice(0));read.unmap();
  for(let checkpoint=0;checkpoint<checkpoints.length;checkpoint++){
   const frame=checkpoints[checkpoint]-1;const words=snapshots.subarray(checkpoint*state.length,(checkpoint+1)*state.length);for(let candidate=0;candidate<count;candidate++){
    const base=candidate*template.state.length,cb=pc.controlTailBase+candidate*pc.controlWords,control=Array.from(words.slice(cb,cb+16));console.log(JSON.stringify({stage:'device-pc-boundary',frame:frame+1,candidate,worldStatus:words[base+2],reason:words[base+3],hSequence:words[base+5],control}));
    try{assert.equal(control[PC.header.status],PC.status.complete,'fixed sweep block incomplete/invalid is not physics miss');assert.equal(control[PC.header.completedH],epochMode==='single'?frames:1);assert.equal(control[PC.header.initialH],epochMode==='single'?0:frame);assert.equal(words[base+5],frame+1);compareWorldBank({words,base,template,seed:oracle.seed,expected:expected[frame].snapshot,scoring:expected[frame].scoring});}
    catch(error){let differences;try{const p=projectWorldComparison({words,base,template,seed:oracle.seed,expected:expected[frame].snapshot,scoring:expected[frame].scoring});differences=Object.keys(p.expected).map(name=>({owner:name,mismatch:firstWorldMismatch(p.actual[name],p.expected[name],'$.'+name)}));}catch(e){differences=[{projectionError:e.message}];}const{writeFileSync}=await import('node:fs'),path=process.env.RESIDENT_WORLD_PC_ACTUAL_PATH??'/tmp/resident-world-pc-native-actual.bin';writeFileSync(path,new Uint8Array(words.buffer,words.byteOffset,words.byteLength));writeFileSync(path+'.json',JSON.stringify({frame:frame+1,candidate,count,sweeps,sourceIdentity:template.sourceIdentity,transport:source.transport,segments:template.segments,stateWords:template.state.length,controlTailBase:pc.controlTailBase,controlWords:pc.controlWords,control,differences,error:error.message},null,2));console.log(JSON.stringify({stage:'device-pc-mismatch',path,differences}));throw error;}
   }
  }
  assert.equal(await device.popErrorScope(),null);scoped=false;t.diagnostic(JSON.stringify({createdInput:true,rawInput:false,count,frames,sweeps,epochMode,checkpoints,commandsPerH,sourceCommandsPerH:sourceCommands,oneFinalMap:true,noHostStateDecisions:true,fullRest:false,hardwarePerformance:false}));
 }finally{oracle.dispose();if(owner){if(scoped)await owner.device.popErrorScope();if(submitted)await owner.device.queue.onSubmittedWorkDone();for(const b of resources){try{b.unmap();}catch{}b.destroy();}owner.release();}}
});
