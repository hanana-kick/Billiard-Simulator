'use strict';
// SPDX-License-Identifier: Apache-2.0
// Initial-only placement exporter. Full native first-h boundaries are oracle
// outputs, never inputs. No second-turn or fresh-fourth factory is called.
const assert=require('node:assert/strict'),F=require('./four-ball-created-fixture.cjs'),InitialContacts=require('./goal-four-initial-contact-import.cjs');
const copy=x=>structuredClone(x),same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation,U=0xffffffff;
function graphView(row,colliders=row.colliders){
 const graph=row.state.narrow_phase.contact_graph.graph,key=h=>h.index+':'+h.generation,by=new Map(row.colliders.map(c=>[key(c.handle),c]));
 assert.equal(by.size,row.colliders.length,'Original collider generations are unique');
 const byNode=new Map();
 graph.nodes.forEach((node,index)=>{
  assert.ok(by.has(key(node.weight))&&!byNode.has(key(node.weight)),'Every unique source graph node retains its live collider generation');
  assert.equal(node.next.length,2);byNode.set(key(node.weight),index);
 });
 const edges=graph.edges.map((edge)=>{
  const e=edge.weight;assert.equal(edge.next.length,2);assert.equal(edge.prev.length,2);assert.equal(edge.node.length,2);
  for(let side=0;side<2;side++){
   const h=e['collider'+(side+1)];assert.ok(by.has(key(h)),'Original graph edge has its exact live collider generation');
   assert.equal(byNode.get(key(h)),edge.node[side],'Source directional graph endpoint and node must agree');
  }
  return{collider1:copy(e.collider1),collider2:copy(e.collider2),body1:copy(by.get(key(e.collider1)).parent.handle),body2:copy(by.get(key(e.collider2)).parent.handle),active:e.contacts.variant==='Rigid'&&e.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0)};
 });
 const allAdjacency=new Map(row.colliders.map(c=>{
  const nodeIndex=byNode.get(key(c.handle)),node=graph.nodes[nodeIndex],out={collider:copy(c.handle),outgoing:[],incoming:[]};
  for(let side=0;side<2;side++){
   const seen=new Set();let at=node?.next[side]??U,prev=U;
   while(at!==U){
    assert.ok(Number.isInteger(at)&&at>=0&&at<graph.edges.length&&!seen.has(at),'Valid acyclic original directional graph chain');
    const e=graph.edges[at];seen.add(at);
    assert.ok(same(e.weight['collider'+(side+1)],c.handle),'Original linked-list edge must retain its source direction');
    assert.equal(e.node[side],nodeIndex);assert.equal(e.prev[side],prev,'Original directional graph back link');
    out[side?'incoming':'outgoing'].push(at);prev=at;at=e.next[side];
   }
   const incident=edges.flatMap((e,i)=>same(e['collider'+(side+1)],c.handle)?[i]:[]);
   assert.equal(seen.size,incident.length,'Complete original endpoint incidence cannot hide retained pairs');
   assert.ok(incident.every(i=>seen.has(i)),'Every original edge must remain in its directional chain');
  }
  return[key(c.handle),out];
 }));
 const adjacency=colliders.map(c=>{const a=allAdjacency.get(key(c.handle));assert.ok(a);return copy(a);});
 return{edges,adjacency};
}
function exportInitialSeeds(input){
 assert.deepEqual(Object.keys(input).sort(),['goalStrikeCreated','strikeCreationJournal']);
 const {goalStrikeCreated:row,strikeCreationJournal}=input;require('./goal-four-initialization-seed.cjs').exportInitialSeed(input);
 assert.equal(row.boundary,'goalStrikeCreated');assert.equal(row.candidateInput,true);assert.ok(Number.isInteger(row.nativeSteps)&&row.nativeSteps>72);assert.equal(row.sourceRevision,F.D.SOURCE_REVISION);
 assert.equal(F.hash(row.snapshot),row.snapshotSha256);assert.deepEqual(F.D.encodeLosslessTree(row.typedState),Buffer.from(row.snapshot));
 // Rebuild from the exact typed snapshot, rather than trust duplicated plain
 // projections or any pre/postWorld record supplied alongside the input.
 const state=F.plain(row.typedState);assert.deepEqual(row.state,state);
 // Body/collider convenience rows are verified against the typed arena here.
 const arena=a=>a.items.flatMap((entry,index)=>entry&&typeof entry==='object'&&'generation' in entry?[{handle:{index,generation:entry.generation},...entry.value}]:[]);
 const nativeBodies=arena(state.bodies.bodies),nativeColliders=arena(state.colliders.colliders);
 assert.deepEqual(row.bodies,nativeBodies);assert.deepEqual(row.colliders,nativeColliders);
 const objects=row.application.registry.objects,cue=row.application.cue;
 assert.equal(objects.length,4);assert.equal(row.application.registry.statics.length,16);assert.ok(row.application.steps>0);assert.ok(row.application.time>0);
 const selected=objects.find(o=>o.id===row.application.controller.selectedId);assert.ok(selected);const roles={ball:copy(selected.body),...Object.fromEntries(objects.filter(o=>o!==selected).map((o,i)=>['otherBall'+(i+1),copy(o.body)])),floor:copy(row.application.registry.statics.find(s=>s.kind==='cloth').body),shaft:copy(cue.shaft),head:copy(cue.head),guide:copy(cue.guide)};
 const colliders=row.colliders.map(c=>{const body=row.bodies.find(b=>same(b.handle,c.parent.handle));assert.ok(body);return{...copy(c),bodyType:body.body_type,softCcdPrediction:body.ccd.soft_ccd_prediction};});
 const bodyColliders=row.bodies.filter(b=>b.body_type==='Dynamic'||same(b.handle,roles.guide)).map(b=>({body:copy(b.handle),colliders:copy(b.colliders)}));
 const broadSeed={kind:'source-created-placed-goal-four-ball-cue-broad-phase',sourceRevision:row.sourceRevision,phase:'original-placed-goal-four-created-before-first-h',sourceNativeSteps:row.nativeSteps,sourceApplicationTime:row.application.time,sourceApplicationSteps:row.application.steps,sourceShots:1,sourceSelectedId:1,sourceSelectedIndex:0,initialSnapshotSha256:row.snapshotSha256,createdSnapshotSha256:row.snapshotSha256,sourcePipelineCompleted:true,initialBroadPhase:copy(state.broad_phase),colliders,bodyColliders,modifiedColliders:copy(state.colliders.modified_colliders[0]),roles,lengthUnit:state.integration_parameters.length_unit,normalizedPredictionDistance:state.integration_parameters.normalized_prediction_distance};
 const proxies=new Map(),projectedProxies=[];
 for(const n of state.broad_phase.tree.nodes)for(const c of[n.left,n.right])if((c.data&0x3fffffff)===1){
  assert.equal(proxies.has(c.children),false,'No duplicate source BVH leaf');
  proxies.set(c.children,{min:copy(c.mins),max:copy(c.maxs)});
  projectedProxies.push({index:c.children,min:copy(c.mins),max:copy(c.maxs)});
 }
 assert.deepEqual(row.proxies,projectedProxies,'Proxy convenience rows must come from the exact initial tree');
 assert.equal(proxies.size,24);assert.equal(state.broad_phase.tree.leaf_node_indices.n,24);
 assert.equal(state.broad_phase.frame_index,row.nativeSteps);
 const existing=[...row.application.registry.statics.map(s=>s.collider),...objects.flatMap(o=>[o.collider,o.pairCollider])];
 assert.equal(new Set(existing.map(h=>h.index)).size,24);
 assert.ok(existing.every(h=>proxies.has(h.index)&&nativeColliders.some(c=>same(c.handle,h))),'All existing generation-bearing collider proxies retained');
 assert.ok([cue.shaftCollider,cue.tipCollider,cue.neckCollider].every(h=>!proxies.has(h.index)),'Fresh cue proxies may not be borrowed from h1');
 assert.deepEqual(state.colliders.modified_colliders[0],[cue.shaftCollider,cue.tipCollider,cue.neckCollider]);
 const pairs=F.D.findStructs(F.D.field(row.typedState,'narrow_phase'),'ContactPair').map(F.plain);
 assert.deepEqual(row.contactPairs,pairs,'Contact convenience rows must come from the exact initial tree');
 const floor=row.application.registry.statics.find(s=>s.kind==='cloth');assert.ok(floor);
 const initialContactOrigin=InitialContacts.exportInitialContacts(row);
 broadSeed.initialContactOrigin=copy(initialContactOrigin);
 for(const o of objects)assert.equal(pairs.filter(p=>same(p.collider1,floor.collider)&&same(p.collider2,o.collider)).length,1,'Every sleeping sphere retains exactly its actual cloth cache');
 const normalized=colliders.map(c=>({handle:copy(c.handle),body:copy(c.parent.handle),type:c.bodyType,groups:((c.flags.collision_groups.memberships<<16)|c.flags.collision_groups.filter)>>>0,enabled:c.flags.enabled==='Enabled',sensor:c.coll_type!=='Solid',activeCollisionTypes:c.flags.active_collision_types,activeHooks:c.flags.active_hooks,contactSkin:c.contact_skin,parentLocalIdentity:c.parent.pos_wrt_parent.translation.every(x=>x===0)&&c.parent.pos_wrt_parent.rotation.every((x,i)=>x===[0,0,0,1][i]),...(c.bodyType==='Fixed'?copy(proxies.get(c.handle.index)):{})}));
 const graphSeed={kind:'original-placed-goal-four-ball-cue-contact-graph',initialSnapshotSha256:row.snapshotSha256,adaptiveChangeDetectionMargin:false,lengthUnit:broadSeed.lengthUnit,normalizedPredictionDistance:broadSeed.normalizedPredictionDistance,cueColliders:[cue.shaftCollider,cue.tipCollider,cue.neckCollider].map(copy),colliders:normalized,bodies:objects.map((o,i)=>{const co=colliders.find(c=>same(c.handle,o.collider));assert.equal(proxies.has(o.collider.index),true);assert.equal(proxies.has(o.pairCollider.index),true);return{body:copy(o.body),primary:copy(o.collider),pair:copy(o.pairCollider),radius:co.shape.value.radius,softCcdPrediction:co.softCcdPrediction,...copy(proxies.get(o.collider.index))};}),...graphView(row)};
 assert.deepEqual(graphSeed.edges,initialContactOrigin.edges,'Every initial cloth/cushion/dynamic edge retains its exact source order and identity');
 for(const o of objects){
  assert.equal(graphSeed.edges.filter(e=>same(e.collider1,floor.collider)&&same(e.body1,floor.body)&&same(e.collider2,o.collider)&&same(e.body2,o.body)).length,1);
  const a=graphSeed.adjacency.find(a=>same(a.collider,o.pairCollider));assert.ok(a);
  for(const edgeId of [...a.outgoing,...a.incoming])assert.ok(initialContactOrigin.retainedDynamicPairs.some(p=>p.edgeId===edgeId),'Every original pair-channel edge needs its retained dynamic cache owner');
 }
 const pose=body=>({translation:copy(body.pos.position.translation),rotation:copy(body.pos.position.rotation)}),find=h=>row.bodies.find(b=>same(b.handle,h));
 const own={balls:objects.map(o=>({body:copy(o.body),...pose(find(o.body))})),cue:{shaft:pose(find(roles.shaft)),head:pose(find(roles.head))},removedBodies:[],activeBodyOrder:[]};
 return{broadSeed,graphSeed,own,initialContactOrigin};
}
module.exports={exportInitialSeeds,graphView};
