// Diagnostic native pilot only. Original query bodies and 256-iteration source
// cap are immutable; 16 bounded VM chunks are transport, never a reduced cap.
// This is not a physical whole-world or source-f32 universal admission gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createMicrocodePointFixture,assertMicrocodePointFixture} from './resident-candidate-microcode-point-fixture.mjs';
import {generateMicrocodeVmWGSL,microcodeVmLayout} from '../src/resident-candidate/microcode-vm.mjs';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
import {createNativeOwner} from './resident-candidate-gpu-support.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export async function runMicrocodePointNative({owner,fixture,runs=3,instructionBudget=65536,chunks=16,workgroupSize=1,artifactDir='/tmp/resident-microcode-point-native-artifact',trace=console.log}={}){
 assert.equal(fixture.count,12,'Frozen original 12-query benchmark');assert.equal(fixture.layout.gjkIterations,256,'Unchanged original source GJK cap');assert.equal(runs,3,'Cold + two fresh-buffer warm runs');assert.equal(instructionBudget,65536);assert.equal(chunks,16,'Fixed bounded transport, completion must still pass');
 assert.ok([1,64].includes(workgroupSize),'Explicit debug1 or parallel64 query gate');const workgroups=Math.ceil(fixture.count/workgroupSize);
 const p=fixture.compiled,count=fixture.count,options={count,workgroupSize,localWords:p.localWords,stackCapacity:Math.max(1,p.callDepth),instructionCount:p.instructions.length/8,entryPc:p.entryPc,instructionBudget,initialSlots:fixture.initialSlots},layout=microcodeVmLayout(options),shader=generateMicrocodeVmWGSL(options),initial=fixture.bindings.map(b=>b.slice()),device=owner.device,report={kind:'resident-microcode-point-native-v1',scope:'12 original cushion projections; not a whole h, strike or full-rest',sourceGjkCap:256,sourceSha256:p.sourceSha256,programSha256:sha(p.instructions),shaderSha256:sha(shader),bindingHashes:initial.map(sha),count,workgroupSize,workgroups,instructionBudget,chunks,shaderBytes:shader.length,instructions:options.instructionCount,localWords:p.localWords,callDepth:p.callDepth,adapter:owner.adapterInfo,hostFutureRuntimeInput:false,hardwarePerformance:false,sourceF32UniversallyQualified:false,runs:[]};
 mkdirSync(artifactDir,{recursive:true});writeFileSync(artifactDir+'/source.wgsl',fixture.source);writeFileSync(artifactDir+'/vm.wgsl',shader);writeFileSync(artifactDir+'/program.bin',p.instructions);initial.forEach((b,i)=>writeFileSync(artifactDir+'/binding-'+i+'.bin',b));writeFileSync(artifactDir+'/manifest.json',JSON.stringify({...report,options},null,2));
 assert.ok(workgroupSize<=device.limits.maxComputeInvocationsPerWorkgroup&&workgroupSize<=device.limits.maxComputeWorkgroupSizeX,'Explicit workgroup fits actual adapter limits');let scoped=true;device.pushErrorScope('validation');
 try{
  let at=performance.now();const module=device.createShaderModule({code:shader,label:'authentic query scalar microcode'}),info=await module.getCompilationInfo();assert.deepEqual(info.messages.filter(x=>x.type==='error').map(x=>`${x.lineNum}:${x.linePos} ${x.message}`),[]);report.preflightMs=performance.now()-at;trace(JSON.stringify({stage:'point-microcode-preflight',...report,runs:undefined}));
  const groupLayout=device.createBindGroupLayout({entries:['storage','read-only-storage','read-only-storage','storage','read-only-storage','read-only-storage','storage'].map((type,binding)=>({binding,visibility:4,buffer:{type}}))}),pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[groupLayout]});at=performance.now();const begin=await device.createComputePipelineAsync({layout:pipelineLayout,compute:{module,entryPoint:'begin'}}),step=await device.createComputePipelineAsync({layout:pipelineLayout,compute:{module,entryPoint:'main'}});report.compileMs=performance.now()-at;trace(JSON.stringify({stage:'point-microcode-pipelines-ready',compileMs:report.compileMs}));
  for(let run=1;run<=runs;run++){
   const owned=[],make=(words,usage,label)=>{const b=device.createBuffer({size:words*4,usage,label});owned.push(b);return b;};let submitted=false;
   try{
    const endToEndAt=performance.now(),allocationAt=performance.now(),buffers=initial.map((b,i)=>make(b.length,128|4|8,'original source binding '+i)),program=make(p.instructions.length,128|8,'immutable scalar code'),vm=make(layout.totalWords,128|4|8,'candidate VM continuation'),read=make(initial[0].length+layout.totalWords,1|8,'final-only query verification');const allocationMs=performance.now()-allocationAt;
    at=performance.now();initial.forEach((b,i)=>device.queue.writeBuffer(buffers[i],0,b));device.queue.writeBuffer(program,0,p.instructions);const uploadMs=performance.now()-at;at=performance.now();await device.queue.onSubmittedWorkDone();const uploadDrainWallMs=performance.now()-at;
    const group=device.createBindGroup({layout:groupLayout,entries:[...buffers,program,vm].map((buffer,binding)=>({binding,resource:{buffer}}))}),encodeAt=performance.now(),encoder=device.createCommandEncoder({label:'fixed 12-query resident chunks'});
    for(const pipeline of[begin,...Array(chunks).fill(step)]){const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(workgroups);pass.end();}
    const command=encoder.finish(),encodeMs=performance.now()-encodeAt;at=performance.now();device.queue.submit([command]);submitted=true;const submitMs=performance.now()-at;at=performance.now();await device.queue.onSubmittedWorkDone();const queueDrainWallMs=performance.now()-at;
    const readAt=performance.now(),copyEncoder=device.createCommandEncoder();copyEncoder.copyBufferToBuffer(buffers[0],0,read,0,initial[0].byteLength);copyEncoder.copyBufferToBuffer(vm,0,read,initial[0].byteLength,layout.totalWords*4);device.queue.submit([copyEncoder.finish()]);await read.mapAsync(1);const words=new Uint32Array(read.getMappedRange().slice(0));read.unmap();const readbackMs=performance.now()-readAt,endToEndMs=performance.now()-endToEndAt;
    const output=words.subarray(0,initial[0].length),controls=words.subarray(initial[0].length);for(let lane=0;lane<count;lane++){const base=lane*layout.stride;assert.equal(controls[base+I.control.status],I.status.complete,'every original query completed; no incomplete/miss substitution');assert.equal(controls[base+I.control.error],0);}assertMicrocodePointFixture(fixture,output);
    if(run>1)assert.deepEqual(words,report.firstWords,'fresh initial buffers reproduce every source/VM word');else report.firstWords=words.slice();writeFileSync(artifactDir+'/actual-'+run+'.bin',words);
    const row={run,allocationMs,uploadMs,uploadDrainWallMs,encodeMs,submitMs,queueDrainWallMs,readbackMs,endToEndMs,dispatches:chunks+1,submissions:2,finalMappings:1,initialWrites:6,outputSha256:sha(words),steps:Array.from({length:count},(_,lane)=>controls[lane*layout.stride+I.control.stepsLow]),parity:'exact independent original query projection/features and complete VM status'};report.runs.push(row);trace(JSON.stringify({stage:'point-microcode-run-pass',...row}));
   }finally{if(submitted)await device.queue.onSubmittedWorkDone();for(const b of owned)b.destroy();}
  }
  assert.equal(await device.popErrorScope(),null);scoped=false;delete report.firstWords;report.passed=true;writeFileSync(artifactDir+'/report.json',JSON.stringify(report,null,2));return report;
 }finally{if(scoped)await device.popErrorScope();}
}

test('native original twelve-query point fixture preserves source semantics through retained microcode chunks',async t=>{
 if(process.env.REQUIRE_WEBGPU!=='1')return t.skip('Coordinator exclusive numerical slot required');const fixture=await createMicrocodePointFixture(),owner=await createNativeOwner('resident-compact-microcode-point');try{const report=await runMicrocodePointNative({owner,fixture,workgroupSize:Number(process.env.MICROCODE_TEST_WORKGROUP_SIZE??1)});console.log(JSON.stringify({stage:'native-original-point-microcode-pass',...report}));}finally{owner.release();}
});
