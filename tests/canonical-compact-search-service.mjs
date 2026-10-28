import test from 'node:test';import assert from 'node:assert/strict';
import {threeBallFixture} from './fixtures/canonical-three-ball-source.mjs';
import {fixture} from './fixtures/canonical-selected-source.mjs';
import {createCanonicalCompactSearchService,createCanonicalCompactSearchServiceHarness} from '../src/direct-candidate/canonical-compact-search-service.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function setup({count=7,profile='mmq1-ball-ball',beforeRun=()=>{},mutate=()=>{},beforeCompile=()=>{},packet=(c)=>[c.candidateId,1,0,1]}={}){
 const f=fixture(),request={scene:f.request.scene,requestId:71,selectedId:f.request.selectedId,purpose:'search',executionProfile:'canonical-local-v1',budget:f.request.budget,rules:{...f.request.rules,search:false}},calls=[],runs=[];
 const options={request,population:Array.from({length:count},(_,i)=>({candidateId:100+i,settings:{...f.candidate.settings,angle:i}})),raw:{absoluteTick:1234,sceneKey:11,requestKey:23,maximumSteps:2048},continuation:{durationTicks:65535,budgets:[2000,2000,20000,20000,20000,20000,20000],maxWorldSteps:128}};
 const runtime={sourceRevision:'test-revision',async createEngine(device,o){calls.push(o);await beforeCompile(o);return{buildRevision:runtime.sourceRevision,candidateCount:o.candidates.length,validationProfile:o.validationProfile,preparation:'sealed-uploads',async run({candidates,signal}){runs.push({candidates,signal});await beforeRun(candidates);const result={buildRevision:runtime.sourceRevision,requestIdentity:o.binding.requestIdentity,sceneIdentity:o.binding.sceneIdentity,epoch:o.request.epoch,candidateKeys:candidates.map(c=>c.candidateKey),compact:Uint32Array.from(candidates.flatMap(packet)),metrics:{readbackBytes:candidates.length*16}};mutate(result,o,candidates);return result;}};}};
 const service=createCanonicalCompactSearchServiceHarness({device:{},selectedWorldProfile:profile},runtime);return{service,options,calls,runs,runtime};
}
test('production cannot accept caller seal/factory; explicit host seam remains labelled',()=>{
 assert.throws(()=>createCanonicalCompactSearchService({sourceQualified:true,createEngine(){}}),{code:'SEARCH_UNSEALED_SOURCE'});
 const f=setup();assert.equal(f.service.capabilities.implementation,'injected-compact-search-test-v1');assert.equal(f.service.capabilities.parallelWidth,16);
});
test('repeated compact N3 plus N1 tail retains all settings and identities without CPU physics',async()=>{
 const f=setup(),updates=[],r=await f.service.runSearch({...f.options,onBatch:x=>updates.push(x)});
 assert.deepEqual(f.calls.map(c=>c.candidates.length),[3,1]);assert.deepEqual(f.runs.map(r=>r.candidates.length),[3,3,1]);
 assert.deepEqual(updates.map(x=>x.tested),[3,6,7]);assert.equal(r.tested,7);assert.equal(r.counts.pass,7);assert.equal(r.metrics.reduce((s,x)=>s+x.readbackBytes,0),112);
 assert.deepEqual(r.rows.map(x=>x.candidateId),[100,101,102,103,104,105,106]);assert.deepEqual(r.rows.map(x=>x.settings.angle),[0,1,2,3,4,5,6]);
 assert.ok(Object.isFrozen(r.rows)&&Object.isFrozen(r.rows[0].settings));assert.equal(r.readRequest().rules.search,false);assert.equal(r.selectedWorldProfile,'mmq1-ball-ball');
 assert.equal(f.calls[0].profile,'mmq1-no-cushion');assert.equal(f.calls[0].binding.localOptions.mixedMotionRevision,'mmq1');
 assert.throws(()=>{r.rows[0].settings.angle=9;});r.assertCurrent();f.service.cancel();assert.throws(()=>r.assertCurrent(),{code:'SEARCH_CANCELLED'});
});
test('N2 uses one compiled N1 engine twice, no fake padding candidates',async()=>{const f=setup({count:2});await f.service.runSearch(f.options);assert.deepEqual(f.calls.map(x=>x.candidates.length),[1]);assert.deepEqual(f.runs.map(x=>x.candidates.map(c=>c.candidateId)),[[100],[101]]);});
test('complete miss/foul remain distinct from unavailable incomplete and unsupported',async()=>{
 const packets=[[1,0,1],[2,1,0],[2,1,0xffffffff],[3,11,0x80000000],[4,4,0x80000000]],f=setup({count:5,packet:c=>[c.candidateId,...packets[c.candidateId-100]]});
 const r=await f.service.runSearch(f.options);assert.deepEqual(r.counts,{pass:1,miss:2,incomplete:1,unsupported:1});assert.deepEqual(r.rows.map(x=>x.score),[1,0,-1,null,null]);assert.deepEqual(r.rows.map(x=>x.selectable),[true,false,false,false,false]);
});
test('malformed packets and backend source/identity/readback drift reject before publication',async()=>{
 for(const change of [r=>r.buildRevision='other',r=>r.requestIdentity='other',r=>r.sceneIdentity='other',r=>r.epoch++,r=>r.candidateKeys.reverse(),r=>r.metrics.readbackBytes=999,r=>r.compact[0]++,r=>r.compact[1]=5,r=>r.compact[2]=7,r=>r.compact[3]=0x80000000]){
  const f=setup({count:3,mutate:change});let published=0;await assert.rejects(f.service.runSearch({...f.options,onBatch:()=>published++}));assert.equal(published,0);
 }
});
test('unadmitted candidate cannot be promoted to PASS; unsupported input remains explicit',async()=>{
 const f=setup({count:1});f.options.population[0].settings.tipX=.9;await assert.rejects(f.service.runSearch(f.options),{code:'SEARCH_BACKEND_CONTRACT'});
 const g=setup({count:1,packet:c=>[c.candidateId,4,4,0x80000000]});g.options.population[0].settings.tipX=.9;assert.equal((await g.service.runSearch(g.options)).rows[0].status,'UNSUPPORTED');
});
test('MMQ2 exact profile options and malformed request/population guards fail before compile',async()=>{
 const f=setup({profile:'mmq2-cushion',count:1});await f.service.runSearch(f.options);assert.equal(f.calls[0].profile,'mmq2-cushion');assert.equal(f.calls[0].binding.localOptions.enableCushionContinuation,true);
 for(const change of [x=>x.request.epoch=1,x=>x.request.rules.search=true,x=>x.request.rules.conditionOnly=true,x=>x.request.rules.allowKiss=false,x=>x.request.purpose='manual',x=>x.continuation.mixedMotionRevision='mmq1',x=>x.population=[],x=>x.population[1].candidateId=x.population[0].candidateId,x=>x.strikeBackend='chunked-16']){
  const g=setup({profile:'mmq2-cushion'});change(g.options);await assert.rejects(g.service.runSearch(g.options));assert.equal(g.calls.length,0);
 }
});
test('input snapshots precede async compile and progress cannot mutate result rows',async()=>{
 const gate=deferred(),entered=deferred(),f=setup({count:3,beforeCompile:async()=>{entered.resolve();await gate.promise;}}),p=f.service.runSearch({...f.options,onBatch:x=>assert.throws(()=>x.rows.push({}))});await entered.promise;f.options.population[0].settings.angle=777;f.options.request.rules.opponentId=999;gate.resolve();const r=await p;assert.equal(r.rows[0].settings.angle,0);assert.notEqual(r.readRequest().rules.opponentId,999);
});
test('source change before publication, callback mutation and external cancellation discard results',async()=>{
 for(const mode of ['source','abort','callback']){let valid=true;const ctrl=new AbortController(),f=setup({count:3,beforeRun:()=>{if(mode==='source')valid=false;if(mode==='abort')ctrl.abort();}});let published=0;
  await assert.rejects(f.service.runSearch({...f.options,signal:ctrl.signal,assertCurrent(){if(!valid)throw Error('source stale');},onBatch(){published++;valid=false;}}));assert.equal(published,mode==='callback'?1:0);
 }
});
test('superseded compile/run stays serialized and cancelled result never publishes',async()=>{
 const gate=deferred(),entered=deferred();let first=true;const f=setup({count:3,beforeCompile:async()=>{if(first){first=false;entered.resolve();await gate.promise;}}});let published=0;
 const p=f.service.runSearch({...f.options,onBatch:()=>published++}),bad=assert.rejects(p,{code:'SEARCH_CANCELLED'});await entered.promise;const q=f.service.runSearch(f.options);await Promise.resolve();assert.equal(f.calls.length,1);gate.resolve();await bad;await q;assert.equal(f.calls.length,2);assert.equal(published,0);assert.equal(f.runs.length,1);
});
test('async source/progress callbacks are rejected and dispose closes owner',async()=>{
 const f=setup({count:1});await assert.rejects(f.service.runSearch({...f.options,assertCurrent:async()=>{}}),/synchronous/);await assert.rejects(f.service.runSearch({...f.options,onBatch:async()=>{}}),/synchronous/);f.service.dispose();await assert.rejects(f.service.runSearch(f.options),{code:'SEARCH_DISPOSED'});
});

