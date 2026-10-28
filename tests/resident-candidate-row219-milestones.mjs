// ASSERTION/PLANNING ONLY. Fresh original CPU chronology; never runtime input.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {createNativeRestOracle,DEFAULT_NATIVE_REST_RULE} from './resident-candidate-native-rest-fixture.mjs';
import {POST_IMPACT_NATIVE_SETTINGS,POST_IMPACT_NATIVE_PINS} from './resident-candidate-post-impact-native-projection.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),clone=structuredClone;
const word=x=>new Uint32Array(Float32Array.of(x).buffer)[0];
const words=x=>{const d=new DataView(new ArrayBuffer(8));d.setFloat64(0,x,true);return[d.getUint32(0,true),d.getUint32(4,true)];};
const vectors=lab=>lab.objects.map(o=>({id:o.id,linear:{...o.body.linvel()},angular:{...o.body.angvel()}}));
const summarize=s=>({outer:s.outerSteps,nativeH:s.nativeSteps,time:s.time,timeWords:words(s.time),elapsed:s.time-s.cueStarted,applicationSteps:s.applicationSteps,cuePresent:!!s.cue,fullRest:s.fullRest,allSleeping:s.objects.every(o=>o.body.sleeping),emissionCount:s.emittedEvents.length,nativeDtWord:s.nativeDtWord,gamePending:!!s.game.pending,gameResult:s.gameResult,queryStatus:s.scoring.status});
/** Exactly one original trial, from the existing authenticated raw common input.
 * Observer wall bound is diagnostic only; it cannot classify physical failure.
 * No scalar VM, resident source stepping, reference endpoints or future inputs.
 */
