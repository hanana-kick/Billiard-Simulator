// ASSERTION ONLY. Fresh original CPU prefix; never a resident runtime input.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {serialize,deserialize} from 'node:v8';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createNativeRestOracle,DEFAULT_NATIVE_REST_RULE} from './resident-candidate-native-rest-fixture.mjs';
import {CREATION_SOURCE} from '../src/resident-candidate/creation-template.mjs';
import {projectNativeStrikeCheckpoint,expectedNativeStrikeEmissions} from './resident-candidate-strike-continuation-bank.mjs';
import {assertWholeHCommitted,firstWorldMismatch} from './resident-candidate-whole-h-fixture.mjs';
import {decodeWorldEmissionAudit} from './resident-candidate-event-audit.mjs';
import {WORLD_APPLICATION_LAYOUT as W} from '../src/resident-candidate/world-application.mjs';
import {APPLICATION_LAYOUT as A} from '../src/resident-candidate/application.mjs';
import {CUE_LAYOUT as Q} from '../src/resident-candidate/cue.mjs';
import {binary64Words} from '../src/resident-candidate/physical-rules.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex'),clone=structuredClone;
const word=x=>new Uint32Array(Float32Array.of(x).buffer)[0];
export const POST_IMPACT_NATIVE_SETTINGS=Object.freeze({angle:310,elevation:85,speed:4.5,tipX:.2,tipY:-.1});
export const POST_IMPACT_NATIVE_PINS=Object.freeze({
 capture:'11f41cd9c11ff47911f14afc084b27f32a15fc69db1f26d7970eb864f35f2262',
 created:'feb6b6eea9a0d29236df73680e79d3cbedf84dee702f3dae0c1e80a33ef9c2ef',
 postInitial:'05f78ef994c2b69960e8e64c07d03cd17c0947656d573afee82820d764a5ff5e',
 postFinal:'893b7ed95bbf2881b4fb518421ef37339ca8857944603c898391237f125996a5',
 nativeExpected:'c04be6c729651540a1993f0f4addbc7f4c1338851a5d141e5e107688e65e2b23',
});
export const POST_IMPACT_NATIVE_COVERAGE=Object.freeze({
 candidate:219,rawControls:true,source:'fresh original PhysicsLab/Rapier from authenticated prestrike',
 boundary:'after all application work of h193, before compliantTipContact of h194',
 completeNativeH:true,completeOuter:false,completedOuters:3,partialOuter:4,completedSubsteps:1,
 latchedSubdivisions:64,fullNativeSnapshotCaptured:true,completeNativeMemoryCompared:false,
 futureStatesRuntimeInputs:false,gpuExecuted:false,scalarVmReplay:false,fullRest:false,hardwarePerformance:false,
});
/** A transparent TEST observer forwards all original compliant/angular calls.
 * At the NEXT inner entry, throw a private sentinel BEFORE its first effect.
 * The original step stack unwinds: it does not restore outer dt, increment its
 * outer counter, run presentation updates, or perform outer scorer/game work.
 * This captured branch is disposed, never resumed by replaying step(1).
 */
