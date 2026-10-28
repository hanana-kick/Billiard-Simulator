'use strict';
// Independent ORIGINAL PhysicsLab oracle: one native inner h, not one outer
// step. No resident/source-port solver is imported. The only stop hook throws
// before the second compliantTipContact; all first-h original code has run.
const assert=require('node:assert/strict'),fs=require('node:fs'),v8=require('node:v8'),crypto=require('node:crypto');
const R=require('../vendor/rapier.cjs');globalThis.RAPIER=R;
for(const name of ['math','render-cadence','physics','game-rules','controller'])require('../src/'+name+'.js');
const copy=structuredClone,hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function application(c){const lab=c.lab,cue=lab.cue;return{time:lab.time,steps:lab.steps,dt:lab.dt,nativeDt:lab.world.integrationParameters.dt,
 events:copy(lab.events),game:copy(c.game.snapshot()),cuePresent:!!cue,cue:cue?{started:cue.started,contacted:cue.contacted,contacts:copy([...cue.contacts]),obstructions:copy([...cue.obstructions]),stats:copy(cue.stats)}:null,
 outerObjects:lab.objects.map(o=>({id:o.id,distance:o.distance,maxHeight:o.maxHeight,lastPos:copy(o.lastPos),trail:copy(o.trail)}))};}
async function main(){
 await R.init();const {captureLiveRegisteredThreeBall}=await import('../src/browser-initial-import/live-three-ball-capture.mjs');
 const c=new LabController();c.lab=new PhysicsLab(R);c.setupGame();c.select(2);let captured;
 try{
  if(!c.lab.cueClearance(c.lab.get(2),c.state.settings).clear)c.changeSettings({...c.state.settings,elevation:85});
  captured=captureLiveRegisteredThreeBall({controller:c});assert.equal(c.fire(),true);assert.deepEqual(c.lab.world.takeSnapshot(),captured.snapshot,'original continuous fire reproduces authentic input bytes');
  const raw={snapshot:captured.snapshot,preStrikeSnapshot:captured.preStrikeSnapshot,capture:captured.capture},lab=c.lab,before=application(c),trace=[],events=[],stop=new Error('before-second-original-inner-h');let nativeWorldSteps=0,tipCalls=0;
  const original={tip:lab.compliantTipContact,world:lab.world.step,observe:lab.observeCueObstructions,drain:lab.queue.drainCollisionEvents,patch:lab.angularPatchResistance};
  lab.compliantTipContact=function(h){tipCalls++;if(tipCalls===2)throw stop;assert.equal(tipCalls,1);trace.push({method:'compliantTipContact',time:this.time,h});return original.tip.call(this,h);};
  lab.world.step=function(queue){assert.equal(++nativeWorldSteps,1,'exactly one original native step');trace.push({method:'world.step',time:lab.time,h:this.integrationParameters.dt});return original.world.call(this,queue);};
  lab.observeCueObstructions=function(){trace.push({method:'observeCueObstructions',time:this.time});return original.observe.call(this);};
  lab.queue.drainCollisionEvents=function(callback){trace.push({method:'drainCollisionEvents',time:lab.time});return original.drain.call(this,(a,b,started)=>{events.push({a,b,started});return callback(a,b,started);});};
  lab.angularPatchResistance=function(h){trace.push({method:'angularPatchResistance',time:this.time,h});return original.patch.call(this,h);};
  assert.throws(()=>lab.step(1),e=>e===stop);const after=application(c),snapshot=lab.world.takeSnapshot();
  assert.equal(tipCalls,2);assert.equal(nativeWorldSteps,1);assert.equal(after.steps,before.steps);assert.equal(after.time,before.time+before.dt/64);assert.equal(after.nativeDt,Math.fround(before.dt/64));assert.deepEqual(after.outerObjects,before.outerObjects,'outer bookkeeping has not run');
  assert.deepEqual(trace.map(x=>x.method),['compliantTipContact','world.step','observeCueObstructions','drainCollisionEvents','angularPatchResistance']);
  fs.writeFileSync(process.argv[2],v8.serialize({temporaryRoot:require('node:os').tmpdir(),name:'selected-2-original-native-first-inner-h',raw,expected:{snapshot,sourceSnapshotSha256:hash(raw.snapshot),before,after,trace,events,nativeWorldSteps,completedOuterSteps:0,latchedSubdivisions:64,completedInnerSubsteps:1}}),{flag:'wx'});
 }finally{captured?.dispose();clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab.dispose();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
