// Shared bounded PREPARED fixtures, not raw-shot or general live admission.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
export async function loadCostFixture(){
 if(!process.env.DIRECT_CUE_RAPIER_PATH)throw Error('Trusted DIRECT_CUE_RAPIER_PATH required');
 const R=createRequire(import.meta.url)(process.env.DIRECT_CUE_RAPIER_PATH);await R.init();
 const context=vm.createContext({console});
 for(const name of ['math','physics'])vm.runInContext(readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),context);
 return {R,PhysicsLab:context.PhysicsLab};
}
export function makeCostFixture({R,PhysicsLab},mode){
 const lab=new PhysicsLab(R),near=mode==='near-rail',moving=mode==='moving-pair',reverse=mode==='reversal';
 for(const [i,o] of lab.objects.entries()){
  o.body.setTranslation({x:near?(i===0?1.3:i===1?0:-.6):(i===0?-.2:i===1?-.06:.5),y:Math.fround(o.radius),z:i===2?.5:0},true);
  o.body.setLinvel({x:i===0?(reverse?.01:1):moving&&i===1?-.5:0,y:0,z:0},true);
  o.body.setAngvel({x:0,y:0,z:i===0?(reverse?1:-.2)/o.radius:moving&&i===1?.1/o.radius:0},true);
  o.lastPos={...o.body.translation()};
 }
 lab.world.propagateModifiedBodyPositionsToColliders();return lab;
}
export function observeCostFixture(lab){return JSON.parse(JSON.stringify({time:lab.time,steps:lab.steps,events:lab.events,balls:lab.objects.map(o=>({p:o.body.translation(),v:o.body.linvel(),w:o.body.angvel(),q:o.body.rotation(),distance:o.distance,lastPos:o.lastPos,trail:o.trail,maxHeight:o.maxHeight}))}));}
export function endpointDelta(a,b){
 const out={position:0,velocity:0,angular:0,quaternionComponent:0};
 a.balls.forEach((ball,i)=>{
  for(const [name,key]of [['position','p'],['velocity','v'],['angular','w']])out[name]=Math.max(out[name],Math.hypot(...['x','y','z'].map(k=>ball[key][k]-b.balls[i][key][k])));
  out.quaternionComponent=Math.max(out.quaternionComponent,...['x','y','z','w'].map(k=>Math.abs(ball.q[k]-b.balls[i].q[k])));
 });return out;
}
