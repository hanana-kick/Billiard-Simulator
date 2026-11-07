'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function harness({objective='shortest',duplicate=false}={}){
 const branches=[5,10,duplicate?5:15].map((angle,i)=>({id:'branch'+i,method:'carom',firstId:2,secondId:3,status:'supported',settings:{angle,elevation:0,speed:2,tipX:0,tipY:0},events:[{kind:'object',id:2},{kind:'object',id:3}]}));
 const ctx={performance:{now:()=>0},structuredClone,Map,Set,LabOptimizer:{validate(){}},LabRouteRules:{byId:new Map([['carom',{label:'Carom'}]]),successIdentity:r=>JSON.stringify([r.firstId,r.secondId,r.settings,r.contacts])},LabInverseGeometry:{enumerate:()=>branches[Symbol.iterator]()}};
 vm.createContext(ctx);for(const file of ['inverse-solver','inverse-planner'])vm.runInContext(fs.readFileSync(require.resolve('../src/'+file+'.js'),'utf8'),ctx);
 const req={snapshot:{dt:1/960},settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0},options:{mode:'carom',targetId:2,secondId:3,maxCushions:0,horizon:16,spin:true,minSpeed:.5,maxSpeed:4.5,elevationMode:'search',objective}};
 const api=ctx.LabInversePlanner,s=api.createStagedSearch({},req),first=api.planWave(s);
 api.commitWave(s,first.map(j=>({id:j.id,outcome:{residuals:[0],goalVerified:true,verified:false,steps:1}})));
 const jobs=api.planWave(s);
 const positive=job=>({id:job.branchId,purpose:'verify',settings:structuredClone(job.settings),verified:true,goalVerified:true,freshReplay:true,topologyMatched:true,eventPrefix:job.topology.events.length,inequalities:[0,-.1],steps:12,physicalResult:{settings:structuredClone(job.settings),success:true,firstId:2,secondId:3,distance:job.settings.angle===10?1:2,contacts:[{kind:'object',id:2},{kind:'object',id:3}],trace:[{x:1} ]}});
 return{api,s,jobs,positive};
}
const snapshot=s=>JSON.stringify(s);
const committedRows=rows=>structuredClone(rows).map(({publicationStatus,...row})=>row);
test('partial verify publication is detached and pure, then commits without dropping or duplicating rows',()=>{
 const {api,s,jobs,positive}=harness(),outcomes=new Map([[jobs[0].id,positive(jobs[0])]]),before=snapshot(s),state=s.active[0].state,pending=s.pending;
 const result=api.stagedVerifiedResult(s,outcomes);assert.equal(result.results.length,1);assert.equal(result.results[0].publicationStatus,'verified-pending-wave');assert.equal(result.tested,3);assert.equal(result.physicsSteps,3);assert.equal(result.statusCounts.verified,0);assert.equal(result.firstSuccessCost,null);assert.equal(snapshot(s),before);assert.equal(s.active[0].state,state);assert.equal(s.pending,pending);
 result.results[0].settings.speed=99;result.results[0].trace[0].x=99;assert.equal(outcomes.get(jobs[0].id).physicalResult.settings.speed,2);assert.equal(outcomes.get(jobs[0].id).physicalResult.trace[0].x,1);
 for(const j of jobs)outcomes.set(j.id,positive(j));const projected=api.stagedVerifiedResult(s,outcomes).results;
 api.commitWave(s,jobs.map(j=>({id:j.id,outcome:outcomes.get(j.id)})));
 assert.deepEqual(structuredClone(api.stagedResult(s).results),committedRows(projected));assert.equal(api.stagedVerifiedResult(s,outcomes).results.length,3);assert.equal(s.evaluations,6);assert.equal(api.stagedVerifiedResult(s,outcomes).results.some(r=>r.publicationStatus),false);
 const detached=api.stagedVerifiedResult(s,outcomes);detached.results[0].contacts[0].id=99;assert.equal(s.archive[0].contacts[0].id,2);
});
test('retained pending outcomes survive pause/resume; unrelated or stale outcome keys cannot publish',()=>{
 const {api,s,jobs,positive}=harness(),outcomes=new Map([[jobs[0].id,positive(jobs[0])],[999,positive(jobs[1])]]),before=api.stagedVerifiedResult(s,outcomes).results;
 api.pause(s);assert.equal(api.resume(s),true);assert.deepEqual(api.stagedVerifiedResult(s,outcomes).results,before);assert.equal(s.pending,jobs);assert.equal(s.evaluations,3);
 api.disposeSearch(s);assert.equal(api.stagedVerifiedResult(s,outcomes).results.length,0);
});
test('publication uses baseline sort and pending order for stable equal-cost duplicate choice',()=>{
 for(const objective of ['shortest','gentle']){
  const {api,s,jobs,positive}=harness({objective,duplicate:true}),outcomes=new Map([...jobs].reverse().map(j=>[j.id,positive(j)])),before=snapshot(s),rows=api.stagedVerifiedResult(s,outcomes).results;
  assert.equal(rows.length,2);assert.equal(rows[0].inverseBranch,'branch1');assert.equal(rows[1].inverseBranch,'branch0');assert.equal(snapshot(s),before);
  api.commitWave(s,jobs.map(j=>({id:j.id,outcome:outcomes.get(j.id)})));assert.deepEqual(structuredClone(api.stagedResult(s).results),committedRows(rows));
 }
});
test('only exact completed independent current verify probes enter either publication or archive',()=>{
 const mutations=[
  ({out})=>out.purpose='residual',({out})=>out.id='wrong',({out})=>out.verified=false,({out})=>out.goalVerified=false,({out})=>delete out.freshReplay,({out})=>out.topologyMatched=false,({out})=>out.prefixOnly=true,({out})=>out.completePhysicalReplay=false,({out})=>out.incomplete=true,({out})=>out.unsupported=true,({out})=>out.mismatch={index:0},({out})=>out.inequalities=[NaN],({out})=>out.inequalities=[.01],({out})=>out.eventPrefix=1,({out})=>out.settings.speed+=.01,({out})=>out.physicalResult.settings.tipX=-0,({out})=>out.physicalResult.firstId=3,({out})=>out.physicalResult.secondId=2,({out})=>out.physicalResult.success=false,
  ({job})=>job.req={...job.req},({job})=>job.wave--,({job})=>job.id+=100,({job})=>job.topology.events[0].id=99,({job})=>job.branchId='wrong',({job})=>job.topology={...job.topology},({job})=>job.solverId='wrong',({job})=>job.kind='candidate',({job})=>job.purpose='jacobian',({s})=>s.active[0].state.phase='trial',({s})=>s.active[0].state.pending[0].settings.speed+=.01,({s})=>s.active[0].state.received[s.active[0].state.pending[0].id]={}
 ];
 for(const mutate of mutations){
  const {api,s,jobs,positive}=harness(),job=jobs[0],out=positive(job);mutate({s,job,out});const before=snapshot(s);
  assert.equal(api.stagedVerifiedResult(s,new Map([[job.id,out]])).results.length,0,String(mutate));assert.equal(snapshot(s),before,String(mutate));
  // For outcome-only corruption, the shared commit admission must also reject it.
  if(String(mutate).startsWith('({out})')){api.commitWave(s,jobs.map(j=>({id:j.id,outcome:j===job?out:{verified:false,steps:0}})));assert.equal(s.archive.length,0,String(mutate));}
 }
});
test('duplicate wave outcome IDs fail atomically before planner or solver mutation',()=>{
 const {api,s,jobs,positive}=harness(),outcomes=jobs.map(j=>({id:j.id,outcome:positive(j)})),before=snapshot(s);outcomes.push(outcomes[0]);assert.throws(()=>api.commitWave(s,outcomes),/Incomplete/);assert.equal(snapshot(s),before);
});
