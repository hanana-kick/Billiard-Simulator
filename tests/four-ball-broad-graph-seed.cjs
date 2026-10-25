'use strict';
// Initial-only exporter. Full native first-h boundaries are oracle outputs, not
// inputs. The caller supplies only strikeCreated and the actual creation calls.
const assert=require('node:assert/strict'),F=require('./four-ball-created-fixture.cjs');
const copy=x=>structuredClone(x),same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation,U=0xffffffff;
function graphView(row,colliders=row.colliders){
 const graph=row.state.narrow_phase.contact_graph.graph,by=new Map(row.colliders.map(c=>[c.handle.index,c]));
 const edges=graph.edges.map(({weight:e})=>({collider1:copy(e.collider1),collider2:copy(e.collider2),body1:copy(by.get(e.collider1.index).parent.handle),body2:copy(by.get(e.collider2.index).parent.handle),active:e.contacts.variant==='Rigid'&&e.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0)}));
 const adjacency=colliders.map(c=>{const node=graph.nodes.find(n=>same(n.weight,c.handle)),out={collider:copy(c.handle),outgoing:[],incoming:[]};if(node)for(let side=0;side<2;side++){const seen=new Set();let at=node.next[side];while(at!==U){assert.ok(!seen.has(at)&&graph.edges[at]);seen.add(at);out[side?'incoming':'outgoing'].push(at);at=graph.edges[at].next[side];}}return out;});return{edges,adjacency};
}
function exportInitialSeeds(input){
 assert.deepEqual(Object.keys(input).sort(),['modeCreationJournal','strikeCreated','strikeCreationJournal']);
 const {strikeCreated,modeCreationJournal,strikeCreationJournal}=input,row=strikeCreated;
 assert.equal(row.boundary,'strikeCreated');assert.equal(row.candidateInput,true);assert.equal(row.nativeSteps,72);assert.equal(row.sourceRevision,F.D.SOURCE_REVISION);
 assert.equal(F.hash(row.snapshot),row.snapshotSha256);assert.deepEqual(F.D.encodeLosslessTree(row.typedState),Buffer.from(row.snapshot));
 // Rebuild from the exact typed snapshot, rather than trust duplicated plain
 // projections or any pre/postWorld record supplied alongside the input.
 const state=F.plain(row.typedState);assert.deepEqual(row.state,state);
 // Body/collider convenience rows are verified against the typed arena here.
 const arena=a=>a.items.flatMap((entry,index)=>entry&&typeof entry==='object'&&'generation' in entry?[{handle:{index,generation:entry.generation},...entry.value}]:[]);
 const nativeBodies=arena(state.bodies.bodies),nativeColliders=arena(state.colliders.colliders);
 assert.deepEqual(row.bodies,nativeBodies);assert.deepEqual(row.colliders,nativeColliders);
 const objects=row.application.registry.objects,cue=row.application.cue;
 assert.equal(objects.length,4);assert.equal(row.application.registry.statics.length,16);assert.equal(row.application.steps,0);assert.equal(row.application.time,0);
 const roles={ball:copy(objects[0].body),otherBall1:copy(objects[1].body),otherBall2:copy(objects[2].body),otherBall3:copy(objects[3].body),shaft:copy(cue.shaft),head:copy(cue.head),guide:copy(cue.guide)};
 const colliders=row.colliders.map(c=>{const body=row.bodies.find(b=>same(b.handle,c.parent.handle));assert.ok(body);return{...copy(c),bodyType:body.body_type,softCcdPrediction:body.ccd.soft_ccd_prediction};});
 const bodyColliders=row.bodies.filter(b=>b.body_type==='Dynamic'||same(b.handle,roles.guide)).map(b=>({body:copy(b.handle),colliders:copy(b.colliders)}));
 const fourth=objects[3],cloth=row.application.registry.statics.find(s=>s.kind==='cloth');
 const initialFourBallBirth={kind:'original-controller-fourth-sphere-before-first-h',boundary:'strikeCreated',initialSnapshotSha256:row.snapshotSha256,body:copy(fourth.body),primary:copy(fourth.collider),pair:copy(fourth.pairCollider),clothCollider:copy(cloth.collider),modeCreationJournal:copy(modeCreationJournal),strikeCreationJournal:copy(strikeCreationJournal)};
 const broadSeed={kind:'source-created-initial-four-ball-cue-broad-phase',sourceRevision:row.sourceRevision,phase:'original-constructor72-strike-created-before-first-h',constructorNativeSettlingSteps:72,additionalApplicationSettlingSteps:0,initialSnapshotSha256:row.snapshotSha256,createdSnapshotSha256:row.snapshotSha256,sourcePipelineCompleted:true,initialBroadPhase:copy(state.broad_phase),colliders,bodyColliders,modifiedColliders:copy(state.colliders.modified_colliders[0]),roles,lengthUnit:state.integration_parameters.length_unit,normalizedPredictionDistance:state.integration_parameters.normalized_prediction_distance,initialFourBallBirth};
 const proxies=new Map();for(const n of state.broad_phase.tree.nodes)for(const c of[n.left,n.right])if((c.data&0x3fffffff)===1)proxies.set(c.children,{min:copy(c.mins),max:copy(c.maxs)});
 const normalized=colliders.map(c=>({handle:copy(c.handle),body:copy(c.parent.handle),type:c.bodyType,groups:((c.flags.collision_groups.memberships<<16)|c.flags.collision_groups.filter)>>>0,enabled:c.flags.enabled==='Enabled',sensor:c.coll_type!=='Solid',activeCollisionTypes:c.flags.active_collision_types,activeHooks:c.flags.active_hooks,contactSkin:c.contact_skin,parentLocalIdentity:c.parent.pos_wrt_parent.translation.every(x=>x===0)&&c.parent.pos_wrt_parent.rotation.every((x,i)=>x===[0,0,0,1][i]),...(c.bodyType==='Fixed'?copy(proxies.get(c.handle.index)):{})}));
 const graphSeed={kind:'original-initial-four-ball-cue-contact-graph',initialSnapshotSha256:row.snapshotSha256,adaptiveChangeDetectionMargin:false,lengthUnit:broadSeed.lengthUnit,normalizedPredictionDistance:broadSeed.normalizedPredictionDistance,cueColliders:[cue.shaftCollider,cue.tipCollider,cue.neckCollider].map(copy),colliders:normalized,bodies:objects.map((o,i)=>{const co=colliders.find(c=>same(c.handle,o.collider));assert.equal(proxies.has(o.collider.index),i<3);assert.equal(proxies.has(o.pairCollider.index),i<3);return{body:copy(o.body),primary:copy(o.collider),pair:copy(o.pairCollider),radius:co.shape.value.radius,softCcdPrediction:co.softCcdPrediction,...(i<3?copy(proxies.get(o.collider.index)):{proxyAbsent:true})};}),...graphView(row)};
 const pose=body=>({translation:copy(body.pos.position.translation),rotation:copy(body.pos.position.rotation)}),find=h=>row.bodies.find(b=>same(b.handle,h));
 const own={balls:objects.map(o=>({body:copy(o.body),...pose(find(o.body))})),cue:{shaft:pose(find(roles.shaft)),head:pose(find(roles.head))},removedBodies:[],activeBodyOrder:bodyColliders.filter(b=>!same(b.body,roles.guide)).map(b=>copy(b.body))};
 return{broadSeed,graphSeed,own};
}
module.exports={exportInitialSeeds,graphView};
