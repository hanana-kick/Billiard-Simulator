'use strict';
// SPDX-License-Identifier: Apache-2.0
// Independent original controller oracle. Native post-strike values are assertion
// outputs only; the sole numerical input is goalStrikeCreated plus its journal.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),v8=require('node:v8');
const F=require('./four-ball-created-fixture.cjs'),G=require('./four-ball-goal-fixture.cjs');
const copy=x=>structuredClone(x),same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation;
const SCHEMA='original-controller-coupled-four-ball-oracle-v1';
const INPUT=Object.freeze({name:'centerline-two-red-simultaneous-contact',requiredOutcome:'positive',placements:Object.freeze([
 {id:1,x:-.30,z:0},{id:2,x:-.8,z:.4},{id:3,x:0,z:.04},{id:4,x:0,z:-.04}].map(Object.freeze))});
const GEOMETRY=Object.freeze({radius:.03075,diameter:.0615,predictionDistance:.0615*.001,redSeparation:.08,
 centerlineFirstContactX:-Math.sqrt(.0615**2-.04**2),derivation:'Two equal spheres symmetric about the genuine default cue centerline; reds start outside each other fat AABB.'});
const SOURCES=['tests/coupled-four-original-fixture.cjs','tests/four-ball-goal-fixture.cjs','tests/four-ball-created-fixture.cjs',
 'src/controller.js','src/physics.js','src/game-rules.js','src/math.js','src/render-cadence.js',
 'vendor/rapier.cjs','tools/rapier-snapshot-decoder/index.cjs'];
// Independent read-only graph projection. The original oracle must not depend
// on candidate importer/exporter code or change identity when that code evolves.
function graphView(row){
 const U=0xffffffff,graph=row.state.narrow_phase.contact_graph.graph,key=h=>h.index+':'+h.generation,by=new Map(row.colliders.map(c=>[key(c.handle),c]));
 const edges=graph.edges.map(({weight:e})=>({collider1:copy(e.collider1),collider2:copy(e.collider2),body1:copy(by.get(key(e.collider1)).parent.handle),body2:copy(by.get(key(e.collider2)).parent.handle),active:e.contacts.variant==='Rigid'&&e.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0)}));
 const adjacency=row.colliders.map(c=>{const node=graph.nodes.find(n=>same(n.weight,c.handle)),out={collider:copy(c.handle),outgoing:[],incoming:[]};if(node)for(let side=0;side<2;side++){const seen=new Set();let at=node.next[side];while(at!==U){assert.ok(!seen.has(at)&&graph.edges[at]);seen.add(at);out[side?'incoming':'outgoing'].push(at);at=graph.edges[at].next[side];}}return out;});
 return{edges,adjacency};
}
function identity(){return{schema:SCHEMA,original: G.identity(),input:copy(INPUT),geometry:copy(GEOMETRY),
 sources:Object.fromEntries(SOURCES.map(p=>[p,F.hash(fs.readFileSync(path.resolve(__dirname,'..',p)))])),
 decoderSha256:process.env.RAPIER_SNAPSHOT_DECODER?F.hash(fs.readFileSync(process.env.RAPIER_SNAPSHOT_DECODER)):null};}
function pairView(lab){const pairs=[];for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
 const a=lab.objects[i],b=lab.objects[j];let retained=false;lab.world.contactPairsWith(a.pairCollider,c=>{if(c.handle===b.pairCollider.handle)retained=true;});
 if(!retained)continue;const manifolds=[];lab.world.contactPair(a.pairCollider,b.pairCollider,(m,flipped)=>{
  manifolds.push({flipped,normal:[m.normal().x,m.normal().y,m.normal().z],points:m.numContacts(),solverContacts:m.numSolverContacts(),
   distances:Array.from({length:m.numContacts()},(_,k)=>m.contactDist(k)),impulses:Array.from({length:m.numContacts()},(_,k)=>m.contactImpulse(k))});
 });pairs.push({ids:[a.id,b.id],collider1:F.parts(a.pairCollider.handle),collider2:F.parts(b.pairCollider.handle),
  active:manifolds.some(m=>m.solverContacts>0),manifolds});}return pairs;}
