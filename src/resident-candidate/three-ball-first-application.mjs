// SPDX-License-Identifier: Apache-2.0
// Actual PhysicsLab initial-h application boundary, after the sealed physical
// BVH/journal. No second cue joint solve; no inferred event-free trajectory.
import {assertThreeBallFirstBroadPostPlan,executeThreeBallFirstPhysicalBroadPostForTest,assertThreeBallFirstPhysicalBroadPostResult,assertThreeBallFirstFinalMassBroadPostResult} from './three-ball-first-broad-post.mjs';
import {executeThreeBallFirstPostPatch,finishThreeBallFirstPost,THREE_BALL_FIRST_POST_HEADER as P} from './three-ball-first-post.mjs';
import {THREE_BALL_FIRST_CUE_HEADER as Q} from './three-ball-first-cue.mjs';
import {assertThreeBallFirstFinalMassPlan} from './three-ball-first-final-mass.mjs';
import {CUE_LAYOUT as C} from './cue.mjs';
import {createCueProgramBundle} from './cue-orchestration.mjs';
import {executeLowered} from './numeric-program.mjs';
import {SCENE_LAYOUT as S,sceneActivationTestKernels} from './scene-activation.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from './contact-journal.mjs';
import {createApplicationPrograms} from './application.mjs';
import {executeSourceNumberProgramReference} from './raw-strike.mjs';
import {numberWords,wordsNumber} from './source-number.mjs';
import {equalData} from '../browser-initial-import/exact-data.mjs';
import Joint from '../experimental-cue-joint-stepper.js';
import Cue from '../experimental-cue-created-stroke-stage.js';
const owned=new WeakMap(),receipts=new WeakMap(),copy=structuredClone,align=n=>Math.ceil(n/64)*64;
const need=(p,m)=>{if(!p)throw Object.assign(new RangeError('Three-ball first application: '+m),{code:'three-ball-first-application-unsupported'});};
const floats=a=>Array.from(new Float32Array(a.buffer,a.byteOffset,a.length));
const freeze=x=>{if(x&&typeof x==='object'&&!ArrayBuffer.isView(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
function differences(a,b,p='',out=[]){if(out.length>=12)return out;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))differences(a[k],b[k],p+'.'+k,out);}else if(!Object.is(a,b))out.push([p,a,b]);return out;}
export const THREE_BALL_FIRST_APPLICATION_CAPABILITY=Object.freeze({initialOnly:true,hostSourceCompositionOnly:true,actualSpheres:3,actualCueDynamics:2,
 actualPhysicsLabApplicationOrder:true,oneExistingJointResultAdoption:true,sourceBinary64Clock:true,producedNoEmissionProofRequired:true,fullInitialEventHistory:true,
 latchedSubdivisions:64,completedInnerSubsteps:1,completedOuterSteps:0,nativeBoundaryVerified:false,nativeWholeHVerified:false,generalCcd:false,
 completeResidentRecurrence:false,worldCommit:false,wholeH:false,runtimeIntegrated:false,gpuQualified:false});
