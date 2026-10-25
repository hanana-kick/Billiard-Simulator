'use strict';
// Pure production-helper control flow. Native whole-shot tests supply the
// independent numerical and actual local-split regression, not these mocks.
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module');
const h=index=>({index,generation:0}),copy=x=>structuredClone(x);
async function check(count){const file=require.resolve('../src/experimental-'+(count===3?'three':'four')+'-ball-world'),m=new Module(file,module);m.filename=file;m.paths=module.paths;m.require=Module.createRequire(file);m._compile(fs.readFileSync(file,'utf8').replace('const api=Object.freeze({CAPABILITY,validate,','const api=Object.freeze({prepareSharedContacts,CAPABILITY,validate,'),file);
 const balls=Array.from({length:count},(_,i)=>({body:h(16+i),collider:h(16+2*i),pairCollider:h(17+2*i),state:{translation:[i,0,0],sleeping:false,topology:{pairPresent:true,active:true,ballMin:[i,0,0],ballMax:[i+1,1,1]}}})),edges=balls.map(b=>({collider1:h(0),collider2:b.collider,body1:h(0),body2:b.body,active:true}));
 const live=[h(0),...balls.flatMap(b=>[b.collider,b.pairCollider])],cue=[h(16+2*count),h(17+2*count),h(18+2*count)],colliders=[{handle:h(0),body:h(0)},...balls.flatMap(b=>[{handle:b.collider,body:b.body},{handle:b.pairCollider,body:b.body}]),...cue.map((handle,i)=>({handle,body:h(20+i%2)}))];
 const graph={edges:copy(edges),proxies:balls.map(b=>({min:b.state.topology.ballMin,max:b.state.topology.ballMax})),liveColliders:live,adjacency:live.map(collider=>({collider,outgoing:[],incoming:[]}))};
 const seed={balls,pairSeed:{floorCollider:h(0)},cushionSeeds:balls.map(b=>({ballCollider:b.collider,cushions:[]})),bodyColliders:balls.map(b=>({body:b.body,colliders:[b.collider,b.pairCollider]})),contactGraphSeed:{cueColliders:cue,colliders}};
 const stages={journal:{prepare:async()=>({graph}),narrowTransitions:()=>({after:copy(graph),operations:[],contactEvents:[]})},pairBindings:[],cushion:balls.map(()=>({snapshot:()=>({cushions:[]})})),floor:balls.map(()=>({prepare:async state=>({state:copy(state)})}))};
 const next={balls:copy(balls),globalEdges:copy(edges),frame:1};const out=await m.exports.prepareSharedContacts(seed,stages,next,balls.map(b=>b.state),{},Array(count).fill(false));
 assert.deepEqual(out.connectivity.colliders,colliders.filter(c=>live.some(h=>h.index===c.handle.index)),'Filter only retired endpoints, preserve original registry order');assert.equal(out.connectivity.colliders.some(c=>cue.some(h=>h.index===c.handle.index)),false);assert.deepEqual(out.connectivity.bodyColliders,seed.bodyColliders);
}
test('N3 actual connectivity helper excludes retired cue parents before local split',()=>check(3));
test('N4 actual connectivity helper excludes retired cue parents before local split',()=>check(4));
test('official no-cue Journal projection owns immutable complete collider membership',async()=>{
 const J=require('../src/experimental-contact-graph-journal'),f=Math.fround;
 const fixed=Array.from({length:16},(_,i)=>({handle:h(i),body:h(i),type:'Fixed',groups:(2<<16)|21,enabled:true,sensor:false,activeCollisionTypes:15,contactSkin:0,parentLocalIdentity:true,min:i?[10+i,0,0]:[-2,-1,-2],max:i?[11+i,1,1]:[2,.1,2]}));fixed[0].max[1]=f(.1);
 const bodies=Array.from({length:3},(_,i)=>({body:h(16+i),primary:h(16+2*i),pair:h(17+2*i),radius:f(.03075),softCcdPrediction:0,min:[f(i-1-.04),f(-.04),f(-.04)],max:[f(i-1+.04),f(.04),f(.04)]}));
 const colliders=[...fixed,...bodies.flatMap(b=>[[b.primary,(1<<16)|6],[b.pair,(8<<16)|8]].map(([handle,groups])=>({handle,body:b.body,type:'Dynamic',groups,enabled:true,sensor:false,activeCollisionTypes:15,contactSkin:0,parentLocalIdentity:true})))];
 const edges=bodies.map(b=>({collider1:h(0),collider2:b.primary,body1:h(0),body2:b.body,active:true})),adjacency=colliders.map(c=>({collider:c.handle,outgoing:edges.flatMap((e,i)=>e.collider1.index===c.handle.index?[i]:[]),incoming:edges.flatMap((e,i)=>e.collider2.index===c.handle.index?[i]:[])}));
 const seed={kind:'original-three-ball-contact-graph',adaptiveChangeDetectionMargin:false,lengthUnit:f(.0615),normalizedPredictionDistance:f(.001),colliders,bodies,edges,adjacency},j=J.createReferenceStage(seed),token={};j.claim(token);
 try{const projection=j.createProjection(token),members=colliders.map(c=>c.handle);assert.deepEqual(J.projectionSnapshot(projection,'cpu-reference').liveColliders,members);const poses=bodies.map((b,i)=>({body:b.body,translation:[i-1,0,0]})),p=await j.prepare(poses,token);j.narrowTransitions([],token);await j.postSolve(poses,token);j.commit(token);assert.deepEqual(j.snapshot().liveColliders,members);assert.deepEqual(J.projectReceipts([p.receipt],projection,'cpu-reference').state.liveColliders,members);}finally{j.abort(token);j.release(token);j.dispose();}
});