export async function captureOriginalPostImpactH193(){
 const physics=readFileSync(new URL('../src/physics.js',import.meta.url)),physicsSha256=hash(physics);
 assert.equal(physicsSha256,CREATION_SOURCE.physicsSha256);
 const labPrototype=globalThis.PhysicsLab.prototype,step=labPrototype.step,tip=labPrototype.compliantTipContact,angular=labPrototype.angularPatchResistance;
 const oracle=await createNativeRestOracle({settings:POST_IMPACT_NATIVE_SETTINGS,rule:DEFAULT_NATIVE_REST_RULE});
 assert.equal(oracle.sourceIdentity,POST_IMPACT_NATIVE_PINS.created);assert.equal(oracle.initial.origin.artifactSha256,POST_IMPACT_NATIVE_PINS.capture);
 const outerStates=[],outerReceipts=[];let captured=null,entries=0,angularCompletions=0,firstEntry=null;
 const stop=Object.freeze({kind:'test-only-before-h194-sentinel'}),began=performance.now();
 try{
  for(let i=0;i<3;i++){const s=oracle.stepOuter();assert.equal(s.nativeSteps,64*(i+1));assert.equal(s.outerSteps,i+1);assert.equal(s.boundary.subdivisions,64);outerStates.push(s);outerReceipts.push(clone(s.boundary));}
  const before=outerStates[2];assert.equal(before.nativeSteps,192);assert.equal(before.cue.contacted,true);assert.equal(before.scoring.accumulator.steps,3);assert.equal(before.scoring.status,'running');
  labPrototype.angularPatchResistance=function(...args){assert.equal(labPrototype.step,step);const result=angular.apply(this,args);angularCompletions++;return result;};
  labPrototype.compliantTipContact=function(...args){
   assert.equal(labPrototype.step,step);entries++;assert.equal(args.length,1);
   const entry={h:args[0],nativeDtWord:word(this.world.integrationParameters.dt),time:this.time,applicationSteps:this.steps,cuePresent:!!this.cue};
   if(entries===1){firstEntry=entry;assert.equal(entry.time,before.time);assert.equal(entry.h,this.dt/before.strokeSubsteps);return tip.apply(this,args);}
   assert.equal(entries,2);assert.equal(angularCompletions,1,'previous h angular application returned');
   const state=oracle.snapshot();assert.equal(state.nativeSteps,193);assert.equal(state.outerSteps,3);assert.equal(state.applicationSteps,before.applicationSteps);assert.equal(state.scoring.accumulator.steps,3);
   assert.equal(state.time,before.time+args[0]);assert.equal(entry.h,firstEntry.h);assert.equal(entry.nativeDtWord,word(entry.h));assert.notEqual(entry.nativeDtWord,word(state.dt));
   assert.deepEqual(state.boundary,before.boundary,'last completed outer receipt remains honest');
   captured={kind:'original-native-partial-outer-h193-assertions-v1',candidate:219,initial:oracle.initial,
    completeOuterStates:outerStates,completeOuterReceipts:outerReceipts,state,
    boundary:{hCompleted:193,nextHNotEntered:194,outerCompleted:3,outerOrdinal:4,substepCompleted:1,subdivisions:before.strokeSubsteps,
     h:args[0],timeBeforeOuter:before.time,timeAfterH:state.time,currentNativeDtWord:entry.nativeDtWord,outerDt:state.dt,
     applicationSteps:state.applicationSteps,scorerSteps:state.scoring.accumulator.steps,firstInnerEntry:firstEntry,nextInnerEntry:entry,
     angularCompletions,sourceOrder:'compliantTipContact; native step; time += h; obstructions; collision drain; angular patch; cue expiry; NEXT compliantTipContact'},
    source:{physicsSha256,stepFunctionSha256:hash(step.toString()),tipFunctionSha256:hash(tip.toString()),angularFunctionSha256:hash(angular.toString()),
     sourceIdentity:oracle.sourceIdentity,preStrikeIdentity:oracle.initial.origin.preStrikeSnapshotSha256,artifactSha256:oracle.initial.origin.artifactSha256},
    request:clone(oracle.request),maxOuterSteps:oracle.maxOuterSteps,coverage:POST_IMPACT_NATIVE_COVERAGE};
   throw stop;
  };
  assert.throws(()=>oracle.stepOuter(),e=>e===stop,'pause only at the private exact-boundary sentinel');
  assert.ok(captured);assert.equal(entries,2);assert.equal(angularCompletions,1);
  assert.deepEqual(oracle.snapshot(),captured.state,'unwind performs no extra physical/scoring/outer work');
  captured.cpuPrefixWallMs=performance.now()-began;return captured;
 }finally{labPrototype.compliantTipContact=tip;labPrototype.angularPatchResistance=angular;assert.equal(labPrototype.step,step);oracle.dispose();assert.equal(hash(readFileSync(new URL('../src/physics.js',import.meta.url))),physicsSha256);}
}

/** Reads existing data ONLY AFTER independent native execution has finished.
 * These are comparison artifacts, never initial conditions for the capture. */
