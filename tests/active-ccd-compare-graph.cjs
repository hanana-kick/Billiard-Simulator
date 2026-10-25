'use strict';
const assert=require('node:assert/strict'),F=require('./three-ball-scene-fixture.cjs'),Graph=require('./three-ball-contact-assertions.cjs'),Rails=require('./three-ball-cushion-assertions.cjs');
function compare(out,record,boundary,internalPasses){const raw=F.capture({takeSnapshot:()=>boundary.snapshot},record.roles),d=F.decode({post:raw},'post'),expected=Graph.inspect(raw,d),rails=Rails.inspect(record,d);let max=0,count=0;
 assert.deepEqual(out.globalEdges,expected.edges,'source complete dense graph');assert.deepEqual(out.contactGraph.adjacency,expected.adjacency,'source directional adjacency');assert.deepEqual(out.contactGraph.liveColliders,expected.liveColliders,'source live collider registry');assert.equal(out.contactGraph.sequence,internalPasses,'source collision-pass count, not application frame count');
 const own=[];
 // Immutable original fixed proxies are read from original created snapshot,
 // not copied from the expected future snapshot.
 const created=Graph.inspect(record.created,F.decode(record,'created'));for(const s of record.sceneRegistry.statics)own.push(created.proxies.find(p=>F.same(p.collider,s.collider.handle)));
 for(let i=0;i<3;i++)for(const collider of [record.objects[i].collider,record.objects[i].pairCollider])own.push({collider,...out.contactGraph.proxies[i]});own.push(...out.contactGraph.cueProxies);assert.equal(own.length,expected.proxies.length);
 function near(a,b,label){if(Array.isArray(b)){assert.equal(a.length,b.length,label);b.forEach((v,i)=>near(a[i],v,label+'['+i+']'));return;}const e=Math.abs(a-b);count++;max=Math.max(max,e);assert.ok(Number.isFinite(a)&&e<=2e-6*Math.max(1,Math.abs(b)),label+': '+a+' != '+b);}
 for(const p of own){const b=expected.proxies.find(x=>F.same(x.collider,p.collider));assert.ok(b);near(p.min,b.min,'fat min');near(p.max,b.max,'fat max');}
 const omitted=['recycleRelativeRotation','recycleRotation1','recycleRotation2','solverBodyIds','graphPos','tangentVelocity'];for(let i=0;i<3;i++)for(let j=0;j<rails[i].length;j++)for(const[k,b]of Object.entries(rails[i][j])){if(omitted.includes(k))continue;const a=out.cushions[i][j][k];if(['pairPresent','pointPresent','active','recycleValid','solverColor','feature1','feature2','contactId'].includes(k))assert.equal(a,b,'rail '+i+'/'+j+'.'+k);else near(a,b,'rail '+i+'/'+j+'.'+k);}
 return {completeDenseGraph:true,directionalAdjacency:true,liveColliderRegistry:true,allFatProxies:true,cushionCaches:true,comparisonValues:count,maxAbsoluteError:max,omittedUnrepresentedFields:omitted};}
module.exports={compare};
