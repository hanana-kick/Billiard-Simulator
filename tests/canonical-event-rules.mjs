import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import '../src/game-rules.js';
import '../src/route-rules.js';
import * as M from '../src/direct-candidate/canonical-event-rules.mjs';
const {packCanonicalRuleConfig,runCanonicalRulesCPU,finalizeCanonicalRuleCPU,CER_EVENT:E}=M;
const rails=[null,'x+','x-','z+','z-'];
const object=id=>({kind:E.PAIR,a:0,b:id});
const cushion=rail=>({kind:E.CUSHION,a:0,b:rail});
const rest=(n=4)=>({kind:E.MODEL_REST,a:(1<<n)-1,b:(1<<n)-1,detail:1});
const wire=events=>events.map((e,i)=>[e.kind,e.a??0,e.b??0,e.detail??0,e.tick??i+1,i+1,e.flags??(e.kind>=7&&e.kind<=12?0:1),0]);
export const canonicalRuleFixtures=[];
function run(options,events){
 const config=packCanonicalRuleConfig(options),encoded=wire(events),state=runCanonicalRulesCPU(config,encoded),id=canonicalRuleFixtures.length+1;
 const result=finalizeCanonicalRuleCPU(id,state,config);canonicalRuleFixtures.push({id,config,events:encoded,state,result});return {config,state,result};
}
function sourceContacts(events){return events.flatMap(e=>{
 if(e.kind===E.PAIR){const other=e.a===0?e.b:e.b===0?e.a:null;return other===null?[]:[{kind:'object',id:other}];}
 if(e.kind===E.CUSHION&&e.a===0)return [{kind:'cushion',rail:rails[e.b]}];
 return [];
});}
function sourceGame(options,events){
 const game=options.game===3?new globalThis.ThreeBallGame([0,1],[0,1,2]):new globalThis.FourBallGame([0,1],[2,3],{threeCushion:options.threeCushion??false});game.begin(0);
 for(const e of events){if(e.kind===E.PAIR)game.contact({a:{id:e.a},b:{id:e.b}});if(e.kind===E.CUSHION)game.contact({a:{id:e.a},b:{kind:'cushion'}});if(e.kind===E.OFF_TABLE)game.contact({a:{id:e.a},b:{kind:'floor'}});}
 return game.finish().delta;
}
const patterns=[[],[1],[3],[1,2],[3,4],[1,2,3],[1,2,1],[3,4,3],[4,3,4],[1,1,2],[3,3,4],[1,2,3,4],[1,2,3,1],[1,2,1,2],[3,4,3,4],[1,1,2,3],[1,2,3,4,1],[1,1,1,1],[4,3,2,1]];

test('every UI route method matches actual pure route source on identical committed streams',()=>{
 const methods=[...globalThis.LabRouteRules.catalog.map(x=>x.id),'direct','carom'];
 for(const method of methods)for(const before of patterns)for(const after of patterns){
  const contacts=[...before.map(cushion),object(2),...after.map(cushion),object(3)];
  const expected=globalThis.LabRouteRules.evaluate(sourceContacts(contacts),{method,firstId:2,secondId:3});
  const {state}=run({search:true,method,capabilities:5},[...contacts,rest()]);
  assert.equal(state[19]===1,expected.success,`${method} before=${before} after=${after}`);
  assert.equal(state[9]!==0,expected.invalid,`${method} invalid before=${before} after=${after}`);
 }
 for(const method of methods)for(const contacts of [[],[object(2)],[object(3),object(2)],[object(2),object(2),object(3)],[cushion(3),object(3),cushion(4),object(2)]]){
  const expected=globalThis.LabRouteRules.evaluate(sourceContacts(contacts),{method,firstId:2,secondId:3});
  const {state}=run({search:true,method,capabilities:5},[...contacts,rest()]);assert.equal(state[19]===1,expected.success);assert.equal(state[9]!==0,expected.invalid);
 }
});

