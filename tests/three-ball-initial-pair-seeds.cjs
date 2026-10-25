'use strict';
// SPDX-License-Identifier: Apache-2.0
// Rapier b716d375efc0201003f0cd9ef7168eee0b62c177; Parry 0.31.1.
// Source notices: vendor/RAPIER-LICENSE.txt. Initial snapshot projection only:
// no native world is stepped, restored, or consulted during recurrence.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const D=require('../tools/rapier-snapshot-decoder'),field=D.field,U=0xffffffff;
const copy=x=>structuredClone(x),key=h=>h.index+':'+h.generation;
const same=(a,b)=>!!a&&!!b&&a.index===b.index&&a.generation===b.generation;

function plain(n){
 if(!n)return null;
 switch(n.kind){
  case'float':return D.floatValue(n);
  case'integer':{const v=Number(n.value);assert.ok(Number.isSafeInteger(v),'Exact native integer');return v;}
  case'bool':case'char':case'string':return n.value;
  case'none':case'unit':case'unit_struct':return null;
  case'some':case'newtype_struct':return plain(n.value);
  case'newtype_variant':return{variant:n.variant,value:plain(n.value)};
  case'unit_variant':return n.variant;
  default:
   if(n.fields)return Object.fromEntries(n.fields.map(([k,v])=>[k,plain(v)]));
   if(n.items)return n.items.map(plain);
   if(n.entries)return n.entries.map(([k,v])=>[plain(k),plain(v)]);
   throw Error('Unsupported typed native node: '+n.kind);
 }
}
const scalar=(n,k)=>plain(field(n,k));
const vec=(n,k)=>[...D.walk(field(n,k))].filter(x=>x.kind==='float').map(D.floatValue);

// Same point/solver/recycle projection as experimental-pair-contact-stage.cjs.
// In particular, a real pair is never replaced by an empty seed just because
// the current whole-world admission contract only accepts three floor edges.
function contactRecord(pair){
 if(!pair)return{pairPresent:0,pointPresent:0,active:0,recycleValid:0};
 const rigid=D.findStructs(pair,'RigidPairContacts')[0];
 assert.ok(rigid,'Original sphere pair must retain its rigid native contact cache');
 const manifolds=D.findStructs(pair,'ContactManifold');
 assert.ok(manifolds.length<=1,'A sphere pair cannot silently discard multiple native manifolds');
 const m=manifolds[0],md=m&&field(m,'data'),points=m?field(m,'points').items:[],solvers=md?field(md,'solver_contacts').items:[];
 assert.ok(points.length<=1&&solvers.length<=1,'A sphere pair cannot silently discard native point or solver arrays');
 const point=points[0],cd=point&&field(point,'data'),sc=solvers[0],recycles=D.findStructs(pair,'ContactRecycleState');
 assert.ok(recycles.length<=1,'One exact native pair recycle state');
 const rc=recycles[0],s={pairPresent:1,pointPresent:+!!point,active:+!!sc,recycleValid:+!!rc,solverColor:scalar(rigid,'solver_color')};
 if(point)Object.assign(s,{
  localP1:vec(point,'local_p1'),localP2:vec(point,'local_p2'),localN1:vec(m,'local_n1'),localN2:vec(m,'local_n2'),
  contactDistance:scalar(point,'dist'),impulse:scalar(cd,'impulse'),warmImpulse:scalar(cd,'warmstart_impulse'),
  warmWorld:vec(cd,'warmstart_tangent_world'),warmTangent:vec(cd,'warmstart_tangent_impulse'),tangentImpulse:vec(cd,'tangent_impulse'),
  dp1:vec(cd,'solver_dp1'),dp2:vec(cd,'solver_dp2'),feature1:scalar(point,'fid1'),feature2:scalar(point,'fid2')
 });
 if(sc)Object.assign(s,{
  normal:vec(md,'normal'),anchor1:vec(sc,'anchor1'),anchor2:vec(sc,'anchor2'),contactId:plain(field(sc,'contact_id').items[0]),
  friction:scalar(md,'friction'),restitution:scalar(md,'restitution'),solverBodyIds:field(md,'solver_body_ids').items.map(plain),
  graphPos:scalar(md,'graph_pos'),tangentVelocity:vec(sc,'tangent_velocity')
 });
 if(rc){const p=field(rc,'pos12');Object.assign(s,{
  recycleTranslation:vec(p,'translation'),recycleRelativeRotation:vec(p,'rotation'),recycleRotation:vec(p,'rotation'),
  recycleRotation1:vec(rc,'rot1'),recycleRotation2:vec(rc,'rot2'),maxExtent:scalar(rc,'max_extent'),maxDrift:scalar(rc,'max_drift')
 });}
 return s;
}

