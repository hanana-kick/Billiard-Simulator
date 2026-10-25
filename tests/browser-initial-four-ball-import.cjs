'use strict';
// Import/admission differential only. No native init/restore/step or GPU work.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),v8=require('node:v8'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const F=require('./four-ball-created-fixture.cjs'),E=require('./four-ball-world-seed.cjs'),Hull=require('../src/experimental-cue-convex-topology'),World=require('../src/experimental-four-ball-world');
const copy=x=>structuredClone(x),nativeHandle=h=>{const v=new DataView(new ArrayBuffer(8));v.setUint32(0,h.index,true);v.setUint32(4,h.generation,true);return v.getFloat64(0,true);};
let row,record,input,want,M,B,p,wasm,decoder;
const forbidden=()=>{throw Error('Import tests must never initialize, restore or step native physics');},restore=[];
before(async()=>{
 for(const [o,k]of [[F.R,'init'],[F.R.World,'restoreSnapshot'],[F.R.World.prototype,'step']]){restore.push([o,k,o[k]]);o[k]=forbidden;}
 const file=process.env.FOUR_BALL_CREATION_V8??'/tmp/billiard-original-four-ball-created-canonical-v1.v8',bytes=fs.readFileSync(file);
 assert.equal(hash(bytes),'b5f71e27d9dad8aec70ccc3cb17a8001ac199540de8f6f44a802943377926187','Unchanged archived original controller record');
 record=v8.deserialize(bytes);row=record.boundaries.strikeCreated;
 const capture={...Object.fromEntries(['boundary','candidateInput','nativeSteps','apiJournalLength','application'].map(k=>[k,copy(row[k])])),modeCreationJournal:copy(record.modeCreationJournal),strikeCreationJournal:copy(record.strikeCreationJournal)};
 const decoded={schemaVersion:1,parryVersion:'0.31.1',state:copy(row.typedState),sourceRevision:row.sourceRevision,engineSha256:row.engineSha256,engineVersion:'0.21.0',verification:copy(row.verification),byteLength:row.snapshotBytes,inputSha256:row.snapshotSha256};
 input={snapshot:copy(row.snapshot),decoded,capture};M=await import('../src/browser-initial-import/four-ball.mjs');B=await import('../tools/rapier-snapshot-decoder/browser.mjs');
 want=E.exportInitialSeed({strikeCreated:row,modeCreationJournal:record.modeCreationJournal,strikeCreationJournal:record.strikeCreationJournal});
 if(process.env.RAPIER_WASM_PROVENANCE){p=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE,'utf8'));wasm=new Uint8Array(fs.readFileSync(p.wasmPath));decoder=await B.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.join(ROOT,'vendor/rapier.cjs'))),wasmBytes:wasm,provenance:p,expectedWasmSha256:p.wasmSha256});}
});
after(()=>{for(const[o,k,fn]of restore)o[k]=fn;});
test('pure initial native projection equals the whole current exporter and passes the same runtime authority',async()=>{
 const before=copy(input),got=await M.projectInitialFourBall(input);
 assert.deepEqual(got,want);assert.deepEqual(input,before);World.validate(want);World.validate(got);
 for(const s of got.cushionSeeds)for(const c of s.cushions){Hull.assertNativeHull(c.hull);assert.throws(()=>Hull.assertNativeHull(copy(c.hull)),/exportNativeHull/);}
 assert.equal(got.balls[3].state.topology,undefined);assert.equal(got.globalEdges.length,3);assert.equal(got.pairSeeds.length,6);
});
function assertCanonicalBindingHandles(seed){
 const birth=seed.cueBroadSeed.initialFourBallBirth,cloth=seed.clothBirthSeed;
 // This is the unchanged runtime bindGeometry identity condition at
 // experimental-four-ball-cloth-birth.js, not order-insensitive deep equality.
 for(const [a,b]of [[birth.body,cloth.body.handle],[birth.primary,cloth.ball.handle],[birth.pair,cloth.passive.handle],[birth.clothCollider,cloth.floor.handle]])assert.equal(JSON.stringify(a),JSON.stringify(b));
 const seen=new WeakSet(),pending=[seed];let handles=0;
 while(pending.length){const x=pending.pop();if(!x||typeof x!=='object'||seen.has(x)||ArrayBuffer.isView(x))continue;seen.add(x);
  if(Object.hasOwn(x,'index')&&Object.hasOwn(x,'generation')){assert.deepEqual(Object.keys(x),Object.hasOwn(x,'bitsHex')?['index','generation','bitsHex']:['index','generation']);handles++;}
  else pending.push(...Object.values(x));
 }
 assert.ok(handles>100,'All initial registry, pair, graph, cue and creation-journal handle outputs inspected');
 return handles;
}
test('sorted evidence roundtrip preserves full exporter values and canonical initial binding handles',async()=>{
 const {pack,unpack}=await import('./browser-initial-import-evidence.mjs'),transport=unpack(JSON.parse(JSON.stringify(pack(input))));
 assert.deepEqual(Object.keys(transport.capture.application.registry.objects[3].body),['generation','index']);
 assert.deepEqual(Object.keys(transport.capture.modeCreationJournal[0].result.handle),['generation','index']);
 const before=copy(transport),seed=await M.projectInitialFourBall(transport);
 assert.deepEqual(seed,want);assertCanonicalBindingHandles(seed);World.validate(seed);assert.deepEqual(transport,before);
 assert.deepEqual(Object.keys(transport.capture.application.registry.objects[3].body),['generation','index'],'Caller representation is never mutated');
});
test('canonical handle representation never discards extra fields, narrows values or replaces generations',async()=>{
 for(const locate of [x=>x.capture.application.registry.objects[3].body,x=>x.capture.application.cue.shaft,x=>x.capture.modeCreationJournal[0].result.handle,x=>x.capture.strikeCreationJournal[1].args[1].handle]){
  for(const mutate of [h=>h.extra=0,h=>delete h.generation,h=>h.index=-1,h=>h.index=2**32,h=>h.index=.5,h=>h.generation='0',h=>h.generation=-0,h=>h.generation++]){
   const bad=copy(input);mutate(locate(bad));const before=copy(bad);await assert.rejects(M.projectInitialFourBall(bad));assert.deepEqual(bad,before);
  }
 }
});
test('actual downloaded live capture roundtrips into exact native binding identity without engine work',{skip:!process.env.LIVE_FOUR_BALL_CAPTURE_JSON||!process.env.RAPIER_WASM_PROVENANCE},async()=>{
 const bytes=fs.readFileSync(process.env.LIVE_FOUR_BALL_CAPTURE_JSON);assert.equal(hash(bytes),process.env.LIVE_FOUR_BALL_CAPTURE_SHA256,'Explicit immutable live source artifact');
 const {unpack}=await import('./browser-initial-import-evidence.mjs'),artifact=unpack(JSON.parse(bytes));
 assert.equal(artifact.schema,'live-original-four-ball-initial-capture-v1');assert.equal(artifact.observed.status,'PASS');
 const transported={snapshot:artifact.snapshot,capture:artifact.capture},before=copy(transported);
 assert.deepEqual(Object.keys(transported.capture.application.registry.objects[3].body),['generation','index']);
 const seed=await M.importInitialFourBall(decoder,transported);
 assert.deepEqual(seed,want);assertCanonicalBindingHandles(seed);World.validate(seed);assert.deepEqual(transported,before);
});
test('pinned provenance, exact bytes, typed mutation, application phase and journal failures reject without mutation',async()=>{
 const mutations=[
  x=>x.decoded.sourceRevision='untrusted',x=>x.decoded.engineSha256='0'.repeat(64),x=>x.decoded.parryVersion='other',x=>x.decoded.engineVersion='0.22.0',x=>x.decoded.verification.nativeBincodeByteIdentical=false,x=>x.decoded.verification.javascriptTypedReencodeByteIdentical=false,x=>x.decoded.byteLength++,x=>x.decoded.inputSha256='0'.repeat(64),
  x=>x.snapshot[17]^=1,x=>B.findStructs(x.decoded.state,'RigidBody')[0].fields[0][1].kind='unit',
  x=>x.capture.boundary='firstH.postApplication',x=>x.capture.candidateInput=false,x=>x.capture.nativeSteps++,x=>x.capture.application.steps++,x=>x.capture.application.time=1/61440,x=>x.capture.application.shots++,x=>x.capture.application.controller.settings.angle=15,x=>x.capture.application.params.tipFriction=.9,
  x=>x.capture.application.registry.objects[0].body.generation++,x=>x.capture.application.registry.objects[0].collider.generation++,x=>x.capture.application.registry.objects[0].radius=.03,x=>x.capture.application.registry.objects.reverse(),x=>x.capture.application.controller.selectedId=2,x=>x.capture.application.cue.contacts.push(1),x=>x.capture.application.cue.contacted=true,x=>x.capture.application.cue.pose.direction.x=0,
  x=>x.capture.application.game.pending.reds.push(3),x=>x.capture.application.game.pending.foul=true,x=>x.capture.modeCreationJournal[0].nativeStepsAfter++,x=>x.capture.strikeCreationJournal[1].args[1].handle.index++,x=>x.capture.modeCreationJournal.reverse(),x=>x.capture.strikeCreationJournal.pop(),x=>x.capture.expected=record.boundaries['firstH.postWorld'],x=>x.seed=want
 ];
 for(const mutate of mutations){const bad=copy(input);mutate(bad);const before=copy(bad);await assert.rejects(M.projectInitialFourBall(bad));assert.deepEqual(bad,before);}
});
test('a byte-verified later native snapshot cannot masquerade as strikeCreated',async()=>{
 const later=record.boundaries['firstH.postApplication'],bad=copy(input);Object.assign(bad,{snapshot:copy(later.snapshot),decoded:{...bad.decoded,state:copy(later.typedState),byteLength:later.snapshotBytes,inputSha256:later.snapshotSha256}});
 const before=copy(bad);await assert.rejects(M.projectInitialFourBall(bad));assert.deepEqual(bad,before);
});
test('owned initial input is stable when callers mutate snapshot, typed tree and application across an await',async()=>{
 const mutable=copy(input),pending=M.projectInitialFourBall(mutable);mutable.snapshot.fill(0);mutable.decoded.state={kind:'unit'};mutable.capture.application.controller.settings.angle=15;mutable.capture.strikeCreationJournal.length=0;
 assert.deepEqual(await pending,want);
});
test('Node and browser hull exports share complete data, private brand, schema and mutation guards',async()=>{
 const rail=row.application.registry.statics.find(s=>s.kind==='cushion'),handle=nativeHandle(rail.collider),d=copy(input.decoded);
 const sync=Hull.exportNativeHull(d,handle,F.D),asyncHull=await Hull.exportNativeHullBrowser(d,handle,B);assert.deepEqual(asyncHull,sync);Hull.assertNativeHull(sync);Hull.assertNativeHull(asyncHull);
 const pending=Hull.exportNativeHullBrowser(d,handle,B);d.state={kind:'unit'};assert.deepEqual(await pending,sync);
 for(const mutate of[x=>x.sourceRevision='wrong',x=>x.byteLength=33*1024*1024,x=>x.verification.javascriptTypedReencodeByteIdentical=false,x=>x.state={kind:'unit'}]){const bad=copy(input.decoded);mutate(bad);const before=copy(bad);assert.throws(()=>Hull.exportNativeHull(bad,handle,F.D));await assert.rejects(Hull.exportNativeHullBrowser(bad,handle,B));assert.deepEqual(bad,before);}
 await assert.rejects(Hull.exportNativeHullBrowser(copy(input.decoded),nativeHandle({...rail.collider,generation:rail.collider.generation+1}),B),/generation/);
 // Struct labels do not alter bincode bytes: original structural guards remain mandatory after hash admission.
 const relabeled=copy(input.decoded);for(const shape of B.findStructs(relabeled.state,'ConvexPolyhedron'))shape.name='NotConvexPolyhedron';assert.equal(hash(B.encodeLosslessTree(relabeled.state)),relabeled.inputSha256);assert.throws(()=>Hull.exportNativeHull(relabeled,handle,F.D),/ConvexPolyhedron/);await assert.rejects(Hull.exportNativeHullBrowser(relabeled,handle,B),/ConvexPolyhedron/);
});
test('browser WASM snapshot decoder composes with pure projection without a native engine',{skip:!process.env.RAPIER_WASM_PROVENANCE},async()=>{
 const actual=await M.importInitialFourBall(decoder,{snapshot:input.snapshot,capture:input.capture});assert.deepEqual(actual,want);World.validate(actual);
});
function runtimeScriptOrder(){
 const seen=new Set(),out=[];
 function visit(name){if(seen.has(name))return;seen.add(name);const file=path.join(ROOT,'src',name+'.js'),src=fs.readFileSync(file,'utf8');for(const m of src.matchAll(/(?:require\('\.\/|load\(')([\w-]+)(?:\.js)?'/g))visit(m[1]);out.push('/src/'+name+'.js');}
 visit('experimental-four-ball-world');return out.filter(x=>!x.endsWith('/experimental-cue-convex-topology.js'));
}
test('real Chromium has no Node globals and admits the same complete projection into existing world validation',{skip:!process.env.RAPIER_WASM_PROVENANCE||!process.env.RAPIER_TEST_CHROMIUM,timeout:90000},async t=>{
 const http=require('node:http'),{chromium}=require('playwright');
 const {pack,unpack}=await import('./browser-initial-import-evidence.mjs');const captured=JSON.stringify(pack(input.capture)),engine=fs.readFileSync(path.join(ROOT,'vendor/rapier.cjs'));
 const assets=new Map([['/',{type:'text/html',body:'<!doctype html><title>Initial-only four-ball import</title>'}],['/decoder.wasm',{type:'application/wasm',body:wasm}],['/engine',{type:'application/octet-stream',body:engine}],['/snapshot',{type:'application/octet-stream',body:row.snapshot}],['/capture',{type:'application/json',body:captured}]]);
 for(const dir of ['src/browser-initial-import','tools/rapier-snapshot-decoder'])for(const name of fs.readdirSync(path.join(ROOT,dir)))if(/\.(js|mjs)$/.test(name))assets.set('/'+dir+'/'+name,{type:'text/javascript',body:fs.readFileSync(path.join(ROOT,dir,name))});
 assets.set('/tests/browser-initial-import-evidence.mjs',{type:'text/javascript',body:fs.readFileSync(path.join(ROOT,'tests/browser-initial-import-evidence.mjs'))});
 const scripts=runtimeScriptOrder();for(const url of [...scripts,'/src/experimental-cue-convex-topology.js'])assets.set(url,{type:'text/javascript',body:fs.readFileSync(path.join(ROOT,url))});
 const server=http.createServer((req,res)=>{const a=assets.get(req.url);if(!a){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':a.type,'cache-control':'no-store'}).end(a.body);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.RAPIER_TEST_CHROMIUM??'/usr/bin/chromium',ignoreDefaultArgs:['--unsafely-disable-devtools-self-xss-warnings'],headless:true,chromiumSandbox:true,args:['--disable-gpu']});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
  const actual=await page.evaluate(async({p,scripts})=>{
   if([typeof Buffer,typeof process,typeof require,typeof RAPIER].some(x=>x!=='undefined'))throw Error('Unexpected Node or native engine globals');
   const M=await import('/src/browser-initial-import/four-ball.mjs'),B=await import('/tools/rapier-snapshot-decoder/browser.mjs'),bytes=async url=>new Uint8Array(await(await fetch(url)).arrayBuffer());
   const decoder=await B.createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:await bytes('/engine'),wasmBytes:await bytes('/decoder.wasm'),provenance:p,expectedWasmSha256:p.wasmSha256});
   const {pack,unpack}=await import('/tests/browser-initial-import-evidence.mjs');const capture=unpack(await(await fetch('/capture')).json()),snapshot=await bytes('/snapshot');
   const seed=await M.importInitialFourBall(decoder,{snapshot,capture});
   for(const url of scripts)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=reject;document.head.append(s);});
   globalThis.LabFourBallWorldExperimental.validate(seed);
   for(const s of seed.cushionSeeds)for(const c of s.cushions)globalThis.LabCueConvexTopologyExperimental.assertNativeHull(c.hull);
   const bad=structuredClone(capture);bad.boundary='firstH.postApplication';let rejected=false;try{await M.importInitialFourBall(decoder,{snapshot,capture:bad});}catch{rejected=true;}if(!rejected)throw Error('Future boundary accepted');
   if(typeof RAPIER!=='undefined'||typeof PhysicsLab!=='undefined')throw Error('Native gameplay engine was loaded');
   return pack(seed);
  },{p,scripts});
  assert.deepEqual(unpack(actual),want);t.diagnostic(JSON.stringify({browser:await browser.version(),noNodeGlobals:true,noNativeEngine:true,physicsSteps:0,gpuWork:false,fullSeedEquality:true,existingWorldAdmission:true}));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
