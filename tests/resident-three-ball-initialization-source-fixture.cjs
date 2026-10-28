'use strict';
// Independent ORIGINAL native API oracle. Never imports resident/source-port
// initialization code. No world.step or fullshot is used after construction.
const assert=require('node:assert/strict'),fs=require('node:fs'),v8=require('node:v8'),crypto=require('node:crypto');
const R=require('../vendor/rapier.cjs');globalThis.RAPIER=R;
for(const name of ['math','render-cadence','physics','game-rules','controller'])require('../src/'+name+'.js');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function handle(h){const d=new DataView(new ArrayBuffer(8));d.setUint32(0,h.index,true);d.setUint32(4,h.generation,true);return d.getFloat64(0,true);}
function nativeMass(raw){
 const world=R.World.restoreSnapshot(raw.snapshot),calls=[];try{
  // Native deserialization may reorder serialized map entries. Record the
  // restored boundary separately; HOST verifies every body/collider field.
  const restoredSnapshot=world.takeSnapshot();world.step=()=>assert.fail('No native physics step belongs to the mass API oracle');
  for(const role of ['shaft','head','guide']){const h=raw.capture.application.cue[role];world.getRigidBody(handle(h)).recomputeMassPropertiesFromColliders();calls.push({method:'recomputeMassPropertiesFromColliders',role,handle:h});}
  world.propagateModifiedBodyPositionsToColliders();calls.push({method:'propagateModifiedBodyPositionsToColliders'});
  return{snapshot:world.takeSnapshot(),restoredSnapshot,sourceSnapshotSha256:hash(raw.snapshot),calls,worldSteps:0,internalRegistrationBoundaryObserved:false};
 }finally{world.free();}
}
async function main(){
 await R.init();const {captureLiveRegisteredThreeBall}=await import('../src/browser-initial-import/live-three-ball-capture.mjs'),rows=[];
 for(const selectedId of [1,2]){
  const c=new LabController();c.lab=new PhysicsLab(R);c.setupGame();c.select(selectedId);let captured;
  try{
   if(!c.lab.cueClearance(c.lab.get(selectedId),c.state.settings).clear)c.changeSettings({...c.state.settings,elevation:85});
   const before=c.lab.world.takeSnapshot();captured=captureLiveRegisteredThreeBall({controller:c});assert.deepEqual(c.lab.world.takeSnapshot(),before);
   assert.equal(c.fire(),true);assert.deepEqual(c.lab.world.takeSnapshot(),captured.snapshot,'independent original fire reproduces exact created bytes');
   const raw={snapshot:captured.snapshot,preStrikeSnapshot:captured.preStrikeSnapshot,capture:captured.capture};
   const expectedNativeMass=nativeMass(raw);assert.deepEqual(c.lab.world.takeSnapshot(),raw.snapshot,'native oracle runs on an independent restored clone');
   rows.push({name:'selected-'+selectedId,raw,expectedNativeMass});
  }finally{captured?.dispose();clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab.dispose();}
 }
 const prefix=process.env.THREE_BALL_LIVE_CAPTURE_PREFIX;
 if(prefix){const raw=v8.deserialize(fs.readFileSync(prefix+'.after-turn.v8'));rows.push({name:'immutable-after-turn',raw,expectedNativeMass:nativeMass(raw)});}
 fs.writeFileSync(process.argv[2],v8.serialize({temporaryRoot:require('node:os').tmpdir(),rows}),{flag:'wx'});
}
main().catch(e=>{console.error(e);process.exitCode=1;});
