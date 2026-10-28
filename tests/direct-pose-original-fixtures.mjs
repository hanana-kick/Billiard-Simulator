// Fresh raw-parameter original PhysicsLab pose/strike observations only.
// Clearance is observed on the original world, never assumed by the direct path.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const require=createRequire(import.meta.url),root=new URL('../',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
const vec=v=>[v.x,v.y,v.z],quat=q=>[q.x,q.y,q.z,q.w];
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
export async function createOriginalPoseFixtures({rapierPath=process.env.DIRECT_CUE_RAPIER_PATH}={}){
 if(!rapierPath){rapierPath=fileURLToPath(new URL('vendor/rapier.cjs',root));assert.ok(existsSync(rapierPath),'Set DIRECT_CUE_RAPIER_PATH to an existing trusted bundled Rapier artifact');}
 const R=require(rapierPath);await R.init();
 const math=readFileSync(new URL('src/math.js',root),'utf8'),physics=readFileSync(new URL('src/physics.js',root),'utf8');
 const context=vm.createContext({console});vm.runInContext(math,context,{filename:'src/math.js'});vm.runInContext(physics,context,{filename:'src/physics.js'});
 const {PhysicsLab,LabMath:{V},LabDimensions:D}=context,lab=new PhysicsLab(R,{gravity:0});
 try{
  lab.addSphere(V(.6,.3,.2),'fourth');
  lab.objects.forEach((o,i)=>{o.body.setTranslation(i===0?V(0,.3,0):V(.65+i*.12,.3,.3),true);o.body.setLinvel(V(),true);o.body.setAngvel(V(),true);});
  lab.world.propagateModifiedBodyPositionsToColliders();
  const selected=lab.objects[0],scene=freeze({center:vec(selected.body.translation()),radius:selected.radius,tipRadius:D.tipRadius,cueLength:D.cueLength,flexibleLength:D.flexibleLength,retract:.012});
  const specs=[['center',0,0,0,0,2],['elevated-offset',35,17,.25,-.4,3],['negative-angle',-137,8,-.35,.2,1.2],['near-vertical',170,85,.1,.1,4],['wrap-positive',360,0,.2,0,.5],['wrap-negative',-360,30,0,-.3,10],['quadrant',90,12,.55,.3,2.5],['fine-angle',.001,.01,-.001,.002,.1]];
  const fixtures=[];
  for(const [index,s]of specs.entries()){
   const [name,angle,elevation,tipX,tipY,speed]=s,input={id:index+1,angle,elevation,tipX,tipY,speed};
   const poseObject=lab.pose(selected,input),pose=Object.fromEntries(Object.entries(poseObject).map(([k,v])=>[k,k==='rotation'?quat(v):vec(v)]));
   const clearance=lab.cueClearance(selected,input);
   // Deliberately permit creation for geometry observation even when original
   // clearance rejects. This option does NOT authorize a direct physical shot.
   assert.equal(lab.strike(selected.id,input,{ignoreObstruction:true,saveSnapshot:false}).ok,true);
   lab.world.propagateModifiedBodyPositionsToColliders();
   const body=b=>({translation:vec(b.translation()),rotation:quat(b.rotation()),linear:vec(b.linvel()),angular:vec(b.angvel()),worldCom:vec(b.worldCom())});
   const c=lab.cue,strike={head:body(c.head),shaft:body(c.body),guide:body(c.guide),colliders:Object.fromEntries(['tip','shaft','neck'].map(k=>[k,{translation:vec(c[k].translation()),rotation:quat(c[k].rotation())}])),ignoreObstructionForObservation:true};
   fixtures.push({name,input,expected:{pose,clearance:{...clearance},strike}});lab.removeCue();
  }
  // These are explicitly direct-profile refusals, not asserted original failures.
  // Original strike accepts any finite angle; large-angle f32 trig loses meaning.
  const rejections=[{name:'huge-positive-angle',input:{id:101,angle:1e20,elevation:0,tipX:0,tipY:0,speed:2},directExpected:'unsupported-angle-range',originalFiniteAngleAcceptedByValidation:true},{name:'huge-negative-angle',input:{id:102,angle:-1e20,elevation:0,tipX:0,tipY:0,speed:2},directExpected:'unsupported-angle-range',originalFiniteAngleAcceptedByValidation:true},{name:'tip-radius-edge',input:{id:103,angle:0,elevation:0,tipX:1,tipY:0,speed:2},directExpected:'invalid-input',originalFiniteAngleAcceptedByValidation:false},{name:'nonpositive-speed',input:{id:104,angle:0,elevation:0,tipX:0,tipY:0,speed:0},directExpected:'invalid-input',originalFiniteAngleAcceptedByValidation:false}];
  return {scene,fixtures,rejections,provenance:{reference:'unmodified-original-PhysicsLab-JS-Number/native-Rapier-pose-strike',physicsSha256:hash(physics),mathSha256:hash(math),rapierSha256:hash(readFileSync(rapierPath)),wholeWorld:false,directClearanceImplemented:false}};
 }finally{lab.dispose();}
}

