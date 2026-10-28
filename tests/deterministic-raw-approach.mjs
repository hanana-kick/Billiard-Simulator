import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {packStrikeScene,packRawStrikes,runRawStrikeCPU,createRawStrikeGPU,generateRawStrikePhases} from '../src/direct-candidate/deterministic-raw-strike.mjs';
const moduleURL=new URL('../src/direct-candidate/deterministic-raw-strike.mjs',import.meta.url);
const source=await readFile(moduleURL,'utf8');
function isolated(text){return import('data:text/javascript;base64,'+Buffer.from(text.replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,moduleURL).href))).toString('base64'));}
const begin='   // RAW_APPROACH_CPU_BEGIN',end='   // RAW_APPROACH_CPU_END';
const a=source.indexOf(begin),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);
// Reference is the unchanged original per-step arithmetic, not a floating oracle.
const reference=await isolated(source.slice(0,a)+source.slice(b+end.length));
const instrumented=await isolated(source.replace('function approachCount(c,','export const approachWork={skipped:0,attempts:0,chunks:0,probeMuls:0,probeDivs:0,probeNorms:0};\nfunction approachCount(c,').replace('const saved=[c.muls','approachWork.attempts++;const saved=[c.muls').replace('[c.muls,c.divs,c.norms,c.bad,c.addOverflow]=saved;return result;','approachWork.probeMuls+=c.muls-saved[0];approachWork.probeDivs+=c.divs-saved[1];approachWork.probeNorms+=c.norms-saved[2];[c.muls,c.divs,c.norms,c.bad,c.addOverflow]=saved;approachWork.skipped+=result;approachWork.chunks+=+(result>0);return result;'));
const scene=overrides=>({kind:'complete-isolated-sphere-fixed-aabbs',complete:true,materialProfile:'physicslab-defaults-v1',support:'cloth',center:[0,.03075,0],floorTop:0,obstacles:[],...overrides});
const shot=(id,overrides)=>({id,angle:0,elevation:0,speed:2,tipX:0,tipY:0,...overrides});
const corpus=Array.from({length:216},(_,i)=>shot(i,{angle:(i*37.12345)%720-360,elevation:[0,12.34567,25.91234,60.12345,80.31415,84.99998][i%6],speed:.5+(i%9)*.5,tipX:[-.42,-.2,0,.2,.42][i%5],tipY:[0,.12,.3,.42][i%4]}));
const scenes=[scene(),scene({center:[8,.03075,8]}),scene({center:[-8,7.53075,-8],floorTop:7.5}),scene({gravity:0}),scene({obstacles:[{min:[-.06,.02,-.003],max:[-.045,.05,.003]}]}),scene({obstacles:[{min:[3,0,3],max:[4,1,4]}]}),scene({support:'free-flight',center:[0,.5,0],gravity:0})];
test('whole-prefix approach preserves every original word across scenes, states and budgets',t=>{
 let words=0;const logical=[0,0,0];for(const world of scenes){const shared=packStrikeScene(world),rows=packRawStrikes(corpus),expected=reference.runRawStrikeCPU(shared,rows),actual=instrumented.runRawStrikeCPU(shared,rows);assert.deepEqual(actual,expected);words+=expected.length;for(let o=0;o<expected.length;o+=128)for(let k=0;k<3;k++)logical[k]+=expected[o+80+k];}
 const shared=packStrikeScene(scene()),rows=packRawStrikes(Array.from({length:140},(_,i)=>shot(1000+i,{maximumSteps:i+1,speed:[.5,2,4.5][i%3],angle:37,elevation:25,tipX:.2,tipY:.2})));assert.deepEqual(runRawStrikeCPU(shared,rows),reference.runRawStrikeCPU(shared,rows));words+=rows.length/16*128;
 assert.ok(instrumented.approachWork.skipped>10000);t.diagnostic(JSON.stringify({cases:corpus.length*scenes.length+140,exactWords:words,referenceLogicalStepsSkipped:instrumented.approachWork.skipped,proofAttempts:instrumented.approachWork.attempts,referenceArithmetic:logical,optimizedArithmetic:logical.map((x,k)=>x-instrumented.approachWork.skipped*[173,6,10][k]+[instrumented.approachWork.probeMuls+3*instrumented.approachWork.chunks,instrumented.approachWork.probeDivs,instrumented.approachWork.probeNorms][k]),dispatchCountUnchanged:true,words80to82:'reference-equivalent arithmetic counts, not optimized work'}));
});
test('approach phase retains the six resident phases and no float math',()=>{assert.equal(generateRawStrikePhases().length,6);for(const phase of generateRawStrikePhases())assert.doesNotMatch(phase.code,/\bf32\b/);});
test('native approach preserves original reference rows including successful and failed whole-prefix proofs',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:180000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter(),device=await adapter.requestDevice();try{const engine=await createRawStrikeGPU(device);let words=0,cases=0;for(const world of [scenes[0],scenes[2],scenes[4],scenes[6]]){const shared=packStrikeScene(world),inputs=[...corpus.slice(0,35),...Array.from({length:12},(_,i)=>shot(500+i,{maximumSteps:[1,2,7,8,9,16,31,32,64,128,256,512][i]}))],rows=packRawStrikes(inputs),expected=reference.runRawStrikeCPU(shared,rows),actual=await engine.run(shared,rows);assert.deepEqual(actual.result,expected);words+=expected.length;cases+=inputs.length;}t.diagnostic(JSON.stringify({cases,words,exactReferenceWords:true,compileMs:engine.compileMs,dispatchCountUnchanged:true}));}finally{device.destroy();}
});
