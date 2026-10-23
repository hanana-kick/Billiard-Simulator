/* Geometry proposes inputs, never outcomes. All candidates are replayed in Rapier.
 * Mirror images and frictionless tangent directions are intentionally only seeds. */
(function(G){
'use strict';
const D=G.LabDimensions,halton=(n,b)=>{let f=1,r=0;while(n){f/=b;r+=f*(n%b);n=Math.floor(n/b);}return r;};
const norm=(x,z)=>{const n=Math.hypot(x,z)||1;return{x:x/n,z:z/n};};
function images(origin,target,radius,maxOrder=4){
 const hx=D.width/2-radius,hz=D.depth/2-radius,out=[];
 for(let ix=-maxOrder;ix<=maxOrder;ix++)for(let iz=-maxOrder;iz<=maxOrder;iz++){
  const order=Math.abs(ix)+Math.abs(iz);if(order>maxOrder)continue;
  const q={x:2*hx*ix+(Math.abs(ix)%2?-target.x:target.x),z:2*hz*iz+(Math.abs(iz)%2?-target.z:target.z)};
  const dx=q.x-origin.x,dz=q.z-origin.z,events=[];
  for(const [axis,h,delta] of [['x',hx,dx],['z',hz,dz]])if(Math.abs(delta)>1e-10){
   for(let k=-maxOrder-1;k<=maxOrder;k++){
    const t=((2*k+1)*h-origin[axis])/delta;
    if(t>1e-8&&t<1-1e-8)events.push({t,rail:axis+(Math.abs(k)%2?'-':'+')});
   }
  }
  events.sort((a,b)=>a.t-b.t);if(events.some((e,i)=>i&&Math.abs(e.t-events[i-1].t)<1e-7))continue;
  if(events.length!==order)continue;
  const distance=Math.hypot(dx,dz);
  out.push({angle:Math.atan2(dz,dx)*180/Math.PI,distance,order,rails:events.map(e=>e.rail),ix,iz,q});
 }
 return out.sort((a,b)=>a.order-b.order||a.distance-b.distance);
}
function matches(method,rails){
 if(method==='turn')return rails.length>=3&&new Set(rails.slice(0,3)).size===3;
 if(method==='grand')return rails.length>=4&&new Set(rails).size>=3;
 if(method==='return')return rails.some((r,k)=>k>=2&&r===rails[k-2]&&r!==rails[k-1]);
 if(method==='cross')return rails.length>=3&&rails.slice(0,3).every(x=>x[0]==='z')&&rails[0]!==rails[1]&&rails[0]===rails[2];
 if(method==='allWalls')return rails.length>=4&&new Set(rails).size===4;
 if(method==='direct')return rails.length===0;
 return rails.length>=3;
}
// Inverse stun geometry: solve the contact point rather than aiming at the
// object centre. Iteration accounts for the outgoing ray starting one diameter
// away from that centre. Cloth/spin/throw still require forward simulation.
function tangentContact(origin,target,destination,radius,sign){
 let ghost={x:target.x,z:target.z},normal,desired;
 for(let i=0;i<12;i++){
  desired=norm(destination.x-ghost.x,destination.z-ghost.z);
  normal={x:-desired.z*sign,z:desired.x*sign};
  ghost={x:target.x+normal.x*radius,z:target.z+normal.z*radius};
 }
 desired=norm(destination.x-ghost.x,destination.z-ghost.z);
 const vin=norm(ghost.x-origin.x,ghost.z-origin.z),dot=vin.x*normal.x+vin.z*normal.z;
 if(dot>=-.01||((vin.x-dot*normal.x)*desired.x+(vin.z-dot*normal.z)*desired.z)<.02)return null;
 return{ghost,normal,desired,angle:Math.atan2(ghost.z-origin.z,ghost.x-origin.x)*180/Math.PI};
}
// Two closed-form ideal stun solutions. Exact only for equal masses,
// elastic frictionless ball contact and specular rails; real-world replay is
// mandatory. This is the primary geometric inverse, not an angular grid scan.
function closedFormContacts(origin,target,goal,radius,pre,post,cueRadius){
 const hx=D.width/2-cueRadius,hz=D.depth/2-cueRadius;
 const q={x:2*hx*post.ix+(Math.abs(post.ix)%2?-goal.x:goal.x),z:2*hz*post.iz+(Math.abs(post.iz)%2?-goal.z:goal.z)};
 const w={x:q.x-target.x,z:q.z-target.z},L=Math.hypot(w.x,w.z);if(L<radius||L<1e-12)return[];
 const roots=[],t=Math.sqrt(Math.max(0,1-radius*radius/(L*L)))/L;
 for(const sign of [-1,1]){
  const n={x:-radius*w.x/(L*L)-sign*t*w.z,z:-radius*w.z/(L*L)+sign*t*w.x},g={x:target.x-radius*n.x,z:target.z-radius*n.z};
  const u={x:2*hx*pre.ix+(Math.abs(pre.ix)%2?-g.x:g.x),z:2*hz*pre.iz+(Math.abs(pre.iz)%2?-g.z:g.z)},ray=norm(u.x-origin.x,u.z-origin.z),d={x:ray.x*(Math.abs(pre.ix)%2?-1:1),z:ray.z*(Math.abs(pre.iz)%2?-1:1)},dot=d.x*n.x+d.z*n.z;
  const v={x:d.x-dot*n.x,z:d.z-dot*n.z},out=norm(q.x-g.x,q.z-g.z);if(dot<=1e-6||v.x*out.x+v.z*out.z<=1e-6)continue;
  const before=images(origin,g,cueRadius,Math.max(1,pre.order)).find(x=>x.ix===pre.ix&&x.iz===pre.iz),after=images(g,goal,cueRadius,Math.max(1,post.order)).find(x=>x.ix===post.ix&&x.iz===post.iz);
  if(!before||!after||before.rails.join()!==pre.rails.join()||after.rails.join()!==post.rails.join())continue;
  roots.push({g,angle:Math.atan2(ray.z,ray.x)*180/Math.PI,distance:Math.hypot(u.x-origin.x,u.z-origin.z)+Math.hypot(q.x-g.x,q.z-g.z),residual:Math.abs(v.x*out.z-v.z*out.x),source:'closed-form-stun',residualModel:'equal-mass-elastic-frictionless',prefix:pre.order,suffix:post.order,spread:.15});
 }
 return roots;
}
// Solve F(phi)=cross(v_out, reflectedGoal-contactPoint)=0 for an
// ideal impact. Restitution/mass are included; spin/cloth remain forward-model
// corrections. Bracketed roots are certified only within their brackets.
function inverseRoots(origin,target,goal,radius,pre,post,cueRadius,kappa=1){
 const hx=D.width/2-cueRadius,hz=D.depth/2-cueRadius;
 const evaluate=phi=>{
  const n={x:Math.cos(phi),z:Math.sin(phi)},g={x:target.x-radius*n.x,z:target.z-radius*n.z};
  const unfolded={x:2*hx*pre.ix+(Math.abs(pre.ix)%2?-g.x:g.x),z:2*hz*pre.iz+(Math.abs(pre.iz)%2?-g.z:g.z)};
  const ray=norm(unfolded.x-origin.x,unfolded.z-origin.z),d={x:ray.x*(Math.abs(pre.ix)%2?-1:1),z:ray.z*(Math.abs(pre.iz)%2?-1:1)},dot=d.x*n.x+d.z*n.z;
  const v={x:d.x-kappa*dot*n.x,z:d.z-kappa*dot*n.z},q={x:2*hx*post.ix+(Math.abs(post.ix)%2?-goal.x:goal.x),z:2*hz*post.iz+(Math.abs(post.iz)%2?-goal.z:goal.z)},out=norm(q.x-g.x,q.z-g.z);
  return{phi,g,angle:Math.atan2(ray.z,ray.x)*180/Math.PI,value:v.x*out.z-v.z*out.x,valid:dot>1e-6&&v.x*out.x+v.z*out.z>1e-6,distance:Math.hypot(unfolded.x-origin.x,unfolded.z-origin.z)+Math.hypot(q.x-g.x,q.z-g.z)};
 };
 const roots=closedFormContacts(origin,target,goal,radius,pre,post,cueRadius),steps=96;
 let left=evaluate(-Math.PI);
 for(let i=1;i<=steps;i++){
  const right=evaluate(-Math.PI+2*Math.PI*i/steps);
  if(left.value*right.value<=0){
   let a=left,b=right,m=a,iterations=0;
   for(;iterations<48;iterations++){m=evaluate((a.phi+b.phi)/2);if(Math.abs(m.value)<1e-10||b.phi-a.phi<1e-10)break;if(a.value*m.value<=0)b=m;else a=m;}
   if(m.valid&&Math.abs(m.value)<1e-7&&!roots.some(r=>Math.abs(r.angle-m.angle)<1e-6)){
    const before=images(origin,m.g,cueRadius,Math.max(1,pre.order)).find(x=>x.ix===pre.ix&&x.iz===pre.iz);
    const after=images(m.g,goal,cueRadius,Math.max(1,post.order)).find(x=>x.ix===post.ix&&x.iz===post.iz);
    if(before&&after&&before.rails.join()===pre.rails.join()&&after.rails.join()===post.rails.join())roots.push({...m,iterations,residual:Math.abs(m.value),source:'inverse-root',residualModel:'restitution-frictionless',prefix:pre.order,suffix:post.order,spread:.15});
   }
  }
  left=right;
 }
 return roots;
}
// Enumerate both sides of the first object contact, rather than treating
// free routes as a union of named families. Round-robin prefix/suffix buckets
// prevents short object-first proposals monopolizing a bounded search.
function freeProposals(req,order=3,prefix=null,maxSeeds=Infinity){
 const cue=req.snapshot.objects.find(o=>o.id===req.selectedId),a=req.snapshot.objects.find(o=>o.id===req.options.targetId),b=req.snapshot.objects.find(o=>o.id===req.options.secondId);
 const r=cue.radius,R=r+a.radius,hx=D.width/2-r,hz=D.depth/2-r;
 const before=images(cue.pos,a.pos,r,order),after=images(a.pos,b.pos,r,order),buckets=[];
 for(let n=order;n<=order;n++)for(let p=0;p<=n;p++){
  if(prefix!==null&&p!==prefix)continue;
  const q=n-p,bucket=[];
  for(const pre of before.filter(s=>s.order===p))for(const post of after.filter(s=>s.order===q)){
   const kappa=(1+(req.snapshot.params?.ballRestitution??.93))*(a.mass??.21)/((cue.mass??.21)+(a.mass??.21));
   bucket.push(...inverseRoots(cue.pos,a.pos,b.pos,R,pre,post,r,kappa));
   for(const sign of [-1,1]){
   let ghost={...a.pos},normal,desired;
   for(let i=0;i<12;i++){desired=norm(post.q.x-ghost.x,post.q.z-ghost.z);normal={x:-desired.z*sign,z:desired.x*sign};ghost={x:a.pos.x+normal.x*R,z:a.pos.z+normal.z*R};}
   const reflected={x:2*hx*pre.ix+(Math.abs(pre.ix)%2?-ghost.x:ghost.x),z:2*hz*pre.iz+(Math.abs(pre.iz)%2?-ghost.z:ghost.z)};
   const ray=norm(reflected.x-cue.pos.x,reflected.z-cue.pos.z),vin={x:ray.x*(Math.abs(pre.ix)%2?-1:1),z:ray.z*(Math.abs(pre.iz)%2?-1:1)},dot=vin.x*normal.x+vin.z*normal.z;
   if(dot>=-.01||((vin.x-dot*normal.x)*desired.x+(vin.z-dot*normal.z)*desired.z)<.02)continue;
   const distance=Math.hypot(reflected.x-cue.pos.x,reflected.z-cue.pos.z)+Math.hypot(post.q.x-ghost.x,post.q.z-ghost.z);
   bucket.push({angle:Math.atan2(ray.z,ray.x)*180/Math.PI,distance,spread:Math.asin(Math.min(.95,R/Math.max(R,pre.distance)))*180/Math.PI*.2,source:'free-inverse',prefix:p,suffix:q});
  }
  }
  buckets.push(bucket.sort((a,b)=>(['closed-form-stun','inverse-root'].indexOf(a.source)+1||3)-(['closed-form-stun','inverse-root'].indexOf(b.source)+1||3)||a.distance-b.distance).slice(0,maxSeeds));
 }
 const out=[];for(let k=0;buckets.some(b=>k<b.length);k++)for(const bucket of buckets)if(bucket[k])out.push(bucket[k]);
 return out;
}
function freeProposalAt(req,index,search){
 // Diagonal enumeration revisits shallow depths with new geometry variants
 // while progressively opening deeper paths. No fixed maximum rail order.
 const minimum=req.options.mode==='three'?3:0;let shell=0,offset=index;
 const size=s=>(s+1)*(minimum+1)+s*(s+1)/2;
 while(offset>=size(shell)){offset-=size(shell);shell++;}
 let depth=0;while(offset>=minimum+depth+1){offset-=minimum+depth+1;depth++;}
 const order=minimum+depth,prefix=offset,variant=shell-depth,key=order+':'+prefix;
 const cache=search.freeSeedCache||(search.freeSeedCache=new Map());
 if(!cache.has(key))cache.set(key,freeProposals(req,order,prefix));
 search.seedMaxOrder=Math.max(search.seedMaxOrder??order,order);
 const bucket=cache.get(key);
 return bucket[variant%Math.max(1,bucket.length)]||{angle:0,spread:180,source:'explore',prefix,suffix:order-prefix};
}
function proposals(req){
 if(['any','carom'].includes(req.options.methodId))return freeProposals(req);

 const cue=req.snapshot.objects.find(o=>o.id===req.selectedId),a=req.snapshot.objects.find(o=>o.id===req.options.targetId),b=req.snapshot.objects.find(o=>o.id===req.options.secondId),method=req.options.methodId;
 const p=cue.pos,t=a.pos,r=cue.radius,collisionRadius=r+a.radius,direct=Math.atan2(t.z-p.z,t.x-p.x)*180/Math.PI;
 const spread=Math.asin(Math.min(.95,collisionRadius/Math.max(collisionRadius,Math.hypot(t.x-p.x,t.z-p.z))))*180/Math.PI;
 const candidates=[];
 const add=(angle,distance,spreadValue=spread,source='tangent')=>candidates.push({angle,distance,spread:spreadValue,source});
 const bank=G.LabRouteRules.byId.get(method)?.prefix;
 if(bank>0){
  const n=method==='allWalls'?4:bank;
  const seedImages=images(p,t,r,n+Number(method==='allWalls')).filter(i=>method==='allWalls'?matches(method,i.rails):i.order===bank);
  for(const im of seedImages){
   add(im.angle,im.distance,Math.asin(Math.min(.95,collisionRadius/im.distance))*180/Math.PI,'bank');
   // Seed a tangential contact that leaves towards the second object after the banks.
   if(b){const desired=norm(b.pos.x-t.x,b.pos.z-t.z);
    for(const sign of [-1,1]){
     const normal={x:-desired.z*sign,z:desired.x*sign},ghost={x:t.x+normal.x*collisionRadius,z:t.z+normal.z*collisionRadius};
     const hx=D.width/2-r,hz=D.depth/2-r;
     const q={x:2*hx*im.ix+(Math.abs(im.ix)%2?-ghost.x:ghost.x),z:2*hz*im.iz+(Math.abs(im.iz)%2?-ghost.z:ghost.z)};
     const input=norm(q.x-p.x,q.z-p.z),vin={x:input.x*(Math.abs(im.ix)%2?-1:1),z:input.z*(Math.abs(im.iz)%2?-1:1)},dot=vin.x*normal.x+vin.z*normal.z;
     if(dot<-.01&&((vin.x-dot*normal.x)*desired.x+(vin.z-dot*normal.z)*desired.z)>.02)add(Math.atan2(q.z-p.z,q.x-p.x)*180/Math.PI,Math.hypot(q.x-p.x,q.z-p.z),spread*.25,'bank-tangent');
    }
   }
  }
 }else if(b){
  const desiredImages=images(t,b.pos,r,method==='grand'?5:4).filter(im=>matches(method,im.rails));
  for(const im of desiredImages){
   const pre={ix:0,iz:0,order:0,rails:[]},kappa=(1+(req.snapshot.params?.ballRestitution??.93))*(a.mass??.21)/((cue.mass??.21)+(a.mass??.21));
   for(const root of inverseRoots(p,t,b.pos,collisionRadius,pre,im,r,kappa))add(root.angle,root.distance,spread*.15,root.source);
   const desired=norm(im.q.x-t.x,im.q.z-t.z);
   for(const sign of [-1,1]){
    const normal={x:-desired.z*sign,z:desired.x*sign},ghost={x:t.x+normal.x*collisionRadius,z:t.z+normal.z*collisionRadius},vin=norm(ghost.x-p.x,ghost.z-p.z),dot=vin.x*normal.x+vin.z*normal.z;
    if(dot>=-.01||((vin.x-dot*normal.x)*desired.x+(vin.z-dot*normal.z)*desired.z)<.02)continue;
    add(Math.atan2(ghost.z-p.z,ghost.x-p.x)*180/Math.PI,im.distance+Math.hypot(ghost.x-p.x,ghost.z-p.z),spread*.25);
    const refined=tangentContact(p,t,im.q,collisionRadius,sign);
    if(refined)add(refined.angle,im.distance+Math.hypot(refined.ghost.x-p.x,refined.ghost.z-p.z),spread*.15,'inverse-contact');
   }
  }
  // Physical collision responses differ from tangent geometry; also explore the full cut interval.
  for(const cut of [0,.48,-.48,.86,-.86,.24,-.24,.68,-.68])add(direct+cut*spread,100+Math.abs(cut),spread,'cut');
 }
 if(!candidates.length)add(direct,0,spread,'direct');
 const unique=[];for(const s of candidates.sort((a,b)=>a.distance-b.distance))if(!unique.some(p=>Math.abs(p.angle-s.angle)<.0001))unique.push(s);
 return unique;
}
function next(search,normalize){
 const {req,count,pool}=search,o=req.options,three=o.mode==='three';
 if(count===0)return normalize({...req.settings,...(!o.spin?{tipX:0,tipY:0}:{})});
 const seeds=['any','carom'].includes(o.methodId)?null:(search.familySeeds||(search.familySeeds=proposals(req)));
 // Refine actual near-misses at the angular scale needed by a 61.5mm ball.
 // The old 0.35-degree-only early refinements jumped over narrow winning intervals.
 const near=pool.find(x=>!x.success&&x.firstHit&&x.cushions>=(three?3:0)&&x.clearance<.16&&x.score<220);
 if(near&&count%4!==0){
  const key=JSON.stringify(near.settings),used=search.nearRefinements||(search.nearRefinements=new Map());
  const k=used.get(key)||0;
  const moves=[['angle',-.025],['angle',.025],['angle',-.06],['angle',.06],['speed',.12],['speed',-.12],['angle',-.12],['angle',.12],['tipX',-.035],['tipX',.035],['tipY',-.04],['tipY',.04]];
  if(k<moves.length){used.set(key,k+1);let [axis,delta]=moves[k];if(!o.spin&&axis.startsWith('tip')){axis='angle';delta*=.2;}return normalize({...near.settings,[axis]:near.settings[axis]+delta});}
 }
 const localExplorations=search.explorations||0;search.explorations=localExplorations+1;
 const k=req.partition?localExplorations*req.partition.count+req.partition.index:localExplorations;
 const p=search.refs.cue.pos,t=search.refs.first.pos;
 const angle=Math.atan2(t.z-p.z,t.x-p.x)*180/Math.PI;
 const spread=Math.asin(Math.min(.95,(search.refs.cue.radius+search.refs.first.radius)/Math.hypot(t.x-p.x,t.z-p.z)))*180/Math.PI;
 const prefix=G.LabRouteRules.byId.get(o.methodId)?.prefix;
 const cuts=[0,-.48,.48,-.86,.86,-.24,.24,-.68,.68];
 // Cover the complete cut interval before spending a small budget on local optima.
 // Each input is still evaluated by the unmodified, full-resolution PhysicsLab.
 if(three&&(prefix===0||prefix===null)&&k<cuts.length)
  return normalize({...req.settings,angle:angle+cuts[k]*spread,speed:4.5,tipX:0,tipY:o.spin?.15:0});
 const offset=three&&(prefix===0||prefix===null)?cuts.length:0,j=Math.max(0,k-offset),seed=['any','carom'].includes(o.methodId)?freeProposalAt(req,j,search):seeds[j%seeds.length],cycle=Math.floor(j/(seeds?.length||16));
 const speeds=three?[4.5,3.8,3.0,2.3]:[2.0,1.3,2.8,3.8];
 const shifts=[0,.15,-.15,.35,-.35];
 const perturb=cycle?((halton(j+1,5)*2-1)*seed.spread*.35):0;
 return normalize({...req.settings,angle:seed.angle+perturb,speed:speeds[(cycle+Math.floor(j/6))%speeds.length],
  tipX:o.spin&&j>5?(halton(j+1,7)*2-1)*.45:0,
  tipY:o.spin?(three&&j<6?.15:shifts[(cycle+Math.floor(j/4))%shifts.length]):0});
}
G.LabRouteSampler={images,tangentContact,closedFormContacts,inverseRoots,freeProposals,freeProposalAt,proposals,next};
})(globalThis);
