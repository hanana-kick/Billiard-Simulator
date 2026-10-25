// SPDX-License-Identifier: Apache-2.0
// Assertion-only shared native first-h/outer-step comparison. No candidate input.
import nativeAssert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Native=require('./four-ball-active-ccd-native-compare.cjs'),Empty=require('./four-ball-cue-empty-native-compare.cjs'),Graph=require('./four-ball-broad-graph-seed.cjs');
const copy=x=>structuredClone(x),same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation;
function brief(value) {
  if (typeof value === 'string') return JSON.stringify(value.length > 140 ? value.slice(0, 140) + '…' : value);
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : String(value);
  if (value === null || typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return 'Array(length=' + value.length + ')';
  if (ArrayBuffer.isView(value)) return value.constructor.name + '(bytes=' + value.byteLength + ')';
  return (value.constructor?.name ?? 'Object') + '{' + Object.keys(value).slice(0, 8).join(',') + (Object.keys(value).length > 8 ? ',…' : '') + '}';
}
function firstMismatch(actual, expected, at = '$', seen = new WeakMap()) {
  if (isDeepStrictEqual(actual, expected)) return null;
  const mismatch = () => ({path: at, actual: brief(actual), expected: brief(expected)});
  if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object') return mismatch();
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) return {...mismatch(), path: at + '.[[Prototype]]'};
  const prior = seen.get(actual) ?? new WeakSet(); if (prior.has(expected)) return mismatch(); prior.add(expected); seen.set(actual, prior);
  if (Array.isArray(actual) && actual.length !== expected.length) return {path: at + '.length', actual: String(actual.length), expected: String(expected.length)};
  const keys = x => Reflect.ownKeys(x).filter(k => Object.prototype.propertyIsEnumerable.call(x, k));
  const aa = keys(actual), bb = keys(expected);
  const child = k => at + (Array.isArray(actual) && /^\d+$/.test(String(k)) ? '[' + String(k) + ']' : '.' + String(k));
  for (const k of aa) if (!Object.prototype.propertyIsEnumerable.call(expected, k)) return {path: child(k), actual: brief(actual[k]), expected: '<missing>'};
  for (const k of bb) if (!Object.prototype.propertyIsEnumerable.call(actual, k)) return {path: child(k), actual: '<missing>', expected: brief(expected[k])};
  for (const k of aa) if (!isDeepStrictEqual(actual[k], expected[k])) return firstMismatch(actual[k], expected[k], child(k), seen);
  return mismatch(); // Opaque native types still fail the exact root comparison.
}
function compactDeepEqual(actual, expected, message = 'Exact deep equality') {
  if (isDeepStrictEqual(actual, expected)) return;
  const difference = firstMismatch(actual, expected);
  nativeAssert.fail(String(message) + '; first mismatch at ' + difference.path + ': actual ' + difference.actual + ', expected ' + difference.expected);
}
const assert = Object.assign((...args) => nativeAssert(...args), nativeAssert, {deepEqual: compactDeepEqual, deepStrictEqual: compactDeepEqual});

