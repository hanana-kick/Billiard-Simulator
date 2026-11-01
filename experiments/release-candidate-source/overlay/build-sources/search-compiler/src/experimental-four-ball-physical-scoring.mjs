// Read-only scoring consumer for a genuine numerical four-ball world. No solver,
// expected trajectory, game score, native fallback, or candidate selection here.
const copy=structuredClone;
const need=(ok,message)=>{if(!ok)throw new Error('Unsupported physical scoring producer: '+message);};
const same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation;
const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const finite=Number.isFinite;
const supported=new Set(['original-live-registered-four-ball-created-world','original-placed-goal-four-ball-created-world','original-settled-four-ball-created-world']);
function bindings(seed){
 const objects=seed.sceneRegistry.objects;
 need(objects.length===4&&objects.every(o=>o.shape==='sphere'&&finite(o.radius)&&o.radius>0),'four original spheres required');
 need(new Set(objects.map(o=>o.id)).size===4,'unique original object ids required');
 const pairs=new Map();
 for(const binding of seed.pairSeeds){
  need(binding.ballIndices.length===2,'two-body cache binding required');
  const indices=binding.ballIndices;
  const endpoints=indices.map((i,j)=>{
   const b=seed.balls[i],o=objects.find(o=>o.id===b.id),native=binding.seed.bodies[j];
   need(o&&same(b.body,o.body)&&same(b.pairCollider,o.pairCollider.handle)&&same(native.bodyHandle,o.body)&&same(native.pairCollider,o.pairCollider.handle),'cache must map original pair-collider identities');
   return o.id;
  });
  const key=endpoints.slice().sort((a,b)=>a-b).join(':');need(!pairs.has(key),'duplicate pair cache binding');pairs.set(key,{key:binding.key,indices});
 }
 need(pairs.size===6,'all six genuine pair-cache bindings required');return {objects,pairs};
}
export function createFourBallPhysicalScoring({seed,initial,request,admission,core=globalThis.ShotSearchCore}){
 need(core?.observePhysicalStep&&core?.physicalResult,'shared physical scoring reducer missing');
 need(supported.has(seed?.kind),'supported registered four-ball seed required');
 const req=copy(request),a=copy(admission),mapping=bindings(seed),settings=seed.cueInitial.application.strikeSettings;
 need(req?.options?.gameMode==='four'&&req.options.mode==='carom','four-ball carom request required');
 need(req.selectedId===seed.selectedId&&new Set([req.selectedId,req.options.opponentId,req.options.targetId,req.options.secondId]).size===4&&[req.selectedId,req.options.opponentId,req.options.targetId,req.options.secondId].every(id=>mapping.objects.some(o=>o.id===id)),'original cue, opponent and ordered target identities required');
 need(typeof req.options.fourBallThreeCushion==='boolean'&&[8,16,30].includes(req.options.horizon)&&['shortest','gentle'].includes(req.options.objective),'explicit scoring options required');
 need(exact(req.settings,settings),'request settings must equal actual created stroke settings');
 need(a?.kind==='original-prestrike-cue-clearance'&&a.initialSnapshotSha256===seed.initialSnapshotSha256&&a.selectedId===seed.selectedId&&exact(a.settings,settings),'original candidate-bound admission measurement required');
 need(a.clearance?.clear===true&&finite(a.clearance.distance)&&a.clearance.distance>=0&&a.strikeAccepted===true,'actual clear cue distance and accepted original strike required');
 need(a.time===seed.sourceApplicationTime&&a.sourceApplicationSteps===seed.sourceApplicationSteps,'original admission clock required');
 need(initial?.frame===0&&initial.outerStep===0&&initial.outerSubstep===0&&initial.time===a.time&&initial.sourceApplicationSteps===a.sourceApplicationSteps,'unadvanced genuine initial snapshot required');
 need(Array.isArray(initial.contactEvents)&&Number.isSafeInteger(a.historyContactCount)&&a.historyContactCount===initial.contactEvents.length,'exact initial presentation history cursor required');
 need(exact(initial.contactEvents,seed.initialContactEvents),'initial history must come from seed, not replayed shot events');
 const dt=seed.cueInitial.application.dt;need(finite(dt)&&dt>0,'original outer dt required');
 let current=initial,frame=0,outer=0,cursor=a.historyContactCount,done=false,result=null;
 const input=()=>({dt,time:current.time,cuePresent:()=>{need(typeof current.cue?.present==='boolean','actual cue presence required');return current.cue.present;},
  allSleeping:()=>mapping.objects.every(o=>{const b=current.balls.find(b=>b.id===o.id);need(typeof b?.state.sleeping==='boolean','original sleeping state required');return b.state.sleeping;}),
  sphereIds:()=>mapping.objects.map(o=>o.id),radius:id=>mapping.objects.find(o=>o.id===id)?.radius,
  position:id=>{const p=current.balls.find(b=>b.id===id)?.state.translation;need(Array.isArray(p)&&p.length===3&&p.every(finite),'finite actual ball translation required');return{x:p[0],y:p[1],z:p[2]};},
  positiveImpulse:(id1,id2)=>{
   const binding=mapping.pairs.get([id1,id2].sort((a,b)=>a-b).join(':'));need(binding,'original pair binding missing');
   const rows=current.pairs?.filter(p=>p.key===binding.key);need(rows?.length===1&&exact(rows[0].ballIndices,binding.indices),'committed pair identity missing or changed');
   const p=rows[0].pair;need(p&&[p.pairPresent,p.pointPresent].every(x=>x===0||x===1)&&(!p.pointPresent||p.pairPresent)&&finite(p.impulse),'explicit final point presence and impulse required');
   return !!(p.pairPresent&&p.pointPresent&&p.impulse>0);
  }});
 const accumulator=core.createPhysicalAccumulator(copy(settings),undefined,a.time,input().position(req.selectedId));
 return Object.freeze({
  consume(snapshot){
   need(!done,'cannot consume after scoring stopped');
   need(snapshot?.frame===frame+1&&finite(snapshot.time)&&snapshot.time>current.time,'exact next committed world frame required');
   need(snapshot.outerStep===outer||snapshot.outerStep===outer+1,'no skipped outer boundary');
   need(Number.isSafeInteger(snapshot.outerSubstep)&&snapshot.outerSubstep>=0&&snapshot.sourceApplicationSteps===a.sourceApplicationSteps+snapshot.outerStep,'actual outer phase/source clock required');
   need((snapshot.outerStep===outer+1)===(snapshot.outerSubstep===0),'completed outer phase required');
   need(Number.isSafeInteger(current.subdivisions)&&current.subdivisions>0&&snapshot.outerSubstep===(current.outerSubstep+1)%current.subdivisions,'exact consecutive outer substep required');
   need(Array.isArray(snapshot.contactEvents)&&snapshot.contactEvents.length>=cursor,'append-only actual presentation history required');
   // Prefix identity also rejects replayed/replaced histories and duplicate delivery.
   for(let i=0;i<cursor;i++)need(exact(snapshot.contactEvents[i],current.contactEvents[i]),'presentation history changed');
   current=snapshot;frame=snapshot.frame;
   for(;cursor<snapshot.contactEvents.length;cursor++)core.observePhysicalEvent(req,accumulator,snapshot.contactEvents[cursor]);
   if(snapshot.outerStep!==outer){
    outer=snapshot.outerStep;
    done=core.observePhysicalStep(req,accumulator,input())||core.finishPhysicalHorizon(req,accumulator,input());
   }
   return {done,frame,outerStep:outer,steps:accumulator.steps};
  },
  diagnostics(){return {done,frame,outerStep:outer,steps:accumulator.steps,admissionClearance:copy(a.clearance),accumulator:copy(accumulator)};},
  finish(){need(done,'partial trial cannot produce a final physical result');return result??=core.physicalResult(req.options,accumulator,current.time);}
 });
}
