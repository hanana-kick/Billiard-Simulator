import test from 'node:test';
import assert from 'node:assert/strict';
import {pairTOI} from '../src/direct-candidate/event-core.mjs';
import {nextUp,nextDown,sweptSphereBounds,canCullPair,pairTOIWithCulling} from '../src/direct-candidate/conservative-pair-cull.mjs';
const ball=(x,y,vx=0,vy=0,r=.1)=>({p:[x,y],v:[vx,vy],r});
const s=(x=0,y=0)=>({a:[x,y]});
function same(a,b,sa,sb,h,counters={}){assert.deepEqual(pairTOIWithCulling(a,b,sa,sb,h,counters,pairTOI),pairTOI(a,b,sa,sb,h));return counters;}
test('adjacent floats round outward including signs, zeros and subnormals',()=>{
 assert.ok(nextUp(1)>1);assert.ok(nextDown(1)<1);assert.equal(nextUp(-Number.MIN_VALUE),-0);
 assert.equal(nextDown(0),-Number.MIN_VALUE);assert.equal(nextUp(0),Number.MIN_VALUE);
 assert.equal(nextUp(Infinity),Infinity);assert.equal(nextDown(-Infinity),-Infinity);
});
test('Bernstein bounds enclose negative acceleration interior extremum, not only endpoints',()=>{
 const b=ball(0,0,4,0),seg=s(-8,0),bounds=sweptSphereBounds(b,seg,1);
 assert.ok(bounds[0][1]>=1.1);
 for(let i=0;i<=100;i++){const t=i/100,x=4*t-4*t*t;assert.ok(bounds[0][0]<=x-.1&&bounds[0][1]>=x+.1);}
 // Coincident endpoints conceal an interior hit.
 const other=ball(1,0);same(b,other,seg,s(),1);assert.equal(canCullPair(b,other,seg,s(),1),false);
});
test('crossing moving balls and grazing/near-boundary diagnostics stay unchanged',()=>{
 const cases=[
  [ball(0,0,1),ball(2,0,-1),s(),s(),2],
  [ball(0,0,1),ball(1,.2),s(),s(),2],
  [ball(0,0,1),ball(1,nextUp(.2)),s(),s(),2],
  [ball(0,0),ball(nextUp(.2),0),s(),s(),1],
  [ball(0,0,2),ball(2,0),s(-1),s(),2],
 ];
 for(const args of cases){same(...args);assert.equal(canCullPair(...args),false);}
});
test('separated trajectories skip quartic calls without mutating inputs',()=>{
 const a=ball(0,0,1),b=ball(0,10,-1),sa=s(),sb=s(),before=structuredClone([a,b,sa,sb]),counts={};
 same(a,b,sa,sb,1,counts);assert.deepEqual(counts,{pairQueries:1,pairRootCulls:1});
 assert.deepEqual([a,b,sa,sb],before);same(b,a,sb,sa,1);
});
test('nonfinite and overflow fail open, retaining baseline error rather than false no-hit',()=>{
 const a=ball(0,0,1e300),b=ball(2,10,-1e300);
 assert.equal(canCullPair(a,b,s(),s(),1),false);
 assert.throws(()=>pairTOIWithCulling(a,b,s(),s(),1,{},pairTOI),/nonfinite/);
 // Finite distance coefficients can still overflow inside derivative isolation.
 const fast=s(2e154,0),still=ball(0,10);
 assert.equal(canCullPair(ball(0,0),still,s(),fast,1e-155),false);
 assert.throws(()=>pairTOIWithCulling(ball(0,0),still,s(),fast,1e-155,{},pairTOI),/nonfinite/);
 assert.equal(sweptSphereBounds(ball(0,0),s(),Infinity),null);
 assert.equal(canCullPair(ball(0,0),ball(2,10),s(),s(),-1),false);
});
test('deterministic varied translating/accelerating pairs preserve baseline outcomes and reduce solves',()=>{
 let seed=1234567;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
 const counts={};for(let i=0;i<300;i++){
  const a=ball(rand()*4,rand()*4,rand()*4-2,rand()*4-2),b=ball(rand()*4,rand()*4,rand()*4-2,rand()*4-2);
  const sa=s(rand()*4-2,rand()*4-2),sb=s(rand()*4-2,rand()*4-2),h=.01+rand()*2;
  same(a,b,sa,sb,h,counts);same(b,a,sb,sa,h);
 }
 assert.equal(counts.pairQueries,300);assert.ok(counts.pairRootCulls>0);assert.ok(counts.pairRootSolves>0);
 assert.equal(counts.pairRootSolves+counts.pairRootCulls,300);
});
