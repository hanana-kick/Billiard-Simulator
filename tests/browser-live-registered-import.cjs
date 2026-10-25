'use strict';
// Read-only admission of independently captured unchanged-controller forks.
// These tests never load/init/restore/step Rapier and never request a GPU.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),v8=require('node:v8'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),copy=x=>structuredClone(x),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const BOUNDARY='liveRegisteredStrikeCreated',key=h=>h.index+':'+h.generation;
const FIXTURES=[
 {name:'placed',file:process.env.LIVE_REGISTERED_PLACED_V8??'/tmp/browser-live-registered-capture.placed.v8',sha256:'4aee6c0395cbdf35f876a125c141bbbf02e0319928762ee82b193e43cdf74403'},
 {name:'settled',file:process.env.LIVE_REGISTERED_SETTLED_V8??'/tmp/browser-live-registered-capture.settled.v8',sha256:'11f41cd9c11ff47911f14afc084b27f32a15fc69db1f26d7970eb864f35f2262'},
 {name:'awake',file:process.env.LIVE_REGISTERED_AWAKE_V8??'/tmp/browser-live-registered-capture.awake.v8',sha256:'1a928852afcc75e0df2a32a27e8a1005f471095a03f960ecaf23ffb13125f564'},
 {name:'fresh-fourth',file:process.env.LIVE_REGISTERED_FRESH_V8??'/tmp/browser-live-registered-capture.v8',sha256:'db5c9698e4c5ace554a0f2e901e7113856ef04154589d0e65b3ffb459bb23409'},
];
let M,D,Origin,World,Hull,pack,unpack,decoder,provenance,wasm,engine;
const fixtures=new Map(),seeds=new Map();
const absentNative=()=>{assert.equal(typeof globalThis.RAPIER,'undefined');assert.equal(typeof globalThis.PhysicsLab,'undefined');assert.equal(Object.keys(require.cache).some(p=>/[/\\](?:vendor[/\\]rapier\.(?:cjs|js)|@dimforge[/\\]rapier)/.test(p)),false,'No native engine module was loaded');};
// Independent typed-data projection used only to compare the admitted result
// with the actual WASM-decoded snapshot, never to supply an importer seed.
function nativeValue(n){
 switch(n.kind){
  case 'float':return D.floatValue(n);
  case 'integer':{const x=Number(n.value);return Number.isSafeInteger(x)?x:BigInt(n.value);}
  case 'bool':return n.value;
  case 'none':case 'unit':case 'unit_struct':return null;
  case 'some':case 'newtype_struct':return nativeValue(n.value);
  case 'newtype_variant':return {variant:n.variant,value:nativeValue(n.value)};
  case 'unit_variant':return n.variant;
  default:if(n.fields)return Object.fromEntries(n.fields.map(([k,v])=>[k,nativeValue(v)]));if(n.items)return n.items.map(nativeValue);if(n.entries)return n.entries.map(([a,b])=>[nativeValue(a),nativeValue(b)]);if('value'in n)return n.value;throw Error('Unknown test native node: '+n.kind);
 }
}
const arena=(state,name)=>state[name][name].items.flatMap((slot,index)=>slot&&typeof slot==='object'&&Object.hasOwn(slot,'generation')?[{handle:{index,generation:slot.generation},...slot.value}]:[]);
function expectedOrigin(f){
 const a=f.raw.capture.application,b=f.raw.capture.preStrikeApplication,selectedIndex=a.registry.objects.findIndex(o=>o.id===a.controller.selectedId);
 const clock=(a,s)=>({...Object.fromEntries(['time','steps','shots','revision'].map(k=>[k,a[k]])),nativeFrameIndex:s.broad_phase.frame_index});
 return {schema:'original-controller-live-four-ball-fork-v1',boundary:BOUNDARY,nativeRestoreUsed:true,preStrikeSnapshotSha256:hash(f.raw.preStrikeSnapshot),createdSnapshotSha256:hash(f.raw.snapshot),preStrikeClock:clock(b,f.before),createdClock:clock(a,f.state),selectedId:a.controller.selectedId,selectedIndex,selectedBody:copy(a.registry.objects[selectedIndex].body),settings:copy(a.controller.settings),params:copy(a.params),gameBefore:copy(b.game),readiness:copy(f.raw.capture.readiness)};
}
function assertCanonicalHandles(seed){
 const pending=[[seed,'seed']],seen=new WeakSet();let count=0;
 while(pending.length){const[x,at]=pending.pop();if(!x||typeof x!=='object'||seen.has(x)||ArrayBuffer.isView(x))continue;seen.add(x);
  if(Object.hasOwn(x,'index')&&Object.hasOwn(x,'generation')){assert.deepEqual(Object.keys(x),Object.hasOwn(x,'bitsHex')?['index','generation','bitsHex']:['index','generation'],'Canonical native handle at '+at);count++;}
  else pending.push(...Object.entries(x).map(([k,v])=>[v,at+'.'+k]));
 }
 assert.ok(count>100,'Complete output handle coverage, not just the selected ball');return count;
}
function assertNoLegacyOrigin(seed){
 const forbidden=new Set(['originalFourBallCreation','originalSettledFourBallCreation','originalPlacedGoalFourBallCreation','sourceNativeSteps','nativeSteps','initialFourBallBirth','clothBirthSeed']);
 const pending=[seed],seen=new WeakSet();let origins=0;
 while(pending.length){const x=pending.pop();if(!x||typeof x!=='object'||seen.has(x)||ArrayBuffer.isView(x))continue;seen.add(x);
  for(const[k,v]of Object.entries(x)){assert.equal(forbidden.has(k),false,'Live source may not claim legacy or guessed history: '+k);if(k==='sourceOrigin'){assert.deepEqual(v,seed.sourceOrigin);origins++;}pending.push(v);}
 }
 assert.ok(origins>=12,'Origin reaches every independently admitted component');
}
function assertSourceProjection(seed,f){
 const origin=expectedOrigin(f),state=f.state,raw=f.raw.capture,np=state.narrow_phase,bodies=arena(state,'bodies'),colliders=arena(state,'colliders'),byBody=new Map(bodies.map(b=>[key(b.handle),b])),byCollider=new Map(colliders.map(c=>[key(c.handle),c]));
 assert.deepEqual(seed.sourceOrigin,origin);assert.deepEqual(Origin.validateSourceOrigin(seed.sourceOrigin),origin);
 if(f.name==='awake'){assert.equal(origin.readiness.bodies[0].sleeping,false);assert.equal(origin.readiness.anyMotion,false);assert.equal(seed.cueInitial.sourceCreation.created.bodies.ball.activation.sleeping,false,'Ready awake source is never forced asleep');}
 assert.equal(seed.kind,'original-live-registered-four-ball-created-world');assert.equal(seed.boundary,BOUNDARY);assert.equal(seed.initialSnapshotSha256,hash(f.raw.snapshot));
 assert.equal(seed.selectedId,raw.application.controller.selectedId);assert.equal(seed.selectedIndex,origin.selectedIndex);assert.deepEqual(seed.game,raw.application.game);
 assert.equal(seed.sourceApplicationSteps,raw.application.steps);assert.equal(seed.sourceApplicationTime,raw.application.time);
 assert.deepEqual(seed.initialContactEvents,raw.application.events.filter(e=>e.kind==='contact'));
 assert.equal(seed.provenance.nativeFrameIndex,state.broad_phase.frame_index);assert.equal(seed.provenance.nativeFrameIndex,f.before.broad_phase.frame_index);assert.notEqual(seed.provenance.nativeFrameIndex,raw.application.steps,'Decoded native frame is not an application-step counter');
 const source=seed.cueInitial.sourceCreation,created=source.created;
 assert.equal(created.originalLiveRegisteredFourBallCreation,true);assert.equal(created.sourceNativeFrameIndex,state.broad_phase.frame_index);assert.deepEqual(created.snapshot,f.raw.snapshot);
 for(const[role,handle]of Object.entries(source.roles))assert.deepEqual(created.bodies[role],byBody.get(key(handle)),'Complete native body, including activation/IDs/CCD/mass: '+role);
 assert.deepEqual(seed.bodyRegistry,bodies.map(b=>({handle:b.handle,type:b.body_type,enabled:b.enabled,changes:b.changes,ids:b.ids,activation:b.activation,maxExtent:b.mprops.max_extent,jointAdjacency:[]})),'Complete native body registry');
 assert.deepEqual(created.colliders,colliders);assert.deepEqual(created.islands,state.islands);assert.deepEqual(created.jointState,state.impulse_joints);assert.deepEqual(created.integration,state.integration_parameters);
 assert.deepEqual(created.modifiedBodies,state.bodies.modified_bodies[0]);assert.deepEqual(created.modifiedColliders,state.colliders.modified_colliders[0]);
 for(const old of arena(f.before,'bodies'))assert.deepEqual(byBody.get(key(old.handle)),old,'Cue-only capture preserved each existing native body');
 for(const old of arena(f.before,'colliders'))assert.deepEqual(byCollider.get(key(old.handle)),old,'Cue-only capture preserved each existing native collider');
 assert.deepEqual(state.broad_phase,f.before.broad_phase);assert.deepEqual(np,f.before.narrow_phase);
 assert.deepEqual(seed.cueBroadSeed.initialBroadPhase,state.broad_phase);assert.deepEqual(seed.cueBroadSeed.modifiedColliders,state.colliders.modified_colliders[0]);
 for(const c of seed.cueBroadSeed.colliders){const {bodyType,softCcdPrediction,...native}=c;assert.deepEqual(native,byCollider.get(key(c.handle)));const b=byBody.get(key(c.parent.handle));assert.equal(bodyType,b.body_type);assert.equal(softCcdPrediction,b.ccd.soft_ccd_prediction);}
 const contacts=seed.initialContactOrigin;
 for(const[out,native]of Object.entries({contactGraph:'contact_graph',pairSolverHints:'pair_solver_hints',solverContactGraph:'solver_contact_graph',bodySolverColorMasks:'body_solver_color_masks',solverGraphValid:'solver_graph_valid',solverGraphEpoch:'solver_graph_epoch',solverGraphMultibodyEpoch:'solver_graph_mb_epoch'}))assert.deepEqual(contacts[out],np[native],'Exact retained source cache '+out);
 assert.equal(contacts.sourceNativeFrameIndex,state.broad_phase.frame_index);assert.equal(contacts.activeSetEpoch,state.islands.active_set_epoch);assert.equal(contacts.multibodyTopologyEpoch,state.multibody_joints.topology_epoch);
 const edges=np.contact_graph.graph.edges.map(({weight:p})=>({collider1:p.collider1,collider2:p.collider2,body1:byCollider.get(key(p.collider1)).parent.handle,body2:byCollider.get(key(p.collider2)).parent.handle,active:p.contacts.value.manifolds.some(m=>m.data.solver_contacts.length>0)}));
 assert.deepEqual(seed.globalEdges,edges);assert.deepEqual(seed.contactGraphSeed.edges,edges);assert.deepEqual(contacts.edges,edges);
 const roster=seed.solverContactRoster;assert.deepEqual(roster.edges,edges);assert.deepEqual(roster.buckets,np.solver_contact_graph.buckets);assert.deepEqual(roster.bodySolverColorMasks,np.body_solver_color_masks.map(String));
 assert.deepEqual(roster.pairs,np.contact_graph.graph.edges.map(({weight:p},i)=>({hint:np.pair_solver_hints[i],solverColor:p.contacts.value.solver_color,solverColorBodies:p.contacts.value.solver_color_bodies,manifolds:p.contacts.value.manifolds.map(m=>({activeContactCount:m.data.solver_contacts.length,solverFlags:m.data.solver_flags,solverColor:m.data.solver_color,solverBodyIds:m.data.solver_body_ids,graphPos:m.data.graph_pos}))})));
 for(const ball of seed.balls){const floor=raw.application.registry.statics.find(s=>s.kind==='cloth'),pair=np.contact_graph.graph.edges.map(e=>e.weight).find(p=>key(p.collider1)===key(floor.collider)&&key(p.collider2)===key(ball.collider)),rigid=pair.contacts.value,m=rigid.manifolds[0];assert.deepEqual(ball.state.localN1,m.local_n1);assert.equal(ball.state.feature1,m.points[0].fid1);assert.equal(ball.state.feature2,m.points[0].fid2);assert.equal(ball.state.solverColor,rigid.solver_color);}
 assert.equal(seed.pairSeeds.length,6);assert.equal(seed.balls.length,4);assert.equal(seed.cushionSeeds.length,4);assert.equal(seed.sceneRegistry.staticCount,16);
 for(const s of seed.cushionSeeds)for(const c of s.cushions)Hull.assertNativeHull(c.hull);
 assertNoLegacyOrigin(seed);assertCanonicalHandles(seed);World.validate(seed);
}
before(async()=>{
 absentNative();M=await import('../src/browser-initial-import/live-registered-four-ball.mjs');D=await import('../tools/rapier-snapshot-decoder/browser.mjs');({pack,unpack}=await import('./browser-initial-import-evidence.mjs'));
 Origin=require('../src/experimental-live-registered-origin');World=require('../src/experimental-four-ball-world');Hull=require('../src/experimental-cue-convex-topology');
 const file=process.env.RAPIER_WASM_PROVENANCE??path.resolve(ROOT,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json');
 provenance=JSON.parse(fs.readFileSync(file,'utf8'));engine=new Uint8Array(fs.readFileSync(path.join(ROOT,'vendor/rapier.cjs')));wasm=new Uint8Array(fs.readFileSync(provenance.wasmPath));
 assert.equal(hash(engine),provenance.engineSha256);assert.equal(hash(wasm),provenance.wasmSha256);
 decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:engine,wasmBytes:wasm,provenance,expectedWasmSha256:provenance.wasmSha256});
 for(const info of FIXTURES){const bytes=fs.readFileSync(info.file);assert.equal(hash(bytes),info.sha256,'Unchanged original-controller artifact: '+info.name);const raw=v8.deserialize(bytes);assert.deepEqual(Object.keys(raw).sort(),['capture','preStrikeSnapshot','snapshot']);
  const decoded=await decoder.decodeSnapshot(raw.snapshot),preStrikeDecoded=await decoder.decodeSnapshot(raw.preStrikeSnapshot);fixtures.set(info.name,{...info,raw,input:{...copy(raw),decoded,preStrikeDecoded},state:nativeValue(decoded.state),before:nativeValue(preStrikeDecoded.state)});
 }
 absentNative();
});
after(absentNative);
for(const name of ['placed','settled','awake'])test('actual '+name+' controller fork imports exact origin, native bodies and retained caches',async t=>{
 const f=fixtures.get(name),before=copy(f.input),seed=await M.projectLiveRegisteredFourBall(f.input);assertSourceProjection(seed,f);assert.deepEqual(f.input,before);
 const imported=await M.importLiveRegisteredFourBall(decoder,f.raw);assert.deepEqual(imported,seed);assertSourceProjection(imported,f);seeds.set(name,seed);
 t.diagnostic(JSON.stringify({source:name,artifactSha256:f.sha256,snapshotSha256:hash(f.raw.snapshot),preStrikeSnapshotSha256:hash(f.raw.preStrikeSnapshot),nativeFrameIndex:seed.provenance.nativeFrameIndex,applicationSteps:seed.sourceApplicationSteps,selectedId:seed.selectedId,sourceBodyAndCacheEquality:true,physicsSteps:0,gpuWork:false}));
});
test('fresh unregistered fourth sphere is explicitly rejected, never relabeled as registered',async()=>{
 const f=fixtures.get('fresh-fourth'),fourth=arena(f.state,'bodies').find(b=>key(b.handle)===key(f.raw.capture.application.registry.objects[3].body));assert.equal(f.raw.capture.application.steps,0);assert.ok(Object.values(fourth.ids).includes(0xffffffff));
 const before=copy(f.raw);await assert.rejects(M.importLiveRegisteredFourBall(decoder,f.raw),/Every settled original floor cache must be preserved|registered|prepared|Unsupported/i);await assert.rejects(M.projectLiveRegisteredFourBall(f.input),/Every settled original floor cache must be preserved|registered|prepared|Unsupported/i);assert.deepEqual(f.raw,before);
});
test('sorted-key transport keeps exact values and canonical generation-bearing output without mutating callers',async()=>{
 for(const name of ['placed','settled','awake']){const f=fixtures.get(name),sorted=unpack(JSON.parse(JSON.stringify(pack(f.input)))),before=copy(sorted);assert.deepEqual(Object.keys(sorted.capture.application.registry.objects[0].body),['generation','index']);assert.deepEqual(Object.keys(sorted.capture.strikeCreationJournal[0].result.handle),['generation','index']);
  const seed=await M.projectLiveRegisteredFourBall(sorted);assert.deepEqual(seed,seeds.get(name));assertCanonicalHandles(seed);assertSourceProjection(seed,f);assert.deepEqual(sorted,before);
  const transport=unpack(JSON.parse(JSON.stringify(pack(f.raw)))),rawBefore=copy(transport);assert.deepEqual(await M.importLiveRegisteredFourBall(decoder,transport),seed);assert.deepEqual(transport,rawBefore);
 }
});
test('projection owns BOTH snapshots, decoded trees and nested capture before its first await',async()=>{
 const x=copy(fixtures.get('placed').input),pending=M.projectLiveRegisteredFourBall(x);x.snapshot.fill(0);x.preStrikeSnapshot.fill(0);x.decoded.state={kind:'unit'};x.preStrikeDecoded.state={kind:'unit'};x.capture.application.controller.settings.angle=99;x.capture.preStrikeApplication.game.scores[1]=999;x.capture.readiness.bodies[0].linear[0]=100;x.capture.strikeCreationJournal.length=0;
 assert.deepEqual(await pending,seeds.get('placed'));
});
test('decoder composition owns all caller inputs before waiting for either decode',async()=>{
 const f=fixtures.get('settled'),x=copy(f.raw),seen=[];let release,entered;const barrier=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 const delayed={async decodeSnapshot(bytes){seen.push(bytes);assert.notEqual(bytes,x.snapshot);assert.notEqual(bytes,x.preStrikeSnapshot);if(seen.length===1){entered();await barrier;}return decoder.decodeSnapshot(bytes);}};
 const pending=M.importLiveRegisteredFourBall(delayed,x);await started;x.snapshot.fill(0);x.preStrikeSnapshot.fill(0);x.capture.application.controller.settings.speed=9;x.capture.preStrikeApplication.events.length=0;x.capture.readiness.bodies[0].body.generation++;x.capture.strikeCreationJournal.length=0;release();
 assert.deepEqual(await pending,seeds.get('settled'));assert.equal(seen.length,2);assert.deepEqual(seen[0],f.raw.preStrikeSnapshot);assert.deepEqual(seen[1],f.raw.snapshot);
});
test('both verified byte/hash/provenance inputs reject corruption without caller mutation',async()=>{
 const mutations=[
  ...['decoded','preStrikeDecoded'].flatMap(k=>[
   [k+' source revision',x=>x[k].sourceRevision='untrusted'],[k+' engine hash',x=>x[k].engineSha256='0'.repeat(64)],[k+' engine version',x=>x[k].engineVersion='0.22.0'],[k+' schema',x=>x[k].schemaVersion=2],[k+' parry',x=>x[k].parryVersion='other'],[k+' native verification',x=>x[k].verification.nativeBincodeByteIdentical=false],[k+' JS verification',x=>x[k].verification.javascriptTypedReencodeByteIdentical=false],[k+' length',x=>x[k].byteLength++],[k+' hash',x=>x[k].inputSha256='0'.repeat(64)],[k+' typed tree',x=>x[k].state={kind:'unit'}],
  ]),...['snapshot','preStrikeSnapshot'].flatMap(k=>[[k+' byte mutation',x=>x[k][17]^=1],[k+' empty',x=>x[k]=new Uint8Array()],[k+' wrong type',x=>x[k]=Array.from(x[k])]])
 ];
 for(const[label,mutate]of mutations){const x=copy(fixtures.get('placed').input);mutate(x);const before=copy(x);await assert.rejects(M.projectLiveRegisteredFourBall(x),undefined,label);assert.deepEqual(x,before,label);}
 for(const k of ['snapshot','preStrikeSnapshot']){const x=copy(fixtures.get('placed').raw);x[k]=new Uint8Array([0,1,2,3]);const before=copy(x);await assert.rejects(M.importLiveRegisteredFourBall(decoder,x));assert.deepEqual(x,before);}
});
test('generation-bearing handles reject extra, missing, narrowed and substituted identities',async()=>{
 const locations=[x=>x.capture.application.registry.objects[0].body,x=>x.capture.preStrikeApplication.registry.objects[0].body,x=>x.capture.application.cue.shaft,x=>x.capture.readiness.bodies[0].body,x=>x.capture.strikeCreationJournal[0].result.handle,x=>x.capture.strikeCreationJournal[1].args[1].handle];
 const mutations=[h=>h.extra=0,h=>delete h.generation,h=>h.index=-1,h=>h.index=2**32,h=>h.index=.5,h=>h.generation='0',h=>h.generation=-0,h=>h.generation++];
 for(const locate of locations)for(const mutate of mutations){const x=copy(fixtures.get('placed').input);mutate(locate(x));const before=copy(x);await assert.rejects(M.projectLiveRegisteredFourBall(x));assert.deepEqual(x,before);}
});
test('readiness, zero-step cue journal, future/seed input and legacy origin attempts fail closed',async()=>{
 const mutations=[
  x=>x.capture.boundary='goalStrikeCreated',x=>x.capture.candidateInput=false,x=>x.capture.nativeRestoreUsed=false,x=>x.capture.nativeSteps=556,x=>x.capture.apiJournalLength++,
  ...['cueAbsent','pendingAbsent','fireAccepted'].map(k=>x=>x.capture.readiness[k]=false),x=>x.capture.readiness.anyMotion=true,x=>x.capture.readiness.bodies[0].sleeping=false,x=>x.capture.readiness.bodies[0].linear[0]=Math.fround(.003),x=>x.capture.readiness.bodies[0].angular[0]=Math.fround(.051),x=>x.capture.readiness.bodies.reverse(),
  x=>x.capture.application.steps++,x=>x.capture.application.time+=1/61440,x=>x.capture.application.revision++,x=>x.capture.application.shots++,x=>x.capture.preStrikeApplication.cue={},x=>x.capture.preStrikeApplication.game.pending={},x=>x.capture.application.controller.selectedId=2,x=>x.capture.application.params.gravity=0,x=>x.capture.application.controller.settings.speed=11,x=>x.capture.application.cue.contacted=true,x=>x.capture.application.cue.contacts.push(1),x=>x.capture.application.game.pending.reds.push(3),
  x=>x.capture.strikeCreationJournal.pop(),x=>x.capture.strikeCreationJournal.reverse(),x=>x.capture.strikeCreationJournal[0].phase='goalStrikeCreation',x=>x.capture.strikeCreationJournal[0].captureNativeStepsBefore++,x=>x.capture.strikeCreationJournal[0].captureNativeStepsAfter++,x=>x.capture.strikeCreationJournal[0].nativeStepsBefore=0,x=>x.capture.strikeCreationJournal[0].order++,x=>x.capture.strikeCreationJournal[6].args=[true],x=>x.capture.strikeCreationJournal[9].args=[-.08,.14],
  x=>x.capture.expected={boundary:'firstH.postWorld'},x=>x.capture.futureSnapshot=copy(x.snapshot),x=>x.capture.seed={},x=>x.capture.sourceOrigin=expectedOrigin(fixtures.get('placed')),x=>x.capture.originalPlacedGoalFourBallCreation=true,x=>x.expected={boundary:'firstH.postApplication'},x=>x.seed={},x=>x.sourceOrigin=expectedOrigin(fixtures.get('placed')),
 ];
 for(const mutate of mutations){const x=copy(fixtures.get('placed').input);mutate(x);const before=copy(x);await assert.rejects(M.projectLiveRegisteredFourBall(x));assert.deepEqual(x,before);}
 for(const k of ['seed','expected','sourceOrigin']){const x=copy(fixtures.get('placed').raw);x[k]={};let calls=0;await assert.rejects(M.importLiveRegisteredFourBall({decodeSnapshot(){calls++;throw Error('Should not decode');}},x));assert.equal(calls,0);}
});
test('a genuine different native source cannot replace either half of the same fork',async()=>{
 const f=fixtures.get('placed'),other=fixtures.get('settled');for(const [bytes,decoded]of [['snapshot','decoded'],['preStrikeSnapshot','preStrikeDecoded']]){const x=copy(f.input);x[bytes]=copy(other.input[bytes]);x[decoded]=copy(other.input[decoded]);const before=copy(x);await assert.rejects(M.projectLiveRegisteredFourBall(x));assert.deepEqual(x,before);}
});
test('shared storage and accessors reject before clone or decode, without executing getters',async()=>{
 for(const entry of ['project','import'])for(const slot of ['snapshot','preStrikeSnapshot','capture']){
  const x=copy(fixtures.get('placed')[entry==='project'?'input':'raw']);let gets=0,calls=0;Object.defineProperty(x,slot,{enumerable:true,get(){gets++;throw Error('Accessor executed');}});
  const pending=entry==='project'?M.projectLiveRegisteredFourBall(x):M.importLiveRegisteredFourBall({decodeSnapshot(){calls++;throw Error('Unexpected decoder');}},x);await assert.rejects(pending,/accessors/);assert.equal(gets,0);assert.equal(calls,0);
 }
 for(const slot of ['snapshot','preStrikeSnapshot']){const x=copy(fixtures.get('placed').raw),shared=new SharedArrayBuffer(x[slot].length);new Uint8Array(shared).set(x[slot]);x[slot]=new Uint8Array(shared);let calls=0;await assert.rejects(M.importLiveRegisteredFourBall({decodeSnapshot(){calls++;}},x),/shared/i);assert.equal(calls,0);}
});
function runtimeScriptOrder(){
 const seen=new Set(),out=[];function visit(name){if(seen.has(name))return;seen.add(name);const file=path.join(ROOT,'src',name+'.js'),s=fs.readFileSync(file,'utf8');for(const m of s.matchAll(/(?:require\('\.\/|load\(')([\w-]+)(?:\.js)?'/g))visit(m[1]);out.push('/src/'+name+'.js');}
 visit('experimental-four-ball-world');return out.filter(x=>!x.endsWith('/experimental-cue-convex-topology.js'));
}
test('genuine Chromium imports placed, settled and awake forks with no Node/native engine globals and no GPU',{skip:!process.env.RAPIER_TEST_CHROMIUM,timeout:120000},async t=>{
 const http=require('node:http'),{chromium}=require('playwright'),scripts=runtimeScriptOrder(),assets=new Map([
  ['/',{type:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Registered source read-only import</title>'}],
  ['/engine',{type:'application/octet-stream',body:engine}],['/decoder.wasm',{type:'application/wasm',body:wasm}],
 ]);
 for(const name of ['placed','settled','awake','fresh-fourth']){const raw=fixtures.get(name).raw;assets.set('/'+name+'/snapshot',{type:'application/octet-stream',body:raw.snapshot});assets.set('/'+name+'/preStrikeSnapshot',{type:'application/octet-stream',body:raw.preStrikeSnapshot});assets.set('/'+name+'/capture',{type:'application/json',body:JSON.stringify(pack(raw.capture))});}
 for(const dir of ['src','src/browser-initial-import','tools/rapier-snapshot-decoder'])for(const name of fs.readdirSync(path.join(ROOT,dir)))if(/\.(?:js|mjs)$/.test(name))assets.set('/'+dir+'/'+name,{type:'text/javascript',body:fs.readFileSync(path.join(ROOT,dir,name))});
 assets.set('/tests/browser-initial-import-evidence.mjs',{type:'text/javascript',body:fs.readFileSync(path.join(ROOT,'tests/browser-initial-import-evidence.mjs'))});
 const server=http.createServer((req,res)=>{const a=assets.get(req.url);if(!a){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':a.type,'cache-control':'no-store'}).end(a.body);});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.RAPIER_TEST_CHROMIUM,headless:true,chromiumSandbox:true,ignoreDefaultArgs:['--unsafely-disable-devtools-self-xss-warnings'],args:['--disable-gpu']});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
  const actual=await page.evaluate(async({provenance,scripts})=>{
   const absent=()=>{if([typeof process,typeof Buffer,typeof require,typeof RAPIER,typeof PhysicsLab].some(x=>x!=='undefined'))throw Error('Unexpected Node/native engine global');};absent();
   const M=await import('/src/browser-initial-import/live-registered-four-ball.mjs'),D=await import('/tools/rapier-snapshot-decoder/browser.mjs'),{pack,unpack}=await import('/tests/browser-initial-import-evidence.mjs');
   const bytes=async url=>new Uint8Array(await(await fetch(url)).arrayBuffer()),decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:await bytes('/engine'),wasmBytes:await bytes('/decoder.wasm'),provenance,expectedWasmSha256:provenance.wasmSha256});
   for(const url of scripts)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>reject(Error('Runtime script: '+url));document.head.append(s);});
   const load=async name=>({snapshot:await bytes('/'+name+'/snapshot'),preStrikeSnapshot:await bytes('/'+name+'/preStrikeSnapshot'),capture:unpack(await(await fetch('/'+name+'/capture')).json())});const result={};
   for(const name of ['placed','settled','awake']){const input=await load(name),before=JSON.stringify(pack(input));if(Object.keys(input.capture.application.registry.objects[0].body).join(',')!=='generation,index')throw Error('Sorted transport not exercised');const seed=await M.importLiveRegisteredFourBall(decoder,input);LabFourBallWorldExperimental.validate(seed);for(const s of seed.cushionSeeds)for(const c of s.cushions)LabCueConvexTopologyExperimental.assertNativeHull(c.hull);if(JSON.stringify(pack(input))!==before)throw Error('Caller input mutated');result[name]=pack(seed);}
   let rejected=false;try{await M.importLiveRegisteredFourBall(decoder,await load('fresh-fourth'));}catch{rejected=true;}if(!rejected)throw Error('Fresh fourth sphere relabeled');absent();return result;
  },{provenance,scripts});
  for(const name of ['placed','settled','awake'])assert.deepEqual(unpack(actual[name]),seeds.get(name));
  t.diagnostic(JSON.stringify({browser:await browser.version(),noNodeGlobals:true,noNativeEngine:true,physicsSteps:0,gpuWork:false,completeSeedEquality:['placed','settled','awake'],freshFourthRejected:true,existingWorldAdmission:true}));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
test('live world root application clock cannot reset or diverge from its original origin',async()=>{
 for(const name of ['placed','settled']){
  const seed=await M.importLiveRegisteredFourBall(decoder,fixtures.get(name).raw);
  for(const steps of [0,seed.sourceApplicationSteps+1]){
   if(steps===seed.sourceApplicationSteps)continue;
   const changed=copy(seed);changed.sourceApplicationSteps=steps;
   assert.throws(()=>World.validate(changed),/clock|steps/i);
  }
 }
});
