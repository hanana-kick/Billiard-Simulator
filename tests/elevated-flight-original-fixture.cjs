'use strict';
// SPDX-License-Identifier: Apache-2.0
// Untouched original engine/controller oracle. Only goalStrikeCreated and the
// original API creation journal are candidate input; flight and rest only assert.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),v8=require('node:v8');
const F=require('./four-ball-created-fixture.cjs'),G=require('./elevated-flight-original-controller.cjs'),P=require('./initial-pair-original-fixture.cjs');
const copy=x=>structuredClone(x),same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation;
const SCHEMA='original-controller-elevated-flight-floor-lifecycle-v1';
const INPUT=Object.freeze({name:'legal-elevation20-low-tip-cloth-flight-land-rest',requiredOutcome:'native-rest',placements:Object.freeze([
 {id:1,x:-.30,z:0},{id:2,x:-.8,z:-.4},{id:3,x:.4,z:-.4},{id:4,x:.8,z:.4}].map(Object.freeze))});
const GEOMETRY=Object.freeze({radius:.03075,placementY:.0308,tipRadius:.006,predictionDistance:.0615*.001,
 derivation:'At elevation20 and tipY=-.88 the original pose surface vertical component is -.66447894, giving an upward normal while the swept tip remains above cloth. Speed2 reduces the proven speed5 flight to an on-table landing. Original collision-safe move/changeSettings/fire and native contacts alone establish the witness.'});
const SOURCES=[...new Set(['tests/elevated-flight-original-fixture.cjs',...G.SOURCES,...P.SOURCES])];
function identity(){return{schema:SCHEMA,original:G.identity(),input:copy(INPUT),settings:copy(G.SETTINGS),geometry:copy(GEOMETRY),
 sources:Object.fromEntries(SOURCES.map(p=>[p,F.hash(fs.readFileSync(path.resolve(__dirname,'..',p)))])),
 decoderSha256:process.env.RAPIER_SNAPSHOT_DECODER?F.hash(fs.readFileSync(process.env.RAPIER_SNAPSHOT_DECODER)):null};}
