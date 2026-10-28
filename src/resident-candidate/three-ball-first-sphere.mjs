// SPDX-License-Identifier: Apache-2.0
// Genuine initial while-cue: current energy/roster -> cue solve/postchecks ->
// three-sphere solve/writeback -> sphere postchecks. No cache/world/app commit.
import {assertThreeBallFirstCuePlan,executeThreeBallFirstCueSphereSourceForTest,THREE_BALL_FIRST_CUE_HEADER as Q} from './three-ball-first-cue.mjs';
import {threeBallSolverTestKernels} from './three-ball-first-numerical.mjs';
import {THREE_BALL_SOLVER_LAYOUT as L} from './three-ball-solver.mjs';
import {createCoupledProgramBundle,executeCoupledForTest} from './coupled-solver.mjs';
import {SCENE_LAYOUT as S,sceneActivationTestKernels} from './scene-activation.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from './contact-journal.mjs';
import {packWorldCcdBody} from './ccd.mjs';
import {compileGraph,executeLowered} from './numeric-program.mjs';
import {equalData} from '../browser-initial-import/exact-data.mjs';
import CCD from '../experimental-ccd-inactive.js';
import {assertThreeBallFirstPostPlan,beginThreeBallFirstPost,executeThreeBallFirstPostFat,executeThreeBallFirstPostPatch,finishThreeBallFirstPost} from './three-ball-first-post.mjs';
const owned=new WeakMap(),receipts=new WeakMap(),copy=structuredClone,key=h=>h.index+':'+h.generation,align=n=>Math.ceil(n/64)*64;
const need=(p,m)=>{if(!p)throw Object.assign(new RangeError('Three-ball first sphere: '+m),{code:'three-ball-first-sphere-unsupported'});};
const bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0],numbers=a=>Array.from(new Float32Array(a.buffer,a.byteOffset,a.length));
export const THREE_BALL_FIRST_SPHERE_CAPABILITY=Object.freeze({hostSourceComponentOnly:true,realSphereCount:3,realCueDynamicCount:2,
 firstInitialInactiveWhileCueOnly:true,allActualPrePostPredicatesRequired:true,generalCcdPassAuthority:false,nativeInternalBoundaryVerified:false,
 cacheFatCommit:false,bvhCommit:false,journalCommit:false,applicationCommit:false,worldCommits:0,physicalSteps:0,wholeH:false,runtimeIntegrated:false,gpuQualified:false});
