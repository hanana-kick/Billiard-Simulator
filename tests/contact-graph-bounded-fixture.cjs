'use strict';
// Synthetic arithmetic/transaction fixture only. These disconnected boxes are
// not native Rapier captures and are never a product-world initialization seed.
const f=Math.fround,copy=x=>structuredClone(x),same=(a,b)=>a.index===b.index&&a.generation===b.generation;
const h=index=>({index,generation:index%3+1});
function box(x,r){return{min:[f(x-r),f(-r),f(-r)],max:[f(x+r),f(r),f(r)]};}
function seed(bodyCount=4){
 const base={enabled:true,sensor:false,activeCollisionTypes:15,contactSkin:0,parentLocalIdentity:true};
 const colliders=Array.from({length:16},(_,i)=>({...base,handle:h(i),body:h(i),type:'Fixed',groups:(2<<16)|21,...box(1000+i*10,1)}));
 const bodies=Array.from({length:bodyCount},(_,i)=>({body:h(80+i),primary:h(16+2*i),pair:h(17+2*i),radius:f(.1),softCcdPrediction:0,...box(i*10,.2)}));
 for(const b of bodies)colliders.push({...base,handle:copy(b.primary),body:copy(b.body),type:'Dynamic',groups:(1<<16)|6},{...base,handle:copy(b.pair),body:copy(b.body),type:'Dynamic',groups:(8<<16)|8});
 return{kind:bodyCount===3?'original-three-ball-contact-graph':'prepared-four-ball-contact-graph',adaptiveChangeDetectionMargin:false,lengthUnit:f(1),normalizedPredictionDistance:f(.002),colliders,bodies,edges:[],adjacency:colliders.map(c=>({collider:copy(c.handle),outgoing:[],incoming:[]}))};
}
const poses=s=>s.bodies.map((b,i)=>({body:copy(b.body),translation:[f(i*10),0,0]}));
function at(s,positions){const p=poses(s);for(const[i,x]of Object.entries(positions))p[i].translation[0]=f(x);return p;}
function sourceFat(s,b,proxy,translation){
 const prediction=f(f(s.lengthUnit*s.normalizedPredictionDistance)*.5),margin=f(f(.04)*s.lengthUnit);
 const lo=translation.map(x=>f(f(x-b.radius)-prediction)),hi=translation.map(x=>f(f(x+b.radius)+prediction));
 return lo.every((x,i)=>proxy.min[i]<=x&&hi[i]<=proxy.max[i])?copy(proxy):{min:lo.map(x=>f(x-margin)),max:hi.map(x=>f(x+margin))};
}
function pair(s,i,j){let a=s.colliders.find(c=>same(c.handle,s.bodies[i].pair)),b=s.colliders.find(c=>same(c.handle,s.bodies[j].pair));if(a.handle.index>b.handle.index)[a,b]=[b,a];return{collider1:copy(a.handle),collider2:copy(b.handle),body1:copy(a.body),body2:copy(b.body),active:false};}
module.exports={f,copy,same,seed,poses,at,sourceFat,pair};
