'use strict';
// SPDX-License-Identifier: Apache-2.0
// Read-only native cache evidence. This later checkpoint is never admitted as
// a created-world seed or supplied to a solver/stage/stepper recurrence.
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),v8=require('node:v8'),crypto=require('node:crypto');
const D=require('../tools/rapier-snapshot-decoder'),E=require('./three-ball-initial-pair-seeds.cjs'),Pair=require('../src/experimental-pair-contact-stage'),F=D.field,U=0xffffffff;
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),same=(a,b)=>a.index===b.index&&a.generation===b.generation;
const replayPath=process.env.THREE_BALL_PAIR_REPLAY??'/tmp/billiard-v3-original-three-ball-pair-sleep-v1.v8';
const createdPath=process.env.THREE_BALL_CREATION_V8??'/tmp/billiard-v3-cue-three-ball-creation-registry.v8';
const ARTIFACT_SHA256='a235c4728662b543d75f4ff32b1173e169f0f3acbef58df61633b3e8f879c3d1';
const CHECKPOINT_SHA256='32f5474b1483eac2d77b4d72160bf92fb8842ab21eed5003623bed661aa602bd';

// Independent direct typed-tree reader: no extractor contactRecord, vec,
// scalar, plain, findStructs, or decoder floatValue helpers build expectations.
function value(n){
 if(n.kind==='float'){const b=Buffer.from(n.bits,'hex');return n.width==='f32'?b.readFloatBE():b.readDoubleBE();}
 if(n.kind==='integer'){const x=Number(n.value);assert.ok(Number.isSafeInteger(x));return x;}
 if(['some','newtype_struct','newtype_variant'].includes(n.kind))return value(n.value);
 if(n.kind==='none')return null;
 if(n.kind==='unit_variant')return n.variant;
 if(n.items)return n.items.map(value);
 if(n.fields)return Object.fromEntries(n.fields.map(([k,v])=>[k,value(v)]));
 if(n.kind==='bool')return n.value;
 throw Error('Unexpected native evidence node: '+n.kind);
}
const get=(n,k)=>value(F(n,k));
function directContactRecord(pair){
 const contacts=F(pair,'contacts');assert.equal(contacts.variant,'Rigid');
 const rigid=contacts.value,manifolds=F(rigid,'manifolds').items;assert.equal(manifolds.length,1);
 const m=manifolds[0],points=F(m,'points').items,md=F(m,'data'),solvers=F(md,'solver_contacts').items;
 assert.equal(points.length,1);assert.equal(solvers.length,1);
 const p=points[0],data=F(p,'data'),sc=solvers[0],option=F(rigid,'recycle_state');assert.equal(option.kind,'some');
 const rc=option.value,pose=F(rc,'pos12');
 return{
  pairPresent:1,pointPresent:1,active:1,recycleValid:1,solverColor:get(rigid,'solver_color'),
  localP1:get(p,'local_p1'),localP2:get(p,'local_p2'),localN1:get(m,'local_n1'),localN2:get(m,'local_n2'),
  contactDistance:get(p,'dist'),impulse:get(data,'impulse'),warmImpulse:get(data,'warmstart_impulse'),
  warmWorld:get(data,'warmstart_tangent_world'),warmTangent:get(data,'warmstart_tangent_impulse'),tangentImpulse:get(data,'tangent_impulse'),
  dp1:get(data,'solver_dp1'),dp2:get(data,'solver_dp2'),feature1:get(p,'fid1'),feature2:get(p,'fid2'),
  normal:get(md,'normal'),anchor1:get(sc,'anchor1'),anchor2:get(sc,'anchor2'),contactId:get(sc,'contact_id')[0],
  friction:get(md,'friction'),restitution:get(md,'restitution'),solverBodyIds:get(md,'solver_body_ids'),graphPos:get(md,'graph_pos'),tangentVelocity:get(sc,'tangent_velocity'),
  recycleTranslation:get(pose,'translation'),recycleRelativeRotation:get(pose,'rotation'),recycleRotation:get(pose,'rotation'),
  recycleRotation1:get(rc,'rot1'),recycleRotation2:get(rc,'rot2'),maxExtent:get(rc,'max_extent'),maxDrift:get(rc,'max_drift')
 };
}

