'use strict';
// Read-only extraction of an independent original native checkpoint. No Rapier
// initialization/step/restore and no production factory accepts this future row.
const assert=require('node:assert/strict'),fs=require('node:fs'),v8=require('node:v8'),crypto=require('node:crypto');
const copy=structuredClone,U=0xffffffff,hash=b=>crypto.createHash('sha256').update(b).digest('hex'),same=(a,b)=>a.index===b.index&&a.generation===b.generation;
function project(row,parents=row.colliders){
 const n=row.state.narrow_phase,arena=row.state.bodies.bodies.items,awake=row.state.islands.awake_island;
 return{boundary:row.boundary,candidateInput:row.candidateInput,snapshotSha256:row.snapshotSha256,
  bodies:row.bodies.map(b=>({handle:copy(b.handle),type:b.body_type})),liveColliders:row.colliders.map(c=>copy(c.handle)),
  edges:n.contact_graph.graph.edges.map(e=>{const p=e.weight,parent=h=>parents.find(c=>same(c.handle,h)).parent.handle;return{collider1:copy(p.collider1),collider2:copy(p.collider2),body1:copy(parent(p.collider1)),body2:copy(parent(p.collider2)),active:p.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0)};}),
  pairs:n.contact_graph.graph.edges.map((e,i)=>{const p=e.weight.contacts.value;return{hint:n.pair_solver_hints[i],solverColor:p.solver_color,solverColorBodies:copy(p.solver_color_bodies),manifolds:p.manifolds.map(m=>({activeContactCount:m.data.solver_contacts.length,solverFlags:m.data.solver_flags,graphPos:m.data.graph_pos,solverColor:m.data.solver_color,solverBodyIds:copy(m.data.solver_body_ids)}))};}),
  adjacency:n.contact_graph.graph.nodes.map(node=>{const row={collider:copy(node.weight),outgoing:[],incoming:[]};for(let side=0;side<2;side++){let edge=node.next[side];while(edge!==U){row[side?'incoming':'outgoing'].push(edge);edge=n.contact_graph.graph.edges[edge].next[side];}}return row;}),
  bodySolverColorMasks:n.body_solver_color_masks.map(String),buckets:copy(n.solver_contact_graph.buckets),solverGraphValid:n.solver_graph_valid,solverGraphEpoch:n.solver_graph_epoch,solverGraphMultibodyEpoch:n.solver_graph_mb_epoch,activeSetEpoch:row.state.islands.active_set_epoch,multibodyTopologyEpoch:row.state.multibody_joints.topology_epoch,
  awakeBodies:awake===null?[]:row.state.islands.islands.v[awake].bodies.map(body=>({body:copy(body),activeSetId:arena[body.index].value.ids.active_set_id})),removedColliders:copy(row.state.colliders.removed_colliders)};
}
function extract(file){
 const bytes=fs.readFileSync(file),manifest=JSON.parse(fs.readFileSync(file+'.json'));assert.equal(hash(bytes),manifest.sha256);assert.equal(bytes.length,manifest.bytes);
 const p=v8.deserialize(bytes),get=(h,phase)=>p.rows.find(r=>r.hCount===h&&r.boundary==='expected-only-h'+h+'-'+phase),before=get(463,'postApplication'),pre=get(464,'preWorld'),after=get(464,'postWorld');
 for(const row of[before,pre,after]){assert.equal(row.candidateInput,false);assert.equal(hash(row.snapshot),row.snapshotSha256);assert.equal(row.sourceRevision,p.record.boundaries.goalStrikeCreated.sourceRevision);assert.equal(row.verification.nativeBincodeByteIdentical,true);assert.equal(row.verification.javascriptTypedReencodeByteIdentical,true);}
 return{schema:'source-only-retired-contact-color-checkpoints-v1',scope:'Read-only original native before/after projections; isolated bookkeeping component inputs, never whole-world recurrence input or public active-contact admission.',sourceRevision:before.sourceRevision,artifactSha256:manifest.sha256,initialSnapshotSha256:p.record.boundaries.goalStrikeCreated.snapshotSha256,before:project(before),preWorld:project(pre,before.colliders),after:project(after)};
}
module.exports={extract};
if(require.main===module){assert.ok(process.argv[2]);process.stdout.write(JSON.stringify(extract(process.argv[2]),null,2)+'\n');}