function near(a,b,tol,label){
 if(Array.isArray(b)){assert.equal(a?.length,b.length,label+' length');b.forEach((v,i)=>near(a[i],v,tol,label+'['+i+']'));return;}
 assert.ok(Number.isFinite(a)&&Number.isFinite(b),label+' finite');assert.ok(Math.abs(a-b)<=tol,`${label}: ${a} versus ${b}; tolerance ${tol}`);
}
function compareBalls(rows,expected,registry,label){
 assert.equal(rows.length,3);
 for(let i=0;i<3;i++){
  const out=rows[i],object=registry.objects[i],body=expected.bodies.find(b=>same(b.handle,object.body));assert.ok(body);assert.equal(out.id,object.id);const a=out.state;
  for(const [field,want]of Object.entries({translation:body.pos.position.translation,rotation:body.pos.position.rotation,linear:body.vels.linvel,angular:body.vels.angvel}))near(a[field],want,['translation','rotation'].includes(field)?1e-6:3e-6,label+i+'.'+field);
  const ii=body.mprops.effective_world_inv_inertia;near(a.invInertia,['m11','m12','m13','m12','m22','m23','m13','m23','m33'].map(k=>ii[k]),3e-6,label+i+'.invInertia');assert.equal(a.sleeping,body.activation.sleeping);
 }
}
function comparePrepared(out,expected,projection){
 const row=expected.post,registry=projection.application.registry,roles=projection.created.roles;
 assert.equal(out.frame,expected.h);assert.equal(out.time,expected.time);assert.equal(out.phase,'post-world-step-post-application');assert.deepEqual(out.scene.manager,row.state.islands,'Complete original manager, without replacing any scan stamp');assert.deepEqual(out.scene.modifiedBodies,row.queues.modifiedBodies);
 assert.equal(out.scene.bodies.length,row.bodies.length);
 for(const b of row.bodies){const a=out.scene.bodies.find(x=>same(x.handle,b.handle));assert.ok(a);assert.deepEqual(a.ids,b.ids);assert.equal(a.changes,b.changes);if(b.body_type==='Dynamic'){for(const k of ['normalized_linear_threshold','angular_threshold','time_until_sleep','time_since_can_sleep','sleeping'])assert.equal(a.activation[k],b.activation[k],b.handle.index+'.activation.'+k);for(const k of ['translation','rotation'])near(a.activation.sleep_prev_pose[k],b.activation.sleep_prev_pose[k],2e-6,'sleep history');}}
 compareBalls(out.balls,row,registry,'postpatch ball');if(out.prePatchBalls)compareBalls(out.prePatchBalls.map((state,i)=>({id:registry.objects[i].id,state})),expected.pre,registry,'prepatch ball');
 const nativeCuePresent=row.bodies.some(b=>same(b.handle,roles?.head??projection.application.cue.head));
 if(nativeCuePresent){
 for(const role of ['shaft','head']){
  const handle=roles?.[role]??projection.application.cue[role],b=row.bodies.find(x=>same(x.handle,handle));assert.ok(b);const a=out.cue[role];
  for(const [field,want]of Object.entries({translation:b.pos.position.translation,rotation:b.pos.position.rotation,linear:b.vels.linvel,angular:b.vels.angvel}))near(a[field],want,3e-6,'cue.'+role+'.'+field);
  const m=b.mprops.effective_world_inv_inertia,ii=['m11','m12','m13','m22','m23','m33'].map(k=>m[k]),scale=Math.max(1,...ii.map(Math.abs));near(a.invInertia,ii,3e-6*scale,'cue.'+role+'.inertia');
 }
 const joints=row.state.impulse_joints.joint_graph.graph.edges.map(e=>e.weight);
 near(out.cue.impulses,[...joints[0].impulses.slice(3,6),joints[0].impulses[0],...joints[1].impulses.slice(3,6),joints[1].impulses[1],joints[1].impulses[2],joints[1].data.limits[0].impulse],2e-6,'cue joint impulses');
 }else{
  assert.equal(out.cue,null,'Source-retired cue must not retain numerical bodies');assert.equal(out.cueMetadata.cuePresent,false);
  for(const role of ['head','shaft','guide']){const handle=roles?.[role]??projection.application.cue[role];assert.ok(handle);assert.equal(row.bodies.some(b=>same(b.handle,handle)),false);assert.equal(out.scene.bodies.some(b=>same(b.handle,handle)),false);}
  assert.equal(row.state.impulse_joints.joint_graph.graph.edges.length,0,'All original cue joints retired');assert.deepEqual(out.emptyCuePairs,[]);assert.deepEqual(out.emptyCueConvexPairs,[]);
 }
 const graph=Graph.graphView(row);assert.deepEqual(out.contactGraph.edges,graph.edges);assert.deepEqual(out.contactGraph.adjacency,graph.adjacency);assert.deepEqual(out.contactGraph.liveColliders,row.colliders.map(c=>c.handle));assert.equal(out.contactGraph.sequence,expected.h);
 const floor=registry.statics.find(s=>s.kind==='cloth');
 for(let i=0;i<3;i++){
  const pair=row.contactPairs.find(p=>same(p.collider1,floor.collider)&&same(p.collider2,registry.objects[i].collider));assert.ok(pair);const want=Native.cache(pair),actual=out.balls[i].state;
  for(const [k,v]of Object.entries(want)){const a=['pairPresent','pointPresent','active','recycleValid'].includes(k)?+actual.topology[k]:actual[k];if(['pairPresent','pointPresent','active','recycleValid','solverColor','contactId','feature1','feature2'].includes(k))assert.equal(a,v,'floor'+i+'.'+k);else near(a,v,2e-6,'floor'+i+'.'+k);}
 }
 const owned=copy(out.ownedBvh);assert.equal(owned.deferred_optimize_pending,false);delete owned.deferred_optimize_pending;assert.deepEqual(owned,row.state.broad_phase,'Entire source post-step BVH, not only topology');
 Empty.compare({...out,globalEdges:out.globalEdges??out.contactGraph.edges},{h:expected.h,row:{...row,application:projection.application}});
}
export {assert,near,comparePrepared};
