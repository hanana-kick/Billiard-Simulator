// TEST ONLY. Read-only authenticated EXPECTATIONS, never runtime future inputs.
// The positive wave report is deliberately not promoted to a native snapshot
// oracle: it stores summary results/hashes, not initial bytes or native frames.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {deserialize} from 'node:v8';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{loadArtifact}=require('./four-ball-goal-artifact.cjs');
const hash=b=>createHash('sha256').update(b).digest('hex'),clone=structuredClone;
const root=new URL('../',import.meta.url);
export const FINAL_OUTCOME_ARTIFACTS=Object.freeze({
 positive:Object.freeze({path:fileURLToPath(new URL('../../billiard-positive-full-rest-gpu-wave/docs/evidence/positive-full-rest-gpu-wave.v8',import.meta.url)),sha256:'bca6a8816f67b33936564a9556538595797587ae63d9dcfd71f473e9e16a8bc1'}),
 lateOpponent:Object.freeze({path:fileURLToPath(new URL('../../billiard-four-ball-goal-evidence/f9a18d6-late-opponent-full.v8',import.meta.url)),sha256:'36558a2590539af234d4791a95f93b1cb3e6cf62b19d966301e0f5c6e5308e0c'}),
});
const timeWords=value=>{const d=new DataView(new ArrayBuffer(8));d.setFloat64(0,value,true);return[d.getUint32(0,true),d.getUint32(4,true)];};
const readPinned=(name,file)=>{const spec=FINAL_OUTCOME_ARTIFACTS[name];assert.ok(spec,'known authentic outcome artifact');const bytes=readFileSync(file??spec.path);assert.equal(hash(bytes),spec.sha256,'exact original outcome artifact bytes');return{bytes,path:file??spec.path,sha256:spec.sha256};};
/** No simulation occurs here. initialOnly() returns copies of authenticated
 * PRESTRIKE/CREATED inputs only. expectedOnly() is explicitly future data and
 * must never be passed to a resident initializer or physics stage. */
