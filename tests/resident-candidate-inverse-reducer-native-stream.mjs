// HOST ONLY. Fresh unchanged original PhysicsLab streams are independent test
// inputs to generated reducer WGSL evaluated by a scalar HOST VM. No future bank
// is uploaded to a GPU runtime, and no physical world is synthesized by the VM.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
for(const name of ['math','render-cadence','physics','game-rules','route-rules','controller','optimizer-core','inverse-events'])await import('../src/'+name+'.js');
import {createInverseObservationLayout,decodeInverseObservationState,packInverseObservationFrame} from '../src/resident-candidate/inverse-observation-layout.mjs';
import {createInverseReducerTestDriver} from './resident-candidate-inverse-reducer-support.mjs';
const R=createRequire(import.meta.url)('../vendor/rapier.cjs');globalThis.RAPIER=R;
const E=globalThis.LabInverseEvents,settings={angle:0,elevation:8,speed:2,tipX:0,tipY:0};
const topology={id:'known-two-reds-observation',firstId:3,secondId:4,events:[{kind:'object',id:3},{kind:'object',id:4}]};
const late=JSON.parse(fs.readFileSync(new URL('./four-ball-goal-late-opponent-input.json',import.meta.url),'utf8'));
const inputs=[{name:'positive',placements:[{id:1,x:-.5,z:0},{id:2,x:-.8,z:.4},{id:3,x:.0435,z:.0435},{id:4,x:.2615,z:-.2}],h:5480},{name:'late-opponent-foul',placements:late.placements,h:5415}];
function view(e){const keys=['expected','observationStart','eventPrefix','stageResiduals','events','pending','pairs','returnStages','mismatch','observedSubsteps','lastObservationTime','initialObserved','previousMeasurement','firstImpact','unavailable'];return Object.fromEntries(keys.filter(k=>Object.hasOwn(e,k)).map(k=>[k,e[k]]));}
function capture(e,initial,time,stepDt){
 const lab=e.trial.lab,p={...e.cue.body.translation()},objects=[],rails=[];
 for(const{other,cushion,rail,cueCollider,otherCollider}of e.episodeTargets){let impact=false;if(!initial)lab.world.contactPair(cueCollider,otherCollider,m=>{for(let i=0;i<m.numContacts();i++)if(m.contactImpulse(i)>0)impact=true;});
  if(cushion){const r=other.collider.projectPoint(p,true);rails.push({rail,impact,projection:r?{point:{...r.point},isInside:!!r.isInside}:null});}
  else objects.push({id:other.id,radius:other.radius,position:{...other.body.translation()},impact});
 }
 return{phase:initial?'initial-before-world-step':'after-world-step-before-application',sequence:initial?0:e.observedSubsteps+1,time,stepDt,cue:{radius:e.cue.radius,position:p},objects,rails};
}
// Default bounded prefix gives actual native frame authority cheaply. Full
// source-stream differential is an explicit HOST-only command, never GPU opt-in.
const full=process.argv.includes('--full-stream')||process.env.RESIDENT_INVERSE_FULL_STREAM==='1';
for(const input of inputs)test('fresh original '+input.name+' observation stream -> exact generated reducer',async t=>{
 await R.init();const controller=new LabController();let e;const started=performance.now();
 try{
  controller.lab=new PhysicsLab(R);controller.state.gameMode='four';controller.setupGame();for(const p of input.placements)assert.equal(controller.move(p.id,{x:p.x,y:controller.lab.get(p.id).radius+.00005,z:p.z}),true);
  let settle=0;while(settle<2000&&!controller.lab.objects.every(o=>o.body.isSleeping())){controller.lab.step();settle++;}assert.ok(controller.lab.objects.every(o=>o.body.isSleeping()));
  const req={snapshot:controller.lab.snapshot({trails:false}),selectedId:1,testBudget:true,settings,options:{gameMode:'four',mode:'carom',opponentId:2,targetId:3,secondId:4,fourBallThreeCushion:false,methodId:'carom',budget:1,horizon:8,spin:false,objective:'shortest',elevationMode:'fixed',allowKiss:true}};
  e=E.begin(R,req,topology,settings,{purpose:'verify'});assert.ok(e.trial);
  const lab=e.trial.lab,first=capture(e,true,lab.time,0),layout=createInverseObservationLayout({topology,objectIds:first.objects.map(o=>o.id),rails:first.rails.map(r=>r.rail)}),driver=createInverseReducerTestDriver(layout,e.observationStart),hash=createHash('sha256');
  const initial=driver.frame(first);assert.equal(initial.status,1);assert.deepEqual(initial.observation,view(e));hash.update(packInverseObservationFrame(layout,first));
  const native=e.originalWorldStep,patch=lab.angularPatchResistance;let frames=0,queryDoneAt=null;
  e.originalWorldStep=function(...args){const time=lab.time+lab.world.integrationParameters.dt,dt=lab.world.integrationParameters.dt,result=native.apply(this,args),f=capture(e,false,time,dt),out=driver.frame(f);assert.equal(out.status,1,'supported original frame '+f.sequence);frames++;hash.update(packInverseObservationFrame(layout,f));return result;};
  lab.angularPatchResistance=function(...args){assert.deepEqual(decodeInverseObservationState(layout,driver.state).observation,view(e),'all retained source fields before original application h'+frames);return patch.apply(this,args);};
  let outer=0;while(outer<Math.round(8/lab.dt)&&(!full?outer<2:!!lab.cue||!lab.objects.every(o=>o.body.isSleeping()))){
   // After an irreversible legacy query failure, continue the SAME original
   // PhysicsLab only for this full-rest observation oracle, not stepTrial's
   // already-terminal shortcut. No original game/search semantics are changed.
   if(!e.done)E.advance(e,1);else lab.step(1);outer++;if(e.done&&queryDoneAt===null)queryDoneAt=frames;
  }
  assert.equal(frames,full?input.h:128);assert.deepEqual(decodeInverseObservationState(layout,driver.state).observation,view(e));
  const p=driver.project(),source=E.projectResult(e,null,outer);assert.equal(p[1],1);assert.equal(p[3],source.eventPrefix);assert.equal(!!(p[5]&1),source.residualAvailable);assert.equal(!!(p[5]&2),source.topologyMatched);
  const n=at=>new DataView(p.buffer).getFloat64(at*4,true);assert.deepEqual([n(8),n(10),n(12)],source.residuals);assert.equal(p[5]&16?JSON.stringify([p[20],n(16),n(18)]):null,source.contactCell);
  t.diagnostic(JSON.stringify({scope:full?'fresh original full-rest HOST observation stream':'fresh original128h HOST observation prefix',input:input.name,frames,outer,queryDoneAt,events:e.events.length,eventPrefix:e.eventPrefix,streamSha256:hash.digest('hex'),reducerVmInstructions:driver.steps,elapsedMs:performance.now()-started,gpuExecuted:false,worldProducerImplemented:false,finalGameplayQualified:false}));
 }finally{if(e)E.dispose(e);clearTimeout(controller.noticeTimer);clearTimeout(controller.predictionTimer);controller.lab?.dispose();}
});
