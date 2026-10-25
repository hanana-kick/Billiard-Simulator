'use strict';
// Executes the real bridge with explicit orchestration doubles. Not GPU parity.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
require('../src/inverse-events.js');
function harness(config={}){
 const source=fs.readFileSync(require.resolve('../src/evaluate-inverse-gpu-wave.mjs'),'utf8').replace(/^import .*;\n/gm,'').replace('export async function evaluateInverseGpuWave','async function evaluateInverseGpuWave');
 const accepted=new WeakSet(),calls={created:[],stopped:[],consumed:[],disposed:0};let revision=7;
 const frame=(seed,n)=>({frame:n,shotComplete:false,inverseObservation:{phase:n?'after-world-step-before-application':'initial-before-world-step',sequence:n,time:n/100,stepDt:n?.01:0,cue:{radius:.03,position:{x:n/100,y:0,z:0}},objects:[{id:3,radius:.03,position:{x:1,y:0,z:0},impact:false},{id:4,radius:.03,position:{x:2,y:0,z:0},impact:false}],rails:[]}});
 const make=async(seed,options)=>{assert.equal(options.observeInverse,true);calls.created.push(seed.id);let n=0;return{snapshot:()=>frame(seed,n),async step(){if(config.onStep)config.onStep();if(seed.failAt===n+1)throw Error('injected world failure');return frame(seed,++n);},dispose(){calls.disposed++;config.onDispose?.();}};};
 const batch=async(device,seeds,options)=>{const worlds=await Promise.all(seeds.map(s=>make(s,options))),slots=seeds.map((s,i)=>({id:options.ids[i],status:'ready',state:worlds[i].snapshot(),committedSteps:0}));return{snapshot:()=>({slots}),async step(){for(let i=0;i<slots.length;i++){const slot=slots[i];if(slot.status!=='ready')continue;try{slot.state=await worlds[i].step();slot.committedSteps++;}catch(e){slot.status='failed';slot.reason=e.message;}}return{slots};},stopOwner(id){const slot=slots.find(s=>s.id===id);slot.status='stopped';calls.stopped.push(id);},async dispose(){worlds.forEach(w=>w.dispose());}};};
 const scorer=({seed})=>{let done=false;return{consume(state){assert.equal(done,false,'no consume after original scoring stop');calls.consumed.push([seed.id,state.frame]);done=state.frame===seed.stopAt;return{done,steps:state.frame};},finish(){assert.ok(done);return{success:false,failureReason:'genuine-miss'};}};};
 const globals={LabFourBallWorldExperimental:{createGpuStepper:(d,s,o)=>make(s,o)},LabInverseEvents,ShotSearchCore:{validate(){}}};
 const evaluate=new Function('globalThis','createGpuBatchStepper','createFourBallPhysicalScoring','assertPreparedLiveFourBallCandidate','equalData',source+'\nreturn evaluateInverseGpuWave;')(globals,batch,scorer,(p)=>{assert.ok(accepted.has(p),'same-realm candidate required');return p;},assert.deepEqual);
 const job=(id,stopAt=2)=>{const settings={angle:0,elevation:8,speed:2,tipX:0,tipY:0},prepared={seed:{id,stopAt},admission:{settings,selectedId:1,rules:{fourBallThreeCushion:false},time:0,clearance:{distance:.2},sourceRevision:7}};accepted.add(prepared);return{prepared,settings,topology:{id,events:[{kind:'object',id:3},{kind:'object',id:4}]},req:{selectedId:1,snapshot:{world:new Uint8Array([1])},settings,options:{gameMode:'four',mode:'carom',fourBallThreeCushion:false,spin:false}},purpose:'verify'};};
 return{evaluate,job,calls,setRevision:n=>revision=n,options:jobs=>({backend:'webgpu',device:{createBuffer(){},queue:{}},candidates:jobs,getSourceRevision:()=>revision})};
}
test('single and batch preserve job order, true physical miss, independent scorer stop and cleanup',async()=>{
 for(const count of [1,2,4]){const h=harness(),jobs=Array.from({length:count},(_,i)=>h.job('j'+i,i+1)),out=await h.evaluate(h.options(jobs));assert.deepEqual(out.results.map(r=>r.index),jobs.map((_,i)=>i));out.results.forEach((r,i)=>{assert.equal(r.status,'evaluated');assert.equal(r.result.id,'j'+i);assert.equal(r.result.goalVerified,false);assert.equal(r.worldStatus,'stopped');assert.equal(r.result.steps,i+1);});assert.equal(h.calls.disposed,count);assert.equal(h.calls.consumed.length,count*(count+1)/2);if(count>1)assert.equal(h.calls.stopped.length,count);}
});
test('unsupported/missing admission does not become a physical miss or change surviving job order',async()=>{
 const h=harness(),bad=h.job('bad'),good=h.job('good');bad.prepared={...bad.prepared};const out=await h.evaluate(h.options([bad,good]));assert.equal(out.results[0].status,'unsupported');assert.equal(out.results[0].result,null);assert.equal(out.results[1].result.id,'good');assert.deepEqual(h.calls.created,['good']);
});
test('failure is isolated and never synthesized as a rejected physical result',async()=>{
 const h=harness(),bad=h.job('bad'),good=h.job('good',3);bad.prepared.seed.failAt=2;const out=await h.evaluate(h.options([bad,good]));assert.equal(out.results[0].status,'failed');assert.equal(out.results[0].result,null);assert.equal(out.results[1].status,'evaluated');assert.equal(h.calls.disposed,2);
});
test('explicit backend, cancellation and current-source invalidation fail closed',async()=>{
 const h=harness(),options=h.options([h.job('a')]);await assert.rejects(h.evaluate({...options,backend:'cpu'}),/webgpu/);await assert.rejects(h.evaluate({...options,getSourceRevision:null}),/revision/);
 const abort=new AbortController();abort.abort();const cancelled=await h.evaluate({...options,signal:abort.signal});assert.equal(cancelled.results[0].status,'cancelled');assert.equal(h.calls.created.length,0);
 h.setRevision(8);const stale=await h.evaluate(options);assert.equal(stale.results[0].status,'stale');assert.equal(h.calls.created.length,0);
 let active;active=harness({onStep(){active.setRevision(8);}});const result=await active.evaluate(active.options([active.job('a',1)]));assert.equal(result.results[0].status,'stale');assert.equal(result.results[0].result,null);assert.equal(active.calls.disposed,1);
});