function shared(pairs){return pairs.some((a,i)=>pairs.slice(i+1).some(b=>a.ids.some(id=>b.ids.includes(id))));}
function observeOriginal({recordFrames=true,journal=true,snapshots=true}={}){
 let lab=null,h=0,firstRetained=null,firstActive=null,previousKey=null,captureThrough=Infinity;
 const restore=[],transitions=[],allRows=new Map(),setterCalls=[];
 const raw=(boundary)=>({boundary,candidateInput:false,hCount:h,nativeSteps:null,snapshot:lab.world.takeSnapshot(),application:null});
 restore.push(F.observeMethod(LabController.prototype,'fire',{after(c,args,result){if(result){lab=c.lab;
  for(const o of lab.objects)for(const method of['setLinvel','setAngvel','setTranslation','setRotation','enableCcd','resetForces','resetTorques'])
   restore.push(F.observeMethod(o.body,method,{before(){setterCalls.push({h,method,id:o.id});}}));
 }}}));
 restore.push(F.observeMethod(F.R.World.prototype,'step',{before(world){if(lab&&world===lab.world){h++;
  if(snapshots&&h<=captureThrough&&lab.get(1).body.translation().x>-.08){const r=raw('expected-only-h'+h+'-preWorld');allRows.set(r.boundary,r);}
 }},after(world){if(!lab||world!==lab.world)return;const pairs=pairView(lab),active=pairs.filter(p=>p.active),key=JSON.stringify(pairs.map(p=>[p.ids,p.active]));
  if(key!==previousKey){transitions.push({h,pairs});previousKey=key;}
  if(firstRetained===null&&shared(pairs))firstRetained={h,pairs:copy(pairs)};
  if(firstActive===null&&shared(active)){firstActive={h,pairs:copy(pairs)};captureThrough=h+1;}
  if(snapshots&&h<=captureThrough&&lab.get(1).body.translation().x>-.08){const r=raw('expected-only-h'+h+'-postWorld');allRows.set(r.boundary,r);}
 }}));
 restore.push(F.observeMethod(PhysicsLab.prototype,'angularPatchResistance',{after(receiver){if(lab&&receiver===lab&&snapshots&&h<=captureThrough&&lab.get(1).body.translation().x>-.08){
  const r=raw('expected-only-h'+h+'-postApplication');allRows.set(r.boundary,r);
 }}}));
 try{const record=G.captureOriginal(INPUT,{recordFrames,journal});assert.deepEqual(setterCalls,[],'No original ball state assignments after controller fire');
  assert.ok(firstRetained,'Source must actually retain a shared multiple-pair component');assert.ok(firstActive,'Source must actually solve a shared simultaneous multiple-pair component');
  const selected=new Set([1,firstRetained.h-1,firstRetained.h,firstRetained.h+1,firstActive.h-1,firstActive.h,firstActive.h+1]);
  const rows=[...allRows.values()].filter(r=>selected.has(r.hCount));
  for(const row of rows){row.nativeSteps=record.nativeStepsAtCreation+row.hCount;
   // This original-only application frame is assertion metadata, not a seed.
   row.application={registry:copy(record.boundaries.goalStrikeCreated.application.registry),...(row.boundary.endsWith('-postApplication')?(record.frames[row.hCount-1]??{}):{})};}
  return{record,transitions,firstRetained,firstActive,rows,setterCalls};
 }finally{while(restore.length)restore.pop()();}}
function projection(row){const graph=graphView(row);return{h:row.hCount,boundary:row.boundary,candidateInput:false,
 snapshotSha256:row.snapshotSha256,graph,contactPairs:copy(row.contactPairs),islands:copy(row.state.islands),
 modifiedBodies:copy(row.queues.modifiedBodies),bodies:copy(row.bodies),proxies:copy(row.proxies),
 pendingSetAabb:copy(row.state.broad_phase.pending_set_aabb)};}
function summary(p){return{schema:SCHEMA,input:copy(INPUT),initialBoundary:'goalStrikeCreated',initialSnapshotSha256:p.record.boundaries.goalStrikeCreated.snapshotSha256??F.hash(p.record.boundaries.goalStrikeCreated.snapshot),
 sourceOnly:true,candidateStateUsed:false,nativeRestoreUsed:false,postStrikeBallAssignments:p.setterCalls.length,
 status:p.record.status,hCount:p.record.hCount,firstRestOuter:p.record.firstRestOuter,score:p.record.score,outcome:p.record.outcome,
 firstRetained:p.firstRetained,firstActive:p.firstActive,capturedBoundaries:p.rows.map(r=>r.boundary),transitionCount:p.transitions.length};}
