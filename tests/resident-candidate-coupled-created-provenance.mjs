// Initial-only comparison for the optional lowering. No evolved continuation
// or expected physics words are ever substituted into the newly prepared t0.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertCreatedMacroSelection,COUPLED_MACRO_PROFILE,assertMatchingMacroProfiles} from './resident-candidate-macro-profile-contract.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const omit=(x,keys)=>Object.fromEntries(Object.entries(x).filter(([key])=>!keys.includes(key)));
export function compareCoupledCreatedInitial({freshBytes,priorBytes,freshExpectedBytes}){
 assert.equal(sha(priorBytes),'c500a622817129cfa240aa6ac2a49582dd2391398a6e391b1692563cf34d7b53','pinned genuine CREATED t0 input, not a continuation');
 const fresh=deserialize(freshBytes),prior=deserialize(priorBytes),expected=deserialize(freshExpectedBytes);
 assert.deepEqual(Object.keys(fresh).sort(),[...Object.keys(prior),'macroProfile'].sort(),'initial-only schema; no hidden VM continuation/future state');
 assert.equal(fresh.kind,prior.kind);assert.equal(fresh.createdInput,true);assert.equal(fresh.noGpuAdmission,true);assert.equal(fresh.rawInput,false);assert.equal(assertMatchingMacroProfiles(fresh,fresh.identity),COUPLED_MACRO_PROFILE);assertCreatedMacroSelection(fresh);
 assert.equal(fresh.bindings[0][5],0);assert.deepEqual(fresh.bindings,prior.bindings,'every fresh initial state/program/geometry/scratch/input/audit word');
 assert.deepEqual(omit(fresh.identity,['macroProfile','bytecodeSha256','historicalSourceAndBytecodeExactlyEqual']),omit(prior.identity,['bytecodeSha256','historicalSourceAndBytecodeExactlyEqual']),'all unchanged initial physical authority');
 assert.equal(fresh.identity.historicalSourceAndBytecodeExactlyEqual,false);assert.equal(fresh.compiled.sourceSha256,prior.compiled.sourceSha256);assert.equal(sha(fresh.compiled.instructions),fresh.identity.bytecodeSha256);assert.notEqual(fresh.identity.bytecodeSha256,prior.identity.bytecodeSha256,'new lowering is explicit, not relabeled old VM state');
 assert.deepEqual(omit(fresh.configuration,['instructionCount','externalFunctions','initialSlots']),omit(prior.configuration,['instructionCount','externalFunctions','initialSlots']),'same logical lanes, limits, controls, entry and numerical profile');
 const root=fresh.compiled.functions.find(x=>x.name===fresh.compiled.entryFunction);assert.equal(root.params.length,1);assert.equal(root.params[0].words,3);assert.deepEqual(fresh.configuration.initialSlots,[{slot:root.params[0].slot,candidateStride:1},{slot:root.params[0].slot+1,value:0},{slot:root.params[0].slot+2,value:0}]);
 for(const key of['layout','pc','template'])assert.deepEqual(fresh[key],prior[key],key+' is unchanged initial input');
 assert.equal(expected.referenceAuthority,'original-js-number-v1');for(const h of[128,192])assert.equal(expected.sourceExpectations[h].snapshot.cue.referenceNumberProfile,expected.referenceAuthority);assert.equal(expected.seed.initialSnapshotSha256,fresh.identity.createdIdentity);assert.deepEqual(expected.seed.initialEventHistory,expected.nativeEvidence.initial.events);
 return{kind:'coupled-created-t0-initial-provenance-v1',status:'pass',freshInitialSha256:sha(freshBytes),priorInitialSha256:sha(priorBytes),freshExpectedSha256:sha(freshExpectedBytes),allInitialWordsIdentical:true,compiledArtifactIdentical:false,explicitSourceMacroProfile:COUPLED_MACRO_PROFILE,exactUnchangedWgslSource:true,initialH:0,requestedH:192,previousEvolvedStateLoaded:false,oldVmStateRelocated:false,futureRuntimeInput:false,gpuExecuted:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const[dir,prior]=process.argv.slice(2);const r=compareCoupledCreatedInitial({freshBytes:readFileSync(join(dir,'initial.v8')),priorBytes:readFileSync(prior),freshExpectedBytes:readFileSync(join(dir,'expected.v8'))});writeFileSync(join(dir,'initial-provenance.json'),JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(r));}