export function loadPostImpactComparisonArtifacts(capture,artifactRoot){
 assert.equal(capture?.kind,'original-native-partial-outer-h193-assertions-v1');assert.equal(capture.state.nativeSteps,193);
 const load=(path,pin)=>{const bytes=readFileSync(path);assert.equal(hash(bytes),pin,'immutable comparison-only '+path);return deserialize(bytes);};
 const initial=load(join(artifactRoot,'post-impact-profile-v1/initial.v8'),POST_IMPACT_NATIVE_PINS.postInitial),final=load(join(artifactRoot,'post-impact-profile-v1/four-final.v8'),POST_IMPACT_NATIVE_PINS.postFinal),previous=load(join(artifactRoot,'tip-impact-coupled-created-host-v1/expected.v8'),POST_IMPACT_NATIVE_PINS.nativeExpected);
 assert.equal(initial.kind,'owned-host-h192-one-h-diagnostic-v1');assert.equal(initial.diagnosticT0H,192);assert.equal(initial.requestedAdditionalH,1);assert.equal(initial.rawInput,false);assert.equal(initial.gpuAdmission,false);assert.equal(final.kind,initial.kind);assert.equal(final.initialSha256,POST_IMPACT_NATIVE_PINS.postInitial);
 assert.deepEqual(previous.rows[0],{id:219,settings:POST_IMPACT_NATIVE_SETTINGS});assert.equal(previous.seed.initialSnapshotSha256,capture.source.sourceIdentity);assert.equal(previous.identity.preStrikeIdentity,capture.source.preStrikeIdentity);assert.equal(initial.four.identity.createdIdentity,capture.source.sourceIdentity);
 assert.deepEqual(capture.initial,previous.nativeEvidence.initial,'fresh native trial has the exact same entire original CREATED capture');
 assert.deepEqual(capture.completeOuterStates[2],previous.nativeEvidence.checkpoints.find(x=>x.state.nativeSteps===192).state,'fresh complete h192 original endpoint including full native snapshot');
 const layout=initial.four.layout,template=initial.four.template;
 assert.equal(final.bindings.length,6);assert.equal(final.bindings[0][4],219);assert.equal(final.bindings[0][5],193);assert.equal(final.bindings[0][layout.stateWords+4],522);assert.equal(final.bindings[0][layout.stateWords+5],0);
 for(const i of[1,2,4])assert.deepEqual(final.bindings[i],initial.bindings[i],'unchanged immutable comparison binding '+i);
 const audit=decodeWorldEmissionAudit(final.bindings[5].slice(0,layout.auditWords),{count:2,audit:{words:layout.auditWords,strideWords:layout.auditStride,capacityPerCandidate:64}},{candidate:0});
 assert.ok(final.bindings[5].slice(layout.auditStride,layout.auditWords).every(x=>x===0),'rejected lane has no accepted emission');
 return{initial,final,previous,layout,template,audit};
}
/** Reuse every existing meaningful ball/cue/rule/game/history field. The ONLY
 * outer-projection adaptation is the independently observed substep boundary;
 * it is not a fabricated outer completion or convenience wrapper equality. */