test('unordered gameplay and frozen cushion counts match actual game source independently of search',()=>{
 for(const options of [{game:4},{game:4,threeCushion:true},{game:3,first:1,second:2,opponent:1}]){
  const first=options.first??2,second=options.second??3;
  const streams=[[],[object(first)],[object(second),object(first)],[...Array(3).fill(3).map(cushion),object(first),object(second)],[object(first),object(second),...Array(3).fill(3).map(cushion)],[...Array(3).fill(3).map(cushion),object(first),object(second),object(1)],[...Array(3).fill(3).map(cushion),object(first),object(second),{kind:E.OFF_TABLE,a:0}],[object(first),object(second),{kind:E.CLOTH_LANDING,a:0}],[{kind:E.PAIR,a:1,b:2},object(second),object(first)]];
  for(const events of streams){const {state,result}=run({...options,capabilities:5},[...events,rest(options.game)]);const delta=sourceGame(options,events);assert.equal(result[3],delta>>>0);assert.equal(state[18]===1,delta===1);}
 }
 const {state,result}=run({search:true,method:'carom'},[object(3),object(2),rest()]);assert.equal(state[18],1);assert.equal(state[19],2);assert.equal(result[3],1);assert.equal(result[1],2);
 const late=run({search:true,method:'carom'},[object(2),object(3),object(1),rest()]);assert.equal(late.state[3],1);assert.equal(late.result[3],0xffffffff);
 const frozen=run({search:true,method:'direct'},[object(2),object(3),cushion(1),cushion(2),cushion(3),rest()]);assert.equal(frozen.state[2],0);assert.equal(frozen.state[10],0);assert.equal(frozen.state[19],1);
 const frozenThree=run({threeCushion:true},[object(2),object(3),cushion(1),cushion(2),cushion(3),rest()]);assert.equal(frozenThree.state[2],0);assert.equal(frozenThree.result[3],0);
});

test('named rail methods require actual rail facts, never fabricated order',()=>{
 for(const method of ['turn','grand','return','cross','allWalls']){
  const noCapability=run({search:true,method,capabilities:1},[object(2),cushion(1),cushion(2),cushion(3),object(3),rest()]);assert.equal(noCapability.state[19],4);assert.equal(noCapability.state[18],1);
  const unknown=run({search:true,method,capabilities:5},[object(2),cushion(0),cushion(2),cushion(3),object(3),rest()]);assert.equal(unknown.state[19],4);
 }
});

test('full roster model rest and operational terminations never fabricate a miss or score',()=>{
 const prefix=[object(2),object(3)];
 const active=run({},prefix);assert.equal(active.result[3],0x80000000);assert.notEqual(active.result[1],1);assert.notEqual(active.result[1],2);
 const kinds=[[E.BUDGET,2,3],[E.CANCEL,3,3],[E.UNSUPPORTED,4,4],[E.INCOMPLETE,5,3]];
 for(const [kind,operation,status] of kinds){const ended=run({},[...prefix,{kind,detail:kind===E.INCOMPLETE?9:0}]);assert.equal(ended.state[32],operation);assert.equal(ended.result[1],status);assert.equal(ended.result[3],0x80000000);const after=run({},[...prefix,{kind,detail:kind===E.INCOMPLETE?9:0},rest()]);assert.equal(after.result[1],status);assert.equal(after.result[3],0x80000000);}
 for(const malformed of [{...rest(),a:7},{...rest(),b:7},{...rest(),detail:0},{...rest(),flags:0}]){const result=run({},[...prefix,malformed]);assert.notEqual(result.result[1],1);assert.notEqual(result.result[1],2);assert.equal(result.result[3],0x80000000);}
 const unknown=run({capabilities:0},[...prefix,rest()]);assert.equal(unknown.result[1],4);assert.equal(unknown.result[3],0x80000000);
});

