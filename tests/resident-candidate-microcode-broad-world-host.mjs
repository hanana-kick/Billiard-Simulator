// HOST ONLY paired source/split transport comparison. No expected future buffer
// enters either runtime. Arithmetic TEST primitives are shared deliberately;
// actual original CPU all11 world comparisons remain independent after each run.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {profileCreatedMicrocodeWorld} from './resident-candidate-microcode-world-host.mjs';
const prefix='/tmp/resident-microcode-broad-pair',sourceTrace=prefix+'-source.v8',externalTrace=prefix+'-external.v8';
const common={frames:2,instructionBudget:65536,maxChunks:512,allocation:'call-frames-v1',additionalHandoffFunctions:['rc_world_broad_commit_collision'],trace:x=>{if(x.stage==='compiled'||x.stage==='terminal-host-profile')console.log(JSON.stringify({stage:x.stage,externalFunctions:x.externalFunctions,worldH:x.worldH,sourceParity:x.sourceParity,scalarInstructions:x.scalarInstructions,chunks:x.chunks,hostWallMs:x.hostWallMs}));}};
const source=await profileCreatedMicrocodeWorld({...common,intrinsics:'none',externalFunctions:['rc_cue_flat_advance','rc_num_eval'],handoffTracePath:sourceTrace,artifactPath:prefix+'-source'});
assert.equal(source.sourceParity,'all11-source-groups-exact');
const external=await profileCreatedMicrocodeWorld({...common,intrinsics:'none',externalFunctions:['rc_cue_flat_advance','rc_num_eval','rc_world_broad_commit_collision'],handoffTracePath:externalTrace,artifactPath:prefix+'-external'});
assert.equal(external.sourceParity,'all11-source-groups-exact');
const a=deserialize(readFileSync(sourceTrace)),b=deserialize(readFileSync(externalTrace));assert.equal(a.kind,b.kind);assert.equal(a.sourceSha256,b.sourceSha256);assert.equal(a.handoffs.length,147);assert.equal(b.handoffs.length,a.handoffs.length);
for(let i=0;i<a.handoffs.length;i++)assert.deepEqual(b.handoffs[i],a.handoffs[i],'ordered complete source/scratch/args/return boundary '+i);
const counts=Object.fromEntries(['rc_cue_flat_advance','rc_num_eval','rc_world_broad_commit_collision'].map(name=>[name,b.handoffs.filter(x=>x.name===name).length])),summary={scope:'HOST-only original-created2h scalar broad versus external broad transport',status:'pass',coreInstructionReduction:Number(source.scalarInstructions)-Number(external.scalarInstructions),coreInstructionReductionShare:1-Number(external.scalarInstructions)/Number(source.scalarInstructions),handoffs:147,counts,allStateAndDirtyScratchWordsEqual:true,argumentAndReturnWordsEqual:true,cueAndBroadBeforeWordsEqual:true,voidReturnHasZeroWords:true,broadHandoffs:2,arithmeticReferenceShared:true,independentOriginalCpuComparisons:['source all11 exact','external all11 exact'],originalDtAndSourceBudgetsUnchanged:true,expectedFutureRuntimeInput:false,rawInput:false,gpuExecuted:false,fullRest:false,source:{steps:source.scalarInstructions,pumps:source.chunks,hostWallMs:source.hostWallMs},external:{steps:external.scalarInstructions,pumps:external.chunks,vmYields:external.vmYields,handoffs:external.externalCalls,hostWallMs:external.hostWallMs},traces:[sourceTrace,externalTrace].map(path=>({path,bytes:statSync(path).size,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))};
assert.equal(counts.rc_world_broad_commit_collision,2);for(const handoff of b.handoffs.filter(x=>x.name==='rc_world_broad_commit_collision'))assert.equal(handoff.result.length,0);
writeFileSync(prefix+'.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
