'use strict';
// Isolated ORIGINAL CPU evidence producer. Expected results never enter candidate worlds.
const fs=require('node:fs'),v8=require('node:v8'),crypto=require('node:crypto'),path=require('node:path'),assert=require('node:assert/strict');
const R=require('../vendor/rapier.cjs');
for(const n of ['math','render-cadence','physics','game-rules','route-rules','route-sampler','optimizer-core','controller'])require('../src/'+n);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
(async()=>{
 await R.init();const {captureLiveRegisteredFourBall}=await import('../src/browser-initial-import/live-capture.mjs');
 const c=new LabController();c.lab=new PhysicsLab(R);c.state.gameMode='four';c.setupGame();let trial;
 try{
  for(const [id,x,z]of [[1,.9,0],[2,-.4,.4],[3,1.25,0],[4,-.6,-.3]])assert.equal(c.move(id,{x,y:c.lab.get(id).radius+.00005,z}),true);
  for(let n=0;n<2500&&!c.lab.objects.every(o=>o.body.isSleeping());n++)c.lab.step();assert.ok(c.lab.objects.every(o=>o.body.isSleeping()));
  c.state.settings={angle:0,elevation:8,speed:2,tipX:0,tipY:0};
  const before=c.lab.snapshot({trails:false}),clearance=structuredClone(c.lab.cueClearance(c.lab.get(1),c.state.settings));assert.equal(clearance.clear,true);
  const captured=captureLiveRegisteredFourBall({controller:c});
  const raw={snapshot:captured.snapshot,preStrikeSnapshot:captured.preStrikeSnapshot,capture:captured.capture};captured.dispose();
  const req={selectedId:1,settings:structuredClone(c.state.settings),testBudget:true,snapshot:before,options:{mode:'carom',methodId:'carom',gameMode:'four',opponentId:2,targetId:3,secondId:4,fourBallThreeCushion:false,allowKiss:true,budget:1,horizon:8,spin:false,objective:'shortest',elevationMode:'fixed'}};
  const search=ShotSearchCore.createSearch(R,req);trial=ShotSearchCore.beginTrial(search,req.settings);assert.ok(trial);
  assert.deepEqual(trial.lab.world.takeSnapshot(),raw.snapshot,'ordinary beginTrial reproduces actual original captured stroke');
  const admission={kind:'original-prestrike-cue-clearance',initialSnapshotSha256:hash(raw.snapshot),selectedId:1,settings:structuredClone(req.settings),time:before.time,sourceApplicationSteps:before.steps,clearance,strikeAccepted:true,historyContactCount:before.events.filter(e=>e.kind==='contact').length};
  const frames=[];let done=false;
  while(!done){done=ShotSearchCore.stepTrial(search,trial,1);const {lab,input,...accumulator}=trial;frames.push({outerStep:trial.steps,time:lab.time,accumulator:structuredClone(accumulator),done});}
  const result=ShotSearchCore.finishTrial(search,trial);trial=null;
  const {snapshot,...request}=req;
  const sourceHashes=Object.fromEntries(['vendor/rapier.cjs','src/math.js','src/physics.js','src/optimizer-core.js','src/route-rules.js'].map(p=>[p,hash(fs.readFileSync(path.join(__dirname,'..',p)))]));
  fs.writeFileSync(process.argv[2],v8.serialize({schema:'original-four-ball-physical-scoring-v1',sourceHashes,dimensions:structuredClone(LabDimensions),raw,request,admission,expected:{frames,result}}),{flag:'wx'});
  console.log(JSON.stringify({steps:frames.length,result,admission}));
 }finally{if(trial)trial.lab.dispose();clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab.dispose();}
})().catch(e=>{console.error(e);process.exitCode=1;});
