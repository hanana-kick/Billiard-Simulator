'use strict';
// SPDX-License-Identifier: Apache-2.0
// Independent original controller oracle. The sole candidate numerical input is
// goalStrikeCreated plus its unmodified strike creation journal. Every later
// native state/impulse is an assertion output, never replay input or a cache fix.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),v8=require('node:v8');
const F=require('./four-ball-created-fixture.cjs'),G=require('./cushion-coupled-original-controller.cjs');
const copy=x=>structuredClone(x),same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation;
const SCHEMA='original-controller-cushion-coupled-four-ball-oracle-v1';
const INPUT=Object.freeze({name:'retained-front-cushion-then-red-coupled-contact',requiredOutcome:'native-rest',placements:Object.freeze([
 {id:1,x:-.30,z:.68062},{id:2,x:-.8,z:-.4},{id:3,x:0,z:.67062},{id:4,x:.8,z:-.4}].map(Object.freeze))});
const GEOMETRY=Object.freeze({radius:.03075,placementY:.0308,diameter:.0615,predictionDistance:.0615*.001,
 derivation:'A legal original move next to the genuine rounded front cushion, then an off-center red collision. Native source acceptance and impulses, not this proposed geometry, establish the result.'});
const SOURCES=['tests/cushion-coupled-original-fixture.cjs','tests/cushion-coupled-original-controller.cjs','tests/four-ball-created-fixture.cjs',
 'src/controller.js','src/physics.js','src/game-rules.js','src/math.js','src/render-cadence.js',
 'vendor/rapier.cjs','tools/rapier-snapshot-decoder/index.cjs'];
// Independent read-only projection of the original dense graph. No candidate
// importer/exporter module is loaded or included in this oracle's source identity.
function graphView(row){
 const U=0xffffffff,graph=row.state.narrow_phase.contact_graph.graph,key=h=>h.index+':'+h.generation,by=new Map(row.colliders.map(c=>[key(c.handle),c]));
 const edges=graph.edges.map(({weight:e})=>({collider1:copy(e.collider1),collider2:copy(e.collider2),body1:copy(by.get(key(e.collider1)).parent.handle),body2:copy(by.get(key(e.collider2)).parent.handle),active:e.contacts.variant==='Rigid'&&e.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0)}));
 const adjacency=row.colliders.map(c=>{const node=graph.nodes.find(n=>same(n.weight,c.handle)),out={collider:copy(c.handle),outgoing:[],incoming:[]};if(node)for(let side=0;side<2;side++){const seen=new Set();let at=node.next[side];while(at!==U){assert.ok(!seen.has(at)&&graph.edges[at]);seen.add(at);out[side?'incoming':'outgoing'].push(at);at=graph.edges[at].next[side];}}return out;});
 return{edges,adjacency};
}
function identity(){return{schema:SCHEMA,original:G.identity(),input:copy(INPUT),geometry:copy(GEOMETRY),
 sources:Object.fromEntries(SOURCES.map(p=>[p,F.hash(fs.readFileSync(path.resolve(__dirname,'..',p)))])),
 decoderSha256:process.env.RAPIER_SNAPSHOT_DECODER?F.hash(fs.readFileSync(process.env.RAPIER_SNAPSHOT_DECODER)):null};}
function contactsView(lab){const contacts=[];
 const add=(kind,ids,a,b,label)=>{let retained=false;lab.world.contactPairsWith(a,c=>{if(c.handle===b.handle)retained=true;});
  if(!retained)return;const manifolds=[];lab.world.contactPair(a,b,(m,flipped)=>{const n=m.normal();manifolds.push({flipped,normal:[n.x,n.y,n.z],points:m.numContacts(),solverContacts:m.numSolverContacts(),
   distances:Array.from({length:m.numContacts()},(_,k)=>m.contactDist(k)),impulses:Array.from({length:m.numContacts()},(_,k)=>m.contactImpulse(k))});});
  contacts.push({kind,ids,label,collider1:F.parts(a.handle),collider2:F.parts(b.handle),active:manifolds.some(m=>m.solverContacts>0),positive:manifolds.some(m=>m.solverContacts>0&&m.impulses.some(x=>x>0)),manifolds});};
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)add('sphere-pair',[lab.objects[i].id,lab.objects[j].id],lab.objects[i].pairCollider,lab.objects[j].pairCollider,null);
 for(const s of lab.statics.filter(s=>s.kind==='cushion'))for(const o of lab.objects)add('cushion',[o.id],s.collider,o.collider,s.label);
 return contacts;}
