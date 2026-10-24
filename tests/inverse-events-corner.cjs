'use strict';
// Component holdout: corner cue-clearance restoration + ONE target contact.
// This is NOT an assertion that the general two-object 3/4-ball corner problem
// is solved. No historically winning cue settings are used as a seed.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const R=require('@dimforge/rapier3d-compat');
for(const name of ['math','physics','route-rules','optimizer-core','inverse-events'])require('../src/'+name+'.js');
require(process.env.INVERSE_GEOMETRY_PATH||'../src/inverse-geometry.js');
require(process.env.INVERSE_SOLVER_PATH||'../src/inverse-solver.js');
test('corner single-contact component restores a blocked seed through constrained solver and fresh replay',async(t)=>{
 await R.init();const lab=new PhysicsLab(R),started=Date.now(),deadline=started+20000,trace=[];
 try{
  const cue=lab.get(1),target=lab.get(2),y=cue.radius+.00005;
  cue.body.setTranslation({x:-1.37,y,z:-.66},true);target.body.setTranslation({x:-.7,y,z:.01},true);lab.world.propagateModifiedBodyPositionsToColliders();
  const snapshot=lab.snapshot({trails:false}),source=Buffer.from(lab.world.takeSnapshot()),h={x:LabDimensions.width/2-cue.radius,z:LabDimensions.depth/2-cue.radius};
  const root=LabInverseGeometry.firstContactInitializer(cue.body.translation(),target.body.translation(),cue.radius+target.radius,[],h);
  assert.ok(root);const seed={angle:root.angle,speed:2,elevation:0,tipX:0,tipY:0};
  assert.ok(Math.abs(seed.angle-45)<1e-4);assert.equal(lab.cueClearance(cue,seed).clear,false);
  const topology={id:'corner-single-contact-component',firstId:2,secondId:3,events:[{kind:'object',id:2}]};
  const req={snapshot,selectedId:1,settings:seed,options:{mode:'target',targetId:2,secondId:3,horizon:8,spin:true,objective:'shortest',allowKiss:true,elevationMode:'search',minElevation:0,maxElevation:60,minSpeed:.5,maxSpeed:4.5}};
  const solve=maxElevation=>{
   const request={...req,options:{...req.options,maxElevation}},state=LabInverseSolver.create({id:topology.id+'-'+maxElevation,topology,seed,bounds:{angle:[seed.angle-180,seed.angle+180],elevation:[0,maxElevation],speed:[.5,4.5],tipX:[-.55,.55],tipY:[-.45,.45]},tipRadius:.6},{maxIterations:40,deadline});
   let interrupted=false,last=null,physicsSteps=0;
   while(state.status==='running'&&Date.now()<deadline){
    const jobs=LabInverseSolver.next(state);if(!jobs.length)break;const outcomes=[];
    for(const job of jobs){
     if(Date.now()>=deadline){interrupted=true;break;}
     const e=LabInverseEvents.begin(R,request,topology,job.settings,{purpose:job.purpose==='verify'?'verify':job.purpose==='clearance'?'clearance':'evaluate'});
     while(!LabInverseEvents.advance(e,32)){if(Date.now()>=deadline){LabInverseEvents.dispose(e);interrupted=true;break;}}
     if(interrupted)break;
     last=LabInverseEvents.finish(e);physicsSteps+=last.steps;
     trace.push({maxElevation,purpose:job.purpose,settings:last.settings,status:last.status,clearance:last.clearance,residualNorm:Math.hypot(...last.residuals),residualStage:last.residualStage,eventPrefix:last.eventPrefix,goalVerified:last.goalVerified,verified:last.verified,steps:last.steps});
     outcomes.push({...last,id:job.id,verification:job.purpose==='verify'?{verified:last.verified,physicalResult:last.physicalResult}:undefined});
    }
    if(interrupted)break;LabInverseSolver.accept(state,outcomes);
   }
   const outcome=LabInverseSolver.result(state);if(interrupted||state.status==='running'){outcome.status='time-limit';outcome.reason='20-second component-holdout wall deadline';}
   return{...outcome,physicsSteps,last: last&&{status:last.status,clearance:last.clearance,stage:last.residualStage,residualNorm:Math.hypot(...last.residuals)},phase:state.phase};
  };
  const positive=solve(60),negative=Date.now()<deadline?solve(5):{status:'not-run',reason:'shared wall deadline consumed'};
  assert.deepEqual(Buffer.from(lab.world.takeSnapshot()),source);
  const report={scope:'single-contact corner clearance component only',elapsedMs:Date.now()-started,seed,sourceUnchanged:true,positive,negative,trace};
  if(process.env.INVERSE_CORNER_REPORT)fs.writeFileSync(process.env.INVERSE_CORNER_REPORT,JSON.stringify(report,null,2));
  t.diagnostic(JSON.stringify({scope:report.scope,elapsedMs:report.elapsedMs,positive:{status:positive.status,phase:positive.phase,reason:positive.reason,iterations:positive.iterations,evaluations:positive.evaluations,last:positive.last},negative:{status:negative.status,phase:negative.phase,reason:negative.reason,last:negative.last}}));
  assert.equal(positive.status,'verified',JSON.stringify({phase:positive.phase,reason:positive.reason,last:positive.last}));
  assert.equal(positive.verification.verified,true);assert.equal(positive.verification.physicalResult.success,true);assert.notEqual(positive.verification.physicalResult.failureReason,'cue-obstruction');assert.ok(positive.settings.elevation<=60);
  // A failed 5-degree constrained run is numerical non-convergence/blocked,
  // never a proof that no physically possible shot exists in that domain.
  assert.notEqual(negative.status,'infeasible');
 }finally{lab.dispose();}
});
