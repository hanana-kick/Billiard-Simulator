/* One contact-topology branch, one geometric seed, no candidate sampling.
 * The coordinator evaluates requested settings using unchanged PhysicsLab.
 * Residuals must have stable row identities/scales. Inequalities are g(x)<=0
 * (cue clearance, event ordering, etc.). verified:true is an attestation from
 * the separate full physical replay validator, NOT residual convergence.
 * All continuation state is JSON serializable. next() is idempotent until
 * accept() completes the dependency wave; accept order cannot change results.
 */
(function(G){
'use strict';
const KEYS=['angle','elevation','speed','tipX','tipY'];
const copy=x=>JSON.parse(JSON.stringify(x));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const norm=x=>Math.hypot(...x);
const cost=r=>r.reduce((s,x)=>s+x*x,0)/2;
function finish(s,status,reason){
 // Preserve the original local GN trajectory. Scalar clearance restoration is
 // a one-time fallback ONLY after a stationary/trust failure in that stage.
 if(status==='unconverged'&&/^(Stationary constrained point|Trust region exhausted)/.test(reason)&&!s.clearanceAttempted&&s.base?.stage==='clearance'&&s.base.ineq[0]>0&&s.x&&s.bounds[1][1]>s.bounds[1][0]&&s.x[1]<1){
  s.clearanceAttempted=true;s.clearanceBracket={low:s.x[1],high:1,upperKnown:false,iterations:0};s.clearanceFallbackReason=reason;s.phase='clearance-root';s.pending=[];s.received={};s.status='running';s.reason=null;return s;
 }
 s.status=status;s.reason=reason;if(status!=='time-limit')s.pending=[];return s;
}
function settings(s,x){const out={...s.template};KEYS.forEach((k,i)=>out[k]=s.bounds[i][0]+x[i]*s.scales[i]);return out;}
function project(s,x){
 const y=x.map((v,i)=>clamp(v,0,s.bounds[i][0]===s.bounds[i][1]?0:1));
 const a=settings(s,y),r=Math.hypot(a.tipX,a.tipY);
 if(r>s.tipRadius){
  // Segment from the minimum-norm box point stays inside the box. Intersect
  // that segment with the tip disk rather than alternating incompatible clamps.
  const p=[3,4].map(i=>clamp(0,...s.bounds[i])),d=[a.tipX-p[0],a.tipY-p[1]],aa=d[0]*d[0]+d[1]*d[1],bb=2*(p[0]*d[0]+p[1]*d[1]),cc=p[0]*p[0]+p[1]*p[1]-s.tipRadius*s.tipRadius;
  const t=aa?clamp((-bb+Math.sqrt(Math.max(0,bb*bb-4*aa*cc)))/(2*aa),0,1):0;
  [3,4].forEach((i,j)=>y[i]=(p[j]+t*d[j]-s.bounds[i][0])/s.scales[i]);
 }
 return y;
}
function issue(s,points){s.pending=points.map(p=>({...p,id:s.branchId+':'+s.sequence++,settings:settings(s,p.x)}));s.received={};return s.pending.map(copy);}
function create(problem,options={}){
 const seed=problem.seed||problem.settings||{}, defaults={angle:[(seed.angle||0)-180,(seed.angle||0)+180],elevation:[0,85],speed:[.5,4.5],tipX:[-.85,.85],tipY:[-.85,.85]};
 const bounds=KEYS.map(k=>copy((problem.bounds||{})[k]||defaults[k]));
 const s={version:1,branchId:String(problem.id||problem.topology?.id||'branch'),topology:copy(problem.topology||{}),template:copy(seed),bounds,scales:bounds.map(b=>b[1]-b[0]||1),tipRadius:problem.tipRadius??.85,
  options:{maxIterations:options.maxIterations??60,residualTolerance:options.residualTolerance??1e-5,inequalityTolerance:options.inequalityTolerance??1e-7,finiteDifference:options.finiteDifference??1e-4,stepTolerance:options.stepTolerance??1e-9,minTrust:options.minTrust??1e-8,derivativeConsistency:options.derivativeConsistency??.35,maxDerivativeScale:options.maxDerivativeScale??16,secantReuse:options.secantReuse??3,clearanceAngleTolerance:options.clearanceAngleTolerance??.001,maxClearanceIterations:options.maxClearanceIterations??40},
  status:'running',phase:'base',reason:null,iterations:0,evaluations:0,sequence:0,pending:[],received:{},lambda:options.damping??1e-3,trust:options.trustRadius??.2,deadline:options.deadline??null};
 if(bounds.some(b=>b.length!==2||!b.every(Number.isFinite)||b[0]>b[1])||!KEYS.every(k=>Number.isFinite(seed[k]))||!Number.isFinite(s.tipRadius)||s.tipRadius<0||s.tipRadius>=1)return finish(s,'unsupported','Invalid seed or bounds');
 if(bounds[1][0]<0||bounds[1][1]>85||bounds[2][0]<=0||bounds[2][1]>10)return finish(s,'unsupported','Physical input bounds are invalid');
 if(!Object.values(s.options).every(Number.isFinite)||s.options.maxIterations<0||s.options.finiteDifference<=0||s.options.residualTolerance<0||s.options.inequalityTolerance<0||s.options.stepTolerance<=0||s.options.minTrust<=0||!Number.isFinite(s.lambda)||s.lambda<=0||!Number.isFinite(s.trust)||s.trust<=0)return finish(s,'unsupported','Invalid numerical controls');
 // A rectangular tip domain wholly outside the disk is a genuine proof.
 const nearest=b=>clamp(0,b[0],b[1]);
 if(Math.hypot(nearest(bounds[3]),nearest(bounds[4]))>s.tipRadius)return finish(s,'infeasible','Tip bounds and tip radius have empty intersection');
 s.x=project(s,KEYS.map((k,i)=>(seed[k]-bounds[i][0])/s.scales[i]));
 return s;
}
function rows(out){
 if(!Array.isArray(out.residuals)||!out.residuals.every(Number.isFinite)||!Array.isArray(out.inequalities||[])||!(out.inequalities||[]).every(Number.isFinite))return null;
 const eq=out.residuals,ineq=out.inequalities||[];
 if(!eq.length&&!ineq.length)return null;
 return {eq:copy(eq),ineq:copy(ineq),r:eq.concat(ineq.map(v=>Math.max(0,v))),stage:out.residualStage??null,prefix:out.eventPrefix??null,available:out.residualAvailable!==false,cell:out.contactCell??null};
}
function converged(s,b){return norm(b.eq)<=s.options.residualTolerance&&b.ineq.every(v=>v<=s.options.inequalityTolerance);}
function progressed(s,v,out){
 return out.goalVerified===true||(Number.isFinite(v.prefix)&&v.prefix>s.base.prefix)||
  (s.base.stage==='clearance'&&v.stage!==null&&v.stage!=='clearance'&&v.available&&v.ineq.every(g=>g<=s.options.inequalityTolerance));
}
function advanceStage(s,out){
 if(out.goalVerified===true||out.physicalGoal===true){s.phase='verify';return s;}
 if(!s.base.available&&s.base.stage!=='clearance')return finish(s,'unconverged','Missing event residual is unavailable; zero placeholder is not a physical root');
 if(converged(s,s.base)){
  const expected=Array.isArray(s.topology.events)?s.topology.events.length:0;
  if(!s.base.available)return finish(s,'unconverged','Missing event residual is unavailable; zero placeholder is not a physical root');
  if(Number.isFinite(s.base.prefix)&&s.base.prefix<expected)return finish(s,'unconverged','Geometric contact root reached but expected physical event is missing');
  s.phase='verify';return s;
 }
 s.phase='jacobian';return s;
}
function next(s){
 if(s.status!=='running')return [];
 if(s.deadline!==null&&Date.now()>=s.deadline){finish(s,'time-limit','Wall-clock deadline reached; resumable');return [];}
 if(s.pending.length)return s.pending.filter(p=>!Object.hasOwn(s.received,p.id)).map(copy);
 if(s.phase==='base')return issue(s,[{x:s.x.slice(),purpose:'residual'}]);
 if(s.phase==='verify')return issue(s,[{x:s.x.slice(),purpose:'verify'}]);
 if(s.phase==='clearance-root'){
  const bracket=s.clearanceBracket,x=s.x.slice();x[1]=bracket.upperKnown?(bracket.low+bracket.high)/2:bracket.high;
  return issue(s,[{x,purpose:'clearance'}]);
 }
 if(s.iterations>=s.options.maxIterations){finish(s,'unconverged','Iteration limit reached; resumable');return [];}
 if(s.phase==='jacobian'){
  const ps=[],a=settings(s,s.x);
  KEYS.forEach((key,i)=>{
   if(s.retryDerivativeAxes&&!s.retryDerivativeAxes.includes(i))return;
   if(s.bounds[i][0]===s.bounds[i][1])return;
   let lo=0,hi=1;
   if(i===3||i===4){const other=i===3?a.tipY:a.tipX,cap=Math.sqrt(Math.max(0,s.tipRadius*s.tipRadius-other*other));lo=Math.max(lo,(-cap-s.bounds[i][0])/s.scales[i]);hi=Math.min(hi,(cap-s.bounds[i][0])/s.scales[i]);}
   const h=(s.differenceScale||1)*(s.axisDifferenceScale?.[i]||1)*s.options.finiteDifference,up=Math.min(h,hi-s.x[i]),down=Math.min(h,s.x[i]-lo),d=s.axisDirections?.[i]===1?up:s.axisDirections?.[i]===-1?-down:up>=down?up:-down;
   if(Math.abs(d)<1e-12)return;
   const x=s.x.slice();x[i]+=d;ps.push({x,purpose:'jacobian',axis:i,delta:d});
   const d2=d>0?Math.min(2*d,hi-s.x[i]):Math.max(2*d,lo-s.x[i]);if(Math.abs(d2-d)>1e-12){const x2=s.x.slice();x2[i]+=d2;ps.push({x:x2,purpose:'jacobian',axis:i,delta:d2,coarse:true});}
  });
  if(!ps.length){finish(s,'unconverged','No free feasible derivative direction');return [];}
  return issue(s,ps);
 }
 if(s.phase==='trial')return issue(s,[{x:s.trial.slice(),purpose:'trial'}]);
 return [];
}
function linearSolve(A,b){
 const n=b.length,M=A.map((row,i)=>row.concat(b[i]));
 for(let j=0;j<n;j++){
  let k=j;for(let i=j+1;i<n;i++)if(Math.abs(M[i][j])>Math.abs(M[k][j]))k=i;
  if(!Number.isFinite(M[k][j])||Math.abs(M[k][j])<1e-20)return null;
  [M[k],M[j]]=[M[j],M[k]];const v=M[j][j];for(let c=j;c<=n;c++)M[j][c]/=v;
  for(let i=0;i<n;i++)if(i!==j){const f=M[i][j];for(let c=j;c<=n;c++)M[i][c]-=f*M[j][c];}
 }
 const x=M.map(row=>row[n]);return x.every(Number.isFinite)?x:null;
}
// Small convex local QP, solved by a feasible active set. This preserves the
// linearization of already feasible inequalities; violated ones are restored
// through the residual merit model. It is NOT a global feasibility proof.
function constrainedStep(s,A,b){
 const n=KEYS.length,d=Array(n).fill(0),constraints=[];
 const add=(c,limit)=>{const length=norm(c);if(length>1e-14)constraints.push({c:c.map(v=>v/length),limit:Math.max(0,limit)/length});};
 for(let i=0;i<n;i++){
  const c=Array(n).fill(0);c[i]=1;add(c,1-s.x[i]);add(c.map(v=>-v),s.x[i]);
 }
 const tip=settings(s,s.x),tipNorm=Math.hypot(tip.tipX,tip.tipY);
 if(tipNorm>1e-14)add([0,0,0,tip.tipX*s.scales[3]/tipNorm,tip.tipY*s.scales[4]/tipNorm],Math.max(0,s.tipRadius-tipNorm));
 for(let row=0;row<s.base.ineq.length;row++)if(s.base.ineq[row]<=0){
  // Fraction-to-boundary leaves a small portion of existing clearance slack.
  add(s.inequalityJacobian.map(col=>col[row]),-.995*s.base.ineq[row]);
 }
 const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),active=[];
 for(let iteration=0;iteration<128;iteration++){
  const rhs=b.map((v,i)=>v-dot(A[i],d)),free=linearSolve(A,rhs);if(!free)break;
  let p=free,multipliers=[];
  if(active.length){
   const responses=active.map(k=>linearSolve(A,constraints[k].c));if(responses.some(x=>!x))break;
   const schur=active.map(k=>responses.map(r=>dot(constraints[k].c,r)));
   multipliers=linearSolve(schur,active.map(k=>dot(constraints[k].c,free)));
   if(!multipliers)break; // Degenerate local active set; return feasible progress.
   p=free.map((v,i)=>v-responses.reduce((sum,r,j)=>sum+r[i]*multipliers[j],0));
  }
  if(norm(p)<1e-11){
   let remove=-1;for(let j=0;j<multipliers.length;j++)if(multipliers[j]<-1e-10&&(remove<0||multipliers[j]<multipliers[remove]))remove=j;
   if(remove<0)break;active.splice(remove,1);continue;
  }
  let alpha=1,blocker=-1;
  constraints.forEach((c,k)=>{if(active.includes(k))return;const direction=dot(c.c,p);if(direction>1e-12){const allowed=Math.max(0,c.limit-dot(c.c,d))/direction;if(allowed<alpha){alpha=allowed;blocker=k;}}});
  for(let i=0;i<n;i++)d[i]+=alpha*p[i];
  if(blocker>=0)active.push(blocker);
 }
 // Roundoff/degeneracy must never turn an approximate QP into an unsafe step.
 let fraction=1;for(const c of constraints){const v=dot(c.c,d);if(v>c.limit+1e-10)fraction=Math.min(fraction,c.limit/v);}
 return d.map(v=>v*fraction);
}
function makeTrial(s){
 const J=s.jacobian,r=s.base.r,n=KEYS.length;
 const A=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>J[i].reduce((sum,v,k)=>sum+v*J[j][k],0)+(i===j?s.lambda:0)));
 const b=J.map(col=>-col.reduce((sum,v,k)=>sum+v*r[k],0));
 let d=constrainedStep(s,A,b);
 if(!d)return finish(s,'unconverged','Non-finite or singular normal system');
 const length=norm(d);if(length>s.trust)d=d.map(v=>v*s.trust/length);
 s.trial=project(s,s.x.map((v,i)=>v+d[i]));d=s.trial.map((v,i)=>v-s.x[i]);
 // Disk projection can rotate a local QP direction. Contract along the final
 // feasible segment if that rotation crosses any retained linear inequality.
 let fraction=1;
 for(let row=0;row<s.base.ineq.length;row++)if(s.base.ineq[row]<=0){const change=s.inequalityJacobian.reduce((sum,col,i)=>sum+col[row]*d[i],0),limit=-.995*s.base.ineq[row];if(change>limit+1e-12)fraction=Math.min(fraction,limit/change);}
 if(fraction<1){d=d.map(v=>v*fraction);s.trial=s.x.map((v,i)=>v+d[i]);}
 if(norm(d)<s.options.stepTolerance)return finish(s,'unconverged','Stationary constrained point, not an infeasibility proof');
 const predicted=r.map((v,k)=>v+J.reduce((sum,col,i)=>sum+col[k]*d[i],0));
 s.predictedReduction=cost(r)-cost(predicted);s.phase='trial';return s;
}
function accept(s,outcomes){
 if(s.status!=='running')return s;
 for(const out of outcomes){
  const p=s.pending.find(p=>p.id===out.id);if(!p)throw new Error('Unknown or stale evaluation id: '+out.id);
  if(Object.hasOwn(s.received,out.id))throw new Error('Duplicate evaluation id: '+out.id);
  s.received[out.id]=copy(out);
 }
 if(s.pending.some(p=>!Object.hasOwn(s.received,p.id)))return s;
 const wave=s.pending.map(p=>({p,out:s.received[p.id]}));s.evaluations+=wave.length;s.pending=[];s.received={};
 // A verified result is legal only on the explicit replay request. Derivative
 // evaluations cannot bypass four-ball full-rest or cue-obstacle validation.
 if(s.phase==='verify'){
  const out=wave[0].out;
  if(out.verified===true){s.verification=copy(out.verification||{});return finish(s,'verified','Separate physical replay verified the goal');}
  if(out.unsupported)return finish(s,'unsupported',String(out.reason||'Physical validator unsupported'));
  return finish(s,'unconverged',String(out.reason||'Residual root did not pass full physical replay'));
 }
 if(wave.some(w=>w.out.unsupported))return finish(s,'unsupported',String(wave.find(w=>w.out.unsupported).out.reason||'Evaluator unsupported'));
 const values=wave.map(w=>rows(w.out));
 if(s.phase==='clearance-root'){
  const bracket=s.clearanceBracket,out=wave[0].out;
  const clearance=Number.isFinite(out.clearance)?out.clearance:(values[0]&&Number.isFinite(values[0].ineq[0])?-values[0].ineq[0]:null);
  bracket.iterations++;
  if(clearance===null||(!bracket.upperKnown&&clearance<0)){
   // A blocked endpoint is not proof that the elevation interval is infeasible:
   // clearance need not be monotone. Retain the original local full-input solve.
   s.clearanceRestoration={status:'unbracketed',iterations:bracket.iterations,reason:clearance===null?'No finite signed clearance':'Allowed elevation upper bound is also blocked'};
   s.phase='jacobian';return s;
  }
  if(!bracket.upperKnown){bracket.upperKnown=true;bracket.highClearance=clearance;}
  else if(clearance>=0){bracket.high=wave[0].p.x[1];bracket.highClearance=clearance;}
  else bracket.low=wave[0].p.x[1];
  const width=(bracket.high-bracket.low)*s.scales[1];
  if(width<=(s.options.clearanceAngleTolerance??.001)||bracket.iterations>=(s.options.maxClearanceIterations??40)){
   s.x[1]=bracket.high;s.clearanceRestoration={status:'bracketed',iterations:bracket.iterations,clearance:bracket.highClearance,elevationBracket:bracket.low*s.scales[1]+s.bounds[1][0],elevation:settings(s,s.x).elevation};
   // Clearance restoration does not certify a stroke or event. Re-run the
   // ordinary physical evaluator at this exact pose before any root verdict.
   s.phase='base';s.lambda=.001;s.trust=.2;s.differenceScale=1;s.axisDifferenceScale=KEYS.map(()=>1);s.secantUpdates=0;s.rejectedWithModel=0;s.derivativeCache=[];s.retryDerivativeAxes=null;s.axisDirections={};s.derivativeSides={};delete s.jacobian;delete s.inequalityJacobian;return s;
  }
  return s;
 }
 if(s.phase==='base'){
  if(!values[0])return finish(s,'unconverged','Non-finite initial residual');
  s.base=values[0];
  return advanceStage(s,wave[0].out);
 }
 if(s.phase==='jacobian'){
  // Contact acquisition is a discrete continuation step, not a derivative.
  const advanced=wave.findIndex((w,i)=>values[i]&&progressed(s,values[i],w.out));
  if(advanced>=0){s.x=wave[advanced].p.x.slice();s.base=values[advanced];s.differenceScale=1;s.derivativeCache=[];s.retryDerivativeAxes=null;s.derivativeSides={};s.axisDirections={};s.iterations++;return advanceStage(s,wave[advanced].out);}
  // Contact-time cells identify the first physical impact's discrete solver
  // branch. Later event times remain free; they are not differentiation keys.
  const cached=s.derivativeCache||[];
  for(const entry of cached){wave.push({p:entry.p});values.push(entry.value);}
  const compatible=values.map(v=>v&&v.available===s.base.available&&v.stage===s.base.stage&&v.prefix===s.base.prefix&&v.cell===s.base.cell&&v.eq.length===s.base.eq.length&&v.ineq.length===s.base.ineq.length);
  const axesPresent=[...new Set(wave.map(w=>w.p.axis))];
  const missing=axesPresent.filter(axis=>!wave.some((w,i)=>w.p.axis===axis&&compatible[i]));
  if(missing.length){
   s.axisDirections??={};s.derivativeSides??={};
   const opposite=missing.filter(axis=>!s.derivativeSides[axis]);
   if(opposite.length===missing.length){
    for(const axis of missing){s.axisDirections[axis]=-Math.sign(wave.find(w=>w.p.axis===axis).p.delta);s.derivativeSides[axis]=true;}
    s.derivativeCache=wave.map((w,i)=>({p:w.p,value:values[i]})).filter((_,i)=>compatible[i]);s.retryDerivativeAxes=missing;
   }else{
    s.differenceScale=(s.differenceScale||1)*.25;s.iterations++;
    s.derivativeCache=[];s.retryDerivativeAxes=null;s.axisDirections={};s.derivativeSides={};
    if(s.differenceScale*s.options.finiteDifference<1e-10)return finish(s,'unconverged','Contact stage or impact cell boundary has no compatible finite difference');
   }
   s.phase='jacobian';return s;
  }
  s.derivativeCache=[];s.retryDerivativeAxes=null;s.derivativeSides={};s.axisDirections={};
  s.jacobian=KEYS.map(()=>s.base.r.map(()=>0));s.inequalityJacobian=KEYS.map(()=>s.base.ineq.map(()=>0));
  s.axisDifferenceScale??=KEYS.map(()=>1);s.derivativeDiagnostics=[];
  for(const axis of axesPresent){
   const probes=wave.map((w,i)=>({w,i})).filter(({w,i})=>w.p.axis===axis&&compatible[i]).sort((a,b)=>Math.abs(a.w.p.delta)-Math.abs(b.w.p.delta));
   const columns=probes.map(({w,i})=>({r:values[i].r.map((v,k)=>(v-s.base.r[k])/w.p.delta),g:values[i].ineq.map((v,k)=>(v-s.base.ineq[k])/w.p.delta)}));
   const fine=columns[0],coarse=columns[columns.length-1],error=norm(fine.r.map((v,k)=>v-coarse.r[k]))/Math.max(1e-8,norm(fine.r),norm(coarse.r));
   const noisy=error>(s.options.derivativeConsistency??.35),chosen=noisy?coarse:fine;
   s.jacobian[axis]=chosen.r;s.inequalityJacobian[axis]=chosen.g;
   s.derivativeDiagnostics.push({axis,relativeDisagreement:error,scale:s.axisDifferenceScale[axis],compatibleProbes:probes.length});
   if(noisy)s.axisDifferenceScale[axis]=Math.min(s.options.maxDerivativeScale??16,s.axisDifferenceScale[axis]*2);
   else if(probes.length===1&&wave.filter(w=>w.p.axis===axis).length>1)s.axisDifferenceScale[axis]=Math.max(.0625,s.axisDifferenceScale[axis]*.5);
  }
  s.secantUpdates=0;s.rejectedWithModel=0;
  // Re-estimating a stale model warrants re-estimating damping, not retaining
  // the huge regularization accumulated while rejecting that old model.
  const curvature=Math.max(1,...s.jacobian.map(col=>col.reduce((sum,v)=>sum+v*v,0)));
  s.lambda=Math.min(s.lambda,Math.max(1e-9,curvature*1e-3));
  return makeTrial(s);
 }
 if(s.phase==='trial'){
  s.iterations++;
  const v=values[0],valid=v&&v.eq.length===s.base.eq.length&&v.ineq.length===s.base.ineq.length;
  const advanced=valid&&progressed(s,v,wave[0].out);
  const stageCompatible=valid&&v.stage===s.base.stage&&v.prefix===s.base.prefix;
  const compatible=stageCompatible&&v.cell===s.base.cell;
  const reduction=stageCompatible?cost(s.base.r)-cost(v.r):-Infinity;
  const ratio=s.predictedReduction>0?reduction/s.predictedReduction:-Infinity;
  if(valid&&(advanced||reduction>0||(wave[0].out.physicalGoal===true||wave[0].out.goalVerified===true))){
   const old=s.base,delta=s.trial.map((x,i)=>x-s.x[i]),den=delta.reduce((sum,x)=>sum+x*x,0);
   const reuse=compatible&&!advanced&&ratio>.1&&den>1e-18&&(s.secantUpdates||0)<(s.options.secantReuse??3);
   if(reuse){
    for(const [key,before,after] of [['jacobian',old.r,v.r],['inequalityJacobian',old.ineq,v.ineq]]){
     const error=after.map((x,k)=>x-before[k]-s[key].reduce((sum,col,i)=>sum+col[k]*delta[i],0));
     s[key]=s[key].map((col,i)=>col.map((x,k)=>x+error[k]*delta[i]/den));
    }
    s.secantUpdates=(s.secantUpdates||0)+1;
   }
   s.x=s.trial.slice();s.base=v;s.differenceScale=1;s.rejectedWithModel=0;
   if(ratio>.75){s.trust=Math.min(1,s.trust*2);s.lambda=Math.max(1e-12,s.lambda/3);}
   else if(ratio<.25){s.trust*=.5;s.lambda*=3;}
   advanceStage(s,wave[0].out);
   if(reuse&&s.phase==='jacobian'&&s.status==='running')makeTrial(s);
  }else{
   s.trust*=.5;s.lambda*=10;s.rejectedWithModel=(s.rejectedWithModel||0)+1;
   if(s.trust<s.options.minTrust)return finish(s,'unconverged','Trust region exhausted, not an infeasibility proof');
   // Refresh a repeatedly contradicted model at the SAME iterate.
   if(s.rejectedWithModel>=3){s.phase='jacobian';return s;}
   return makeTrial(s);
  }
 }
 return s;
}
function result(s){return {status:s.status,reason:s.reason,settings:s.x?settings(s,s.x):null,topology:copy(s.topology),iterations:s.iterations,evaluations:s.evaluations,residualNorm:s.base?norm(s.base.eq):null,inequalityViolation:s.base?Math.max(0,...s.base.ineq):null,verification:s.verification?copy(s.verification):null,clearanceRestoration:s.clearanceRestoration?copy(s.clearanceRestoration):null};}
function cancel(s){return finish(s,'cancelled','Cancelled; resumable');}
function resume(state,options={}){
 const s=copy(state);if(s.version!==1)throw new Error('Unsupported continuation version');
 if(['verified','infeasible','unsupported'].includes(s.status))return s;
 const resetModel=options.resetModel===true||s.status==='unconverged';
 const continueWave=!resetModel&&(s.status==='running'||s.status==='time-limit');
 s.status='running';s.reason=null;s.deadline=options.deadline??null;
 if(options.maxIterations!==undefined)s.options.maxIterations=options.maxIterations;
 if(continueWave)return s; // Retain pending IDs, partial outcomes and local model.
 s.pending=[];s.received={};
 if(resetModel){
  // Reset convergence controls only. Never replace the retained cue iterate,
  // topology, evaluation counters, or cumulative nonlinear iteration count.
  s.lambda=.001;s.trust=.2;s.differenceScale=1;s.axisDifferenceScale=KEYS.map(()=>1);
  s.secantUpdates=0;s.rejectedWithModel=0;s.derivativeDiagnostics=[];
  delete s.jacobian;delete s.inequalityJacobian;delete s.trial;delete s.predictedReduction;
 }
 s.phase='base';s.derivativeCache=[];s.retryDerivativeAxes=null;s.axisDirections={};s.derivativeSides={};return s;
}

G.LabInverseSolver={create,next,accept,result,cancel,resume};
})(typeof globalThis!=='undefined'?globalThis:window);
