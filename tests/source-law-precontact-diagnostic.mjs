// Bounded read-only diagnosis of ORIGINAL forward sliding before any ball impact.
// No patched forces, solver inputs, future states or acceptance-tolerance changes.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {prepareCollinearSegment,evaluateCollinearMotion} from '../src/direct-candidate/source-law-collinear-segment.mjs';
const R=createRequire(import.meta.url)(process.env.DIRECT_CUE_RAPIER_PATH??fileURLToPath(new URL('../vendor/rapier.cjs',import.meta.url)));await R.init();
const context=vm.createContext({console});for(const f of ['math','physics'])vm.runInContext(readFileSync(new URL('../src/'+f+'.js',import.meta.url),'utf8'),context);
const vector=v=>[v.x,v.y,v.z],observe=b=>({position:vector(b.translation()),velocity:vector(b.linvel()),angular:vector(b.angvel())});
const duration=.05,baseDt=1/960,runs=[],start=performance.now();
for(const refinement of [1,2,4]){
 const dt=baseDt/refinement,lab=new context.PhysicsLab(R,{}, {dt});
 try{
  lab.objects.forEach((o,i)=>{o.body.setTranslation({x:i===0?-.2:i===1?-.06:.5,y:Math.fround(o.radius),z:i===2?.5:0},true);o.body.setLinvel({x:i===0?1:0,y:0,z:0},true);o.body.setAngvel({x:0,y:0,z:i===0?-.2/o.radius:0},true);o.lastPos={...o.body.translation()};});lab.world.propagateModifiedBodyPositionsToColliders();
  const o=lab.objects[0],b=o.body,cloth=lab.statics.find(s=>s.kind==='cloth'),mass=b.mass(),I=.4*o.mass*o.radius*o.radius;
  const material={gravity:lab.params.gravity,clothFriction:o.collider.friction()*cloth.collider.friction(),rollingLength:lab.params.rollingLength,spinLength:lab.params.spinLength};
  const initial=observe(b),segment=prepareCollinearSegment({...initial,id:o.id,radius:o.radius,mass:o.mass,provenance:'prepared-flat-constant-load'},material);assert.equal(segment.eligible,true);assert.ok(segment.horizon>duration);
  const timeline=[];let previous=initial,torque=[0,0,0];
  const sourceTorque=b.applyTorqueImpulse.bind(b);b.applyTorqueImpulse=(impulse,wake)=>{torque=torque.map((x,i)=>x+[impulse.x,impulse.y,impulse.z][i]);return sourceTorque(impulse,wake);};
  const sourcePatch=lab.angularPatchResistance.bind(lab);
  lab.angularPatchResistance=h=>{
   const pre=observe(b);let normalImpulse=0,contacts=0,normalY=0;
   lab.world.contactPair(o.collider,cloth.collider,m=>{contacts+=m.numContacts();normalY=m.normal().y;for(let k=0;k<m.numContacts();k++)normalImpulse+=Math.max(0,m.contactImpulse(k));});
   let pairImpulse=0;for(let j=1;j<lab.objects.length;j++)lab.world.contactPair(o.pairCollider,lab.objects[j].pairCollider,m=>{for(let k=0;k<m.numContacts();k++)pairImpulse+=Math.max(0,m.contactImpulse(k));});assert.equal(pairImpulse,0,'Precontact diagnostic must remain before pair response');
   sourcePatch(h);const after=observe(b),frictionDelta=pre.velocity[0]-previous.velocity[0];
   timeline.push({time:lab.time,contacts,normalY,normalRatio:normalImpulse/(o.mass*material.gravity*h),cappedNormalRatio:Math.min(normalImpulse,o.mass*material.gravity*h)/(o.mass*material.gravity*h),observedFrictionImpulse:-mass*frictionDelta,muNormalImpulse:material.clothFriction*normalImpulse,worldVelocityDelta:frictionDelta,worldAngularDelta:pre.angular[2]-previous.angular[2],patchTorqueZ:torque[2],patchAngularDelta:after.angular[2]-pre.angular[2],patchIdealAngularDelta:torque[2]/I,slipBefore:previous.velocity[0]+o.radius*previous.angular[2],slipAfter:after.velocity[0]+o.radius*after.angular[2],actual:after});
   previous=after;torque=[0,0,0];
  };
  const frames=Math.round(duration/dt);lab.step(frames);const actual=observe(b),analytic=evaluateCollinearMotion(segment,duration);
  const sum=key=>timeline.reduce((total,row)=>total+row[key],0);
  runs.push({refinement,dt,sourceSteps:frames,constructorSteps:72,material,initial,actual,analytic,analyticAcceleration:segment.acceleration,analyticAngularAcceleration:segment.angularAcceleration,normalRatio:{min:Math.min(...timeline.map(t=>t.normalRatio)),max:Math.max(...timeline.map(t=>t.normalRatio))},sums:{observedFrictionImpulse:sum('observedFrictionImpulse'),muNormalImpulse:sum('muNormalImpulse'),worldVelocityDelta:sum('worldVelocityDelta'),worldAngularDelta:sum('worldAngularDelta'),patchTorqueZ:sum('patchTorqueZ'),patchAngularDelta:sum('patchAngularDelta'),patchIdealAngularDelta:sum('patchIdealAngularDelta')},signedEndpointError:{position:actual.position.map((x,i)=>x-analytic.position[i]),velocity:actual.velocity.map((x,i)=>x-analytic.velocity[i]),angular:actual.angular.map((x,i)=>x-analytic.angular[i])},firstSteps:timeline.slice(0,5),lastStep:timeline.at(-1)});
 }finally{lab.world.free();lab.queue.free();}
 assert.ok(performance.now()-start<55000,'Bounded diagnostic exceeded 55 seconds');
}
const receipt={kind:'original-source-precontact-forward-slip-diagnostic',duration,wallMs:performance.now()-start,productionEnabled:false,acceptanceClaim:false,runs};
if(process.env.SOURCE_LAW_PRECONTACT_RECEIPT)writeFileSync(process.env.SOURCE_LAW_PRECONTACT_RECEIPT,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
