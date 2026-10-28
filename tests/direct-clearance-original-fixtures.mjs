// Original native cueClearance oracle and immutable source-ordered scene bounds.
// Bounds are broad-phase envelopes, not replacements for exact shape queries.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const require=createRequire(import.meta.url),root=new URL('../',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex'),vec=v=>[v.x,v.y,v.z];
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
export async function createOriginalClearanceFixtures({rapierPath=process.env.DIRECT_CUE_RAPIER_PATH}={}){
 if(!rapierPath){rapierPath=fileURLToPath(new URL('vendor/rapier.cjs',root));assert.ok(existsSync(rapierPath),'Set DIRECT_CUE_RAPIER_PATH to an existing trusted bundled Rapier artifact');}
 const R=require(rapierPath);await R.init();
 const math=readFileSync(new URL('src/math.js',root),'utf8'),physics=readFileSync(new URL('src/physics.js',root),'utf8');
 const context=vm.createContext({console});vm.runInContext(math,context,{filename:'src/math.js'});vm.runInContext(physics,context,{filename:'src/physics.js'});
 const {PhysicsLab,LabMath:{V,rotate,add},LabDimensions:D}=context;
 const provenance={reference:'unmodified-original-PhysicsLab.cueClearance/native-Rapier',physicsSha256:hash(physics),mathSha256:hash(math),rapierSha256:hash(readFileSync(rapierPath)),sourceOrder:'statics then objects; primary collider only',aabbArithmetic:'JS Number from actual native collider geometry/transform; GPU pack must round outward',wholeWorld:false};
 const scenes=[];
 for(const name of ['airborne','on-table','shaft-obstruction','large-selected-shaft-adversarial']){
  const lab=new PhysicsLab(R,{gravity:0});
  try{
   let selected;
   if(name==='large-selected-shaft-adversarial'){
    for(const o of [...lab.objects])lab.removeObject(o.id);
    selected=lab.addSphere(V(0,3,0),'large selected adversarial','#fff',.21,2);
    for(let i=0;i<3;i++)lab.addSphere(V(3+i*.1,3,-3),'other '+i);
   }else{
    lab.addSphere(V(.8,.3,.3),'fourth');selected=lab.objects[0];
    const y=name==='on-table'?D.radius+.00005:.3;
    lab.objects.forEach((o,i)=>{o.body.setTranslation(i===0?V(0,y,0):V(.7+i*.1,y,.3),true);o.body.setLinvel(V(),true);o.body.setAngvel(V(),true);});
    if(name==='shaft-obstruction')lab.objects[1].body.setTranslation(V(-.45,y,0),true);
   }
   lab.world.propagateModifiedBodyPositionsToColliders();
   const ordered=[...lab.statics,...lab.objects];
   const obstacles=ordered.map(o=>{
    const c=o.collider,t=c.translation(),q=c.rotation(),center=vec(t);let points,min,max,shape;
    if(o.shape==='sphere'){
     const radius=c.radius();min=center.map(x=>x-radius);max=center.map(x=>x+radius);shape={type:'sphere',center,radius};
    }else{
     let local;
     if(o.shape==='box'){
      const h=c.halfExtents();local=[];for(const x of [-h.x,h.x])for(const y of [-h.y,h.y])for(const z of [-h.z,h.z])local.push(V(x,y,z));
      shape={type:'box',halfExtents:vec(h),translation:center,rotation:[q.x,q.y,q.z,q.w]};
     }else if(o.shape==='convex'){
      const v=c.vertices();local=[];for(let i=0;i<v.length;i+=3)local.push(V(v[i],v[i+1],v[i+2]));
      shape={type:'convex',localVertices:Array.from(v),translation:center,rotation:[q.x,q.y,q.z,q.w]};
     }else throw new Error('Unsupported original obstacle shape '+o.shape);
     points=local.map(p=>vec(add(t,rotate(q,p))));min=[0,1,2].map(i=>Math.min(...points.map(p=>p[i])));max=[0,1,2].map(i=>Math.max(...points.map(p=>p[i])));
    }
    assert.ok([...min,...max].every(x=>Number.isFinite(x)&&Math.abs(x)<=10));
    return {min,max,selected:o===selected,label:o.label,kind:o.kind,shape,...(points?{worldVertices:points}:{})};
   });
   const scene=freeze({center:vec(selected.body.translation()),radius:selected.radius,tipRadius:D.tipRadius,cueLength:D.cueLength,flexibleLength:D.flexibleLength,retract:.012,selectedIndex:ordered.indexOf(selected),obstacles});
   const specs=name==='large-selected-shaft-adversarial'?[['selected-shaft-graze',0,0,.99999,0,2],['selected-neck-graze',0,0,.9999,0,2]]:[['center',0,0,0,0,2],['elevated',35,17,.25,-.4,3],['negative-angle',-137,8,-.35,.2,1.2],['low-tip-cloth',0,0,0,-.95,2],['near-edge-selected',0,0,.999,0,2],['high-elevation',90,80,.1,.1,2],['opposite-shaft',180,0,0,0,2]];
   const fixtures=specs.map((s,i)=>{const [label,angle,elevation,tipX,tipY,speed]=s,input={id:scenes.length*100+i+1,angle,elevation,tipX,tipY,speed};return {name:label,input,expected:{clearance:{...lab.cueClearance(selected,input)}}};});
   scenes.push({name,scene,fixtures,provenance:{...provenance,adversarialGeometry:name==='large-selected-shaft-adversarial'}});
  }finally{lab.dispose();}
 }
 return {scenes,provenance};
}