function colliderTable(d){
 const entries=field(field(field(d.state,'colliders'),'colliders'),'items').items,out=new Map();
 entries.forEach((entry,index)=>{if(entry.variant==='Occupied'){
  const handle={index,generation:scalar(entry,'generation')};
  out.set(key(handle),{handle,...plain(field(entry,'value'))});
 }});
 return out;
}

// Validate the actual intrusive lists, including both directions and back links,
// against every dense edge. An empty list alone never proves pair absence.
function extractGraph(d,colliders=colliderTable(d)){
 const typed=field(field(field(d.state,'narrow_phase'),'contact_graph'),'graph');
 const nodes=field(typed,'nodes').items.map(plain),typedEdges=field(typed,'edges').items,edges=typedEdges.map(plain);
 const byNode=new Map();
 nodes.forEach((n,i)=>{assert.ok(!byNode.has(key(n.weight)),'Unique original generation-bearing graph node');byNode.set(key(n.weight),i);assert.ok(colliders.has(key(n.weight)),'Native graph node has an original live collider');});
 edges.forEach(e=>{
  assert.equal(e.next.length,2);assert.equal(e.prev.length,2);assert.equal(e.node.length,2);
  for(let side=0;side<2;side++){
   const h=e.weight['collider'+(side+1)];
   assert.ok(colliders.has(key(h)),'Native edge endpoint has its exact original generation');
   assert.equal(byNode.get(key(h)),e.node[side],'Native edge node matches its directional collider endpoint');
  }
 });
 const adjacency=nodes.map((n,nodeIndex)=>{
  assert.equal(n.next.length,2);
  const out={collider:copy(n.weight),outgoing:[],incoming:[]};
  for(let side=0;side<2;side++){
   let at=n.next[side],prev=U;const seen=new Set(),list=out[side?'incoming':'outgoing'];
   while(at!==U){
    assert.ok(Number.isInteger(at)&&at>=0&&at<edges.length&&!seen.has(at),'Valid original directional edge chain');
    const e=edges[at];seen.add(at);
    assert.ok(same(e.weight['collider'+(side+1)],n.weight),'Directional edge chain uses its exact endpoint');
    assert.equal(e.node[side],nodeIndex,'Directional graph node incidence');
    assert.equal(e.prev[side],prev,'Original directional edge back link');
    list.push(at);prev=at;at=e.next[side];
   }
   const incidence=edges.flatMap((e,i)=>same(e.weight['collider'+(side+1)],n.weight)?[i]:[]);
   assert.equal(list.length,incidence.length,'Directional adjacency must cover full native endpoint incidence');
   assert.ok(incidence.every(i=>seen.has(i)),'Directional adjacency cannot hide an original edge');
  }
  return out;
 });
 const globalEdges=typedEdges.map((e,i)=>{
  const p=field(e,'weight'),c1=edges[i].weight.collider1,c2=edges[i].weight.collider2;
  return{collider1:copy(c1),collider2:copy(c2),body1:copy(colliders.get(key(c1)).parent.handle),body2:copy(colliders.get(key(c2)).parent.handle),
   active:D.findStructs(p,'ContactManifold').some(m=>field(field(m,'data'),'solver_contacts').items.length>0)};
 });
 const pairs=new Set();
 globalEdges.forEach(e=>{const id=[key(e.collider1),key(e.collider2)].sort().join('/');assert.ok(!pairs.has(id),'No duplicate original contact pair');pairs.add(id);});
 return{typedEdges,globalEdges,adjacency,nativeGraph:plain(typed)};
}

function material(co){
 const rules={Average:0,Min:1,Multiply:2,Max:3},m=co.material,p=co.parent.pos_wrt_parent;
 assert.ok(Object.hasOwn(rules,m.friction_combine_rule)&&Object.hasOwn(rules,m.restitution_combine_rule),'Known native coefficient combination rules');
 return{groups:((co.flags.collision_groups.memberships<<16)|co.flags.collision_groups.filter)>>>0,
  friction:m.friction,restitution:m.restitution,frictionRule:rules[m.friction_combine_rule],restitutionRule:rules[m.restitution_combine_rule],
  contactSkin:co.contact_skin,parentLocalIdentity:p.translation.every(x=>x===0)&&p.rotation.every((x,i)=>x===(i===3?1:0)),
  mass:co.mprops.variant==='Mass'?co.mprops.value:undefined};
}

