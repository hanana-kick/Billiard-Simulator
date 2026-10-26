// Native component gate. Initial-only source buffers are retained through
// logical first/mid/final continuations; expected CPU snapshots are never uploaded.
import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {mkdirSync,writeFileSync} from 'node:fs';
import {createMicrocodeContinuationFixture,run as scalarRun} from './resident-candidate-microcode-continuation-fixture.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {sourceIntrinsicNativeWGSL,MICROCODE_SOURCE_INTRINSICS} from '../src/resident-candidate/microcode-source-intrinsics.mjs';
import {generateMicrocodeVmWGSL,microcodeVmLayout} from '../src/resident-candidate/microcode-vm.mjs';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
import {createNativeOwner} from './resident-candidate-gpu-support.mjs';
const clone=b=>b.map(x=>x.slice()),sha=x=>createHash('sha256').update(x).digest('hex');
export function prepareNativeContinuationFixture(){
 const f=createMicrocodeContinuationFixture(),byName=new Map(f.rows.map(r=>[r.name,r])),used=new Set(),groups=[];
 const add=(name,names)=>{const rows=names.map(n=>{assert.ok(byName.has(n),n);used.add(n);return byName.get(n);});for(const r of rows)assert.deepEqual(r.args,rows[0].args);groups.push({name,args:rows[0].args,initial:clone(rows[0].bindings),expected:rows.map(r=>({bindings:clone(r.expected.bindings),status:r.expected.status}))});};
 for(const name of['normal','subnormal','signed-zero'])add('numeric-'+name,['first','final','prior-terminal'].map(step=>'numeric-'+name+'-'+step));
 add('source-call-return',[0,1,2,3].map(i=>'source-call-return-'+i));
 // Malformed final-output fixture originally names a mid-node snapshot. Rebuild
 // its initial control from the original first fixture, then execute both nodes
 // on GPU. The source program mutation is an initial malformed-input case.
 const bad=byName.get('numeric-final-output-malformed'),fresh=clone(byName.get('numeric-normal-first').bindings);fresh[1]=bad.bindings[1].slice();const work=clone(fresh),expected=[];for(let n=0;n<2;n++){const q=scalarRun(f.entry,bad.args,work);expected.push({bindings:clone(work),status:q.status});}assert.deepEqual(work,bad.expected.bindings);used.add(bad.name);groups.push({name:bad.name,args:bad.args,initial:fresh,expected});
 for(const r of f.rows)if(!used.has(r.name))add(r.name,[r.name]);
 const prefix='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;@group(0) @binding(4) var<storage,read> rc_inputs:array<u32>;',source=prefix+sourceIntrinsicNativeWGSL('source-continuations-v1')+'fn main()->u32{if(rc_inputs[0]==0u){return rc_num_cont_instruction(rc_inputs[3]);}return rc_source_program_instruction(rc_inputs[1],rc_inputs[2],rc_inputs[3]);}',compiled=compileMicrocodeWGSL(source,{intrinsics:'source-continuations-v1'}),root=compiled.functions.find(x=>x.name==='main');
 for(const g of groups){g.initial[4]=Uint32Array.from(g.args);for(const e of g.expected)e.bindings[4]=Uint32Array.from(g.args);}
 return{source,compiled,root,groups,rows:f.rows.length,logicalCalls:groups.reduce((n,g)=>n+g.expected.length,0)};
}

