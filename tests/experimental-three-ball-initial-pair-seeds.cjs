'use strict';
// SPDX-License-Identifier: Apache-2.0
// Typed, initial-only projection tests. No native stepping, restore, or GPU work.
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),v8=require('node:v8'),crypto=require('node:crypto');
const E=require('./three-ball-initial-pair-seeds.cjs'),D=require('../tools/rapier-snapshot-decoder'),Pair=require('../src/experimental-pair-contact-stage');
const F=D.field,U=0xffffffff,f=Math.fround,copy=x=>structuredClone(x),key=h=>h.index+':'+h.generation;
const integer=value=>({kind:'integer',width:'u32',value:String(value)});
const float=value=>{const b=Buffer.alloc(4);b.writeFloatBE(value);return{kind:'float',width:'f32',bits:b.toString('hex')};};
const tuple=items=>({kind:'tuple',items}),seq=items=>({kind:'seq',items}),struct=(name,fields)=>({kind:'struct',name,fields:Object.entries(fields)});
const vector=values=>tuple(values.map(float)),handle=h=>struct('Index',{index:integer(h.index),generation:integer(h.generation)});
function typed(x){
 if(x===null)return{kind:'none'};
 if(typeof x==='number')return Number.isInteger(x)?integer(x):float(x);
 if(typeof x==='boolean')return{kind:'bool',value:x};
 if(typeof x==='string')return{kind:'unit_variant',name:'SyntheticEnum',variant:x,index:0};
 if(Array.isArray(x))return tuple(x.map(typed));
 if(x.variant)return{kind:'newtype_variant',name:'SyntheticEnum',variant:x.variant,index:0,value:typed(x.value)};
 return struct('SyntheticRecord',Object.fromEntries(Object.entries(x).map(([k,v])=>[k,typed(v)])));
}
function set(node,name,value){const at=node.fields.findIndex(([k])=>k===name);assert.ok(at>=0);node.fields[at][1]=value;}

const expectedCache={
 pairPresent:1,pointPresent:1,active:1,recycleValid:1,solverColor:0,
 localP1:[f(.125),-0,f(.25)],localP2:[f(-.125),f(.5),f(-.25)],localN1:[1,0,0],localN2:[-1,0,0],
 contactDistance:f(-.0625),impulse:f(.75),warmImpulse:f(.5),warmWorld:[f(.25),f(.125),f(-.5)],
 warmTangent:[f(.125),f(-.25)],tangentImpulse:[f(.5),f(-.75)],dp1:[1,2,3],dp2:[4,5,6],feature1:0xc0000001,feature2:0xc0000002,
 normal:[1,0,0],anchor1:[7,8,9],anchor2:[10,11,12],contactId:0x80000000,friction:f(.04),restitution:f(.93),
 solverBodyIds:[7,8],graphPos:42,tangentVelocity:[f(.125),f(.25),f(.5)],
 recycleTranslation:[f(.5),f(.25),f(.125)],recycleRelativeRotation:[0,0,0,1],recycleRotation:[0,0,0,1],
 recycleRotation1:[0,0,1,0],recycleRotation2:[0,1,0,0],maxExtent:f(.03125),maxDrift:f(.001)
};
function contact(c1,c2,{color=0,graphPos=42,active=true,point=true,recycle=true}={}){
 const c=expectedCache,data=struct('ContactData',{
  impulse:float(c.impulse),warmstart_impulse:float(c.warmImpulse),warmstart_tangent_world:vector(c.warmWorld),
  warmstart_tangent_impulse:vector(c.warmTangent),tangent_impulse:vector(c.tangentImpulse),solver_dp1:vector(c.dp1),solver_dp2:vector(c.dp2)
 }),p=struct('TrackedContact',{
  local_p1:vector(c.localP1),local_p2:vector(c.localP2),dist:float(c.contactDistance),fid1:integer(c.feature1),fid2:integer(c.feature2),data
 }),sc=struct('SolverContact',{
  anchor1:vector(c.anchor1),anchor2:vector(c.anchor2),contact_id:tuple([integer(c.contactId)]),tangent_velocity:vector(c.tangentVelocity)
 }),md=struct('ContactManifoldData',{
  normal:vector(c.normal),solver_contacts:seq(active?[sc]:[]),friction:float(c.friction),restitution:float(c.restitution),
  solver_body_ids:tuple(c.solverBodyIds.map(integer)),graph_pos:integer(graphPos)
 }),m=struct('ContactManifold',{points:seq(point?[p]:[]),data:md,local_n1:vector(c.localN1),local_n2:vector(c.localN2)}),rc=struct('ContactRecycleState',{
  pos12:struct('Isometry',{translation:vector(c.recycleTranslation),rotation:vector(c.recycleRelativeRotation)}),
  rot1:vector(c.recycleRotation1),rot2:vector(c.recycleRotation2),max_extent:float(c.maxExtent),max_drift:float(c.maxDrift)
 }),rigid=struct('RigidPairContacts',{manifolds:seq([m]),solver_color:integer(color),recycle_state:recycle?{kind:'some',value:rc}:{kind:'none'}});
 return struct('ContactPair',{collider1:handle(c1),collider2:handle(c2),contacts:{kind:'newtype_variant',name:'PairContacts',variant:'Rigid',index:0,value:rigid}});
}

