// HOST ASSERTION ONLY. Transparent observation of the unchanged original native
// path. Captures are test oracles, never inputs to the resident runtime.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createNativeRestOracle} from './resident-candidate-native-rest-fixture.mjs';
const require=createRequire(import.meta.url),R=require('../vendor/rapier.cjs');
const hash=x=>createHash('sha256').update(x).digest('hex'),v=x=>[x.x,x.y,x.z];
const body=b=>({position:v(b.translation()),worldCom:v(b.worldCom()),linear:v(b.linvel()),angular:v(b.angvel()),invMass:v(b.effectiveInvMass()),invInertia:Array.from(b.effectiveWorldInvInertia().elements).slice(0,6)});
export async function captureOriginalTipInputs(){
 const Lab=globalThis.PhysicsLab,method=Lab.prototype.compliantTipContact,velocity=R.RigidBody.prototype.velocityAtPoint;
 const physicsBefore=hash(readFileSync(new URL('../src/physics.js',import.meta.url))),records=[];
 let active=null,calls=0,oracle;
 Lab.prototype.compliantTipContact=function(...args){
  assert.equal(active,null,'nonrecursive original compliant-tip observation');
  const c=this.cue,prior=c?new Map(Array.from(c.contacts,([id,x])=>[id,structuredClone(x)])):new Map();
  const context={lab:this,c,h:args[0],call:++calls,prior,contacted:c?.contacted,records:[]};active=context;
  try{const result=method.apply(this,args);
   for(const record of context.records){const ball=this.get(record.selectedId).body,contact=c.contacts.get(record.selectedId);assert.ok(contact,'selected contact remains during observed touching call');record.native={tangent:v(contact.tangent),head:{linear:v(c.head.linvel()),angular:v(c.head.angvel())},ball:{linear:v(ball.linvel()),angular:v(ball.angvel())},firstContact:c.stats.firstContact,lastContact:c.stats.lastContact};records.push(record);}
   return result;
  }finally{active=null;}
 };
 R.RigidBody.prototype.velocityAtPoint=function(...args){
  const x=active,selected=x?.lab.get(x.c?.selectedId);
  if(selected&&this.handle===selected.body.handle){
   assert.equal(x.records.length,0,'one selected-ball tip velocity read per original call');
   // This call is after the original lateral impulses and before any selected
   // tip impulse. The original may already have inserted a birth contact, so
   // lifecycle/tangent come from the read-only method-entry copy above.
   const p=x.lab.params,old=x.prior.get(selected.id);
   x.records.push({h:x.call,phase:'post-lateral-prefix-pre-world-step',time:x.lab.time,selectedId:selected.id,
    input:{kind:'actual-cue-single-sphere-tip',phase:'post-lateral-prefix-pre-world-step',head:body(x.c.head),ball:body(selected.body),radius:selected.radius,tipRadius:globalThis.LabDimensions.tipRadius,h:x.h,normalStiffness:p.tipNormalStiffness,normalDamping:p.tipNormalDamping,tangentStiffness:p.tipTangentialStiffness,tangentDamping:p.tipTangentialDamping,friction:p.tipFriction,tangent:old?v(old.tangent):[0,0,0],active:!!old,contacted:!!x.contacted},pointArgument:v(args[0])});
  }
  return velocity.apply(this,args);
 };
 try{
  const settings={angle:310,elevation:85,speed:4.5,tipX:.2,tipY:-.1};oracle=await createNativeRestOracle({settings});
  assert.equal(oracle.sourceIdentity,'feb6b6eea9a0d29236df73680e79d3cbedf84dee702f3dae0c1e80a33ef9c2ef');
  const initial=oracle.initial;let final;for(let i=0;i<3;i++)final=oracle.stepOuter({includeNative:false});
  assert.equal(calls,192);assert.equal(records[0]?.h,165);assert.equal(records.at(-1)?.h,192);assert.equal(records.length,28);
  assert.equal(records[0].time,5.631835937499722);assert.equal(records[0].input.active,false);assert.equal(records[0].input.contacted,false);
  assert.deepEqual(records.at(-1).native.tangent,v(final.cue.contacts.find(([id])=>id===final.selectedId)[1].tangent));
  assert.equal(hash(readFileSync(new URL('../src/physics.js',import.meta.url))),physicsBefore);
  return {kind:'resident-cue-number-native-observation-v1',node:process.version,v8:process.versions.v8,settings,
   provenance:{physicsSha256:physicsBefore,engineSha256:hash(readFileSync(new URL('../vendor/rapier.cjs',import.meta.url))),artifactSha256:initial.origin.artifactSha256,preStrikeSnapshotSha256:initial.origin.preStrikeSnapshotSha256,createdSnapshotSha256:oracle.sourceIdentity,observer:'original compliantTipContact and velocityAtPoint wrappers forward identical receiver/arguments/result; no numerical body edit',originalLatchedOuterCalls:3,originalHCalls:192,sourceH:1/61440},records,
   coverage:{nativeCpu:true,gpuExecution:false,sourceModified:false,fullRest:false,runtimeFutureInputs:false}};
 }finally{Lab.prototype.compliantTipContact=method;R.RigidBody.prototype.velocityAtPoint=velocity;oracle?.dispose();}
}
