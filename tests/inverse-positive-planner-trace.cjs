'use strict';
// Explicit bounded original-CPU planning diagnostic. This is never a GPU search
// input oracle or a CPU fallback. The ordinary planner receives no injected seed.
const fs=require('node:fs'),v8=require('node:v8'),assert=require('node:assert/strict');
const R=require('../vendor/rapier.cjs');for(const n of ['math','render-cadence','physics','game-rules','route-rules','controller','optimizer-core','optimizer','inverse-geometry','inverse-solver','inverse-events','inverse-planner'])require('../src/'+n);
(async()=>{
 await R.init();const totalStart=performance.now(),c=new LabController();c.lab=new PhysicsLab(R);c.state.gameMode='four';c.setupGame();
 try{
  for(const[id,x,z]of [[1,-.5,0],[2,-.8,.4],[3,.0435,.0435],[4,.2615,-.2]])assert.equal(c.move(id,{x,y:c.lab.get(id).radius+.00005,z}),true);
  let settle=0;while(settle<2000&&!c.lab.objects.every(o=>o.body.isSleeping())){c.lab.step();settle++;}assert.ok(c.lab.objects.every(o=>o.body.isSleeping()));
  const settings={angle:0,elevation:8,speed:2,tipX:0,tipY:0},snapshot=c.lab.snapshot({trails:false}),req={snapshot,selectedId:1,settings,options:{searchAlgorithm:'inverse-constraints',gameMode:'four',mode:'carom',opponentId:2,targetId:3,secondId:4,fourBallThreeCushion:false,methodId:'carom',budget:48,horizon:8,spin:false,objective:'shortest',elevationMode:'fixed',allowKiss:true,maxKisses:0,maxCushions:0,minSpeed:.5,maxSpeed:4.5,solveTimeMs:20000}};
  const verify=controls=>{const search={R,req:{...req,settings:controls},count:1,pool:[],successes:[],evaluated:0,rejected:0,successCount:0,started:performance.now()},trial=ShotSearchCore.beginTrial(search,controls);assert.ok(trial);let disposed=false;try{while(!ShotSearchCore.stepTrial(search,trial,1));const result=ShotSearchCore.finishTrial(search,trial);disposed=true;return{result,steps:trial.steps};}finally{if(!disposed)trial.lab.dispose();}};
  const baseline=verify(settings);assert.equal(baseline.result.success,true,'known genuine positive source remains positive under original scorer');
  const setupMs=performance.now()-totalStart,search=LabInversePlanner.createStagedSearch(R,req),started=performance.now(),waves=[],attempts=[];let interrupted=null;
  while(!search.finished){
   if(performance.now()>=search.deadline)break;const jobs=LabInversePlanner.planWave(search);if(!jobs.length)continue;const outcomes=[];
   for(const job of jobs){
    if(performance.now()>=search.deadline){interrupted={jobId:job.id,phase:'before-job'};break;}
    const e=LabInverseEvents.begin(R,job.req,job.topology,job.settings,{purpose:job.purpose}),at=performance.now();
    try{while(!e.done&&performance.now()<search.deadline)LabInverseEvents.advance(e,1);
     if(!e.done){interrupted={jobId:job.id,phase:'incomplete-native-candidate',steps:e.trial?.steps??0,observedSubsteps:e.observedSubsteps??0};break;}
     const outcome=LabInverseEvents.finish(e);attempts.push({id:job.id,wave:job.wave,branchId:job.branchId,purpose:job.purpose,settings:job.settings,elapsedMs:performance.now()-at,outcome});outcomes.push({id:job.id,outcome});
    }finally{LabInverseEvents.dispose(e);}
   }
   if(interrupted||performance.now()>=search.deadline){interrupted??={phase:'before-wave-commit',completedJobs:outcomes.length};break;}
   LabInversePlanner.commitWave(search,outcomes);waves.push({wave:jobs[0].wave,ids:jobs.map(j=>j.id),count:jobs.length,physicalSteps:outcomes.reduce((n,x)=>n+(x.outcome.steps??0),0)});
  }
  const searchWallMs=performance.now()-started;if(!search.finished){search.finished=true;search.paused=true;LabInversePlanner.pause(search);}const result=LabInversePlanner.stagedResult(search);
  const verificationStart=performance.now(),fresh=result.results.length?verify(result.results[0].settings):null,freshVerificationMs=performance.now()-verificationStart;if(fresh)assert.equal(fresh.result.success,true);
  assert.deepEqual(c.lab.snapshot({trails:false}),snapshot);
  const record={schema:'original-positive-inverse-planner-trace-v1',backend:'original-cpu-only',budgetMs:20000,source:{placements:[[1,-.5,0],[2,-.8,.4],[3,.0435,.0435],[4,.2615,-.2]],settings,settle},options:req.options,baseline,setupMs,searchWallMs,freshVerificationMs,totalMs:performance.now()-totalStart,waves,attempts,interrupted,result,fresh,sourceUnchanged:true};
  const file=process.argv[2]??'/tmp/inverse-positive-planner-trace.v8';fs.writeFileSync(file,v8.serialize(record));
  const summary={schema:record.schema,budgetMs:20000,setupMs,searchWallMs,freshVerificationMs,totalMs:record.totalMs,committedWaves:waves.length,committedEvaluations:result.tested,completedAttempts:attempts.length,physicalSteps:result.physicsSteps,observedSubsteps:attempts.reduce((n,x)=>n+x.outcome.observedSubsteps,0),found:result.found,terminationReason:result.terminationReason,interrupted,baseline:{success:baseline.result.success,steps:baseline.steps},fresh:fresh?{success:fresh.result.success,steps:fresh.steps,settings:fresh.result.settings}:null,perWave:waves,attempts:attempts.map(x=>({id:x.id,wave:x.wave,purpose:x.purpose,settings:x.settings,status:x.outcome.status,steps:x.outcome.steps,observedSubsteps:x.outcome.observedSubsteps,elapsedMs:x.elapsedMs})),evidence:file};fs.writeFileSync(file+'.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
 }finally{clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab.dispose();}
})().catch(error=>{console.error(error);process.exitCode=1;});