export function projectOriginalPostImpactH193(capture,artifacts){
 const {previous,template,final,audit}=artifacts,b=capture.boundary,s=capture.state,words=final.bindings[0];
 const partialReceipt={outer:b.outerOrdinal,subdivisions:b.subdivisions,nativeSteps:b.substepCompleted,h:b.h,timeBefore:b.timeBeforeOuter,timeAfter:b.timeAfterH};
 const evidence={...previous.nativeEvidence,initial:capture.initial,checkpoints:[{name:'partial-h193',state:s}],outerReceipts:[...capture.completeOuterReceipts,partialReceipt]};
 assertWholeHCommitted({words,base:0,template,frame:193});
 const p=projectNativeStrikeCheckpoint({words,base:0,template,evidence,name:'partial-h193'});
 p.expected.clock.substep=b.substepCompleted;
 const wa=template.segments.worldApplication.offset,a=template.segments.application.offset,q=template.segments.cue.offset;
 p.actual.partialOuter={phase:words[wa+W.header.phase],outerCompleted:words[wa+W.header.outer],substepCompleted:words[wa+W.header.substep],subdivisions:words[wa+W.header.subdivisions],
  currentNativeDtWord:words[10],h:Array.from(words.slice(a+A.header.h,a+A.header.h+2)),dt:Array.from(words.slice(a+A.header.dt,a+A.header.dt+2)),
  latchedApplicationSubdivisions:words[a+A.header.outerSubsteps],terminalPublished:words[wa+W.header.terminalPublished],cueFrame:words[q+Q.header.frame],
  cueStarted:Array.from(words.slice(q+Q.header.started,q+Q.header.started+2)),applicationCueStarted:Array.from(words.slice(a+A.header.cueStarted,a+A.header.cueStarted+2)),
  cueNeedsSolve:words[q+Q.header.needsSolve]};
 p.expected.partialOuter={phase:W.phases.outerReady,outerCompleted:b.outerCompleted,substepCompleted:b.substepCompleted,subdivisions:b.subdivisions,
  currentNativeDtWord:b.currentNativeDtWord,h:binary64Words(b.h),dt:binary64Words(b.outerDt),latchedApplicationSubdivisions:b.subdivisions,terminalPublished:0,cueFrame:193,
  cueStarted:binary64Words(s.cue.started),applicationCueStarted:binary64Words(s.cue.started),cueNeedsSolve:0};
 p.expected.emissions=expectedNativeStrikeEmissions(evidence,'partial-h193');p.actual.emissions=audit.map(r=>({keyed:r.keyed,pairId:r.pairId,time:[r.timeLo,r.timeHi],...Object.fromEntries(['hCommitted','outerCompleted','substepAtEntry','subdivisions','worldPhase','nativeHCompleted','outerOrdinal','substepCompleted','order'].map(k=>[k,r[k]]))}));
 return{...p,coverage:{...POST_IMPACT_NATIVE_COVERAGE,projectionGroups:Object.keys(p.expected),existingOuterProjectionFieldsDropped:[],
  retainedNativeCaptureFields:['full original balls/cue including body handles, COM/mass/inertia/sleep','complete game snapshot and optimizer accumulator','all emitted events/receipts and presentation debounce history','native snapshot bytes; source and boundary provenance'],
  notRepresentedByThisBankProjection:[...p.coverage.omitted,'full game static metadata/scores and full native cue guide/COM/joint metadata are retained in the native capture but not falsely reconstructed as resident fields'],
  qualifiedAtMost:'represented original source observables at this fixed partial-outer endpoint; not complete native-engine memory'}};
}
export function compareOriginalPostImpactH193(capture,artifacts){
 const p=projectOriginalPostImpactH193(capture,artifacts),groups=Object.keys(p.expected).map(group=>({group,mismatch:firstWorldMismatch(p.actual[group],p.expected[group],'$.'+group)}));
 return{kind:'original-native-partial-outer-h193-comparison-v1',status:groups.every(x=>!x.mismatch)?'pass':'mismatch',groups,projection:p,
  nativeSource:capture.source,boundary:capture.boundary,comparisonOnlyPins:POST_IMPACT_NATIVE_PINS,cpuPrefixWallMs:capture.cpuPrefixWallMs,
  rawToH193NativeQualified:false,gpuExecuted:false,fullRest:false};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const[mode,outDir,artifactRoot]=process.argv.slice(2);assert.ok(mode==='capture'||mode==='compare');assert.ok(outDir);assert.equal(existsSync(outDir),false);if(mode==='compare')assert.ok(artifactRoot);
 const capture=await captureOriginalPostImpactH193();mkdirSync(outDir,{recursive:false});const bytes=serialize(capture);writeFileSync(join(outDir,'native-h193.v8'),bytes,{flag:'wx'});
 const summary={kind:capture.kind,source:capture.source,boundary:capture.boundary,coverage:capture.coverage,cpuPrefixWallMs:capture.cpuPrefixWallMs,
  capturedSha256:hash(bytes),capturedBytes:bytes.length,events:capture.state.emittedEvents.length,history:capture.state.events.length,
  cue:capture.state.cue?.stats,game:capture.state.game};writeFileSync(join(outDir,'native-h193.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(summary));
 if(mode==='compare'){const comparison=compareOriginalPostImpactH193(capture,loadPostImpactComparisonArtifacts(capture,artifactRoot));writeFileSync(join(outDir,'comparison.json'),JSON.stringify(comparison,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({...comparison,projection:undefined}));assert.equal(comparison.status,'pass','strict original-native h193 projection; preserve any mismatch, do not repair bank or weaken fields');}
}