test('journal validation rejects uncommitted events, bad slots and nonmonotonic sequence',()=>{
 for(const bad of [{...object(2),flags:0},{kind:E.PAIR,a:0,b:4},{kind:E.PAIR,a:0,b:0},{kind:E.CUSHION,a:0,b:5}]){const {result}=run({},[bad,object(2),object(3),rest()]);assert.equal(result[1],4);assert.equal(result[3],0x80000000);}
 const config=packCanonicalRuleConfig();for(const index of [4,5,7]){const events=wire([object(2),object(3),rest()]);events[1][index]=index===7?1:0;const state=runCanonicalRulesCPU(config,events);const result=finalizeCanonicalRuleCPU(999,state,config);assert.equal(result[1],4);assert.equal(result[3],0x80000000);}
});

test('kiss decisions require seen/active episodes plus complete motion-provider coverage',()=>{
 for(const samples of [[1],[1,1],[1,0,1],[1,2,1],[1,3],[2,1],[3,3]]){
  const tracker=globalThis.LabRouteRules.createKissTracker();
  const events=samples.map((detail,i)=>{globalThis.LabRouteRules.observeKiss(tracker,2,{impact:!!(detail&1),separated:!!(detail&2),time:i+1});return {kind:E.KISS_SAMPLE,a:0,b:2,detail};});
  events.push(object(2),object(3));const tick=events.length+1;
  events.push({kind:E.KISS_COVERAGE,a:14,b:0,tick},{...rest(),tick});
  const {state}=run({search:true,allowKiss:false,capabilities:3},events);
  assert.equal(state[6],tracker.contacts.length);assert.equal(state[19]===1,tracker.contacts.length===0);assert.equal(state[18],1);
 }
 const noFacts=run({search:true,allowKiss:false,capabilities:1},[object(2),object(3),rest()]);assert.equal(noFacts.state[19],4);assert.equal(noFacts.state[18],1);
 const missingCoverage=run({search:true,allowKiss:false,capabilities:3},[object(2),object(3),rest()]);assert.equal(missingCoverage.state[19],4);assert.equal(missingCoverage.state[18],1);
 const coverageGap=run({search:true,allowKiss:false,capabilities:3},[object(2),object(3),{kind:E.KISS_COVERAGE,a:14,b:1,tick:4},{...rest(),tick:4}]);assert.notEqual(coverageGap.state[19],1);
 const segmented=run({search:true,allowKiss:false,capabilities:3},[{kind:E.KISS_COVERAGE,a:14,b:0,tick:1},{...object(2),tick:2},{...object(3),tick:3},{kind:E.KISS_COVERAGE,a:14,b:1,tick:4},{...rest(),tick:4}]);assert.equal(segmented.state[19],1);
 const cloth=run({},[object(2),object(3),{kind:E.CLOTH_LANDING,a:0},rest()]);assert.equal(cloth.state[3],0);assert.equal(cloth.result[3],1);
});

test('explicit route-only ambiguity, obstruction and late kiss are not invented gameplay fouls',()=>{
 const ambiguous=run({search:true},[object(2),{kind:E.ROUTE_AMBIGUOUS},object(3),rest()]);assert.equal(ambiguous.state[18],1);assert.equal(ambiguous.state[19],2);
 const obstructed=run({search:true},[object(2),object(3),{kind:E.CUE_OBSTRUCTION},rest()]);assert.equal(obstructed.state[18],1);assert.equal(obstructed.state[19],2);
 const reversed=run({},[{kind:E.PAIR,a:2,b:0},{kind:E.PAIR,a:3,b:0},{kind:E.OFF_TABLE,a:2},rest()]);assert.equal(reversed.result[3],1);
 const lateKiss=run({search:true,allowKiss:false,capabilities:3},[{kind:E.KISS_SAMPLE,a:0,b:2,detail:1},object(2),object(3),{kind:E.KISS_SAMPLE,a:0,b:2,detail:2},{kind:E.KISS_SAMPLE,a:0,b:2,detail:1},{kind:E.KISS_COVERAGE,a:14,b:0,tick:6},{...rest(),tick:6}]);assert.equal(lateKiss.state[6],1);assert.equal(lateKiss.state[19],1);
 for(const detail of [9,10,11]){const result=run({},[{kind:E.INCOMPLETE,detail}]).result;assert.equal(result[1],3);assert.equal(result[2],detail);assert.equal(result[3],0x80000000);}
 const unsupported=run({},[{kind:E.UNSUPPORTED,detail:12}]).result;assert.equal(unsupported[1],4);assert.equal(unsupported[2],12);
});

