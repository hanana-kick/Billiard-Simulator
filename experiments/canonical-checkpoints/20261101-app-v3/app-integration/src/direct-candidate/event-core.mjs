/** Opt-in prepared-post-strike experiment. NOT Rapier parity or a scoring backend.
 * SI units; planar equal-mass solid spheres; finite rectangular face cushions.
 * Coefficients here are independently specified, never inferred from patch torque.
 */
export const EVENT_PROFILE = 'experimental-planar-coulomb-event-v1';
const EPS = 1e-8;
class NumericalInvalid extends Error {}
const finite = values => {if(!values.every(Number.isFinite))throw new NumericalInvalid('nonfinite-event-arithmetic');};
const dot = (a,b) => a[0]*b[0]+a[1]*b[1];
const norm = a => Math.hypot(...a);
const sub = (a,b) => a.map((x,i)=>x-b[i]);
const poly = (c,t) => {const value=c.reduceRight((v,x)=>v*t+x,0);finite([value]);return value;};
const derivative = c => c.slice(1).map((x,i)=>x*(i+1));

// Derivative roots partition a polynomial into monotone intervals. Bisection
// refines sign-changing intervals, not a uniformly sampled trajectory.
export function polynomialRoots(coefficients, lo, hi) {
 finite([...coefficients,lo,hi]);
 const c=[...coefficients]; while(c.length>1 && c.at(-1)===0)c.pop();
 if(c.length===1)return [];
 if(c.length===2){const t=-c[0]/c[1];return t>=lo&&t<=hi?[t]:[];}
 const cuts=[lo,...polynomialRoots(derivative(c),lo,hi),hi].sort((a,b)=>a-b),roots=[];
 const tolerance=t=>{const scale=1+c.reduce((s,x,i)=>s+Math.abs(x*t**i),0);finite([scale]);return EPS*scale;};
 for(const t of cuts)if(Math.abs(poly(c,t))<=tolerance(t))roots.push(t);
 for(let i=1;i<cuts.length;i++){
  let a=cuts[i-1],b=cuts[i],fa=poly(c,a),fb=poly(c,b);
  if(fa===0||fb===0||Math.sign(fa)===Math.sign(fb))continue;
  for(let k=0;k<64;k++){const m=(a+b)/2,fm=poly(c,m);if(fm===0||Math.sign(fa)!==Math.sign(fm)){b=m;fb=fm;}else{a=m;fa=fm;}}
  roots.push((a+b)/2);
 }
 return roots.sort((a,b)=>a-b).filter((t,i,a)=>!i||t-a[i-1]>EPS);
}