function fixture({pairs=[],reorderObjects=false}={}){
 const floorBody={index:0,generation:4},floorCollider={index:0,generation:7};
 const objects=[0,1,2].map(i=>({body:{index:16+i,generation:3+i},collider:{index:16+i*2,generation:9+i},pairCollider:{index:17+i*2,generation:12+i}}));
 const collider=(h,body,kind)=>({handle:h,parent:{handle:body,pos_wrt_parent:{translation:[0,0,0],rotation:[0,0,0,1]}},
  material:{friction:kind==='floor'?f(.2):kind==='pair'?f(.2):1,restitution:kind==='floor'?f(.2):kind==='pair'?f(.964365):1,friction_combine_rule:'Multiply',restitution_combine_rule:'Multiply'},
  flags:{collision_groups:kind==='floor'?{memberships:2,filter:21}:kind==='pair'?{memberships:8,filter:8}:{memberships:1,filter:6}},contact_skin:0,
  mprops:kind==='floor'?{variant:'Density',value:1}:{variant:'Mass',value:kind==='pair'?0:f(.21)}});
 const colliders=[collider(floorCollider,floorBody,'floor'),...objects.flatMap(o=>[collider(o.collider,o.body,'primary'),collider(o.pairCollider,o.body,'pair')])];
 const entries=Array.from({length:22},()=>({kind:'unit_variant',name:'Entry',variant:'Vacant',index:0}));
 for(const c of colliders){const{handle:h,...value}=c;entries[h.index]={kind:'struct_variant',name:'Entry',variant:'Occupied',index:1,fields:[['generation',integer(h.generation)],['value',typed(value)]]};}
 const contacts=[2,0,1].map(i=>contact(floorCollider,objects[i].collider,{color:127,graphPos:[70,20,45][i]}));
 for(const p of pairs)contacts.push(contact(objects[p[0]].pairCollider,objects[p[1]].pairCollider,p[2]));
 const nodes=[],nodeMap=new Map(),edges=[];
 contacts.forEach(p=>{
  const endpoint=[F(p,'collider1'),F(p,'collider2')].map(h=>({index:Number(F(h,'index').value),generation:Number(F(h,'generation').value)}));
  const node=endpoint.map(h=>{const k=key(h);if(!nodeMap.has(k)){nodeMap.set(k,nodes.length);nodes.push({weight:h,next:[U,U]});}return nodeMap.get(k);});
  const index=edges.length,e={weight:p,next:[U,U],prev:[U,U],node};
  for(let side=0;side<2;side++){const old=nodes[node[side]].next[side];e.next[side]=old;if(old!==U)edges[old].prev[side]=index;nodes[node[side]].next[side]=index;}
  edges.push(e);
 });
 const graph=struct('Graph',{nodes:seq(nodes.map(n=>struct('Node',{weight:handle(n.weight),next:tuple(n.next.map(integer))}))),
  edges:seq(edges.map(e=>struct('Edge',{weight:e.weight,next:tuple(e.next.map(integer)),prev:tuple(e.prev.map(integer)),node:tuple(e.node.map(integer))})))});
 const snapshot=Buffer.from('Typed synthetic initial pair fixture'),snapshotSha256=crypto.createHash('sha256').update(snapshot).digest('hex');
 const record={created:{snapshot,snapshotSha256},roles:{floor:floorBody},objects:copy(reorderObjects?[objects[1],objects[2],objects[0]]:objects),
  sceneRegistry:{snapshotSha256,statics:[{body:floorBody,collider:{handle:floorCollider}}],objects:objects.map(o=>({body:o.body,primaryCollider:{handle:o.collider},pairCollider:{handle:o.pairCollider}}))}};
 const decoded={inputSha256:snapshotSha256,state:struct('World',{colliders:struct('ColliderSet',{colliders:struct('Arena',{items:seq(entries)})}),
  narrow_phase:struct('NarrowPhase',{contact_graph:struct('ContactGraph',{graph})})})};
 return{record,decoded,graph,objects,contacts};
}

