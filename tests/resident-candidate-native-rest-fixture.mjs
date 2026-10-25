// TEST ONLY: unchanged original PhysicsLab + pinned native Rapier outer oracle.
// No expected/evolved data from this helper may enter a resident GPU bank.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {CREATION_SOURCE} from '../src/resident-candidate/creation-template.mjs';
const require=createRequire(import.meta.url),R=require('../vendor/rapier.cjs');
for(const name of ['math','physics','route-rules','optimizer-core','game-rules'])require('../src/'+name+'.js');
const Lab=globalThis.PhysicsLab,Core=globalThis.ShotSearchCore,Game=globalThis.FourBallGame;
const clone=structuredClone,hash=x=>createHash('sha256').update(x).digest('hex');
const vector=v=>({x:v.x,y:v.y,z:v.z}),quaternion=q=>({...vector(q),w:q.w});
const word=x=>new Uint32Array(Float32Array.of(x).buffer)[0];
export const NATIVE_REST_ORACLE_COVERAGE=Object.freeze({
 backend:'original PhysicsLab.step(1) + unchanged pinned Rapier 0.21.0',
 initialOrigin:'same authenticated original registered-four-ball prestrike snapshot',
 sourceOuterSubdivisions:true,sourceFullRestPredicate:true,sourceOptimizerAccumulator:true,
 sourceEventEmissionAndDebounce:true,sourceGameplay:true,preparedFutureInputs:false,
 sourceModified:false,gpuExecution:false,productionFallback:false,
 presentationBaseline:'Prestrike capture omits trails/distance/maxHeight; these diagnostics start from a test-only zero baseline and are excluded from physics parity.',
 nativeCallObservation:'Transparent test-only world.step observer forwards identical receiver/arguments; PhysicsLab.step and native numerical implementation remain unchanged.'
});
// Controller.routeOptions defaults to 16 seconds. Core.validate admits only
// 8/16/30 seconds; do not inherit the staged oracle's test-only 12000-step cap.
export const DEFAULT_NATIVE_REST_RULE=Object.freeze({firstId:3,secondId:4,method:'none',allowKiss:true,horizon:16});
function nativeHandle(h){const v=new DataView(new ArrayBuffer(8));v.setUint32(0,h.index,true);v.setUint32(4,h.generation,true);return v.getFloat64(0,true);}
function rawHandle(n){const v=new DataView(new ArrayBuffer(8));v.setFloat64(0,n,true);return{index:v.getUint32(0,true),generation:v.getUint32(4,true)};}
function bodyState(body){return{handle:rawHandle(body.handle),translation:vector(body.translation()),rotation:quaternion(body.rotation()),linear:vector(body.linvel()),angular:vector(body.angvel()),sleeping:body.isSleeping(),worldCom:vector(body.worldCom()),invMass:vector(body.effectiveInvMass()),invInertia:Array.from(body.effectiveWorldInvInertia().elements).slice(0,6)};}
function cueState(c){if(!c)return null;return{selectedId:c.selectedId,started:c.started,contacted:c.contacted,pose:clone(c.pose),stats:clone(c.stats),contacts:Array.from(c.contacts,([id,value])=>[id,clone(value)]),obstructions:[...c.obstructions],shaft:bodyState(c.body),head:bodyState(c.head),guide:bodyState(c.guide),colliders:{shaft:rawHandle(c.shaft.handle),tip:rawHandle(c.tip.handle),neck:rawHandle(c.neck.handle)},joints:{flex:rawHandle(c.flex.handle),guide:rawHandle(c.joint.handle)}};}
function restorePrestrike(source){const{raw}=source,a=raw.capture.preStrikeApplication;
 const bind=o=>({...clone(o),bodyHandle:nativeHandle(o.body),colliderHandle:nativeHandle(o.collider),pairColliderHandle:o.pairCollider?nativeHandle(o.pairCollider):undefined,pos:{x:0,y:0,z:0},trail:[],distance:0,maxHeight:0});
 const lab=Lab.fromSnapshot(R,{...clone(a),world:raw.preStrikeSnapshot,objects:a.registry.objects.map(bind),statics:a.registry.statics.map(bind)});
 // Only unavailable presentation history is given a local diagnostic baseline.
 // No native body/collider setters, repositioning, sleeping or propagation.
 for(const o of [...lab.objects,...lab.statics]){o.pos=vector(o.body.translation());o.lastPos=vector(o.body.translation());}
 assert.deepEqual(lab.world.takeSnapshot(),raw.preStrikeSnapshot,'restore must preserve the authenticated native bytes');
 assert.equal(lab.cue,null);assert.equal(lab.objects.length,4);assert.equal(lab.anyMotion(),false);return lab;
}
/** Creates an independent original native trial. Optional settings are exact
 * raw controls: no normalization, clamp, feasibility restoration or relaxation.
 * Only the original native clearance/strike path can accept them. */
