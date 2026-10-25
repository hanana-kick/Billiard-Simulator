'use strict';
// Bounded arithmetic/graph unit tests only. Synthetic controlled inputs do not
// establish native Rapier parity, GPU execution or elapsed-zero N=4 admission.
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),crypto=require('node:crypto');
const J=require('../src/experimental-contact-graph-journal'),A=require('../src/experimental-arithmetic-graph'),F=require('./contact-graph-bounded-fixture.cjs');
const{f,copy,same,seed,poses,at,sourceFat,pair}=F;
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function tracedJournal(){
 const file=require.resolve('../src/experimental-contact-graph-journal'),m=new Module(file,module),read=Module.createRequire(file),calls=[];
 m.require=name=>name==='./experimental-arithmetic-graph'?{...A,execute(input,plan){const output=A.execute(input,plan);calls.push({input:Array.from(input),plan:copy(plan),output:Array.from(output)});return output;}}:read(name);
 m._compile(fs.readFileSync(file,'utf8'),file);return{J:m.exports,calls};
}
function own(j){const token={};j.claim(token);return{token,close(){j.abort(token);j.release(token);j.dispose();}};}
async function seal(j,token,p,transitions=[]){const broad=await j.prepare(p,token);j.narrowTransitions(typeof transitions==='function'?transitions(broad):transitions,token);await j.postSolve(p,token);j.assertPrepared(token);return broad;}
function assertAdjacency(s){for(const a of s.adjacency)for(const[side,field]of[['outgoing','collider1'],['incoming','collider2']]){assert.equal(a[side].length,s.edges.filter(e=>same(e[field],a.collider)).length);for(const i of a[side])assert.ok(same(s.edges[i][field],a.collider));}}

test('one bounded layout derives every input and pair-output offset for N=3 and N=4',()=>{
 for(const[n,fixed,param,pairBase,total]of[[3,30,126,18,128],[4,40,136,24,138]]){
  const l=J.arithmeticLayout(n);assert.equal(Object.isFrozen(l),true);
  assert.deepEqual(l,{bodyCount:n,bodyInputStride:10,bodyOutputStride:6,fixedColliderCount:16,fixedInputStride:6,fixedInputOffset:fixed,lengthUnitOffset:param,normalizedPredictionDistanceOffset:param+1,inputFloats:total,pairOutputOffset:pairBase});
 }
 for(const n of[0,1,2,5,3.5,'4',null,undefined,NaN,Infinity])assert.throws(()=>J.arithmeticLayout(n),/Only bounded/);
});

test('N=3 packed inputs, arithmetic instruction order, outputs and pair order match 827dc29 exactly',async()=>{
 const traced=tracedJournal(),s=seed(3),j=traced.J.createReferenceStage(s),o=own(j);
 try{await j.prepare(at(s,{0:1.25}),o.token);j.narrowTransitions([],o.token);await j.postSolve(at(s,{0:1.3,2:20.5}),o.token);
  // Goldens were captured from the unmodified Journal at commit 827dc29.
  const expected=[
   ['ceb5ad74c2f2259c4d5f77e6652ffa4b7c2e34c1d6649cbe7d08d46275508e23','2afa33c3f7b991991257cfabba90bfb47be325698577a0053fd6bfbd0e9ce076'],
   ['ac76677c2f1bc628c6be0f2735ff8f5f429deb3e975a098e3239fc26d4a4f41e','3c8f76666763a2b2ab023465c12f89d35b5e0b714b399eb67f2652408f407fc2']
  ];assert.equal(traced.calls.length,2);
  traced.calls.forEach((c,i)=>{const{inputFloats,nodes,outputs,pairs}=c.plan;assert.equal(hash(c.input),expected[i][0]);assert.equal(hash({inputFloats,nodes,outputs,pairs}),'72c5092ac7cc661d4ce1060922f721b873c409fc4b660e17f4d97c9af180d788');assert.equal(hash(c.output),expected[i][1]);assert.equal(nodes.length,726);assert.equal(pairs.length,51);assert.equal(outputs.length,69);});
 }finally{o.close();}
});