function shared(contacts,condition=()=>true){const pairs=contacts.filter(c=>c.kind==='sphere-pair'&&condition(c)),cushions=contacts.filter(c=>c.kind==='cushion'&&condition(c));return pairs.some(p=>cushions.some(c=>c.ids.some(id=>p.ids.includes(id))));}
function observeOriginal({recordFrames=true,journal=true,snapshots=true}={}){
 let lab=null,h=0,initialContacts=null,firstRetained=null,firstActive=null,firstPositive=null,previousKey=null,captureThrough=Infinity;
 const restore=[],transitions=[],allRows=new Map(),setterCalls=[];
 const raw=boundary=>({boundary,candidateInput:false,hCount:h,nativeSteps:null,snapshot:lab.world.takeSnapshot(),application:null});
 const remember=phase=>{if(snapshots&&h<=captureThrough&&lab.get(1).body.translation().x>-.09){const r=raw('expected-only-h'+h+'-'+phase);allRows.set(r.boundary,r);}};
 restore.push(F.observeMethod(LabController.prototype,'fire',{after(c,args,result){if(result){lab=c.lab;initialContacts=contactsView(lab);
  for(const o of lab.objects)for(const method of['setLinvel','setAngvel','setTranslation','setRotation','enableCcd','resetForces','resetTorques'])
   restore.push(F.observeMethod(o.body,method,{before(){setterCalls.push({h,method,id:o.id});}}));
 }}}));
 restore.push(F.observeMethod(F.R.World.prototype,'step',{before(world){if(lab&&world===lab.world){h++;remember('preWorld');}},after(world){if(!lab||world!==lab.world)return;
  const contacts=contactsView(lab),key=JSON.stringify(contacts.map(c=>[c.kind,c.ids,c.active,c.positive]));
  if(key!==previousKey){transitions.push({h,contacts});previousKey=key;}
  if(firstRetained===null&&shared(contacts))firstRetained={h,contacts:copy(contacts)};
  if(firstActive===null&&shared(contacts,c=>c.active))firstActive={h,contacts:copy(contacts)};
  if(firstPositive===null&&shared(contacts,c=>c.positive)){firstPositive={h,contacts:copy(contacts)};captureThrough=h+1;}
  remember('postWorld');
 }}));
 restore.push(F.observeMethod(PhysicsLab.prototype,'angularPatchResistance',{after(receiver){if(lab&&receiver===lab)remember('postApplication');}}));
 try{const record=G.captureOriginal(INPUT,{recordFrames,journal});assert.deepEqual(setterCalls,[],'No original ball state assignments after controller fire');
  const selected=new Set([1,...[firstRetained,firstActive,firstPositive].filter(Boolean).flatMap(m=>[m.h-1,m.h,m.h+1])]);
  const rows=[...allRows.values()].filter(r=>selected.has(r.hCount));
  for(const row of rows){row.nativeSteps=record.nativeStepsAtCreation+row.hCount;
   row.application={registry:copy(record.boundaries.goalStrikeCreated.application.registry),...(row.boundary.endsWith('-postApplication')?(record.frames[row.hCount-1]??{}):{})};}
  return{record,initialContacts,transitions,firstRetained,firstActive,firstPositive,rows,setterCalls};
 }finally{while(restore.length)restore.pop()();}}
