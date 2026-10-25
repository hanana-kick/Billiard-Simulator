'use strict';
// Immutable geometry export and independent assertion snapshots only. No stepping.
const fs=require('node:fs'),v8=require('node:v8'),crypto=require('node:crypto'),assert=require('node:assert/strict'),F=require('./cue-initialization-fixture.cjs'),Variant=require('../src/experimental-cue-created-variant');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),copy=x=>structuredClone(x),same=(a,b)=>a.index===b.index&&a.generation===b.generation;
function decode(snapshot){return F.D.decodeSnapshot(snapshot,{binary:process.env.RAPIER_SNAPSHOT_DECODER,engineVersion:'0.21.0'});}
function sourceView(d){const field=F.D.field,broad=F.plain(field(d.state,'broad_phase')),graph=F.plain(field(field(field(d.state,'narrow_phase'),'contact_graph'),'graph')),proxies=[];for(const n of broad.tree.nodes)for(const side of['left','right']){const x=n[side];if((x.data&0x3fffffff)===1)proxies.push({index:x.children,min:x.mins,max:x.maxs});}return{broad,proxies,graph};}
function validateRecord(record){
 assert.equal(record.fixtureScope,'original-three-ball-constructor-layout');assert.equal(record.constructorNativeSettlingSteps,72);assert.equal(record.additionalApplicationSettlingSteps,0);assert.equal(record.created.snapshotSha256,hash(record.created.snapshot));assert.equal(record.created.sourceRevision,F.D.SOURCE_REVISION);assert.equal(record.created.engineSha256,F.D.ENGINE_SHA256);
 if(record.fixtureVariant===undefined)assert.deepEqual(record.settings,{angle:0,elevation:8,tipX:0,tipY:0,speed:2});
 else{
  assert.ok([Variant.YAW15,Variant.SOURCE_INPUT].includes(record.fixtureVariant),'Explicit source-validated input or named yaw15 export contract required');
  assert.equal(record.selectedIndex,0,'Yaw15 exporter retains selected body0');
  if(record.fixtureVariant===Variant.YAW15)assert.deepEqual(record.settings,Variant.SETTINGS,'Yaw15 exporter never substitutes settings');
  else Variant.validateSettings(record.settings);
  const a=record.cueInitialization?.application;
  assert.equal(a?.fixtureVariant,record.fixtureVariant,'Creation and broad-phase share one explicit variant');
  assert.equal(a.selectedIndex,record.selectedIndex);assert.deepEqual(a.strikeSettings,record.settings);
  Variant.validateApplication(a);
 }
 return record;
}
function exportSeed(record,d){
 validateRecord(record);d??=decode(record.created.snapshot);
 const field=F.D.field,entries=field(field(field(d.state,'bodies'),'bodies'),'items').items,by=new Map();entries.forEach((x,index)=>{if(x.variant==='Occupied')by.set(index,{generation:Number(field(x,'generation').value),raw:F.plain(field(x,'value'))});});
 const colliders=record.created.colliders.map(c=>{const b=by.get(c.parent.handle.index);assert.equal(b?.generation,c.parent.handle.generation);return{...copy(c),bodyType:b.raw.body_type,softCcdPrediction:b.raw.ccd.soft_ccd_prediction};}),bodyColliders=[...by].filter(([index,b])=>b.raw.body_type==='Dynamic'||(index===record.roles.guide.index&&b.generation===record.roles.guide.generation)).map(([index,b])=>({body:{index,generation:b.generation},colliders:copy(b.raw.colliders)}));
 return{kind:'source-created-cue-broad-phase',sourceRevision:F.D.SOURCE_REVISION,phase:'original-constructor72-strike-created-before-first-h',constructorNativeSettlingSteps:72,additionalApplicationSettlingSteps:0,initialSnapshotSha256:record.created.snapshotSha256,createdSnapshotSha256:record.created.snapshotSha256,
 // Explicit creation provenance: the constructor completed its synchronous72
 // world steps, then strike only created bodies/colliders/joints. Source solve
 // takes deferred optimization and end-step AABB writes join it. This is not a
 // fabricated serde-skipped workspace recovered from an arbitrary snapshot.
 sourcePipelineCompleted:true,initialBroadPhase:sourceView(d).broad,colliders,bodyColliders,modifiedColliders:copy(record.created.modifiedColliders),roles:copy(record.roles),lengthUnit:record.created.integration.length_unit,normalizedPredictionDistance:record.created.integration.normalized_prediction_distance};
}
function load(){const path=process.env.THREE_BALL_CREATION_V8??'/tmp/billiard-v3-cue-three-ball-creation-registry.v8',bytes=fs.readFileSync(path);assert.equal(hash(bytes),'d7e975fac9b6c9de487c5104ad987c5e7431c3d4e7ef5b29c3b120f6bd5e9ea8','verified original creation artifact');const record=v8.deserialize(bytes),tracePath=process.env.THREE_BALL_SWITCH_REPLAY??'/tmp/billiard-v3-original-three-ball-through-switch-v1.v8',trace=fs.readFileSync(tracePath),manifest=JSON.parse(fs.readFileSync(tracePath+'.json'));assert.equal(hash(trace),manifest.sha256);assert.equal(trace.length,manifest.bytes);assert.equal(manifest.identity.initialSnapshotSha256,record.created.snapshotSha256);for(const p of['src/physics.js','src/math.js','vendor/rapier.cjs'])assert.equal(hash(fs.readFileSync(require('node:path').join(__dirname,'..',p))),manifest.identity.sources[p],'unchanged original source '+p);const frames=v8.deserialize(trace);assert.equal(frames.length,manifest.frames);const initialDecoded=decode(record.created.snapshot),seed=exportSeed(record,initialDecoded),initial=sourceView(initialDecoded),expected=new Map();for(let i=0;i<frames.length;i++)if(frames[i].raw)expected.set(i+1,sourceView(decode(frames[i].raw.snapshot)));return{record,seed,initial,frames,expected,manifest};}
function activeOrder(raw){const m=raw.islands;return copy(m.islands.v[m.awake_island].bodies);}
const pose=b=>({translation:copy(b.pos.position.translation),rotation:copy(b.pos.position.rotation)});
function preparedInputs(data,i){const{record,frames}=data,frame=frames[i],previous=i?frames[i-1]:null,present=frame.cuePresent,balls=(previous?previous.balls:record.objects.map(o=>{const role=Object.keys(record.roles).find(k=>same(record.roles[k],o.body));return pose(record.created.bodies[role]);})).map((b,j)=>({body:copy(record.objects[j].body),translation:copy(b.translation),rotation:copy(b.rotation)}));
 // This component gate replays prepared native poses, not a trajectory solver.
 // The candidate owns its fat proxies/pairs and never receives expected caches.
 const cue=present?(previous?copy(previous.cue):{shaft:pose(record.created.bodies.shaft),head:pose(record.created.bodies.head)}):null,order=activeOrder(frame.raw??[...frames.slice(0,i+1)].reverse().find(x=>x.raw).raw).filter(h=>present||!['shaft','head'].some(k=>same(h,record.roles[k]))),removedBodies=frame.separation?['head','shaft','guide'].map(k=>copy(record.roles[k])):[];
 return{pre:{cue,balls,removedBodies,activeBodyOrder:order},post:{cue:present?copy(frame.cue):null,balls:frame.balls.map((b,j)=>({body:copy(record.objects[j].body),translation:copy(b.translation),rotation:copy(b.rotation)})),removedBodies:[],activeBodyOrder:order}};
}
module.exports={load,validateRecord,exportSeed,sourceView,preparedInputs,activeOrder,hash};
