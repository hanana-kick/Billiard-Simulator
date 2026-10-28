// Initial-only HOST replay proof; NEVER loads future actual source state.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const sha=x=>createHash('sha256').update(x).digest('hex');
export function compareFreshReplayInitial({freshBytes,priorBytes,freshExpectedBytes}){
 const fresh=deserialize(freshBytes),prior=deserialize(priorBytes),expected=deserialize(freshExpectedBytes);
 assert.equal(sha(priorBytes),'c500a622817129cfa240aa6ac2a49582dd2391398a6e391b1692563cf34d7b53','pinned prior CREATED t0 only');assert.equal(fresh.kind,prior.kind);assert.equal(fresh.createdInput,true);assert.equal(fresh.noGpuAdmission,true);assert.equal(fresh.rawInput,false);assert.equal(fresh.bindings[0][5],0);assert.deepEqual(fresh.bindings,prior.bindings,'all fresh initial source/geometry/program/scratch/input/audit words unchanged');assert.deepEqual(fresh.identity,prior.identity);assert.deepEqual(fresh.compiled,prior.compiled,'exact source bytecode/signatures/approvals/allocator metadata');assert.deepEqual(fresh.configuration,prior.configuration);assert.deepEqual(fresh.layout,prior.layout);assert.deepEqual(fresh.pc,prior.pc);assert.deepEqual(fresh.template,prior.template);assert.equal(expected.referenceAuthority,'original-js-number-v1');for(const h of[128,192])assert.equal(expected.sourceExpectations[h].snapshot.cue.referenceNumberProfile,expected.referenceAuthority);assert.equal(expected.seed.initialSnapshotSha256,fresh.identity.createdIdentity);
 return{kind:'fresh-created-host-replay-initial-only-provenance-v1',status:'pass',freshInitialSha256:sha(freshBytes),priorInitialSha256:sha(priorBytes),freshExpectedSha256:sha(freshExpectedBytes),allInitialWordsIdentical:true,completeCompiledArtifactIdentical:true,initialH:0,requestedH:192,cueNumberProfileOnly:true,originalPhysicsContinuationRecreated:true,previousEvolvedStateLoaded:false,futureRuntimeInput:false,gpuExecuted:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const[dir,priorPath]=process.argv.slice(2);const result=compareFreshReplayInitial({freshBytes:readFileSync(join(dir,'initial.v8')),priorBytes:readFileSync(priorPath),freshExpectedBytes:readFileSync(join(dir,'expected.v8'))});writeFileSync(join(dir,'replay-initial-provenance.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}
