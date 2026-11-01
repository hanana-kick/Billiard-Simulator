// SPDX-License-Identifier: Apache-2.0
// Internal HOST differential dependency. Called only while the genuine original
// first collision leases are live. Outputs are diagnostic, never public inputs.
import CCD from '../experimental-ccd-inactive.js';
import Roster from '../experimental-solver-contact-roster.js';
import Hint from '../experimental-coupled-contact-hints.js';
import Patch from '../experimental-angular-patch.js';
const copy=structuredClone,f=Math.fround,key=h=>h.index+':'+h.generation;
const need=(p,m)=>{if(!p)throw Object.assign(new RangeError('Three-ball first numerical source: '+m),{code:'three-ball-first-numerical-unsupported'});};
export async function prepareFirstNumericalSource({seed,metadata,preparedFloors,floorStages,before,projection,transaction,narrow,scene,token,own,claim,cue,solveCue=false,solveSpheres=false}){
 const dt=f(metadata.sourceH),roles=seed.cueBroadSeed.roles,entry=scene.snapshot();
 need(seed.balls.every(b=>b.state.dt===dt)&&seed.cueInitial.cue.dt===dt,'original initial h must agree across all real dynamic roles');
 need(preparedFloors.length===3&&preparedFloors.every(p=>p.state.topology.pairPresent&&p.state.topology.manifoldPresent&&p.state.topology.pointPresent&&p.state.topology.active),'three retained active single-point floor manifolds; other topology unsupported');
 // Original three-ball inactive-CCD phase checks precede scene.observe. A
 // successful check is NOT a current CCD pass capability or a post-solve check.
 const ccd=seed.balls.map(b=>b.state.sleeping?{body:copy(b.body),skippedSleeping:true}:({body:copy(b.body),...CCD.preReference({kind:'dynamic-body-ccd-check',bodyType:'dynamic',sleeping:false,softFrame:false,...copy(b.state.ccdBody),dt,linear:b.state.linear,angular:b.state.angular,translation:b.state.translation,rotation:b.state.rotation,invMass:b.state.invMass,invInertia:b.state.invInertia,localCom:[0,0,0],force:b.state.force})}));
 need(ccd.every(c=>c.skippedSleeping||c.admitted===true),'active source sphere CCD needs the real splitter owner');
 const cueChecks=metadata.ccd.filter(c=>c.phase==='pre-force-prediction');need(cueChecks.length===2&&cueChecks.every(c=>c.admitted===true),'both original source cue pre-CCD checks');
 const physical=preparedFloors.map((p,i)=>({handle:copy(seed.balls[i].body),...copy(p.state)}));
 for(const role of ['shaft','head'])physical.push({handle:copy(roles[role]),...copy(metadata.preSolveBodies[role]),gravity:copy(seed.balls[0].state.gravity)});
 const begun=scene.beginFrame({apiCalls:[],removedBodies:[]},token),observed=await scene.observe(physical,{dt,lengthUnit:seed.balls[0].state.lengthUnit},[],token);
 for(const role of ['shaft','head']){const row=observed.bodies.find(b=>key(b.handle)===key(roles[role]));need(row&&!row.activation.sleeping&&row.force.every(x=>x===0)&&row.torque.every(x=>x===0),'awake zero-force original cue component');}
 const result={physical,preparedFloors:copy(preparedFloors),dt,entry,begun,observed,ccd:[...ccd,...copy(cueChecks)],
  timing:{kind:'original-initial-h-inactive-source-prechecks',dt,sourceH:metadata.sourceH,ccdPassAuthorityVerified:false,nativeSelectedSolveDtVerified:false},
  jointSolved:metadata.jointSolved,solver:{available:false,reason:'current-cue-empty-manifold-owner-unavailable'},
  ...(solveCue?{cueSolve:{available:false,reason:'current-cue-empty-manifold-owner-unavailable'}}:{})};
 // Initial first-scene admission proves no active new cue links, NOT the native
 // empty manifold/hint metadata. Do not turn its boolean into a solver roster.
 if(narrow.changes.length)return result;
 need(narrow.after.edges.length===3&&preparedFloors.length===3,'three exact retained floor owners');
 const roster=claim(own(Roster.createRoster(seed.solverContactRoster)));roster.bindGraph(projection,token);
 const awakeId=before.manager.awake_island,awake=awakeId===null?[]:before.manager.islands.v[awakeId].bodies;
 const body=h=>before.bodies.find(b=>key(b.handle)===key(h))??seed.bodyRegistry.find(b=>key(b.handle)===key(h));
 const modified=h=>{const c=before.colliders.find(c=>key(c.handle)===key(h));need(c&&Number.isInteger(c.changes),'source entry collider flags');return c.changes>2;};
 const rows=narrow.after.edges.map((e,edgeId)=>{
  const i=seed.balls.findIndex(b=>key(b.collider)===key(e.collider2));need(i>=0&&key(e.collider1)===key(seed.geometryCatalog[i].collider1),'only current sphere/floor geometry supported');
  const prior=seed.solverContactRoster.pairs[edgeId],p=preparedFloors[i],refreshed=!!p.metadata.geometryRefreshed;
  const manifolds=refreshed?(p.state.topology.pairPresent?[{solverFlags:1,activeContactCount:+!!p.state.topology.active}]:[]):prior.manifolds.map(({solverFlags,activeContactCount})=>({solverFlags,activeContactCount}));
  const entryAwake=[e.body1,e.body2].map(h=>awake.some(a=>key(a)===key(h))),changed=modified(e.collider1)||modified(e.collider2);
  const out=Hint.updateHint(prior,{entryAwake,entryDynamicAwake:[e.body1,e.body2].map(h=>body(h)?.type==='Dynamic'&&!body(h).activation.sleeping),colliderNeedsNarrowPhaseUpdate:changed,visited:changed||entryAwake.some(Boolean),refreshed,manifolds});
  return{edgeId,updated:out.updated,solverGraphDirty:out.solverGraphDirty,hint:out.hint,manifolds:out.manifolds};
 });
 const context=observed.context,id=context.manager.awake_island,handles=id===null?[]:context.manager.islands.v[id].bodies;
 const awakeBodies=handles.map(h=>({body:copy(h),activeSetId:context.bodies.find(b=>key(b.handle)===key(h)).ids.active_set_id}));
 const expected=roster.prepare({transaction,pairs:rows,awakeBodies,activeSetEpoch:observed.effects.activeSetEpoch,solverGraphInvalidated:!!(observed.effects.requiresSolverGraphInvalidation||narrow.solverGraphInvalidated),sleptBodies:observed.effects.sleptBodies},token);
 result.solver={available:true,rows,expected,awakeBodies};
 if(solveCue){
  // This is the same still-leased original cue, never a recreated h1 body.
  // Its immutable guide/joint inputs have not changed during application.
  const input={...copy(seed.cueInitial.cue),shaft:copy(metadata.preSolveBodies.shaft),head:copy(metadata.preSolveBodies.head)};
  const completed=await cue.solvePrepared(token);need(completed.jointSolved===true&&completed.ccd.filter(c=>c.phase==='post-solved-pose').length===2,'original deferred cue solve and both post-CCD checks');
  result.cueSolve={available:true,input,completed};
 }
 if(solveSpheres){
  need(result.cueSolve?.available&&result.cueSolve.completed.jointSolved,'source cue solve must precede every sphere solve');
  result.sphereSolve=[];
  for(const [i,ball]of seed.balls.entries()){
   const row=observed.bodies.find(b=>key(b.handle)===key(ball.body)),old=ball.state;
   if(!row){need(old.sleeping&&floorStages[i]===null,'only unchanged source sleepers may skip numerical solve');result.sphereSolve.push({state:copy(old),sleeping:true,postCcd:null});continue;}
   need(floorStages[i],'actual prepared original floor lease');
   const admission={activation:row.activation,activationPhase:row.activationPhase,ccdPhase:'source-prediction-inactive'};
   const solved=row.activation.sleeping?floorStages[i].skipSleeping({...admission,force:row.force},token):await floorStages[i].solvePrepared(admission,token);
   const next=solved.state,postCcd=row.activation.sleeping?null:CCD.postReference({kind:'dynamic-body-ccd-check',bodyType:'dynamic',sleeping:false,softFrame:false,...copy(old.ccdBody),dt,linear:old.linear,angular:old.angular,translation:old.translation,rotation:old.rotation,invMass:old.invMass,invInertia:old.invInertia,localCom:[0,0,0],force:old.force,nextTranslation:next.translation,nextRotation:next.rotation});
   need(postCcd===null||postCcd.admitted===true,'active sphere post-CCD requires uncomposed sweep/clamp owner');
   result.sphereSolve.push({state:copy(next),sleeping:row.activation.sleeping,postCcd,metadata:copy(solved.metadata)});
  }
  // Actual source post-world application, kept separate from the floor result
  // above. SourceDouble explicitly uses JS Number/Math.hypot, NOT the similarly
  // named compensated createReferencePostWorldStage factory.
  const modified=[],states=[],patches=[],params=seed.application.params;
  for(const [i,ball]of seed.balls.entries()){
   const state=copy(result.sphereSolve[i].state),row=observed.bodies.find(b=>key(b.handle)===key(ball.body));
   if(!row){states.push(state);patches.push({skippedSleeping:true});continue;}
   state.force=copy(row.force);state.ccdBody.force=copy(row.force);state.ccdBody.torque=copy(row.torque);
   if(row.activation.sleeping){states.push(state);patches.push({skippedSleeping:true});continue;}
   const stage=own(Patch.createSourceDoublePostWorldStage({materialKind:'cloth',mass:ball.mass,radius:ball.radius,gravity:params.gravity,h:metadata.sourceH,rollingLength:params.rollingLength,spinLength:params.spinLength}));
   const patch=await stage.step(state);state.angular=patch.angular.slice();if(patch.metadata.requiresModifiedBodyTracking)modified.push(copy(ball.body));states.push(state);patches.push(patch);
  }
  result.postApplication={states,patches,modified,scene:scene.postApplication(modified,token),sourceH:metadata.sourceH};
 }
 return result;
}
