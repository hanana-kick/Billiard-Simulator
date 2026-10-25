'use strict';
// Read-only WASM projection tests. The test process never loads a native engine.
// Source-only capture is independently generated in a child when no explicit
// evidence prefix is supplied. Full-shot source preparation is opt-in there.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),v8=require('node:v8'),os=require('node:os'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),copy=x=>structuredClone(x),hash=x=>crypto.createHash('sha256').update(x).digest('hex'),key=h=>h.index+':'+h.generation;
const PREFIX=process.env.THREE_BALL_LIVE_CAPTURE_PREFIX;let prefix=PREFIX,temporary,M,D,Origin,decoder,provenance,engine,wasm,pack,unpack;
const fixtures=new Map(),results=new Map();
const absentNative=()=>{
  for(const k of ['RAPIER','PhysicsLab','LabController'])assert.equal(typeof globalThis[k],'undefined','Read-only importer must not load '+k);
  assert.equal(Object.keys(require.cache).some(p=>/[/\\](?:vendor[/\\]rapier\.(?:cjs|js)|@dimforge[/\\]rapier)/.test(p)),false);
};
function nativeValue(n){
  switch(n.kind){
    case 'float':return D.floatValue(n);
    case 'integer':{const x=Number(n.value);return Number.isSafeInteger(x)?x:BigInt(n.value);}
    case 'bool':return n.value;
    case 'none':case 'unit':case 'unit_struct':return null;
    case 'some':case 'newtype_struct':return nativeValue(n.value);
    case 'newtype_variant':return{variant:n.variant,value:nativeValue(n.value)};
    case 'unit_variant':return n.variant;
    default:if(n.fields)return Object.fromEntries(n.fields.map(([k,v])=>[k,nativeValue(v)]));if(n.items)return n.items.map(nativeValue);
      if(n.entries)return n.entries.map(([a,b])=>[nativeValue(a),nativeValue(b)]);if('value'in n)return n.value;throw Error('Unknown native node '+n.kind);
  }
}
const arena=(s,name)=>s[name][name].items.flatMap((slot,index)=>slot&&typeof slot==='object'&&Object.hasOwn(slot,'generation')?[{handle:{index,generation:slot.generation},...slot.value}]:[]);
function assertProjection(result,fixture){
  const {raw,decoded,preStrikeDecoded,state,before}=fixture,a=raw.capture.application,b=raw.capture.preStrikeApplication;
  assert.equal(result.kind,'original-live-registered-three-ball-source-projection');assert.equal(result.boundary,'liveRegisteredThreeBallStrikeCreated');
  assert.deepEqual(result.capability,Origin.CAPABILITY);assert.equal(result.capability.numericalOwnerAvailable,false);assert.equal(result.capability.gpuWork,false);
  assert.deepEqual(result.application,a);assert.deepEqual(result.preStrikeApplication,b);
  assert.deepEqual(result.before.snapshot,raw.preStrikeSnapshot);assert.deepEqual(result.created.snapshot,raw.snapshot);
  assert.deepEqual(result.before.typedState,preStrikeDecoded.state);assert.deepEqual(result.created.typedState,decoded.state);
  assert.deepEqual(result.before.state,before);assert.deepEqual(result.created.state,state);
  for(const name of ['bodies','colliders']){assert.deepEqual(result.before[name],arena(before,name));assert.deepEqual(result.created[name],arena(state,name));}
  const selectedIndex=a.registry.objects.findIndex(o=>o.id===a.controller.selectedId),o=result.sourceOrigin;
  assert.equal(o.selectedIndex,selectedIndex);assert.equal(o.selectedId,a.controller.selectedId);assert.deepEqual(o.selectedBody,a.registry.objects[selectedIndex].body);
  assert.deepEqual(o.targetIds,b.game.objectIds.filter(id=>id!==o.selectedId));assert.deepEqual(o.targetIds,a.game.pending.targets);
  assert.deepEqual(o.routeTargets,{targetId:a.controller.routeOptions.targetId,secondId:a.controller.routeOptions.secondId});
  assert.equal(o.preStrikeSnapshotSha256,hash(raw.preStrikeSnapshot));assert.equal(o.createdSnapshotSha256,hash(raw.snapshot));
  assert.equal(o.preStrikeClock.nativeFrameIndex,before.broad_phase.frame_index);assert.equal(o.createdClock.nativeFrameIndex,state.broad_phase.frame_index);
  for(const k of ['time','steps','shots','revision']){assert.equal(o.preStrikeClock[k],b[k]);assert.equal(o.createdClock[k],a[k]);}
  assert.deepEqual(o.gameBefore,b.game);assert.deepEqual(o.readiness,raw.capture.readiness);
  for(const native of ['islands','broad_phase','narrow_phase','multibody_joints','soft_bodies'])assert.deepEqual(result.created.state[native],result.before.state[native]);
  const sourceBodies=a.registry.objects.map(object=>result.created.bodies.find(body=>key(body.handle)===key(object.body)));
  for(const body of sourceBodies)Origin.validateRegisteredBodyIds(body,result.created.state.islands);
  assert.equal(Object.hasOwn(o,'nativeSteps'),false);assert.equal(Object.hasOwn(result,'sourceNativeSteps'),false);
  assert.equal(Object.hasOwn(result,'balls'),false,'Projection is not a relabeled numerical world seed');
  assert.equal(Object.hasOwn(result,'cueInitial'),false);assert.equal(Object.hasOwn(result,'pairSeeds'),false);
  assert.throws(()=>M.requireLiveThreeBallNumericalOwner(result),error=>error.code==='three-ball-live-owner-unavailable');
}
before(async()=>{
  absentNative();
  if(!prefix){
    temporary=fs.mkdtempSync(path.join(os.tmpdir(),'three-ball-live-import-'));prefix=path.join(temporary,'capture');
    const {spawnSync}=require('node:child_process'),env={...process.env,THREE_BALL_LIVE_CAPTURE_PREFIX:prefix,THREE_BALL_LIVE_CONTINUATION:'0',THREE_BALL_LIVE_SETTLED:'0'};
    const result=spawnSync(process.execPath,['--test','tests/browser-live-three-ball-source.cjs'],{cwd:ROOT,env,encoding:'utf8'});
    assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  }
  M=await import('../src/browser-initial-import/live-registered-three-ball.mjs');D=await import('../tools/rapier-snapshot-decoder/browser.mjs');
  Origin=require('../src/experimental-live-three-ball-origin.js');({pack,unpack}=await import('./browser-initial-import-evidence.mjs'));
  const file=process.env.RAPIER_WASM_PROVENANCE??path.resolve(ROOT,'../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json');
  provenance=JSON.parse(fs.readFileSync(file));engine=new Uint8Array(fs.readFileSync(path.join(ROOT,'vendor/rapier.cjs')));wasm=new Uint8Array(fs.readFileSync(provenance.wasmPath));
  decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:engine,wasmBytes:wasm,provenance,expectedWasmSha256:provenance.wasmSha256});
  for(const name of ['default','after-turn']){
    const file=prefix+'.'+name+'.v8';if(name==='after-turn'&&!fs.existsSync(file))continue;
    const raw=v8.deserialize(fs.readFileSync(file)),decoded=await decoder.decodeSnapshot(raw.snapshot),preStrikeDecoded=await decoder.decodeSnapshot(raw.preStrikeSnapshot);
    fixtures.set(name,{raw,decoded,preStrikeDecoded,input:{...copy(raw),decoded,preStrikeDecoded},state:nativeValue(decoded.state),before:nativeValue(preStrikeDecoded.state)});
  }
  absentNative();
});
after(()=>{absentNative();if(temporary)fs.rmSync(temporary,{recursive:true});});
for(const name of ['default','after-turn'])test('read-only '+name+' import preserves full native managers, source cue and three-cushion targets',async t=>{
  if(!fixtures.has(name)){t.skip('Supply real after-turn capture from THREE_BALL_LIVE_SETTLED=1');return;}
  const f=fixtures.get(name),before=copy(f.input),result=await M.projectLiveRegisteredThreeBall(f.input);results.set(name,result);
  assertProjection(result,f);assert.deepEqual(f.input,before);assert.deepEqual(await M.importLiveRegisteredThreeBall(decoder,f.raw),result);
  if(name==='default'){assert.equal(result.sourceOrigin.selectedIndex,0);assert.equal(result.sourceOrigin.createdClock.nativeFrameIndex,72);assert.equal(result.sourceOrigin.createdClock.steps,0);assert.ok(result.sourceOrigin.readiness.bodies.some(b=>!b.sleeping));}
  else{assert.equal(result.sourceOrigin.selectedIndex,1);assert.deepEqual(result.application.registry.objects.map(o=>o.id),[1,2,3]);assert.deepEqual(result.sourceOrigin.targetIds,[1,3]);assert.ok(result.sourceOrigin.createdClock.steps>0);assert.ok(result.sourceOrigin.createdClock.nativeFrameIndex>result.sourceOrigin.createdClock.steps);}
  t.diagnostic(JSON.stringify({name,selectedId:result.sourceOrigin.selectedId,selectedIndex:result.sourceOrigin.selectedIndex,targets:result.sourceOrigin.targetIds,
    clock:result.sourceOrigin.createdClock,nativeStateComplete:true,physicsSteps:0,gpuWork:false,numericalOwnerAvailable:false}));
});
test('sorted transport canonicalizes handles without reindexing objects or changing any value',async()=>{
  for(const [name,f]of fixtures){const sorted=unpack(JSON.parse(JSON.stringify(pack(f.input)))),before=copy(sorted);assert.deepEqual(Object.keys(sorted.capture.application.registry.objects[0].body),['generation','index']);
    const result=await M.projectLiveRegisteredThreeBall(sorted);assert.deepEqual(result,results.get(name));assert.deepEqual(sorted,before);
    assert.deepEqual(Object.keys(result.application.registry.objects[0].body),['index','generation']);
  }
});
test('both snapshots, decoded states, game and targets are owned before the first await',async()=>{
  const x=copy(fixtures.get('default').input),pending=M.projectLiveRegisteredThreeBall(x);
  x.snapshot.fill(0);x.preStrikeSnapshot.fill(0);x.decoded.state={kind:'unit'};x.preStrikeDecoded.state={kind:'unit'};
  x.capture.application.game.pending.targets.reverse();x.capture.preStrikeApplication.controller.routeOptions.targetId=999;x.capture.strikeCreationJournal.length=0;
  assert.deepEqual(await pending,results.get('default'));
});
test('decoder composition owns inputs before either decode awaits',async()=>{
  const f=fixtures.get('default'),x=copy(f.raw),seen=[];let release,entered;
  const barrier=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve);
  const delayed={async decodeSnapshot(bytes){seen.push(bytes);assert.notEqual(bytes,x.snapshot);assert.notEqual(bytes,x.preStrikeSnapshot);if(seen.length===1){entered();await barrier;}return decoder.decodeSnapshot(bytes);}};
  const pending=M.importLiveRegisteredThreeBall(delayed,x);await started;x.snapshot.fill(0);x.preStrikeSnapshot.fill(0);x.capture.application.controller.selectedId=2;release();
  assert.deepEqual(await pending,results.get('default'));assert.deepEqual(seen,[f.raw.preStrikeSnapshot,f.raw.snapshot]);
});
test('decode provenance, bytes, typed state and either snapshot identity fail closed',async()=>{
  for(const slot of ['decoded','preStrikeDecoded'])for(const mutate of [d=>d.sourceRevision='other',d=>d.engineSha256='0'.repeat(64),d=>d.engineVersion='0.22.0',d=>d.verification.nativeBincodeByteIdentical=false,d=>d.verification.javascriptTypedReencodeByteIdentical=false,d=>d.byteLength++,d=>d.inputSha256='0'.repeat(64),d=>d.state={kind:'unit'}]){
    const x=copy(fixtures.get('default').input);mutate(x[slot]);const before=copy(x);await assert.rejects(M.projectLiveRegisteredThreeBall(x));assert.deepEqual(x,before);
  }
  for(const slot of ['snapshot','preStrikeSnapshot'])for(const mutate of [x=>x[slot][17]^=1,x=>x[slot]=new Uint8Array(),x=>x[slot]=Array.from(x[slot])]){
    const x=copy(fixtures.get('default').input);mutate(x);await assert.rejects(M.projectLiveRegisteredThreeBall(x));
  }
});
test('source identity, three-ball rule semantics, turn targets and zero-step origin cannot be relabeled',async()=>{
  const mutations=[
    x=>x.capture.boundary='liveRegisteredStrikeCreated',x=>x.capture.nativeSteps=72,x=>x.capture.candidateInput=false,x=>x.capture.nativeRestoreUsed=false,
    x=>x.capture.application.controller.gameMode='four',x=>x.capture.application.controller.selectedId=2,
    x=>x.capture.application.registry.objects.reverse(),x=>x.capture.application.registry.objects[0].body.generation++,
    x=>x.capture.application.game.threeCushion=false,x=>x.capture.preStrikeApplication.game.kind='four',
    x=>x.capture.application.game.pending.targets=[3,4],x=>x.capture.application.game.pending.targets=[3,2],
    x=>x.capture.application.game.pending.threeCushion=false,x=>x.capture.application.game.pending.foul=true,
    x=>x.capture.application.game.pending.reds=[2],x=>x.capture.application.game.pending.goalCushions=3,
    x=>x.capture.application.controller.routeOptions.targetId=1,x=>x.capture.application.controller.routeOptions.secondId=2,
    x=>x.capture.preStrikeApplication.game.pending={},x=>x.capture.application.steps++,x=>x.capture.application.time++,x=>x.capture.application.shots++,
    x=>x.capture.readiness.anyMotion=true,x=>x.capture.readiness.bodies.reverse(),x=>x.capture.readiness.bodies[0].sleeping=true,
    x=>x.capture.application.cue.selectedId=2,x=>x.capture.application.cue.contacted=true,x=>x.capture.application.events.unshift({kind:'future-contact'}),
    x=>x.capture.strikeCreationJournal[0].phase='liveRegisteredStrikeCreation',x=>x.capture.strikeCreationJournal[0].captureNativeStepsBefore++,
    x=>x.capture.strikeCreationJournal[1].args[1].handle.generation++,x=>x.capture.strikeCreationJournal[9].args=[-.08,.14],
    x=>x.capture.application.params.gravity=0,x=>x.capture.application.controller.settings.speed=11,
    x=>x.capture.expected={},x=>x.capture.futureSnapshot=x.snapshot,x=>x.seed={},x=>x.sourceOrigin={},x=>x.expected={},
  ];
  for(const mutate of mutations){const x=copy(fixtures.get('default').input);mutate(x);const before=copy(x);await assert.rejects(M.projectLiveRegisteredThreeBall(x));assert.deepEqual(x,before);}
});
test('generation-bearing handles reject narrowing, extra fields and wrong numeric types',async()=>{
  const locations=[x=>x.capture.application.registry.objects[0].body,x=>x.capture.preStrikeApplication.registry.objects[0].pairCollider,
    x=>x.capture.application.cue.flex,x=>x.capture.readiness.bodies[0].body,x=>x.capture.strikeCreationJournal[0].result.handle];
  for(const locate of locations)for(const mutate of [h=>h.extra=0,h=>delete h.generation,h=>h.index=-1,h=>h.index=2**32,h=>h.generation='0',h=>h.generation=-0]){
    const x=copy(fixtures.get('default').input);mutate(locate(x));await assert.rejects(M.projectLiveRegisteredThreeBall(x));
  }
});
test('either half of a different native source cannot replace the actual fork pair',async t=>{
  if(!fixtures.has('after-turn')){t.skip('Requires independently captured original after-turn source');return;}
  const a=fixtures.get('default'),b=fixtures.get('after-turn');
  for(const [bytes,decoded]of [['snapshot','decoded'],['preStrikeSnapshot','preStrikeDecoded']]){const x=copy(a.input);x[bytes]=copy(b.input[bytes]);x[decoded]=copy(b.input[decoded]);await assert.rejects(M.projectLiveRegisteredThreeBall(x));}
});
test('accessors, shared storage and unsolicited seed/expected fields reject before decoding',async()=>{
  for(const slot of ['snapshot','preStrikeSnapshot','capture']){
    const x=copy(fixtures.get('default').raw);let gets=0,calls=0;Object.defineProperty(x,slot,{enumerable:true,get(){gets++;throw Error('Getter called');}});
    await assert.rejects(M.importLiveRegisteredThreeBall({decodeSnapshot(){calls++;}},x),/accessors/);assert.equal(gets,0);assert.equal(calls,0);
  }
  for(const slot of ['snapshot','preStrikeSnapshot']){const x=copy(fixtures.get('default').raw);x[slot]=new Uint8Array(new SharedArrayBuffer(x[slot].length));let calls=0;await assert.rejects(M.importLiveRegisteredThreeBall({decodeSnapshot(){calls++;}},x),/shared/i);assert.equal(calls,0);}
  for(const slot of ['seed','expected','sourceOrigin','post']){const x=copy(fixtures.get('default').raw);x[slot]={};let calls=0;await assert.rejects(M.importLiveRegisteredThreeBall({decodeSnapshot(){calls++;}},x));assert.equal(calls,0);}
});
test('separate three-ball origin never broadens the existing four-ball or legacy owner contract',()=>{
  const four=require('../src/experimental-live-registered-origin.js'),threeWorld=require('../src/experimental-three-ball-world.js');
  for(const result of results.values()){
    assert.throws(()=>four.validateSourceOrigin(result.sourceOrigin),/origin|fields|fork/);
    assert.throws(()=>threeWorld.validate(result),/three-ball initial scene/);
    assert.throws(()=>M.requireLiveThreeBallNumericalOwner(result),error=>error.code==='three-ball-live-owner-unavailable');
  }
});
test('genuine Chromium read-only decoder gives identical full projections without Node, Rapier or GPU',{skip:!process.env.RAPIER_TEST_CHROMIUM,timeout:120000},async t=>{
  const http=require('node:http'),{chromium}=require('playwright'),assets=new Map([
    ['/',{type:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Three-ball initial-only source projection</title>'}],
    ['/engine',{type:'application/octet-stream',body:engine}],['/decoder.wasm',{type:'application/wasm',body:wasm}],
  ]);
  for(const [name,f]of fixtures){for(const slot of ['snapshot','preStrikeSnapshot'])assets.set('/'+name+'/'+slot,{type:'application/octet-stream',body:f.raw[slot]});assets.set('/'+name+'/capture',{type:'application/json',body:JSON.stringify(pack(f.raw.capture))});}
  for(const dir of ['src','src/browser-initial-import','tools/rapier-snapshot-decoder'])for(const name of fs.readdirSync(path.join(ROOT,dir)))if(/\.(js|mjs)$/.test(name))assets.set('/'+dir+'/'+name,{type:'text/javascript',body:fs.readFileSync(path.join(ROOT,dir,name))});
  assets.set('/tests/browser-initial-import-evidence.mjs',{type:'text/javascript',body:fs.readFileSync(path.join(ROOT,'tests/browser-initial-import-evidence.mjs'))});
  const server=http.createServer((req,res)=>{const a=assets.get(req.url);if(!a){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':a.type,'cache-control':'no-store'}).end(a.body);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.RAPIER_TEST_CHROMIUM,headless:true,chromiumSandbox:true,ignoreDefaultArgs:['--unsafely-disable-devtools-self-xss-warnings'],args:['--disable-gpu']});
    const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
    const actual=await page.evaluate(async({provenance,names})=>{
      const absent=()=>{for(const name of ['process','Buffer','require','RAPIER','PhysicsLab','LabController'])if(typeof globalThis[name]!=='undefined')throw Error('Unexpected engine/Node global: '+name);};absent();
      const M=await import('/src/browser-initial-import/live-registered-three-ball.mjs'),D=await import('/tools/rapier-snapshot-decoder/browser.mjs'),{pack,unpack}=await import('/tests/browser-initial-import-evidence.mjs');
      const bytes=async url=>new Uint8Array(await(await fetch(url)).arrayBuffer());
      const decoder=await D.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:await bytes('/engine'),wasmBytes:await bytes('/decoder.wasm'),provenance,expectedWasmSha256:provenance.wasmSha256});
      const out={};
      for(const name of names){
        const raw={snapshot:await bytes('/'+name+'/snapshot'),preStrikeSnapshot:await bytes('/'+name+'/preStrikeSnapshot'),capture:unpack(await(await fetch('/'+name+'/capture')).json())};
        const before=JSON.stringify(pack(raw)),result=await M.importLiveRegisteredThreeBall(decoder,raw);
        if(JSON.stringify(pack(raw))!==before)throw Error('Caller input changed');
        let unavailable=false;try{M.requireLiveThreeBallNumericalOwner(result);}catch(error){unavailable=error.code==='three-ball-live-owner-unavailable';}if(!unavailable)throw Error('Missing owner did not fail closed');
        const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(pack(result))));out[name]=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
      }
      absent();return out;
    },{provenance,names:[...fixtures.keys()]});
    for(const [name,result]of results)assert.equal(actual[name],hash(JSON.stringify(pack(result))),'Complete browser vs Node read-only projection equality');
    t.diagnostic(JSON.stringify({browser:await browser.version(),completeProjectionEquality:[...fixtures.keys()],noNodeGlobals:true,noNativeEngine:true,physicsSteps:0,gpuWork:false,missingOwnerExplicit:true}));
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
