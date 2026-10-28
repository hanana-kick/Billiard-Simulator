// SPDX-License-Identifier: Apache-2.0
// Genuine-three original initial words -> numerical cue application prefix.
// Source bodies/results are expectations only. Deferred joint solve is NOT run.
import {assertThreeBallCreatedOwnerTemplate} from './three-ball-created-owner.mjs';
import {createCueProgramBundle,executeCueForTest} from './cue-orchestration.mjs';
import {CUE_LAYOUT as C} from './cue.mjs';
import {sceneActivationTestKernels} from './scene-activation.mjs';
import {executeThreeBallCreatedInitializationForTest} from './three-ball-created-initialization.mjs';
import {wordsNumber} from './source-number.mjs';
import {equalData} from '../browser-initial-import/exact-data.mjs';
import Cue from '../experimental-cue-created-stroke-stage.js';
import Joint from '../experimental-cue-joint-stepper.js';
const owned=new WeakMap(),boundaries=new WeakMap(),copy=structuredClone,align=n=>Math.ceil(n/64)*64,key=h=>h.index+':'+h.generation;
const need=(p,m)=>{if(!p)throw Object.assign(new RangeError('Three-ball initial cue prefix: '+m),{code:'three-ball-initial-cue-prefix-unsupported'});};
const floats=a=>Array.from(new Float32Array(a.buffer,a.byteOffset,a.length));
export const THREE_BALL_INITIAL_CUE_PREFIX_CAPABILITY=Object.freeze({initialOnly:true,sourceProgramProducer:true,sourceNumberProfile:'original-js-number-v1',realSphereCount:3,realCueDynamics:2,
 currentCueBodiesFromNumericalPrograms:true,currentCueClockFromNumericalProgram:true,jointSolveDeferred:true,sourceReferenceInput:false,
 hostExecutionTestOnly:true,registrationRegionUntouched:true,cueNumericRegistrationReady:true,registrationSceneCommitted:false,inactiveCcdPreOwned:false,rigidExclusionOwned:false,floorGeometryOwned:false,worldCommits:0,physicalSteps:0,wholeH:false,nativeBoundaryVerified:false,runtimeIntegrated:false,gpuQualified:false});
