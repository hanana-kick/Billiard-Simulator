// Bounded diagnostic, not a CI timing assertion or a whole-shot benchmark.
import {performance} from 'node:perf_hooks';
import {pairTOI} from '../src/direct-candidate/event-core.mjs';
import {pairTOIWithCulling} from '../src/direct-candidate/conservative-pair-cull.mjs';
let seed=1234567;
const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
const ball=()=>({p:[rand()*4,rand()*4],v:[rand()*4-2,rand()*4-2],r:.1});
const segment=()=>({a:[rand()*4-2,rand()*4-2]});
const corpus=Array.from({length:300},()=>[ball(),ball(),segment(),segment(),.01+rand()*2]);
const counts={};for(const args of corpus)pairTOIWithCulling(...args,counts,pairTOI);
const culled=(...args)=>pairTOIWithCulling(...args,{},pairTOI);
let checksum=0;
function run(fn){for(const args of corpus){const hit=fn(...args);if(hit)checksum+=hit.t;}}
for(let i=0;i<20;i++){run(pairTOI);run(culled);}
const samples=[];
for(let i=0;i<7;i++){
 const sample={};for(const [name,fn] of i%2?[['culledMs',culled],['baselineMs',pairTOI]]:[['baselineMs',pairTOI],['culledMs',culled]]){
  const start=performance.now();for(let j=0;j<20;j++)run(fn);sample[name]=performance.now()-start;
 }samples.push(sample);
}
const median=key=>samples.map(s=>s[key]).sort((a,b)=>a-b)[3];
console.log(JSON.stringify({profile:'bounded-quadratic-pair-cpu-only',pairsPerSample:6000,warmupQueriesPerVariant:6000,counts,samples,medianBaselineMs:median('baselineMs'),medianCulledMs:median('culledMs'),ratio:median('culledMs')/median('baselineMs'),checksum,defaultActivation:false},null,2));
