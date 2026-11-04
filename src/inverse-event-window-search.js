/* Experimental, explicit opt-in event-aware inverse coordinator.
 * One algebraic seed per topology, actual cue-geometry feasibility restoration,
 * unchanged native residuals, retained best-first nonlinear continuations, and
 * independent full PhysicsLab replay. No stored winning shot or input scan.
 */
(function(G){
'use strict';
const keys=['angle','elevation','speed','tipX','tipY'];
function create(R,req,options={}){
 if(!['carom','three','direct'].includes(req.options?.mode))throw Error('Event-aware inverse prototype supports two-object carom, direct and three-cushion goals only');
 if(req.finalization!==undefined)throw Error('Explicit source finalization is not yet supported by this isolated coordinator');
 req=structuredClone(req);options=structuredClone(options);
 const domain=G.LabInversePlanner.validate(req),lookahead=options.lookahead??64,frontier=options.frontier??8,maxTimeMs=options.maxTimeMs??req.options.solveTimeMs??20000;
 if(!Number.isSafeInteger(lookahead)||lookahead<1||lookahead>256||!Number.isSafeInteger(frontier)||frontier<1||frontier>32)throw Error('Invalid event frontier');
 if(!Number.isFinite(maxTimeMs)||maxTimeMs<=0)throw Error('Positive finite event search budget required');
 if(options.frontierStepBudget!==undefined&&(!Number.isSafeInteger(options.frontierStepBudget)||options.frontierStepBudget<1))throw Error('Positive integer frontier work budget required');
 if(options.compensateElevationSpeed!==undefined&&typeof options.compensateElevationSpeed!=='boolean')throw Error('Boolean elevation compensation option required');
 return {R,req,domain,source:G.LabInverseGeometry.enumerate(req,domain),queue:[],roots:[],dormant:[],results:[],nextId:0,exhausted:false,finished:false,cancelled:false,evaluations:0,physicsSteps:0,geometryQueries:0,completedWaves:0,epoch:0,lookahead,frontier,started:performance.now(),deadline:performance.now()+maxTimeMs,paused:false,initializationMs:0,frontierStartedSteps:0,selected:null,pending:null,trace:[],admitted:0,unsupported:0,unresolved:0,options};
}
function refill(s){
 if(s.queue.length||s.exhausted)return;
 let work=0;
 while(s.queue.length<s.lookahead&&work++<s.lookahead*32){const n=s.source.next();if(n.done){s.exhausted=true;break;}if(!n.value.checkpoint)s.queue.push(n.value);}
 // Fewer pre-object cushion impulses means less unmodelled spin/reflection in
 // the geometric seed. Every other branch stays queued, not pruned.
 s.queue=s.queue.map((b,i)=>({b,i})).sort((a,b)=>(a.b.prefixRails?.length??Infinity)-(b.b.prefixRails?.length??Infinity)||a.i-b.i).map(x=>x.b);
}
function root(s,branch){
 const o=s.req.options,seed={...branch.settings};
 if(o.elevationMode==='search'&&s.options.restoreClearance!==false){
  const lab=G.PhysicsLab.fromSnapshot(s.R,s.req.snapshot);
  try{const check=lab.cueClearance(lab.get(s.req.selectedId),seed);s.geometryQueries++;
   if(!check.clear){const restored=lab.findCueFeasible(lab.get(s.req.selectedId),seed,{minElevation:o.minElevation??0,maxElevation:o.maxElevation??85,iterations:12});s.geometryQueries+=restored.queries;if(restored.found){const previousElevation=seed.elevation;seed.elevation=restored.settings.elevation;if(s.options.compensateElevationSpeed===true)seed.speed=Math.min(o.maxSpeed??4.5,Math.max(o.minSpeed??.5,seed.speed*Math.cos(previousElevation*Math.PI/180)/Math.cos(seed.elevation*Math.PI/180)));}}
  }finally{lab.dispose();}
 }
 const state=G.LabInverseSolver.create({seed,topology:branch,bounds:{angle:[seed.angle-180,seed.angle+180],elevation:o.elevationMode==='fixed'?[s.req.settings.elevation,s.req.settings.elevation]:[o.minElevation??0,o.maxElevation??85],speed:[o.minSpeed??.5,o.maxSpeed??4.5],tipX:o.spin?[-.55,.55]:[0,0],tipY:o.spin?[-.45,.45]:[0,0]},tipRadius:.6},{maxIterations:40,residualTolerance:1e-4});
 return {branch,state,seed,order:s.admitted++,goalRadius:s.req.snapshot.objects.find(o=>o.id===s.req.selectedId).radius+s.req.snapshot.objects.find(o=>o.id===branch.secondId).radius,observed:false,jobs:[],outcomes:[],waves:0,epoch:s.epoch,last:null};
}
function admit(s){refill(s);while(s.roots.length<s.frontier&&s.queue.length){const b=s.queue.shift();if(b.settings&&b.status==='supported')s.roots.push(root(s,b));else if(b.status==='unsupported')s.unsupported++;else s.unresolved++;}return s.roots.length;}
function score(e){
 if(e.state.phase==='verify')return -Infinity;
 if(!e.observed)return -1e9;
 const b=e.state.base,prefix=b?.prefix??0,total=e.branch.events.length,residual=b?.eq?Math.hypot(...b.eq):100;
 return (1-prefix/total)*100+Math.min(10,residual)+(e.waves*.001);
}
function next(s){
 if(s.cancelled||s.finished||s.paused)return null;if(s.pending)return structuredClone(s.pending);
 if(performance.now()>=s.deadline){s.paused=true;return null;}
 admit(s);
 // Full dependency waves are deterministic work units. Periodically advance
 // another frontier while retaining all previous root states for later epochs.
 if(!s.selected&&s.roots.every(e=>e.observed)&&!s.roots.some(e=>e.state.phase==='verify')&&(s.queue.length||s.dormant.length)&&(s.options.frontierStepBudget!==undefined?s.physicsSteps-s.frontierStartedSteps>=s.options.frontierStepBudget:s.completedWaves>0&&s.completedWaves%16===0)){
  s.dormant.push(...s.roots);s.roots=[];s.epoch++;s.frontierStartedSteps=s.physicsSteps;admit(s);s.completedWaves++;
 }
 if(!s.roots.length){
  if(s.dormant.length){s.roots=s.dormant.splice(0,s.frontier);s.epoch++;for(const e of s.roots)if(e.state.status!=='running')e.state=G.LabInverseSolver.resume(e.state,{maxIterations:e.state.options.maxIterations+40});}
  else if(s.exhausted){s.finished=true;return null;}else return null;
 }
 let e=s.selected;
 if(!e){e=s.roots.slice().sort((a,b)=>score(a)-score(b)||a.branch.id.localeCompare(b.branch.id))[0];s.selected=e;if(!e.jobs.length||e.outcomes.length>=e.jobs.length){e.jobs=G.LabInverseSolver.next(e.state);e.outcomes=[];}}
 if(!e.jobs.length){s.roots=s.roots.filter(x=>x!==e);if(['unconverged','time-limit'].includes(e.state.status))s.dormant.push(e);s.selected=null;return null;}
 const p=e.jobs[e.outcomes.length];
 s.pending={id:s.nextId++,solverId:p.id,purpose:p.purpose,settings:{...p.settings,angle:((p.settings.angle+180)%360+360)%360-180},topology:e.branch,req:s.req};return structuredClone(s.pending);
}
function accept(s,id,out){
 if(!s.pending||s.pending.id!==id)throw Error('Unknown or stale event-root job');
 out=structuredClone(out);
 const e=s.selected,p=e.jobs[e.outcomes.length],job=s.pending;
 if(!out||out.id!==e.branch.id||out.purpose!==job.purpose||!keys.every(k=>out.settings?.[k]===job.settings[k]))throw Error('Event-root outcome identity mismatch');
 if(out.verified===true&&(job.purpose!=='verify'||out.prefixOnly||out.freshReplay!==true||out.physicalResult?.success!==true||out.topologyMatched!==true||!keys.every(k=>out.physicalResult?.settings?.[k]===job.settings[k])))throw Error('A probe cannot certify a shot');
 if(out.physicalGoal===true&&(!out.prefixOnly||out.goalVerified||out.verified||out.physicalResult!==null||out.eventPrefix!==e.branch.events.length||out.topologyMatched!==true||out.mismatch))throw Error('Malformed candidate prefix');
 s.pending=null;s.evaluations++;s.physicsSteps+=out.steps||0;
 e.outcomes.push({...out,id:p.id});e.last=out;
 s.trace.push({id,purpose:p.purpose,branchId:e.branch.id,settings:job.settings,prefix:out.eventPrefix,stage:out.residualStage,steps:out.steps,physicalGoal:out.physicalGoal===true,verified:out.verified===true});
 // All derivative inputs came from the existing local numerical solve. A
 // complete ordered prefix can trigger replay immediately, but NEVER certify.
 // No synthetic values are supplied for unevaluated probes.
 if((out.physicalGoal===true&&out.prefixOnly===true||out.goalVerified===true&&out.topologyMatched===true)&&out.verified!==true&&p.purpose!=='verify'){
  const st=e.state;st.x=p.x.slice();st.pending=[];st.received={};st.phase='verify';st.evaluations+=e.outcomes.length;
  e.observed=true;e.jobs=[];e.outcomes=[];s.selected=null;s.completedWaves++;return;
 }
 if(e.outcomes.length<e.jobs.length){if(s.options.frontierStepBudget!==undefined&&s.physicsSteps-s.frontierStartedSteps>=s.options.frontierStepBudget&&s.roots.every(x=>x.observed))s.selected=null;return;}
 G.LabInverseSolver.accept(e.state,e.outcomes);e.waves++;e.observed=true;s.completedWaves++;s.selected=null;
 const status=G.LabInverseSolver.result(e.state).status;
 if(status==='verified'){
  // The coordinator has no way to manufacture an archive entry from a prefix.
  if(p.purpose!=='verify'||out.verified!==true||out.prefixOnly||!out.physicalResult?.success||out.freshReplay!==true||out.topologyMatched!==true)throw Error('Missing independent full physical verification');
  s.results.push({...out.physicalResult,method:e.branch.method,inverseBranch:e.branch.id,searchModel:{stage:'event-aware-inverse-solution',topologyId:e.branch.id}});
  s.roots=s.roots.filter(x=>x!==e);
 }else if(status!=='running'){s.roots=s.roots.filter(x=>x!==e);if(['unconverged','time-limit'].includes(status))s.dormant.push(e);}
}
function result(s){return structuredClone({results:s.results.slice(),evaluations:s.evaluations,physicsSteps:s.physicsSteps,geometryQueries:s.geometryQueries,elapsedMs:performance.now()-s.started,exhaustive:false,globalOptimal:false,complete:s.finished,status:s.cancelled?'cancelled':s.results.length?'verified-feasible-shot':s.paused?'time-limit':s.finished?'domain-finished':'running',partial:!s.finished,continuable:!s.finished&&!s.cancelled,pendingRoots:s.roots.length+s.dormant.length,unseenRoots:s.queue.length,domainExhausted:s.exhausted,unsupportedBranches:s.unsupported,unresolvedBranches:s.unresolved,trace:s.trace.slice()});}
function cancel(s){s.cancelled=true;s.pending=null;s.selected=null;}
function resume(s,timeMs=s.req.options.solveTimeMs??20000){if(s.cancelled||s.finished)return false;if(!Number.isFinite(timeMs)||timeMs<=0)throw Error('Positive finite event search budget required');s.paused=false;s.deadline=performance.now()+timeMs;return true;}
G.LabEventInverseSearchWindow={create,next,accept,result,cancel,resume};
})(globalThis);