const H=Object.freeze({magic:0,version:1,status:2,phase:3,ballCount:4,otherCount:5,selected:6,completed:7});
export const THREE_BALL_INITIAL_CUE_PREFIX_HEADER=H;
function kernel(){return `
fn rc_scene_three_prefix_bridge(c:u32,q:u32,b:u32)->bool{
 if(rc_state[c]!=0x52334350u||rc_state[c+1u]!=1u||rc_state[c+2u]!=1u||rc_state[c+3u]!=0u||rc_state[c+4u]!=3u||rc_state[c+5u]!=2u||rc_state[c+6u]>=3u||rc_state[c+7u]!=0u){rc_state[c+2u]=4u;return false;}
 if(rc_state[q]!=0x52434351u||rc_state[q+1u]!=1u||rc_state[q+2u]!=1u||rc_state[q+4u]!=1u||rc_state[q+5u]!=0u||rc_state[q+6u]!=0u||rc_state[q+7u]!=1u||rc_state[q+8u]!=1u||rc_state[q+9u]!=0u||rc_state[q+10u]!=2u||rc_state[q+11u]!=0u||rc_state[q+12u]!=1u||rc_state[q+13u]!=1u||rc_state[q+43u]!=0u||rc_state[q+44u]!=0u||rc_state[q+46u]!=0u||rc_state[q+47u]!=7u){rc_state[c+2u]=4u;return false;}
 for(var role=0u;role<2u;role++){
  let src=q+64u+role*48u;let dst=b+(3u+role)*64u;for(var n=0u;n<64u;n++){rc_state[dst+n]=0u;}
  for(var n=0u;n<13u;n++){rc_state[dst+n]=rc_state[src+n];}for(var n=0u;n<3u;n++){rc_state[dst+13u+n]=rc_state[src+16u+n];rc_state[dst+28u+n]=rc_state[src+29u+n];rc_state[dst+35u+n]=rc_state[src+32u+n];rc_state[dst+38u+n]=rc_state[src+35u+n];rc_state[dst+47u+n]=rc_state[src+32u+n];rc_state[dst+56u+n]=rc_state[src+13u+n];rc_state[dst+59u+n]=rc_state[q+248u+role*3u+n];}
  rc_state[dst+16u]=rc_state[src+19u];rc_state[dst+17u]=rc_state[src+20u];rc_state[dst+18u]=rc_state[src+21u];rc_state[dst+19u]=rc_state[src+20u];rc_state[dst+20u]=rc_state[src+22u];rc_state[dst+21u]=rc_state[src+23u];rc_state[dst+22u]=rc_state[src+21u];rc_state[dst+23u]=rc_state[src+23u];rc_state[dst+24u]=rc_state[src+24u];
  for(var n=0u;n<4u;n++){rc_state[dst+31u+n]=rc_state[src+25u+n];rc_state[dst+42u+n]=rc_state[src+38u+n];}rc_state[dst+62u]=rc_state[q+494u+role*30u+12u];rc_state[dst+63u]=rc_state[q+494u+role*30u+13u];
 }
 rc_state[c+3u]=1u;rc_state[c+7u]=1u;return true;
}
`;}
export function createThreeBallInitialCuePrefixPlan(template){
 need(arguments.length===1,'only locally authenticated original initial owner');assertThreeBallCreatedOwnerTemplate(template);const seed=template.seed,bundle=createCueProgramBundle();equalData(Array.from(bundle.program),Array.from(template.programs.cue),'unchanged existing cue source programs');
 const selected=seed.sourceOrigin.selectedIndex;need(seed.balls.length===3&&selected>=0&&selected<3,'exact selected sphere and two genuine others');
 const control=align(template.initialWords.length),initialWords=new Uint32Array(control+32);initialWords.set(template.initialWords);initialWords.set([0x52334350,1,1,0,3,2,selected,0],control);
 const layout=Object.freeze({bodies:template.segments.bodies.offset,cue:template.segments.cue.offset,cueWords:template.segments.cue.words,control,words:initialWords.length}),program=bundle.program.slice();
 const plan=Object.freeze({kind:'resident-three-ball-initial-cue-prefix-plan-v1',template,sourceIdentity:template.sourceIdentity,layout,initialWords,program,code:kernel(),capability:THREE_BALL_INITIAL_CUE_PREFIX_CAPABILITY});for(const a of[initialWords,program])Object.preventExtensions(a);owned.set(plan,{bundle,seals:[[initialWords,initialWords.slice()],[program,program.slice()]]});return plan;
}
export function assertThreeBallInitialCuePrefixPlan(plan){const r=owned.get(plan);need(r,'local initial prefix plan');assertThreeBallCreatedOwnerTemplate(plan.template);for(const[a,b]of r.seals){let okay=false;try{okay=a.length===b.length&&a.every((x,i)=>x===b[i]);}catch{}need(okay,'prefix words/program mutated or detached');}return plan;}
export function threeBallInitialCuePrefixTestKernels(plan,words){assertThreeBallInitialCuePrefixPlan(plan);return sceneActivationTestKernels(words,{extraWGSL:plan.code});}
async function sourcePrefix(seed){
 const stage=Cue.createReferencePreWorldStage(seed.cueInitial,{numberProfile:'original-js-number-v1'}),token={};stage.claim(token);
 try{const selected=seed.sourceOrigin.selectedIndex;return await stage.prepareApplication({selected:copy(seed.balls[selected].state),others:seed.balls.filter((_,i)=>i!==selected).map(b=>copy(b.state))},token);}finally{stage.abort(token);stage.release(token);stage.dispose();}
}
export async function executeThreeBallInitialCuePrefixForTest(plan,options={}){
 need(options&&Object.keys(options).join(',')==='testOnly'&&options.testOnly===true,'explicit testOnly only; no preSolve/state/clock/receipt inputs');assertThreeBallInitialCuePrefixPlan(plan);const r=owned.get(plan),d=plan.layout,seed=plan.template.seed,selected=seed.sourceOrigin.selectedIndex,words=plan.initialWords.slice();
 const bodies=Array.from({length:3},(_,i)=>words.slice(d.bodies+i*64,d.bodies+(i+1)*64)),cue=words.slice(d.cue,d.cue+d.cueWords);
 const output=executeCueForTest(r.bundle,cue,{mode:0,ball:bodies[selected],others:bodies.filter((_,i)=>i!==selected),testOnly:true});
 equalData(Array.from(output.ball),Array.from(bodies[selected]),'admitted initial non-touching selected sphere unchanged');words.set(output.state,d.cue);const beforeBridge=words.slice();
 need(threeBallInitialCuePrefixTestKernels(plan,words).rc_scene_three_prefix_bridge(d.control,d.cue,d.bodies),'non-touching actual deferred numerical prefix');
 // The original source is called only AFTER the candidate numerical producer;
 // none of this reference metadata is copied into its words or boundary.
 const original=await sourcePrefix(seed),m=original.metadata;
 need(m.jointSolved===false&&m.jointResult===null&&m.cuePresent&&!m.touching&&!m.birth&&!m.separation&&!m.ballStrongWake&&!m.ballMutableAccess&&m.initialization,'independent exact original non-touching initial prefix');
 equalData(original.linear,seed.balls[selected].state.linear);equalData(original.angular,seed.balls[selected].state.angular);
 const expected=Joint.pack({...seed.cueInitial.cue,...m.preSolveBodies});equalData(floats(words.subarray(d.cue+C.joint,d.cue+C.joint+144)),Array.from(expected),'all current source joint/guide/body inputs');
 for(const [role,i]of [['shaft',0],['head',1]]){
  const body=d.bodies+(3+i)*64,q=m.preSolveBodies[role];for(const[name,at,n]of [['linear',0,3],['angular',3,3],['translation',6,3],['rotation',9,4],['invMass',13,3],['localCom',56,3],['worldCom',59,3]])equalData(floats(words.subarray(body+at,body+at+n)),q[name],'original current cue '+role+' '+name);
  const ii=q.invInertia;equalData(floats(words.subarray(body+16,body+25)),[ii[0],ii[1],ii[2],ii[1],ii[3],ii[4],ii[2],ii[4],ii[5]],'actual source symmetric cue inertia');
  const expectedBody=new Float32Array(64);for(const[name,at]of [['linear',0],['angular',3],['translation',6],['rotation',9],['invMass',13],['invPrincipalInertia',28],['principalFrame',31],['userForce',35],['userTorque',38],['userForce',47],['localCom',56],['worldCom',59]])expectedBody.set(q[name],at);
  expectedBody.set([ii[0],ii[1],ii[2],ii[1],ii[3],ii[4],ii[2],ii[4],ii[5]],16);expectedBody.set([q.linearDamping,q.angularDamping,+q.gyroscopic,+q.allowFastRotation],42);
  const registeredBody=m.initialization.bodies.find(b=>key(b.handle)===key(seed.cueBroadSeed.roles[role]));need(registeredBody,'source registered cue identity');expectedBody.set([registeredBody.maxExtent,seed.cueInitial.ccd[role].ccdThickness],62);
  equalData(Array.from(words.subarray(body,body+64)),Array.from(new Uint32Array(expectedBody.buffer)),'every canonical current cue word, including distinct COM and unused ABI sentinels');
 }
 const registration=executeThreeBallCreatedInitializationForTest(plan.template.registration,{testOnly:true}),init=plan.template.registration.layout.numericOutputs;
 equalData(Array.from(words.subarray(d.cue+C.initialOutputs,d.cue+C.initialOutputs+90)),Array.from(registration.words.subarray(init,init+90)),'all original registration numerical outputs');equalData(registration.initialized,m.initialization,'full original registered scene comparison only');
 const clock={time:wordsNumber(words.subarray(d.cue+20,d.cue+22)),elapsed:wordsNumber(words.subarray(d.cue+22,d.cue+24)),h:wordsNumber(words.subarray(d.cue+24,d.cue+26)),frame:words[d.cue+7],outerSubstep:words[d.cue+8]};equalData(clock.time,m.simulationTime,'source binary64 cue time');equalData(clock.h,m.sourceH,'source original h');equalData(clock.elapsed,seed.cueInitial.application.initialElapsed+m.sourceH,'source binary64 elapsed');
 const roles=['head','shaft','guide','ball'],calls=Array.from({length:words[d.cue+10]},(_,i)=>{const at=d.cue+C.mutableCalls+i*3;return{body:roles[words[at]],strongWake:!!words[at+1]};});equalData(calls,m.mutableBodyCalls,'source exact mutable API call order');
 const receipt=Object.freeze({kind:'original-three-ball-numerical-cue-prefix-boundary-v1',sourceIdentity:plan.sourceIdentity,actualSphereCount:3,actualOtherCount:2,currentCuePrefix:true,jointSolved:false,worldCommitted:false});
 const result=Object.freeze({kind:'resident-three-ball-initial-cue-prefix-host-test-result-v1',plan,layout:d,sourceIdentity:plan.sourceIdentity,capability:THREE_BALL_INITIAL_CUE_PREFIX_CAPABILITY,words,beforeBridge,receipt,clock:Object.freeze(clock),mutableBodyCalls:calls,history:copy(seed.history),sourceExpected:{preparation:m,registered:m.initialization}});
 boundaries.set(receipt,{plan,result,seal:words.slice()});return result;
}
export function assertThreeBallInitialCuePrefixBoundary(receipt,template){
 need(arguments.length===2,'exact local receipt and original owner identity');const r=boundaries.get(receipt);need(r&&r.plan.template===template,'local prefix from this exact original owner, not copied/hash-only state');assertThreeBallInitialCuePrefixPlan(r.plan);let okay=false;try{okay=r.result.words.length===r.seal.length&&r.result.words.every((x,i)=>x===r.seal[i]);}catch{}need(okay,'current numerical cue boundary mutated/detached');return r.result;
}
export function assertThreeBallInitialCuePrefixResult(result,options){
 need(arguments.length===2&&options&&Object.keys(options).join(',')==='template','exact local result and original template only');
 need(result&&assertThreeBallInitialCuePrefixBoundary(result.receipt,options.template)===result,'original result identity, not copied projection');return result;
}