function projection(row){return{h:row.hCount,boundary:row.boundary,candidateInput:false,snapshotSha256:row.snapshotSha256,graph:graphView(row),contactPairs:copy(row.contactPairs),islands:copy(row.state.islands),modifiedBodies:copy(row.queues.modifiedBodies),bodies:copy(row.bodies),proxies:copy(row.proxies),pendingSetAabb:copy(row.state.broad_phase.pending_set_aabb)};}
function summary(p){return{schema:SCHEMA,input:copy(INPUT),initialBoundary:'goalStrikeCreated',initialSnapshotSha256:p.record.boundaries.goalStrikeCreated?.snapshotSha256??(p.record.boundaries.goalStrikeCreated?F.hash(p.record.boundaries.goalStrikeCreated.snapshot):null),sourceOnly:true,candidateStateUsed:false,nativeRestoreUsed:false,postStrikeBallAssignments:p.setterCalls.length,status:p.record.status,hCount:p.record.hCount,firstRestOuter:p.record.firstRestOuter,score:p.record.score,outcome:p.record.outcome,placements:p.record.placements,control:p.record.control,initialContacts:p.initialContacts,firstRetained:p.firstRetained,firstActive:p.firstActive,firstPositive:p.firstPositive,capturedBoundaries:p.rows.map(r=>r.boundary),transitionCount:p.transitions.length};}
function nativeContact(row,c){return row.contactPairs.find(p=>same(p.collider1,c.collider1)&&same(p.collider2,c.collider2));}
function verify(p,{decoded=true}={}){
 assert.equal(p.schema,SCHEMA);assert.deepEqual(p.record.input,INPUT);assert.equal(p.record.candidateStateUsed,false);assert.equal(p.record.nativeRestoreUsed,false);assert.deepEqual(p.setterCalls,[]);
 assert.equal(p.record.status,'native-rest-complete');assert.equal(p.record.requiredOutcomeObserved,true);assert.deepEqual(p.record.settings,F.SETTINGS);assert.equal(p.record.control.fireAccepted,true);
 assert.ok(p.initialContacts.some(c=>c.kind==='cushion'&&c.ids.includes(1)),'Genuine initial retained cue cushion contact');assert.ok(p.initialContacts.every(c=>c.kind!=='sphere-pair'),'No initial dynamic pair cache');
 assert.ok(p.firstRetained&&shared(p.firstRetained.contacts));assert.ok(p.firstActive&&shared(p.firstActive.contacts,c=>c.active));assert.ok(p.firstPositive&&shared(p.firstPositive.contacts,c=>c.positive));
 assert.ok(p.firstRetained.h<=p.firstActive.h&&p.firstActive.h<=p.firstPositive.h);
 if(decoded){G.verifyRecord(p.record,{decoded:true});const initial=p.record.boundaries.goalStrikeCreated;assert.equal(initial.candidateInput,true);
  for(const row of[initial,...p.rows,p.record.boundaries.physicalRest,p.record.boundaries.controllerFinished]){assert.equal(F.hash(row.snapshot),row.snapshotSha256);assert.deepEqual(F.D.encodeLosslessTree(row.typedState),Buffer.from(row.snapshot));}
  assert.equal(initial.contactPairs.length,4+p.initialContacts.length,'Exact original cloth and retained cushion cache only');for(const c of p.initialContacts)assert.ok(nativeContact(initial,c));
  for(const milestone of[p.firstRetained,p.firstActive,p.firstPositive]){const row=p.rows.find(r=>r.hCount===milestone.h&&r.boundary.endsWith('-postWorld'));assert.ok(row);
   for(const c of milestone.contacts){const native=nativeContact(row,c);assert.ok(native,'Native graph retains observed source contact');assert.equal(native.contacts.variant,'Rigid');assert.equal(native.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0),c.active);assert.equal(native.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0&&m.points.some(p=>p.data.impulse>0)),c.positive);}}
  assert.deepEqual(p.record.boundaries.physicalRest.snapshot,p.record.boundaries.controllerFinished.snapshot,'Real game scoring never alters native physics');
 }
 return p;
}
async function capture(file,{probe=false}={}){assert.equal(process.env.CUSHION_COUPLED_SERIAL_SLOT,'1','Coordinator serial CPU slot required');assert.ok(path.isAbsolute(file));assert.ok(!fs.existsSync(file)&&!fs.existsSync(file+'.json'));
 const id=identity();await F.R.init();const first=observeOriginal({recordFrames:!probe,journal:!probe,snapshots:!probe});const p={schema:SCHEMA,identity:id,...first};
 if(!probe){verify(p,{decoded:false});const independent=observeOriginal({recordFrames:false,journal:false,snapshots:true}),unobserved=G.captureOriginal(INPUT,{recordFrames:false,journal:false});
  for(const name of Object.keys(first.record.boundaries)){assert.deepEqual(first.record.boundaries[name].snapshot,unobserved.boundaries[name].snapshot,'Unobserved original raw boundary '+name);assert.deepEqual(first.record.boundaries[name].snapshot,independent.record.boundaries[name].snapshot,'Independent raw boundary '+name);assert.deepEqual(first.record.boundaries[name].application,independent.record.boundaries[name].application);}
  assert.deepEqual(first.record.events,unobserved.events);assert.deepEqual(first.record.events,independent.record.events);assert.deepEqual(first.transitions,independent.transitions);assert.deepEqual(first.initialContacts,independent.initialContacts);assert.deepEqual(first.rows.map(r=>[r.boundary,r.snapshot]),independent.rows.map(r=>[r.boundary,r.snapshot]));
  p.observerAgreement={independentOriginalRecreations:3,unobservedOriginalAgreement:true,byteIdenticalBoundaryCount:Object.keys(first.record.boundaries).length+first.rows.length,exactContactAndGameObservables:true};
  for(const name of Object.keys(first.record.boundaries))first.record.boundaries[name]=F.decodeBoundary(first.record.boundaries[name]);
  for(let i=0;i<p.rows.length;i++)p.rows[i]=F.decodeBoundary(p.rows[i]);p.assertions=p.rows.map(projection);verify(p);
 }
 assert.deepEqual(identity(),id);const bytes=v8.serialize(p),manifest={identity:id,sha256:F.hash(bytes),bytes:bytes.length,probe,apiJournalEncoding:F.JOURNAL_ENCODING,apiJournalSha256:F.journalDigest(p.record.apiJournal),...summary(p)};
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});fs.writeFileSync(file+'.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;}
function load(file){const bytes=fs.readFileSync(file),m=JSON.parse(fs.readFileSync(file+'.json'));assert.deepEqual(m.identity,identity());assert.equal(F.hash(bytes),m.sha256);assert.equal(bytes.length,m.bytes);const p=v8.deserialize(bytes);assert.deepEqual(p.identity,m.identity);assert.equal(F.journalDigest(p.record.apiJournal),m.apiJournalSha256);verify(p,{decoded:!m.probe});return{...p,manifest:m};}
module.exports={SCHEMA,INPUT,GEOMETRY,SOURCES,identity,graphView,contactsView,shared,observeOriginal,projection,summary,verify,capture,load};
if(require.main===module)capture(process.argv[2],{probe:process.argv[3]==='probe'}).then(m=>console.log(JSON.stringify(m,null,2))).catch(e=>{console.error(e.stack);process.exitCode=1;});
