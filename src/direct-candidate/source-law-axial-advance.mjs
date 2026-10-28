/** Explicit experimental PREPARED axial prefix advancement. No contact impulse
 * replacement: stop before a regime/contact boundary, then original solver runs.
 * Full changing-axis attitude and rolling remain unsupported.
 */
import {capturePreparedSpinWorld} from './source-law-normal-spin.mjs';
import {prepareCollinearSegment,evaluateCollinearMotion} from './source-law-collinear-segment.mjs';
import {predictSourcePreparedCollinearEvent,sweptSphereBounds3D} from './source-geometry-horizon.mjs';
const bits=new DataView(new ArrayBuffer(4));
function packingUlp(x){const f=Math.fround(Math.abs(x));if(!Number.isFinite(f))return Infinity;if(f===0)return 2**-149;bits.setFloat32(0,f);bits.setUint32(0,bits.getUint32(0)+1);return bits.getFloat32(0)-f;}
function quaternionProduct(a,b){return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];}
export function evaluateAxialAttitude(segment,rotation,time){
 if(!segment.eligible||!Number.isFinite(time)||time<0||time>segment.horizon||!Array.isArray(rotation)||rotation.length!==4||!rotation.every(Number.isFinite))throw RangeError('Valid fixed-axis interval required');
 const w=segment.body.angular,a=segment.angularAcceleration;
 if(w[1]!==0&&(w[0]!==0||w[2]!==0))throw RangeError('Changing-axis attitude remains local');
 let axis=w[0]!==0||a[0]!==0?0:w[2]!==0||a[2]!==0?2:1;
 const angle=w[axis]*time+a[axis]*time*time/2;
 const delta=[0,0,0,Math.cos(angle/2)];delta[axis]=Math.sin(angle/2);
 const q=quaternionProduct(delta,rotation),length=Math.hypot(...q);
 if(!Number.isFinite(angle)||!Number.isFinite(length)||length===0)throw RangeError('Nonfinite attitude');
 return q.map(x=>x/length);
}
const energy=b=>.5*b.mass*(b.velocity.reduce((s,x)=>s+x*x,0))+.2*b.mass*b.radius*b.radius*b.angular.reduce((s,x)=>s+x*x,0);
const failure=(reason,prediction)=>({advanced:false,reason,...(prediction?{prediction}:{})});
export function advancePreparedAxialPrefix(lab,requestedFrames,{preparedBoundary=false,minAnalyticFrames=0}={}){
 let boundEvaluations=0,pairBoundTests=0,staticBoundTests=0;
 const failed=(reason,prediction)=>({...failure(reason,prediction),boundEvaluations,pairBoundTests,staticBoundTests});
 if(!Number.isInteger(minAnalyticFrames)||minAnalyticFrames<0||minAnalyticFrames>4096)throw RangeError('Bounded experimental minimum prefix required');
 if(!preparedBoundary)return failed('unverified-boundary');
 if(!Number.isInteger(requestedFrames)||requestedFrames<1||requestedFrames>4096||!Number.isFinite(lab.dt)||lab.dt<=0||lab.dt>1/120)return failed('invalid-frame-window');
 const captured=capturePreparedSpinWorld(lab,{preparedBoundary:true});
 const bodies=captured.balls.map((b,i)=>({...b,mass:lab.objects[i].mass,provenance:'prepared-flat-constant-load'}));
 const prediction=predictSourcePreparedCollinearEvent(lab,bodies,{duration:requestedFrames*lab.dt,preparedBoundary:true});
 if(!prediction.eligible)return failed(prediction.reason,prediction);
 if(bodies.some(b=>!b.rotation.every(Number.isFinite)||Math.abs(Math.hypot(...b.rotation)-1)>8*2**-24))return failed('invalid-native-orientation',prediction);
 const material=prediction.material,segments=bodies.map(b=>prepareCollinearSegment(b,material));
 if(segments.some(s=>s.regime==='collinear-sliding'&&s.body.angular[1]!==0))return failed('changing-axis-attitude-unqualified',prediction);
 if(!segments.some(s=>s.regime==='collinear-sliding'))return failed('no-translating-segment',prediction);
 if(lab.objects.some((o,i)=>['x','y','z'].some((k,j)=>o.lastPos[k]!==bodies[i].position[j])))return failed('stale-observer-position',prediction);
 let frames=Math.min(requestedFrames,Math.floor(prediction.event.time/lab.dt)-1);
 if(['geometry-horizon','observation-horizon'].includes(prediction.event.kind)&&prediction.event.time>=requestedFrames*lab.dt&&segments.every(s=>s.horizon>requestedFrames*lab.dt))frames=requestedFrames;
 // Optional COST dispatch gate, never a physical admission criterion. Reject
 // before extra envelope work; caller must use the original remaining window.
 if(minAnalyticFrames>0&&frames<minAnalyticFrames)return {...failed('short-prefix-original-window',prediction),proposedFrames:Math.max(0,frames),minAnalyticFrames};
 // Certify ALL pairs and actual fixed hull envelopes over the full prefix,
 // independently of numerical pair-root timing. Include one native f32 ULP
 // of endpoint-position packing in the swept envelope. No trajectory sampling.
 for(;frames>0;frames=Math.floor(frames/2)){
  if(minAnalyticFrames>0&&frames<minAnalyticFrames)return {...failed('short-prefix-original-window',prediction),proposedFrames:frames,minAnalyticFrames};
  const time=frames*lab.dt,bounds=[];let safe=true;
  for(let i=0;i<bodies.length;i++){
   const b=bodies[i],nativeRadius=Math.max(b.radius,lab.objects[i].collider.radius(),lab.objects[i].pairCollider.radius());
   let box=sweptSphereBounds3D({...b,radius:nativeRadius},segments[i].acceleration,time);boundEvaluations++;
   if(!box){safe=false;break;}
   const padding=Math.max(...box.flat().map(packingUlp));
   box=sweptSphereBounds3D({...b,radius:nativeRadius+padding},segments[i].acceleration,time);boundEvaluations++;
   if(!box){safe=false;break;}bounds.push(box);
   for(const k of [0,2])if(box[k][0]<=captured.support.min[k]||box[k][1]>=captured.support.max[k])safe=false;
   for(const obstacle of prediction.geometry.actualStaticBounds){staticBoundTests++;if(!box.some((range,k)=>range[1]<obstacle.bounds[k][0]||range[0]>obstacle.bounds[k][1]))safe=false;}
  }
  if(bounds.length===bodies.length)for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){pairBoundTests++;if(!bounds[i].some((range,k)=>range[1]<bounds[j][k][0]||range[0]>bounds[j][k][1]))safe=false;}
  if(safe)break;
 }
 if(frames<1)return failed('no-whole-frame-contact-free-prefix',prediction);
 const time=frames*lab.dt,states=[];
 try{
  for(let i=0;i<bodies.length;i++){
   const s=segments[i],b=bodies[i],state=evaluateCollinearMotion(s,time),rotation=evaluateAxialAttitude(s,b.rotation,time);
   const packed={position:state.position.map(Math.fround),velocity:state.velocity.map(Math.fround),angular:state.angular.map(Math.fround),rotation:rotation.map(Math.fround)};
   if(!Object.values(packed).flat().every(Number.isFinite))return failed('unrepresentable-native-endpoint',prediction);
   if(b.angular[1]!==0&&Math.sign(packed.angular[1])!==Math.sign(b.angular[1]))return failed('packed-spin-sign-boundary',prediction);
   if(s.regime==='collinear-sliding'){
    const axis=s.direction[0]!==0?0:2,c=axis===0?-b.radius*state.angular[2]:b.radius*state.angular[0],u=state.velocity[axis]-c;
    const originalC=axis===0?-b.radius*b.angular[2]:b.radius*b.angular[0],originalU=b.velocity[axis]-originalC;
    const packedC=axis===0?-b.radius*packed.angular[2]:b.radius*packed.angular[0],packedU=packed.velocity[axis]-packedC;
    if(Math.sign(c)!==Math.sign(originalC)||Math.sign(u)!==Math.sign(originalU)||Math.sign(packedC)!==Math.sign(originalC)||Math.sign(packedU)!==Math.sign(originalU))return failed('regime-sign-uncertainty',prediction);
   }
   states.push({...state,rotation,packed});
  }
 }catch{return failed('unsupported-analytic-endpoint',prediction);}
 const beforeEnergy=bodies.reduce((sum,b)=>sum+energy(b),0),afterEnergy=states.reduce((sum,b)=>sum+energy(b),0),packedEnergy=states.reduce((sum,b)=>sum+energy({...b,velocity:b.packed.velocity,angular:b.packed.angular}),0);
 if(!Number.isFinite(beforeEnergy)||!Number.isFinite(afterEnergy)||!Number.isFinite(packedEnergy)||afterEnergy>beforeEnergy||packedEnergy>beforeEnergy)return failed('energy-invariant-failed',prediction);
 let trajectorySamples=0,maxPositionPackingError=0,maxVelocityPackingError=0,maxAngularPackingError=0,maxQuaternionPackingError=0;
 for(let i=0;i<states.length;i++){
  const o=lab.objects[i],state=states[i],initial=bodies[i],s=segments[i],p=state.position,v=state.velocity,w=state.angular,q=state.rotation;
  const displacement=t=>initial.velocity.map((x,k)=>x*t+s.acceleration[k]*t*t/2);
  const length=v=>Math.hypot(...v);
  // Match the SOURCE frame-chord distance observable, not exact continuous
  // arc length. Only the one reversal-containing frame needs a split.
  let distance=length(displacement(time));
  if(s.regime==='collinear-sliding'){
   const axis=s.direction[0]!==0?0:2,turn=-initial.velocity[axis]/s.acceleration[axis];
   if(turn>0&&turn<time){const left=Math.floor(turn/lab.dt)*lab.dt,right=Math.min(time,left+lab.dt),a=displacement(left),b=displacement(right),end=displacement(time);distance=length(a)+length(b.map((x,k)=>x-a[k]))+length(end.map((x,k)=>x-b[k]));}
  }
  o.distance+=distance;o.maxHeight=Math.max(o.maxHeight,p[1]-o.radius);
  for(let frame=6-lab.steps%6;frame<=frames;frame+=6){
   const sample=evaluateCollinearMotion(s,frame*lab.dt).position.map(Math.fround),last=o.trail.at(-1);trajectorySamples++;
   if(!last||Math.hypot(sample[0]-last.x,sample[1]-last.y,sample[2]-last.z)>.004){o.trail.push({x:sample[0],y:sample[1],z:sample[2],shot:lab.shots});if(o.trail.length>4000)o.trail.shift();}
  }
  o.body.setTranslation({x:p[0],y:p[1],z:p[2]},false);o.body.setLinvel({x:v[0],y:v[1],z:v[2]},false);o.body.setAngvel({x:w[0],y:w[1],z:w[2]},false);o.body.setRotation({x:q[0],y:q[1],z:q[2],w:q[3]},false);
  const actualP=o.body.translation(),actualV=o.body.linvel(),actualW=o.body.angvel(),actualQ=o.body.rotation();
  maxQuaternionPackingError=Math.max(maxQuaternionPackingError,...['x','y','z','w'].map((k,j)=>Math.abs(actualQ[k]-q[j])));o.lastPos={...actualP};
  for(const [k,axis]of ['x','y','z'].entries()){maxPositionPackingError=Math.max(maxPositionPackingError,Math.abs(actualP[axis]-p[k]));maxVelocityPackingError=Math.max(maxVelocityPackingError,Math.abs(actualV[axis]-v[k]));maxAngularPackingError=Math.max(maxAngularPackingError,Math.abs(actualW[axis]-w[k]));}
 }
 lab.time+=time;lab.steps+=frames;lab.world.propagateModifiedBodyPositionsToColliders();
 return {advanced:true,frames,duration:time,prediction,beforeEnergy,afterEnergy,packedEnergy,boundEvaluations,pairBoundTests,staticBoundTests,trajectorySamples,maxPositionPackingError,maxVelocityPackingError,maxAngularPackingError,maxQuaternionPackingError,contactResolved:false,preparedOnly:true,cacheIdentityClaim:false};
}
