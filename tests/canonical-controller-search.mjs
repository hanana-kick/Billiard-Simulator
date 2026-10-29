import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSearchPopulation,canonicalSearchRuntimeDomain} from '../src/direct-candidate/canonical-controller-search.mjs';
const grid={angles:[0,10],speeds:[.5,1],elevations:[25],tipXs:[0],tipYs:[0,.2]};
test('explicit canonical grid count, stable IDs and settings ownership are exact',()=>{const input=structuredClone(grid),p=canonicalSearchPopulation({parameterGrid:input,maximumCandidates:8});assert.equal(p.domain.total,8);assert.deepEqual(p.population.map(x=>x.candidateId),[1,2,3,4,5,6,7,8]);assert.deepEqual(p.population[0].settings,{angle:0,speed:.5,elevation:25,tipX:0,tipY:0});assert.deepEqual(p.population[7].settings,{angle:10,speed:1,elevation:25,tipX:0,tipY:.2});input.angles[0]=99;assert.equal(p.population[0].settings.angle,0);assert.throws(()=>p.domain.parameterGrid.angles.push(42));});
test('finite candidate domain cannot silently widen, drop axes, duplicate or accept nonfinite values',()=>{for(const parameterGrid of [{...grid,angles:[]},{...grid,angles:[0,0]},{...grid,speeds:[NaN]},{...grid,extra:[1]},{...grid,elevations:undefined}])assert.throws(()=>canonicalSearchPopulation({parameterGrid}));assert.throws(()=>canonicalSearchPopulation({parameterGrid:grid,maximumCandidates:7}));assert.throws(()=>canonicalSearchPopulation({parameterGrid:grid,maximumCandidates:4097}));});

test('controller grid rejects angles that the actual manual setter would clamp',()=>{for(const angle of [270,-181,181,-360])assert.throws(()=>canonicalSearchPopulation({parameterGrid:{...grid,angles:[angle]}}),/no silent clamp/);for(const angle of [-180,180])assert.equal(canonicalSearchPopulation({parameterGrid:{...grid,angles:[angle]}}).population[0].settings.angle,angle);});
test('raw supported axis bounds are explicit and out-of-radius combinations remain in exact count',()=>{for(const [key,value] of [['speeds',.49],['speeds',4.51],['elevations',86],['tipXs',.61],['tipYs',-.61]])assert.throws(()=>canonicalSearchPopulation({parameterGrid:{...grid,[key]:[value]}}),/within/);const result=canonicalSearchPopulation({parameterGrid:{angles:[0,1],speeds:[.5],elevations:[25],tipXs:[0,.6],tipYs:[0,.6]}});assert.equal(result.domain.total,8);assert.equal(result.population.length,8);assert.equal(result.domain.unsupportedTipCombinations,2);assert.equal(result.domain.parallelWidth,3);assert.equal(result.domain.maximumCandidates,4096);});

test('runtime width is an eligible maximum from service/profile/roster/raw authority, not user grid',()=>{const caps={supportedWidths:[1,3,16],n16RosterCount:4,n16MaximumSteps:2048},options={capabilities:caps,selectedWorldProfile:'mmq1-ball-ball',bodyCount:4,maximumSteps:2048};for(const [total,width]of [[1,1],[2,1],[3,3],[9,3],[16,16],[17,16],[19,16]]){const domain=canonicalSearchRuntimeDomain({total},options);assert.equal(domain.parallelWidth,width);assert.equal(domain.parallelWidthKind,'maximum-eligible');assert.deepEqual(domain.supportedWidths,[1,3,16]);assert.ok(Object.isFrozen(domain.supportedWidths));}for(const change of [{selectedWorldProfile:'mmq2-cushion'},{bodyCount:3},{maximumSteps:1700},{capabilities:{supportedWidths:[1,3]}}])assert.equal(canonicalSearchRuntimeDomain({total:19,parallelWidth:999},{...options,...change}).parallelWidth,3);});

import {createCanonicalControllerSearch} from '../src/direct-candidate/canonical-controller-search.mjs';
import {CANONICAL_RESULT_REASON as R} from '../src/direct-candidate/canonical-engine-contract.mjs';
function searchHarness(runSearch){
 const game={kind:'four',cueIds:[1,2],redIds:[3,4],threeCushion:false};let revision=1;
 const c={state:{selectedId:1,gameMode:'four',routeOptions:{fourBallThreeCushion:false}},game:{snapshot:()=>game},notify(){},announce(){}};
 const stateStore={readScene:()=>({sceneId:1,slotToId:[1,2,3,4]}),readRevision:()=>revision,readProvenance:()=>({})};
 const search=createCanonicalControllerSearch({controller:c,stateStore,selectedWorldProfile:'mmq1-ball-ball',service:{selectedWorldProfile:'mmq1-ball-ball',runSearch,cancel(){}},searchOptions:{parameterGrid:grid},makeRequest:()=>({requestId:1}),canStart:()=>true,beforeSearch(){},beforeApply(){}});
 return {c,search,changeSource(){revision++;}};
}
const packetRow=(id,status,reason)=>({candidateId:id,packet:[id,status,reason,status===1?1:status===2?0:0x80000000]});
test('compact reason histograms preserve actual codes across cumulative partial and final batches without reclassification',async()=>{
 const rows=[packetRow(1,1,R.PASS),packetRow(2,2,R.GAMEPLAY_FAILURE),packetRow(3,3,R.UNRESOLVED_EVENT),packetRow(4,3,R.WORK_BUDGET),packetRow(5,3,R.UNRESOLVED_EVENT),packetRow(6,4,R.UNSUPPORTED_PHYSICS)];
 const {c,search}=searchHarness(async({onBatch})=>{
  onBatch({rows:rows.slice(0,3),batchWidths:[3]});assert.deepEqual(c.state.routeProgress.reasonCounts,{incomplete:{11:1},unsupported:{}});assert.equal(c.state.routeResult.partial,true);
  onBatch({rows,batchWidths:[3,3]});assert.deepEqual(c.state.routeProgress.reasonCounts,{incomplete:{3:1,11:2},unsupported:{4:1}});
  return {rows,batchWidths:[3,3],assertCurrent(){}};
 });
 assert.equal(await search.start(),true);assert.deepEqual(c.state.routeResult.reasonCounts,{incomplete:{3:1,11:2},unsupported:{4:1}});assert.deepEqual([c.state.routeResult.evaluated,c.state.routeResult.found,c.state.routeResult.miss,c.state.routeResult.incomplete,c.state.routeResult.unsupported],[2,1,1,3,1]);assert.equal(c.state.routeResult.partial,false);assert.equal(c.state.routeResult.results.length,1);assert.equal(rows.every(row=>row.packet.length===4),true);
});
test('stop preserves partial reasons and stale source cannot publish late histograms',async()=>{
 let finish,options;const {c,search,changeSource}=searchHarness(async opts=>{options=opts;opts.onBatch({rows:[packetRow(1,3,R.TIME_HORIZON)],batchWidths:[1]});return await new Promise(resolve=>finish=resolve);});
 const started=search.start();assert.equal(search.stop(),true);assert.deepEqual(c.state.routeResult.reasonCounts,{incomplete:{9:1},unsupported:{}});assert.equal(c.state.routeResult.partial,true);
 changeSource();assert.throws(()=>options.onBatch({rows:[packetRow(1,3,R.WORK_BUDGET)],batchWidths:[1]}));finish({rows:[],assertCurrent(){}});assert.equal(await started,false);assert.deepEqual(c.state.routeResult.reasonCounts,{incomplete:{9:1},unsupported:{}});
});