test('all three exact initial pair seeds preserve canonical identities, source floor order and absence',()=>{
 const q=fixture(),seeds=E.exportInitialPairSeeds(q.record,q.decoded);
 assert.deepEqual(seeds.map(p=>[p.key,p.ballIndices]),[['01',[0,1]],['02',[0,2]],['12',[1,2]]]);
 assert.deepEqual(seeds.map(p=>p.seed.floorOrder),[[1,0],[1,0],[0,1]]);
 for(const p of seeds){
  assert.equal(p.initialSnapshotSha256,q.record.created.snapshotSha256);assert.equal(p.seed.initialSnapshotSha256,p.initialSnapshotSha256);
  assert.deepEqual(p.seed.pair,{pairPresent:0,pointPresent:0,active:0,recycleValid:0});assert.deepEqual(p.seed.pairAdjacency,[[],[]]);
  assert.deepEqual(p.seed.globalEdges.map(e=>e.collider2),[q.objects[2].collider,q.objects[0].collider,q.objects[1].collider]);
  assert.equal(p.seed.nativeGraph.edges.length,3);assert.deepEqual(p.seed.nativeGraph.nodes[0].next,[2,U]);
  for(let i=0;i<2;i++)assert.deepEqual(p.seed.pairDirectionalAdjacency[i],{collider:q.objects[p.ballIndices[i]].pairCollider,outgoing:[],incoming:[]});
  Pair.validate(p.seed);
 }
 const reordered=fixture({reorderObjects:true}),canonical=E.exportInitialPairSeeds(reordered.record,reordered.decoded);
 assert.deepEqual(canonical.map(p=>p.ballIndices),[[0,1],[2,0],[2,1]],'Local indices follow canonical collider order without rewriting the ball array');
});

test('real nonempty native pair caches and every point/solver/recycle field survive projection',()=>{
 const q=fixture({pairs:[[0,1]]}),p=E.exportInitialPairSeeds(q.record,q.decoded)[0];
 assert.deepEqual(p.seed.pair,expectedCache);assert.ok(Object.is(p.seed.pair.localP1[1],-0));
 assert.deepEqual(p.seed.pairAdjacency,[[3],[3]]);assert.deepEqual(p.seed.pairDirectionalAdjacency,[
  {collider:q.objects[0].pairCollider,outgoing:[3],incoming:[]},{collider:q.objects[1].pairCollider,outgoing:[],incoming:[3]}
 ]);
 Pair.validate(p.seed);
 const empty=fixture({pairs:[[0,1,{active:false,point:false,recycle:false,color:255}]]});
 assert.deepEqual(E.exportInitialPairSeeds(empty.record,empty.decoded)[0].seed.pair,{pairPresent:1,pointPresent:0,active:0,recycleValid:0,solverColor:255},'A dormant native pair is not absent');
});

test('all original pair incidence and nonascending native linked-list ordering remain visible for rejection',()=>{
 const q=fixture({pairs:[[0,1],[0,2],[1,2]]}),seeds=E.exportInitialPairSeeds(q.record,q.decoded);
 assert.deepEqual(seeds[0].seed.pairAdjacency,[[4,3],[5,3]]);
 assert.deepEqual(seeds[2].seed.pairDirectionalAdjacency,[
  {collider:q.objects[1].pairCollider,outgoing:[5],incoming:[3]},
  {collider:q.objects[2].pairCollider,outgoing:[],incoming:[5,4]}
 ]);
 assert.ok(seeds.every(p=>p.seed.pair.pairPresent===1&&p.seed.globalEdges.length===6));
 assert.throws(()=>Pair.validate(seeds[0].seed),/Additional pair-channel edge/);
});