test('canonical config and event host gate reject coercion and malformed raw words',()=>{
 const c=packCanonicalRuleConfig();assert.equal(M.validateCanonicalRuleConfig(c),c);
 for(const options of [{cue:4294967296},{n:4294967300},{cue:4},{n:3},{capabilities:8},{allowKiss:0},{kissFacts:undefined}])assert.throws(()=>packCanonicalRuleConfig(options));
 for(const [index,value] of [[0,0],[1,0],[2,4],[3,2],[4,2],[5,2],[6,11],[8,2],[9,1],[10,2],[11,1],[12,4],[13,3],[14,8],[15,0]]){const bad=c.slice();bad[index]=value;assert.throws(()=>M.validateCanonicalRuleConfig(bad));assert.throws(()=>runCanonicalRulesCPU(bad,[]));}
 for(const malformed of [[1,0,2,0,1,1,1],[1,0,2,0,1,1,1,-1],[1,0,2,0,NaN,1,1,0],[1,0,2,0,4294967296,1,1,0]])assert.throws(()=>runCanonicalRulesCPU(c,[malformed]));
});

test('native ordinary WGSL matches every canonical state and four-word finalizer word',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:120000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice();
 try{
  const eventLimit=32,stride=20+eventLimit*8,rows=canonicalRuleFixtures,input=new Uint32Array(rows.length*stride);
  for(let i=0;i<rows.length;i++){const row=rows[i];M.validateCanonicalRuleConfig(row.config);assert.ok(row.events.length<=eventLimit);input.set(row.config,i*stride);input[i*stride+16]=row.events.length;input[i*stride+17]=row.id;input.set(row.events.flat(),i*stride+20);}
  const code=M.CANONICAL_RULE_WGSL+`\n@group(0) @binding(0) var<storage,read> src:array<u32>;\n@group(0) @binding(1) var<storage,read_write> dst:array<u32>;\n@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) tid:vec3<u32>){let i=tid.x;if(i>=${rows.length}u){return;}let b=i*${stride}u;var c:CERConfig;for(var j=0u;j<16u;j++){c.w[j]=src[b+j];}var s=cer_init(c);for(var j=0u;j<src[b+16u];j++){var e:array<u32,8>;for(var k=0u;k<8u;k++){e[k]=src[b+20u+j*8u+k];}s=cer_event(s,c,e);}let f=cer_finalize(src[b+17u],s,c);for(var j=0u;j<48u;j++){dst[i*52u+j]=s.w[j];}dst[i*52u+48u]=f.x;dst[i*52u+49u]=f.y;dst[i*52u+50u]=f.z;dst[i*52u+51u]=f.w;}`;
  device.pushErrorScope('validation');const module=device.createShaderModule({code}),pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}),bytes=rows.length*52*4;
  const src=device.createBuffer({size:input.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),dst=device.createBuffer({size:bytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),read=device.createBuffer({size:bytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  device.queue.writeBuffer(src,0,input);const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:src}},{binding:1,resource:{buffer:dst}}]}),encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(rows.length/32));pass.end();encoder.copyBufferToBuffer(dst,0,read,0,bytes);device.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ);const got=new Uint32Array(read.getMappedRange().slice(0));read.unmap();assert.equal(await device.popErrorScope(),null);
  for(let i=0;i<rows.length;i++){assert.deepEqual(got.slice(i*52,i*52+48),rows[i].state,`canonical state row ${i}`);assert.deepEqual(got.slice(i*52+48,i*52+52),rows[i].result,`canonical finalizer row ${i}`);}
  t.diagnostic(JSON.stringify({profile:'canonical-event-rule-contract-v1',cases:rows.length,words:got.length,exactWords:true,fullShot:false}));src.destroy();dst.destroy();read.destroy();
 }finally{device.destroy();}
});