const isTarget=c=>c.kind==='cloth'&&c.ids.length===1&&c.ids[0]===1;
const targetState=contacts=>{const c=contacts.find(isTarget);return{pair:!!c,points:c?.manifolds.reduce((n,m)=>n+m.points,0)||0,active:!!c?.active,positive:!!c?.positive};};
const sphereState=lab=>({id:1,...G.sample(lab.get(1).body)});
function observeOriginal({recordFrames=true,journal=true,captureHs=[]}={}){
 let lab=null,controller=null,h=0,initialContacts=null,previousKey=null,previousSleep=null,lastCue=true,applicationPhase=null,previousTarget=null,maxHeight=null,ballBeforeWorld=null;
 const restore=[],rows=[],transitions=[],sleepTransitions=[],setterCalls=[],applicationImpulseJournal=[],milestones={},selected=new Set(captureHs);
 const sourceImpulseMethods=Object.fromEntries(['compliantTipContact','angularPatchResistance'].map(name=>[name,F.hash(PhysicsLab.prototype[name].toString())]));
 const remember=phase=>{if(selected.has(h))rows.push({boundary:'expected-only-h'+h+'-'+phase,candidateInput:false,hCount:h,nativeSteps:null,snapshot:lab.world.takeSnapshot(),application:G.application(controller)});};
 const milestone=(name,contacts)=>{if(!milestones[name])milestones[name]={h,contacts:copy(contacts),target:targetState(contacts),ball:sphereState(lab),ballBeforeWorld:copy(ballBeforeWorld),cuePresent:!!lab.cue,cueContact:lab.cue?{contacts:copy([...lab.cue.contacts]),stats:copy(lab.cue.stats)}:null,sleeping:lab.objects.map(o=>[o.id,o.body.isSleeping()])};};
 restore.push(F.observeMethod(LabController.prototype,'fire',{after(c,args,result){if(result){controller=c;lab=c.lab;initialContacts=P.contactsView(lab);previousTarget=targetState(initialContacts);previousSleep=lab.objects.map(o=>o.body.isSleeping());
  for(const o of lab.objects)for(const method of['setLinvel','setAngvel','setTranslation','setRotation','enableCcd','resetForces','resetTorques','wakeUp','sleep'])
   restore.push(F.observeMethod(o.body,method,{before(){setterCalls.push({h,method,id:o.id});}}));
  for(const o of lab.objects)for(const method of['applyImpulse','applyImpulseAtPoint','applyTorqueImpulse'])restore.push(F.observeMethod(o.body,method,{before(receiver,args){
   const expected=method==='applyImpulseAtPoint'?'compliantTipContact':method==='applyTorqueImpulse'?'angularPatchResistance':null;
   assert.ok(expected&&applicationPhase===expected,'Only unchanged original application contact-law impulses permitted');
   assert.equal(args.at(-1),method==='applyImpulseAtPoint','Unchanged original wake flag');
   applicationImpulseJournal.push({h:applicationPhase==='compliantTipContact'?h+1:h,method,id:o.id,sourceMethod:applicationPhase,sourceFunctionSha256:sourceImpulseMethods[applicationPhase],args:copy(args)});
  }}));
 }}}));
 for(const name of Object.keys(sourceImpulseMethods))restore.push(F.observeMethod(PhysicsLab.prototype,name,{before(receiver){if(lab&&receiver===lab){assert.equal(applicationPhase,null);applicationPhase=name;return true;}return false;},after(receiver,args,result,observed){if(observed)applicationPhase=null;}}));
 restore.push(F.observeMethod(F.R.World.prototype,'step',{before(world){if(lab&&world===lab.world){h++;ballBeforeWorld=sphereState(lab);remember('preWorld');}},after(world){if(!lab||world!==lab.world)return;
  const contacts=P.contactsView(lab),target=targetState(contacts),ball=sphereState(lab),key=JSON.stringify(contacts.map(c=>[c.kind,c.ids,c.active,c.positive,c.manifolds.map(m=>[m.points,m.solverContacts])]));
  if(!maxHeight||ball.translation[1]>maxHeight.ball.translation[1])maxHeight={h,ball};
  if(key!==previousKey){transitions.push({h,target,ball,contacts});previousKey=key;}
  if(previousTarget.positive&&!target.positive)milestone('firstImpulseLoss',contacts);
  if(previousTarget.active&&!target.active)milestone('firstActiveDeath',contacts);
  if(previousTarget.points&&!target.points)milestone('firstPointDeath',contacts);
  if(previousTarget.pair&&!target.pair)milestone('firstPairDeath',contacts);
  if(milestones.firstPairDeath&&!previousTarget.pair&&target.pair)milestone('firstPairBirthAfterFlight',contacts);
  if(milestones.firstPointDeath&&!previousTarget.points&&target.points)milestone('firstPointBirthAfterFlight',contacts);
  if(milestones.firstActiveDeath&&!previousTarget.active&&target.active)milestone('firstActiveBirthAfterFlight',contacts);
  if(milestones.firstActiveDeath&&target.positive)milestone('firstPositiveLanding',contacts);
  previousTarget=target;
  const sleeping=lab.objects.map(o=>o.body.isSleeping());if(JSON.stringify(sleeping)!==JSON.stringify(previousSleep)){sleepTransitions.push({h,sleeping:lab.objects.map((o,i)=>[o.id,sleeping[i]]),cuePresent:!!lab.cue});previousSleep=sleeping;}
  remember('postWorld');
 }}));
 restore.push(F.observeMethod(PhysicsLab.prototype,'angularPatchResistance',{after(receiver){if(!lab||receiver!==lab)return;
  if(lastCue&&!lab.cue)milestone('cueWithdrawal',P.contactsView(lab));lastCue=!!lab.cue;remember('postApplication');
 }}));
 try{const record=G.captureOriginal(INPUT,{recordFrames,journal});assert.deepEqual(setterCalls,[],'No original ball assignments or wake/sleep hacks after fire');
  for(const row of rows)row.nativeSteps=record.nativeStepsAtCreation+row.hCount;
  return{record,initialContacts,transitions,sleepTransitions,milestones,maxHeight,rows,setterCalls,sourceImpulseMethods,applicationImpulseJournal};
 }finally{while(restore.length)restore.pop()();}
}
function selectedHs(p){return[...new Set([1,p.maxHeight.h,p.record.hCount,...Object.values(p.milestones).map(x=>x.h),...p.sleepTransitions.map(x=>x.h)].flatMap(h=>[h-1,h,h+1]).filter(h=>h>0&&h<=p.record.hCount))].sort((a,b)=>a-b);}
function projection(row){return{h:row.hCount,boundary:row.boundary,candidateInput:false,snapshotSha256:row.snapshotSha256,graph:P.graphView(row),contactPairs:row.contactPairs,islands:row.state.islands,modifiedBodies:row.queues.modifiedBodies,bodies:row.bodies,proxies:row.proxies,pendingSetAabb:row.state.broad_phase.pending_set_aabb};}
function summary(p){return{schema:SCHEMA,input:copy(INPUT),settings:copy(G.SETTINGS),initialBoundary:'goalStrikeCreated',initialSnapshotSha256:p.record.boundaries.goalStrikeCreated?.snapshotSha256??F.hash(p.record.boundaries.goalStrikeCreated.snapshot),sourceOnly:true,candidateStateUsed:false,nativeRestoreUsed:false,postStrikeBallAssignments:p.setterCalls.length,originalApplicationImpulseCount:p.applicationImpulseJournal.length,originalApplicationImpulseSha256:F.journalDigest(p.applicationImpulseJournal),status:p.record.status,hCount:p.record.hCount,firstRestOuter:p.record.firstRestOuter,score:p.record.score,outcome:p.record.outcome,placements:p.record.placements,control:p.record.control,initialContacts:p.initialContacts,milestones:p.milestones,maxHeight:p.maxHeight,sleepTransitions:p.sleepTransitions,capturedBoundaries:p.rows.map(r=>r.boundary),transitionCount:p.transitions.length};}
function nativeContact(row,c){return row.contactPairs.find(p=>same(p.collider1,c.collider1)&&same(p.collider2,c.collider2)||same(p.collider1,c.collider2)&&same(p.collider2,c.collider1));}
function verify(p,{decoded=true}={}){
 assert.equal(p.schema,SCHEMA);assert.deepEqual(p.record.input,INPUT);assert.equal(p.record.candidateStateUsed,false);assert.equal(p.record.nativeRestoreUsed,false);assert.deepEqual(p.setterCalls,[]);
 assert.equal(p.record.status,'native-rest-complete');assert.equal(p.record.requiredOutcomeObserved,true);assert.deepEqual(p.record.settings,G.SETTINGS);assert.equal(p.record.control.fireAccepted,true);assert.equal(p.record.control.clearance.clear,true);
 assert.ok(G.SETTINGS.speed<=5&&G.SETTINGS.elevation<=85&&Math.hypot(G.SETTINGS.tipX,G.SETTINGS.tipY)<=.92);
 const initial=p.initialContacts.find(isTarget);assert.ok(initial?.active&&initial.positive);assert.equal(targetState(p.initialContacts).points,1);
 assert.equal(p.initialContacts.filter(c=>c.kind==='sphere-pair').length,0);
 assert.ok(p.applicationImpulseJournal.length>0);for(const j of p.applicationImpulseJournal){assert.equal(j.sourceFunctionSha256,p.sourceImpulseMethods[j.sourceMethod]);assert.equal(j.method,j.sourceMethod==='compliantTipContact'?'applyImpulseAtPoint':'applyTorqueImpulse');assert.equal(j.args.at(-1),j.sourceMethod==='compliantTipContact');}
 for(const name of['firstImpulseLoss','firstActiveDeath','firstPointDeath','firstPairDeath','firstPairBirthAfterFlight','firstPointBirthAfterFlight','firstActiveBirthAfterFlight','firstPositiveLanding','cueWithdrawal'])assert.ok(p.milestones[name],name);
 assert.ok(p.milestones.firstActiveDeath.h<p.maxHeight.h&&p.maxHeight.h<p.milestones.firstPositiveLanding.h);
 assert.ok(p.milestones.firstPairDeath.h<p.milestones.firstPairBirthAfterFlight.h);
 assert.ok(p.maxHeight.ball.translation[1]>GEOMETRY.radius+GEOMETRY.predictionDistance,'Actual native flight exceeds the contact envelope');
 assert.equal(p.milestones.firstActiveDeath.target.active,false);assert.equal(p.milestones.firstPointDeath.target.points,0);assert.equal(p.milestones.firstPairDeath.target.pair,false);
 assert.ok(p.milestones.firstPositiveLanding.ballBeforeWorld.linear[1]<0,'Landing enters original native world step with downward velocity; post-solve rebound is allowed');
 assert.deepEqual(p.sleepTransitions.at(-1).sleeping,[[1,true],[2,true],[3,true],[4,true]]);
 assert.ok(!p.record.events.some(e=>e.event.a?.kind==='floor'||e.event.b?.kind==='floor'),'Flight lands on table cloth, not room floor');
 if(decoded){G.verifyRecord(p.record,{decoded:true});const created=p.record.boundaries.goalStrikeCreated;assert.equal(created.candidateInput,true);
  for(const row of[...Object.values(p.record.boundaries),...p.rows]){assert.equal(F.hash(row.snapshot),row.snapshotSha256);assert.deepEqual(F.D.encodeLosslessTree(row.typedState),Buffer.from(row.snapshot));}
  assert.equal(created.contactPairs.length,p.initialContacts.length);for(const c of p.initialContacts)assert.ok(nativeContact(created,c));
  for(const milestone of Object.values(p.milestones)){const row=p.rows.find(r=>r.hCount===milestone.h&&r.boundary.endsWith('-postWorld'));assert.ok(row);
   if(milestone===p.milestones.cueWithdrawal)continue;
   const native=nativeContact(row,initial);assert.equal(!!native,milestone.target.pair);if(native){assert.equal(native.contacts.variant,'Rigid');assert.equal(native.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0),milestone.target.active);assert.equal(native.contacts.value.manifolds.reduce((n,m)=>n+m.points.length,0),milestone.target.points);}
   for(const c of milestone.contacts){const native=nativeContact(row,c);assert.ok(native);assert.equal(native.contacts.variant,'Rigid');assert.equal(native.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0),c.active);assert.equal(native.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0&&m.points.some(p=>p.data.impulse>0)),c.positive);}}
  assert.deepEqual(p.record.boundaries.physicalRest.snapshot,p.record.boundaries.controllerFinished.snapshot,'Original game scoring does not modify native state');
 }
 return p;
}
async function capture(file,{probe=false,probeFile=null}={}){
 assert.equal(process.env.ELEVATED_FLIGHT_SERIAL_SLOT,'1','Coordinator serial CPU slot required');assert.ok(path.isAbsolute(file));assert.ok(!fs.existsSync(file)&&!fs.existsSync(file+'.json'),'Never overwrite source evidence');
 const id=identity();assert.equal(id.sources['vendor/rapier.cjs'],F.D.ENGINE_SHA256);await F.R.init();assert.equal(F.R.version(),'0.21.0');
 let discovery;if(probeFile){discovery=v8.deserialize(fs.readFileSync(probeFile));assert.deepEqual(discovery.identity,id);verify(discovery,{decoded:false});}else discovery=observeOriginal({recordFrames:false,journal:false});
 const first=probe?discovery:observeOriginal({recordFrames:true,journal:true,captureHs:selectedHs(discovery)}),p={schema:SCHEMA,identity:id,...first};verify(p,{decoded:false});
 if(!probe){const independent=observeOriginal({recordFrames:false,journal:false,captureHs:selectedHs(discovery)}),unobserved=G.captureOriginal(INPUT,{recordFrames:false,journal:false});
  for(const name of Object.keys(first.record.boundaries)){assert.deepEqual(first.record.boundaries[name].snapshot,unobserved.boundaries[name].snapshot,'Unobserved original raw boundary '+name);assert.deepEqual(first.record.boundaries[name].snapshot,independent.record.boundaries[name].snapshot,'Independent original raw boundary '+name);assert.deepEqual(first.record.boundaries[name].application,independent.record.boundaries[name].application);}
  assert.deepEqual(first.record.events,unobserved.events);assert.deepEqual(first.record.events,independent.record.events);assert.deepEqual(first.transitions,independent.transitions);assert.deepEqual(first.initialContacts,independent.initialContacts);assert.deepEqual(first.milestones,discovery.milestones);assert.deepEqual(first.maxHeight,discovery.maxHeight);assert.deepEqual(first.sleepTransitions,discovery.sleepTransitions);assert.deepEqual(first.applicationImpulseJournal,independent.applicationImpulseJournal);assert.deepEqual(first.applicationImpulseJournal,discovery.applicationImpulseJournal);assert.deepEqual(first.rows.map(r=>[r.boundary,r.snapshot]),independent.rows.map(r=>[r.boundary,r.snapshot]));
  p.observerAgreement={independentOriginalRecreations:3,unobservedOriginalAgreement:true,byteIdenticalBoundaryCount:Object.keys(first.record.boundaries).length+first.rows.length,exactContactAndGameObservables:true};
  // Identical native bytes share one immutable decoded tree. Metadata and application
  // samples stay boundary-local; exact source bytes and roundtrip checks remain.
  const decodedByHash=new Map(),decode=row=>{const key=F.hash(row.snapshot),old=decodedByHash.get(key);if(old){assert.deepEqual(old.snapshot,row.snapshot);return{...old,...row};}const result=F.decodeBoundary(row);decodedByHash.set(key,result);return result;};
  for(const name of Object.keys(first.record.boundaries))first.record.boundaries[name]=decode(first.record.boundaries[name]);
  for(let i=0;i<p.rows.length;i++)p.rows[i]=decode(p.rows[i]);p.assertions=p.rows.map(projection);verify(p);
 }else p.initialDecoded=F.decodeBoundary(p.record.boundaries.goalStrikeCreated);
 assert.deepEqual(identity(),id);const bytes=v8.serialize(p),manifest={identity:id,sha256:F.hash(bytes),bytes:bytes.length,probe,apiJournalEncoding:F.JOURNAL_ENCODING,apiJournalSha256:F.journalDigest(p.record.apiJournal),...summary(p)};
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});fs.writeFileSync(file+'.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;
}
function load(file){const bytes=fs.readFileSync(file),m=JSON.parse(fs.readFileSync(file+'.json'));assert.deepEqual(m.identity,identity());assert.equal(F.hash(bytes),m.sha256);assert.equal(bytes.length,m.bytes);const p=v8.deserialize(bytes);assert.deepEqual(p.identity,m.identity);assert.equal(F.journalDigest(p.record.apiJournal),m.apiJournalSha256);verify(p,{decoded:!m.probe});return{...p,manifest:m};}
module.exports={SCHEMA,INPUT,GEOMETRY,SOURCES,identity,isTarget,targetState,observeOriginal,selectedHs,projection,summary,nativeContact,verify,capture,load};
if(require.main===module)capture(process.argv[2],{probe:process.argv[3]==='probe',probeFile:process.argv[4]||null}).then(m=>console.log(JSON.stringify(m,null,2))).catch(e=>{console.error(e.stack);process.exitCode=1;});
