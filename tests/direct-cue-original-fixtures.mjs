// Fresh prepared component observations; NOT raw shots or complete-world fixtures.
// The original PhysicsLab equations execute against the shipped native Rapier API.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const require=createRequire(import.meta.url), root=new URL('../',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
const vector=v=>[v.x,v.y,v.z];
// Rapier effectiveWorldInvInertia is the symmetric inverse inertia (not its
// square root), packed m11,m12,m13,m22,m23,m33. The rotated shaft case tests off-diagonals.
function bodyRecord(b,radius){return {position:vector(b.translation()),worldCom:vector(b.worldCom()),linear:vector(b.linvel()),angular:vector(b.angvel()),invMass:vector(b.effectiveInvMass()),invInertia:Array.from(b.effectiveWorldInvInertia().elements.slice(0,6)),...(radius===undefined?{}:{radius})};}
export async function createOriginalCueFixtures({rapierPath=process.env.DIRECT_CUE_RAPIER_PATH}={}){
 const local=fileURLToPath(new URL('vendor/rapier.cjs',root));
 if(!rapierPath){assert.ok(existsSync(local),'Set DIRECT_CUE_RAPIER_PATH to an existing trusted bundled Rapier artifact');rapierPath=local;}
 const R=require(rapierPath);await R.init();
 const math=readFileSync(new URL('src/math.js',root),'utf8'),physics=readFileSync(new URL('src/physics.js',root),'utf8');
 const marker='   if(ftMag>limit){';assert.equal(physics.split(marker).length,2,'unique observation-only insertion point');
 // Read-only observation of the original branch inputs; no replaced expression.
 const observed=physics.replace(marker,'   if(this.__directCueObserve)this.__directCueObserve({id:o.id,normalForce:fn,compression,sliding:ftMag>limit});\n'+marker);
 const context=vm.createContext({console});vm.runInContext(math,context,{filename:'src/math.js'});vm.runInContext(observed,context,{filename:'src/physics.js (read-only branch observer)'});
 const {PhysicsLab,LabMath:{V},LabDimensions:D}=context;
 const specs=[{name:'center'},{name:'tangent-stick',vz:.01},{name:'tangent-slip',vz:20},{name:'lateral-spring',offset:.001,vz:.15,shaftSpin:1},{name:'persistent-shear',persistent:true,vz:.02},{name:'separation',separate:true,persistent:true},{name:'ordered-two-contacts',multiple:true},{name:'normal-clamped',vx:-20},{name:'rotated-shaft-inertia',offset:.001,vz:.15,shaftSpin:3,angle:35,elevation:17}];
 const fixtures=[];
 for(const [index,spec] of specs.entries()){
  const lab=new PhysicsLab(R,{gravity:0});
  try{
   lab.addSphere(V(.6,.3,.2),'fourth');
   lab.objects.forEach((o,i)=>{o.body.setTranslation(V(i*.2,.3,0),true);o.body.setLinvel(V(),true);o.body.setAngvel(V(),true);});
   assert.equal(lab.strike(lab.objects[0].id,{angle:spec.angle||0,elevation:spec.elevation||0,tipX:0,tipY:0,speed:2},{ignoreObstruction:true,saveSnapshot:false}).ok,true);
   const c=lab.cue, x=spec.separate?-.05:-(D.radius+D.tipRadius-.0002), z=spec.offset||0;
   c.head.setTranslation(V(x,.3,z),true);c.body.setTranslation(V(x,.3,0),true);
   c.head.setLinvel(V(spec.vx??2,0,spec.vz??0),true);c.body.setLinvel(V(2,0,0),true);
   c.head.setAngvel(V(),true);c.body.setAngvel(V(0,spec.shaftSpin||0,0),true);
   if(spec.multiple)lab.objects[1].body.setTranslation(V(x+.022,.322,z),true);
   if(spec.persistent){c.contacted=true;c.contacts.set(lab.objects[0].id,{tangent:V(0,0,1e-6)});}
   const p=lab.params,material={tipRadius:D.tipRadius,normalStiffness:p.tipNormalStiffness,normalDamping:p.tipNormalDamping,tangentStiffness:p.tipTangentialStiffness,tangentDamping:p.tipTangentialDamping,friction:p.tipFriction,lateralStiffness:p.cueLateralStiffness,lateralDamping:p.cueLateralDamping};
   const contactRecord=()=>lab.objects.map(o=>({active:c.contacts.has(o.id),tangent:vector(c.contacts.get(o.id)?.tangent||V())}));
   const bodies=()=>({balls:lab.objects.map(o=>bodyRecord(o.body,o.radius)),head:bodyRecord(c.head),shaft:bodyRecord(c.body)});
   const input={id:index+1,selectedIndex:0,cuePresent:true,contacted:c.contacted,axis:vector(c.pose.direction),h:lab.dt/lab.strokeSubsteps,...bodies(),contacts:contactRecord()};
   const observations=[];lab.__directCueObserve=o=>observations.push({...o});
   let beforeRemoval=null;const remove=lab.removeCue.bind(lab);lab.removeCue=()=>{if(lab.cue)beforeRemoval=bodies();remove();};
   lab.events=[];lab.compliantTipContact(input.h);
   const finalBodies=beforeRemoval||bodies(), contacts=contactRecord().map((contact,i)=>({...contact,sliding:!!observations.find(x=>x.id===lab.objects[i].id)?.sliding}));
   let birthMask=0,obstructionMask=0;
   contacts.forEach((v,i)=>{if(v.active&&!input.contacts[i].active){birthMask|=1<<i;if(i!==input.selectedIndex)obstructionMask|=1<<i;}});
   const expected={...finalBodies,contacts,contacted:c.contacted,birthMask,obstructionMask,removeCue:!lab.cue,
    observations:lab.objects.map(o=>observations.find(x=>x.id===o.id)||null),events:lab.events.map(e=>({...e}))};
   fixtures.push({name:spec.name,material,input,expected,provenance:{reference:'original-PhysicsLab-JS-Number/native-Rapier-call-boundary',physicsSha256:hash(physics),mathSha256:hash(math),rapierSha256:hash(readFileSync(rapierPath)),readOnlyBranchObserver:true,preparedComponentOnly:true}});
  }finally{lab.dispose();}
 }
 return fixtures;
}
