// SPDX-License-Identifier: Apache-2.0
// Read-only, initial-only projection of a genuine current three-ball fork.
// Copies complete native state rather than squeezing it into a legacy owner.
// No engine restore/step, solver, GPU dispatch, reset, sleep or fixture fallback.
import * as D from '../../tools/rapier-snapshot-decoder/browser.mjs';
import * as importedOrigin from '../experimental-live-three-ball-origin.js';
import {requireThat,equal,equalData,plain,journalDigest,verifyDecoded,copy,assertOwnedInputData} from './exact-data.mjs';
const Origin=importedOrigin.default??globalThis.LabLiveThreeBallOriginExperimental;
const F=D.field,f=Math.fround,key=h=>h.index+':'+h.generation,same=Origin.sameHandle;
const CAPTURE_KEYS=['boundary','candidateInput','apiJournalLength','application','strikeCreationJournal','nativeRestoreUsed','preStrikeApplication','readiness'];
const APPLICATION_KEYS=['controller','cue','dt','events','game','nextId','params','registry','revision','shots','steps','strokeSubsteps','time'];
const exactKeys=(value,keys)=>{
  requireThat(value&&Object.getPrototypeOf(value)===Object.prototype,'Plain explicit source object required');
  equalData(Reflect.ownKeys(value).sort(),keys.slice().sort(),'Unexpected three-ball source fields');
};
const handle=h=>{Origin.validateHandle(h);return{index:h.index,generation:h.generation};};
function canonicalizeCapture(c){
  // Transport key order is not physics identity. Only canonicalize field order;
  // never reorder registered objects, native arenas, targets, caches or islands.
  for(const a of [c.application,c.preStrikeApplication]){
    for(const o of a.registry.objects)for(const k of ['body','collider','pairCollider'])o[k]=handle(o[k]);
    for(const o of a.registry.statics)for(const k of ['body','collider'])o[k]=handle(o[k]);
    if(a.cue)for(const k of ['shaft','head','guide','shaftCollider','tipCollider','neckCollider','flex','prismatic'])a.cue[k]=handle(a.cue[k]);
  }
  for(const b of c.readiness.bodies)b.body=handle(b.body);
  const pending=[...c.strikeCreationJournal],seen=new WeakSet();
  while(pending.length){const v=pending.pop();if(!v||typeof v!=='object'||seen.has(v))continue;seen.add(v);
    for(const k of Object.keys(v))if(k==='handle')v[k]=handle(v[k]);else pending.push(v[k]);
  }
}
function applicationShape(a,created){
  exactKeys(a,APPLICATION_KEYS);exactKeys(a.registry,['staticCount','objects','statics']);equal(a.registry.staticCount,16);
  exactKeys(a.controller,['gameMode','selectedId','paused','settings','routeOptions','undoCount','redoCount']);
  equal(a.controller.gameMode,'free');Origin.validateSettings(a.controller.settings);Origin.validateFixedParams(a.params);
  requireThat(typeof a.controller.paused==='boolean','Actual original paused flag required');
  for(const k of ['undoCount','redoCount'])requireThat(Number.isSafeInteger(a.controller[k])&&a.controller[k]>=0,'Original history counts required');
  requireThat(a.controller.routeOptions&&Object.getPrototypeOf(a.controller.routeOptions)===Object.prototype,'Actual controller route options required');
  equal(a.dt,1/960);equal(a.strokeSubsteps,64);
  for(const k of ['steps','shots','revision','nextId'])requireThat(Number.isSafeInteger(a[k])&&a[k]>=0,'Original application integer required: '+k);
  requireThat(Number.isFinite(a.time)&&a.time>=0,'Original application time required');
  equal(a.registry.objects.length,3);equal(a.registry.statics.length,16);
  const objects=a.registry.objects,statics=a.registry.statics,ids=objects.map(o=>o.id);
  requireThat(new Set(ids).size===3&&ids.every(id=>Number.isSafeInteger(id)&&id>0),'Distinct actual original object IDs required');
  objects.forEach((o,i)=>{
    exactKeys(o,['index','id','label','kind','shape','radius','mass','body','collider','pairCollider']);
    equal(o.index,i);equal(o.mass,.210);equal(o.radius,.03075);equal(o.kind,'ball');equal(o.shape,'sphere');
  });
  statics.forEach((o,i)=>{exactKeys(o,['index','label','kind','body','collider']);equal(o.index,i);});
  equal(statics.filter(o=>o.kind==='cloth').length,1);equal(statics.filter(o=>o.kind==='cushion').length,4);
  const bodies=[...objects,...statics].map(o=>o.body),colliders=[...objects.flatMap(o=>[o.collider,o.pairCollider]),...statics.map(o=>o.collider)];
  [...bodies,...colliders].forEach(handle);equal(new Set(bodies.map(key)).size,19);equal(new Set(colliders.map(key)).size,22);
  Origin.validateGame(a.game);equalData(a.game.objectIds,ids);equalData(a.game.cueIds,ids.slice(0,2));
  requireThat(a.game.cueIds.includes(a.controller.selectedId),'Actual selected cue must be one of the two legal source cue IDs');
  const targets=ids.filter(id=>id!==a.controller.selectedId),routes=a.controller.routeOptions;
  requireThat(routes.targetId!==routes.secondId&&[routes.targetId,routes.secondId].every(id=>targets.includes(id)),'Both route targets must retain the actual other balls');
  requireThat(Array.isArray(a.events),'Actual source event history required');
  if(!created){equal(a.cue,null,'Source has an active cue');equal(a.game.pending,null,'Source game still awaits its result');return;}
  exactKeys(a.cue,['shaft','head','guide','shaftCollider','tipCollider','neckCollider','flex','prismatic','selectedId','pose','started','contacted','contacts','obstructions','stats']);
  exactKeys(a.cue.pose,['direction','side','up','contact','tip','rotation','shaftCenter','surface']);
  for(const [k,v]of Object.entries(a.cue.pose)){exactKeys(v,k==='rotation'?['x','y','z','w']:['x','y','z']);requireThat(Object.values(v).every(Number.isFinite),'Finite original cue pose required');}
  equal(a.events.at(-1)?.kind,'stroke');equal(a.events.at(-1)?.time,a.time);
}
function validateCapture(c){
  exactKeys(c,CAPTURE_KEYS);equal(c.boundary,Origin.BOUNDARY);equal(c.candidateInput,true);equal(c.nativeRestoreUsed,true);
  equal(c.apiJournalLength,14,'Exactly original propagation plus thirteen cue construction calls required');
  applicationShape(c.preStrikeApplication,false);applicationShape(c.application,true);
  requireThat(Array.isArray(c.strikeCreationJournal)&&c.strikeCreationJournal.length===13,'Exactly thirteen original cue creation calls required');
  for(const e of c.strikeCreationJournal)exactKeys(e,['order','phase','target','method','args','captureNativeStepsBefore','result','captureNativeStepsAfter']);
  const a=c.application,b=c.preStrikeApplication;
  equalData(a.registry,b.registry,'Source layout and handle generations may not be replaced');equalData(a.params,b.params);
  equalData(a.controller.settings,b.controller.settings);equalData(a.controller.routeOptions,b.controller.routeOptions,'Source UI targets/options must survive unchanged');
  equal(a.controller.selectedId,b.controller.selectedId);
  for(const k of ['time','steps','dt','strokeSubsteps','nextId'])equal(a[k],b[k],'Cue construction cannot advance application '+k);
  equal(a.shots,b.shots+1);equal(a.revision,b.revision+1);
  requireThat(b.events.length<=120,'Bounded actual source event history required');
  equalData(a.events,[...b.events,{kind:'stroke',label:a.shots+'번째 타격 · '+a.controller.settings.speed.toFixed(2)+' m/s',time:a.time}].slice(-120),'Original history plus this initial stroke event only');
  equal(a.controller.undoCount,Math.min(30,b.controller.undoCount+1),'Original controller history length required');equal(a.controller.redoCount,0);equal(a.controller.paused,false);
}
function normalize(decoded,snapshot){
  for(const n of D.walk(decoded.state))if(n.kind==='float')requireThat(Number.isFinite(D.floatValue(n)),'Finite original native state required');
  const state=plain(decoded.state);
  const arena=name=>F(F(F(decoded.state,name),name),'items').items.flatMap((entry,index)=>entry.variant==='Occupied'?[{handle:{index,generation:Number(F(entry,'generation').value)},...plain(F(entry,'value'))}]:[]);
  return {snapshot,sourceRevision:decoded.sourceRevision,engineSha256:decoded.engineSha256,snapshotSha256:decoded.inputSha256,
    snapshotBytes:decoded.byteLength,verification:copy(decoded.verification),typedState:decoded.state,state,
    bodies:arena('bodies'),colliders:arena('colliders'),contactPairs:D.findStructs(F(decoded.state,'narrow_phase'),'ContactPair').map(plain)};
}
function bindNative(a,row,created){
  const bodies=new Map(row.bodies.map(b=>[key(b.handle),b])),colliders=new Map(row.colliders.map(c=>[key(c.handle),c]));
  equalData(row.state.gravity,[0,f(-a.params.gravity),0],'Native gravity must agree with original parameters');
  for(const o of [...a.registry.objects,...a.registry.statics]){
    const b=bodies.get(key(o.body));requireThat(b,'Actual registered body generation is missing');
    const attachments=o.kind==='ball'?[o.collider,o.pairCollider]:[o.collider];equalData(b.colliders,attachments,'Native attachment order must be retained');
    equal(b.body_type,o.kind==='ball'?'Dynamic':'Fixed');equal(b.enabled,true);
    for(const h of attachments)requireThat(same(colliders.get(key(h))?.parent?.handle,o.body),'Actual collider parent identity mismatch');
    if(o.kind==='ball'){
      equal(b.ccd.ccd_enabled,true);requireThat(b.mprops.max_extent>0,'Original registered sphere requires prepared native mass extent');
      Origin.validateRegisteredBodyIds(b,row.state.islands);
      const primary=colliders.get(key(o.collider)),pair=colliders.get(key(o.pairCollider));
      for(const c of [primary,pair]){
        equal(c.shape.variant,'Ball');equal(c.shape.value.radius,f(o.radius));equal(c.flags.enabled,'Enabled');equal(c.coll_type,'Solid');equal(c.contact_skin,0);
        equalData(c.parent.pos_wrt_parent,{translation:[0,0,0],rotation:[0,0,0,1],padding:0});
      }
      equalData(primary.flags.collision_groups,{memberships:1,filter:6,test_mode:'And'});equalData(pair.flags.collision_groups,{memberships:8,filter:8,test_mode:'And'});
      equal(primary.mprops.variant,'Mass');equal(primary.mprops.value,f(o.mass));equal(pair.mprops.variant,'Mass');equal(pair.mprops.value,0);
    }
  }
  if(!created){equal(row.state.impulse_joints.joint_graph.graph.edges.length,0,'Ready source must contain no cue joints');return;}
  const q=a.cue;
  for(const [h,attachments,type]of [[q.shaft,[q.shaftCollider],'Dynamic'],[q.head,[q.tipCollider,q.neckCollider],'Dynamic'],[q.guide,[],'Fixed']]){
    const b=bodies.get(key(h));requireThat(b,'Actual created cue body generation is missing');equal(b.body_type,type);equalData(b.colliders,attachments);
    for(const ch of attachments)requireThat(same(colliders.get(key(ch))?.parent?.handle,h),'Cue collider generation/parent mismatch');
    if(type==='Dynamic'){
      equalData(b.vels.linvel,['x','y','z'].map(k=>f(q.pose.direction[k]*a.controller.settings.speed)),'Cue axis/speed must bind the exact native created velocity');
      equalData(b.vels.angvel,[0,0,0]);
    }
  }
  const joints=row.state.impulse_joints.joint_graph.graph.edges.map(e=>e.weight);equal(joints.length,2);
  for(const [h,body1,body2]of [[q.flex,q.shaft,q.head],[q.prismatic,q.guide,q.shaft]]){
    const j=joints.find(j=>same(j.handle,h));requireThat(j&&same(j.body1,body1)&&same(j.body2,body2),'Actual cue joint generations and endpoint order required');
    equal(j.data.contacts_enabled,false);
  }
}
function bindBeforeAfter(before,row,c){
  equal(before.bodies.length,19);equal(before.colliders.length,22);equal(row.bodies.length,22);equal(row.colliders.length,25);
  for(const b of before.bodies){const after=row.bodies.find(x=>same(x.handle,b.handle));requireThat(after,'Original body generation disappeared');equalData(after,b,'Cue creation must not alter any existing body');}
  for(const co of before.colliders){const after=row.colliders.find(x=>same(x.handle,co.handle));requireThat(after,'Original collider generation disappeared');equalData(after,co,'Cue creation must not alter any existing collider');}
  // All non-creation managers are copied in full, including inactive entries,
  // solver caches, epochs, sleep scan stamps, free lists, journals and BVH order.
  for(const k of ['gravity','integration_parameters','islands','broad_phase','narrow_phase','multibody_joints','soft_bodies'])
    equalData(row.state[k],before.state[k],'Cue creation must retain the complete original native manager: '+k);
  const bodies=c.preStrikeApplication.registry.objects.map(o=>{
    const b=before.bodies.find(b=>same(b.handle,o.body));requireThat(b);
    return{body:copy(o.body),sleeping:b.activation.sleeping,linear:copy(b.vels.linvel),angular:copy(b.vels.angvel)};
  });
  equalData(c.readiness.bodies,bodies,'Readiness must bind the actual source native state');
  bindNative(c.preStrikeApplication,before,false);bindNative(c.application,row,true);
}
export async function projectLiveRegisteredThreeBall(input){
  assertOwnedInputData(input);exactKeys(input,['snapshot','preStrikeSnapshot','decoded','preStrikeDecoded','capture']);
  const owned=copy(input);assertOwnedInputData(owned);const {snapshot,preStrikeSnapshot,decoded,preStrikeDecoded,capture:c}=owned;
  for(const bytes of [snapshot,preStrikeSnapshot])requireThat(bytes instanceof Uint8Array&&bytes.length>0&&bytes.length<=D.MAX_BYTES,'Bounded owned native snapshot bytes required');
  validateCapture(c);canonicalizeCapture(c);
  // Copies are owned before either asynchronous verification starts.
  await verifyDecoded(decoded,snapshot);await verifyDecoded(preStrikeDecoded,preStrikeSnapshot);
  const created=normalize(decoded,snapshot),before=normalize(preStrikeDecoded,preStrikeSnapshot),a=c.application,b=c.preStrikeApplication;
  bindBeforeAfter(before,created,c);
  const clock=(application,native)=>({...Object.fromEntries(['time','steps','shots','revision'].map(k=>[k,application[k]])),nativeFrameIndex:native.state.broad_phase.frame_index});
  const selectedIndex=a.registry.objects.findIndex(o=>o.id===a.controller.selectedId),targets=b.game.objectIds.filter(id=>id!==a.controller.selectedId);
  const sourceOrigin=Origin.validateSourceOrigin({schema:Origin.SCHEMA,boundary:Origin.BOUNDARY,nativeRestoreUsed:true,
    preStrikeSnapshotSha256:before.snapshotSha256,createdSnapshotSha256:created.snapshotSha256,preStrikeClock:clock(b,before),createdClock:clock(a,created),
    selectedId:a.controller.selectedId,selectedIndex,selectedBody:copy(a.registry.objects[selectedIndex].body),targetIds:targets,
    routeTargets:{targetId:a.controller.routeOptions.targetId,secondId:a.controller.routeOptions.secondId},settings:copy(a.controller.settings),params:copy(a.params),gameBefore:copy(b.game),readiness:copy(c.readiness)});
  Origin.validateCapturedApplication(a,sourceOrigin);Origin.validateStrikeJournal(c.strikeCreationJournal,sourceOrigin,{apiJournalLength:c.apiJournalLength,cue:a.cue});
  return {kind:Origin.KIND,boundary:Origin.BOUNDARY,candidateInput:true,capability:copy(Origin.CAPABILITY),sourceOrigin,
    application:a,preStrikeApplication:b,before,created,strikeCreationJournal:c.strikeCreationJournal,
    strikeCreationJournalSha256:await journalDigest(c.strikeCreationJournal)};
}
export async function importLiveRegisteredThreeBall(decoder,input){
  assertOwnedInputData(input);exactKeys(input,['snapshot','preStrikeSnapshot','capture']);
  requireThat(typeof decoder?.decodeSnapshot==='function','Initialized read-only source decoder required');
  const owned=copy(input);assertOwnedInputData(owned);validateCapture(owned.capture);
  for(const bytes of [owned.snapshot,owned.preStrikeSnapshot])requireThat(bytes instanceof Uint8Array&&bytes.length>0&&bytes.length<=D.MAX_BYTES,'Bounded owned native snapshot bytes required');
  const preStrikeDecoded=await decoder.decodeSnapshot(owned.preStrikeSnapshot),decoded=await decoder.decodeSnapshot(owned.snapshot);
  return projectLiveRegisteredThreeBall({...owned,decoded,preStrikeDecoded});
}
export const requireLiveThreeBallNumericalOwner=Origin.requireNumericalOwner;
