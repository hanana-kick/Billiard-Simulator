'use strict';
// Independent assertions only. No native execution and no candidate seed input.
const assert=require('node:assert/strict'),F=require('./three-ball-scene-fixture.cjs');
const copy=x=>structuredClone(x),TOLERANCE=2e-6;
const target=(raw,p)=>raw.colliders.find(c=>F.same(c.handle,p.collider1))?.shape.variant==='ConvexPolyhedron'&&raw.colliders.find(c=>F.same(c.handle,p.collider2))?.shape.variant==='Cylinder';
function fromPairs(raw,pairs){return pairs.filter(p=>target(raw,p)).map(p=>{
 const rigid=p.rigid??p.contacts?.value;assert.ok(rigid);assert.equal(rigid.manifolds.length,1);const m=rigid.manifolds[0];assert.deepEqual(m.points,[]);assert.deepEqual(m.data.solver_contacts,[]);assert.equal(rigid.workspace,null);
 const a=raw.colliders.find(c=>F.same(c.handle,p.collider1)),b=raw.colliders.find(c=>F.same(c.handle,p.collider2));assert.equal(a.shape.variant,'ConvexPolyhedron');assert.equal(b.shape.variant,'Cylinder');
 return{collider1:copy(p.collider1),collider2:copy(p.collider2),body1:copy(a.parent.handle),body2:copy(b.parent.handle),...copy(rigid)};
});}
function inspect(raw,decodedOrGraph){assert.ok(decodedOrGraph,'Already decoded source observation required');const field=F.D.field,graph=decodedOrGraph.state?F.plain(field(field(field(decodedOrGraph.state,'narrow_phase'),'contact_graph'),'graph')):decodedOrGraph.graph??decodedOrGraph;return fromPairs(raw,graph.edges.map(e=>e.weight));}
function compare(out,expected){const actual=out.emptyCueConvexPairs??[];assert.equal(actual.length,expected.length,'Exact convex empty-pair birth/removal');let max=0;
 const close=(a,b,label)=>{if(Array.isArray(b)){assert.ok(Array.isArray(a),label);assert.equal(a.length,b.length,label);b.forEach((x,i)=>close(a[i],x,label+'['+i+']'));return;}const e=Math.abs(a-b);assert.ok(Number.isFinite(a)&&e<=TOLERANCE,label+': '+a+' vs '+b);max=Math.max(max,e);};
 if(out.cue?.present===false)assert.equal(actual.length,0,'No convex cache after cue withdrawal');
 for(let i=0;i<expected.length;i++){const a=actual[i],b=expected[i],edge=out.globalEdges.find(e=>F.same(e.collider1,b.collider1)&&F.same(e.collider2,b.collider2));assert.ok(edge);assert.equal(edge.active,false);for(const k of['collider1','collider2','body1','body2']){assert.deepEqual(a[k],b[k]);assert.deepEqual(edge[k],b[k]);}
  assert.deepEqual(Object.keys(a).filter(k=>k!=='cache').sort(),Object.keys(b).sort(),'Exact native convex rigid cache layout');
  for(const k of['solver_clusters','solver_color','solver_color_bodies','workspace'])assert.deepEqual(a[k],b[k]);assert.equal(a.manifolds.length,1);const am=a.manifolds[0],bm=b.manifolds[0];assert.deepEqual(Object.keys(am).sort(),Object.keys(bm).sort());
  for(const k of['points','local_n2','subshape1','subshape2','subshape_poses'])assert.deepEqual(am[k],bm[k]);close(am.local_n1,bm.local_n1,'local_n1');assert.deepEqual(Object.keys(am.data).sort(),Object.keys(bm.data).sort());
  for(const k of Object.keys(bm.data))if(['normal','friction','restitution'].includes(k))close(am.data[k],bm.data[k],'data.'+k);else assert.deepEqual(am.data[k],bm.data[k],'data.'+k);
  const ar=a.recycle_state,br=b.recycle_state;assert.deepEqual(Object.keys(ar).sort(),Object.keys(br).sort());assert.deepEqual(Object.keys(ar.pos12).sort(),Object.keys(br.pos12).sort());assert.equal(ar.pos12.padding,br.pos12.padding);
  for(const k of['translation','rotation'])close(ar.pos12[k],br.pos12[k],'pos12.'+k);for(const k of['rot1','rot2','max_extent','max_drift'])close(ar[k],br[k],k);
  for(const[k,want]of Object.entries({recycleTranslation:br.pos12.translation,recycleRelativeRotation:br.pos12.rotation,recycleRotation1:br.rot1,recycleRotation2:br.rot2,maxExtent:br.max_extent,maxDrift:br.max_drift,localNormal1:bm.local_n1,localNormal2:bm.local_n2,worldNormal:bm.data.normal}))close(a.cache[k],want,'numericCache.'+k);
 }
 return max;
}
module.exports={TOLERANCE,fromPairs,inspect,compare};
