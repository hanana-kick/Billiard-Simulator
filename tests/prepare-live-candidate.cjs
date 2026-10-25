'use strict';
const {test,before}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=require('../vendor/rapier.cjs');for(const n of ['math','render-cadence','physics','game-rules','controller'])require('../src/'+n);
let prepare,decoder,capture;const input=(speed=1.25)=>({settings:{angle:0,elevation:8,tipX:0,tipY:0,speed},rules:{fourBallThreeCushion:speed>2}});
before(async()=>{await R.init();({prepareLiveFourBallCandidate:prepare}=await import('../src/browser-initial-import/prepare-live-candidate.mjs'));({captureLiveRegisteredFourBall:capture}=await import('../src/browser-initial-import/live-capture.mjs'));const {createSnapshotDecoder}=await import('../tools/rapier-snapshot-decoder/browser.mjs');
 const p=JSON.parse(fs.readFileSync(process.env.RAPIER_WASM_PROVENANCE??path.resolve(__dirname,'../../billiard-browser-snapshot-decoder/.browser-decoder-build/snapshot-wasm-decoder-provenance.json')));
 decoder=await createSnapshotDecoder({engineVersion:'0.21.0',engineBytes:new Uint8Array(fs.readFileSync(path.resolve(__dirname,'../vendor/rapier.cjs'))),wasmBytes:new Uint8Array(fs.readFileSync(p.wasmPath)),provenance:p,expectedWasmSha256:p.wasmSha256});});