// Cheap holdout grid: one original world, original pose() only for each row.
// No strike, integration, device job, or substituted trigonometry in this oracle.
export async function createOriginalPoseGrid({rapierPath=process.env.DIRECT_CUE_RAPIER_PATH}={}){
 if(!rapierPath){rapierPath=fileURLToPath(new URL('vendor/rapier.cjs',root));assert.ok(existsSync(rapierPath),'Set DIRECT_CUE_RAPIER_PATH to an existing trusted bundled Rapier artifact');}
 const R=require(rapierPath);await R.init();
 const math=readFileSync(new URL('src/math.js',root),'utf8'),physics=readFileSync(new URL('src/physics.js',root),'utf8');
 const context=vm.createContext({console});vm.runInContext(math,context,{filename:'src/math.js'});vm.runInContext(physics,context,{filename:'src/physics.js'});
 const {PhysicsLab,LabMath:{V},LabDimensions:D}=context,lab=new PhysicsLab(R,{gravity:0});
 try{
  const selected=lab.objects[0];selected.body.setTranslation(V(0,.3,0),true);
  const scene=freeze({center:vec(selected.body.translation()),radius:selected.radius,tipRadius:D.tipRadius,cueLength:D.cueLength,flexibleLength:D.flexibleLength,retract:.012});
  const angles=[-3600,-3599.99,-1080,-720,-360,-270,-180,-90,0,90,180,270,360,720,1080,3599.99,3600,-137,-35,35,137];
  for(const q of [-270,-180,-90,0,90,180,270,360])angles.push(q-.0001,q+.0001);
  const elevations=[0,.001,8,17,45,80,84.999,85];
  const offsets=[[0,0],[.25,-.4],[-.35,.2],[.7,.7],[-.7,-.7],[.95,0],[0,-.95],[-.001,.002]];
  const fixtures=[];
  for(const [ai,angle]of angles.entries())for(const [ei,elevation]of elevations.entries()){
   const [tipX,tipY]=offsets[(ai+ei)%offsets.length],input={id:1000+fixtures.length,angle,elevation,tipX,tipY,speed:[.1,2,10][(ai+ei)%3]};
   const original=lab.pose(selected,input),pose=Object.fromEntries(Object.entries(original).map(([k,v])=>[k,k==='rotation'?quat(v):vec(v)]));
   fixtures.push({name:`holdout-${angle}-${elevation}`,input,expected:{pose}});
  }
  assert.ok(fixtures.length<=512);
  return {scene,fixtures,provenance:{reference:'unmodified-original-PhysicsLab.pose-JS-Number',physicsSha256:hash(physics),mathSha256:hash(math),rapierSha256:hash(readFileSync(rapierPath)),poseOnly:true,clearanceObserved:false,wholeWorld:false}};
 }finally{lab.dispose();}
}
