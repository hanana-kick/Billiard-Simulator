/* Simulation-based shot search. Geometry only proposes starting angles.
 * Every score/contact uses a fresh, full-resolution copy of PhysicsLab.
 * This is a bounded numerical search, NOT a proof of a global optimum. */
(function(G){
'use strict';
const {len,sub,clamp}=G.LabMath,D=G.LabDimensions;
const wrap=a=>((a+180)%360+360)%360-180;
const halton=(n,b)=>{let f=1,r=0;while(n>0){f/=b;r+=f*(n%b);n=Math.floor(n/b);}return r;};
function validate(req){
 const {snapshot:s,selectedId,options:o}=req;
 if(!s||!o||!['target','carom','direct','three'].includes(o.mode))throw new Error('검색 조건이 올바르지 않습니다.');
 const cue=s.objects.find(b=>b.id===selectedId),first=s.objects.find(b=>b.id===o.targetId),second=s.objects.find(b=>b.id===o.secondId);
 if(!cue||cue.shape!=='sphere'||!first||first.shape!=='sphere'||first.id===cue.id)throw new Error('서로 다른 수구와 목적구를 선택하세요.');
 if(o.mode!=='target'&&(!second||second.shape!=='sphere'||second.id===cue.id||second.id===first.id))throw new Error('첫 공과 두 번째 공은 서로 달라야 합니다.');
 if(![48,128,320].includes(o.budget)&&!req.testBudget)throw new Error('지원하지 않는 탐색량입니다.');
 if(!Number.isInteger(o.budget)||o.budget<1||o.budget>1024||![8,16,30].includes(o.horizon))throw new Error('탐색량·시간 범위를 확인하세요.');
 if(!['shortest','gentle'].includes(o.objective)||!req.settings||!Number.isFinite(req.settings.elevation)||req.settings.elevation<0||req.settings.elevation>80||typeof o.spin!=='boolean')throw new Error('목표 설정이 올바르지 않습니다.');
 for(const [lo,hi,min,max] of [['minSpeed','maxSpeed',.5,4.5],['minElevation','maxElevation',0,80]]){const a=o[lo]??min,b=o[hi]??max;if(!Number.isFinite(a)||!Number.isFinite(b)||a<min||b>max||a>b)throw new Error('탐색 범위가 올바르지 않습니다.');}
 if(o.elevationMode!==undefined&&!['fixed','search'].includes(o.elevationMode))throw new Error('큐 들림 탐색 조건이 올바르지 않습니다.');
 if(o.allowKiss!==undefined&&typeof o.allowKiss!=='boolean')throw new Error('키스 허용 옵션이 올바르지 않습니다.');
 if(o.allowMovingTargets!==undefined&&typeof o.allowMovingTargets!=='boolean')throw new Error('움직이는 목적구 옵션이 올바르지 않습니다.');
 if(o.methodId&&!G.LabRouteRules.byId.has(o.methodId))throw new Error('지원하지 않는 경로 종류입니다.');
 return{cue,first,second};
}
function normalize(settings){
 const s={angle:wrap(settings.angle),elevation:clamp(settings.elevation,0,80),speed:clamp(settings.speed,.5,4.5),tipX:clamp(settings.tipX,-.55,.55),tipY:clamp(settings.tipY,-.45,.45)};
 const m=Math.hypot(s.tipX,s.tipY);if(m>.6){s.tipX*=.6/m;s.tipY*=.6/m;}
 for(const k of Object.keys(s))s[k]=Math.round(s[k]*100000)/100000;
 return s;
}
function proposalAngles(req){
 const {cue,first}=validate(req),p=cue.pos,t=first.pos;
 const direct=Math.atan2(t.z-p.z,t.x-p.x)*180/Math.PI;
 const spread=Math.asin(Math.min(.95,(cue.radius+first.radius)/Math.hypot(t.x-p.x,t.z-p.z)))*180/Math.PI;
 // Mirror points are proposal generators only. No mirrored path is displayed or scored.
 const hx=D.width/2-cue.radius,hz=D.depth/2-cue.radius;
 const seeds=[{angle:direct,spread,order:0}];
 for(let ix=-2;ix<=2;ix++)for(let iz=-2;iz<=2;iz++){
  const order=Math.abs(ix)+Math.abs(iz);if(!order||order>3)continue;
  const x=2*hx*ix+(Math.abs(ix)%2?-t.x:t.x),z=2*hz*iz+(Math.abs(iz)%2?-t.z:t.z);
  const angle=Math.atan2(z-p.z,x-p.x)*180/Math.PI,distance=Math.hypot(x-p.x,z-p.z);
  seeds.push({angle,spread:Math.asin(Math.min(.95,(cue.radius+first.radius)/distance))*180/Math.PI,order});
 }
 return seeds.sort((a,b)=>a.order-b.order);
}
function createSearch(R,req){
 const refs=validate(req),seeds=proposalAngles(req);
 if(req.partition){const {index,count}=req.partition;if(!Number.isInteger(index)||!Number.isInteger(count)||count<1||count>8||index<0||index>=count)throw new Error('잘못된 병렬 탐색 분할');const budget=Math.floor(req.options.budget/count)+(index<req.options.budget%count?1:0);req={...req,testBudget:true,options:{...req.options,budget}};}
 return {R,req,refs,seeds,count:0,evaluated:0,rejected:0,successCount:0,pool:[],successes:[],seen:new Set(),bestMiss:null,started:performance.now(),active:null,finished:false};
}
function nextSettings(search){
 if(search.req.options.methodId)return G.LabRouteSampler.next(search,normalize); 
 const {req,seeds,count,pool}=search,o=req.options,base={...req.settings,tipX:0,tipY:0};
 // Exploit the best physically evaluated candidates, interleaved with broad exploration.
 if(count>24&&count%3!==0&&pool.length){
  const k=Math.floor((count-25)/3)*2+(count%3===2?1:0),axis=Math.floor(k/2)%4,sign=k%2?1:-1;
  const scale=[1,.5,.2,.08][Math.floor(k/8)%4],parent=pool[(Math.floor(k/32)%3===2)?Math.min(2,pool.length-1):0];
  const s={...parent.settings};
  if(axis===0)s.angle+=sign*.3*scale;
  if(axis===1)s.speed+=sign*.45*scale;
  if(axis===2){if(o.spin)s.tipX+=sign*.15*scale;else s.angle+=sign*.08*scale;}
  if(axis===3){if(o.spin)s.tipY+=sign*.15*scale;else s.speed+=sign*.15*scale;}
  return normalize(s);
 }
 if(count===0)return normalize({...req.settings,...(!o.spin?{tipX:0,tipY:0}:{})});
 // Cover the complete cut-angle interval of the first ball early.
 if(count<25){
  const cuts=[0,-.48,.48,-.86,.86,-.24,.24,-.68,.68],cut=cuts[(count-1)%cuts.length];
  const speeds=o.mode==='three'?[3.8,4.5,2.6,3.2]:[2.6,3.8,1.5,4.5];
  return normalize({...base,angle:seeds[0].angle+cut*seeds[0].spread,speed:speeds[Math.floor((count-1)/cuts.length)%speeds.length]});
 }
 const seed=(count%4<2)?seeds[0]:seeds[(count-25)%seeds.length];
 return normalize({...base,angle:count%17===0?360*halton(count,2)-180:seed.angle+(2*halton(count,5)-1)*seed.spread*1.08,
  speed:o.mode==='three'?2.3+2.2*halton(count,3):.65+3.85*halton(count,3),tipX:o.spin?(2*halton(count,7)-1)*.55:0,tipY:o.spin?(2*halton(count,11)-1)*.40:0});
}
// Constraints only select input settings. They never alter the simulated world.
function constrainSettings(search,settings){
 const o=search.req.options,s={...settings};
 s.speed=clamp(s.speed,o.minSpeed??.5,o.maxSpeed??4.5);
 if(o.elevationMode==='search'){
  const low=o.minElevation??0,high=o.maxElevation??30;
  // Interleave low-discrepancy elevation exploration and local refinement.
  const parent=search.pool[0];
  s.elevation=search.count>24&&search.count%3!==0&&parent?
   clamp(parent.settings.elevation+(search.count%2?1:-1)*[2,.5,.1][search.count%3],low,high):
   low+(high-low)*halton(search.count+1,13);
 }else s.elevation=search.req.settings.elevation;
 return normalize(s);
}
// Read solver impulses independently of the UI contact log, whose 120 ms
// debounce would otherwise hide fast double kisses. No body state is changed.
function sampleKisses(trial,selectedId){
 const cue=trial.lab.get(selectedId),p=cue.body.translation();
 for(const other of trial.lab.objects){
  if(other.id===selectedId||other.shape!=='sphere')continue;
  let impact=false;
  trial.lab.world.contactPair(cue.pairCollider||cue.collider,other.pairCollider||other.collider,m=>{
   for(let j=0;j<m.numContacts();j++)if(m.contactImpulse(j)>0)impact=true;
  });
  const separation=len(sub(p,other.body.translation()))-cue.radius-other.radius;
  G.LabRouteRules.observeKiss(trial.kisses,other.id,{impact,separated:separation>.00005,time:trial.lab.time-trial.start});
 }
}
// Bounded damped least-squares in CUE INPUT space, never ball velocity.
// Every finite-difference probe is an ordinary counted PhysicsLab candidate.
function solveLinear(A,b){
 const n=b.length,m=A.map((r,i)=>[...r,b[i]]);
 for(let i=0;i<n;i++){let p=i;for(let j=i+1;j<n;j++)if(Math.abs(m[j][i])>Math.abs(m[p][i]))p=j;
  if(!Number.isFinite(m[p][i])||Math.abs(m[p][i])<1e-14)return null;
  [m[i],m[p]]=[m[p],m[i]];const d=m[i][i];for(let k=i;k<=n;k++)m[i][k]/=d;
  for(let j=0;j<n;j++)if(j!==i){const f=m[j][i];for(let k=i;k<=n;k++)m[j][k]-=f*m[i][k];}
 }
 return m.map(r=>r[n]);
}
function dampedStep(residual,columns,lambda=1e-4){
 const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
 return solveLinear(columns.map((a,i)=>columns.map((b,j)=>dot(a,b)+(i===j?lambda:0))),columns.map(c=>-dot(c,residual)));
}
function projectInputs(settings,req){
 const s=normalize(settings),o=req.options;
 s.speed=clamp(s.speed,o.minSpeed??.5,o.maxSpeed??4.5);
 s.elevation=o.elevationMode==='search'?clamp(s.elevation,o.minElevation??0,o.maxElevation??30):req.settings.elevation;
 return s;
}
function nextDls(search){
 const partition=search.req.partition,localCount=partition?(search.count-partition.index)/partition.count:search.count;
 const axes=['angle'];if((search.req.options.maxSpeed??4.5)>(search.req.options.minSpeed??.5))axes.push('speed');if(search.req.options.spin)axes.push('tipX','tipY');if(search.req.options.elevationMode==='search'&&(search.req.options.maxElevation??30)>(search.req.options.minElevation??0))axes.push('elevation');
 const warmup=Math.max(1,Math.min(10,search.req.options.budget-axes.length-1));
 if(localCount<warmup)return null;
 if(!search.dls&&search.lastDlsEnd!==undefined&&localCount-search.lastDlsEnd<10)return null;
 if(!search.dls&&search.req.options.budget-localCount<axes.length+1)return null;
 const metric=r=>Math.hypot(...(r.residual||[Infinity]));
 if(!search.dls){
  const base=search.pool.find(r=>!r.success&&r.firstHit&&r.score<600&&r.residual&&metric(r)<.5);
  if(!base||search.lastDlsBase===JSON.stringify(base.settings))return null;
  search.lastDlsBase=JSON.stringify(base.settings);
  search.dls={base,axes,steps:{angle:.05,speed:.05,tipX:.025,tipY:.025,elevation:1},columns:[],lambda:search.dlsLambda||1e-4};
 }
 const d=search.dls;
 if(d.columns.length<d.axes.length){
  const axis=d.axes[d.columns.length];let step=d.steps[axis];
  const upper=axis==='speed'?(search.req.options.maxSpeed??4.5):axis==='tipX'?.55:axis==='tipY'?.45:axis==='elevation'?(search.req.options.maxElevation??30):Infinity;
  if(d.base.settings[axis]+step>upper)step=-step;
  const settings=projectInputs({...d.base.settings,[axis]:d.base.settings[axis]+step},search.req);
  step=axis==='angle'?wrap(settings[axis]-d.base.settings[axis]):settings[axis]-d.base.settings[axis];
  if(Math.abs(settings[axis]-d.base.settings[axis])<1e-8){search.dls=null;return null;}
  search.dlsPending={kind:'probe',axis,step,settings};return settings;
 }
 const delta=dampedStep(d.base.residual,d.columns,d.lambda);
 if(!delta||delta.some(x=>!Number.isFinite(x))){search.dls=null;return null;}
 const settings={...d.base.settings};d.axes.forEach((axis,i)=>settings[axis]+=clamp(delta[i],-2,2)*d.steps[axis]);
 search.dlsPending={kind:'step'};return projectInputs(settings,search.req);
}
function finishDls(search,result){
 const pending=search.dlsPending,d=search.dls;if(!pending||!d)return;
 search.dlsPending=null;const stats=search.solverStats||(search.solverStats={probes:0,steps:0,accepted:0,rejected:0});
 const same=result.topology===d.base.topology&&result.residual?.every(Number.isFinite);
 if(pending.kind==='probe'){
  stats.probes++;
  if(!same||JSON.stringify(result.settings)!==JSON.stringify(pending.settings)){stats.rejected++;search.dlsLambda=Math.min(.1,d.lambda*10);search.dls=null;return;}
  d.columns.push(result.residual.map((x,i)=>(x-d.base.residual[i])*d.steps[pending.axis]/pending.step));
 }else{
  stats.steps++;
  const better=result.success||(same&&Math.hypot(...result.residual)<Math.hypot(...d.base.residual));
  if(better){stats.accepted++;search.dlsLambda=Math.max(1e-7,d.lambda*.3);}else{stats.rejected++;search.dlsLambda=Math.min(.1,d.lambda*10);}
  search.lastDlsEnd=search.count;search.dls=null;
 }
}
function restoreClearance(search){
 const f=search.feasibility;if(!f||f.probes>=16)return null;
 const axes=search.req.options.elevationMode==='search'?['elevation','angle','tipX','tipY']:['angle','tipX','tipY'];
 const axis=axes[Math.floor(f.probes/2)%axes.length],sign=f.probes%2?-1:1,scale=f.probes<axes.length*2?1:.5;
 f.probes++;
 const delta={elevation:5,angle:2,tipX:.08,tipY:.08};
 const s=normalize({...f.settings,[axis]:f.settings[axis]+sign*scale*delta[axis]});
 if(search.req.options.elevationMode==='search')s.elevation=clamp(s.elevation,search.req.options.minElevation??0,search.req.options.maxElevation??30);
 else s.elevation=search.req.settings.elevation;
 if(!search.req.options.spin){s.tipX=0;s.tipY=0;}
 return s;
}
function beginTrial(search,settings){
 const {req,R}=search,lab=G.PhysicsLab.fromSnapshot(R,req.snapshot);
 let clearance=lab.cueClearance(lab.get(req.selectedId),settings);
 const fs=search.feasibilityStats||(search.feasibilityStats={checked:0,blocked:0,restored:0});fs.checked++;
 if(!clearance.clear&&req.options.elevationMode==='search'){
  const restored=lab.findCueFeasible(lab.get(req.selectedId),settings,{minElevation:req.options.minElevation??0,maxElevation:req.options.maxElevation??30});
  fs.checked+=restored.queries;
  if(restored.found){settings=normalize(restored.settings);clearance=lab.cueClearance(lab.get(req.selectedId),settings);fs.checked++;fs.restored++;search.dlsPending=null;search.dls=null;}
 }
 if(!clearance.clear){
  fs.blocked++;
  if(!search.feasibility||clearance.distance>search.feasibility.distance)search.feasibility={settings:{...settings},distance:clearance.distance,probes:search.feasibility?.probes||0};
  lab.dispose();search.rejected++;search.dlsPending=null;search.dls=null;return null;
 }
 if(search.feasibility){fs.restored++;search.feasibility=null;}

 const trial={lab,settings,start:lab.time,steps:0,rails:0,firstHit:false,success:false,invalid:false,contacts:[],closest:Infinity,afterFirstClosest:Infinity,firstClosest:Infinity,residual:null,residualDistance:Infinity,length:0,previous:{...lab.get(req.selectedId).body.translation()},maxHeight:0,pending:[],ambiguous:false,kisses:G.LabRouteRules.createKissTracker()};
 const first=req.options.targetId,second=req.options.secondId,needed=req.options.mode==='three'?3:0;
 lab.onEvent=e=>{
  if(e.kind==='cue-obstruction'){trial.cueObstructed=true;trial.invalid=true;return;}
  if(trial.goalLatched)return;
  if(req.options.methodId){
   if(e.kind!=='contact'||!e.a||!e.b)return;
   const other=e.a.id===req.selectedId?e.b:e.b.id===req.selectedId?e.a:null;if(!other)return;
   if(other.kind==='cushion'||other.id!=null)trial.pending.push({label:other.label,id:other.id??null,rail:G.LabRouteRules.railId(other),kind:other.kind==='cushion'?'cushion':'object',time:e.time-trial.start});
   return;
  }
  if(e.kind!=='contact'||!e.a||!e.b)return;
  const other=e.a.id===req.selectedId?e.b:e.b.id===req.selectedId?e.a:null;if(!other)return;
  if(other.kind==='cushion'){trial.rails++;trial.contacts.push({label:other.label,id:null,kind:'cushion',time:e.time-trial.start});return;}
  if(other.id==null)return;
  trial.contacts.push({label:other.label,id:other.id,kind:'object',time:e.time-trial.start});
  if(!trial.firstHit){
   if(other.id!==first){trial.invalid=true;return;}
   trial.firstHit=true;
   if(req.options.mode==='target'){trial.success=true;trial.hitTime=e.time-trial.start;trial.hitRails=trial.rails;}
  }else if(other.id===second&&req.options.mode!=='target'){
   if(trial.rails>=needed){trial.success=true;trial.hitTime=e.time-trial.start;trial.hitRails=trial.rails;}
   else trial.invalid=true;
  }else if(other.id!==first)trial.invalid=true;
 };
 const r=lab.strike(req.selectedId,settings,{saveSnapshot:false});
 if(!r.ok){lab.dispose();search.rejected++;return null;}
 return trial;
}
function stepTrial(search,t,budget=240){
 if(t.invalid)return true;
 if(t.success&&!t.lab?.cue)return true;
 const {req}=search,max=Math.round(req.options.horizon/t.lab.dt),needed=req.options.mode==='three'?3:0;
 for(let i=0;i<budget&&t.steps<max;i++){
  t.lab.step();t.steps++;
  if(t.goalLatched){if(t.cueObstructed)t.invalid=true;if(t.invalid||!t.lab.cue)return true;continue;}
  sampleKisses(t,req.selectedId);
  if(req.options.methodId&&t.pending.length){
   const pending=t.pending.splice(0).sort((a,b)=>a.time-b.time);
   for(let k=0;k<pending.length;){let j=k+1;while(j<pending.length&&Math.abs(pending[j].time-pending[k].time)<1e-9)j++;
    const group=pending.slice(k,j),objects=group.filter(e=>e.kind==='object');
    if((objects.length&&group.some(e=>e.kind==='cushion'))||new Set(objects.map(e=>e.id)).size>1)t.ambiguous=true;
    const seen=new Set();for(const e of group){const key=e.kind+':'+(e.rail||e.id);if(!seen.has(key)){seen.add(key);t.contacts.push(e);}}
    k=j;
   }
   const result=G.LabRouteRules.evaluate(t.contacts,{method:req.options.methodId,firstId:req.options.targetId,secondId:req.options.secondId,ambiguous:t.ambiguous});
   t.rule=result;t.rails=result.total;t.firstHit=result.firstHit;t.success=result.success;t.invalid=result.invalid;
   if(result.complete){t.hitTime=result.contacts.at(-1).time;t.hitRails=result.total;t.contacts=result.contacts;}
  }
  if(t.cueObstructed)t.invalid=true;
  if(!G.LabRouteRules.kissAllowed(req.options)&&t.kisses.contacts.some(e=>!t.success||e.time<=(t.hitTime??Infinity)+1e-9))t.invalid=true;
  const cue=t.lab.get(req.selectedId),pos=cue.body.translation();t.length+=len(sub(pos,t.previous));t.previous={...pos};t.maxHeight=Math.max(t.maxHeight,pos.y-cue.radius);
  const a=t.lab.get(req.options.targetId),b=t.lab.get(req.options.secondId),gap=o=>Math.max(0,len(sub(pos,o.body.translation()))-cue.radius-o.radius);
  const residualTarget=req.options.mode==='target'||!t.firstHit?a:b;
  if(residualTarget){const diff=sub(pos,residualTarget.body.translation()),distance=len(diff),surface=Math.max(0,distance-cue.radius-residualTarget.radius);if((t.residualFirstHit!==t.firstHit)||surface<t.residualDistance){t.residualFirstHit=t.firstHit;t.residualDistance=surface;t.residualTopology=JSON.stringify([t.firstHit,t.contacts.map(e=>[e.kind,e.id??null,e.rail??e.label])]);t.residual=distance>1e-12?[diff.x*surface/distance,diff.y*surface/distance,diff.z*surface/distance]:[0,0,0];}}
  if(!t.firstHit)t.firstClosest=Math.min(t.firstClosest,gap(a));
  if(t.firstHit&&b)t.afterFirstClosest=Math.min(t.afterFirstClosest,gap(b));
  if(req.options.mode==='target')t.closest=Math.min(t.closest,gap(a));
  else if(t.firstHit&&t.rails>=needed)t.closest=Math.min(t.closest,gap(b));
  if(!Number.isFinite(pos.x+pos.y+pos.z))throw new Error('물리 계산에 유효하지 않은 값이 발생했습니다.');
  // Leaving the cloth invalidates a table shot, even if it lands on a target later.
  if(pos.y<-0.05||Math.abs(pos.x)>D.width/2+.07||Math.abs(pos.z)>D.depth/2+.07)t.invalid=true;
  if(t.success&&!t.invalid){t.goalLatched=true;if(!t.lab.cue)return true;}
  if(t.invalid||(!t.lab.cue&&t.lab.objects.every(o=>o.body.isSleeping())))return true;
 }
 if(t.steps>=max&&t.goalLatched&&t.lab.cue){t.invalid=true;t.verificationIncomplete=true;}
 return t.steps>=max;
}
function finishTrial(search,t){
 const o=search.req.options,success=t.success&&!t.invalid;
 const clearance=Number.isFinite(t.closest)?t.closest:t.firstHit&&Number.isFinite(t.afterFirstClosest)?t.afterFirstClosest:Number.isFinite(t.firstClosest)?t.firstClosest:5;
 const cost=o.objective==='gentle'?t.settings.speed:t.length;
 const missing=Math.max(0,(o.mode==='three'?3:0)-t.rails);
 const penalty=success?0:t.invalid?600:t.firstHit?(missing?220+20*missing:100)+25*clearance:450+20*clearance;
 const result={settings:t.settings,success,residual:t.residual,topology:t.residualTopology,score:penalty+cost/100,clearance,firstHit:t.firstHit,cushions:t.hitRails??t.rails,distance:t.length,seconds:t.hitTime??(t.lab.time-t.start),contacts:t.contacts.slice(),maxHeight:t.maxHeight,kissContacts:t.kisses.contacts.slice(),method:o.methodId||null,firstId:o.targetId,secondId:o.secondId,ambiguous:t.ambiguous||false,matchedMethods:success&&o.methodId&&o.mode==='three'?G.LabRouteRules.classify(t.contacts,o.targetId,o.secondId):[]};
 finishDls(search,result);
 t.lab.dispose();search.evaluated++;search.physicsSteps=(search.physicsSteps||0)+t.steps;if(success){search.successCount++;search.successes.push(result);}search.pool.push(result);search.pool.sort((a,b)=>{if(a.success&&b.success){const primary=o.objective==='gentle'?a.settings.speed-b.settings.speed:a.distance-b.distance;return primary||(o.objective==='gentle'?a.distance-b.distance:a.settings.speed-b.settings.speed);}return a.score-b.score});search.pool=search.pool.slice(0,18);
 if(!success&&(!search.bestMiss||result.score<search.bestMiss.score))search.bestMiss=result;
 return result;
}
function advanceSearch(search,budget=240){
 if(search.finished)return true;
 if(!search.active){
  if(search.count>=search.req.options.budget){search.finished=true;return true;}
  const localCount=search.count,partition=search.req.partition;
  if(partition)search.count=localCount*partition.count+partition.index;
  let settings;try{const dls=restoreClearance(search)||nextDls(search);settings=dls?projectInputs(dls,search.req):constrainSettings(search,nextSettings(search));}finally{search.count=localCount+1;}
  let key=JSON.stringify(settings);if(search.seen.has(key)){settings=normalize({...settings,angle:settings.angle+.023*search.count});key=JSON.stringify(settings);}search.seen.add(key);
  search.active=beginTrial(search,settings);
  if(!search.active)return false;
 }
 if(stepTrial(search,search.active,budget)){finishTrial(search,search.active);search.active=null;}
 return false;
}
function progress(search){const fraction=search.active?Math.min(.99,search.active.steps*search.active.lab.dt/search.req.options.horizon):0;return{fraction,activeSeconds:search.active?search.active.steps*search.active.lab.dt:0,nearestGap:search.bestMiss?.firstHit&&search.bestMiss.cushions>=3&&search.bestMiss.score<220?search.bestMiss.clearance:null,tested:search.count-(search.active?1:0),evaluated:search.evaluated,rejected:search.rejected,total:search.req.options.budget,found:search.successCount,elapsedMs:performance.now()-search.started};}
function finishSearch(search){
 const unique=[];
 for(const r of search.successes.slice().sort((a,b)=>search.req.options.objective==='gentle'?a.settings.speed-b.settings.speed||a.distance-b.distance:a.distance-b.distance||a.settings.speed-b.settings.speed))if(!unique.some(p=>G.LabRouteRules.successIdentity(p)===G.LabRouteRules.successIdentity(r)))unique.push({...r,id:unique.length+1});
 return{...progress(search),results:unique,nearest:unique.length?null:search.bestMiss,options:{...search.req.options},hz:Math.round(1/search.req.snapshot.dt),solverStats:search.solverStats||{probes:0,steps:0,accepted:0,rejected:0},globalOptimal:false,exhaustive:false,seedCushionRange:search.req.options.methodId==='carom'?[0,search.seedMaxOrder??0]:search.req.options.methodId==='any'?[3,search.seedMaxOrder??3]:null,seedMaxOrder:search.seedMaxOrder??null,searchModel:'inverse-root-and-damped-physical-solver',physicsSteps:search.physicsSteps||0,feasibilityStats:search.feasibilityStats,feasibilityStatus:search.successes.length?'verified-feasible-shot':'not-found-within-budget',terminationReason:search.finished?'candidate-budget-exhausted':'partial'};
}
function disposeSearch(search){if(search.active){search.active.lab.dispose();search.active=null;}}
G.ShotSearchCore={validate,constrainSettings,sampleKisses,solveLinear,dampedStep,projectInputs,nextDls,createSearch,advanceSearch,finishSearch,disposeSearch,progress,beginTrial,stepTrial,finishTrial};
})(globalThis);