test('cancelled single-step commit is not scored; revision change during cleanup discards completed results',async()=>{
 const abort=new AbortController(),h=harness({onStep(){abort.abort(new Error('cancel during dispatch'));}}),cancelled=await h.evaluate({...h.options([h.job('a',1)]),signal:abort.signal});assert.equal(cancelled.results[0].status,'cancelled');assert.equal(cancelled.results[0].committedSteps,1);assert.equal(h.calls.consumed.length,0);assert.equal(h.calls.disposed,1);
 let late;late=harness({onDispose(){late.setRevision(8);}});const stale=await late.evaluate(late.options([late.job('a',1)]));assert.equal(stale.results[0].status,'stale');assert.equal(stale.results[0].result,null);
});

test('cancellation during final cleanup withholds an otherwise completed result',async()=>{const abort=new AbortController(),h=harness({onDispose(){abort.abort();}}),out=await h.evaluate({...h.options([h.job('a',1)]),signal:abort.signal});assert.equal(out.results[0].status,'cancelled');assert.equal(out.results[0].result,null);});

test('all original solver physical purposes preserve labels without becoming clearance-only or unsupported',async()=>{for(const purpose of ['residual','jacobian','trial']){const h=harness(),job=h.job('label');job.purpose=purpose;const out=await h.evaluate(h.options([job]));assert.equal(out.results[0].status,'evaluated');assert.equal(out.results[0].result.purpose,purpose);assert.equal(out.results[0].result.verified,false);}});