test('prepared N=4 uses all four body inputs, sixteen immutable fixed boxes and both margin parameters',async()=>{
 const traced=tracedJournal(),s=seed(),j=traced.J.createReferenceStage(s),o=own(j),p=at(s,{0:1.25,1:11.5,2:21.75,3:32});
 try{const r=await j.prepare(p.toReversed(),o.token),c=traced.calls[0];
  assert.equal(c.input.length,138);assert.equal(c.plan.inputFloats,138);assert.equal(c.plan.pairs.length,70);assert.equal(c.output.length,94);
  for(let i=0;i<4;i++){assert.deepEqual(c.input.slice(i*10,i*10+10),[...p[i].translation,s.bodies[i].radius,...s.bodies[i].min,...s.bodies[i].max]);assert.deepEqual(r.graph.proxies[i],sourceFat(s,s.bodies[i],s.bodies[i],p[i].translation));}
  s.colliders.filter(c=>c.type==='Fixed').forEach((b,i)=>assert.deepEqual(c.input.slice(40+i*6,46+i*6),[...b.min,...b.max]));assert.equal(c.input[136],s.lengthUnit);assert.equal(c.input[137],s.normalizedPredictionDistance);assert.equal(r.graph.edges.length,0);
  j.narrowTransitions([],o.token);const post=at(s,{0:1.3,1:11.51,2:21.75,3:32.5}),after=await j.postSolve(post,o.token);
  for(let i=0;i<4;i++)assert.deepEqual(after.proxies[i],sourceFat(s,s.bodies[i],r.graph.proxies[i],post[i].translation));
 }finally{o.close();}
});

test('N=4 fourth-body fixed overlap reads the derived static and pair-output offsets',async()=>{
 const s=seed(),j=J.createReferenceStage(s),o=own(j);
 try{const r=await j.prepare(at(s,{3:1150}),o.token);assert.equal(r.broadPhaseEvents.length,1);const e=r.broadPhaseEvents[0];assert.equal(e.kind,'AddPair');assert.deepEqual(e.collider1,s.colliders[15].handle);assert.deepEqual(e.collider2,s.bodies[3].primary);assert.deepEqual(r.graph.lifetimes,[1]);assertAdjacency(r.graph);}finally{o.close();}
});

test('N=4 body and collider order do not replace exact generation-bearing canonical identities',async()=>{
 const s=seed();s.bodies.reverse();s.colliders.reverse();s.adjacency.reverse();const j=J.createReferenceStage(s),o=own(j),p=s.bodies.map(b=>({body:copy(b.body),translation:[f((b.body.index-80)*10),0,0]}));p.find(x=>x.body.index===83).translation[0]=f(.25);
 try{const r=await j.prepare(p,o.token);assert.equal(r.broadPhaseEvents.length,1);const e=r.graph.edges[0];assert.equal(e.collider1.index,17);assert.equal(e.collider2.index,23);assert.deepEqual(e.collider1,s.bodies.find(b=>b.body.index===80).pair);assert.deepEqual(e.collider2,s.bodies.find(b=>b.body.index===83).pair);assert.equal(r.graph.proxies.length,4);assertAdjacency(r.graph);}finally{o.close();}
});

test('N=4 append, prepend adjacency, dense swap-remove, active deletion and rebirth retain source lifetime semantics',async()=>{
 const s=seed(),j=J.createReferenceStage(s),o=own(j),initial=j.createProjection(o.token);let projection=initial;
 async function advance(p,transitions=[]){const r=await seal(j,o.token,p,transitions);projection=J.projectReceipts([r.receipt],projection,'cpu-reference').projection;j.commit(o.token);assertAdjacency(j.snapshot());return r;}
 try{const born=await advance(at(s,{3:.25}),r=>[{collider1:r.graph.edges[0].collider1,collider2:r.graph.edges[0].collider2,active:true}]);assert.deepEqual(j.snapshot().lifetimes,[1]);
  await advance(at(s,{2:.4,3:.25}));assert.deepEqual(j.snapshot().lifetimes,[1,2]);assert.deepEqual(j.snapshot().adjacency.find(a=>same(a.collider,s.bodies[3].pair)).incoming,[1,0]);
  const removed=await advance(at(s,{0:-10,2:.4,3:.25})),v=J.viewReceipt(removed.receipt),state=j.snapshot();assert.deepEqual(state.edges,[pair(s,2,3)]);assert.deepEqual(state.lifetimes,[2]);assert.deepEqual(state.adjacency.find(a=>same(a.collider,s.bodies[3].pair)).incoming,[0]);assert.ok(v.operations.some(x=>x.kind==='edge-relocated'&&x.oldEdgeId===1&&x.newEdgeId===0));assert.ok(v.operations.some(x=>x.kind==='interaction-strong-wake'&&x.reason==='active-pair-deletion'));assert.deepEqual(v.contactEvents,[{collider1:born.graph.edges[0].collider1,collider2:born.graph.edges[0].collider2,started:false}]);
  await advance(at(s,{2:.4,3:.25}));assert.deepEqual(j.snapshot().lifetimes,[2,3]);assert.deepEqual(j.snapshot().edges,[pair(s,2,3),pair(s,0,3)]);assert.deepEqual(j.snapshot().adjacency.find(a=>same(a.collider,s.bodies[3].pair)).incoming,[1,0]);assert.deepEqual(J.projectionSnapshot(projection),j.snapshot());assert.throws(()=>J.assertProjectionCurrent(initial,'cpu-reference'),/missed/);
 }finally{o.close();}
});