for(const [count,widths]of [[16,[16]],[17,[16,1]],[19,[16,3]],[32,[16,16]],[34,[16,16,1,1]]])test('qualified MMQ1 population '+count+' uses exact N16/tails with compiled-width reuse',async()=>{
 const f=setup({count}),updates=[],r=await f.service.runSearch({...f.options,onBatch:p=>updates.push(p)});assert.deepEqual(f.runs.map(x=>x.candidates.length),widths);assert.deepEqual(f.calls.map(x=>x.candidates.length),[...new Set(widths)]);assert.deepEqual(r.batchWidths,widths);assert.deepEqual(updates.at(-1).batchWidths,widths);assert.ok(Object.isFrozen(r.batchWidths));assert.equal(r.metrics.reduce((n,m)=>n+m.readbackBytes,0),count*16);for(const call of f.calls){assert.equal(call.validationProfile,call.candidates.length===16?'mmq1-n16-repeat-qualification-v1':null);assert.equal(call.compileOrder,call.candidates.length===16?'source':'largest-first');}assert.deepEqual(f.service.capabilities.supportedWidths,[1,3,16]);assert.equal(f.service.capabilities.n16RosterCount,4);assert.equal(f.service.capabilities.n16MaximumSteps,2048);assert.ok(Object.isFrozen(f.service.capabilities.supportedWidths));
});
test('MMQ2, three-body and non2048 requests retain N3/N1 without abort',async()=>{
 for(const mode of ['mmq2','three-body','other-cap']){const f=setup({count:19,profile:mode==='mmq2'?'mmq2-cushion':'mmq1-ball-ball'});if(mode==='other-cap')f.options.raw.maximumSteps=1700;if(mode==='three-body'){const t=threeBallFixture();f.options.request={...f.options.request,scene:t.request.scene,selectedId:t.request.selectedId,rules:{...t.request.rules,search:false}};}const r=await f.service.runSearch(f.options);assert.deepEqual(r.batchWidths,[3,3,3,3,3,3,1]);assert.ok(f.calls.every(c=>c.validationProfile===null));if(mode==='mmq2'){assert.equal(f.service.capabilities.parallelWidth,3);assert.deepEqual(f.service.capabilities.supportedWidths,[1,3]);}}
});
test('unadmitted row uses narrow explicit UNSUPPORTED and subsequent eligible tile still uses N16',async()=>{
 const f=setup({count:19,packet:c=>c.admitted?[c.candidateId,1,0,1]:[c.candidateId,4,4,0x80000000]});f.options.population[0].settings.tipX=.95;f.options.population[0].settings.tipY=.95;const r=await f.service.runSearch(f.options);assert.deepEqual(r.batchWidths,[3,16]);assert.equal(r.rows[0].status,'UNSUPPORTED');assert.deepEqual(r.counts,{pass:18,miss:0,incomplete:0,unsupported:1});assert.ok(f.calls.find(c=>c.candidates.length===16).candidates.every(c=>c.admitted));
});
