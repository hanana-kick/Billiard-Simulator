'use strict';
// Read-only expected-snapshot projection and assertions. This helper never
// decodes a snapshot, runs native physics, or supplies state to an owned world.
// Supply an already decoded source graph, or the saved oracle's plain pairs.
const assert=require('node:assert/strict');
const D=require('../tools/rapier-snapshot-decoder/index.cjs');
const copy=x=>structuredClone(x),same=(a,b)=>!!a&&!!b&&a.index===b.index&&a.generation===b.generation;
const TOLERANCE=2e-6,U=0xffffffff;
const CACHE_VECTORS={recycleTranslation:['pos12','translation'],recycleRelativeRotation:['pos12','rotation'],recycleRotation1:['rot1'],recycleRotation2:['rot2']};
const CACHE_SCALARS={maxExtent:'max_extent',maxDrift:'max_drift'};
const target=p=>p?.collider1?.index===16&&p?.collider2?.index===24;
const involvesTarget=p=>target(p)||(p?.collider1?.index===24&&p?.collider2?.index===16);
function plain(n){
 if(!n)return null;
 switch(n.kind){
  case'float':return D.floatValue(n);
  case'integer':{const x=Number(n.value);assert.ok(Number.isSafeInteger(x),'Lossless source integer required');return x;}
  case'bool':return n.value;
  case'none':case'unit':case'unit_struct':return null;
  case'some':case'newtype_struct':return plain(n.value);
  case'newtype_variant':return{variant:n.variant,value:plain(n.value)};
  case'unit_variant':return n.variant;
  default:if(n.fields)return Object.fromEntries(n.fields.map(([k,v])=>[k,plain(v)]));if(n.items)return n.items.map(plain);if(n.entries)return n.entries.map(([k,v])=>[plain(k),plain(v)]);if('value'in n)return n.value;throw Error('Unknown decoded source node '+n.kind);
 }
}
function handle(h,label){assert.ok(h&&Number.isInteger(h.index)&&h.index>=0&&Number.isInteger(h.generation)&&h.generation>=0,label+' generation-bearing handle');assert.deepEqual(Object.keys(h).sort(),['generation','index'],label+' exact handle fields');}
function projectCache(state){
 assert.ok(state&&state.pos12,'Source ContactRecycleState required');const result={};
 for(const[k,path]of Object.entries(CACHE_VECTORS)){const a=path.reduce((x,p)=>x?.[p],state),length=k==='recycleTranslation'?3:4;assert.ok(Array.isArray(a)&&a.length===length&&a.every(Number.isFinite),'Source '+k);result[k]=copy(a);}
 for(const[k,native]of Object.entries(CACHE_SCALARS)){assert.ok(Number.isFinite(state[native]),'Source '+native);result[k]=state[native];}
 return result;
}
function rigidOf(pair){
 if(pair.rigid)return pair.rigid;
 if(pair.contacts){assert.equal(pair.contacts.variant,'Rigid','Expected rigid source cue pair');return pair.contacts.value;}
 return pair;
}
function sourcePair(pair,raw){
 assert.ok(target(pair),'Source pair order is sphere16 then neckCylinder24');handle(pair.collider1,'collider1');handle(pair.collider2,'collider2');
 const rigid=rigidOf(pair);assert.equal(rigid.manifolds?.length,1,'Exactly one original empty manifold');const m=rigid.manifolds[0],data=m.data;
 assert.deepEqual(m.points,[],'Original pair has no points');assert.deepEqual(data.solver_contacts,[],'Original pair has no solver contacts');
 assert.deepEqual(m.local_n1,[0,0,0]);assert.deepEqual(m.local_n2,[0,0,0]);assert.equal(m.subshape1,0);assert.equal(m.subshape2,0);assert.equal(m.subshape_poses,null);
 assert.deepEqual(data.normal,[0,0,0]);assert.equal(data.solver_flags,1);assert.equal(data.solver_color,255);assert.deepEqual(data.solver_body_ids,[U,U]);assert.equal(data.graph_pos,U);assert.equal(data.relative_dominance,0);assert.equal(data.user_data,0);
 assert.equal(data.friction,Math.fround(.3));assert.equal(data.restitution,Math.fround(.2));
 assert.deepEqual(rigid.solver_clusters,[]);assert.equal(rigid.solver_color,255);assert.deepEqual(rigid.solver_color_bodies,[U,U]);assert.equal(rigid.workspace,null);
 const body1=pair.body1??data.rigid_body1,body2=pair.body2??data.rigid_body2;handle(body1,'body1');handle(body2,'body2');assert.deepEqual(body1,data.rigid_body1);assert.deepEqual(body2,data.rigid_body2);assert.equal(body1.index,16);assert.equal(body2.index,20);
 const state=rigid.recycle_state;assert.ok(state,'Original empty pair must retain its cache');projectCache(state);assert.equal(state.pos12.padding,0);
 const expected={collider1:copy(pair.collider1),collider2:copy(pair.collider2),body1:copy(body1),body2:copy(body2),manifolds:copy(rigid.manifolds),solver_clusters:copy(rigid.solver_clusters),solver_color:rigid.solver_color,solver_color_bodies:copy(rigid.solver_color_bodies),workspace:null,recycle_state:copy(state),cache:projectCache(state)};
 if(raw){
  const c1=raw.colliders.find(c=>same(c.handle,pair.collider1)),c2=raw.colliders.find(c=>same(c.handle,pair.collider2));assert.ok(c1&&c2,'Source graph pair uses live collider generations');assert.deepEqual(c1.parent.handle,body1);assert.deepEqual(c2.parent.handle,body2);assert.equal(c1.shape.variant,'Ball');assert.equal(c2.shape.variant,'Cylinder');
  expected.shapeDimensions=[c1.shape.value.radius,c2.shape.value.radius,c2.shape.value.half_height];
 }
 return expected;
}
function fromPairs(raw,pairs){
 assert.ok(raw&&Array.isArray(raw.colliders),'Actual raw collider registry required');assert.ok(Array.isArray(pairs),'Already-decoded expected pair array required');
 const selected=pairs.filter(involvesTarget);assert.ok(selected.length<=1,'No duplicate native target pair');return selected.map(p=>sourcePair(p,raw));
}
function inspect(raw,decodedOrGraph){
 assert.ok(decodedOrGraph,'Supply an already decoded source observation; this helper never invokes the decoder');let graph;
 if(decodedOrGraph.state){assert.equal(decodedOrGraph.sourceRevision,D.SOURCE_REVISION);const field=D.field;graph=plain(field(field(field(decodedOrGraph.state,'narrow_phase'),'contact_graph'),'graph'));}
 else graph=decodedOrGraph.graph??decodedOrGraph;
 assert.ok(Array.isArray(graph.edges),'Already decoded source contact graph required');return fromPairs(raw,graph.edges.map(e=>e.weight));
}
function compare(out,expectedPairs){
 assert.ok(Array.isArray(expectedPairs),'Expected native pair array required');const source=expectedPairs.filter(involvesTarget);assert.ok(source.length<=1,'One native sphere/neck pair at most');
 const expected=source.map(p=>sourcePair(p)),actual=Array.isArray(out)?out:(out.emptyCuePairs??[]);assert.ok(Array.isArray(actual),'Optional owner emptyCuePairs must be an array');assert.equal(actual.length,expected.length,'Empty cue pair cache birth/removal must match source graph exactly');
 if(!Array.isArray(out)){
  if(out.cue?.present===false)assert.equal(actual.length,0,'No stale empty cue pairs after cue removal');
  if(Array.isArray(out.globalEdges)){const edges=out.globalEdges.filter(involvesTarget);assert.equal(edges.length,expected.length,'Empty-cache ownership must follow actual source topology');for(let i=0;i<edges.length;i++){for(const k of['collider1','collider2','body1','body2'])assert.deepEqual(edges[i][k],expected[i][k],'Owned graph '+k);assert.equal(edges[i].active,false,'Empty cue edge cannot become an active contact');}}
 }
 let maxError=0;
 const close=(a,b,label)=>{if(Array.isArray(b)){assert.ok(Array.isArray(a),label+' array');assert.equal(a.length,b.length,label+' length');b.forEach((value,i)=>close(a[i],value,label+'['+i+']'));return;}assert.equal(typeof a,'number',label+' numeric');assert.ok(Number.isFinite(a)&&Number.isFinite(b),label+' finite');const error=Math.abs(a-b);maxError=Math.max(maxError,error);assert.ok(error<=TOLERANCE,label+': '+a+' versus '+b+' ('+error+')');};
 const cache=(a,b,label)=>{assert.ok(a,label+' cache required');for(const k of Object.keys(b))close(a[k],b[k],label+'.'+k);};
 for(let i=0;i<expected.length;i++){
  const want=expected[i],got=actual[i],prefix='emptyCuePairs['+i+']';
  assert.ok(got,prefix);for(const k of['collider1','collider2','body1','body2'])assert.deepEqual(got[k],want[k],prefix+'.'+k);
  assert.deepEqual(Object.keys(got).sort(),Object.keys(want).sort(),prefix+' exact native rigid shape plus owner cache');
  for(const k of['solver_clusters','solver_color','solver_color_bodies','workspace'])assert.deepEqual(got[k],want[k],prefix+'.'+k);
  assert.equal(got.manifolds?.length,1,prefix+' manifold count');const m=got.manifolds[0],native=want.manifolds[0];
  assert.deepEqual(Object.keys(m).sort(),Object.keys(native).sort(),prefix+' exact native manifold shape');
  for(const k of['points','local_n1','local_n2','subshape1','subshape2','subshape_poses','data'])assert.deepEqual(m[k],native[k],prefix+'.manifold.'+k);
  const state=got.recycle_state;assert.ok(state,prefix+' pair-level source recycle_state required');
  assert.deepEqual(Object.keys(state).sort(),Object.keys(want.recycle_state).sort(),prefix+' exact source cache shape');assert.deepEqual(Object.keys(state.pos12).sort(),Object.keys(want.recycle_state.pos12).sort(),prefix+' exact source relative pose shape');
  assert.equal(state.pos12.padding,0,prefix+'.pos12.padding');cache(projectCache(state),want.cache,prefix+'.recycle_state');
  cache(got.cache,want.cache,prefix+'.cache');
  const shapeDimensions=source[i].shapeDimensions;if(shapeDimensions)assert.deepEqual(got.cache.shapeDimensions,shapeDimensions,prefix+'.cache.shapeDimensions');
 }
 return maxError;
}
module.exports={TOLERANCE,projectCache,fromPairs,inspect,compare};