test('native original numeric and source continuations preserve every source word through retained checkpoints',async t=>{
 if(process.env.REQUIRE_WEBGPU!=='1')return t.skip('Coordinator exclusive numerical slot required');
 const f=prepareNativeContinuationFixture(),p=f.compiled,intrinsicFunctions=[...new Set(Array.from({length:p.instructions.length/8},(_,i)=>MICROCODE_SOURCE_INTRINSICS.find(d=>I.opcodes[d.opcode]===p.instructions[i*8])?.name).filter(Boolean))];assert.deepEqual([...intrinsicFunctions].sort(),['rc_num_cont_instruction','rc_source_program_instruction']);const options={count:1,localWords:p.localWords,stackCapacity:Math.max(1,p.callDepth),instructionCount:p.instructions.length/8,entryPc:p.entryPc,intrinsics:p.intrinsicProfile,intrinsicFunctions,workgroupSize:64,instructionBudget:1},chunks=128,layout=microcodeVmLayout(options),shader=generateMicrocodeVmWGSL(options),artifactDir=process.env.MICROCODE_CONT_ARTIFACT_DIR??'/tmp/resident-microcode-continuation-native-artifact';
 assert.ok(p.instructions.some((v,i)=>i%8===0&&v===I.opcodes.NUM_CONT_INSTRUCTION));assert.ok(p.instructions.some((v,i)=>i%8===0&&v===I.opcodes.SOURCE_PROGRAM_INSTRUCTION));
 const identity={sourceSha256:sha(f.source),programSha256:sha(p.instructions),shaderSha256:sha(shader),rows:f.rows,groups:f.groups.length,logicalCalls:f.logicalCalls,options,chunks,shaderBytes:shader.length,sourceCapsUnchanged:true,scope:'original continuation component, not whole world/strike/full-rest',futureSnapshotsUploaded:false,hardwarePerformance:false};mkdirSync(artifactDir,{recursive:true});writeFileSync(artifactDir+'/source.wgsl',f.source);writeFileSync(artifactDir+'/vm.wgsl',shader);writeFileSync(artifactDir+'/program.bin',p.instructions);writeFileSync(artifactDir+'/manifest.json',JSON.stringify(identity,null,2));
 const owner=await createNativeOwner('resident-source-continuation-intrinsics'),device=owner.device;let scoped=true;device.pushErrorScope('validation');
 try{
  assert.ok(device.limits.maxComputeInvocationsPerWorkgroup>=64&&device.limits.maxComputeWorkgroupSizeX>=64);let at=performance.now();const module=device.createShaderModule({code:shader}),info=await module.getCompilationInfo();assert.deepEqual(info.messages.filter(m=>m.type==='error').map(m=>`${m.lineNum}:${m.linePos} ${m.message}`),[]);const preflightMs=performance.now()-at;console.log(JSON.stringify({stage:'continuation-preflight-pass',...identity,preflightMs,adapter:owner.adapterInfo}));
  const groupLayout=device.createBindGroupLayout({entries:['storage','read-only-storage','read-only-storage','storage','read-only-storage','read-only-storage','storage'].map((type,binding)=>({binding,visibility:4,buffer:{type}}))}),pl=device.createPipelineLayout({bindGroupLayouts:[groupLayout]});at=performance.now();console.log(JSON.stringify({stage:'continuation-begin-pipeline-start'}));const begin=await device.createComputePipelineAsync({layout:pl,compute:{module,entryPoint:'begin'}});console.log(JSON.stringify({stage:'continuation-main-pipeline-start'}));const step=await device.createComputePipelineAsync({layout:pl,compute:{module,entryPoint:'main'}}),compileMs=performance.now()-at;console.log(JSON.stringify({stage:'continuation-pipelines-ready',compileMs}));
  const runs=[];let firstWords;
  for(let run=1;run<=3;run++){
   const owned=[],make=(words,usage)=>{const b=device.createBuffer({size:words*4,usage});owned.push(b);return b;};let submitted=false;
   try{
    const e2e=performance.now(),program=make(p.instructions.length,128|8);device.queue.writeBuffer(program,0,p.instructions);let total=0;
    const rows=f.groups.map(g=>{const buffers=g.initial.map(a=>{const b=make(a.length,128|4|8);device.queue.writeBuffer(b,0,a);return b;}),vm=make(layout.totalWords,128|4|8),size=g.initial.reduce((n,a)=>n+a.length,0)+layout.totalWords,offset=total;total+=size*g.expected.length;return{g,buffers,vm,size,offset,group:device.createBindGroup({layout:groupLayout,entries:[...buffers,program,vm].map((buffer,binding)=>({binding,resource:{buffer}}))})};});
    const read=make(total,1|8);await device.queue.onSubmittedWorkDone();const encodeAt=performance.now(),encoder=device.createCommandEncoder();let dispatches=0;
    for(const row of rows)for(let call=0;call<row.g.expected.length;call++){
     for(const pipeline of[begin,...Array(chunks).fill(step)]){const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,row.group);pass.dispatchWorkgroups(1);pass.end();dispatches++;}
     let offset=row.offset+call*row.size;row.buffers.forEach((b,i)=>{encoder.copyBufferToBuffer(b,0,read,offset*4,row.g.initial[i].byteLength);offset+=row.g.initial[i].length;});encoder.copyBufferToBuffer(row.vm,0,read,offset*4,layout.totalWords*4);
    }
    const command=encoder.finish(),encodeMs=performance.now()-encodeAt;at=performance.now();device.queue.submit([command]);submitted=true;const submitMs=performance.now()-at;at=performance.now();await device.queue.onSubmittedWorkDone();const queueDrainWallMs=performance.now()-at;at=performance.now();await read.mapAsync(1);const words=new Uint32Array(read.getMappedRange().slice(0));read.unmap();const mapAndCopyMs=performance.now()-at,endToEndMs=performance.now()-e2e;
    for(const row of rows)for(let call=0;call<row.g.expected.length;call++){let offset=row.offset+call*row.size;const expected=row.g.expected[call];for(let i=0;i<5;i++){const count=expected.bindings[i].length;assert.deepEqual(words.subarray(offset,offset+count),expected.bindings[i],`${row.g.name} call${call} full source binding${i}`);offset+=count;}assert.equal(words[offset+I.control.status],I.status.complete,`${row.g.name} transport complete`);assert.equal(words[offset+I.control.error],0);assert.equal(words[offset+layout.localsOffset+f.root.returnSlot],expected.status,`${row.g.name} source return status`);}
    if(firstWords)assert.deepEqual(words,firstWords,'fresh warm buffers every source/VM word');else firstWords=words.slice();writeFileSync(artifactDir+'/actual-'+run+'.bin',words);const result={run,dispatches,submissions:1,finalMappings:1,sourceLogicalCalls:f.logicalCalls,encodeMs,submitMs,queueDrainWallMs,mapAndCopyMs,endToEndMs,outputSha256:sha(words),passed:true};runs.push(result);console.log(JSON.stringify({stage:'continuation-run-pass',...result}));
   }finally{if(submitted)await device.queue.onSubmittedWorkDone();for(const b of owned)b.destroy();}
  }
  assert.equal(await device.popErrorScope(),null);scoped=false;const report={...identity,adapter:owner.adapterInfo,preflightMs,compileMs,runs,passed:true};writeFileSync(artifactDir+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({stage:'native-continuation-intrinsics-pass',...report}));
 }finally{if(scoped)await device.popErrorScope();owner.release();}
});
