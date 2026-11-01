/* SPDX-License-Identifier: Apache-2.0
 * Distinct initial-only metadata contract for a current original three-ball
 * controller fork. No numerical solver, engine, fixture or future state input.
 * Snapshot hashes bind verified bytes; they do not authenticate arbitrary data.
 */
(function(G){'use strict';
const SOURCE='b716d375efc0201003f0cd9ef7168eee0b62c177';
const ENGINE_SHA256='fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4';
const BOUNDARY='liveRegisteredThreeBallStrikeCreated',PHASE='liveRegisteredThreeBallStrikeCreation';
const SCHEMA='original-controller-live-three-ball-fork-v1';
const KIND='original-live-registered-three-ball-source-projection';
const ENVIRONMENT='original-controller-live-registered-three-ball-layout';
const FIXTURE_VARIANT='source-validated-original-live-registered-three-ball-cue-input-v1';
const CAPABILITY=Object.freeze({initialSnapshotOnly:true,originalThreeBallRules:true,sourceApplicationClock:true,
  preservesNativeManagers:true,selectedCueFromSource:true,physicsSteps:0,gpuWork:false,
  numericalOwnerAvailable:false,wholeShot:false});
const PARAMS=Object.freeze({gravity:9.81,clothFriction:.2,ballFriction:.04,ballRestitution:.93,cushionFriction:.15,
  cushionRestitution:.82,clothRestitution:.2,tipFriction:.7,tipNormalStiffness:1000000,tipTangentialStiffness:400000,
  tipNormalDamping:110,tipTangentialDamping:10,cueLateralStiffness:1200,cueLateralDamping:1,rollingLength:.00045,spinLength:.00035});
const CUE_METHODS=Object.freeze(['createRigidBody','createCollider','createRigidBody','createCollider','createCollider',
  'createImpulseJoint','setContactsEnabled','createRigidBody','createImpulseJoint','setLimits','setContactsEnabled','setLinvel','setLinvel']);
const ORIGIN_KEYS=['schema','boundary','nativeRestoreUsed','preStrikeSnapshotSha256','createdSnapshotSha256',
  'preStrikeClock','createdClock','selectedId','selectedIndex','selectedBody','targetIds','routeTargets','settings','params','gameBefore','readiness'];
const fail=message=>{throw Object.assign(new RangeError('Live three-ball origin: '+message),{code:'three-ball-source-contract'});};
const need=(value,message)=>{if(!value)fail(message);};
const sameHandle=(a,b)=>!!a&&!!b&&a.index===b.index&&a.generation===b.generation;
const key=h=>h.index+':'+h.generation;
function sameData(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();
  return ak.length===bk.length&&ak.every((k,i)=>k===bk[i]&&sameData(a[k],b[k]));
}
function exactKeys(v,keys,label){
  need(v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)),label+' exact fields required');
}
function plainData(root){
  const active=new Set();let count=0;
  function visit(v,depth){
    need(++count<=100000&&depth<=64,'bounded source metadata required');
    if(v===null||typeof v!=='object'){need(v===null||['undefined','string','boolean','number'].includes(typeof v),'plain source metadata required');return;}
    need(!active.has(v),'cyclic source metadata prohibited');
    need(Array.isArray(v)||Object.getPrototypeOf(v)===Object.prototype,'plain source object required');active.add(v);
    for(const k of Reflect.ownKeys(v)){const d=Object.getOwnPropertyDescriptor(v,k);need(typeof k==='string'&&Object.hasOwn(d,'value'),'source accessors/symbols prohibited');visit(d.value,depth+1);}
    active.delete(v);
  }
  visit(root,0);
}
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function handle(h){
  exactKeys(h,['index','generation'],'native handle');
  for(const k of ['index','generation'])need(Number.isInteger(h[k])&&h[k]>=0&&h[k]<=0xffffffff&&!Object.is(h[k],-0),'generation-bearing u32 handle required');
  return h;
}
function settings(v){
  exactKeys(v,['angle','elevation','tipX','tipY','speed'],'strike settings');
  need(Object.values(v).every(Number.isFinite)&&v.elevation>=0&&v.elevation<=85&&v.speed>0&&v.speed<=10&&Math.hypot(v.tipX,v.tipY)<1,'original finite strike-control ranges required');
}
function fixedParams(p){exactKeys(p,Object.keys(PARAMS),'physical parameters');need(sameData(p,PARAMS),'nondefault physical parameters remain unsupported');}
function clock(c){
  exactKeys(c,['time','steps','shots','revision','nativeFrameIndex'],'source clock');
  need(Number.isFinite(c.time)&&c.time>=0&&!Object.is(c.time,-0),'actual nonnegative application time required');
  for(const k of ['steps','shots','revision','nativeFrameIndex'])need(Number.isSafeInteger(c[k])&&c[k]>=0&&!Object.is(c[k],-0),'actual integer '+k+' required');
  need(c.nativeFrameIndex<=0xffffffff,'decoded native frame index must remain u32');
}
function game(g){
  exactKeys(g,['kind','threeCushion','cueIds','redIds','objectIds','scores','activeCue','pending','lastResult'],'game');
  need(g.kind==='three'&&g.threeCushion===true&&typeof g.lastResult==='string','original three-ball three-cushion rules required');
  need(Array.isArray(g.cueIds)&&g.cueIds.length===2&&Array.isArray(g.objectIds)&&g.objectIds.length===3&&sameData(g.redIds,[]),'two actual cue IDs and three original object IDs required');
  need(g.objectIds.every(id=>Number.isSafeInteger(id)&&id>0)&&new Set(g.objectIds).size===3&&sameData(g.cueIds,g.objectIds.slice(0,2)),'ordered distinct original game identities required');
  need(g.cueIds.includes(g.activeCue),'actual active cue required');exactKeys(g.scores,g.cueIds.map(String),'scores');
  need(Object.values(g.scores).every(x=>Number.isSafeInteger(x)&&x>=0),'actual nonnegative three-ball scores required');
}
function readiness(r){
  exactKeys(r,['cueAbsent','pendingAbsent','anyMotion','fireAccepted','bodies'],'readiness');
  need(r.cueAbsent===true&&r.pendingAbsent===true&&r.anyMotion===false&&r.fireAccepted===true,'observed original ready and accepted fire required');
  need(Array.isArray(r.bodies)&&r.bodies.length===3,'all three original readiness bodies required');
  const ids=new Set();
  for(const b of r.bodies){
    exactKeys(b,['body','sleeping','linear','angular'],'readiness body');handle(b.body);
    need(!ids.has(key(b.body)),'duplicate readiness body');ids.add(key(b.body));need(typeof b.sleeping==='boolean','native sleeping flag required');
    for(const k of ['linear','angular'])need(Array.isArray(b[k])&&b[k].length===3&&b[k].every(x=>Number.isFinite(x)&&Object.is(Math.fround(x),x)),'exact native f32 readiness vectors required');
    need(b.sleeping||(Math.hypot(...b.linear)<=.002&&Math.hypot(...b.angular)<=.05),'original anyMotion predicate must be false without forcing sleep');
  }
}
function validateSourceOrigin(input){
  plainData(input);exactKeys(input,ORIGIN_KEYS,'source origin');const o=structuredClone(input);
  need(o.schema===SCHEMA&&o.boundary===BOUNDARY&&o.nativeRestoreUsed===true,'distinct observed three-ball fork origin required');
  for(const h of [o.preStrikeSnapshotSha256,o.createdSnapshotSha256])need(typeof h==='string'&&/^[0-9a-f]{64}$/.test(h),'snapshot SHA-256 required');
  need(o.preStrikeSnapshotSha256!==o.createdSnapshotSha256,'pre-strike and newly created cue snapshots must differ');clock(o.preStrikeClock);clock(o.createdClock);
  const p=o.preStrikeClock,c=o.createdClock;
  need(c.time===p.time&&c.steps===p.steps&&c.nativeFrameIndex===p.nativeFrameIndex,'cue construction must execute zero native/application steps');
  need(c.shots===p.shots+1&&c.revision===p.revision+1,'one original strike must advance shot and revision once');
  need(Number.isSafeInteger(o.selectedId)&&o.selectedId>0&&Number.isInteger(o.selectedIndex)&&o.selectedIndex>=0&&o.selectedIndex<3,'actual selected object ID/index required');
  handle(o.selectedBody);settings(o.settings);fixedParams(o.params);game(o.gameBefore);
  need(o.gameBefore.pending===null&&o.gameBefore.cueIds.includes(o.selectedId),'ready original game and selected legal cue required');
  need(o.gameBefore.objectIds[o.selectedIndex]===o.selectedId,'selected index must preserve the actual source object order');
  need(sameData(o.targetIds,o.gameBefore.objectIds.filter(id=>id!==o.selectedId)),'both other balls are targets, including the opponent cue');
  exactKeys(o.routeTargets,['targetId','secondId'],'route targets');
  need(o.routeTargets.targetId!==o.routeTargets.secondId&&[o.routeTargets.targetId,o.routeTargets.secondId].every(id=>o.targetIds.includes(id)),'actual route targets must be the two other source balls');
  readiness(o.readiness);need(sameHandle(o.readiness.bodies[o.selectedIndex].body,o.selectedBody),'selected index must bind source-ordered readiness body');
  return freeze(o);
}
function validateCapturedApplication(a,input){
  const o=validateSourceOrigin(input);need(a&&a.registry&&a.controller&&a.cue,'contemporaneous original created application required');
  for(const k of ['time','steps','shots','revision'])need(Object.is(a[k],o.createdClock[k]),'application '+k+' differs from observed clock');
  need(a.dt===1/960&&a.strokeSubsteps===64,'original application timestep/subdivisions required');
  need(a.controller.gameMode==='free'&&a.controller.selectedId===o.selectedId&&a.cue.selectedId===o.selectedId,'controller and cue selection must match source origin');
  need(sameData(a.controller.settings,o.settings)&&sameData(a.params,o.params),'application controls/materials must equal source origin');
  need(a.controller.routeOptions.targetId===o.routeTargets.targetId&&a.controller.routeOptions.secondId===o.routeTargets.secondId,'original UI target order must be preserved');
  const objects=a.registry.objects;
  need(a.registry.staticCount===16&&a.registry.statics?.length===16&&Array.isArray(objects)&&objects.length===3,'complete original source registry required');
  need(sameData(objects.map(b=>b.id),o.gameBefore.objectIds)&&objects.every((b,i)=>b.index===i&&sameHandle(b.body,o.readiness.bodies[i].body)),'source registry order, IDs and generations must be unchanged');
  need(sameHandle(objects[o.selectedIndex].body,o.selectedBody),'selected source body must match its original registry identity');
  need(a.cue.started===a.time&&a.cue.contacted===false&&sameData(a.cue.contacts,[])&&sameData(a.cue.obstructions,[]),'fresh source cue elapsed zero required');
  need(sameData(a.cue.stats,{firstContact:null,lastContact:null,peakNormalForce:0,maxCompression:0,normalImpulse:0,contactEpisodes:0}),'fresh source cue statistics required');
  game(a.game);
  for(const k of ['kind','threeCushion','cueIds','redIds','objectIds','scores','lastResult'])need(sameData(a.game[k],o.gameBefore[k]),'fire may not replace game '+k);
  need(a.game.activeCue===o.selectedId,'created game active cue must follow actual selection');
  const p=a.game.pending;exactKeys(p,['cueId','reds','foul','threeCushion','cushions','goalCushions','targets'],'pending shot');
  need(p.cueId===o.selectedId&&sameData(p.reds,[])&&p.foul===false&&p.threeCushion===true&&p.cushions===0&&p.goalCushions===null&&sameData(p.targets,o.targetIds),'genuine newly begun three-cushion shot and both targets required');
  return o;
}
function validateStrikeJournal(rows,input,options){
  const o=validateSourceOrigin(input);plainData(rows);need(Array.isArray(rows)&&rows.length===CUE_METHODS.length,'exact thirteen original cue construction calls required');
  need(options&&Number.isSafeInteger(options.apiJournalLength)&&options.apiJournalLength===14&&options.cue,'actual capture journal and cue handles required');
  const cue=options.cue;for(const k of ['shaft','shaftCollider','head','tipCollider','neckCollider','flex','guide','prismatic'])handle(cue[k]);
  const expected=[cue.shaft,cue.shaftCollider,cue.head,cue.tipCollider,cue.neckCollider,cue.flex,cue.flex,cue.guide,cue.prismatic,cue.prismatic,cue.prismatic,cue.shaft,cue.head];
  rows.forEach((e,i)=>{
    exactKeys(e,['order','phase','target','method','args','captureNativeStepsBefore','result','captureNativeStepsAfter'],'construction journal row');
    need(e.method===CUE_METHODS[i]&&e.phase===PHASE&&e.order===i+1,'observed source construction order/phase required');
    need(e.captureNativeStepsBefore===0&&e.captureNativeStepsAfter===0,'no native step during cue creation');need(Array.isArray(e.args),'observed native arguments required');
    need(sameHandle((e.method.startsWith('create')?e.result:e.target)?.handle,expected[i]),'actual journal result/target generation mismatch');
  });
  for(const [i,parent]of [[1,cue.shaft],[3,cue.head],[4,cue.head]])need(sameHandle(rows[i].args[1]?.handle,parent),'observed collider parent mismatch');
  for(const [i,a,b]of [[5,cue.shaft,cue.head],[8,cue.guide,cue.shaft]])need(sameHandle(rows[i].args[1]?.handle,a)&&sameHandle(rows[i].args[2]?.handle,b)&&rows[i].args[3]===true,'observed original joint endpoints/wake required');
  need(sameData(rows[6].args,[false])&&sameData(rows[9].args,[-.08,.13])&&sameData(rows[10].args,[false])&&rows[11].args[1]===true&&rows[12].args[1]===true,'original joint mutation and cue wake calls required');
  return o;
}
function validateRegisteredBodyIds(body,manager){
  const ids=body?.ids,U=0xffffffff;exactKeys(ids,['active_island_id','active_set_id','island_id','island_index'],'pinned RigidBodyIds');
  for(const k of Object.keys(ids))need(Number.isInteger(ids[k])&&ids[k]>=0&&ids[k]<U&&!Object.is(ids[k],-0),'registered source membership, never a fresh/disabled sentinel required');
  need(sameHandle(manager?.persistent?.islands?.v?.[ids.island_id]?.bodies?.[ids.island_index],body.handle),'persistent native membership must resolve to the exact body generation');
  need(sameHandle(manager?.islands?.v?.[ids.active_island_id]?.bodies?.[ids.active_set_id],body.handle),'active-or-sleeping storage membership must resolve to the exact body generation');
  return ids;
}
// Live family admission for shared source-created cue preprocessing only.
// This does not admit the projection to a complete numerical world owner.
function validateCreated(c,r){
 const o=validateSourceOrigin(c?.sourceOrigin);
 need(c?.originalLiveRegisteredThreeBallCreation===true&&c.boundary===BOUNDARY&&!c.originalLiveRegisteredFourBallCreation&&!c.originalFourBallCreation&&!c.originalSettledFourBallCreation&&!c.originalPlacedGoalFourBallCreation&&!r?.freshBall,'distinct three-ball source creation required');
 need(c.sourceRevision===SOURCE&&c.engineSha256===ENGINE_SHA256&&c.snapshotSha256===o.createdSnapshotSha256,'pinned actual source snapshot identity required');
 need(!Object.hasOwn(c,'sourceNativeSteps'),'frame index is not a historical native step count');
 for(const [k,v]of Object.entries({sourceNativeFrameIndex:o.createdClock.nativeFrameIndex,sourceApplicationSteps:o.createdClock.steps,sourceApplicationTime:o.createdClock.time,sourceShots:o.createdClock.shots,sourceSelectedId:o.selectedId,sourceSelectedIndex:o.selectedIndex}))need(Object.is(c[k],v),'created '+k+' must match actual source origin');
 need(sameHandle(c.sourceSelectedBody,o.selectedBody)&&sameHandle(r.ball,o.selectedBody),'actual selected cue identity required');
 const ordered=[o.readiness.bodies[o.selectedIndex],...o.readiness.bodies.filter((_,i)=>i!==o.selectedIndex)],roles=['ball','otherBall1','otherBall2'];
 exactKeys(r,[...roles,'floor','shaft','head','guide'],'three-ball creation roles');exactKeys(c.bodies,Object.keys(r),'three-ball creation bodies');
 for(let i=0;i<3;i++){
  const role=roles[i],b=c.bodies[role],v=ordered[i];
  need(sameHandle(r[role],v.body)&&sameHandle(b.handle,v.body),'selected and remaining source registry identities required');
  need(b.body_type==='Dynamic'&&b.activation.sleeping===v.sleeping&&sameData(b.vels.linvel,v.linear)&&sameData(b.vels.angvel,v.angular)&&b.mprops.max_extent>0,'original registered readiness and prepared mass required');
  validateRegisteredBodyIds(b,c.islands);
 }
 return o;
}
function validateCueApplication(a,createdOrOrigin){
 const o=validateSourceOrigin(createdOrOrigin?.sourceOrigin??createdOrOrigin);
 need(a?.environmentContract===ENVIRONMENT&&a.fixtureVariant===FIXTURE_VARIANT,'distinct live three-ball cue environment and source variant required');
 need(a.selectedId===o.selectedId&&a.selectedIndex===o.selectedIndex&&sameData(a.strikeSettings,o.settings),'projected cue selection/settings must match actual three-ball origin');
 need(a.initialElapsed===0&&a.initialTime===o.createdClock.time&&a.started===o.createdClock.time&&a.dt===1/960&&a.subdivisions===64,'actual elapsed-zero live three-ball cue clock required');
 return o;
}
function assertComponentIdentity(component,input=component?.sourceOrigin){
 const o=validateSourceOrigin(input);need(sameData(component.sourceOrigin,o),'complete identical three-ball source origin required');
 need(component.boundary===BOUNDARY&&component.initialSnapshotSha256===o.createdSnapshotSha256,'three-ball component initial source identity required');return o;
}
// Deliberately cannot return a numerical seed or invoke a solver. Existing
// three-ball owners accept constructor-only selected-index-zero state. A later
// owner must explicitly implement this distinct contract before admission.
function requireNumericalOwner(projection){
  need(projection?.kind===KIND&&projection.boundary===BOUNDARY,'current three-ball source projection required');
  throw Object.assign(new RangeError('No numerical owner implements the current live registered three-ball source contract; legacy three-ball and four-ball seeds may not be substituted.'),
    {code:'three-ball-live-owner-unavailable',boundary:BOUNDARY});
}
const api=Object.freeze({SOURCE,ENGINE_SHA256,BOUNDARY,PHASE,SCHEMA,KIND,ENVIRONMENT,FIXTURE_VARIANT,CAPABILITY,PARAMS,CUE_METHODS,sameHandle,sameData,
  assertComponentIdentity,validateCreated,validateCueApplication,validateHandle:handle,validateSettings:settings,validateFixedParams:fixedParams,validateGame:game,validateSourceOrigin,
  validateCapturedApplication,validateStrikeJournal,validateRegisteredBodyIds,requireNumericalOwner});
G.LabLiveThreeBallOriginExperimental=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
