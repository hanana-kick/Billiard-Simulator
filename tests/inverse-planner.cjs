'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function harness({status='unconverged',spin=true}={}){
 const branches=[{id:'branch',method:'carom',firstId:2,secondId:3,status:'supported',settings:{angle:5,elevation:0,speed:2,tipX:.2,tipY:0},events:[{kind:'object',id:2},{kind:'object',id:3}]}],issued=[];
 const ctx={performance:{now:()=>0},Map,Set,console,LabOptimizer:{validate:()=>true,createStagedSearch:()=>{throw Error('legacy sampling forbidden')}},LabRouteRules:{byId:new Map([['carom',{label:'carom'}]]),successIdentity:JSON.stringify},LabInverseGeometry:{enumerate:()=>branches[Symbol.iterator]()},LabInverseSolver:{create:(problem,options)=>({problem,options,status:'running',iterations:0}),next:s=>{const settings={...s.problem.seed,tipX:s.problem.bounds.tipX[0]===s.problem.bounds.tipX[1]?s.problem.bounds.tipX[0]:s.problem.seed.tipX};issued.push(settings);return[{id:'probe',settings,purpose:'residual'}]},accept:s=>{s.status=status;s.iterations=1},result:s=>({status:s.status,iterations:s.iterations}),resume:(s,o)=>({...s,status:'running',options:{...s.options,...o}})}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('../src/inverse-planner.js'),'utf8'),ctx);
 const req={snapshot:{dt:1/960},settings:{angle:0,elevation:8,speed:2,tipX:.2,tipY:0},options:{mode:'carom',maxCushions:0,horizon:16,spin,minSpeed:.5,maxSpeed:4.5,elevationMode:'search'}};
 return{ctx,api:ctx.LabInversePlanner,state:ctx.LabInversePlanner.createStagedSearch({},req),issued};
}
test('default constraint plan does not invoke legacy sampling and spin-off fixes center tip',()=>{const h=harness({spin:false}),jobs=h.api.planWave(h.state);assert.equal(jobs.length,1);assert.equal(jobs[0].kind,'inverse-constraint');assert.equal(jobs[0].settings.tipX,0);});
test('unconverged numerical state survives domain exhaustion and resume',()=>{const h=harness(),jobs=h.api.planWave(h.state);h.api.commitWave(h.state,jobs.map(j=>({id:j.id,outcome:{steps:1}})));h.api.planWave(h.state);assert.equal(h.state.finished,true);assert.equal(h.state.dormant.length,1);assert.equal(h.api.stagedResult(h.state).continuable,true);assert.equal(h.api.resume(h.state),true);assert.equal(h.state.active.length,1);assert.equal(h.state.active[0].state.options.maxIterations,80);assert.equal(h.state.active[0].state.iterations,1);});
test('only independent physical verification can enter success archive',()=>{const h=harness({status:'verified'}),jobs=h.api.planWave(h.state);h.api.commitWave(h.state,jobs.map(j=>({id:j.id,outcome:{verified:false,physicalResult:{success:true},steps:1}})));assert.equal(h.api.stagedResult(h.state).results.length,0);});

test('geometry classification checkpoints yield without inventing unsupported branches',()=>{const h=harness();let pulls=0;h.state.iterator={next(){pulls++;return{done:false,value:{checkpoint:true,kind:'classification-checkpoint',classified:16}}}};const jobs=h.api.planWave(h.state);assert.equal(jobs.length,0);assert.equal(pulls,1);assert.equal(h.state.finished,false);assert.equal(h.state.branches.length,0);assert.equal(h.api.stagedResult(h.state).statusCounts.unsupported,0);});

test('resume excludes user pause time without resetting active elapsed cost',()=>{const h=harness();let now=10;h.ctx.performance.now=()=>now;h.api.pause(h.state);assert.equal(h.api.stagedResult(h.state).elapsedMs,10);now=1010;assert.equal(h.api.stagedResult(h.state).elapsedMs,10);h.api.resume(h.state);now=1025;assert.equal(h.api.stagedResult(h.state).elapsedMs,25);});

test('finished finite domain freezes active cost while dormant roots await resume',()=>{const h=harness();let now=0;h.ctx.performance.now=()=>now;const jobs=h.api.planWave(h.state);now=10;h.api.commitWave(h.state,jobs.map(j=>({id:j.id,outcome:{steps:1}})));assert.equal(h.state.finished,true);now=1010;assert.equal(h.api.stagedResult(h.state).elapsedMs,10);h.api.resume(h.state);now=1030;assert.equal(h.api.stagedResult(h.state).elapsedMs,30);});

test('slice resume fairly admits new roots then resumes the oldest exact solver states',()=>{
 const h=harness({status:'running'});let index=0;
 h.state.iterator={next(){return{done:false,value:{id:'branch-'+index++,method:'carom',settings:{angle:5,elevation:0,speed:2,tipX:0,tipY:0}}}}};
 const first=h.api.planWave(h.state);h.api.commitWave(h.state,first.map(j=>({id:j.id,outcome:{steps:1}})));
 const original=h.state.active.slice(),iterations=h.api.stagedResult(h.state).rootIterations;
 h.api.pause(h.state);h.api.resume(h.state);
 assert.equal(h.state.waiting.length,4);assert.equal(h.api.stagedResult(h.state).rootIterations,iterations);
 const second=h.api.planWave(h.state);assert.ok(second.every(j=>!first.some(old=>old.branchId===j.branchId)));
 h.api.commitWave(h.state,second.map(j=>({id:j.id,outcome:{steps:1}})));h.api.pause(h.state);h.api.resume(h.state);
 assert.deepEqual(h.state.active,original);assert.ok(h.state.active.every((entry,i)=>entry.state===original[i].state));
 assert.equal(h.state.waiting.length,4);assert.equal(h.state.dormant.length,0);
});
test('mid-wave cancellation preserves active ownership until pending probes commit',()=>{
 const h=harness({status:'running'}),jobs=h.api.planWave(h.state),original=h.state.active[0];
 h.api.pause(h.state);h.api.resume(h.state);assert.equal(h.state.active[0],original);assert.equal(h.state.waiting.length,0);
 h.api.commitWave(h.state,jobs.map(j=>({id:j.id,outcome:{steps:1}})));assert.equal(original.state.iterations,1);
});
test('exhausted geometry drains suspended live roots before reporting completion',()=>{
 const h=harness({status:'running'}),jobs=h.api.planWave(h.state);h.api.commitWave(h.state,jobs.map(j=>({id:j.id,outcome:{steps:1}})));
 const original=h.state.active[0];h.state.exhausted=false;h.api.pause(h.state);h.api.resume(h.state);assert.equal(h.state.waiting[0],original);
 const continued=h.api.planWave(h.state);assert.equal(h.state.active[0],original);assert.equal(continued.length,1);assert.equal(h.state.finished,false);
 h.api.disposeSearch(h.state);assert.equal(h.state.waiting.length,0);
});