export async function createNativeRestOracle({settings,rule=DEFAULT_NATIVE_REST_RULE}={}){
 const source=await originalRegisteredFixture();await R.init();
 assert.equal(hash(readFileSync(new URL('../src/physics.js',import.meta.url))),CREATION_SOURCE.physicsSha256,'original PhysicsLab source changed');
 const nativeStep=R.World.prototype.step,applicationStep=Lab.prototype.step;
 const captured=source.raw.capture,pre=captured.preStrikeApplication,selectedId=pre.controller.selectedId,controls=clone(settings??pre.controller.settings),query=clone(rule);
 assert.ok([8,16,30].includes(query.horizon),'original supported query horizon');assert.ok(pre.game.redIds.includes(query.firstId)&&pre.game.redIds.includes(query.secondId)&&query.firstId!==query.secondId);
 const maxOuterSteps=Math.round(query.horizon/pre.dt),request={selectedId,options:{gameMode:'four',mode:'carom',targetId:query.firstId,secondId:query.secondId,opponentId:pre.game.cueIds.find(id=>id!==selectedId),fourBallThreeCushion:pre.game.threeCushion,allowKiss:query.allowKiss,horizon:query.horizon,objective:'shortest',...(query.method==='none'?{}:{methodId:query.method})}};
 const lab=restorePrestrike(source),game=new Game();game.restore(pre.game);let stopped=false,disposed=false,busy=false,outer=0,nativeSteps=0,emitted=[],emissionBoundaries=[],currentEvents=[],currentNative=[],lastBoundary=null,lastGameResult=null,terminalTime=null,createdSnapshotSha256=null;
 const accumulator=Core.createPhysicalAccumulator(controls,undefined,lab.time,lab.get(selectedId).body.translation()),input=Core.physicalInputs(lab);
 // Independent original callbacks see every actual emit, not merely the last
 // 120 presentation entries. The accumulator is frozen once its query stops;
 // optional physical continuation for game/rest still observes native events.
 lab.onEvent=e=>{const event=clone(e);emitted.push(event);emissionBoundaries.push({eventIndex:emitted.length-1,outerStep:busy?outer+1:0,nativeStepsCompleted:nativeSteps,time:lab.time});currentEvents.push(event);game.contact(e);if(!stopped)Core.observePhysicalEvent(request,accumulator,e);};
 const originalWorldStep=lab.world.step;
 lab.world.step=function(...args){assert.equal(this,lab.world);const before={time:lab.time,dtWord:word(this.integrationParameters.dt),cuePresent:!!lab.cue};const result=originalWorldStep.apply(this,args);nativeSteps++;currentNative.push({...before,allSleeping:lab.objects.every(o=>o.body.isSleeping())});return result;};
 const scoring=()=>({accumulator:clone(accumulator),stopped,terminalTime,status:stopped?(accumulator.verificationIncomplete?'incomplete':accumulator.success&&!accumulator.invalid?'pass':'miss'):'running',result:stopped?Core.physicalResult(request.options,accumulator,terminalTime):null});
 const snapshot=({includeNative=true}={})=>{
  assert.equal(disposed,false);const fullRest=!lab.cue&&lab.objects.every(o=>o.body.isSleeping());
  assert.match(createdSnapshotSha256??'',/^[0-9a-f]{64}$/,'actual no-step strike identity must be captured first');
  return{kind:'original-native-outer-boundary',origin:{artifactSha256:source.artifactSha256,preStrikeSnapshotSha256:hash(source.raw.preStrikeSnapshot),createdSnapshotSha256},settings:clone(controls),selectedId,
   outerSteps:outer,nativeSteps,time:lab.time,applicationSteps:lab.steps,shots:lab.shots,revision:lab.revision,dt:lab.dt,nativeDtWord:word(lab.world.integrationParameters.dt),strokeSubsteps:lab.strokeSubsteps,
   objects:lab.objects.map(o=>({id:o.id,kind:o.kind,shape:o.shape,radius:o.radius,mass:o.mass,primaryCollider:rawHandle(o.collider.handle),pairCollider:rawHandle(o.pairCollider.handle),body:bodyState(o.body)})),
   cue:cueState(lab.cue),lastStroke:clone(lab.lastStroke),events:clone(lab.events),emittedEvents:clone(emitted),emissionBoundaries:clone(emissionBoundaries),game:game.snapshot(),gameResult:clone(lastGameResult),fullRest,scoring:scoring(),boundary:clone(lastBoundary),
   ...(includeNative?{nativeSnapshot:lab.world.takeSnapshot()}:{}),coverage:NATIVE_REST_ORACLE_COVERAGE};
 };
 try{
  const result=lab.strike(selectedId,controls,{saveSnapshot:false});if(!result.ok){const error=new RangeError('Original native strike rejected: '+result.reason);error.code='ORIGINAL_STRIKE_REJECTED';error.pass=null;throw error;}
  assert.equal(game.begin(selectedId,{threeCushion:pre.game.threeCushion}),true,'original controller begins gameplay after accepted strike');
  assert.equal(nativeSteps,0,'strike creation never advances native simulation');assert.equal(lab.time,pre.time);assert.equal(lab.steps,pre.steps);
  const originalSettings=Object.keys(pre.controller.settings).every(k=>Object.is(controls[k],pre.controller.settings[k]));
  if(originalSettings){assert.deepEqual(lab.world.takeSnapshot(),source.raw.snapshot,'replayed actual strike must equal authenticated CREATED native bytes');assert.deepEqual(lab.events,captured.application.events);assert.deepEqual(game.snapshot(),captured.application.game);}
  // Variant controls change native created pose/velocity/inertia bytes. Their
  // provenance is the actual accepted, unstepped strike, never the baseline's
  // source.seed identity. This snapshot is assertion data only.
  createdSnapshotSha256=hash(lab.world.takeSnapshot());
  const initial=snapshot();currentEvents=[];currentNative=[];
  return Object.freeze({initial,sourceIdentity:createdSnapshotSha256,request:clone(request),maxOuterSteps,coverage:NATIVE_REST_ORACLE_COVERAGE,
   snapshot,scoring,
   // Always exactly one unchanged PhysicsLab OUTER call. In particular, neither
   // query invalidation nor full rest observed inside a native h truncates its
   // latched64 subdivisions. Later physical continuation must be explicit.
   stepOuter({continueAfterQueryTerminal=false,includeNative=true}={}){
    assert.equal(disposed,false);assert.equal(busy,false);assert.ok(!stopped||continueAfterQueryTerminal,'Query is terminal; request explicit physical rest continuation');
    assert.equal(Lab.prototype.step,applicationStep,'original outer method must remain unchanged');assert.equal(R.World.prototype.step,nativeStep,'native numerical implementation must remain unchanged');
    busy=true;try{currentEvents=[];currentNative=[];const before={time:lab.time,steps:lab.steps,nativeSteps,cuePresent:!!lab.cue},subdivisions=lab.cue?lab.strokeSubsteps:1,h=lab.dt/subdivisions;
     applicationStep.call(lab,1);outer++;assert.equal(nativeSteps-before.nativeSteps,subdivisions,'entire source-latched outer subdivision count');assert.equal(lab.steps,before.steps+1);
     let expectedTime=before.time;for(let i=0;i<subdivisions;i++)expectedTime+=h;assert.ok(Object.is(lab.time,expectedTime),'source sequential binary64 time accumulation');assert.equal(word(lab.world.integrationParameters.dt),word(lab.dt),'source restores outer dt after all h');
     if(!stopped){stopped=Core.observePhysicalStep(request,accumulator,input)||Core.finishPhysicalHorizon(request,accumulator,input);if(stopped)terminalTime=lab.time;}
     // Controller.finishGameShot's physical-rest predicate, after the native
     // outer call; no anyMotion threshold and no goal-latch shortcut.
     if(game.pending&&!lab.cue&&lab.objects.every(o=>o.body.isSleeping()))lastGameResult=game.finish();
     lastBoundary={outer,subdivisions,h,timeBefore:before.time,timeAfter:lab.time,nativeSteps:subdivisions,cueAtEntry:before.cuePresent,cueAtExit:!!lab.cue,queryTerminal:stopped,nativeCalls:clone(currentNative),events:clone(currentEvents)};
     return snapshot({includeNative});
    }finally{busy=false;}
   },
   dispose(){if(disposed)return;assert.equal(busy,false);disposed=true;lab.onEvent=null;lab.world.step=originalWorldStep;lab.dispose();}
  });
 }catch(error){lab.onEvent=null;lab.world.step=originalWorldStep;lab.dispose();throw error;}
}
