// Bounded paired diagnostic. No benchmark-selected production defaults.
import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {evaluatePreparedSourceLawCandidate} from '../src/direct-candidate/source-law-candidate-evaluator.mjs';
import {loadCostFixture,makeCostFixture,observeCostFixture,endpointDelta} from './source-law-cost-fixture.mjs';
const source=await loadCostFixture();
const variants=[['original',{enabled:false}],['ungated',{enabled:true,minAnalyticFrames:0}],['gate16',{enabled:true,minAnalyticFrames:16}]];
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const results=[];
for(const mode of ['near-rail','forward-slip','moving-pair','reversal']){
 const times=Object.fromEntries(variants.map(([name])=>[name,[]])),outputs={},counters={};
 // Fresh identical construction before timer: snapshot restoration changes
  // native gravity representation and is conservatively not admitted today.
  // Alternating/rotating order reduces (not eliminates) warmup/order bias.
  for(let iteration=-3;iteration<7;iteration++)for(let offset=0;offset<variants.length;offset++){
   const [name,options]=variants[(offset+iteration+3)%variants.length],lab=makeCostFixture(source,mode);
   try{const start=performance.now();const result=evaluatePreparedSourceLawCandidate(lab,{frames:96,preparedBoundary:true,advanceTranslation:true,...options});const elapsed=performance.now()-start;
   if(iteration>=0)times[name].push(elapsed);outputs[name]=observeCostFixture(lab);counters[name]=result.counters;
   }finally{lab.dispose();}
  }
  results.push({mode,frames:96,warmupPerVariant:3,samplesPerVariant:7,samplesMs:times,medianMs:Object.fromEntries(Object.entries(times).map(([name,list])=>[name,median(list)])),counters,gateVsUngatedEndpointDelta:endpointDelta(outputs.gate16,outputs.ungated),gateVsOriginalEndpointDelta:endpointDelta(outputs.gate16,outputs.original),gateVsUngatedEventTraceIdentical:JSON.stringify(outputs.gate16.events)===JSON.stringify(outputs.ungated.events)});
}
const receipt={profile:'prepared-source-law-cost-gate-cpu-v1',thresholdFrames:16,thresholdOptimalityClaim:false,defaultThresholdFrames:0,productionEnabled:false,freshConstructionExcludedFromTimer:true,snapshotRestoredAdmission:false,diagnosticRecordsDisabled:true,originalFallbackUnchanged:true,hybridEndpointIdentityClaim:false,results};
console.log(JSON.stringify(receipt,null,2));
if(process.env.SOURCE_COST_RECEIPT)writeFileSync(process.env.SOURCE_COST_RECEIPT,JSON.stringify(receipt,null,2)+'\n');