test('actual saved native 01 point/solver/recycle cache extracts exactly and passes Pair validation without recurrence',{
 skip:!process.env.RAPIER_SNAPSHOT_DECODER||!fs.existsSync(replayPath)||!fs.existsSync(createdPath)?'Existing native artifacts and RAPIER_SNAPSHOT_DECODER are required for read-only evidence':false
},t=>{
 const bytes=fs.readFileSync(replayPath),manifest=JSON.parse(fs.readFileSync(replayPath+'.json','utf8'));
 assert.equal(hash(bytes),ARTIFACT_SHA256);assert.equal(manifest.sha256,ARTIFACT_SHA256);assert.equal(manifest.bytes,bytes.length);
 assert.equal(manifest.identity.schema,'original-three-ball-pair-and-third-sleep-v1');
 for(const[file,sha]of Object.entries(manifest.identity.sources))assert.equal(hash(fs.readFileSync(path.resolve(__dirname,'..',file))),sha,'Unmodified recorded native source: '+file);
 const record=v8.deserialize(fs.readFileSync(createdPath));assert.equal(manifest.identity.initial,record.created.snapshotSha256);
 const row=v8.deserialize(bytes).find(x=>x.step===383);assert.ok(row,'Recorded original native first-pair checkpoint');
 assert.equal(row.raw.snapshotSha256,CHECKPOINT_SHA256);assert.equal(hash(row.raw.snapshot),CHECKPOINT_SHA256);
 const d=D.decodeSnapshot(row.raw.snapshot,{engineVersion:'0.21.0'});assert.equal(d.inputSha256,CHECKPOINT_SHA256);
 assert.equal(d.verification.nativeBincodeByteIdentical,true);assert.equal(d.verification.javascriptTypedReencodeByteIdentical,true);
 const graph=F(F(F(d.state,'narrow_phase'),'contact_graph'),'graph'),edges=F(graph,'edges').items;
 const pairIndex=edges.findIndex(e=>same(get(F(e,'weight'),'collider1'),record.objects[0].pairCollider)&&same(get(F(e,'weight'),'collider2'),record.objects[1].pairCollider));
 assert.equal(pairIndex,3,'Original fourth dense edge is native ball pair 01');
 const pair=F(edges[pairIndex],'weight'),expected=directContactRecord(pair),actual=E.contactRecord(pair);
 assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort(),'No native cache field omitted or synthesized');
 assert.deepEqual(actual,expected,'Every native f32/u32 field, array and signed zero is exact');
 assert.equal(actual.solverColor,0);assert.equal(actual.impulse,0.23555350303649902);assert.ok(Object.is(actual.warmWorld[0],-0));
 assert.deepEqual([actual.feature1,actual.feature2],[0xc0000000,0xc0000000]);

 const nativeGraph=value(graph),globalEdges=edges.map(e=>{
  const p=F(e,'weight'),collider1=get(p,'collider1'),collider2=get(p,'collider2'),rigid=F(p,'contacts').value;
  return{collider1,collider2,body1:row.raw.colliders.find(c=>same(c.handle,collider1)).parent.handle,
   body2:row.raw.colliders.find(c=>same(c.handle,collider2)).parent.handle,
   active:F(rigid,'manifolds').items.some(m=>F(F(m,'data'),'solver_contacts').items.length>0)};
 });
 const directional=record.objects.slice(0,2).map(o=>{
  const node=nativeGraph.nodes.find(n=>same(n.weight,o.pairCollider));assert.ok(node);
  const a={collider:o.pairCollider,outgoing:[],incoming:[]};
  for(let side=0;side<2;side++){let at=node.next[side];while(at!==U){a[side?'incoming':'outgoing'].push(at);at=nativeGraph.edges[at].next[side];}}
  return a;
 });
 assert.deepEqual(directional,[{collider:record.objects[0].pairCollider,outgoing:[3],incoming:[]},{collider:record.objects[1].pairCollider,outgoing:[],incoming:[3]}]);
 const projected=E.extractGraph(d);assert.deepEqual(projected.globalEdges,globalEdges);
 for(const a of directional)assert.deepEqual(projected.adjacency.find(x=>same(x.collider,a.collider)),a);

 // Descriptor metadata comes from the real created seed. Only a pure Pair
 // validator sees this later checkpoint projection; no stage is constructed.
 const initial=E.exportInitialPairSeeds(record)[0].seed;
 const floorPositions=initial.bodies.map(b=>{
  const edge=edges.find(e=>same(get(F(e,'weight'),'collider1'),initial.floorCollider)&&same(get(F(e,'weight'),'collider2'),b.primaryCollider));
  const rigid=F(F(edge,'weight'),'contacts').value;return get(F(F(rigid,'manifolds').items[0],'data'),'graph_pos');
 });
 const validationProjection={kind:initial.kind,phase:initial.phase,floorBody:initial.floorBody,floorCollider:initial.floorCollider,
  floorMaterial:initial.floorMaterial,bodies:initial.bodies,floorOrder:[0,1].sort((a,b)=>floorPositions[a]-floorPositions[b]),
  pair:actual,globalEdges,pairAdjacency:directional.map(a=>[...a.outgoing,...a.incoming])};
 const validated=Pair.validate(validationProjection);
 for(const[k,v]of Object.entries(expected))assert.deepEqual(validated.pair[k],v,'Pair validator preserves native '+k);
 assert.throws(()=>E.exportInitialPairSeeds(record,d),/original created snapshot, not recurrence/,'Later evidence can never replace original initialization');
 t.diagnostic(JSON.stringify({scope:'read-only-native-cache-extraction-only',nativeStep:row.step,artifactSha256:ARTIFACT_SHA256,
  snapshotSha256:CHECKPOINT_SHA256,initialSnapshotSha256:record.created.snapshotSha256,cacheFields:Object.keys(actual).length,
  nativeSimulation:false,gpuExecution:false,pairValidate:true,sourceHashes:manifest.identity.sources}));
});
