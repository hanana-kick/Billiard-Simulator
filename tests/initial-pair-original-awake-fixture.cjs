'use strict';
// SPDX-License-Identifier: Apache-2.0
// Read-only original-controller oracle. Only goalStrikeCreated and its untouched
// original creation journal are candidate input. All later native rows assert.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),v8=require('node:v8');
const F=require('./four-ball-created-fixture.cjs'),G=require('./initial-pair-original-awake-controller.cjs');
const copy=x=>structuredClone(x),same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation;
const SCHEMA='original-controller-awake-retained-pair-four-ball-oracle-v1';
const INPUT=Object.freeze({name:'stationary-awake-red-pair-default-strike-to-native-pair-sleep',requiredOutcome:'retained-pair-native-sleep',placements:Object.freeze([
 {id:1,x:-.30,z:-.4},{id:2,x:-.8,z:0},{id:3,x:0,z:.3},{id:4,x:.06152,z:.3}].map(Object.freeze))});
const GEOMETRY=Object.freeze({radius:.03075,placementY:.0308,diameter:.0615,proposedCenterDistance:.06152,predictionDistance:.0615*.001,
 derivation:'Original collision-safe moves place the two red balls 20 micrometers apart, away from the default cue path. The original anyMotion gate permits actual fire after stationarity but before sleep; observe native pair retention through whole-island sleep.'});
const SOURCES=['tests/initial-pair-original-awake-fixture.cjs','tests/initial-pair-original-awake-controller.cjs','tests/four-ball-created-fixture.cjs',
 'src/controller.js','src/physics.js','src/game-rules.js','src/math.js','src/render-cadence.js','vendor/rapier.cjs','tools/rapier-snapshot-decoder/index.cjs'];
function identity(){return{schema:SCHEMA,original:G.identity(),input:copy(INPUT),geometry:copy(GEOMETRY),
 sources:Object.fromEntries(SOURCES.map(p=>[p,F.hash(fs.readFileSync(path.resolve(__dirname,'..',p)))])),
 decoderSha256:process.env.RAPIER_SNAPSHOT_DECODER?F.hash(fs.readFileSync(process.env.RAPIER_SNAPSHOT_DECODER)):null};}
