// HOST ONLY created-input integration/profiling. This is NOT raw-row GPU proof.
// The source canonical cue bridge and source PC begin execute as microcode;
// no handcrafted post-creation defaults or CPU future state enter the runtime.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {serialize,deserialize} from 'node:v8';
import {packCreatedWorldTemplate} from '../src/resident-candidate/world-state.mjs';
import {NUMERIC_PROFILE} from '../src/resident-candidate/numeric-profile.mjs';
import {generateWorldHPlan} from '../src/resident-candidate/world-h.mjs';
import {compileWorldDevicePc} from '../src/resident-candidate/world-device-pc.mjs';
import {compileWorldSourceOwners} from '../src/resident-candidate/world-owners.mjs';
import {composeWorldMicrocodeSource} from '../src/resident-candidate/world-microcode-source.mjs';
import {generateCueCanonicalBridgeWGSL} from '../src/resident-candidate/cue-bridge.mjs';
import {linkResidentWGSL} from '../src/resident-candidate/wgsl-linker.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {microcodeIntrinsicReference} from './resident-candidate-microcode-intrinsic-reference.mjs';
import {createWholeHOracle,DEFAULT_WHOLE_H_RULE,compareWorldBank,projectWorldComparison,firstWorldMismatch} from './resident-candidate-whole-h-fixture.mjs';
const positive=(x,name)=>assert.ok(Number.isInteger(x)&&x>0&&x<=0xffffffff,name+' explicit positive bound');
export async function profileCreatedMicrocodeWorld({frames=2,instructionBudget=65536,maxChunks=512,trace=()=>{},artifactPath='/tmp/resident-microcode-world-host-actual.bin',checkpointPath='/tmp/resident-microcode-world-host-continuation.v8',resumePath=null,intrinsics='none'}={}){
 positive(frames,'source h');positive(instructionBudget,'microinstruction chunk');positive(maxChunks,'maximum chunks');
 const oracle=await createWholeHOracle();
 try{
  const template=await packCreatedWorldTemplate(oracle.seed,{rule:DEFAULT_WHOLE_H_RULE}),source=generateWorldHPlan(template,{count:1,numericProfile:NUMERIC_PROFILE.PRESERVED_F32,cueTransport:'flat',coupledTransport:'micro',applicationTransport:'staged',ccdTransport:'staged',queryTransport:'staged'}),phase=compileWorldDevicePc(source,{programBase:template.program.length,controlTailBase:template.state.length+template.fixedCcd.length,maxH:frames}),pc=compileWorldSourceOwners(template,source,phase,{controlVisitPolicy:'single-call',controlPartition:'source-closures-v1'}),composed=composeWorldMicrocodeSource(pc);
  const signature='@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>)';assert.equal(pc.begin.code.split(signature).length,2);
  const begin=pc.begin.code.replace(signature,'fn rc_micro_host_source_begin(gid:vec3<u32>)');
  const entry='rc_micro_host_created_run',bridge=`fn ${entry}(gid:vec3<u32>){if(gid.x>=1u){return;}let b=gid.x*${template.state.length}u;let status=rc_cue_to_canonical(b+${template.segments.cue.offset}u,b+${template.segments.bodies.offset}u);rc_state[b+2u]=select(4u,1u,status==1u);rc_micro_host_source_begin(gid);${composed.entry}(gid);}`;
  const code=linkResidentWGSL([composed.code,generateCueCanonicalBridgeWGSL(),begin,bridge],{entry}).code,compiled=compileMicrocodeWGSL(code,{entry,intrinsics}),bytecodeSha256=createHash('sha256').update(compiled.instructions).digest('hex'),gid=compiled.functions.find(f=>f.name===entry).params[0];
  const state=new Uint32Array(pc.totalStateWords);state.set(template.state);state.set(template.fixedCcd,template.state.length);const program=new Uint32Array(template.program.length+pc.bytecode.length);program.set(template.program);program.set(pc.bytecode,pc.programBase);
  const bindings=[state,program,template.sharedGeometry,new Uint32Array(template.numericScratchWords),new Uint32Array(16)];let prior=null;if(resumePath){prior=deserialize(readFileSync(resumePath));assert.equal(prior.kind,'host-only-microcode-created-profile-continuation-v1');assert.equal(prior.noGpuAdmission,true);assert.equal(prior.sourceSha256,compiled.sourceSha256);assert.equal(prior.bytecodeSha256,bytecodeSha256);assert.equal(prior.intrinsics,intrinsics);assert.equal(prior.sourceIdentity,template.sourceIdentity);assert.equal(prior.frames,frames);for(const i of[1,2,4])assert.deepEqual(prior.bindings[i],bindings[i],'immutable source binding '+i);for(const i of[0,3]){assert.equal(prior.bindings[i].length,bindings[i].length);bindings[i].set(prior.bindings[i]);}}const intrinsicCalls={},intrinsicGraphNodes={};const intrinsicHandler=(spec,args,context)=>{intrinsicCalls[spec.name]=(intrinsicCalls[spec.name]??0)+1;if(spec.name==='rc_num_eval'){const base=args[0][0],nodes=context.bindings[1][base+6]??0;intrinsicGraphNodes[base]=(intrinsicGraphNodes[base]??0)+nodes;}return microcodeIntrinsicReference(spec,args,context);};const vm=createMicrocodeVmReferenceForTest({testOnly:true,code:compiled.instructions,intrinsics,intrinsicHandler,count:1,localWords:compiled.localWords,stackCapacity:compiled.callDepth,entryPc:compiled.entryPc,bindings,initialSlots:[0,1,2].map(i=>({slot:gid.slot+i,value:0})),...(prior?{state:prior.vmState}:{} )});
  const metadata={scope:'host-only-created-source-world-microcode',createdInput:true,rawInput:false,frames,instructionBudget,maxChunks,intrinsics,bytecodeSha256,sourceSha256:compiled.sourceSha256,sourceIdentity:template.sourceIdentity,instructions:compiled.instructions.length/8,localWords:compiled.localWords,callDepth:compiled.callDepth,functions:compiled.functions.length,originalOwnerCount:pc.pipelines.length,expectedFutureRuntimeInput:false,gpuExecuted:false,fullRest:false,hardwarePerformance:false};
  trace({stage:'compiled',...metadata,resumedHostOnly:!!prior});if(!prior)vm.begin();let status=1,chunks=0;const at=performance.now();
  while(status===1&&chunks<maxChunks){status=vm.advance(0,instructionBudget);chunks++;if(chunks%16===0||status!==1){const currentPc=vm.state[4],fn=compiled.functions.filter(f=>f.entryPc<=currentPc).at(-1)?.name,graph=compiled.functions.find(f=>f.name==='rc_num_eval'),graphBase=graph?vm.local(0,graph.params[0].slot):0,originalPipeline=program[pc.programBase+state[pc.controlTailBase+2]*4+1];trace({stage:'host-continuation',chunks,stepsLow:vm.state[6],stepsHigh:vm.state[7],vmStatus:status,vmError:vm.state[3],sourceFunction:fn,sourcePhase:source.pipelines[originalPipeline]?.name,numericGraph:{base:graphBase,header:Array.from(program.slice(graphBase,graphBase+12))},worldH:state[5],worldStatus:state[2],worldPcStatus:state[pc.controlTailBase+4],worldPc:state[pc.controlTailBase+2],elapsedWallMs:performance.now()-at});}}
  const result={...metadata,status:status===1?'incomplete':status===2?'completed':status===4?'unsupported':'invalid',vmStatus:status,vmError:vm.state[3],worldStatus:state[2],worldReason:state[3],worldH:state[5],chunks,totalChunks:(prior?.totalChunks??0)+chunks,scalarInstructions:String(BigInt(vm.state[7])*4294967296n+BigInt(vm.state[6])),hostWallMs:performance.now()-at,priorHostWallMs:prior?.totalHostWallMs??0,sourceParity:'pending',intrinsicCalls,intrinsicGraphNodes,worldControl:Array.from(state.slice(pc.controlTailBase,pc.controlTailBase+16))};
  if(status===1){result.sourceParity='pending-incomplete';writeFileSync(checkpointPath,serialize({kind:'host-only-microcode-created-profile-continuation-v1',noGpuAdmission:true,frames,intrinsics,bytecodeSha256,sourceSha256:compiled.sourceSha256,sourceIdentity:template.sourceIdentity,bindings,vmState:vm.state,totalChunks:result.totalChunks,totalHostWallMs:result.hostWallMs+result.priorHostWallMs}));result.hostOnlyContinuationPath=checkpointPath;trace({stage:'unfinished-not-miss',...result});return result;}
  if(status!==2){result.sourceParity='failed-before-comparison';writeFileSync(artifactPath,new Uint8Array(state.buffer));writeFileSync(artifactPath+'.json',JSON.stringify(result,null,2));trace({stage:'failed-not-miss',...result});return result;}
  // Independent original CPU futures are first generated AFTER all VM work.
  let expected;for(let h=0;h<frames;h++)expected=await oracle.step();
  try{assert.equal(state[5],frames);assert.equal(state[pc.controlTailBase+4],2);compareWorldBank({words:state,base:0,template,seed:oracle.seed,expected:expected.snapshot,scoring:expected.scoring});result.sourceParity='all11-source-groups-exact';}
  catch(error){const p=projectWorldComparison({words:state,base:0,template,seed:oracle.seed,expected:expected.snapshot,scoring:expected.scoring});result.sourceParity='failed';result.error=error.message;result.differences=Object.keys(p.expected).map(owner=>({owner,mismatch:firstWorldMismatch(p.actual[owner],p.expected[owner],'$.'+owner)}));writeFileSync(artifactPath,new Uint8Array(state.buffer));writeFileSync(artifactPath+'.json',JSON.stringify(result,null,2));}
  // Persist successful evidence too; absence of an error file is not a gate.
  writeFileSync(artifactPath+'.json',JSON.stringify(result,null,2));
  trace({stage:'terminal-host-profile',...result});return result;
 }finally{oracle.dispose();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await profileCreatedMicrocodeWorld({frames:Number(process.env.RESIDENT_MICRO_HOST_H??2),instructionBudget:Number(process.env.RESIDENT_MICRO_HOST_BUDGET??65536),maxChunks:Number(process.env.RESIDENT_MICRO_HOST_CHUNKS??512),resumePath:process.env.RESIDENT_MICRO_HOST_RESUME??null,intrinsics:process.env.RESIDENT_MICRO_HOST_INTRINSICS??'none',trace:x=>console.log(JSON.stringify(x))});
 if(result.status!=='completed'||result.sourceParity!=='all11-source-groups-exact')process.exitCode=2;
}