function exportInitialPairSeeds(record,decodedCreated){
 const raw=record.created,d=decodedCreated??D.decodeSnapshot(raw.snapshot,{binary:process.env.RAPIER_SNAPSHOT_DECODER,engineVersion:'0.21.0'});
 const initialSnapshotSha256=crypto.createHash('sha256').update(raw.snapshot).digest('hex');
 assert.equal(raw.snapshotSha256,initialSnapshotSha256,'Unchanged original created snapshot bytes');
 assert.equal(d.inputSha256,initialSnapshotSha256,'Pair seeds must come from the original created snapshot, not recurrence');
 assert.equal(record.sceneRegistry.snapshotSha256,initialSnapshotSha256,'Original scene registry snapshot identity');
 assert.equal(record.objects.length,3,'All three original local ball identities');
 const colliders=colliderTable(d),graph=extractGraph(d,colliders),find=h=>{const c=colliders.get(key(h));assert.ok(c,'Exact original generation-bearing collider');return c;};
 const floor=record.sceneRegistry.statics.find(s=>same(s.body,record.roles.floor));assert.ok(floor,'Original cloth registry identity');
 const floorCo=find(floor.collider.handle);assert.ok(same(floorCo.parent.handle,record.roles.floor));
 const bodies=record.objects.map(o=>{
  const r=record.sceneRegistry.objects.find(b=>same(b.body,o.body));
  assert.ok(r&&same(r.primaryCollider.handle,o.collider)&&same(r.pairCollider.handle,o.pairCollider),'Original local ball and registry channels agree');
  const primary=find(o.collider),pair=find(o.pairCollider);assert.ok(same(primary.parent.handle,o.body)&&same(pair.parent.handle,o.body),'Original channel parents');
  return{bodyHandle:copy(o.body),primaryCollider:copy(o.collider),pairCollider:copy(o.pairCollider),primaryMaterial:material(primary),pairMaterial:material(pair)};
 });
 const floorPositions=bodies.map(b=>{
  const index=graph.globalEdges.findIndex(e=>same(e.collider1,floor.collider.handle)&&same(e.collider2,b.primaryCollider));
  assert.ok(index>=0,'Each original floor contact remains in the full graph');
  const p=field(graph.typedEdges[index],'weight'),m=D.findStructs(p,'ContactManifold')[0];
  assert.ok(m,'Original floor manifold retains its solver bucket position');
  return scalar(field(m,'data'),'graph_pos');
 });
 return[[0,1],[0,2],[1,2]].map(indices=>{
  const ballIndices=indices.slice().sort((a,b)=>bodies[a].pairCollider.index-bodies[b].pairCollider.index),selected=ballIndices.map(i=>bodies[i]);
  const selectedPair=e=>(same(e.collider1,selected[0].pairCollider)&&same(e.collider2,selected[1].pairCollider))||(same(e.collider2,selected[0].pairCollider)&&same(e.collider1,selected[1].pairCollider));
  const matches=graph.globalEdges.flatMap((e,i)=>selectedPair(e)?[i]:[]);
  assert.ok(matches.length<=1,'One original native edge per canonical ball pair');
  const pairIndex=matches[0];
  if(pairIndex!==undefined)assert.ok(same(graph.globalEdges[pairIndex].collider1,selected[0].pairCollider),'Native pair must already use canonical collider order; never reverse its cache');
  const pairDirectionalAdjacency=selected.map(b=>copy(graph.adjacency.find(a=>same(a.collider,b.pairCollider))??{collider:b.pairCollider,outgoing:[],incoming:[]}));
  const pairAdjacency=pairDirectionalAdjacency.map(a=>[...a.outgoing,...a.incoming]);
  if(pairIndex===undefined)assert.ok(pairAdjacency.every(a=>a.every(i=>!selectedPair(graph.globalEdges[i]))),'Absent pair agrees with both endpoint directions');
  else assert.ok(pairAdjacency.every(a=>a.includes(pairIndex)),'Existing native pair must occur in both endpoint adjacencies');
  const seed={kind:'original-two-body-contact-phase',phase:'post-world-step-post-application',initialSnapshotSha256,
   floorBody:copy(record.roles.floor),floorCollider:copy(floor.collider.handle),floorMaterial:material(floorCo),bodies:copy(selected),
   floorOrder:[0,1].sort((a,b)=>floorPositions[ballIndices[a]]-floorPositions[ballIndices[b]]),
   pair:contactRecord(pairIndex===undefined?null:field(graph.typedEdges[pairIndex],'weight')),
   globalEdges:copy(graph.globalEdges),pairAdjacency,pairDirectionalAdjacency,nativeGraph:copy(graph.nativeGraph)};
  return{key:indices.join(''),ballIndices,seed,initialSnapshotSha256};
 });
}

module.exports={exportInitialPairSeeds,contactRecord,extractGraph};
