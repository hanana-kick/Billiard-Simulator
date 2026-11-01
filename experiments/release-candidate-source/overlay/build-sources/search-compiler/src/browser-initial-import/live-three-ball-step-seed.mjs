// SPDX-License-Identifier: Apache-2.0
// Initial-only genuine live three-ball projection; no later state is consumed.
import {importLiveThreeBallBroad} from './live-three-ball-broad.mjs';
import {flatBalls,registry} from './initial-cloth.mjs';
import {exportCueJoints} from './cue-joints.mjs';
import * as D from '../../tools/rapier-snapshot-decoder/browser.mjs';
import * as H from '../experimental-cue-convex-topology.js';
import * as O from '../experimental-live-three-ball-origin.js';
const Hull=H.default??globalThis.LabCueConvexTopologyExperimental,Origin=O.default??globalThis.LabLiveThreeBallOriginExperimental;
const copy=x=>structuredClone(x),same=(a,b)=>a.index===b.index&&a.generation===b.generation;
const nativeHandle=h=>{const v=new DataView(new ArrayBuffer(8));v.setUint32(0,h.index,true);v.setUint32(4,h.generation,true);return v.getFloat64(0,true);};
export async function importLiveThreeBallStepSeed(decoder,input){
 const {seed,projection,broad}=await importLiveThreeBallBroad(decoder,input),row=projection.created,app=projection.application,objects=app.registry.objects;
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
 return{projection,broad,balls,bodyRegistry:registry(d),cueInitial,cueEmptyConvexHulls,contactGraphSeed:broad.graphSeed,solverContactRoster:true};
}
