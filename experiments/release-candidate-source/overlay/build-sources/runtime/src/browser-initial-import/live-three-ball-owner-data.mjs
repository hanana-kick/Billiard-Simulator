// SPDX-License-Identifier: Apache-2.0
// Internal INITIAL-only projection from the private verified admission tree.
// No engine, physics steps, future state, or public admission brand is supplied here.
// The resident admission module is the ONLY owner-seed branding authority.
import {exportInitialSeeds} from './live-broad-graph.mjs';
import * as importedGuard from '../experimental-cue-rigid-exclusion.js';
const Guard=importedGuard.default??globalThis.LabCueRigidExclusionExperimental;
import {projectCache} from './live-initial-contact.mjs';
import * as R from '../experimental-solver-contact-roster.js';
const Roster=R.default??globalThis.LabSolverContactRosterExperimental;
const need=(ok,message)=>{if(!ok)throw new RangeError('Three-ball owner seed: '+message);};
import {flatBalls,registry} from './initial-cloth.mjs';
import {exportCueJoints} from './cue-joints.mjs';
import * as D from '../../tools/rapier-snapshot-decoder/browser.mjs';
import * as H from '../experimental-cue-convex-topology.js';
import * as O from '../experimental-live-three-ball-origin.js';
const Hull=H.default??globalThis.LabCueConvexTopologyExperimental,Origin=O.default??globalThis.LabLiveThreeBallOriginExperimental;
const copy=x=>structuredClone(x),same=(a,b)=>a.index===b.index&&a.generation===b.generation;
const nativeHandle=h=>{const v=new DataView(new ArrayBuffer(8));v.setUint32(0,h.index,true);v.setUint32(4,h.generation,true);return v.getFloat64(0,true);};
export async function projectThreeBallCreatedOwnerData(projection,seed){
 const row={...projection.created,hCount:0,outerStep:0,outerSubstep:0,boundary:projection.boundary,candidateInput:true,
  nativeFrameIndex:projection.sourceOrigin.createdClock.nativeFrameIndex,apiJournalLength:14,application:projection.application,sourceOrigin:projection.sourceOrigin};
 row.proxies=[];for(const node of row.state.broad_phase.tree.nodes)for(const child of [node.left,node.right])if((child.data&0x3fffffff)===1)row.proxies.push({index:child.children,min:copy(child.mins),max:copy(child.maxs)});
 const broad=await exportInitialSeeds({[projection.boundary]:row,strikeCreationJournal:projection.strikeCreationJournal},'three'),app=projection.application,objects=app.registry.objects;
 const d={schemaVersion:1,parryVersion:'0.31.1',state:row.typedState,sourceRevision:row.sourceRevision,engineSha256:row.engineSha256,engineVersion:'0.21.0',verification:row.verification,byteLength:row.snapshotBytes,inputSha256:row.snapshotSha256};
 const created={...seed.userChanges.created,integration:copy(row.state.integration_parameters)},source={...seed.userChanges,created},roles=source.roles;
 const balls=flatBalls({objects,roles,created},'created',d),floor=app.registry.statics.find(s=>s.kind==='cloth');
 for(const ball of balls){const p=row.contactPairs.find(p=>same(p.collider1,floor.collider)&&same(p.collider2,ball.collider)),r=p.contacts.value,m=r.manifolds[0],point=m.points[0];Object.assign(ball.state,{localN1:copy(m.local_n1),feature1:point.fid1,feature2:point.fid2,solverColor:r.solver_color});ball.state.topology.manifoldPresent=true;}
 const c=app.cue,e=await exportCueJoints(d,Object.fromEntries(Object.entries({shaftBody:c.shaft,headBody:c.head,guideBody:c.guide,flex:c.flex,prismatic:c.prismatic}).map(([k,h])=>[k,nativeHandle(h)])),D),[flex,guide]=e.joints;
 const body=q=>({...copy(q),translation:copy(q.pose.translation),rotation:copy(q.pose.rotation)}),ccd=role=>{const b=created.bodies[role];return{ccdEnabled:b.ccd.ccd_enabled,maxCcdSubsteps:4,softCcdPrediction:b.ccd.soft_ccd_prediction,maxExtent:b.mprops.max_extent,ccdThickness:b.ccd.ccd_thickness,force:copy(b.forces.force),torque:copy(b.forces.torque)};},p=app.params;
 const cueInitial={sourceOrigin:copy(projection.sourceOrigin),kind:'actual-cue-created-stroke-pre-world',boundary:'source-created-strike-pre-first-h',disconnectedConstraintComponents:true,rigidCueContacts:0,
 cue:{kind:'isolated-actual-cue',componentProjection:'original-shaft-head-fixed-guide',bodyCount:3,jointCount:2,contactCount:0,ccdSplit:false,...e.parameters,dt:Math.fround(app.dt/app.strokeSubsteps),shaft:body(flex.body1),head:body(flex.body2),guide:copy(guide.body1.pose),joints:copy(e.joints)},ccd:{shaft:ccd('shaft'),head:ccd('head')},sourceCreation:source,initializationInputs:seed.numericInputs,
 application:{environmentContract:Origin.ENVIRONMENT,fixtureVariant:Origin.FIXTURE_VARIANT,selectedId:app.controller.selectedId,selectedIndex:projection.sourceOrigin.selectedIndex,strikeSettings:copy(app.controller.settings),dt:app.dt,subdivisions:app.strokeSubsteps,initialElapsed:0,initialTime:app.time,started:c.started,axis:['x','y','z'].map(k=>c.pose.direction[k]),active:false,contacted:false,tangent:[0,0,0],radius:objects[projection.sourceOrigin.selectedIndex].radius,tipRadius:.006,lateralStiffness:p.cueLateralStiffness,lateralDamping:p.cueLateralDamping,normalStiffness:p.tipNormalStiffness,normalDamping:p.tipNormalDamping,tangentStiffness:p.tipTangentialStiffness,tangentDamping:p.tipTangentialDamping,friction:p.tipFriction}};
 const cueEmptyConvexHulls=[];for(const co of created.colliders.filter(c=>c.shape.variant==='ConvexPolyhedron'))cueEmptyConvexHulls.push({collider:copy(co.handle),body:copy(co.parent.handle),hull:await Hull.exportNativeHullBrowser(d,nativeHandle(co.handle),D)});
 const solverContactRoster=sourceRoster(row),initialContactOrigin=broad.initialContactOrigin;
 const geometryCatalog=initialGeometry(row,broad,objects,cueEmptyConvexHulls);
 const descriptor=h=>{const c=row.colliders.find(c=>same(c.handle,h));need(c,'source registry collider generation');return{handle:copy(h),material:copy(c.material),groups:copy(c.flags.collision_groups),solverGroups:copy(c.flags.solver_groups),shapeType:c.shape.variant};};
 const sceneRegistry={kind:'original-physicslab-initial-scene-registry',snapshotSha256:row.snapshotSha256,staticCount:16,
  objects:objects.map(o=>({...copy(o),primaryCollider:descriptor(o.collider),pairCollider:descriptor(o.pairCollider)})),statics:app.registry.statics.map(s=>({...copy(s),collider:descriptor(s.collider)}))};
 const guard=Guard.validateInitial({created,roles,sceneRegistry}),own={roles,cue:cueInitial.cue,balls:balls.map(b=>({body:b.body,translation:b.state.translation,rotation:b.state.rotation,radius:b.radius}))};
 const cueGuard={prediction:guard.prediction,pairs:guard.pairs.map(p=>({cueCollider:copy(p.a.handle),obstacleCollider:copy(p.b.col.handle),initialInputs:Array.from(Guard.pack(p,own,guard.prediction))})),initialInputsOnly:true,contactDecisionAvailable:false};
 return{kind:'original-live-three-ball-created-owner-data-v1',boundary:projection.boundary,sourceOrigin:copy(projection.sourceOrigin),initialSnapshotSha256:row.snapshotSha256,
  balls,bodyRegistry:registry(d),sceneRegistry,cueGuard,cueInitial,cueEmptyConvexHulls,initialContactOrigin,geometryCatalog,
  cueBroadSeed:broad.broadSeed,contactGraphSeed:broad.graphSeed,solverContactRoster,
  nativeInitial:copy(row.state),nativeBodies:copy(row.bodies),nativeColliders:copy(row.colliders),
  bodyColliderOrder:row.bodies.map(b=>({body:copy(b.handle),colliders:copy(b.colliders)})),
  game:copy(app.game),application:copy(app),initialOnly:true,physicalSteps:0};
}

