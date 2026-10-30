import test from 'node:test';import assert from 'node:assert/strict';
import {selectBoundedPipelinePriming,MAX_SELECTED_PIPELINE_PRIMING} from '../src/wasm-gpu/pipeline-priming-budget.mjs';
import {LIVE_WORLD_PIPELINE_CACHE_LIMITS} from '../src/direct-candidate/experimental-live-world-pipeline-cache.mjs';
const d=(code,extra={})=>({code,layout:'auto',entryPoint:'main',...extra});
const bytes=x=>JSON.stringify([x.code,x.layout,x.preflight??true,x.entryPoint]).length*2;
test('actual cache headroom selects at most16 unique selected-only entries; stable largest prefix',()=>{
 const primary=Array.from({length:112},(_,i)=>d('primary'+i)),selected=Array.from({length:30},(_,i)=>d('selected'+String(i).padStart(2,'0')+'x'.repeat(i)));
 const chosen=selectBoundedPipelinePriming(primary,[primary[0],...selected,selected[29]]);
 assert.equal(MAX_SELECTED_PIPELINE_PRIMING,16);assert.equal(LIVE_WORLD_PIPELINE_CACHE_LIMITS.maximumCompleted,256);assert.equal(chosen.length,16);assert.deepEqual(chosen.map(x=>x.index),Array.from({length:16},(_,i)=>30-i));assert.equal(primary.length+chosen.length,128);
 assert.equal(selectBoundedPipelinePriming([],selected,{maximumCompleted:1000,maximumKeyBytes:1e6}).length,16);
});
test('exact configured count and UTF16 key limits stop prefix at first failure',()=>{
 const primary=[d('p')],largest=d('x'.repeat(100)),small=d('a');
 assert.equal(selectBoundedPipelinePriming(primary,[largest,small],{maximumCompleted:1,maximumKeyBytes:1e6}).length,0);
 assert.equal(selectBoundedPipelinePriming(primary,[largest,small],{maximumCompleted:3,maximumKeyBytes:bytes(primary[0])+bytes(small)}).length,0,'must not skip largest to fit smaller');
 assert.equal(selectBoundedPipelinePriming(primary,[largest,small],{maximumCompleted:3,maximumKeyBytes:bytes(primary[0])+bytes(largest)}).length,1);
 assert.equal(selectBoundedPipelinePriming(primary,[largest,small],{maximumCompleted:2,maximumKeyBytes:1e6}).length,1);
});
test('exact layout order/preflight/entrypoint keys and duplicate primary accounting are preserved',()=>{
 const a=d('same',{layout:{a:1,b:2}}),b=d('same',{layout:{b:2,a:1}});
 const chosen=selectBoundedPipelinePriming([a,a],[a,b,d('same',{entryPoint:'other'}),d('same',{preflight:false}),b],{maximumCompleted:4,maximumKeyBytes:1e6});
 assert.deepEqual(chosen.map(x=>x.index),[1,2,3]);assert.equal(selectBoundedPipelinePriming([a],[a]).length,0);assert.ok(Object.isFrozen(chosen));assert.ok(Object.isFrozen(chosen[0]));
});
test('finite positive cache budgets and source definitions are mandatory',()=>{
 for(const limits of [{maximumCompleted:0,maximumKeyBytes:10},{maximumCompleted:2,maximumKeyBytes:NaN},null])assert.throws(()=>selectBoundedPipelinePriming([],[],limits));assert.throws(()=>selectBoundedPipelinePriming([{}],[]));
});
