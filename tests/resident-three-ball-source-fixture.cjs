'use strict';
// ORIGINAL assertion-only producer in a separate process. Never imports the
// HOST reducer/admission. Four bounded outer steps, no full-shot preparation.
const assert=require('node:assert/strict'),fs=require('node:fs'),v8=require('node:v8'),crypto=require('node:crypto');
const R=require('../vendor/rapier.cjs');globalThis.RAPIER=R;
for(const name of ['math','render-cadence','physics','game-rules','controller'])require('../src/'+name+'.js');
const copy=structuredClone,hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 await R.init();const {captureLiveRegisteredThreeBall}=await import('../src/browser-initial-import/live-three-ball-capture.mjs'),rows=[];
 for(const selectedId of [1,2]){
  const c=new LabController();c.lab=new PhysicsLab(R);c.setupGame();c.select(selectedId);
  let captured;try{
   // Original controls only; no transforms, sleep forcing or replacement world.
   c.changeSettings({...c.state.settings,speed:4.5});
   if(!c.lab.cueClearance(c.lab.get(selectedId),c.state.settings).clear)c.changeSettings({...c.state.settings,elevation:85});
   assert.equal(c.lab.cueClearance(c.lab.get(selectedId),c.state.settings).clear,true);
   const before=c.lab.world.takeSnapshot(),gameBefore=c.game.snapshot(),eventsBefore=copy(c.lab.events),sourceHash=hash(before);
   captured=captureLiveRegisteredThreeBall({controller:c});
   assert.deepEqual(c.lab.world.takeSnapshot(),before);assert.deepEqual(c.game.snapshot(),gameBefore);assert.deepEqual(c.lab.events,eventsBefore);
   assert.equal(c.fire(),true);assert.deepEqual(captured.snapshot,c.lab.world.takeSnapshot(),'fork creation equals independently fired ORIGINAL native bytes');
   assert.deepEqual(captured.capture.application.game,c.game.snapshot());assert.deepEqual(captured.capture.application.events,c.lab.events);
   assert.deepEqual(captured.capture.application.registry.objects.map(o=>o.id),c.lab.objects.map(o=>o.id));
   const expected={gameBefore,gameCreated:c.game.snapshot(),eventsCreated:copy(c.lab.events),emissions:[],outer:[]};
   c.lab.onEvent=e=>{c.game.contact(e);expected.emissions.push({event:copy(e),game:c.game.snapshot(),events:copy(c.lab.events)});};
   for(let i=0;i<4;i++){c.lab.step();c.finishGameShot();expected.outer.push({game:c.game.snapshot(),events:copy(c.lab.events),cuePresent:!!c.lab.cue,balls:c.lab.objects.map(o=>({id:o.id,sleeping:o.body.isSleeping()}))});}
   rows.push({selectedId,raw:{snapshot:captured.snapshot,preStrikeSnapshot:captured.preStrikeSnapshot,capture:captured.capture},expected,
    evidence:{independentOriginalCreationByteEqual:true,sourceUnchanged:true,sourceHash,createdHash:hash(captured.snapshot),captureSteps:0,originalAssertionOuterSteps:4,temporaryRoot:require('node:os').tmpdir(),gpu:false,fullShot:false}});
  }finally{captured?.dispose();clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab.dispose();}
 }
 fs.writeFileSync(process.argv[2],v8.serialize(rows),{flag:'wx'});
}
main().catch(e=>{console.error(e);process.exitCode=1;});
