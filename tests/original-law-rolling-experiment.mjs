// Verification only: prepared original PhysicsLab states, no runtime backend.
// Run with the existing trusted bundled Rapier; no GPU or alternate solver.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const rapierPath=process.env.DIRECT_CUE_RAPIER_PATH;
assert.ok(rapierPath,'Explicit trusted DIRECT_CUE_RAPIER_PATH required');
const R=require(rapierPath);await R.init();
const context=vm.createContext({console});
for(const name of ['math','physics'])vm.runInContext(readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),context);
const {PhysicsLab,LabDimensions:D,LabMath:{V}}=context;
const diagnosticMode=process.env.ORIGINAL_ROLLING_DIAGNOSTIC;
const diagnostic=diagnosticMode==='1'||diagnosticMode==='spin';
const baseDt=D.dt,duration=.25,sampleTimes=[.05,.1,.15,.2,.25];
const cases=[
 {name:'rolling',vx:.3,spin:0,friction:.2,rolling:true},
 {name:'rolling-and-spin-stop',vx:.3,spin:1,friction:.2,rolling:true},
 {name:'normal-spin-stop',vx:0,spin:-1,friction:.2,rolling:true},
 {name:'insufficient-friction',vx:.3,spin:0,friction:.001,rolling:false},
 {name:'initial-slip',vx:.3,spin:0,friction:.2,rolling:false,slip:.02},
];
function observe(b){const p=b.translation(),v=b.linvel(),w=b.angvel();return {p:[p.x,p.y,p.z],v:[v.x,v.y,v.z],w:[w.x,w.y,w.z]};}
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const results=[];const wallStart=performance.now();
for(const spec of diagnostic?(diagnosticMode==='spin'?cases.slice(2,3):cases.slice(0,1)):cases){
 const runs=[];
 for(const refinement of diagnostic?[.25,.5,1,2,4]:[1,2,4]){
  const dt=baseDt/refinement,lab=new PhysicsLab(R,{clothFriction:spec.friction},{dt});
  try{
   for(const o of [...lab.objects].slice(1))lab.removeObject(o.id);
   const ball=lab.objects[0],radius=ball.radius,mass=ball.mass,g=lab.params.gravity;
   const settleSteps=Math.round(.2/dt);lab.step(settleSteps);
   ball.body.setLinvel(V(spec.vx,0,0),true);ball.body.setAngvel(V(0,spec.spin,-(spec.vx-(spec.slip??0))/radius),true);
   const initial=observe(ball.body),rollingDeceleration=5*g*lab.params.rollingLength/(7*radius),spinDeceleration=5*g*lab.params.spinLength/(2*radius*radius);
   const mu=ball.collider.friction()*lab.statics.find(o=>o.kind==='cloth').collider.friction();
   const minimumFriction=5*lab.params.rollingLength/(7*radius),initialSlip=Math.hypot(initial.v[0]+radius*initial.w[2],initial.v[2]-radius*initial.w[0]);
   // Admission concerns these prepared states only; observation below still has
   // to establish grounded-load/slip validity. Never overwrite the source load.
   const admission={frictionSufficient:mu>minimumFriction,preparedSlipFree:initialSlip<1e-7};
   const admitted=admission.frictionSufficient&&admission.preparedSlipFree;
   assert.equal(admitted,spec.rolling,spec.name+' admission');
   const loads=[],slips=[],verticalSpeeds=[],samples=[],diagnostics=[];
   const inertia=.4*mass*radius*radius,axis=diagnosticMode==='spin'?1:2;
   let lastPost=initial,stepTorque=0,patchRoundoff=0,patchPredictionError=0,invInertiaError=0;
   const originalTorque=ball.body.applyTorqueImpulse.bind(ball.body);
   if(diagnostic)ball.body.applyTorqueImpulse=function(impulse,wake){
    const before=observe(this),inverse=Array.from(this.effectiveWorldInvInertia().elements);
    const f=Math.fround,row=axis===1?[1,3,4]:[2,4,5],delta=f(f(inverse[row[0]]*f(impulse.x))+f(inverse[row[1]]*f(impulse.y))+f(inverse[row[2]]*f(impulse.z)));
    const torque=axis===1?impulse.y:impulse.z;
    const quantized=f(before.w[axis]+delta);
    originalTorque(impulse,wake);const after=observe(this);
    stepTorque+=torque;patchRoundoff+=(after.w[axis]-before.w[axis])-torque/inertia;
    patchPredictionError=Math.max(patchPredictionError,Math.abs(after.w[axis]-quantized));
    invInertiaError=Math.max(invInertiaError,Math.abs(inverse[axis===1?3:5]*inertia-1));
   };
   const original=lab.angularPatchResistance.bind(lab);
   lab.angularPatchResistance=function(h){
    let impulse=0,manifolds=0,minimumNormalY=1;
    this.world.contactPairsWith(ball.collider,other=>{
     if(this.byCollider.get(other.handle)?.kind!=='cloth')return;
     this.world.contactPair(ball.collider,other,m=>{
      manifolds++;minimumNormalY=Math.min(minimumNormalY,Math.abs(m.normal().y));
      for(let j=0;j<m.numContacts();j++)impulse+=Math.max(0,m.contactImpulse(j));
     });
    });
    loads.push({normalRatio:impulse/(mass*g*h),cappedRatio:Math.min(impulse,mass*g*h)/(mass*g*h),manifolds,minimumNormalY});
    const state=observe(ball.body);slips.push(Math.hypot(state.v[0]+radius*state.w[2],state.v[2]-radius*state.w[0]));verticalSpeeds.push(Math.abs(state.v[1]));
    original(h);
    if(diagnostic){
     const after=observe(ball.body);
     diagnostics.push({time:diagnostics.length*h+h,worldAngularDelta:state.w[axis]-lastPost.w[axis],postAngular:after.w[axis],preSlip:state.v[0]+radius*state.w[2],postSlip:after.v[0]+radius*after.w[2],torqueComponent:stepTorque,worldMomentumResidual:inertia*(state.w[axis]-lastPost.w[axis])-(axis===2?radius*mass*(state.v[0]-lastPost.v[0]):0),patchAngularIncrementError:patchRoundoff,quantizedPatchPredictionError:patchPredictionError,relativeInverseInertiaError:invInertiaError});
     lastPost=after;stepTorque=0;patchRoundoff=0;patchPredictionError=0;invInertiaError=0;
    }
   };
   let sample=0;const sourceSteps=Math.round(duration/dt);
   for(let step=1;step<=sourceSteps;step++){
    lab.step();
    if(step===Math.round(sampleTimes[sample]/dt)){
     const time=step*dt,actual=observe(ball.body),rollingTime=rollingDeceleration>0?Math.min(time,Math.abs(spec.vx)/rollingDeceleration):time;
     const speed=Math.max(0,Math.abs(spec.vx)-rollingDeceleration*time),dx=Math.sign(spec.vx)*(Math.abs(spec.vx)*rollingTime-rollingDeceleration*rollingTime*rollingTime/2);
     const normalSpin=Math.sign(spec.spin)*Math.max(0,Math.abs(spec.spin)-spinDeceleration*time);
     const predicted={p:[initial.p[0]+dx,initial.p[1],initial.p[2]],v:[Math.sign(spec.vx)*speed,0,0],w:[0,normalSpin,-Math.sign(spec.vx)*speed/radius]};
     samples.push({time,actual,predicted,error:{position:distance(actual.p,predicted.p),velocity:distance(actual.v,predicted.v),spin:distance(actual.w,predicted.w)}});sample++;
    }
   }
   const range=(values)=>({min:Math.min(...values),max:Math.max(...values),mean:values.reduce((a,b)=>a+b,0)/values.length});
   runs.push({refinement,dt,sourceSteps,settleSteps,constructorSteps:72,admitted,admission,mu,minimumFriction,initialSlip,rollingDeceleration,spinDeceleration,spinStopTime:Math.abs(spec.spin)/spinDeceleration,load:range(loads.map(x=>x.normalRatio)),cappedLoad:range(loads.map(x=>x.cappedRatio)),minimumManifolds:Math.min(...loads.map(x=>x.manifolds)),minimumNormalY:Math.min(...loads.map(x=>x.minimumNormalY)),prePatchSlip:range(slips),maxVerticalSpeed:Math.max(...verticalSpeeds),samples,...(diagnostic?{diagnostic:{axis,steps:diagnostics,sumTorqueComponent:diagnostics.reduce((a,x)=>a+x.torqueComponent,0),sumWorldMomentumResidual:diagnostics.reduce((a,x)=>a+x.worldMomentumResidual,0),sumPatchAngularIncrementError:diagnostics.reduce((a,x)=>a+x.patchAngularIncrementError,0),maxQuantizedPatchPredictionError:Math.max(...diagnostics.map(x=>x.quantizedPatchPredictionError)),maxRelativeInverseInertiaError:Math.max(...diagnostics.map(x=>x.relativeInverseInertiaError)),finalSignedSlip:diagnostics.at(-1).postSlip,initial,inertia}}:{})});
  }finally{lab.world.free();lab.queue.free();}
  assert.ok(performance.now()-wallStart<55000,'Bounded experiment exceeded 55 seconds');
 }
 const fine=runs.at(-1),baseline=runs.find(r=>r.refinement===1);
 const comparison=sampleTimes.map((time,i)=>({time,analyticErrors:runs.map(r=>r.samples[i].error),baselineToFine:{position:distance(baseline.samples[i].actual.p,fine.samples[i].actual.p),velocity:distance(baseline.samples[i].actual.v,fine.samples[i].actual.v),spin:distance(baseline.samples[i].actual.w,fine.samples[i].actual.w)}}));
 results.push({name:spec.name,expectedAdmission:spec.rolling,runs,comparison});
}
const receipt={kind:'verification-only-original-law-grounded-rolling',rawShot:false,productionEnabled:false,gpu:false,diagnostic,baseDt,duration,wallMs:performance.now()-wallStart,results};
if(process.env.ORIGINAL_ROLLING_RECEIPT)writeFileSync(process.env.ORIGINAL_ROLLING_RECEIPT,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({kind:receipt.kind,wallMs:receipt.wallMs,cases:results.map(c=>({name:c.name,admitted:c.runs[0].admitted,steps:c.runs.map(r=>r.sourceSteps),load:c.runs.map(r=>r.load),slip:c.runs.map(r=>r.prePatchSlip),last:c.comparison.at(-1),...(diagnostic?{diagnostics:c.runs.map(r=>({refinement:r.refinement,sumTorqueComponent:r.diagnostic.sumTorqueComponent,sumWorldMomentumResidual:r.diagnostic.sumWorldMomentumResidual,sumPatchAngularIncrementError:r.diagnostic.sumPatchAngularIncrementError,maxQuantizedPatchPredictionError:r.diagnostic.maxQuantizedPatchPredictionError,maxRelativeInverseInertiaError:r.diagnostic.maxRelativeInverseInertiaError,atPointOne:{sumWorldAngularDelta:r.diagnostic.steps.filter(x=>x.time<=.100000001).reduce((a,x)=>a+x.worldAngularDelta,0),sumPatchAngularIncrementError:r.diagnostic.steps.filter(x=>x.time<=.100000001).reduce((a,x)=>a+x.patchAngularIncrementError,0),sumTorque:r.diagnostic.steps.filter(x=>x.time<=.100000001).reduce((a,x)=>a+x.torqueComponent,0),actual:r.samples[1].actual.w[r.diagnostic.axis],predicted:r.samples[1].predicted.w[r.diagnostic.axis]},finalSignedSlip:r.diagnostic.finalSignedSlip}))}:{})}))},null,2));