function verify(p,{decoded=true}={}){assert.equal(p.schema,SCHEMA);assert.deepEqual(p.record.input,INPUT);assert.equal(p.record.candidateStateUsed,false);assert.equal(p.record.nativeRestoreUsed,false);
 assert.deepEqual(p.setterCalls,[]);assert.equal(p.record.status,'native-rest-complete');assert.equal(p.record.requiredOutcomeObserved,true);
 assert.ok(shared(p.firstRetained.pairs));assert.ok(shared(p.firstActive.pairs.filter(p=>p.active)));assert.ok(p.firstRetained.h<=p.firstActive.h);
 if(decoded){G.verifyRecord(p.record,{decoded:false});const initial=p.record.boundaries.goalStrikeCreated;assert.equal(initial.candidateInput,true);assert.equal(F.hash(initial.snapshot),initial.snapshotSha256);
  assert.equal(initial.contactPairs.length,4,'No hidden initial pair/cushion cache');for(const row of p.rows){assert.equal(row.candidateInput,false);assert.equal(F.hash(row.snapshot),row.snapshotSha256);assert.deepEqual(F.D.encodeLosslessTree(row.typedState),Buffer.from(row.snapshot));}
  for(const milestone of[p.firstRetained,p.firstActive]){const row=p.rows.find(r=>r.hCount===milestone.h&&r.boundary.endsWith('-postWorld'));assert.ok(row);
   const native=graphView(row).edges.filter(e=>p.record.boundaries.goalStrikeCreated.application.registry.objects.some(o=>same(o.pairCollider,e.collider1))&&p.record.boundaries.goalStrikeCreated.application.registry.objects.some(o=>same(o.pairCollider,e.collider2)));
   assert.deepEqual(native.map(e=>[e.collider1,e.collider2,e.active]),milestone.pairs.map(e=>[e.collider1,e.collider2,e.active]),'API observation agrees with original dense retained graph order');}
 }
 return p;}
async function capture(file,{probe=false}={}){assert.equal(process.env.COUPLED_FOUR_SERIAL_SLOT,'1','Coordinator serial CPU slot required');assert.ok(path.isAbsolute(file));assert.ok(!fs.existsSync(file)&&!fs.existsSync(file+'.json'));
 const id=identity();await F.R.init();const first=observeOriginal({recordFrames:!probe,journal:!probe,snapshots:!probe});
 const p={schema:SCHEMA,identity:id,...first};if(!probe){const independent=observeOriginal({recordFrames:false,journal:false,snapshots:true}),unobserved=G.captureOriginal(INPUT,{recordFrames:false,journal:false});
  for(const name of Object.keys(first.record.boundaries)){assert.deepEqual(first.record.boundaries[name].snapshot,unobserved.boundaries[name].snapshot,'Unobserved original raw boundary '+name);assert.deepEqual(first.record.boundaries[name].snapshot,independent.record.boundaries[name].snapshot,'Independent raw boundary '+name);assert.deepEqual(first.record.boundaries[name].application,independent.record.boundaries[name].application);}
  assert.deepEqual(first.record.events,unobserved.events);assert.deepEqual(first.record.events,independent.record.events);assert.deepEqual(first.transitions,independent.transitions);
  assert.deepEqual(first.rows.map(r=>[r.boundary,r.snapshot]),independent.rows.map(r=>[r.boundary,r.snapshot]));
  p.observerAgreement={independentOriginalRecreations:3,unobservedOriginalAgreement:true,byteIdenticalBoundaryCount:Object.keys(first.record.boundaries).length+first.rows.length,exactContactAndGameObservables:true};
  // Decode only the admitted initial plus selected oracle boundaries, not every h.
  first.record.boundaries.goalStrikeCreated=F.decodeBoundary(first.record.boundaries.goalStrikeCreated);
  for(let i=0;i<p.rows.length;i++)p.rows[i]=F.decodeBoundary(p.rows[i]);p.assertions=p.rows.map(projection);
  verify(p);
 }
 assert.deepEqual(identity(),id);const bytes=v8.serialize(p),manifest={identity:id,sha256:F.hash(bytes),bytes:bytes.length,probe,...summary(p)};
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});fs.writeFileSync(file+'.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;}
function load(file){const bytes=fs.readFileSync(file),m=JSON.parse(fs.readFileSync(file+'.json'));assert.deepEqual(m.identity,identity());assert.equal(F.hash(bytes),m.sha256);assert.equal(bytes.length,m.bytes);const p=v8.deserialize(bytes);assert.deepEqual(p.identity,m.identity);verify(p,{decoded:!m.probe});return{...p,manifest:m};}
module.exports={SCHEMA,INPUT,GEOMETRY,SOURCES,identity,graphView,pairView,shared,observeOriginal,projection,summary,verify,capture,load};
if(require.main===module)capture(process.argv[2],{probe:process.argv[3]==='probe'}).then(m=>console.log(JSON.stringify(m,null,2))).catch(e=>{console.error(e.stack);process.exitCode=1;});
