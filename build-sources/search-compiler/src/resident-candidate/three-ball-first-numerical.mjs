// SPDX-License-Identifier: Apache-2.0
// Bounded HOST original-t0 -> first collision -> force/energy -> solver gather.
// No public continuation inputs. No cue-joint or sphere solve is dispatched.
import {assertThreeBallFirstScenePlan,executeThreeBallFirstSceneEnergySourceForTest,executeThreeBallFirstSceneCueSourceForTest,executeThreeBallFirstSceneSphereSourceForTest,THREE_BALL_FIRST_SCENE_LAYOUT as F} from './three-ball-scene-first-collision.mjs';
import {SCENE_LAYOUT as S,decodeSceneActivation,generateSceneActivationWGSL,sceneActivationTestKernels} from './scene-activation.mjs';
import {SCENE_WORLD_LAYOUT as W,createSceneWorldPrograms,sceneWorldTestKernels,generateSceneWorldWGSL,SCENE_WORLD_MAX_EVALUATIONS} from './scene-world.mjs';
import {CONTACT_ROSTER_LAYOUT as R,decodeContactRoster,generateContactRosterWGSL} from './contact-roster.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from './contact-journal.mjs';
import {THREE_BALL_SOLVER_LAYOUT as L,packThreeBallSolverState,generateThreeBallSolverWGSL} from './three-ball-solver.mjs';
import {generateGeometryWorldWGSL} from './geometry-world.mjs';
import {packFloorNarrow} from './narrowphase.mjs';
import {COUPLED_BODY_OFFSETS as B} from './coupled-solver.mjs';
import {linkResidentWGSL} from './wgsl-linker.mjs';
import {equalData} from '../browser-initial-import/exact-data.mjs';
const owned=new WeakMap(),U=0xffffffff,copy=structuredClone,key=h=>h.index+':'+h.generation,align=n=>Math.ceil(n/64)*64;
const need=(p,m)=>{if(!p)throw Object.assign(new RangeError('Three-ball first numerical: '+m),{code:'three-ball-first-numerical-unsupported'});};
const bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0],floats=a=>Array.from(new Float32Array(a.buffer,a.byteOffset,a.length));
const freeze=x=>{if(x&&typeof x==='object'&&!ArrayBuffer.isView(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
export const THREE_BALL_FIRST_NUMERICAL_CAPABILITY=Object.freeze({hostTestOnly:true,initialFirstCollisionOnly:true,forceEnergyEvaluated:true,solverGatherOnly:true,
 numericalInputBackend:'owned-host-source-component-test-only',sphereSolveDispatched:false,cueJointSolveDeferred:true,ccdPassAuthorityVerified:false,
 nativeRegistrationBoundaryVerified:false,nativeFirstCollisionBoundaryVerified:false,nativeNumericalBoundaryVerified:false,
 worldCommits:0,physicalSteps:0,wholeH:false,gpuQualified:false,runtimeIntegrated:false,defaultBackend:false});
const BEGIN=`
fn rc_scene_three_energy_begin(s:u32,j:u32,first:u32,w:u32)->bool{
 if(rc_state[first+${F.header.completed}u]!=1u||rc_state[first+${F.header.phase}u]!=1u||rc_state[first+${F.header.status}u]!=1u||rc_state[s+${S.header.phase}u]!=2u||rc_state[s+${S.header.bodyCount}u]!=22u||rc_state[j+${J.header.colliders}u]!=25u||rc_state[j+${J.header.sequence}u]!=1u||rc_state[j+${J.header.operations}u]!=0u||rc_state[w+${W.header.status}u]!=1u||rc_state[w+${W.header.phase}u]!=0u||rc_state[w+${W.header.canonicalCount}u]!=5u||rc_state[w+${W.header.initialEdges}u]!=3u){return rc_scene_bad(s,6u);}
 var seen=0u;for(var n=0u;n<22u;n++){let p=rc_scene_bp(s,n);let row=rc_state[w+${W.bodyMapOffset}u+n];if(!rc_scene_valid_body(s,n)){return rc_scene_bad(s,6u);}if(rc_state[p+${S.body.dynamic}u]!=0u){if(row>=5u||(seen&(1u<<row))!=0u){return rc_scene_bad(s,6u);}seen=seen|(1u<<row);}else{if(row!=0xffffffffu){return rc_scene_bad(s,6u);}}}
 if(seen!=31u||rc_state[w+${W.bodyMapOffset}u+rc_state[s+${S.header.roleShaft}u]]!=3u||rc_state[w+${W.bodyMapOffset}u+rc_state[s+${S.header.roleHead}u]]!=4u){return rc_scene_bad(s,6u);}
 if(rc_state[j+${J.header.edges}u]>128u){return rc_scene_bad(s,6u);}for(var n=3u;n<rc_state[j+${J.header.edges}u];n++){if(rc_state[j+${J.edgeOffset}u+n*8u+2u]!=0u){return rc_scene_bad(s,6u);}}
 if(!rc_scene_begin(s)||!rc_scene_collisions_done(s)){return false;}
 rc_state[w+${W.header.phase}u]=1u;return true;
}
`;
export function generateThreeBallFirstEnergyBeginWGSL(){return BEGIN;}
export function threeBallFirstEnergyTestKernels(words){return sceneActivationTestKernels(words,{extraWGSL:BEGIN});}
function packEnergy(template){
 const seed=template.seed,a=new Uint32Array(W.words);a[W.header.version]=1;a[W.header.status]=1;a[W.header.canonicalCount]=5;a[W.header.initialEdges]=3;a.fill(U,W.bodyMapOffset,W.bodyMapOffset+32);
 const bindings=template.bindings.filter(b=>b.canonicalIndex!==null&&b.canonicalIndex!==undefined);
 need(bindings.length===5&&bindings.every((b,i)=>b.canonicalIndex===i),'three sphere + shaft/head canonical order');
 for(const b of bindings)a[W.bodyMapOffset+b.sceneSlot]=b.canonicalIndex;
 a.set(seed.balls[0].state.gravity.map(bits),W.gravityOffset);a[W.lengthUnitOffset]=bits(seed.balls[0].state.lengthUnit);
 seed.contactGraphSeed.edges.forEach((e,i)=>a.set([e.collider1.index,e.collider1.generation,e.collider2.index,e.collider2.generation,1],W.initialEdgeOffset+i*5));return a;
}
function packCatalog(seed){
 need(seed.geometryCatalog.length===18,'complete 3 floor + 3 pair + 12 cushion identity roster');
 const a=new Uint32Array(18*16);
 seed.geometryCatalog.forEach((r,i)=>{
  const kind={floor:0,pair:1,cushion:2}[r.kind],first=kind===1?r.ballIndices[0]:U,last=r.ballIndices.at(-1),cache=kind===0?i*144:U;
  need(kind!==undefined&&last<3&&(i<3)===(kind===0),'exact source catalog ordering');
  a.set([kind,r.collider1.index,r.collider1.generation,r.collider2.index,r.collider2.generation,first,last,cache,kind===0?144:0,U,kind===0?1:0,kind===0?cache+55:U,kind===0?cache+70:U,kind===0?cache+130:U,kind===0?cache+137:U,0],i*16);
 });return a;
}
export function createThreeBallFirstNumericalPlan(first){
 need(arguments.length===1,'only branded original first-scene plan');assertThreeBallFirstScenePlan(first);const template=first.template;
 const energy=align(first.initialWords.length),solver=energy+W.words,coupled=align(solver+L.words),words=align(coupled+L.coupled.stateWords),initialWords=new Uint32Array(words);
 initialWords.set(first.initialWords);initialWords.set(packEnergy(template),energy);initialWords.set(packThreeBallSolverState(template.seed,template.bindings),solver);
 const layout=Object.freeze({...first.layout,firstBridge:first.layout.bridge,energy,solver,coupled,words,bodies:template.segments.bodies.offset,roster:template.segments.roster.offset,caches:template.segments.floorCaches.offset});
 const programs=freeze(createSceneWorldPrograms()),catalog=packCatalog(template.seed);
 const globals='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;\n@group(0) @binding(1) var<storage,read> rc_program:array<u32>;\n@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;';
 const entry=body=>`@compute @workgroup_size(1) fn main(){${body}}`;
 const code=linkResidentWGSL([globals,generateSceneActivationWGSL(),generateSceneWorldWGSL({includeNumericLibrary:false,includeRosterBridge:false,continuationOnly:true}),BEGIN,entry(`if(rc_state[${energy+W.header.phase}u]==0u){if(!rc_scene_three_energy_begin(0u,${layout.journal}u,${layout.firstBridge}u,${energy}u)){return;}if(!rc_scene_world_begin_observe(0u,${energy}u,${bits(template.seed.balls[0].state.dt)}u)){return;}}let ready=rc_scene_world_gather(0u,${layout.bodies}u,${energy}u,0u);`)]).code;
 const plan=Object.freeze({kind:'resident-three-ball-first-numerical-plan-v1',first,layout,initialWords,catalog,geometryCatalog:template.geometryCatalog,programs,code,capability:THREE_BALL_FIRST_NUMERICAL_CAPABILITY});
 for(const a of [initialWords,catalog,programs.program])Object.preventExtensions(a);
 const sealed=[initialWords,catalog,programs.program,...programs.entries.flatMap(e=>[e.program,e.outputSlots])];
 owned.set(plan,{first,sealed:sealed.map(a=>[a,a.slice()])});return plan;
}
export function assertThreeBallFirstNumericalPlan(plan){
 const p=owned.get(plan);need(p,'locally branded first numerical plan');assertThreeBallFirstScenePlan(p.first);
 for(const[a,b]of p.sealed){let ok=false;try{ok=a.length===b.length&&a.every((x,i)=>x===b[i]);}catch{}need(ok,'initial words/catalog/program mutated or detached');}return plan;
}
function rosterKernels(words){
 let js=generateContactRosterWGSL(),names=[...js.matchAll(/fn (rc_\w+)\(/g)].map(m=>m[1]);
 js=js.replace(/\bfn (\w+)\(([^)]*)\)(?:->(?:u32|bool))?/g,(_,n,a)=>'function '+n+'('+a.replace(/:(?:u32|bool)/g,'')+')').replace(/:(?:u32|bool)/g,'').replace(/\bvar\b/g,'let').replace(/\b(\d+)u\b/g,'$1').replace(/\bloop\s*\{/g,'while(true){').replace(/(\b\w+|\(b-32\))\/(32|4194304|4)(?!\d)/g,'Math.floor($1/$2)');
 return new Function('rc_state','min','max',js+';return {'+names.join(',')+'};')(words,Math.min,Math.max);
}
/** TEST ONLY adapter for exactly emitted integer solver and geometry functions. */
export function threeBallSolverTestKernels(state,geometry){
 let js=generateThreeBallSolverWGSL()+generateGeometryWorldWGSL(),names=[...js.matchAll(/fn (rc_\w+)\(/g)].map(m=>m[1]);
 js=js.replace(/fn (\w+)\(([^)]*)\)(?:->(?:u32|bool))?/g,(_,n,a)=>'function '+n+'('+a.replace(/:(?:u32|bool)/g,'')+')').replace(/\bvar\b/g,'let').replace(/\b(0x[0-9a-f]+|\d+)u\b/g,'$1').replace(/\bswitch (\w+)\{/g,'switch($1){').replace(/}\s*(case|default)/g,'break;}$1').replace(/arrayLength\(&rc_state\)/g,'rc_state.length').replace(/bitcast<f32>/g,'asFloat');
 const external={rc_state:state,rc_geometry:geometry,select:(a,b,c)=>c?b:a,asFloat:x=>new Float32Array(Uint32Array.of(x).buffer)[0],u32:x=>x>>>0,...sceneActivationTestKernels(state),...rosterKernels(state)};
 return new Function(...Object.keys(external),js+';return {'+names.join(',')+'};')(...Object.values(external));
}
// Current cue words belong to the first-broad producer. The separate original
// source is an expectation only; never overwrite producer state with its bodies.
function assertPreparedCueInputs(words,base,physical,seed){
 for(const [i,role]of ['shaft','head'].entries()){
  const body=physical.find(b=>key(b.handle)===key(seed.cueBroadSeed.roles[role])),at=base+(3+i)*64;need(body,'original prepared cue role');
  for(const [name,n]of Object.entries({linear:3,angular:3,translation:3,rotation:4,invMass:3,userForce:3,userTorque:3})){
   need(body[name]?.length===n&&body[name].every(x=>Number.isFinite(x)&&Object.is(Math.fround(x),x)),'exact source cue '+name);equalData(floats(words.subarray(at+B[name],at+B[name]+n)),body[name],'produced cue input '+name);
  }
  const v=body.invInertia;need(v.length===6,'source symmetric cue inertia');equalData(floats(words.subarray(at+B.invInertia,at+B.invInertia+9)),[v[0],v[1],v[2],v[1],v[3],v[4],v[2],v[4],v[5]],'produced source cue inertia');
  equalData(words[at+B.gravityScale],bits(body.gravityScale),'produced source cue gravity scale');
  // Exact existing cue body64 ABI: local COM at56, world COM at59. Energy
  // does not consume these lanes; preserve them now for the future CCD owner.
  equalData(floats(words.subarray(at+56,at+59)),body.localCom,'produced local COM56');equalData(floats(words.subarray(at+59,at+62)),body.worldCom,'produced world COM59');
 }
}
const sceneView=s=>Object.fromEntries(['phase','sourceRevision','roles','manager','bodies','modifiedBodies','consumedModifiedBodies'].map(k=>[k,s[k]]));
export async function executeThreeBallFirstNumericalForTest(plan,options={}){return executeNumerical(plan,options,false);}
/** Internal bounded cue composition. No caller-provided physical phase data. */
export async function executeThreeBallFirstNumericalCueSourceForTest(plan,options={}){return executeNumerical(plan,options,true);}
export async function executeThreeBallFirstNumericalSphereSourceForTest(plan,options={}){return executeNumerical(plan,options,'sphere');}
async function executeNumerical(plan,options,solveCue){
 need(options&&Object.keys(options).join(',')==='testOnly'&&options.testOnly===true,'explicit testOnly only; no timing/roster/future input');assertThreeBallFirstNumericalPlan(plan);
 const first=await (solveCue==='sphere'?executeThreeBallFirstSceneSphereSourceForTest:solveCue?executeThreeBallFirstSceneCueSourceForTest:executeThreeBallFirstSceneEnergySourceForTest)(plan.first,{testOnly:true}),source=first.numericalSource,seed=plan.first.template.seed,d=plan.layout,words=plan.initialWords.slice();
 words.set(first.words);assertPreparedCueInputs(words,d.bodies,source.physical,seed);
 source.preparedFloors.forEach((p,i)=>words.set(packFloorNarrow(p.state),d.caches+i*144));
 const beforeEnergy=words.slice(),begin=threeBallFirstEnergyTestKernels(words);need(begin.rc_scene_three_energy_begin(0,d.journal,d.firstBridge,d.energy),'genuine first energy phase admission');
 const k=sceneWorldTestKernels(words,plan.programs);need(k.rc_scene_world_begin_observe(0,d.energy,bits(source.dt)),'source initial-h energy start');let evaluations=0;
 while(k.rc_scene_world_gather(0,d.bodies,d.energy,0)){need(k.rc_scene_world_evaluate(0,d.energy,0,0)===1,'unchanged numerical force/energy program');need(k.rc_scene_world_scatter(0,d.bodies,d.energy,0,0),'energy scatter');need(++evaluations<=SCENE_WORLD_MAX_EVALUATIONS,'bounded original numerical schedule');}
 need(words[d.energy+W.header.status]===1&&words[d.energy+W.header.continuation]===10,'complete force/energy observation');
 const scene=decodeSceneActivation(words,plan.first.template.registration.control.template);equalData(sceneView(scene),sceneView(source.observed.context),'full source observed scene');
 source.observed.bodies.forEach((b,i)=>equalData(floats(words.subarray(d.energy+W.forceOffset+i*6,d.energy+W.forceOffset+i*6+6)),[...b.force,...b.torque],'source ordered effective force/torque'));
 let gathered={available:false,reason:source.solver.reason};
 if(source.solver.available){
  const r=rosterKernels(words),v=first.sourceExpected.journal;r.rc_roster_begin(d.roster,v.toSequence,v.toRevision,!!(source.observed.effects.requiresSolverGraphInvalidation||v.solverGraphInvalidated));r.rc_roster_finish_transitions(d.roster);
  for(const row of source.solver.rows){const m=row.manifolds[0];r.rc_roster_metadata(d.roster,row.edgeId,row.updated,row.solverGraphDirty,row.hint,row.manifolds.length,m?.solverFlags??0,m?.activeContactCount??0);}
  r.rc_roster_begin_awake(d.roster,words[S.header.epoch],seed.solverContactRoster.multibodyTopologyEpoch);
  for(let i=0;i<words[S.header.sleptCount];i++){const slot=words[S.sleptOffset+i],p=S.bodyOffset+slot*S.bodyStride;r.rc_roster_sleep(d.roster,words[p+S.body.index],words[p+S.body.generation]);}
  for(let i=0;i<words[d.energy+W.header.awakeCount];i++){const row=d.energy+W.awakeOffset+i*4,p=S.bodyOffset+words[row]*S.bodyStride;r.rc_roster_awake(d.roster,words[p+S.body.index],words[p+S.body.generation],words[row+2]);}r.rc_roster_finish(d.roster);
  const roster=decodeContactRoster(words.subarray(d.roster,d.roster+R.words),{initialSnapshotSha256:seed.initialSnapshotSha256,backend:'cpu-reference'});need(roster.status===0,'current source roster finish');
  for(const name of ['pairs','buckets','bodySolverColorMasks','activeSetEpoch'])equalData(roster.snapshot[name],source.solver.expected[name],'source complete roster '+name);
  equalData(roster.snapshot.awakeBodies,source.solver.awakeBodies,'source exact awake order');
  const solver=threeBallSolverTestKernels(words,plan.catalog);solver.rc_three_solver_gather(d.solver,d.journal,d.roster,0,d.bodies,0,d.caches,d.coupled,bits(source.dt),U);need(words[d.solver]===0&&words[d.solver+L.header.phase]===1,'three-sphere gather');
  gathered={available:true,roster,bodyCount:words[d.solver+L.header.bodyCount],contactCount:words[d.solver+L.header.contactCount]};
 }
 return{kind:'resident-three-ball-first-numerical-host-test-result-v1',sourceIdentity:plan.first.sourceIdentity,capability:THREE_BALL_FIRST_NUMERICAL_CAPABILITY,words,beforeEnergy,scene,evaluations,gathered,
  timing:source.timing,ccd:source.ccd,sourceExpected:{observed:source.observed,solver:source.solver,preparedCue:source.physical.slice(3),...(solveCue?{cueSolve:source.cueSolve}:{}),...(solveCue==='sphere'?{sphereSolve:source.sphereSolve,postApplication:source.postApplication}:{})},preparedFloors:source.preparedFloors,history:copy(seed.history)};
}
export function requireThreeBallFirstNumericalContinuation(plan){need(arguments.length===1,'no external continuation');assertThreeBallFirstNumericalPlan(plan);throw Object.assign(new RangeError('Actual CCD pass authority and deferred two-dynamic cue joint solve must precede sphere solve/publication; numerical continuation unavailable.'),{code:'three-ball-first-numerical-continuation-unavailable'});}
