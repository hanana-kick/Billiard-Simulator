'use strict';
// ASSERTION ONLY. This module reads captured original state and compares it to
// a candidate snapshot. It imports no runtime cache/seed exporter/physics code,
// never restores or steps a world, and cannot supply a candidate initial state.
// Resolve endpoint generations from the initial seed, not the future row's cue:
// row.application.cue is null after source collider withdrawal.
const SOURCE_REVISION='b716d375efc0201003f0cd9ef7168eee0b62c177';
const EXISTENCE=Object.freeze(['pairPresent','manifoldPresent','pointPresent','active','recycleValid']);
const MANIFOLD=Object.freeze(['normal','localN1','localN2','friction','restitution','relativeDominance','solverFlags']);
const POINT=Object.freeze(['localP1','localP2','feature1','feature2','contactDistance','dp1','dp2','impulse','warmImpulse','warmWorld','warmTangent','tangentImpulse','warmTwist']);
const SOLVER=Object.freeze(['anchor1','anchor2','contactId','tangentVelocity']);
const RECYCLE=Object.freeze(['recycleTranslation','recycleRotation','recycleRotation1','recycleRotation2','maxExtent','maxDrift']);
const EXACT=new Set([...EXISTENCE,'relativeDominance','solverFlags','feature1','feature2','contactId']);
const VECTORS=Object.freeze({normal:3,localN1:3,localN2:3,localP1:3,localP2:3,dp1:3,dp2:3,warmWorld:3,warmTangent:2,tangentImpulse:2,anchor1:3,anchor2:3,tangentVelocity:3,recycleTranslation:3,recycleRotation:4,recycleRotation1:4,recycleRotation2:4});
const copy=x=>structuredClone(x),same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation;
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function bind(assert){
 assert.ok(assert&&typeof assert.equal==='function'&&typeof assert.deepEqual==='function'&&typeof assert.ok==='function','Assertion library required');
 function handle(value,label){assert.ok(value&&Number.isInteger(value.index)&&value.index>=0&&value.index<4294967295&&Number.isInteger(value.generation)&&value.generation>=0&&value.generation<4294967295,label+' must retain source generation');return copy(value);}
 function identities(seed){
  const broad=seed?.cueBroadSeed;assert.ok(broad&&Array.isArray(broad.colliders)&&broad.roles,'Initial world seed cueBroadSeed required');
  assert.match(seed.initialSnapshotSha256,/^[a-f0-9]{64}$/,'Original initial source snapshot identity');
  const sourceFloor=broad.colliders.find(c=>same(c.handle,seed.pairSeed?.floorCollider));
  const floorBody=handle(broad.roles.floor??sourceFloor?.parent?.handle,'seed floor body'),tipBody=handle(broad.roles.head,'seed cue head');
  const floors=broad.colliders.filter(c=>same(c.parent?.handle,floorBody)&&c.bodyType==='Fixed'&&c.shape?.variant==='Cuboid');
  const tips=broad.colliders.filter(c=>same(c.parent?.handle,tipBody)&&c.bodyType==='Dynamic'&&c.shape?.variant==='Ball'&&(c.flags?.collision_groups?.memberships&16)!==0);
  assert.equal(floors.length,1,'Unique original cloth cuboid in fixed seed');assert.equal(tips.length,1,'Unique original tip sphere in fixed seed');
  const collider1=handle(floors[0].handle,'seed cloth collider'),collider2=handle(tips[0].handle,'seed tip collider');assert.ok(collider1.index<collider2.index,'Pinned source canonical cuboid-first order');
  if(seed.pairSeed?.floorCollider)assert.deepEqual(collider1,seed.pairSeed.floorCollider,'Same cloth used by source ball roster');
  return{initialSnapshotSha256:seed.initialSnapshotSha256,collider1,collider2,body1:floorBody,body2:tipBody};
 }
 function fields(flags){return [...EXISTENCE,...(flags.manifoldPresent?MANIFOLD:[]),...(flags.pointPresent?POINT:[]),...(flags.active?SOLVER:[]),...(flags.recycleValid?RECYCLE:[])];}
 function topology(cache,label){for(const key of EXISTENCE)assert.equal(typeof cache[key],'boolean',label+'.'+key);assert.ok((!cache.manifoldPresent||cache.pairPresent)&&(!cache.pointPresent||cache.manifoldPresent)&&(!cache.active||cache.pointPresent)&&(!cache.recycleValid||cache.manifoldPresent),label+' native existence relationships');}
 function numeric(value,label,length){if(length!==undefined){assert.ok(Array.isArray(value),label+' source vector required');assert.equal(value.length,length,label+' source vector length');value.forEach((v,i)=>numeric(v,label+'['+i+']'));}else assert.ok(typeof value==='number'&&Number.isFinite(value),label+' source finite number required');}
 function project(row,seed){
  assert.equal(row?.candidateInput,false,'Future contact state is expected-only, never candidate input');assert.equal(row.sourceRevision,SOURCE_REVISION,'Pinned original source revision');assert.match(row.snapshotSha256,/^[a-f0-9]{64}$/,'Expected native boundary hash');
  const source={...identities(seed),sourceRevision:row.sourceRevision,snapshotSha256:row.snapshotSha256,h:row.hCount,boundary:row.boundary};assert.ok(Array.isArray(row.contactPairs),'Captured original contact pairs required');
  const matches=row.contactPairs.filter(p=>same(p.collider1,source.collider1)&&same(p.collider2,source.collider2));assert.ok(matches.length<=1,'At most one original cloth-tip pair');assert.ok(!row.contactPairs.some(p=>same(p.collider1,source.collider2)&&same(p.collider2,source.collider1)),'No reversed original cloth-tip pair');
  const pair=matches[0];let rigid,m,point,solver,recycle;
  if(pair){assert.equal(pair.contacts?.variant,'Rigid','Original rigid cloth-tip pair');rigid=pair.contacts.value;assert.ok(Array.isArray(rigid.manifolds),'Original manifold list required');assert.ok(rigid.manifolds.length<=1,'Single noncomposite manifold');m=rigid.manifolds[0];recycle=rigid.recycle_state;if(m){assert.ok(Array.isArray(m.points)&&m.points.length<=1,'At most one convex-ball point');assert.ok(Array.isArray(m.data.solver_contacts)&&m.data.solver_contacts.length<=1,'At most one source solver point');point=m.points[0];solver=m.data.solver_contacts[0];assert.deepEqual(m.data.rigid_body1,source.body1,'Original fixed endpoint');assert.deepEqual(m.data.rigid_body2,source.body2,'Original tip endpoint');}}
  const out={candidateInput:false,source,pairPresent:!!pair,manifoldPresent:!!m,pointPresent:!!point,active:!!solver,recycleValid:!!recycle};topology(out,'expected cue cloth');
  if(m)Object.assign(out,{normal:copy(m.data.normal),localN1:copy(m.local_n1),localN2:copy(m.local_n2),friction:m.data.friction,restitution:m.data.restitution,relativeDominance:m.data.relative_dominance,solverFlags:m.data.solver_flags});
  if(point){const d=point.data;Object.assign(out,{localP1:copy(point.local_p1),localP2:copy(point.local_p2),feature1:point.fid1,feature2:point.fid2,contactDistance:point.dist,dp1:copy(d.solver_dp1),dp2:copy(d.solver_dp2),impulse:d.impulse,warmImpulse:d.warmstart_impulse,warmWorld:copy(d.warmstart_tangent_world),warmTangent:copy(d.warmstart_tangent_impulse),tangentImpulse:copy(d.tangent_impulse),warmTwist:d.warmstart_twist_impulse});}
  if(solver){assert.ok(Array.isArray(solver.contact_id));assert.equal(solver.contact_id.length,1,'Source singleton contact id');Object.assign(out,{anchor1:copy(solver.anchor1),anchor2:copy(solver.anchor2),contactId:solver.contact_id[0],tangentVelocity:copy(solver.tangent_velocity)});}
  if(recycle)Object.assign(out,{recycleTranslation:copy(recycle.pos12.translation),recycleRotation:copy(recycle.pos12.rotation),recycleRotation1:copy(recycle.rot1),recycleRotation2:copy(recycle.rot2),maxExtent:recycle.max_extent,maxDrift:recycle.max_drift});
  for(const key of fields(out).filter(k=>!EXISTENCE.includes(k))){numeric(out[key],key,VECTORS[key]);if(EXACT.has(key))assert.ok(Number.isInteger(out[key]),key+' exact source integer');}
  return freeze(out);
 }
 function compare(actual,expected,{tolerance=2e-6,label='cueCloth',stats}={}){
  assert.ok(actual&&typeof actual==='object',label+' public cache snapshot required');assert.equal(expected?.candidateInput,false,'Only expected-only native projection may be compared');topology(expected,'expected cue cloth');
  assert.ok(Number.isFinite(tolerance)&&tolerance>=0,'Explicit nonnegative absolute cache tolerance');
  const names=fields(expected);assert.deepEqual(Object.keys(expected).filter(k=>k!=='source'&&k!=='candidateInput').sort(),names.slice().sort(),'Expected projection contains only native-owned conditional fields');
  const result={nativeFieldsCompared:names.length,exactFieldsCompared:0,numericScalarsCompared:0,maxAbsoluteError:0,signedZeroDifferences:0};
  function close(a,b,path){if(Array.isArray(b)){assert.ok(Array.isArray(a),path+' array');assert.equal(a.length,b.length,path+' length');b.forEach((v,i)=>close(a[i],v,path+'['+i+']'));return;}assert.ok(typeof a==='number'&&Number.isFinite(a)&&typeof b==='number'&&Number.isFinite(b),path+' finite');const delta=Math.abs(a-b);result.numericScalarsCompared++;result.maxAbsoluteError=Math.max(result.maxAbsoluteError,delta);if(a===0&&b===0&&!Object.is(a,b))result.signedZeroDifferences++;assert.ok(delta<=tolerance,path+': '+a+' != '+b+' (error '+delta+', tolerance '+tolerance+')');}
  for(const key of names){if(EXACT.has(key)){assert.equal(actual[key],expected[key],label+'.'+key);result.exactFieldsCompared++;}else close(actual[key],expected[key],label+'.'+key);}
  if(stats){assert.ok(typeof stats==='object','Mutable comparison statistics required');stats.maxAbsolute=Math.max(stats.maxAbsolute??0,result.maxAbsoluteError);}
  return result;
 }
 return Object.freeze({SOURCE_REVISION,EXISTENCE,MANIFOLD,POINT,SOLVER,RECYCLE,identities,project,compare});
}
module.exports=Object.freeze({...bind(require('node:assert/strict')),bind});