// Dense original contact graph + linked-list order, independent of every
// candidate importer/exporter or graph helper.
function graphView(row){
 const U=0xffffffff,graph=row.state.narrow_phase.contact_graph.graph,key=h=>h.index+':'+h.generation,by=new Map(row.colliders.map(c=>[key(c.handle),c]));
 // removeCue deletes collider arena entries before the following world step
 // drains native contact removals. Such pending graph edges are still real;
 // retain their exact manifold body handles instead of inventing live colliders.
 const body=(e,side)=>{const c=by.get(key(e['collider'+side]));if(c)return copy(c.parent.handle);
  assert.equal(e.contacts.variant,'Rigid');const bodies=e.contacts.value.manifolds.map(m=>m.data['rigid_body'+side]);assert.ok(bodies.length&&bodies[0]);assert.ok(bodies.every(b=>same(b,bodies[0])));return copy(bodies[0]);};
 const edges=graph.edges.map(({weight:e})=>({collider1:copy(e.collider1),collider2:copy(e.collider2),body1:body(e,1),body2:body(e,2),active:e.contacts.variant==='Rigid'&&e.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0)}));
 const adjacency=row.colliders.map(c=>{const node=graph.nodes.find(n=>same(n.weight,c.handle)),out={collider:copy(c.handle),outgoing:[],incoming:[]};if(node)for(let side=0;side<2;side++){const seen=new Set();let at=node.next[side];while(at!==U){assert.ok(!seen.has(at)&&graph.edges[at]);seen.add(at);out[side?'incoming':'outgoing'].push(at);at=graph.edges[at].next[side];}}return out;});
 return{edges,adjacency};
}
function contactsView(lab){
 const contacts=[];
 const add=(kind,ids,a,b,label=null)=>{let retained=false;lab.world.contactPairsWith(a,c=>{if(c.handle===b.handle)retained=true;});if(!retained)return;
  const manifolds=[];lab.world.contactPair(a,b,(m,flipped)=>{const n=m.normal();manifolds.push({flipped,normal:[n.x,n.y,n.z],points:m.numContacts(),solverContacts:m.numSolverContacts(),
   distances:Array.from({length:m.numContacts()},(_,k)=>m.contactDist(k)),impulses:Array.from({length:m.numContacts()},(_,k)=>m.contactImpulse(k))});});
  contacts.push({kind,ids,label,collider1:F.parts(a.handle),collider2:F.parts(b.handle),active:manifolds.some(m=>m.solverContacts>0),positive:manifolds.some(m=>m.solverContacts>0&&m.impulses.some(x=>x>0)),manifolds});};
 for(let i=0;i<lab.objects.length;i++)for(let j=i+1;j<lab.objects.length;j++)add('sphere-pair',[lab.objects[i].id,lab.objects[j].id],lab.objects[i].pairCollider,lab.objects[j].pairCollider);
 for(const s of lab.statics.filter(s=>s.kind==='cloth'||s.kind==='cushion'))for(const o of lab.objects)add(s.kind,[o.id],s.collider,o.collider,s.label);
 if(lab.cue)for(const name of['tip','shaft','neck'])for(const o of lab.objects)add('cue-'+name,[o.id],lab.cue[name],o.collider);
 return contacts;
}
const isTarget=c=>c.kind==='sphere-pair'&&c.ids[0]===3&&c.ids[1]===4;
function observeOriginal({recordFrames=true,journal=true,captureHs=[]}={}){
 let lab=null,h=0,initialContacts=null,previousKey=null,previousSleep=null,lastCue=true,applicationPhase=null;
 const restore=[],rows=[],transitions=[],sleepTransitions=[],setterCalls=[],applicationImpulseJournal=[],milestones={},selected=new Set(captureHs);
 const sourceImpulseMethods=Object.fromEntries(['compliantTipContact','angularPatchResistance'].map(name=>[name,F.hash(PhysicsLab.prototype[name].toString())]));
 const remember=phase=>{if(selected.has(h))rows.push({boundary:'expected-only-h'+h+'-'+phase,candidateInput:false,hCount:h,nativeSteps:null,snapshot:lab.world.takeSnapshot(),application:null});};
 const milestone=(name,contacts)=>{if(!milestones[name])milestones[name]={h,contacts:copy(contacts),cuePresent:!!lab.cue,cueContact:lab.cue?{contacts:copy([...lab.cue.contacts]),stats:copy(lab.cue.stats)}:null,sleeping:lab.objects.map(o=>[o.id,o.body.isSleeping()])};};
 restore.push(F.observeMethod(LabController.prototype,'fire',{after(c,args,result){if(result){lab=c.lab;initialContacts=contactsView(lab);previousSleep=lab.objects.map(o=>o.body.isSleeping());
  for(const o of lab.objects)for(const method of['setLinvel','setAngvel','setTranslation','setRotation','enableCcd','resetForces','resetTorques','wakeUp','sleep'])
   restore.push(F.observeMethod(o.body,method,{before(){setterCalls.push({h,method,id:o.id});}}));
  for(const o of lab.objects)for(const method of['applyImpulse','applyImpulseAtPoint','applyTorqueImpulse'])restore.push(F.observeMethod(o.body,method,{before(receiver,args){
   // These two exact unchanged source methods are the application's physical
   // contact laws, not fixture injection. Reject all other impulse callsites.
   const expected=method==='applyImpulseAtPoint'?'compliantTipContact':method==='applyTorqueImpulse'?'angularPatchResistance':null;
   assert.ok(expected&&applicationPhase===expected,'Only original application contact-law impulses permitted');
   assert.equal(args.at(-1),method==='applyImpulseAtPoint','Exact original wake flag, not a fixture wake hack');
   applicationImpulseJournal.push({h:applicationPhase==='compliantTipContact'?h+1:h,method,id:o.id,sourceMethod:applicationPhase,sourceFunctionSha256:sourceImpulseMethods[applicationPhase],args:copy(args)});
  }}));
 }}}));
 for(const name of Object.keys(sourceImpulseMethods))restore.push(F.observeMethod(PhysicsLab.prototype,name,{before(receiver){if(lab&&receiver===lab){assert.equal(applicationPhase,null);applicationPhase=name;return true;}return false;},after(receiver,args,result,observed){if(observed)applicationPhase=null;}}));
 restore.push(F.observeMethod(F.R.World.prototype,'step',{before(world){if(lab&&world===lab.world){h++;remember('preWorld');}},after(world){if(!lab||world!==lab.world)return;
  const contacts=contactsView(lab),target=contacts.find(isTarget),key=JSON.stringify(contacts.map(c=>[c.kind,c.ids,c.active,c.positive]));
  if(key!==previousKey){transitions.push({h,contacts});previousKey=key;}
  if(target?.active)milestone('firstActive',contacts);
  if(target?.active&&lab.get(3).body.isSleeping()&&lab.get(4).body.isSleeping())milestone('firstRetainedPairSleep',contacts);
  if(target?.positive)milestone('firstPositive',contacts);
  if(target?.positive&&contacts.some(c=>c.kind.startsWith('cue-')&&c.positive&&c.ids.includes(1)))milestone('firstCueCoupledPositive',contacts);
  if(target?.positive&&lab.cue?.contacts.has(1))milestone('firstCompliantCueCoupledPositive',contacts);
  if(target?.positive&&contacts.some(c=>c.kind==='cloth'&&c.positive&&c.ids.some(id=>target.ids.includes(id))))milestone('firstClothCoupledPositive',contacts);
  if(milestones.firstPositive&&!target?.active)milestone('firstInactiveAfterPositive',contacts);
  if(milestones.firstPositive&&!target)milestone('firstRemovedAfterPositive',contacts);
  const sleeping=lab.objects.map(o=>o.body.isSleeping());if(JSON.stringify(sleeping)!==JSON.stringify(previousSleep)){sleepTransitions.push({h,sleeping:lab.objects.map((o,i)=>[o.id,sleeping[i]]),cuePresent:!!lab.cue});previousSleep=sleeping;}
  remember('postWorld');
 }}));
 restore.push(F.observeMethod(PhysicsLab.prototype,'angularPatchResistance',{after(receiver){if(!lab||receiver!==lab)return;
  if(lastCue&&!lab.cue)milestone('cueWithdrawal',contactsView(lab));lastCue=!!lab.cue;remember('postApplication');
 }}));
 try{const record=G.captureOriginal(INPUT,{recordFrames,journal});assert.deepEqual(setterCalls,[],'No original ball assignments or wake/sleep hacks after fire; untouched application impulses remain legitimate source physics');
  for(const row of rows){row.nativeSteps=record.nativeStepsAtCreation+row.hCount;row.application={registry:copy(record.boundaries.goalStrikeCreated.application.registry),...(row.boundary.endsWith('-postApplication')?(record.frames[row.hCount-1]??{}):{})};}
  return{record,initialContacts,transitions,sleepTransitions,milestones,rows,setterCalls,sourceImpulseMethods,applicationImpulseJournal};
 }finally{while(restore.length)restore.pop()();}
}
function selectedHs(p){return[...new Set([1,...Object.values(p.milestones).map(x=>x.h),...p.sleepTransitions.map(x=>x.h)].flatMap(h=>[h-1,h,h+1]).filter(h=>h>0&&h<=p.record.hCount))].sort((a,b)=>a-b);}
function projection(row){return{h:row.hCount,boundary:row.boundary,candidateInput:false,snapshotSha256:row.snapshotSha256,graph:graphView(row),contactPairs:copy(row.contactPairs),islands:copy(row.state.islands),modifiedBodies:copy(row.queues.modifiedBodies),bodies:copy(row.bodies),proxies:copy(row.proxies),pendingSetAabb:copy(row.state.broad_phase.pending_set_aabb)};}
function summary(p){return{schema:SCHEMA,input:copy(INPUT),initialBoundary:'goalStrikeCreated',initialSnapshotSha256:p.record.boundaries.goalStrikeCreated?.snapshotSha256??F.hash(p.record.boundaries.goalStrikeCreated.snapshot),sourceOnly:true,candidateStateUsed:false,nativeRestoreUsed:false,postStrikeBallAssignments:p.setterCalls.length,originalApplicationImpulseCount:p.applicationImpulseJournal.length,originalApplicationImpulseSha256:F.journalDigest(p.applicationImpulseJournal),status:p.record.status,hCount:p.record.hCount,firstPairSleepOuter:p.record.firstPairSleepOuter,readiness:p.record.readiness,score:p.record.score,outcome:p.record.outcome,placements:p.record.placements,control:p.record.control,initialContacts:p.initialContacts,milestones:p.milestones,sleepTransitions:p.sleepTransitions,capturedBoundaries:p.rows.map(r=>r.boundary),transitionCount:p.transitions.length};}
function nativeContact(row,c){return row.contactPairs.find(p=>same(p.collider1,c.collider1)&&same(p.collider2,c.collider2)||same(p.collider1,c.collider2)&&same(p.collider2,c.collider1));}
function verify(p,{decoded=true}={}){
 assert.equal(p.schema,SCHEMA);assert.deepEqual(p.record.input,INPUT);assert.equal(p.record.candidateStateUsed,false);assert.equal(p.record.nativeRestoreUsed,false);assert.deepEqual(p.setterCalls,[]);
 assert.equal(p.record.status,'native-retained-pair-sleep-complete');assert.equal(p.record.requiredOutcomeObserved,true);assert.deepEqual(p.record.settings,F.SETTINGS);assert.equal(p.record.control.fireAccepted,true);
 const initialPair=p.initialContacts.find(isTarget);assert.ok(initialPair,'Original initial retained red/red pair');assert.ok(initialPair.active,'Initial original solver contact retained');assert.ok(!initialPair.positive,'Initial pair has no injected impulse');
 assert.equal(p.initialContacts.filter(c=>c.kind==='sphere-pair').length,1);
 assert.ok(p.applicationImpulseJournal.length>0);for(const j of p.applicationImpulseJournal){assert.equal(j.sourceFunctionSha256,p.sourceImpulseMethods[j.sourceMethod]);assert.equal(j.method,j.sourceMethod==='compliantTipContact'?'applyImpulseAtPoint':'applyTorqueImpulse');assert.equal(j.args.at(-1),j.sourceMethod==='compliantTipContact');}
 assert.ok(p.milestones.firstRetainedPairSleep, 'Original active retained pair reaches native sleep');
 assert.ok(p.transitions.every(t=>t.contacts.some(c=>isTarget(c)&&c.active)), 'Target pair remains native active throughout the observation');
 assert.ok(p.milestones.firstRetainedPairSleep.sleeping.filter(([id])=>[3,4].includes(id)).every(([,sleeping])=>sleeping));
 assert.equal(p.record.score,null, 'The broader shot remains unfinished, never fabricate a rest/score outcome');
 if(decoded){G.verifyRecord(p.record,{decoded:true});const initial=p.record.boundaries.goalStrikeCreated;assert.equal(initial.candidateInput,true);
  for(const row of[...Object.values(p.record.boundaries),...p.rows]){assert.equal(F.hash(row.snapshot),row.snapshotSha256);assert.deepEqual(F.D.encodeLosslessTree(row.typedState),Buffer.from(row.snapshot));}
  assert.equal(initial.contactPairs.length,p.initialContacts.length);for(const c of p.initialContacts)assert.ok(nativeContact(initial,c));
  const cache=nativeContact(initial,initialPair);assert.equal(cache.contacts.variant,'Rigid');assert.ok(cache.contacts.value.recycle_state);assert.equal(cache.contacts.value.manifolds.length,1);assert.equal(cache.contacts.value.manifolds[0].points.length,1);
  for(const milestone of Object.values(p.milestones)){const row=p.rows.find(r=>r.hCount===milestone.h&&r.boundary.endsWith('-postWorld'));assert.ok(row);
   if(milestone===p.milestones.cueWithdrawal)continue;
   for(const c of milestone.contacts){const native=nativeContact(row,c);assert.ok(native,'Native graph retains observed source contact');assert.equal(native.contacts.variant,'Rigid');assert.equal(native.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0),c.active);assert.equal(native.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0&&m.points.some(p=>p.data.impulse>0)),c.positive);}}
  const end=p.record.boundaries.retainedPairSleeping, pair=nativeContact(end,initialPair);assert.ok(pair.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0));
  const pairObjects=end.application.registry.objects.filter(o=>[3,4].includes(o.id)),pairBodies=pairObjects.map(o=>o.body);
  const island=end.state.islands.persistent.islands.v.find(x=>x&&pairBodies.every(h=>x.bodies.some(b=>same(b,h))));assert.ok(island&&island.sleeping,'Both retained pair endpoints share one genuinely sleeping original island');
 }
 return p;
}
async function capture(file,{probe=false,probeFile=null}={}){
 assert.equal(process.env.INITIAL_PAIR_AWAKE_SERIAL_SLOT,'1','Coordinator serial CPU slot required');assert.ok(path.isAbsolute(file));assert.ok(!fs.existsSync(file)&&!fs.existsSync(file+'.json'),'Never overwrite source evidence');
 const id=identity();assert.equal(id.sources['vendor/rapier.cjs'],F.D.ENGINE_SHA256);await F.R.init();assert.equal(F.R.version(),'0.21.0');
 let discovery;if(probeFile){discovery=v8.deserialize(fs.readFileSync(probeFile));assert.deepEqual(discovery.identity,id);verify(discovery,{decoded:false});}else discovery=observeOriginal({recordFrames:false,journal:false});
 const first=probe?discovery:observeOriginal({recordFrames:true,journal:true,captureHs:selectedHs(discovery)}),p={schema:SCHEMA,identity:id,...first};verify(p,{decoded:false});
 if(!probe){const independent=observeOriginal({recordFrames:false,journal:false,captureHs:selectedHs(discovery)}),unobserved=G.captureOriginal(INPUT,{recordFrames:false,journal:false});
  for(const name of Object.keys(first.record.boundaries)){assert.deepEqual(first.record.boundaries[name].snapshot,unobserved.boundaries[name].snapshot,'Unobserved original raw boundary '+name);assert.deepEqual(first.record.boundaries[name].snapshot,independent.record.boundaries[name].snapshot,'Independent original raw boundary '+name);assert.deepEqual(first.record.boundaries[name].application,independent.record.boundaries[name].application);}
  assert.deepEqual(first.record.events,unobserved.events);assert.deepEqual(first.record.events,independent.record.events);assert.deepEqual(first.transitions,independent.transitions);assert.deepEqual(first.initialContacts,independent.initialContacts);assert.deepEqual(first.milestones,discovery.milestones);assert.deepEqual(first.sleepTransitions,discovery.sleepTransitions);assert.deepEqual(first.applicationImpulseJournal,independent.applicationImpulseJournal);assert.deepEqual(first.applicationImpulseJournal,discovery.applicationImpulseJournal);assert.deepEqual(first.rows.map(r=>[r.boundary,r.snapshot]),independent.rows.map(r=>[r.boundary,r.snapshot]));
  p.observerAgreement={independentOriginalRecreations:3,unobservedOriginalAgreement:true,byteIdenticalBoundaryCount:Object.keys(first.record.boundaries).length+first.rows.length,exactContactAndGameObservables:true};
  for(const name of Object.keys(first.record.boundaries))first.record.boundaries[name]=F.decodeBoundary(first.record.boundaries[name]);
  for(let i=0;i<p.rows.length;i++)p.rows[i]=F.decodeBoundary(p.rows[i]);p.assertions=p.rows.map(projection);verify(p);
 }else p.initialDecoded=F.decodeBoundary(p.record.boundaries.goalStrikeCreated);
 assert.deepEqual(identity(),id);const bytes=v8.serialize(p),manifest={identity:id,sha256:F.hash(bytes),bytes:bytes.length,probe,apiJournalEncoding:F.JOURNAL_ENCODING,apiJournalSha256:F.journalDigest(p.record.apiJournal),...summary(p)};
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});fs.writeFileSync(file+'.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;
}
function load(file){const bytes=fs.readFileSync(file),m=JSON.parse(fs.readFileSync(file+'.json'));assert.deepEqual(m.identity,identity());assert.equal(F.hash(bytes),m.sha256);assert.equal(bytes.length,m.bytes);const p=v8.deserialize(bytes);assert.deepEqual(p.identity,m.identity);assert.equal(F.journalDigest(p.record.apiJournal),m.apiJournalSha256);verify(p,{decoded:!m.probe});return{...p,manifest:m};}
module.exports={SCHEMA,INPUT,GEOMETRY,SOURCES,identity,graphView,contactsView,isTarget,observeOriginal,selectedHs,projection,summary,nativeContact,verify,capture,load};
if(require.main===module)capture(process.argv[2],{probe:process.argv[3]==='probe',probeFile:process.argv[4]||null}).then(m=>console.log(JSON.stringify(m,null,2))).catch(e=>{console.error(e.stack);process.exitCode=1;});
