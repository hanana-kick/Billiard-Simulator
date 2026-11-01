// SPDX-License-Identifier: Apache-2.0
// Browser-native, initial-only source projection. Port of tests/goal-four-broad-graph-seed.cjs.
// Numerical values, generations and caches are copied from verified native bytes;
// this adapter never creates/restores/steps physics or accepts future output.
import * as D from '../../tools/rapier-snapshot-decoder/browser.mjs';
import {requireThat,equal,equalData,plain,hash,journalDigest,copy} from './exact-data.mjs';
import * as InitSeed from './goal-initialization.mjs';
import * as InitialContacts from './goal-initial-contact.mjs';
const same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation,U=0xffffffff;
function graphView(row,colliders=row.colliders){
 const graph=row.state.narrow_phase.contact_graph.graph,key=h=>h.index+':'+h.generation,by=new Map(row.colliders.map(c=>[key(c.handle),c]));
 equal(by.size,row.colliders.length,'Original collider generations are unique');
 const byNode=new Map();
 graph.nodes.forEach((node,index)=>{
  requireThat(by.has(key(node.weight))&&!byNode.has(key(node.weight)),'Every unique source graph node retains its live collider generation');
  equal(node.next.length,2);byNode.set(key(node.weight),index);
 });
 const edges=graph.edges.map((edge)=>{
  const e=edge.weight;equal(edge.next.length,2);equal(edge.prev.length,2);equal(edge.node.length,2);
  for(let side=0;side<2;side++){
   const h=e['collider'+(side+1)];requireThat(by.has(key(h)),'Original graph edge has its exact live collider generation');
   equal(byNode.get(key(h)),edge.node[side],'Source directional graph endpoint and node must agree');
  }
  return{collider1:copy(e.collider1),collider2:copy(e.collider2),body1:copy(by.get(key(e.collider1)).parent.handle),body2:copy(by.get(key(e.collider2)).parent.handle),active:e.contacts.variant==='Rigid'&&e.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0)};
 });
 const allAdjacency=new Map(row.colliders.map(c=>{
  const nodeIndex=byNode.get(key(c.handle)),node=graph.nodes[nodeIndex],out={collider:copy(c.handle),outgoing:[],incoming:[]};
  for(let side=0;side<2;side++){
   const seen=new Set();let at=node?.next[side]??U,prev=U;
   while(at!==U){
    requireThat(Number.isInteger(at)&&at>=0&&at<graph.edges.length&&!seen.has(at),'Valid acyclic original directional graph chain');
    const e=graph.edges[at];seen.add(at);
    requireThat(same(e.weight['collider'+(side+1)],c.handle),'Original linked-list edge must retain its source direction');
    equal(e.node[side],nodeIndex);equal(e.prev[side],prev,'Original directional graph back link');
    out[side?'incoming':'outgoing'].push(at);prev=at;at=e.next[side];
   }
   const incident=edges.flatMap((e,i)=>same(e['collider'+(side+1)],c.handle)?[i]:[]);
   equal(seen.size,incident.length,'Complete original endpoint incidence cannot hide retained pairs');
   requireThat(incident.every(i=>seen.has(i)),'Every original edge must remain in its directional chain');
  }
  return[key(c.handle),out];
 }));
 const adjacency=colliders.map(c=>{const a=allAdjacency.get(key(c.handle));requireThat(a);return copy(a);});
 return{edges,adjacency};
}
async function exportInitialSeeds(input){
 equalData(Object.keys(input).sort(),['goalStrikeCreated','strikeCreationJournal']);
 const {goalStrikeCreated:row,strikeCreationJournal}=input;await InitSeed.exportInitialSeed(input);
 equal(row.boundary,'goalStrikeCreated');equal(row.candidateInput,true);requireThat(Number.isInteger(row.nativeSteps)&&row.nativeSteps>72);equal(row.sourceRevision,D.SOURCE_REVISION);
 equal(await hash(row.snapshot),row.snapshotSha256);equalData(D.encodeLosslessTree(row.typedState),row.snapshot);
 // Rebuild from the exact typed snapshot, rather than trust duplicated plain
 // projections or any pre/postWorld record supplied alongside the input.
 const state=plain(row.typedState);equalData(row.state,state);
 // Body/collider convenience rows are verified against the typed arena here.
 const arena=a=>a.items.flatMap((entry,index)=>entry&&typeof entry==='object'&&'generation' in entry?[{handle:{index,generation:entry.generation},...entry.value}]:[]);
 const nativeBodies=arena(state.bodies.bodies),nativeColliders=arena(state.colliders.colliders);
 equalData(row.bodies,nativeBodies);equalData(row.colliders,nativeColliders);
 const objects=row.application.registry.objects,cue=row.application.cue;
 equal(objects.length,4);equal(row.application.registry.statics.length,16);requireThat(row.application.steps>0);requireThat(row.application.time>0);
 const selected=objects.find(o=>o.id===row.application.controller.selectedId);requireThat(selected);const roles={ball:copy(selected.body),...Object.fromEntries(objects.filter(o=>o!==selected).map((o,i)=>['otherBall'+(i+1),copy(o.body)])),floor:copy(row.application.registry.statics.find(s=>s.kind==='cloth').body),shaft:copy(cue.shaft),head:copy(cue.head),guide:copy(cue.guide)};
 const colliders=row.colliders.map(c=>{const body=row.bodies.find(b=>same(b.handle,c.parent.handle));requireThat(body);return{...copy(c),bodyType:body.body_type,softCcdPrediction:body.ccd.soft_ccd_prediction};});
 const bodyColliders=row.bodies.filter(b=>b.body_type==='Dynamic'||same(b.handle,roles.guide)).map(b=>({body:copy(b.handle),colliders:copy(b.colliders)}));
 const broadSeed={kind:'source-created-placed-goal-four-ball-cue-broad-phase',sourceRevision:row.sourceRevision,phase:'original-placed-goal-four-created-before-first-h',sourceNativeSteps:row.nativeSteps,sourceApplicationTime:row.application.time,sourceApplicationSteps:row.application.steps,sourceShots:1,sourceSelectedId:1,sourceSelectedIndex:0,initialSnapshotSha256:row.snapshotSha256,createdSnapshotSha256:row.snapshotSha256,sourcePipelineCompleted:true,initialBroadPhase:copy(state.broad_phase),colliders,bodyColliders,modifiedColliders:copy(state.colliders.modified_colliders[0]),roles,lengthUnit:state.integration_parameters.length_unit,normalizedPredictionDistance:state.integration_parameters.normalized_prediction_distance};
 const proxies=new Map(),projectedProxies=[];
 for(const n of state.broad_phase.tree.nodes)for(const c of[n.left,n.right])if((c.data&0x3fffffff)===1){
  equal(proxies.has(c.children),false,'No duplicate source BVH leaf');
  proxies.set(c.children,{min:copy(c.mins),max:copy(c.maxs)});
  projectedProxies.push({index:c.children,min:copy(c.mins),max:copy(c.maxs)});
 }
 equalData(row.proxies,projectedProxies,'Proxy convenience rows must come from the exact initial tree');
 equal(proxies.size,24);equal(state.broad_phase.tree.leaf_node_indices.n,24);
 equal(state.broad_phase.frame_index,row.nativeSteps);
 const existing=[...row.application.registry.statics.map(s=>s.collider),...objects.flatMap(o=>[o.collider,o.pairCollider])];
 equal(new Set(existing.map(h=>h.index)).size,24);
 requireThat(existing.every(h=>proxies.has(h.index)&&nativeColliders.some(c=>same(c.handle,h))),'All existing generation-bearing collider proxies retained');
 requireThat([cue.shaftCollider,cue.tipCollider,cue.neckCollider].every(h=>!proxies.has(h.index)),'Fresh cue proxies may not be borrowed from h1');
 equalData(state.colliders.modified_colliders[0],[cue.shaftCollider,cue.tipCollider,cue.neckCollider]);
 const pairs=D.findStructs(D.field(row.typedState,'narrow_phase'),'ContactPair').map(plain);
 equalData(row.contactPairs,pairs,'Contact convenience rows must come from the exact initial tree');
 const floor=row.application.registry.statics.find(s=>s.kind==='cloth');requireThat(floor);
 const initialContactOrigin=InitialContacts.exportInitialContacts(row);
 broadSeed.initialContactOrigin=copy(initialContactOrigin);
 for(const o of objects)equal(pairs.filter(p=>same(p.collider1,floor.collider)&&same(p.collider2,o.collider)).length,1,'Every sleeping sphere retains exactly its actual cloth cache');
 const normalized=colliders.map(c=>({handle:copy(c.handle),body:copy(c.parent.handle),type:c.bodyType,groups:((c.flags.collision_groups.memberships<<16)|c.flags.collision_groups.filter)>>>0,enabled:c.flags.enabled==='Enabled',sensor:c.coll_type!=='Solid',activeCollisionTypes:c.flags.active_collision_types,activeHooks:c.flags.active_hooks,contactSkin:c.contact_skin,parentLocalIdentity:c.parent.pos_wrt_parent.translation.every(x=>x===0)&&c.parent.pos_wrt_parent.rotation.every((x,i)=>x===[0,0,0,1][i]),...(c.bodyType==='Fixed'?copy(proxies.get(c.handle.index)):{})}));
 const graphSeed={kind:'original-placed-goal-four-ball-cue-contact-graph',initialSnapshotSha256:row.snapshotSha256,adaptiveChangeDetectionMargin:false,lengthUnit:broadSeed.lengthUnit,normalizedPredictionDistance:broadSeed.normalizedPredictionDistance,cueColliders:[cue.shaftCollider,cue.tipCollider,cue.neckCollider].map(copy),colliders:normalized,bodies:objects.map((o,i)=>{const co=colliders.find(c=>same(c.handle,o.collider));equal(proxies.has(o.collider.index),true);equal(proxies.has(o.pairCollider.index),true);return{body:copy(o.body),primary:copy(o.collider),pair:copy(o.pairCollider),radius:co.shape.value.radius,softCcdPrediction:co.softCcdPrediction,...copy(proxies.get(o.collider.index))};}),...graphView(row)};
 equalData(graphSeed.edges,initialContactOrigin.edges,'Every initial cloth/cushion/dynamic edge retains its exact source order and identity');
 for(const o of objects){
  equal(graphSeed.edges.filter(e=>same(e.collider1,floor.collider)&&same(e.body1,floor.body)&&same(e.collider2,o.collider)&&same(e.body2,o.body)).length,1);
  const a=graphSeed.adjacency.find(a=>same(a.collider,o.pairCollider));requireThat(a);
  for(const edgeId of [...a.outgoing,...a.incoming])requireThat(initialContactOrigin.retainedDynamicPairs.some(p=>p.edgeId===edgeId),'Every original pair-channel edge needs its retained dynamic cache owner');
 }
 const pose=body=>({translation:copy(body.pos.position.translation),rotation:copy(body.pos.position.rotation)}),find=h=>row.bodies.find(b=>same(b.handle,h));
 const own={balls:objects.map(o=>({body:copy(o.body),...pose(find(o.body))})),cue:{shaft:pose(find(roles.shaft)),head:pose(find(roles.head))},removedBodies:[],activeBodyOrder:[]};
 return{broadSeed,graphSeed,own,initialContactOrigin};
}
export {exportInitialSeeds,graphView};