export function loadFinalOutcomeFixture(name,{file}={}){
 const pinned=readPinned(name,file);
 if(name==='positive'){
  const r=deserialize(pinned.bytes),manifest=JSON.parse(readFileSync(pinned.path+'.json','utf8'));assert.deepEqual(JSON.parse(JSON.stringify(r)),manifest);
  assert.equal(r.schema,'positive-full-rest-gpu-wave-v1');assert.equal(r.commit,'e0a8275bcaf21c9284ecdf0733fe12698a8855c6');
  for(const[f,sha]of Object.entries(r.sourceHashes))assert.equal(hash(readFileSync(new URL(f,root))),sha,'unchanged original positive source '+f);
  assert.equal(r.accepted,true);assert.equal(r.cpuFullRest,true);assert.equal(r.replay.fullRest,true);assert.equal(r.expected.observedSubsteps,5480);assert.equal(r.replay.steps,5039);
  assert.deepEqual(r.replay.score,{cueId:1,delta:1,nextCue:1});assert.deepEqual(r.source.settings,r.expected.settings);assert.deepEqual(r.source.settings,r.replay.controls);
  const recipe={candidateInput:true,requiresFreshOriginalCapture:true,placements:r.source.placements.map(([id,x,z])=>({id,x,z})),selectedId:1,settings:r.source.settings,settleOuter:r.source.settle,sourceTime:r.source.time,sourceApplicationSteps:r.source.steps,preStrikeSnapshotSha256:r.source.worldSha256,preStrikeApplicationSnapshotSha256:r.source.snapshotSha256,createdSnapshotSha256:r.admission.initialSnapshotSha256,sourceApplication:r.candidateProvenance.sourceApplication,recordedQueryOptions:r.requestOptions};
  const expected={candidateInput:false,kind:'original-cpu-result-and-original-controller-replay-summary',hCount:r.expected.observedSubsteps,outerSteps:r.replay.steps,fullRest:true,score:r.replay.score,finalGame:r.replay.after,physicalContactsRelative:r.expected.physicalResult.contacts,inverseEventCells:r.expected.events,physicalResult:r.expected.physicalResult,nativeFrames:null,nativeEmissions:null,exactNativeRestTime:null};
  return Object.freeze({kind:'resident-expected-only-final-outcome-fixture',name,provenance:Object.freeze({artifactSha256:pinned.sha256,sourceRevision:r.commit,sourceHashes:clone(r.sourceHashes)}),coverage:Object.freeze({initialSnapshotBytes:false,createdSnapshotBytes:false,nativeFrames:false,nativeEmissionJournal:false,exactNativeClocks:false,gpuQualification:false}),inputRecipe:()=>clone(recipe),initialOnly(){const e=new Error('Positive report has hashes only; recreate original controller placement/settling/strike and authenticate initial hashes first');e.code='ORIGINAL_INITIAL_BYTES_UNAVAILABLE';throw e;},expectedOnly:()=>clone(expected)});
 }
 const{record:r,manifest}=loadArtifact(pinned.path);assert.equal(manifest.sha256,pinned.sha256);assert.equal(r.requiredOutcomeObserved,true);assert.equal(r.outcome.lateOpponentFoul,true);assert.equal(r.hCount,5415);
 const input=JSON.parse(readFileSync(new URL('./four-ball-goal-late-opponent-input.json',import.meta.url),'utf8'));assert.deepEqual(r.input,input,'real observed late-opponent layout, not BASE_INPUTS.lateFoul');
 const before=r.boundaries[r.readyBoundary],created=r.boundaries[r.initialBoundary],rest=r.boundaries.physicalRest,finished=r.boundaries.controllerFinished;
 assert.equal(hash(created.snapshot),'56faf7ea3ae80c2a5b7a524f291ebaac405733887843fa6c1fe1c915c4cdc8b0');assert.equal(before.nativeSteps,created.nativeSteps);assert.deepEqual(r.settings,r.control.settings);assert.equal(r.selectedId,1);assert.deepEqual(r.score,{cueId:1,delta:-1,nextCue:2});
 const initial={candidateInput:true,kind:'authenticated-original-prestrike-and-created-only',preStrikeSnapshot:before.snapshot,createdSnapshot:created.snapshot,preStrikeApplication:before.application,createdApplication:created.application,preStrikeSnapshotSha256:hash(before.snapshot),createdSnapshotSha256:hash(created.snapshot),selectedId:r.selectedId,settings:r.control.settings,strikeCreationJournal:r.strikeCreationJournal};
 const recipe={candidateInput:true,requiresFreshOriginalCapture:false,placements:r.input.placements,selectedId:r.selectedId,settings:r.settings,settleOuter:r.settleOuter,sourceTime:before.application.time,sourceApplicationSteps:before.application.steps,preStrikeSnapshotSha256:initial.preStrikeSnapshotSha256,createdSnapshotSha256:initial.createdSnapshotSha256};
 const expected={candidateInput:false,kind:'original-native-full-h-and-emission-journal',hCount:r.hCount,outerSteps:r.firstRestOuter,fullRest:true,score:r.score,finalGame:finished.application.game,exactNativeRestTime:rest.application.time,exactNativeRestTimeWords:timeWords(rest.application.time),nativeFrames:r.frames,nativeEmissions:r.events.map(e=>({...e,timeWords:timeWords(e.event.time)})),restNativeSnapshot:rest.snapshot,outcome:r.outcome};
 return Object.freeze({kind:'resident-expected-only-final-outcome-fixture',name,provenance:Object.freeze({artifactSha256:pinned.sha256,sourceIdentity:clone(manifest.identity),originalSourceUnmodified:r.candidateStateUsed===false&&r.nativeRestoreUsed===false}),coverage:Object.freeze({initialSnapshotBytes:true,createdSnapshotBytes:true,nativeFrames:true,nativeEmissionJournal:true,exactNativeClocks:true,gpuQualification:false}),inputRecipe:()=>clone(recipe),initialOnly:()=>clone(initial),expectedOnly:()=>clone(expected)});
}