test('N=4 retains one-fresh-pair guard and rejected prepare/post are atomic',async()=>{
 const s=seed(),j=J.createReferenceStage(s),o=own(j),before=j.snapshot();
 try{await assert.rejects(()=>j.prepare(at(s,{1:0,2:0,3:0}),o.token),/Unsupported simultaneous fresh-pair BVTT order/);assert.deepEqual(j.snapshot(),before);assert.equal(j.receiptsSince(0,o.token).length,0);
  const p=at(s,{3:.25}),r=await j.prepare(p,o.token);j.narrowTransitions([],o.token);const pending=J.viewReceipt(r.receipt).after,bad=copy(p);bad[3].translation[0]=Infinity;await assert.rejects(()=>j.postSolve(bad,o.token),/Exact finite native f32 vector/);assert.deepEqual(J.viewReceipt(r.receipt).after,pending);await j.postSolve(p,o.token);j.commit(o.token);assert.equal(j.snapshot().sequence,1);assert.deepEqual(j.snapshot().lifetimes,[1]);
 }finally{o.close();}
});

test('N=4 sealed receipts preserve freshness, origin, abort and same-sequence retry checks',async()=>{
 const s=seed(),j=J.createReferenceStage(s),other=J.createReferenceStage(s),o=own(j),q=own(other),initial=j.createProjection(o.token),foreign=other.createProjection(q.token),before=j.snapshot();
 try{const p=at(s,{3:31}),a=await j.prepare(p,o.token);assert.equal(J.captureTransaction(initial,'cpu-reference'),a.receipt);assert.throws(()=>J.projectReceipts([a.receipt],initial,'cpu-reference'),/Sealed/);j.narrowTransitions([],o.token);await j.postSolve(p,o.token);const abandoned=J.projectReceipts([a.receipt],initial,'cpu-reference').projection;j.abort(o.token);assert.deepEqual(j.snapshot(),before);assert.throws(()=>J.projectionSnapshot(abandoned),/origin-bound/);
  const b=await j.prepare(p,o.token);assert.notEqual(a.receipt,b.receipt);assert.throws(()=>J.assertTransaction(a.receipt,initial,'cpu-reference'),/pending/);j.narrowTransitions([],o.token);await j.postSolve(p,o.token);assert.throws(()=>J.projectReceipts([b.receipt],foreign,'cpu-reference'),/same-origin/);const updated=J.projectReceipts([b.receipt],initial,'cpu-reference').projection;j.commit(o.token);assert.throws(()=>J.assertProjectionCurrent(initial,'cpu-reference'),/missed/);assert.throws(()=>J.projectionSnapshot(updated,'webgpu'),/origin-bound/);
  const c=await seal(j,o.token,at(s,{3:32}));j.commit(o.token);assert.throws(()=>J.projectReceipts([b.receipt],updated,'cpu-reference'),/head/);const caught=J.projectReceipts(j.receiptsSince(0,o.token),initial,'cpu-reference');assert.equal(caught.state.sequence,2);assert.equal(caught.state.revision,0);assert.deepEqual(caught.state,j.snapshot());assert.equal(J.viewReceipt(c.receipt).fromSequence,1);
 }finally{o.close();q.close();}
});

test('bounded prepared admission still rejects incomplete proxies, count aliases and unsupported source roles',()=>{
 for(const n of[3,4]){const s=seed(n);assert.deepEqual(J.validate(s),s);}
 const mutations=[
  s=>{s.kind='original-four-ball-contact-graph';},s=>{s.kind='original-three-ball-contact-graph';},s=>{s.kind='original-four-ball-cue-contact-graph';},
  s=>{s.bodies.pop();},s=>{s.colliders.pop();},s=>{s.adjacency.pop();},s=>{delete s.bodies[3].min;},s=>{s.bodies[3].softCcdPrediction=f(.1);},
  s=>{s.bodies[3].primary.generation++;},s=>{s.colliders[23].groups=(1<<16)|6;},s=>{s.adjacency[23].collider.generation++;},s=>{s.bodies[3].body=copy(s.bodies[0].body);},
  s=>{s.edges.push(pair(s,0,3));},s=>{s.colliders[0].type='Dynamic';},s=>{s.adaptiveChangeDetectionMargin=true;}
 ];for(const mutate of mutations){const s=seed();mutate(s);assert.throws(()=>J.validate(s));}
 const n3=seed(3);n3.kind='prepared-four-ball-contact-graph';assert.throws(()=>J.validate(n3),/bounded/);
});
