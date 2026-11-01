/* Finite-domain inverse contact geometry. No cue-input sampling. A geometric
 * root is only a continuation seed, never evidence of a PhysicsLab success. */
(function(G){
'use strict';
const rails=['x+','x-','z+','z-'], norm=v=>{const l=Math.hypot(v.x,v.z);return{x:v.x/l,z:v.z/l};},cross=(a,b)=>a.x*b.z-a.z*b.x,dot=(a,b)=>a.x*b.x+a.z*b.z;
function polynomialRoots(coefficients,lo=-1,hi=1){
 const scale=Math.max(...coefficients.map(Math.abs));if(!scale)return[];
 const c=coefficients.map(x=>x/scale);while(c.length>1&&Math.abs(c.at(-1))<1e-15)c.pop();
 const value=x=>c.reduceRight((v,a)=>v*x+a,0),roots=[];
 const add=x=>{if(!roots.some(r=>Math.abs(r-x)<2e-10))roots.push(x);};
 if(c.length===1)return roots;
 if(c.length===2){const x=-c[0]/c[1];return x>=lo-1e-12&&x<=hi+1e-12?[Math.max(lo,Math.min(hi,x))]:[];}
 const critical=polynomialRoots(c.slice(1).map((a,i)=>a*(i+1)),lo,hi),points=[lo,...critical.filter(x=>x>lo&&x<hi),hi];
 for(const x of points)if(Math.abs(value(x))<2e-14)add(x);
 for(let i=1;i<points.length;i++){
  let a=points[i-1],b=points[i],fa=value(a),fb=value(b);
  if(fa*fb>=0||Math.abs(fa)<2e-14||Math.abs(fb)<2e-14)continue;
  for(let k=0;k<60&&b-a>2e-13;k++){const m=(a+b)/2,fm=value(m);if(fa*fm<=0){b=m;fb=fm;}else{a=m;fa=fm;}}
  add((a+b)/2);
 }
 return roots.sort((a,b)=>a-b);
}
function transform(word,h){
 const t={sx:1,sz:1,x:0,z:0};
 for(const rail of word){const a=rail[0],s='s'+a;t[a]+=t[s]*2*h[a]*(rail[1]==='+'?1:-1);t[s]*=-1;}
 return t;
}
const image=(p,t)=>({x:t.sx*p.x+t.x,z:t.sz*p.z+t.z});
// Verify exact chronological wall contacts, rejecting simultaneous corners.
function trace(origin,endpoint,word,h){
 const t=transform(word,h),q=image(endpoint,t),delta={x:q.x-origin.x,z:q.z-origin.z},length=Math.hypot(delta.x,delta.z);
 if(!(length>1e-10)||Math.abs(origin.x)>=h.x||Math.abs(origin.z)>=h.z||Math.abs(endpoint.x)>=h.x||Math.abs(endpoint.z)>=h.z)return null;
 let p={...origin},d=norm(delta),remaining=length;const initialDirection={...d};
 for(const expected of word){
  const tx=Math.abs(d.x)<1e-14?Infinity:((d.x>0?h.x:-h.x)-p.x)/d.x;
  const tz=Math.abs(d.z)<1e-14?Infinity:((d.z>0?h.z:-h.z)-p.z)/d.z;
  if(Math.abs(tx-tz)<1e-9||Math.min(tx,tz)<=1e-9||Math.min(tx,tz)>=remaining-1e-9)return null;
  const a=tx<tz?'x':'z',rail=a+(d[a]>0?'+':'-'),distance=Math.min(tx,tz);if(rail!==expected)return null;
  p={x:p.x+d.x*distance,z:p.z+d.z*distance};remaining-=distance;d[a]*=-1;
 }
 const tx=Math.abs(d.x)<1e-14?Infinity:((d.x>0?h.x:-h.x)-p.x)/d.x,tz=Math.abs(d.z)<1e-14?Infinity:((d.z>0?h.z:-h.z)-p.z)/d.z;
 if(Math.min(tx,tz)<remaining-1e-8)return null;
 if(Math.hypot(p.x+d.x*remaining-endpoint.x,p.z+d.z*remaining-endpoint.z)>1e-7)return null;
 return{length,initialDirection,finalDirection:d};
}
function contactRoots(origin,target,goal,radius,prefixRails,suffixRails,h,kappa=1){
 const pre=transform(prefixRails,h),post=transform(suffixRails,h),q=image(goal,post);
 const A={x:target.x+pre.sx*(pre.x-origin.x),z:target.z+pre.sz*(pre.z-origin.z)},B={x:q.x-target.x,z:q.z-target.z};
 const multiply=(a,b)=>{const out=Array(a.length+b.length-1).fill(0);a.forEach((x,i)=>b.forEach((y,j)=>out[i+j]+=x*y));return out;},roots=[];
 let degenerate=false;
 for(const sign of [1,-1]){
  const C=[kappa*sign*A.x+(1-kappa)*radius,2*kappa*sign*A.z,-kappa*sign*A.x+(1-kappa)*radius],N=[sign*B.z,-2*sign*B.x,-sign*B.z];
  const linear=multiply([-sign*A.z,2*sign*A.x,sign*A.z],[1,0,1]),product=multiply(C,N),ab=cross(A,B);
  const coefficients=[ab,0,2*ab,0,ab].map((x,i)=>x+radius*linear[i]-product[i]);
  if(coefficients.every(x=>Math.abs(x)<1e-15)){degenerate=true;continue;}
  for(const t of polynomialRoots(coefficients)){
   const normal={x:sign*(1-t*t)/(1+t*t),z:sign*2*t/(1+t*t)},contact={x:target.x-radius*normal.x,z:target.z-radius*normal.z};
   const before=trace(origin,contact,prefixRails,h),after=trace(contact,goal,suffixRails,h);if(!before||!after)continue;
   const incoming=before.finalDirection,impact=dot(incoming,normal),outgoing={x:incoming.x-kappa*impact*normal.x,z:incoming.z-kappa*impact*normal.z};
   const residual=Math.abs(cross(outgoing,after.initialDirection));
   if(impact<=1e-9||dot(outgoing,after.initialDirection)<=1e-9||residual>1e-7||roots.some(r=>Math.hypot(r.contact.x-contact.x,r.contact.z-contact.z)<1e-9))continue;
   roots.push({phi:Math.atan2(normal.z,normal.x),contact,normal,incoming,outgoing,initialDirection:before.initialDirection,angle:Math.atan2(before.initialDirection.z,before.initialDirection.x)*180/Math.PI,beforeDistance:before.length,afterDistance:after.length,velocityRetention:Math.hypot(outgoing.x,outgoing.z),residual});
  }
 }
 roots.sort((a,b)=>a.phi-b.phi);roots.degenerate=degenerate;return roots;
}
function* words(length,prefix=[]){if(!length){yield prefix;return;}for(const rail of rails)yield* words(length-1,[...prefix,rail]);}
function accepts(method,pre,post,minimum){
 if(pre.length+post.length<minimum)return false;
 switch(method){
 case 'direct':return !pre.length&&!post.length;
 case 'carom':case 'any':return true;
 case 'bank1':return pre.length===1;
 case 'bank2':return pre.length===2;
 case 'bank3':return pre.length===3&&!post.length;
 case 'allWalls':return new Set(pre).size===4&&!post.length;
 case 'turn':return !pre.length&&post.length>=3&&new Set(post.slice(0,3)).size===3;
 case 'grand':return !pre.length&&post.length>=4&&new Set(post).size>=3;
 case 'return':return !pre.length&&post.some((r,i)=>i>=2&&r===post[i-2]&&r!==post[i-1]);
 case 'cross':return !pre.length&&post.length>=3&&post.slice(0,3).every(r=>r[0]==='z')&&post[0]!==post[1]&&post[0]===post[2];
 default:throw new Error('Unknown inverse method: '+method);
 }
}
function normalizeDomain(domain={}){
 const maxCushions=domain.maxCushions??domain.maxCushionDepth,horizonSeconds=domain.horizonSeconds??domain.physicalHorizonSeconds;
 if(!Number.isSafeInteger(maxCushions)||maxCushions<0)throw new Error('Explicit finite maxCushions is required');
 if(!Number.isFinite(horizonSeconds)||horizonSeconds<=0)throw new Error('Explicit finite horizonSeconds is required');
 const terminalSpeed=domain.terminalSpeed??.25;if(!Number.isFinite(terminalSpeed)||terminalSpeed<=0)throw new Error('terminalSpeed must be positive');
 return{...domain,maxCushions,horizonSeconds,terminalSpeed};
}
function energySeed(req,root,pre,post,domain,cue,first){
 // Names and fallback constants match physics.js DEFAULTS. Runtime defaults
 // take precedence when available; there are no alternate guessed parameter names.
 const p={gravity:9.81,clothFriction:.20,cushionRestitution:.82,...G.LabDefaults,...req.snapshot.params},o=req.options||{},friction=p.clothFriction*p.gravity,retention=p.cushionRestitution;
 // Constant sliding loss + lumped specular rail restitution. Actual cloth,
 // cushion impulse/spin and spring-tip response are solved by the event solver.
 const after2=domain.terminalSpeed**2+2*friction*root.afterDistance;
 const contactSpeed=Math.sqrt(after2)/(root.velocityRetention*Math.pow(retention,post.length));
 const ballSpeed=Math.sqrt(contactSpeed**2+2*friction*root.beforeDistance)/Math.pow(retention,pre.length);
 const elevation=o.elevationMode==='search'?Math.max(0,o.minElevation??0):(req.settings?.elevation??0),e=elevation*Math.PI/180;
 const mass=cue.mass??.21,cueMass=G.LabDimensions.cueMass??.54,speed=ballSpeed*(mass+cueMass)/(2*cueMass*Math.cos(e));
 const analyticProposal={angle:root.angle,elevation,speed,tipX:0,tipY:0},issues=[];
 const lo=o.minSpeed??.5,hi=o.maxSpeed??4.5,elo=o.elevationMode==='search'?Math.max(0,o.minElevation??0):elevation,ehi=o.elevationMode==='search'?Math.min(85,o.maxElevation??85):elevation;
 if(![lo,hi,elo,ehi].every(Number.isFinite)||lo>hi||elo>ehi||elo<0||ehi>85)return{settings:null,analyticProposal,issues:['invalid-cue-domain'],approximate:true};
 const settings={...analyticProposal,speed:Math.max(lo,Math.min(hi,Number.isFinite(speed)?speed:hi)),elevation:Math.max(elo,Math.min(ehi,elevation))};
 if(settings.speed!==speed)issues.push('approximate-energy-proposal-projected-to-speed-bound');
 if(settings.elevation!==elevation)issues.push('approximate-proposal-projected-to-elevation-bound');
 return{settings,analyticProposal,ballSpeed,contactSpeed,issues,projection:'nearest-feasible-box-bound; not physical infeasibility',model:'restricted-sliding-energy-center-tip',spinConstraint:'center-tip-zero-launch-spin',approximate:true};
}
// All order-preserving shuffles of a fixed rail word with repeated first-ball
// contacts. Consecutive repeated contacts remain unresolved event branches:
// only the physical evaluator can establish separation and a true new impact.
function* kissSequences(word,firstId,count,index=0,events=[]){
 if(index===word.length&&!count){yield events;return;}
 if(index<word.length)yield* kissSequences(word,firstId,count,index+1,[...events,{kind:'cushion',rail:word[index]}]);
 if(count)yield* kissSequences(word,firstId,count-1,index,[...events,{kind:'object',id:firstId}]);
}
function firstContactInitializer(origin,target,radius,prefixRails,h){
 const centerPath=trace(origin,target,prefixRails,h);if(!centerPath)return null;
 const normal=centerPath.finalDirection,contact={x:target.x-radius*normal.x,z:target.z-radius*normal.z},path=trace(origin,contact,prefixRails,h);if(!path)return null;
 return{phi:Math.atan2(normal.z,normal.x),contact,normal,incoming:normal,initialDirection:path.initialDirection,angle:Math.atan2(path.initialDirection.z,path.initialDirection.x)*180/Math.PI,beforeDistance:path.length,afterDistance:0,velocityRetention:1,residual:0,model:'inverse-first-contact-only',partial:true};
}
// Any planar path has length >= hypot(total x variation,total z variation).
// Ignoring still-unassigned rails only relaxes its endpoint/event constraints.
function axisVariation(start,end,word,axis,h){
 const points=word.filter(r=>r[0]===axis).map(r=>(r[1]==='+'?1:-1)*h[axis]);
 const gap=(a,b)=>Math.max(0,a[0]-b[1],b[0]-a[1]);
 if(!points.length)return gap(start,end);
 let v=gap(start,[points[0],points[0]])+gap([points.at(-1),points.at(-1)],end);
 for(let i=1;i<points.length;i++)v+=Math.abs(points[i]-points[i-1]);return v;
}
function pathLowerBound(origin,first,second,radius,pre,post,h){
 const cue={x:[origin.x,origin.x],z:[origin.z,origin.z]},contact={x:[first.x-radius,first.x+radius],z:[first.z-radius,first.z+radius]},goal={x:[second.x,second.x],z:[second.z,second.z]};
 const leg=(a,b,word)=>Math.hypot(axisVariation(a.x,b.x,word,'x',h),axisVariation(a.z,b.z,word,'z',h));
 return leg(cue,contact,pre)+leg(contact,goal,post);
}
// A straight specular leg must alternate the two walls of each axis.
// Only the full-root pass uses this proof; every excluded word remains in
// the stage-initializer pass for nonlinear/spinning physical continuation.
function specularWordPossible(word){const last={};for(const rail of word){if(last[rail[0]]===rail)return false;last[rail[0]]=rail;}return true;}
class MinHeap{
 constructor(){this.items=[];}
 get length(){return this.items.length;}
 peek(){return this.items[0];}
 less(a,b){return a.score<b.score||(a.score===b.score&&a.key<b.key);}
 push(v){const a=this.items;let i=a.length;a.push(v);while(i){const p=(i-1)>>1;if(!this.less(a[i],a[p]))break;[a[i],a[p]]=[a[p],a[i]];i=p;}}
 pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){a[0]=last;let i=0;for(;;){let j=i,l=2*i+1,r=l+1;if(l<a.length&&this.less(a[l],a[j]))j=l;if(r<a.length&&this.less(a[r],a[j]))j=r;if(i===j)break;[a[i],a[j]]=[a[j],a[i]];i=j;}}return first;}
}
function enumerate(req,inputDomain){
 const domain=normalizeDomain(inputDomain),o=req.options||{},objects=req.snapshot.objects,cue=objects.find(x=>x.id===req.selectedId);
 const allowKiss=o.allowKiss??o.allowMovingTargets??true;
 const requestedMaxKisses=domain.maxKisses??(allowKiss?1:0);
 if(!Number.isSafeInteger(requestedMaxKisses)||requestedMaxKisses<0)throw new Error('maxKisses must be a finite nonnegative integer');
 domain.maxKisses=allowKiss?requestedMaxKisses:0;
 const rawOrders=domain.targetOrders??(o.order==='either'?[[o.targetId,o.secondId],[o.secondId,o.targetId]]:[[o.targetId,o.secondId]]);
 const orders=rawOrders.filter((pair,i)=>rawOrders.findIndex(other=>other[0]===pair[0]&&other[1]===pair[1])===i);
 // Mode is authoritative over retained method-checkbox state from other modes.
 const methods=[...new Set(o.methodId?[o.methodId]:o.mode==='direct'?['direct']:o.mode==='carom'?['carom']:(o.methods?.length?o.methods:[o.mode==='three'?'any':'carom']))];
 if(!cue)throw new Error('Missing cue object');
 const h={x:G.LabDimensions.width/2-cue.radius,z:G.LabDimensions.depth/2-cue.radius};
 const minimum=o.mode==='three'||o.gameMode==='three'||o.fourBallThreeCushion?3:0;
 const methodMinimum=method=>Math.max(minimum,['direct','carom'].includes(method)?0:3),minimumDepth=Math.min(...methods.map(methodMinimum));
 domain.minCushions=minimumDepth;
 const stats={minimumDepth,expandedNodes:0,seededNodes:0,topologies:0,branches:0,roots:0,unresolved:0,depth:0,complete:false};
 // Shared classification work allowance spans exhausted/fair-merged groups.
 let classified=0;
 const quantum=16;
 function* checkpoint(phase,stratum){
  // Reset before suspension; other strata may consume a quantum meanwhile.
  while(classified>=quantum){classified=0;yield{kind:'classification-checkpoint',checkpoint:true,phase,stratum,classified:quantum};}classified++;
 }
 function* group(phase,kisses,method,firstId,secondId,stratumDepth){
  const stratum={depth:stratumDepth,method,firstId,secondId,kisses};
  const minCushions=methodMinimum(method),first=objects.find(x=>x.id===firstId),second=objects.find(x=>x.id===secondId);
  if(!first||!second||firstId===secondId||firstId===cue.id||secondId===cue.id)throw new Error('Invalid target order');
  const radius=cue.radius+first.radius,kappa=(1+(req.snapshot.params?.ballRestitution??G.LabDefaults?.ballRestitution??.93))*(first.mass??.21)/((cue.mass??.21)+(first.mass??.21));
  const frontier=new MinHeap(),ready=new MinHeap();
  const node=(depth,split,pre,post)=>({depth,split,pre,post,score:pathLowerBound(cue.pos,first.pos,second.pos,radius,pre,post,h),key:JSON.stringify([depth,split,pre,post])});
  // One depth stratum seeds only its depth+1 interval shells.
  const depth=stratumDepth;for(let split=0;split<=depth;split++){yield* checkpoint(phase,stratum);frontier.push(node(depth,split,[],[]));stats.seededNodes++;}
  while(frontier.length||ready.length){
   // Expand equal-bound frontier nodes too, so every equal-distance root is
   // available for a deterministic ID tie break before any is emitted.
   if(ready.length&&(!frontier.length||ready.peek().score<frontier.peek().score)){
    const item=ready.pop(),branch=item.branch;stats.depth=branch.depth;stats.phase=phase;stats.kisses=kisses;
    stats.branches++;if(item.countTopology)stats.topologies++;if(branch.root)stats.roots++;if(branch.status==='unresolved')stats.unresolved++;
    yield branch;continue;
   }
   yield* checkpoint(phase,stratum);
   const n=frontier.pop(),{depth,split}=n;stats.expandedNodes++;
   if(n.pre.length<split){for(const rail of rails){const word=[...n.pre,rail];if(phase!=='full-contact-roots'||specularWordPossible(word))frontier.push(node(depth,split,word,n.post));}continue;}
   if(n.post.length<depth-split){for(const rail of rails){const word=[...n.post,rail];if(phase!=='full-contact-roots'||specularWordPossible(word))frontier.push(node(depth,split,n.pre,word));}continue;}
   const prefixRails=n.pre,suffixRails=n.post;if(!accepts(method,prefixRails,suffixRails,minCushions))continue;
   const roots=contactRoots(cue.pos,first.pos,second.pos,radius,prefixRails,suffixRails,h,kappa),fullContact=roots.length>0&&kisses===0;
   if((phase==='full-contact-roots')!==fullContact)continue;
   const initializer=roots.length?null:firstContactInitializer(cue.pos,first.pos,radius,prefixRails,h);
   for(const suffixEvents of kissSequences(suffixRails,firstId,kisses)){
    yield* checkpoint(phase,stratum);
    const events=[...prefixRails.map(rail=>({kind:'cushion',rail})),{kind:'object',id:firstId},...suffixEvents,{kind:'object',id:secondId}],topologyId=JSON.stringify([firstId,secondId,method,events]);
    const constraints={firstId,secondId,prefixRails,suffixRails,minCushions,horizonSeconds:domain.horizonSeconds,maxCushions:domain.maxCushions,maxKisses:domain.maxKisses,kisses,requirePhysicalReplay:true,stopAtPhysicalRest:true,forbidOpponentCue:o.gameMode==='four',allowKiss};
    const base={phase,events,topology:{events,firstId,secondId,prefixRails,suffixRails,kisses},topologyId,firstId,secondId,method,prefixRails,suffixRails,kisses,depth,constraints,assumptions:['stationary targets for initial geometry only','planar frictionless ball impulse','specular ideal rails','second target center-line endpoint for single-contact roots','repeat-object motion and separation require full event solver','energy model approximate; PhysicsLab event residual required']};
    if(!roots.length&&!initializer){const branch={...base,id:topologyId+':unresolved',status:'unresolved',reason:roots.degenerate?'degenerate-contact-polynomial-and-no-prefix-initializer':'no-restricted-root-or-exact-prefix-initializer',root:null,settings:null,seeds:[],fullPhysicsStatus:'unresolved'};ready.push({score:n.score,key:branch.id,branch,countTopology:true});continue;}
    const geometries=roots.length?roots:[initializer],items=[];
    for(let index=0;index<geometries.length;index++){
     const geometry=geometries[index],partial=kisses>0||!roots.length,seed=energySeed(req,geometry,prefixRails,roots.length?suffixRails:[],domain,cue,first);
     if(partial){seed.model='stage-initializer';seed.scope=roots.length?'single-contact model initializes repeated-contact solve':'first-contact event only';}
     const status=seed.settings?'supported':'unresolved',branch={...base,id:topologyId+(roots.length?':root:'+index:':first-contact'),status,reason:seed.issues.join(','),root:roots.length?geometry:null,geometry,phi:geometry.phi,settings:seed.settings,seeds:seed.settings?[seed]:[],seed,partial,supportedModel:partial?'stage-initializer':'restricted-planar-contact',fullPhysicsStatus:'unresolved'};
     items.push({score:roots.length?geometry.beforeDistance+geometry.afterDistance:n.score,key:branch.id,branch,countTopology:false});
    }
    items.sort((a,b)=>a.score-b.score||(a.key<b.key?-1:a.key>b.key?1:0));items[0].countTopology=true;for(const item of items)ready.push(item);
   }
  }
 }
 function* generate(){
  // Preserve global model/kiss priority, but fairly advance independent
  // depth x method x target-order inverse problems within each pass.
  // Distance best-first applies WITHIN a stratum, not globally across depths.
  for(const phase of ['full-contact-roots','stage-initializers'])for(let kisses=0;kisses<=(phase==='full-contact-roots'?0:domain.maxKisses);kisses++){
   const pending=[];
   for(let depth=minimumDepth;depth<=domain.maxCushions;depth++)for(const method of methods)for(const [firstId,secondId] of orders)pending.push(group(phase,kisses,method,firstId,secondId,depth));
   while(pending.length){
    for(let index=0;index<pending.length;){
     const result=pending[index].next();
     if(result.done){pending.splice(index,1);continue;}
     // A classification checkpoint also ends this stratum's turn.
     // Ordering is deterministic work-quantum fairness, not branch-count fairness.
     yield result.value;index++;
    }
   }
  }
  stats.complete=true;
 }
 const source=generate(),resume=domain.cursor?.nextBranchIndex??0;
 if(!Number.isSafeInteger(resume)||resume<0)throw new Error('Invalid continuation cursor');
 let position=0;
 const iterator={stats,domain,cursor:{nextBranchIndex:resume},next(){
  let restored=0;
  while(position<resume){
   if(restored===quantum)return{done:false,value:{kind:'classification-checkpoint',checkpoint:true,phase:'restore-cursor',restored}};
   const skipped=source.next();if(skipped.done)return skipped;if(skipped.value.checkpoint)return skipped;position++;restored++;
  }
  const result=source.next();if(!result.done&&!result.value.checkpoint)position++;this.cursor={nextBranchIndex:position};return result;
 },[Symbol.iterator](){return this;}};return iterator;
}
G.LabInverseGeometry={enumerate,normalizeDomain,contactRoots,polynomialRoots,trace,transform,accepts,words,kissSequences,firstContactInitializer,pathLowerBound,axisVariation};
})(globalThis);