function create(){const c=new LabController();c.lab=new PhysicsLab(R);c.state.gameMode='four';c.setupGame();for(let n=0;n<2000&&!c.lab.objects.every(o=>o.body.isSleeping());n++)c.lab.step();assert.ok(c.lab.objects.every(o=>o.body.isSleeping()));return c;}
function free(c){clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab.dispose();}
function state(c){return structuredClone({physics:c.lab.snapshot(),state:c.state,game:c.game.snapshot(),undo:c.undoStack,redo:c.redoStack});}
function tracked(c){let freed=0;const fork=c.lab.fork;c.lab.fork=function(){const lab=fork.call(this),dispose=lab.dispose;lab.dispose=function(){freed++;return dispose.call(this);};return lab;};return()=>freed;}
test('cohesive capture/import binds two genuine clearances; fork freed before decode and source untouched',async()=>{
 const c=create(),baseline=state(c),count=tracked(c),originalStep=R.World.prototype.step;let steps=0;
 R.World.prototype.step=function(...args){steps++;return originalStep.apply(this,args);};
 try{for(const speed of [1.25,2.75]){const candidate=input(speed),q=c.lab.fork();let expected;try{expected=q.cueClearance(q.get(c.state.selectedId),candidate.settings);}finally{q.dispose();}
 const prior=count(),checked={decodeSnapshot(bytes){assert.equal(count(),prior+1,'Preparation native fork disposed before async decode');return decoder.decodeSnapshot(bytes);}};
 const result=await prepare({controller:c,candidate,decoder:checked});assert.deepEqual(result.admission.clearance,{clear:expected.clear,distance:expected.distance});assert.equal(result.admission.initialSnapshotSha256,result.seed.initialSnapshotSha256);assert.deepEqual(result.admission.settings,candidate.settings);assert.deepEqual(result.admission.rules,candidate.rules);assert.equal(result.seed.game.pending.threeCushion,candidate.rules.fourBallThreeCushion);assert.equal(result.admission.sourceRevision,baseline.physics.revision);assert.equal(result.admission.historyContactCount,result.seed.initialContactEvents.length);
 assert.throws(()=>{result.admission.clearance.distance=99;},TypeError);assert.throws(()=>{result.admission.settings.speed=9;},TypeError);assert.deepEqual(state(c),baseline);}
 assert.equal(steps,0);
 }finally{R.World.prototype.step=originalStep;free(c);}
});
test('rejects detached receipt/projected seed, mismatched decoded capture and cancellation; cleans native fork',async()=>{
 const c=create(),baseline=state(c),count=tracked(c);let other;
 try{
  for(const key of ['admission','seed','capture','raw'])await assert.rejects(prepare({controller:c,candidate:input(),decoder,[key]:{}}),/accepts/);assert.equal(count(),0);
  other=capture({controller:c,candidate:input(2.75)});const wrong=await decoder.decodeSnapshot(other.snapshot);other.dispose();other=null;
  const prior=count();let calls=0;
  await assert.rejects(prepare({controller:c,candidate:input(),decoder:{decodeSnapshot(bytes){return ++calls===2?structuredClone(wrong):decoder.decodeSnapshot(bytes);}}}));assert.equal(count(),prior+1);
  const foreign=create();let foreignCapture;
  try{assert.equal(foreign.move(3,{x:.3,y:foreign.lab.get(3).radius+.00005,z:.1}),true);for(let n=0;n<2000&&!foreign.lab.objects.every(o=>o.body.isSleeping());n++)foreign.lab.step();
   foreignCapture=capture({controller:foreign,candidate:input()});const wrongBefore=await decoder.decodeSnapshot(foreignCapture.preStrikeSnapshot);
   await assert.rejects(prepare({controller:c,candidate:input(),decoder:{decodeSnapshot(){return structuredClone(wrongBefore);}}}));
  }finally{foreignCapture?.dispose();free(foreign);}
  const signal=new AbortController();signal.abort(new Error('before'));await assert.rejects(prepare({controller:c,candidate:input(),decoder,signal:signal.signal}),/before/);assert.equal(count(),prior+2);
  const during=new AbortController();await assert.rejects(prepare({controller:c,candidate:input(),signal:during.signal,decoder:{async decodeSnapshot(bytes){const out=await decoder.decodeSnapshot(bytes);during.abort(new Error('during'));return out;}}}),/during/);assert.equal(count(),prior+3);assert.deepEqual(state(c),baseline);
 }finally{other?.dispose();free(c);}
});
test('owns proposed controls across decoder await, refuses genuine blocked geometry',async()=>{
 const c=create(),baseline=state(c),candidate=input();
 try{const result=await prepare({controller:c,candidate,decoder:{decodeSnapshot(bytes){candidate.settings.speed=9;candidate.rules.fourBallThreeCushion=true;return decoder.decodeSnapshot(bytes);}}});assert.deepEqual(result.admission.settings,input().settings);assert.deepEqual(result.admission.rules,input().rules);
 const blocked=[0,45,90,135,180,-45,-90,-135].map(angle=>({settings:{...input().settings,angle,elevation:0},rules:input().rules})).find(x=>!c.lab.cueClearance(c.lab.get(c.state.selectedId),x.settings).clear);assert.ok(blocked);
 await assert.rejects(prepare({controller:c,candidate:blocked,decoder}),/clearance refused/);assert.deepEqual(state(c),baseline);
 }finally{free(c);}
});
test('same-realm authority binds request bytes and owns numerical seed against caller mutation',async()=>{
 const {assertPreparedLiveFourBallCandidate:admit}=await import('../src/browser-initial-import/prepare-live-candidate.mjs'),c=create();
 try{const snapshot=c.lab.snapshot({trails:false}),p=await prepare({controller:c,candidate:input(),decoder}),expected=p.seed.balls[0].state.translation.slice();
  assert.throws(()=>admit({...p},snapshot),/same-realm/);assert.throws(()=>admit(structuredClone(p),snapshot),/same-realm/);
  const bad=structuredClone(snapshot);bad.world[0]^=1;assert.throws(()=>admit(p,bad),/snapshot/);assert.throws(()=>admit(p,{...snapshot,revision:snapshot.revision+1}),/snapshot/);const edited=structuredClone(snapshot);edited.objects[0].radius+=.001;assert.throws(()=>admit(p,edited),/snapshot/);
  p.seed.balls[0].state.translation[0]=999;const owned=admit(p,snapshot);assert.deepEqual(owned.seed.balls[0].state.translation,expected);owned.seed.balls[0].state.translation[0]=888;assert.deepEqual(admit(p,snapshot).seed.balls[0].state.translation,expected);
 }finally{free(c);}
});