// Same pinned native extraction as experimental-solver-contact-roster.js:56-70,
// but admitted by the distinct three-ball source origin. NEVER relabel a row as
// liveRegisteredStrikeCreated just to bypass that four-ball importer's gate.
function sourceRoster(row){
 need(row.boundary===Origin.BOUNDARY&&row.candidateInput===true&&row.hCount===0,'exact original three-ball t0');
 const state=row.state,np=state.narrow_phase,arena=state.bodies.bodies.items,colliders=state.colliders.colliders.items;
 const bodies=arena.flatMap((s,index)=>s?.value?.body_type?[{handle:{index,generation:s.generation},type:s.value.body_type.variant??s.value.body_type}]:[]);
 const pairs=np.contact_graph.graph.edges.map(e=>e.weight),parent=h=>{const s=colliders[h.index];need(s?.value&&s.generation===h.generation,'exact collider parent generation');return copy(s.value.parent.handle);};
 const edges=pairs.map(p=>{need(p.contacts.variant==='Rigid','rigid source pairs only');return{collider1:copy(p.collider1),collider2:copy(p.collider2),body1:parent(p.collider1),body2:parent(p.collider2),active:p.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0)};});
 const awakeId=state.islands.awake_island,awake=awakeId===null?[]:state.islands.islands.v[awakeId].bodies;
 const masks=np.body_solver_color_masks.map(x=>{need(typeof x!=='number'||Number.isSafeInteger(x)&&x>=0,'rounded native u128 rejected');const n=BigInt(x);need(n>=0n&&n<(1n<<128n),'exact native u128');return n.toString();});
 return Roster.validate({kind:'source-single-manifold-solver-contact-roster',sourceRevision:row.sourceRevision,initialSnapshotSha256:row.snapshotSha256,bodies,edges,
  pairs:pairs.map((p,i)=>({hint:np.pair_solver_hints[i],solverColor:p.contacts.value.solver_color,solverColorBodies:copy(p.contacts.value.solver_color_bodies),manifolds:p.contacts.value.manifolds.map(m=>({activeContactCount:m.data.solver_contacts.length,solverFlags:m.data.solver_flags,solverColor:m.data.solver_color,solverBodyIds:copy(m.data.solver_body_ids),graphPos:m.data.graph_pos}))})),
  bodySolverColorMasks:masks,buckets:copy(np.solver_contact_graph.buckets),solverGraphValid:np.solver_graph_valid,solverGraphEpoch:np.solver_graph_epoch,solverGraphMultibodyEpoch:np.solver_graph_mb_epoch,
  activeSetEpoch:state.islands.active_set_epoch,multibodyTopologyEpoch:state.multibody_joints.topology_epoch,awakeBodies:awake.map(body=>({body:copy(body),activeSetId:arena[body.index].value.ids.active_set_id}))});
}
function initialGeometry(row,broad,objects,hulls){
 const origin=broad.initialContactOrigin,graph=broad.graphSeed,statics=row.application.registry.statics,floor=statics.find(s=>s.kind==='cloth'),rails=statics.filter(s=>s.kind==='cushion');
 need(objects.length===3&&rails.length===4,'actual three spheres and four rails');
 const rows=[],by=h=>{const c=row.colliders.find(c=>same(c.handle,h));need(c,'native generation present');return c;};
 const add=(kind,c1,c2,indices)=>{
  const matches=origin.edges.flatMap((e,i)=>same(e.collider1,c1)&&same(e.collider2,c2)?[i]:[]);need(matches.length<=1,'unique oriented native edge');
  const edgeId=matches[0]??null,pair=edgeId===null?null:origin.contactGraph.graph.edges[edgeId].weight;
  const adjacency=[c1,c2].map(h=>{const a=graph.adjacency.find(a=>same(a.collider,h));need(a,'complete source incidence');return copy(a);});
  rows.push({kind,ballIndices:indices,collider1:copy(c1),collider2:copy(c2),body1:copy(by(c1).parent.handle),body2:copy(by(c2).parent.handle),edgeId,
   cache:projectCache(pair,edgeId===null?undefined:origin.pairSolverHints[edgeId]),directionalAdjacency:adjacency,
   colliders:[copy(by(c1)),copy(by(c2))],...(kind==='cushion'?{hull:copy(hulls.find(x=>same(x.collider,c1))?.hull)}:{})});
 };
 objects.forEach((o,i)=>{add('floor',floor.collider,o.collider,[i]);need(rows.at(-1).edgeId!==null,'each sphere has original floor cache');});
 for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
  const match=origin.retainedDynamicPairs.find(p=>p.ballIndices.includes(i)&&p.ballIndices.includes(j));
  const order=match?copy(match.ballIndices):[i,j].sort((a,b)=>objects[a].pairCollider.index-objects[b].pairCollider.index||objects[a].pairCollider.generation-objects[b].pairCollider.generation);
  add('pair',objects[order[0]].pairCollider,objects[order[1]].pairCollider,order);
 }
 objects.forEach((o,i)=>rails.forEach(r=>add('cushion',r.collider,o.collider,[i])));
 need(rows.length===18&&rows.filter(r=>r.edgeId!==null).length===origin.edges.length,'every native initial edge owned exactly once');
 need(rows.filter(r=>r.kind==='cushion').every(r=>r.hull),'all actual rail hulls present');
 return rows;
}