test('truncated, corrupt, cyclic, wrong-generation and wrong-direction native adjacency fails closed',()=>{
 const corruptions=[
  q=>{const nodes=F(q.graph,'nodes').items;set(nodes[4],'next',tuple([integer(U),integer(U)]));},
  q=>{const edges=F(q.graph,'edges').items;set(edges[3],'prev',tuple([integer(0),integer(U)]));},
  q=>{const edges=F(q.graph,'edges').items;set(edges[3],'next',tuple([integer(3),integer(U)]));},
  q=>{const nodes=F(q.graph,'nodes').items;set(nodes[4],'weight',handle({...q.objects[0].pairCollider,generation:99}));},
  q=>{const edges=F(q.graph,'edges').items;set(edges[3],'node',tuple([integer(5),integer(4)]));}
 ];
 for(const mutate of corruptions){const q=fixture({pairs:[[0,1]]});mutate(q);assert.throws(()=>E.exportInitialPairSeeds(q.record,q.decoded),/directional|Directional|original|Original|generation|endpoint/);}
 // An absent selected 01 cannot be "proved" by hiding a different real 02 edge.
 const hidden=fixture({pairs:[[0,2]]});set(F(hidden.graph,'nodes').items[4],'next',tuple([integer(U),integer(U)]));
 assert.throws(()=>E.exportInitialPairSeeds(hidden.record,hidden.decoded),/full native endpoint incidence/);
});

test('initial snapshot identity rejects a recurrent decoded state and mutated original bytes',()=>{
 const q=fixture();q.decoded.inputSha256='later-native-state';assert.throws(()=>E.exportInitialPairSeeds(q.record,q.decoded),/original created snapshot, not recurrence/);
 q.decoded.inputSha256=q.record.created.snapshotSha256;q.record.created.snapshot=Buffer.from('changed');
 assert.throws(()=>E.exportInitialPairSeeds(q.record,q.decoded),/Unchanged original created snapshot/);
});

test('single-sphere projection never silently truncates native contact arrays',()=>{
 const q=fixture({pairs:[[0,1]]}),p=q.contacts[3],m=D.findStructs(p,'ContactManifold')[0];F(m,'points').items.push(copy(F(m,'points').items[0]));
 assert.throws(()=>E.exportInitialPairSeeds(q.record,q.decoded),/cannot silently discard native point or solver arrays/);
});

const nativePath=process.env.THREE_BALL_INITIAL_CREATED_SNAPSHOT??'/tmp/billiard-v3-cue-three-ball-creation-registry.v8';
test('saved original created snapshot yields all three exact seeds and strict legacy alias without native stepping',{
 skip:!process.env.RAPIER_SNAPSHOT_DECODER||!fs.existsSync(nativePath)?'Provide the existing created snapshot and RAPIER_SNAPSHOT_DECODER for read-only native decoding':false
},()=>{
 const record=v8.deserialize(fs.readFileSync(nativePath)),decoded=D.decodeSnapshot(record.created.snapshot,{engineVersion:'0.21.0'}),seeds=E.exportInitialPairSeeds(record,decoded);
 assert.deepEqual(seeds.map(p=>p.key),['01','02','12']);
 for(const p of seeds){assert.equal(p.initialSnapshotSha256,decoded.inputSha256);assert.equal(p.seed.globalEdges.length,3);assert.equal(p.seed.pair.pairPresent,0);Pair.validate(p.seed);}
 const full=require('./three-ball-contact-seed.cjs').exportContactSeed(record);
 assert.equal(full.pairSeed,full.pairSeeds[0].seed);assert.deepEqual(full.pairSeeds,seeds);
 for(const p of full.pairSeeds){
  assert.deepEqual(p.seed.globalEdges,full.contactGraphSeed.edges);
  for(const a of p.seed.pairDirectionalAdjacency)assert.deepEqual(a,full.contactGraphSeed.adjacency.find(x=>key(x.collider)===key(a.collider)));
 }
});
