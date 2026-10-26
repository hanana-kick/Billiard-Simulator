// HOST ONLY paired source/split transport comparison. No expected future buffer
// enters either runtime. Arithmetic TEST primitives are shared deliberately;
// actual original CPU all11 world comparisons remain independent after each run.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {profileCreatedMicrocodeWorld} from './resident-candidate-microcode-world-host.mjs';
const prefix='/tmp/resident-microcode-external-pair',sourceTrace=prefix+'-source.v8',externalTrace=prefix+'-external.v8';
const common={frames:2,instructionBudget:65536,maxChunks:512,allocation:'call-frames-v1',trace:x=>{if(x.stage==='compiled'||x.stage==='terminal-host-profile')console.log(JSON.stringify({stage:x.stage,externalFunctions:x.externalFunctions,worldH:x.worldH,sourceParity:x.sourceParity,scalarInstructions:x.scalarInstructions,chunks:x.chunks,hostWallMs:x.hostWallMs}));}};
const source=await profileCreatedMicrocodeWorld({...common,intrinsics:'source-continuations-v1',intrinsicFunctions:['rc_num_eval','rc_num_cont_instruction','rc_source_program_instruction'],handoffTracePath:sourceTrace,artifactPath:prefix+'-source'});
assert.equal(source.sourceParity,'all11-source-groups-exact');
const external=await profileCreatedMicrocodeWorld({...common,intrinsics:'none',externalFunctions:['rc_cue_flat_advance','rc_num_eval'],handoffTracePath:externalTrace,artifactPath:prefix+'-external'});
assert.equal(external.sourceParity,'all11-source-groups-exact');
const a=deserialize(readFileSync(sourceTrace)),b=deserialize(readFileSync(externalTrace));assert.equal(a.kind,b.kind);assert.equal(a.sourceSha256,b.sourceSha256);assert.equal(a.handoffs.length,145);assert.equal(b.handoffs.length,a.handoffs.length);
for(let i=0;i<a.handoffs.length;i++)assert.deepEqual(b.handoffs[i],a.handoffs[i],'ordered complete source/scratch/args/return boundary '+i);
const counts=Object.fromEntries(['rc_cue_flat_advance','rc_num_eval'].map(name=>[name,b.handoffs.filter(x=>x.name===name).length])),summary={scope:'HOST-only original-created2h source-versus-external-macro transport',status:'pass',handoffs:145,counts,allStateAndDirtyScratchWordsEqual:true,argumentAndReturnWordsEqual:true,cueBeforeWordsEqual:true,arithmeticReferenceShared:true,independentOriginalCpuComparisons:['source all11 exact','external all11 exact'],originalDtAndSourceBudgetsUnchanged:true,expectedFutureRuntimeInput:false,rawInput:false,gpuExecuted:false,fullRest:false,source:{steps:source.scalarInstructions,pumps:source.chunks,hostWallMs:source.hostWallMs},external:{steps:external.scalarInstructions,pumps:external.chunks,vmYields:external.vmYields,handoffs:external.externalCalls,hostWallMs:external.hostWallMs},traces:[sourceTrace,externalTrace].map(path=>({path,bytes:statSync(path).size,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))};
writeFileSync(prefix+'.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
