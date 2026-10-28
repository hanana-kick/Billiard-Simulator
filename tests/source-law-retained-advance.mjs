import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import '../src/math.js';import '../src/physics.js';import '../src/game-rules.js';import '../src/render-cadence.js';import '../src/controller.js';
import {advanceExperimentalRetainedSupport} from '../src/direct-candidate/source-law-retained-advance.mjs';
import {certifySourceGeneralSlidingDomain,createExperimentalRetainedSupportDomain} from '../src/direct-candidate/source-law-general-segment.mjs';
const budgets={position:1e-9,velocity:1e-9,angular:1e-9,attitude:1e-9};
test('explicit retained-native prefix keeps original height and resumes source support without projection',{skip:!process.env.DIRECT_CUE_RAPIER_PATH},async t=>{
 const R=createRequire(import.meta.url)(process.env.DIRECT_CUE_RAPIER_PATH);await R.init();const c=new globalThis.LabController();let original,hybrid;
 try{c.lab=new globalThis.PhysicsLab(R);c.state.gameMode='four';c.setupGame();for(const p of [{id:1,x:-.5,z:0},{id:2,x:-.8,z:.4},{id:3,x:.0435,z:.0435},{id:4,x:.2615,z:-.2}])assert.ok(c.move(p.id,{x:p.x,y:c.lab.get(p.id).radius+.00005,z:p.z}));for(let i=0;i<2000&&!c.lab.objects.every(o=>o.body.isSleeping());i++)c.lab.step();
  assert.ok(c.lab.strike(1,{angle:0,elevation:8,speed:2,tipX:0,tipY:0},{saveSnapshot:false}).ok);while(c.lab.cue)c.lab.step();const snapshot=c.lab.snapshot({trails:false});original=globalThis.PhysicsLab.fromSnapshot(R,snapshot);hybrid=globalThis.PhysicsLab.fromSnapshot(R,snapshot);
  assert.equal(certifySourceGeneralSlidingDomain(hybrid,.025,{preparedBoundary:true}).eligible,false);const before=hybrid.world.takeSnapshot(),limited=advanceExperimentalRetainedSupport(hybrid,24,{enabled:true,errorBudget:budgets,maxEvaluations:7});assert.equal(limited.advanced,false);assert.deepEqual(hybrid.world.takeSnapshot(),before);assert.equal(createExperimentalRetainedSupportDomain(hybrid,.025).eligible,false);
  const initialY=hybrid.objects[0].body.translation().y,initialVy=hybrid.objects[0].body.linvel().y,result=advanceExperimentalRetainedSupport(hybrid,24,{enabled:true,errorBudget:budgets});assert.equal(result.advanced,true,JSON.stringify(result));assert.equal(result.qualifiedForScoring,false);assert.equal(hybrid.objects[0].body.translation().y,initialY);assert.equal(hybrid.objects[0].body.linvel().y,initialVy);original.step(24);
  const loads=l=>{let n=0;l.world.contactPair(l.objects[0].collider,l.statics.find(o=>o.kind==='cloth').collider,m=>{for(let j=0;j<m.numContacts();j++)n+=Math.max(0,m.contactImpulse(j));});return n;},resume=[];
  for(let i=0;i<6;i++){original.step();hybrid.step();resume.push({original:loads(original),hybrid:loads(hybrid)});assert.equal(hybrid.objects[0].body.linvel().y,0);assert.equal(loads(hybrid),loads(original));}
  const delta={x:hybrid.objects[0].body.translation().x-original.objects[0].body.translation().x,y:hybrid.objects[0].body.translation().y-original.objects[0].body.translation().y,omegaZ:hybrid.objects[0].body.angvel().z-original.objects[0].body.angvel().z};
  hybrid.objects[1].body.wakeUp();assert.equal(createExperimentalRetainedSupportDomain(hybrid,.025,{enabled:true}).eligible,false);
  t.diagnostic(JSON.stringify({rhsEvaluations:result.rhsEvaluations,geometryTests:result.geometryTests,skippedNativePrefixSteps:24,resumedNativeSteps:6,delta,resume,qualified:false}));
 }finally{original?.dispose();hybrid?.dispose();clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab?.dispose();}
});