export function motionSegment(b, material) {
 const {gravity:g,slidingFriction:mu,rollingDeceleration:rho,spinDeceleration:sigma}=material;
 const u=[b.v[0]-b.r*b.w[1],b.v[1]+b.r*b.w[0]],speed=norm(b.v),slip=norm(u);
 let a=[0,0],aw=[0,0,0],horizon=Infinity,transition=null,regime='rest';
 if(slip>EPS){
  regime='sliding'; a=u.map(x=>-mu*g*x/slip); aw=[2.5*a[1]/b.r,-2.5*a[0]/b.r,0];
  if(mu>0){horizon=2*slip/(7*mu*g);transition='rolling';}
 }else if(speed>EPS){
  regime='rolling';a=b.v.map(x=>-rho*x/speed);aw=[-a[1]/b.r,a[0]/b.r,0];
  if(rho>0){horizon=speed/rho;transition='stop';}
 }
 if(Math.abs(b.w[2])>EPS && sigma>0){
  aw[2]=-Math.sign(b.w[2])*sigma;
  const spinTime=Math.abs(b.w[2])/sigma;
  if(spinTime<horizon){horizon=spinTime;transition='spin-stop';}
  else if(Math.abs(spinTime-horizon)<=EPS)transition='combined';
 }
 finite([...a,...aw]);
 return {a,aw,horizon,transition,regime};
}
function advance(b,s,t){
 for(let k=0;k<2;k++){b.p[k]+=b.v[k]*t+s.a[k]*t*t/2;b.v[k]+=s.a[k]*t;}
 for(let k=0;k<3;k++)b.w[k]+=s.aw[k]*t;
 finite([...b.p,...b.v,...b.w]);
}
function enteringRoot(c,horizon){
 for(const t of polynomialRoots(c,0,horizon)){
  const rate=poly(derivative(c),t);
  if(Math.abs(rate)<=EPS)return {t,ambiguous:true};
  if(rate<0)return {t,ambiguous:false};
 }
 return null;
}
export function pairTOI(a,b,sa,sb,horizon){
 const p=sub(b.p,a.p),v=sub(b.v,a.v),q=sub(sb.a,sa.a).map(x=>x/2),r=a.r+b.r;
 return enteringRoot([dot(p,p)-r*r,2*dot(p,v),dot(v,v)+2*dot(p,q),2*dot(v,q),dot(q,q)],horizon);
}
function validate(scene,balls,material){
 if(scene.profile!=='finite-rectangle-planar'||!['width','height'].every(k=>Number.isFinite(scene[k])&&scene[k]>0))return 'unsupported-geometry';
 if(!Array.isArray(balls)||![3,4].includes(balls.length))return 'requires-three-or-four-balls';
 if(!['gravity','slidingFriction','rollingDeceleration','spinDeceleration','ballRestitution','wallRestitution'].every(k=>Number.isFinite(material[k])&&material[k]>=0)||material.gravity<=0||material.ballRestitution>1||material.wallRestitution>1)return 'invalid-material';
 for(const b of balls){
  if(b.z!==undefined||b.vz!==undefined||b.mass!==undefined)return 'unsupported-airborne-or-mass';
  if(!Array.isArray(b.p)||b.p.length!==2||!Array.isArray(b.v)||b.v.length!==2||!Array.isArray(b.w)||b.w.length!==3||![...b.p,...b.v,...b.w,b.r].every(Number.isFinite)||b.r<=0)return 'invalid-state';
  if(b.p[0]<b.r-EPS||b.p[0]>scene.width-b.r+EPS||b.p[1]<b.r-EPS||b.p[1]>scene.height-b.r+EPS)return 'outside-finite-table';
 }
 for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++)if(norm(sub(balls[i].p,balls[j].p))<balls[i].r+balls[j].r-EPS)return 'initial-overlap';
 return null;
}
function runPreparedEventsInternal(scene,input,material,{maxEvents=128,maxTime=60,trace=false}={}){
 const balls=structuredClone(input),events=[];let time=0,count=0;
 const finish=(status,reason)=>({profile:EVENT_PROFILE,status,reason,pass:null,preparedPostStrike:true,time,eventCount:count,balls,...(trace?{events}:{})});
 const invalid=validate(scene,balls,material);if(invalid)return finish('unsupported',invalid);
 if(!Number.isInteger(maxEvents)||maxEvents<1||maxEvents>4096||!Number.isFinite(maxTime)||maxTime<=0)return finish('unsupported','invalid-budget');
 for(;count<maxEvents;){
  if(balls.every(b=>norm(b.v)<=EPS&&norm(b.w)<=EPS))return finish('rest-unscored','no-rule-authority');
  const segments=balls.map(b=>motionSegment(b,material));
  const horizon=Math.min(maxTime-time,...segments.map(s=>s.horizon));
  const candidates=[];
  for(let i=0;i<balls.length;i++){
   const b=balls[i],s=segments[i];
   if(s.horizon<=horizon)candidates.push({t:s.horizon,kind:'transition',i,transition:s.transition});
   for(let axis=0;axis<2;axis++)for(const side of [-1,1]){
    const edge=side<0?b.r:(axis===0?scene.width:scene.height)-b.r;
    // Positive gap inside; radius offsets face, finite other-axis bounds checked below.
    const root=enteringRoot([-side*(b.p[axis]-edge),-side*b.v[axis],-side*s.a[axis]/2],horizon);
    if(root){const other=1-axis,at=b.p[other]+b.v[other]*root.t+s.a[other]*root.t**2/2,extent=other===0?scene.width:scene.height;
     if(at<b.r-EPS||at>extent-b.r+EPS)continue;
     candidates.push({...root,kind:'wall',i,axis,side});}
   }
   for(let j=i+1;j<balls.length;j++){const root=pairTOI(b,balls[j],s,segments[j],horizon);if(root)candidates.push({...root,kind:'pair',i,j});}
  }
  candidates.sort((a,b)=>a.t-b.t);
  if(!candidates.length)return finish('incomplete','no-event-within-time-budget');
  const e=candidates[0];
  if(e.ambiguous)return finish('unsupported','grazing-or-ill-conditioned-root');
  if(candidates[1]&&Math.abs(candidates[1].t-e.t)<=EPS*(1+e.t))return finish('unsupported','simultaneous-events');
  if(e.t<=EPS)return finish('unsupported','zero-time-contact');
  balls.forEach((b,i)=>advance(b,segments[i],e.t));time+=e.t;count++;
  const b=balls[e.i];
  if(e.kind==='wall')b.v[e.axis]*=-material.wallRestitution;
  else if(e.kind==='pair'){
   const c=balls[e.j],n=sub(c.p,b.p),length=norm(n);n.forEach((_,k)=>n[k]/=length);
   const impulse=-(1+material.ballRestitution)*dot(sub(c.v,b.v),n)/2;
   for(let k=0;k<2;k++){b.v[k]-=impulse*n[k];c.v[k]+=impulse*n[k];}
  }else{
   if(e.transition==='rolling'){b.w[0]=-b.v[1]/b.r;b.w[1]=b.v[0]/b.r;}
   if(e.transition==='stop'){b.v=[0,0];b.w[0]=0;b.w[1]=0;}
   if(e.transition==='spin-stop')b.w[2]=0;
   if(e.transition==='combined')return finish('unsupported','coincident-regime-transitions');
  }
  balls.forEach(body=>finite([...body.p,...body.v,...body.w]));
  if(trace)events.push({...e,time});
  if(time>=maxTime-EPS)return finish('incomplete','time-budget');
 }
 return finish('incomplete','event-budget');
}

export function runPreparedEvents(scene,input,material,options={}){
 try{return runPreparedEventsInternal(scene,input,material,options);}
 catch(error){
  if(!(error instanceof NumericalInvalid))throw error;
  return {profile:EVENT_PROFILE,status:'unsupported',reason:'nonfinite-event-arithmetic',pass:null,preparedPostStrike:true,time:0,eventCount:0,balls:structuredClone(input),...(options.trace?{events:[]}:{})};
 }
}