const H=Object.freeze({magic:0,version:1,status:2,phase:3,awakeMask:4,postMask:5,completed:6,epoch:7,sequence:8,dt:9});
export const THREE_BALL_FIRST_SPHERE_HEADER=H;
function kernel(){return `
fn rc_scene_three_sphere_fail(s:u32,c:u32)->bool{rc_state[c+2u]=4u;return rc_scene_bad(s,6u);}
fn rc_scene_three_sphere_begin(s:u32,j:u32,q:u32,w:u32,c:u32,common:u32)->bool{
 if(rc_state[c]!=0x52335350u||rc_state[c+1u]!=1u||rc_state[c+2u]!=1u||rc_state[c+3u]!=0u||rc_state[c+6u]!=0u||rc_state[q+${Q.completed}u]!=1u||rc_state[q+${Q.phase}u]!=3u||rc_state[q+${Q.ccdMask}u]!=3u||rc_state[q+${Q.status}u]!=1u||rc_state[s+${S.header.phase}u]!=6u||rc_state[j+${J.header.sequence}u]!=1u||rc_state[j+${J.header.edges}u]!=3u||rc_state[w]!=0u||rc_state[w+1u]!=1u){return rc_scene_three_sphere_fail(s,c);}
 if(rc_state[common]!=rc_state[c+9u]||rc_state[q+${Q.dt}u]!=rc_state[c+9u]||rc_state[w+2u]>3u||rc_state[w+3u]>3u){return rc_scene_three_sphere_fail(s,c);}
 var awake=0u;var count=0u;for(var n=0u;n<3u;n++){let bind=c+16u+n*4u;let slot=rc_state[bind+2u];let b=rc_scene_bp(s,slot);if(!rc_scene_valid_body(s,slot)||rc_state[b+${S.body.index}u]!=rc_state[bind]||rc_state[b+${S.body.generation}u]!=rc_state[bind+1u]||rc_state[b+${S.body.dynamic}u]!=1u){return rc_scene_three_sphere_fail(s,c);}if(rc_state[b+${S.body.activation+4}u]==0u){awake=awake|(1u<<n);count++;}}
 if(rc_state[w+2u]!=count||rc_state[common+${L.coupled.rosterBase}u]!=count||rc_state[common+${L.coupled.rosterBase+1}u]!=rc_state[w+3u]){return rc_scene_three_sphere_fail(s,c);}
 rc_state[c+4u]=awake;rc_state[c+5u]=0u;rc_state[c+7u]=rc_state[s+${S.header.epoch}u];rc_state[c+8u]=rc_state[j+${J.header.sequence}u];rc_state[c+3u]=1u;return true;
}
fn rc_scene_three_sphere_post_input(s:u32,b:u32,w:u32,c:u32,input:u32,n:u32)->bool{
 if(n>=3u||rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[w]!=0u||rc_state[w+1u]!=2u||rc_state[c+7u]!=rc_state[s+${S.header.epoch}u]||(rc_state[c+4u]&(1u<<n))==0u||(rc_state[c+5u]&(1u<<n))!=0u||rc_state[input+36u]!=rc_state[c+9u]){return false;}
 for(var k=0u;k<7u;k++){rc_state[input+37u+k]=rc_state[b+n*64u+6u+k];}return true;
}
fn rc_scene_three_sphere_post_finish(s:u32,c:u32,out:u32,n:u32)->bool{
 if(n>=3u||rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+7u]!=rc_state[s+${S.header.epoch}u]||(rc_state[c+4u]&(1u<<n))==0u||(rc_state[c+5u]&(1u<<n))!=0u||rc_state[out+17u]!=0u||rc_state[out+18u]!=0x3f800000u){return rc_scene_three_sphere_fail(s,c);}rc_state[c+5u]=rc_state[c+5u]|(1u<<n);return true;
}
fn rc_scene_three_sphere_complete(s:u32,j:u32,w:u32,c:u32)->bool{
 if(rc_state[c+2u]!=1u||rc_state[c+3u]!=1u||rc_state[c+6u]!=0u||rc_state[w]!=0u||rc_state[w+1u]!=2u||rc_state[c+7u]!=rc_state[s+${S.header.epoch}u]||rc_state[c+8u]!=rc_state[j+${J.header.sequence}u]||rc_state[c+4u]!=rc_state[c+5u]){return rc_scene_three_sphere_fail(s,c);}rc_state[c+3u]=2u;rc_state[c+6u]=1u;return true;
}
`;}
export function createThreeBallFirstSpherePlan(cue){
 need(arguments.length===1,'only locally branded original first-cue plan');assertThreeBallFirstCuePlan(cue);const seed=cue.numerical.first.template.seed,bundle=createCoupledProgramBundle(),postPlan=CCD.sourcePlans().post,post=compileGraph(postPlan);
 const control=align(cue.initialWords.length),ccdInputs=control+64,ccdOutputs=ccdInputs+3*80,words=align(ccdOutputs+3*20),initialWords=new Uint32Array(words);initialWords.set(cue.initialWords);initialWords.set([0x52335350,1,1,0,0,0,0,0,0,bits(seed.balls[0].state.dt)],control);
 seed.balls.forEach((b,i)=>{const slot=cue.numerical.first.template.bindings.find(x=>x.canonicalIndex===i).sceneSlot;initialWords.set([b.body.index,b.body.generation,slot,i],control+16+i*4);initialWords.set(packWorldCcdBody(b.state),ccdInputs+i*80);});
 const layout=Object.freeze({...cue.layout,cueControl:cue.layout.control,sphereControl:control,ccdInputs,sphereCcdOutputs:ccdOutputs,words}),programs=Object.freeze({coupled:bundle.program.slice(),post:post.program.slice()});
 const plan=Object.freeze({kind:'resident-three-ball-first-sphere-plan-v1',cue,sourceIdentity:cue.sourceIdentity,layout,initialWords,programs,code:kernel(),capability:THREE_BALL_FIRST_SPHERE_CAPABILITY});const seals=[initialWords,...Object.values(programs)];for(const a of seals)Object.preventExtensions(a);owned.set(plan,{bundle,postPlan,seals:seals.map(a=>[a,a.slice()])});return plan;
}
export function assertThreeBallFirstSpherePlan(plan){const p=owned.get(plan);need(p,'local original sphere plan');assertThreeBallFirstCuePlan(plan.cue);for(const[a,b]of p.seals){let okay=false;try{okay=a.length===b.length&&a.every((x,i)=>x===b[i]);}catch{}need(okay,'sphere input/program mutated or detached');}return plan;}
export function threeBallFirstSphereTestKernels(plan,words){assertThreeBallFirstSpherePlan(plan);return sceneActivationTestKernels(words,{extraWGSL:plan.code});}
export async function executeThreeBallFirstSphereForTest(plan,options={}){
 return executeSphere(plan,options,null);
}
/** Internal sealed post composition; no arbitrary stage callbacks accepted. */
export async function executeThreeBallFirstSpherePostForTest(postPlan,options={}){
 assertThreeBallFirstPostPlan(postPlan);return executeSphere(postPlan.sphere,options,postPlan);
}
export async function executeThreeBallFirstSpherePhysicalForTest(postPlan,options={}){
 assertThreeBallFirstPostPlan(postPlan);return executeSphere(postPlan.sphere,options,postPlan,true);
}
async function executeSphere(plan,options,postPlan,physicalOnly=false){
 need(options&&Object.keys(options).join(',')==='testOnly'&&options.testOnly===true,'explicit testOnly; no body/geometry/dt/result input');assertThreeBallFirstSpherePlan(plan);
 const cue=await executeThreeBallFirstCueSphereSourceForTest(plan.cue,{testOnly:true});if(!cue.available)return{kind:'resident-three-ball-first-sphere-host-test-result-v1',available:false,reason:cue.reason,capability:THREE_BALL_FIRST_SPHERE_CAPABILITY,cue};
 const p=owned.get(plan),d=plan.layout,seed=plan.cue.numerical.first.template.seed,words=(postPlan??plan).initialWords.slice();words.set(cue.words);const k=threeBallFirstSphereTestKernels(plan,words),numeric=cue.numerical;
 need(numeric.gathered.available&&numeric.ccd.every(c=>c.skippedSleeping||c.admitted)&&cue.checks.every(c=>c.admitted&&!c.active),'every actual source pre-predicate and cue post-predicate');
 need(k.rc_scene_three_sphere_begin(0,d.journal,d.cueControl,d.solver,d.sphereControl,d.coupled),'completed cue must precede actual sphere solve');if(postPlan)beginThreeBallFirstPost(postPlan,words,numeric);const beforeSolve=words.slice();
 if(numeric.gathered.bodyCount)words.set(executeCoupledForTest(p.bundle,words,{testOnly:true,stateBase:d.coupled,coefficientBase:d.coupled+L.coupled.coefficientBase,rosterBase:d.coupled+L.coupled.rosterBase}));
 const solver=threeBallSolverTestKernels(words,plan.cue.numerical.catalog);solver.rc_three_solver_scatter(d.solver,d.journal,d.roster,0,d.bodies,0,d.caches,d.coupled);need(words[d.solver]===0&&words[d.solver+L.header.phase]===2,'actual three-sphere completed numeric writeback');
 const expected=numeric.sourceExpected.sphereSolve;need(expected?.length===3,'three independently owned original floor outcomes');const post=[];
 for(const [i,result]of expected.entries()){
  const body=d.bodies+i*64,old=seed.balls[i].state,slot=words[d.sphereControl+16+i*4+2],sleeping=words[S.bodyOffset+slot*S.bodyStride+S.body.activation+4]!==0;
  need(sleeping===result.sleeping,'actual scene sleep agrees with source floor owner');
  if(old.sleeping&&sleeping)equalData(Array.from(words.subarray(body,body+64)),Array.from(beforeSolve.subarray(body,body+64)),'unchanged source sleeping sphere body');
  for(const [name,offset,n]of [['linear',0,3],['angular',3,3],['translation',6,3],['rotation',9,4],['invInertia',16,9],['force',47,3]])equalData(numbers(words.subarray(body+offset,body+offset+n)),result.state[name],'independent original floor solve '+i+' '+name);
  if(!sleeping){
   const cache=d.caches+i*144;for(const[name,offset,n]of [['impulse',70,1],['warmImpulse',71,1],['warmWorld',72,3],['warmTangent',115,2]])equalData(numbers(words.subarray(cache+offset,cache+offset+n)),Array.isArray(result.state[name])?result.state[name]:[result.state[name]],'actual original cache writeback '+i+' '+name);
   if(postPlan)executeThreeBallFirstPostFat(postPlan,words,numeric,i);
   const input=d.ccdInputs+i*80;need(k.rc_scene_three_sphere_post_input(0,d.bodies,d.solver,d.sphereControl,input,i),'source post-CCD pose gather');
   const packed=new Float32Array(words.buffer,input*4,64),expectedPacked=packWorldCcdBody(old,result.state);equalData(Array.from(words.subarray(input,input+64)),Array.from(expectedPacked.subarray(0,64)),'every original sphere post-CCD field');
   const out=executeLowered(plan.programs.post,packed,{testOnly:true});for(const[name,f]of Object.entries(p.postPlan.layout)){const wanted=Array.isArray(result.postCcd[name])?result.postCcd[name]:[Number(result.postCcd[name])];equalData(Array.from(out.slice(f.offset,f.offset+f.length)),wanted,'original sphere post-CCD '+i+' '+name);}
   words.set(new Uint32Array(out.buffer,out.byteOffset,out.length),d.sphereCcdOutputs+i*20);need(k.rc_scene_three_sphere_post_finish(0,d.sphereControl,d.sphereCcdOutputs+i*20,i),'inactive original sphere postcheck');post.push({body:copy(seed.balls[i].body),...copy(result.postCcd)});
  }else{need(result.postCcd===null,'source sleeper skips post-CCD');post.push({body:copy(seed.balls[i].body),skippedSleeping:true});}
 }
 need(k.rc_scene_three_sphere_complete(0,d.journal,d.solver,d.sphereControl),'every actual awake sphere postcheck must complete');
 // Actual PhysicsLab application follows the ENTIRE world.step, not one
 // sphere's private postcheck. Preserve the physical boundary for BVH/journal
 // and clock/observer/drain ownership before later application publication.
 if(postPlan&&!physicalOnly)for(let i=0;i<3;i++)executeThreeBallFirstPostPatch(postPlan,words,numeric,i);
 const postApplication=postPlan&&!physicalOnly?finishThreeBallFirstPost(postPlan,words,numeric):null;
 equalData(Array.from(words.subarray(d.bodies+192,d.bodies+320)),Array.from(cue.words.subarray(d.bodies+192,d.bodies+320)),'sphere solve never alters the cue owner');
 const receipt=Object.freeze({kind:'original-initial-inactive-while-cue-host-receipt-v1',sourceIdentity:plan.sourceIdentity,actualSphereCount:3,actualCueDynamicCount:2,
  dt:numeric.timing.dt,allRequiredSourcePrePostPredicates:true,sourceSleepingSkips:post.filter(x=>x.skippedSleeping).length,generalCcdPass:false,nativeParity:false,worldCommitted:false});
 receipts.set(receipt,{plan,words,sealed:words.slice()});
 return{kind:'resident-three-ball-first-sphere-host-test-result-v1',available:true,sourceIdentity:plan.sourceIdentity,capability:THREE_BALL_FIRST_SPHERE_CAPABILITY,words,beforeSolve,cue,post,receipt,sourceExpected:expected,history:copy(seed.history),...(postApplication?{postApplication}:{})};
}
export function assertThreeBallInitialInactiveWhileCueReceipt(receipt){need(arguments.length===1,'only original local receipt');const r=receipts.get(receipt);need(r,'local completed initial while-cue receipt, not a general CCD pass');assertThreeBallFirstSpherePlan(r.plan);let okay=false;try{okay=r.words.length===r.sealed.length&&r.words.every((x,i)=>x===r.sealed[i]);}catch{}need(okay,'completed physical draft mutated/detached');return receipt;}
export function requireThreeBallAfterSphereWorldCommit(plan){need(arguments.length===1,'no injected commit');assertThreeBallFirstSpherePlan(plan);throw Object.assign(new RangeError('Actual body/constraint/CCD phase is complete only; cache-fat/BVH/journal/cue/application and latched outer-step commits are not composed.'),{code:'three-ball-first-sphere-world-commit-unavailable'});}