export async function captureRow219Milestones(){
 const started=performance.now(),rule={...DEFAULT_NATIVE_REST_RULE,horizon:8};
 const oracle=await createNativeRestOracle({settings:POST_IMPACT_NATIVE_SETTINGS,rule});
 const P=globalThis.PhysicsLab.prototype,step=P.step,tip=P.compliantTipContact,remove=P.removeCue,emit=P.emit;
 const sourceFiles=['src/physics.js','src/controller.js','src/game-rules.js','tests/resident-candidate-original-fixture.mjs','tests/resident-candidate-native-rest-fixture.mjs','tests/resident-candidate-post-impact-native-projection.mjs'];
 const sourceSha256=Object.fromEntries(sourceFiles.map(f=>[f,sha(readFileSync(new URL('../'+f,import.meta.url)))]));
 const authenticated=await originalRegisteredFixture(),initial=oracle.initial;assert.equal(oracle.sourceIdentity,POST_IMPACT_NATIVE_PINS.created);assert.equal(initial.origin.artifactSha256,POST_IMPACT_NATIVE_PINS.capture);assert.equal(initial.nativeSteps,0);assert.ok(initial.cue);assert.deepEqual(initial.settings,POST_IMPACT_NATIVE_SETTINGS);
 const cueStarted=initial.cue.started;let enteredH=0,outerOrdinal=0,outerNativeBefore=0,tipActive=false,removal=null,checkpoint192=null,containingOuter=null,nextOuter=null,terminal=initial,stopReason='physical-horizon';
 const observedEvents=initial.emittedEvents.map((event,i)=>({event:clone(event),timeWords:words(event.time),hEntered:0,nativeStepsCompleted:0,outerOrdinal:0,phase:'accepted-unstepped-strike',originalBoundary:clone(initial.emissionBoundaries[i])}));
 const summary=s=>summarize({...s,cueStarted});
 const boundary=s=>({outerOrdinal:s.outerSteps,nativeHAfter:s.nativeSteps,nativeHBefore:s.nativeSteps-s.boundary.nativeSteps,timeBefore:s.boundary.timeBefore,timeAfter:s.time,timeAfterWords:words(s.time),subdivisions:s.boundary.subdivisions,h:s.boundary.h,hWords:words(s.boundary.h),cueAtEntry:s.boundary.cueAtEntry,cueAtExit:s.boundary.cueAtExit,restoredOuterDtWord:s.nativeDtWord,nativeCalls:s.boundary.nativeCalls.map((c,i)=>({hOrdinal:s.nativeSteps-s.boundary.nativeSteps+i+1,...c,timeWords:words(c.time)}))});
 try{
  P.compliantTipContact=function(...args){enteredH++;tipActive=true;try{return tip.apply(this,args);}finally{tipActive=false;}};
  P.emit=function(...args){const result=emit.apply(this,args);const s=oracle.snapshot({includeNative:false}),event=clone(args[0]);observedEvents.push({event,timeWords:words(event.time),hEntered:enteredH,nativeStepsCompleted:s.nativeSteps,outerOrdinal,phase:tipActive?'compliant-tip-before-native':'source-application-after-native',originalBoundary:clone(s.emissionBoundaries.at(-1))});return result;};
  P.removeCue=function(...args){
   if(!this.cue)return remove.apply(this,args);
   assert.equal(removal,null,'one original cue withdrawal');const before=oracle.snapshot({includeNative:false}),velocities=vectors(this);
   const event={hEntered:enteredH,nativeStepsCompletedBefore:before.nativeSteps,outerOrdinal,substepOrdinal:enteredH-outerNativeBefore,applicationStepsBefore:this.steps,time:this.time,timeWords:words(this.time),elapsed:this.time-cueStarted,phase:tipActive?'compliant-tip-before-native':'post-native-application',reason:tipActive?'contacted tip separated':'source expiry',nativeDtWord:word(this.world.integrationParameters.dt),cueStarted,contacted:this.cue.contacted,remainingTipContacts:this.cue.contacts.size,lastContact:this.cue.stats.lastContact,lastContactWords:words(this.cue.stats.lastContact)};
   const result=remove.apply(this,args);assert.equal(this.cue,null);assert.deepEqual(vectors(this),velocities,'original withdrawal does not modify any ball velocity');removal={...event,nativeStepsCompletedAfter:oracle.snapshot({includeNative:false}).nativeSteps,lastStroke:clone(this.lastStroke),ballVelocitiesUnchanged:true};return result;
  };
  for(let i=0;i<oracle.maxOuterSteps;i++){
   outerOrdinal=i+1;outerNativeBefore=terminal.nativeSteps;
   terminal=oracle.stepOuter({continueAfterQueryTerminal:true,includeNative:false});
   assert.equal(enteredH,terminal.nativeSteps);assert.equal(P.step,step);
   if(terminal.nativeSteps===192){checkpoint192=summary(terminal);assert.equal(terminal.outerSteps,3);assert.ok(terminal.cue);}
   if(removal&&!containingOuter){assert.equal(terminal.outerSteps,removal.outerOrdinal);containingOuter=boundary(terminal);}
   else if(containingOuter&&!nextOuter)nextOuter=boundary(terminal);
   if(terminal.fullRest){stopReason='full-rest';break;}
   if(nextOuter&&performance.now()-started>5000){stopReason='observer-wall-budget';break;}
  }
  assert.ok(checkpoint192,'same real trajectory reaches h192');assert.ok(removal&&containingOuter&&nextOuter,'bounded original trial must cross withdrawal and next outer latch');
  const after192=observedEvents.filter(e=>e.hEntered>192),beforeRemoval=after192.filter(e=>e.hEntered<=removal.hEntered&&e.event.time<=removal.time);
  const floor=e=>e.event.kind==='floor'||[e.event.a?.kind,e.event.b?.kind].includes('floor');
  return{kind:'original-row219-next-milestones-v1',candidate:219,settings:clone(POST_IMPACT_NATIVE_SETTINGS),source:{baseRevision:'3cc9db9',...initial.origin,sourceSha256,stepFunctionSha256:sha(step.toString()),tipFunctionSha256:sha(tip.toString()),removeFunctionSha256:sha(remove.toString()),numericProfile:'original-js-number-v1',preStrikeHistory:clone(authenticated.raw.capture.preStrikeApplication.events),preStrikeHistorySha256:sha(JSON.stringify(authenticated.raw.capture.preStrikeApplication.events)),createdApplicationHistory:clone(initial.events),createdApplicationHistorySha256:sha(JSON.stringify(initial.events))},initial:summary(initial),checkpoint192,removal,containingOuter,nextOuter,events:observedEvents,after192:{firstContact:after192.find(e=>e.event.kind==='contact')??null,firstFloor:after192.find(floor)??null,firstContactBeforeRemoval:beforeRemoval.find(e=>e.event.kind==='contact')??null,firstFloorBeforeRemoval:beforeRemoval.find(floor)??null},terminal:summary(terminal),stopReason,horizonSeconds:8,maxOuterSteps:oracle.maxOuterSteps,observedWallMs:performance.now()-started,gameAuthority:{class:'original FourBallGame',events:'every actual original emission',finalization:'existing oracle invokes original Game.finish at the unchanged Controller no-cue/all-sleep predicate after complete outer',controllerMethodExecuted:false,scoreFromPhysicsAlone:false},capability:{oracleChronologyOnly:true,futureRuntimeInput:false,residentVmExecuted:false,gpuExecuted:false,browserExecuted:false,physicalReleaseQualified:false}};
 }finally{P.compliantTipContact=tip;P.removeCue=remove;P.emit=emit;assert.equal(P.step,step);oracle.dispose();for(const[f,h]of Object.entries(sourceSha256))assert.equal(sha(readFileSync(new URL('../'+f,import.meta.url))),h);}
}
