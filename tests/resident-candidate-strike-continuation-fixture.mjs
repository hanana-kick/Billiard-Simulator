// TEST ONLY native strike-boundary preparation. Future states are written only
// to expectations.v8; runtime.v8 contains authenticated initial inputs only.
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {serialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {createNativeRestOracle,DEFAULT_NATIVE_REST_RULE} from './resident-candidate-native-rest-fixture.mjs';
import {createWorldInitializationPlan,buildWorldInitializationCommands,packWorldInitializationRows} from '../src/resident-candidate/world-initialization.mjs';
import {STRIKE_INITIAL_KIND,STRIKE_CHECKPOINT_SCHEDULE,assertStrikeInitialRuntime} from './resident-candidate-strike-continuation-handoff.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex'),clone=structuredClone;
export const STRIKE_CONTINUATION_COVERAGE=Object.freeze({source:'untouched PhysicsLab.step(1) with pinned original Rapier',fixedCommonScene:true,fixedBaselineRow:true,completeLatchedOuterCalls:true,queryHorizonUnchanged:true,checkpointCutoffNotQueryTerminal:true,futureStatesRuntimeInputs:false,gpuExecution:false,hardwarePerformance:false,fullRest:false,native1024:false});
/** A bounded diagnostic AFTER a real physical strike, not an artificial shorter
 * scoring horizon. Requests320h +64h must retain one GPU world between them. */
export async function createNativeStrikeContinuationFixture(){
 const source=await originalRegisteredFixture(),controls=clone(source.raw.capture.preStrikeApplication.controller.settings),row={id:17,settings:controls};
 assert.deepEqual(controls,{angle:0,elevation:8,speed:2,tipX:0,tipY:0},'this gate is the explicit accepted baseline raw row');
 const rule={firstId:3,secondId:4,method:'none',allowKiss:true,maxOuterSteps:15360};
 const initializationPlan=await createWorldInitializationPlan({decoder:source.decoder,input:source.raw,rule});
 const init=buildWorldInitializationCommands(initializationPlan,1),input=packWorldInitializationRows(initializationPlan,[row]),t=initializationPlan.template;
 const runtime=assertStrikeInitialRuntime({kind:STRIKE_INITIAL_KIND,count:1,identity:{kind:'original-prestrike-raw-controls',sourceArtifactSha256:source.artifactSha256,preStrikeIdentity:initializationPlan.preStrikeIdentity,createdIdentity:initializationPlan.sourceIdentity,rawInputSha256:hash(input),row,rule},input,init,sharedGeometry:t.sharedGeometry,layout:{stateWords:t.state.length,scratchWords:t.numericScratchWords,segments:t.segments,fixedCcd:t.fixedCcd,selectedIndex:t.selectedIndex},checkpointSchedule:STRIKE_CHECKPOINT_SCHEDULE,physicsExecutorIncluded:false});
 const oracle=await createNativeRestOracle({settings:controls,rule:DEFAULT_NATIVE_REST_RULE});
 try{
  assert.equal(oracle.sourceIdentity,initializationPlan.sourceIdentity);assert.equal(oracle.initial.origin.preStrikeSnapshotSha256,initializationPlan.preStrikeIdentity);
  const checkpoints=[],outerReceipts=[];for(let outer=1;outer<=6;outer++){const state=oracle.stepOuter();outerReceipts.push(clone(state.boundary));const target=STRIKE_CHECKPOINT_SCHEDULE.find(x=>x.outer===outer);if(target){assert.equal(state.nativeSteps,target.targetH);checkpoints.push({name:target.name,state});}}
  const before=checkpoints[0].state,after=checkpoints[1].state;assert.equal(before.cue.contacted,false);assert.equal(after.cue.contacted,true);assert.equal(after.cue.stats.contactEpisodes,1);assert.ok(after.cue.stats.normalImpulse>0);
  const selected=state=>state.objects.find(x=>x.id===state.selectedId).body;assert.equal(selected(before).sleeping,true);assert.equal(selected(after).sleeping,false);assert.ok(Object.values(selected(after).linear).some(x=>x!==0));
  const prefix=oracle.initial.emittedEvents.length,added=after.emittedEvents.slice(prefix);assert.equal(added.length,1);assert.equal(added[0].kind,'contact');assert.equal(added[0].key,undefined);const receipt=after.emissionBoundaries[prefix];
  assert.deepEqual({outer:receipt.outerStep,completedH:receipt.nativeStepsCompleted},{outer:6,completedH:370});assert.equal(receipt.time,after.cue.stats.firstContact);assert.equal(after.scoring.status,'running');assert.equal(after.fullRest,false);assert.equal(after.scoring.accumulator.steps,6);
  const expected={kind:'resident-native-strike-assertions-only-v1',initial:oracle.initial,checkpoints,outerReceipts,sourceIdentity:oracle.sourceIdentity,rule:clone(oracle.request.options),seed:source.seed,coverage:STRIKE_CONTINUATION_COVERAGE};
  const summary={kind:'native-strike-continuation-preparation',sourceIdentity:oracle.sourceIdentity,preStrikeIdentity:initializationPlan.preStrikeIdentity,row,checkpoints:checkpoints.map(({name,state:s})=>({name,h:s.nativeSteps,outer:s.outerSteps,time:s.time,cuePresent:!!s.cue,cueContacted:!!s.cue?.contacted,selectedSleeping:selected(s).sleeping,queryStatus:s.scoring.status,fullRest:s.fullRest})),tip:{beforeNativeH:receipt.nativeStepsCompleted+1,nativeStepsCompleted:receipt.nativeStepsCompleted,outer:receipt.outerStep,substepAtEntry:receipt.nativeStepsCompleted-(receipt.outerStep-1)*64,time:receipt.time,normalImpulse:after.cue.stats.normalImpulse},nativeQueryHorizon:oracle.request.options.horizon,maxOuterSteps:oracle.maxOuterSteps,initializationDispatches:init.dispatches,physicsExecutorIncluded:false,...STRIKE_CONTINUATION_COVERAGE};
  return{runtime,expected,summary};
 }finally{oracle.dispose();}
}
export async function prepareNativeStrikeContinuation(directory){
 mkdirSync(directory,{recursive:true});const{runtime,expected,summary}=await createNativeStrikeContinuationFixture(),r=serialize(runtime),e=serialize(expected);writeFileSync(join(directory,'runtime.v8'),r);writeFileSync(join(directory,'expectations.v8'),e);
 const runtimeManifest={kind:'resident-native-strike-runtime-manifest-v1',runtimeSha256:hash(r),runtimeBytes:r.length,identity:runtime.identity,checkpointSchedule:runtime.checkpointSchedule,physicsExecutorIncluded:false,expectedFileAccess:false,gpuExecuted:false};
 const assertionManifest={kind:'resident-native-strike-assertion-manifest-v1',expectationsSha256:hash(e),expectationsBytes:e.length,sourceIdentity:expected.sourceIdentity,sourcePhysicsSha256:hash(readFileSync(new URL('../src/physics.js',import.meta.url))),summary};
 writeFileSync(join(directory,'runtime-manifest.json'),JSON.stringify(runtimeManifest,null,2)+'\n');writeFileSync(join(directory,'assertion-manifest.json'),JSON.stringify(assertionManifest,null,2)+'\n');return{directory,runtimeManifest,assertionManifest};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{assert.equal(process.argv[2],'prepare');assert.ok(process.argv[3]);console.log(JSON.stringify(await prepareNativeStrikeContinuation(resolve(process.argv[3]))));}catch(e){console.error(e);process.exitCode=1;}}