export const THREE_BALL_FIRST_FINAL_MASS_APPLICATION_CAPABILITY=Object.freeze({...THREE_BALL_FIRST_APPLICATION_CAPABILITY,nativeFinalMassProjection:true,sourceComponentCuePreservedSeparately:true});
const H=Object.freeze({magic:0,version:1,status:2,phase:3,adopted:4,eventAdmission:5,completed:6,outerSubdivisions:7,outerSubstep:8,finalMassAdopted:9,sourceTime:10,sourceH:12,sourceDt:14,sourceStarted:16,sourceSteps:18});
export const THREE_BALL_FIRST_APPLICATION_HEADER=H;
function kernel(d,joint,edges,finalMass){return `
fn rc_scene_three_app_fail(c:u32)->bool{rc_state[c+2u]=4u;return false;}
fn rc_scene_three_app_adopt(c:u32,q:u32,bridge:u32,input:u32,out:u32)->bool{
 if(rc_state[c]!=0x52334150u||rc_state[c+1u]!=1u||rc_state[c+2u]!=1u||rc_state[c+3u]!=0u||rc_state[c+4u]!=0u||rc_state[c+7u]!=64u||rc_state[c+8u]!=0u||rc_state[${S.header.phase}u]!=6u||rc_state[bridge+${Q.completed}u]!=1u||rc_state[bridge+${Q.ccdMask}u]!=3u){return rc_scene_three_app_fail(c);}
 if(rc_state[q+2u]!=1u||rc_state[q+4u]!=1u||rc_state[q+5u]!=0u||rc_state[q+6u]!=0u||rc_state[q+7u]!=1u||rc_state[q+8u]!=1u||rc_state[q+9u]!=0u||rc_state[q+11u]!=0u||rc_state[q+12u]!=1u||rc_state[q+47u]!=7u){return rc_scene_three_app_fail(c);}
 for(var n=0u;n<144u;n++){if(rc_state[q+64u+n]!=rc_state[input+n]){return rc_scene_three_app_fail(c);}}
 ${joint.bodyLayout.map((at,i)=>`for(var n=0u;n<13u;n++){rc_state[q+64u+${i*48}u+n]=rc_state[out+${at}u+n];}for(var n=0u;n<6u;n++){rc_state[q+64u+${i*48+19}u+n]=rc_state[out+${at+13}u+n];}`).join('')}
 for(var n=0u;n<10u;n++){rc_state[q+584u+n]=rc_state[out+${joint.impulsesOffset}u+n];}rc_state[q+12u]=0u;rc_state[c+4u]=1u;rc_state[c+3u]=1u;return true;
}
fn rc_scene_three_app_clock(c:u32,q:u32,out:u32)->bool{
 if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+4u]!=1u||rc_state[out+31u]!=1u||rc_state[out+4u]!=0u||rc_state[out]!=rc_state[q+20u]||rc_state[out+1u]!=rc_state[q+21u]){return rc_scene_three_app_fail(c);}rc_state[c+20u]=rc_state[out];rc_state[c+21u]=rc_state[out+1u];rc_state[c+3u]=2u;return true;
}
fn rc_scene_three_app_observe_and_drain(c:u32,q:u32,j:u32,cache:u32)->bool{
 if(rc_state[c+2u]!=1u||rc_state[c+3u]!=2u||rc_state[c+5u]!=0u||rc_state[j]!=0u||rc_state[j+${J.header.phase}u]!=0u||rc_state[j+${J.header.sequence}u]!=1u||rc_state[j+${J.header.colliders}u]!=25u||rc_state[j+${J.header.edges}u]!=3u||rc_state[j+${J.header.events}u]!=0u||rc_state[j+${J.header.cueCount}u]!=3u||rc_state[j+${J.header.cuePresent}u]!=1u||rc_state[q+43u]!=0u||rc_state[q+44u]!=0u||rc_state[q+45u]!=0u){return rc_scene_three_app_fail(c);}
 // Complete current graph, not a zero-velocity guess: no cue collider has a
 // contact pair, and every existing pair has the actual original floor cache.
 for(var n=0u;n<3u;n++){let e=j+${J.edgeOffset}u+n*${J.edgeStride}u;let x=rc_state[e];let y=rc_state[e+1u];if(x>=25u||y>=25u||rc_state[e+2u]!=1u||rc_state[e+3u]!=n+1u||rc_state[e+4u]!=0u){return rc_scene_three_app_fail(c);}${edges.map((row,i)=>`if(n==${i}u&&(${row.map((value,k)=>`rc_state[e+${k}u]!=${value}u`).join('||')})){return rc_scene_three_app_fail(c);}`).join('')}let a=j+${J.colliderOffset}u+x*${J.colliderStride}u;let b=j+${J.colliderOffset}u+y*${J.colliderStride}u;if(rc_state[a+${J.collider.cue}u]!=0u||rc_state[b+${J.collider.cue}u]!=0u||rc_state[a+${J.collider.live}u]!=1u||rc_state[b+${J.collider.live}u]!=1u){return rc_scene_three_app_fail(c);}let p=cache+n*144u;for(var k=128u;k<132u;k++){if(rc_state[p+k]!=1u){return rc_scene_three_app_fail(c);}}}
 rc_state[c+5u]=1u;rc_state[c+3u]=3u;return true;
}
fn rc_scene_three_app_finish(c:u32,q:u32,p:u32,clock:u32)->bool{
 if(rc_state[c+2u]!=1u||rc_state[c+3u]!=3u||rc_state[c+4u]!=1u||rc_state[c+5u]!=1u||rc_state[c+6u]!=0u${finalMass?'||rc_state[c+9u]!=1u':''}||rc_state[p+${P.completed}u]!=1u||rc_state[${S.header.phase}u]!=3u||rc_state[clock+4u]!=0u||rc_state[q+4u]!=1u||rc_state[q+12u]!=0u){return rc_scene_three_app_fail(c);}rc_state[c+8u]=1u;rc_state[c+3u]=4u;rc_state[c+6u]=1u;return true;
}
`;}
function finalMassKernel(d,physical){const mass=physical.massPlan,m=d.massState;return `
fn rc_scene_three_app_final_mass()->bool{
 let c=${d.applicationControl}u;let q=${d.cue}u;let m=${m}u;
 if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+4u]!=1u||rc_state[c+9u]!=0u||rc_state[q+12u]!=0u||rc_state[m+2u]!=1u||rc_state[m+3u]!=3u||rc_state[m+5u]!=1u||(rc_state[m+6u]&24u)!=24u){return rc_scene_three_app_fail(c);}
 // Full physical mass refresh already happened before broad post. This only
 // reconciles cue metadata after the old component's joint adoption/check.
 for(var i=0u;i<2u;i++){let body=${d.bodies}u+(3u+i)*64u;let out=m+${mass.layout.output}u+(3u+i)*12u;let cue=q+64u+i*48u;
  for(var n=0u;n<3u;n++){if(rc_state[body+59u+n]!=rc_state[out+n]||rc_state[body+13u+n]!=rc_state[out+3u+n]||rc_state[cue+16u+n]!=rc_state[out+3u+n]){return rc_scene_three_app_fail(c);}}
  for(var n=0u;n<6u;n++){if(rc_state[cue+19u+n]!=rc_state[out+6u+n]){return rc_scene_three_app_fail(c);}}
 }
 for(var i=0u;i<2u;i++){for(var n=0u;n<3u;n++){rc_state[q+248u+i*3u+n]=rc_state[${d.bodies}u+(3u+i)*64u+59u+n];}}rc_state[c+9u]=1u;return true;
}
`;}
export function createThreeBallFirstApplicationPlan(physical){need(arguments.length===1,'one locally branded physical plan');return createPlan(physical,false);}
export function createThreeBallFirstFinalMassApplicationPlan(physical){need(arguments.length===1,'one locally branded final-mass physical plan');return createPlan(physical,true);}
function createPlan(physical,finalMass){
 assertThreeBallFirstBroadPostPlan(physical);need(physical.physical===true,'legacy post-application broad receipt is not a physical boundary');need(!!physical.finalMass===finalMass,'distinct source-component/final-mass application factory required');if(finalMass)assertThreeBallFirstFinalMassPlan(physical.massPlan);const seed=physical.template.seed,app=seed.application,joint=Joint.buildPlan(),programs=createApplicationPrograms(),clock=programs.entries.clock.compiled,cuePrograms=createCueProgramBundle();equalData(Array.from(cuePrograms.program),Array.from(physical.template.programs.cue),'same unchanged original cue numerical programs');
 need(app.strokeSubsteps===64&&Number.isSafeInteger(app.steps)&&app.steps>=0,'authentic initial latched subdivision/outer-step metadata');
 const control=align(physical.initialWords.length),clockOutput=control+64,initialWords=new Uint32Array(clockOutput+32);initialWords.set(physical.initialWords);initialWords.set([0x52334150,1,1,0,0,0,0,64,0],control);
 for(const[at,value]of [[10,app.time],[12,app.dt/app.strokeSubsteps],[14,app.dt],[16,seed.cueInitial.application.started],[18,app.steps]])initialWords.set(numberWords(value),control+at);
 const layout=Object.freeze({...physical.layout,physicalControl:physical.layout.control,applicationControl:control,helperTorque:control+32,clockOutput,cue:physical.template.segments.cue.offset,words:initialWords.length}),program=clock.words.slice(),prefixProgram=cuePrograms.program.slice();
 need(initialWords[layout.journal+J.header.edges]===3,'exact original three-floor graph');const edges=Array.from({length:3},(_,i)=>Array.from(initialWords.subarray(layout.journal+J.edgeOffset+i*J.edgeStride,layout.journal+J.edgeOffset+i*J.edgeStride+5)));
 const plan=Object.freeze({kind:finalMass?'resident-three-ball-first-final-mass-application-plan-v1':'resident-three-ball-first-application-plan-v1',finalMass,physical,sourceIdentity:physical.sourceIdentity,layout,initialWords,program,prefixProgram,code:kernel(layout,joint,edges,finalMass)+(finalMass?finalMassKernel(layout,physical):''),capability:finalMass?THREE_BALL_FIRST_FINAL_MASS_APPLICATION_CAPABILITY:THREE_BALL_FIRST_APPLICATION_CAPABILITY});const arrays=[initialWords,program,prefixProgram];for(const a of arrays)Object.preventExtensions(a);owned.set(plan,{clock,joint,cuePrograms,seals:arrays.map(a=>[a,a.slice()])});return plan;
}
export function assertThreeBallFirstApplicationPlan(plan){const r=owned.get(plan);need(r,'local original application plan');assertThreeBallFirstBroadPostPlan(plan.physical);need(plan.physical.physical===true&&!!plan.physical.finalMass===plan.finalMass,'exact physical/source-final-mass profile');if(plan.finalMass)assertThreeBallFirstFinalMassPlan(plan.physical.massPlan);for(const[a,b]of r.seals){let okay=false;try{okay=a.length===b.length&&a.every((x,i)=>x===b[i]);}catch{}need(okay,'application words/program mutated or detached');}return plan;}
export function threeBallFirstApplicationTestKernels(plan,words){assertThreeBallFirstApplicationPlan(plan);return sceneActivationTestKernels(words,{extraWGSL:plan.code});}
function decodeCue(plan,words){
 const seed=plan.physical.template.seed,d=plan.layout,q=d.cue,body=copy(seed.cueInitial.cue),num=at=>wordsNumber(words.subarray(q+at,q+at+2)),read=(at,n)=>floats(words.subarray(q+at,q+at+n));
 for(const[role,i]of [['shaft',0],['head',1]]){const at=64+i*48;for(const[name,offset,n]of [['linear',0,3],['angular',3,3],['translation',6,3],['rotation',9,4],['localCom',13,3],['invMass',16,3],['invInertia',19,6],['principalFrame',25,4],['invPrincipalInertia',29,3],['userForce',32,3],['userTorque',35,3]])body[role][name]=read(at+offset,n);body[role].worldCom=read(248+i*3,3);}
 const impulses=read(C.jointImpulses,10),flex=body.joints[0],guide=body.joints[1];flex.impulses[0]=impulses[3];for(let i=0;i<3;i++){flex.impulses[i+3]=impulses[i];guide.impulses[i+3]=impulses[i+4];}guide.impulses[1]=impulses[7];guide.impulses[2]=impulses[8];guide.limitImpulses[0]=impulses[9];
 const ccd=copy(seed.cueInitial.ccd);for(const[role,i]of [['shaft',0],['head',1]])ccd[role].maxExtent=read(C.initialOutputs+i*30+12,1)[0];
 for(const[role,i]of [['shaft',0],['head',1]])body[role].torque=[0,1,2].map(j=>wordsNumber(words.subarray(d.helperTorque+i*6+j*2,d.helperTorque+i*6+j*2+2)));
 return{referenceNumberProfile:'original-js-number-v1',cue:body,present:!!words[q+4],active:!!words[q+5],contacted:!!words[q+6],tangent:[0,1,2].map(i=>num(26+i*2)),time:num(20),elapsed:num(22),frame:words[q+7],outerSubstep:words[q+8],ccd,contactEpisodes:words[q+9],firstContact:words[q+40]?num(32):null,lastContact:words[q+41]?num(34):null};
}
/** TEST projection only; does not admit, run, seal or publish a phase. */
export function decodeThreeBallFirstCueWordsForTest(plan,words,{testOnly=false}={}){need(testOnly===true,'explicit cue projection test');assertThreeBallFirstApplicationPlan(plan);need(words instanceof Uint32Array&&words.length>=plan.layout.words,'complete represented application bank');return decodeCue(plan,words);}
// Original sourceReference retains applyImpulse's diagnostic torque on q.body.
// It is not native force/torque and is absent from Joint.pack. Re-evaluate only
// the unchanged initial COM/lateral program to retain that helper field exactly;
// this does not apply another impulse or execute another joint solve.
function retainInitialHelperTorque(plan,words){
 const bundle=owned.get(plan).cuePrograms,initial=plan.physical.template.initialWords,base=plan.layout.cue,q=base+64,read=(at,n)=>floats(initial.subarray(at,at+n)),num=at=>wordsNumber(initial.subarray(at,at+2));
 const com=Array.from(executeLowered(bundle.entries[1].compiled,Float32Array.from([...read(q+6,7),...read(q+13,3),...read(q+54,7),...read(q+61,3)]),{testOnly:true})),constants=Array.from({length:13},(_,i)=>num(base+C.applicationConstants+i*2));
 const input=[...read(q+54,3),...read(q+6,3),...com.slice(3,6),...com.slice(0,3),...read(q+48,3),...read(q,3),...read(q+51,3),...read(q+3,3),...read(q+64,3),...read(q+16,3),...read(q+19,6),...constants.slice(0,6)],out=executeSourceNumberProgramReference(bundle.numbers[0],input);need(out.done&&out.raw[94]===1,'original initial lateral helper output');
 words.set(out.raw.subarray(36,42),plan.layout.helperTorque);
 // Original head applyImpulse is point=null: torque is literally [0,0,0].
 // The admitted no-contact tip branch preserves it; active tip is rejected.
 need(words[base+5]===0&&words[base+43]===0&&words[base+45]===0,'no tip helper may replace lateral torque');for(let i=0;i<3;i++)words.set(numberWords(0),plan.layout.helperTorque+6+i*2);
}
async function originalCueSnapshot(seed){const stage=Cue.createReferencePreWorldStage(seed.cueInitial,{numberProfile:'original-js-number-v1'}),token={};stage.claim(token);try{const selected=seed.sourceOrigin.selectedIndex;await stage.prepareApplication({selected:copy(seed.balls[selected].state),others:seed.balls.filter((_,i)=>i!==selected).map(b=>copy(b.state))},token);await stage.solvePrepared(token);stage.assertPrepared(token);stage.commit(token);return stage.snapshot();}finally{stage.abort(token);stage.release(token);stage.dispose();}}
export async function executeThreeBallFirstApplicationForTest(plan,options={}){
 need(options&&Object.keys(options).join(',')==='testOnly'&&options.testOnly===true,'explicit testOnly; no physical/history/clock/joint overrides');assertThreeBallFirstApplicationPlan(plan);const physical=await executeThreeBallFirstPhysicalBroadPostForTest(plan.physical,{testOnly:true});if(!physical.available)return{kind:'resident-three-ball-first-application-host-test-result-v1',available:false,reason:physical.reason,capability:plan.capability};
 assertThreeBallFirstPhysicalBroadPostResult(physical,{plan:plan.physical});if(plan.finalMass)assertThreeBallFirstFinalMassBroadPostResult(physical,{plan:plan.physical});const d=plan.layout,seed=plan.physical.template.seed,r=owned.get(plan),words=plan.initialWords.slice();words.set(physical.words);const k=threeBallFirstApplicationTestKernels(plan,words),before=words.slice();
 need(k.rc_scene_three_app_adopt(d.applicationControl,d.cue,d.cueControl,d.input,d.output),'one existing exact current joint output adoption');
 retainInitialHelperTorque(plan,words);let cue=decodeCue(plan,words);const sourceComponentCue=freeze(copy(cue)),sourceCue=await originalCueSnapshot(seed);equalData(cue,sourceCue,'complete original cue committed component: '+JSON.stringify(differences(cue,sourceCue)));
 if(plan.finalMass){need(k.rc_scene_three_app_final_mass(),'native final mass must follow component adoption and precede application clock');cue=decodeCue(plan,words);}
 const input=[10,12,10,16].map(at=>wordsNumber(words.subarray(d.applicationControl+at,d.applicationControl+at+2))),clock=executeSourceNumberProgramReference(r.clock,input);need(clock.done,'original binary64 time+=h');words.set(clock.raw,d.clockOutput);words[d.clockOutput+31]=1;need(k.rc_scene_three_app_clock(d.applicationControl,d.cue,d.clockOutput),'actual application time agrees with source cue clock');
 need(k.rc_scene_three_app_observe_and_drain(d.applicationControl,d.cue,d.journal,d.caches),'unknown/active cue or current collision events need actual event owner');
 const afterPhysicalAdmission=words.slice(),numeric=physical.post.cue.numerical;for(let i=0;i<3;i++)executeThreeBallFirstPostPatch(plan.physical.post,words,numeric,i);const postApplication=finishThreeBallFirstPost(plan.physical.post,words,numeric);
 need(k.rc_scene_three_app_finish(d.applicationControl,d.cue,d.postControl,d.clockOutput),'source timed withdrawal must be false in initial admitted profile');
 const application=freeze({time:wordsNumber(words.subarray(d.applicationControl+20,d.applicationControl+22)),steps:wordsNumber(words.subarray(d.applicationControl+H.sourceSteps,d.applicationControl+H.sourceSteps+2)),dt:seed.application.dt,latchedSubdivisions:words[d.applicationControl+7],outerSubstep:words[d.applicationControl+8],events:copy(seed.history.createdEvents),game:copy(seed.game),cuePresent:true});
 equalData(application.steps,seed.application.steps,'outer step/trail bookkeeping has not run');equalData(application.events,seed.application.events,'full original created event history preserved by admitted no-emission branch');
 const receipt=Object.freeze({kind:plan.finalMass?'original-three-ball-initial-final-mass-application-boundary-host-receipt-v1':'original-three-ball-initial-application-boundary-host-receipt-v1',sourceIdentity:plan.sourceIdentity,innerSubsteps:1,outerSteps:0,emissions:0,worldCommitted:false,nativeParity:false});const result=Object.freeze({kind:'resident-three-ball-first-application-host-test-result-v1',available:true,plan,sourceIdentity:plan.sourceIdentity,capability:plan.capability,words,before,afterPhysicalAdmission,physical,cue:freeze(cue),...(plan.finalMass?{sourceComponentCue}:{}),application,postApplication,history:freeze(copy(seed.history)),receipt});receipts.set(receipt,{plan,result,words,sealed:words.slice()});return result;
}
export function assertThreeBallFirstApplicationResult(result,options){need(arguments.length===2&&options&&Object.keys(options).join(',')==='plan','original exact plan and result');const r=receipts.get(result?.receipt);need(r&&r.result===result&&r.plan===options.plan,'locally completed original application result');assertThreeBallFirstApplicationPlan(r.plan);assertThreeBallFirstPhysicalBroadPostResult(result.physical,{plan:r.plan.physical});if(r.plan.finalMass)assertThreeBallFirstFinalMassBroadPostResult(result.physical,{plan:r.plan.physical});let okay=false;try{okay=r.words.length===r.sealed.length&&r.words.every((x,i)=>x===r.sealed[i]);}catch{}need(okay,'application draft mutated/detached');return result;}
