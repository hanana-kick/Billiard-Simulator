import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import '../src/game-rules.js';
import '../src/route-rules.js';
import {RULE_EVENT as E,RULE_WGSL,packRuleConfig,validateRuleConfig,runRulesCPU,gameplayDelta,gameplayFailureProof} from '../src/direct-candidate/deterministic-rules.mjs';
const event=(k,id=0,flags=0,tick=0)=>[k,id,flags,tick];
const O=(id,t=0)=>event(E.OBJECT,id,0,t),C=()=>event(E.CUSHION),R=()=>event(E.REST);
const cases=[];
function check(options,events){const config=packRuleConfig(options),actual=runRulesCPU(config,events);cases.push({config,events,actual});return actual;}
function sourceGame(options,events){const game=options.game===3?new globalThis.ThreeBallGame([0,1],[0,1,2]):new globalThis.FourBallGame([0,1],[2,3],{threeCushion:options.threeCushion});game.begin(0);for(const e of events){let other;if(e[0]===E.OBJECT)other={id:e[1]};if(e[0]===E.CUSHION)other={kind:'cushion'};if(e[0]===E.FLOOR)other={kind:'floor'};if(other)game.contact({a:{id:0},b:other});}return game.finish().delta;}
test('source game fixtures: unordered redmask, frozen goal, late fouls and three-ball legal opponent',()=>{
 for(const options of [{game:4},{game:4,threeCushion:true},{game:3,first:1,second:2}]){
  const a=options.first??2,b=options.second??3;
  for(const stream of [[],[O(a)],[O(b),O(a)],[C(),C(),C(),O(a),O(b)],[O(a),O(b),C(),C(),C()],[C(),C(),C(),O(a),O(b),O(1)],[C(),C(),C(),O(a),O(b),event(E.FLOOR)]]){
   const config=packRuleConfig(options),s=check(options,[...stream,R()]);assert.equal(gameplayDelta(config,s),sourceGame(options,stream));
  }
 }
});
test('search matches pure route evaluator; search order never contaminates gameplay',()=>{
 for(const method of ['carom','direct','any','bank1','bank2','bank3'])for(const ids of [[2,3],[3,2],[2,2,3]])for(let pre=0;pre<5;pre++)for(let post=0;post<4;post++){
  const events=[...Array.from({length:pre},C),O(ids[0]),...Array.from({length:post},C),...ids.slice(1).map(x=>O(x))];
  const contacts=events.map(e=>e[0]===E.CUSHION?{kind:'cushion'}:{kind:'object',id:e[1]});
  const expected=globalThis.LabRouteRules.evaluate(contacts,{method,firstId:2,secondId:3});
  const state=check({search:true,method},[...events,R()]);assert.equal(state[19]===1,expected.success);assert.equal(state[9]!==0,expected.invalid);
 }
 const s=check({search:true},[O(3),O(2),R()]);assert.equal(s[18],1);assert.equal(s[19],2);
});
test('physical completion, unsupported facts, exact early failure, late foul',()=>{
 assert.equal(check({},[O(2),O(3)])[18],0);
 assert.equal(check({},[O(2),O(3),event(E.BUDGET)])[18],3);
 assert.equal(check({},[O(2),O(3),event(E.UNSUPPORTED),R()])[18],4);
 assert.equal(check({search:true,conditionOnly:true},[O(3),event(E.BUDGET)])[19],2);
 assert.equal(check({search:true},[O(3),event(E.BUDGET)])[19],3);
 const unknown=check({search:true,method:'turn'},[O(2),O(3),R()]);assert.equal(unknown[18],1);assert.equal(unknown[19],4);
 assert.equal(check({search:true,allowKiss:false},[O(2),O(3),R()])[19],4);
 assert.equal(check({search:true},[O(2),O(3),O(1),R()])[19],2);
 assert.equal(check({search:true},[O(2),O(3),event(E.AMBIGUOUS),R()])[19],2);
});
test('kiss seen/active episodes mirror pure tracker including simultaneous separation+impact',()=>{
 for(const samples of [[1],[1,1],[1,0,1],[1,2,1],[1,3],[2,1],[3,3]]){
  const tracker=globalThis.LabRouteRules.createKissTracker();let time=0;
  const events=samples.map(flags=>{globalThis.LabRouteRules.observeKiss(tracker,2,{impact:!!(flags&1),separated:!!(flags&2),time:time++});return event(E.KISS_SAMPLE,2,flags,time);});
  const s=check({search:true,allowKiss:false,kissFacts:true},[...events,O(2,20),O(3,21),R()]);assert.equal(s[6],tracker.contacts.length);assert.equal(s[19]===1,tracker.contacts.length===0);
 }
 const base=[event(E.KISS_SAMPLE,2,1,1),O(2,1),O(3,5),event(E.KISS_SAMPLE,2,2,5)];
 assert.equal(check({search:true,allowKiss:false,kissFacts:true},[...base,event(E.KISS_SAMPLE,2,1,5),R()])[19],2);
 assert.equal(check({search:true,allowKiss:false,kissFacts:true},[...base,event(E.KISS_SAMPLE,2,1,6),R()])[19],1);
});
test('route ambiguity scope and resumed budgets remain distinct from final gameplay',()=>{
 const c=packRuleConfig({game:3,first:1,second:2,search:true});
 const prefix=[C(),C(),C(),O(1,1),O(2,2)];
 const lateFloor=runRulesCPU(c,[...prefix,event(E.FLOOR,0,0,3),R()]);assert.equal(lateFloor[18],2);assert.equal(lateFloor[19],1);assert.equal(gameplayDelta(c,lateFloor),0);
 const ambiguity=runRulesCPU(c,[...prefix,event(E.AMBIGUOUS,0,0,2),R()]);assert.equal(ambiguity[18],1);assert.equal(ambiguity[19],2);
 const lateAmbiguity=runRulesCPU(c,[...prefix,event(E.AMBIGUOUS,0,0,3),R()]);assert.equal(lateAmbiguity[19],1);
 const budget=runRulesCPU(c,[...prefix,event(E.BUDGET)]);assert.equal(gameplayDelta(c,budget),null);
 const resumed=runRulesCPU(c,[...prefix,event(E.BUDGET),R()]);assert.equal(resumed[18],1);
 const unsupported=runRulesCPU(c,[...prefix,event(E.UNSUPPORTED),R()]);assert.equal(gameplayDelta(c,unsupported),null);
});
test('strict shared config gate rejects malformed words and nonboolean options',()=>{
 const valid=packRuleConfig();assert.equal(validateRuleConfig(valid),valid);
 assert.throws(()=>validateRuleConfig(Array.from(valid)),TypeError);
 assert.throws(()=>validateRuleConfig(valid.slice(1)),TypeError);
 for(const [index,value] of [[0,0],[0,5],[1,32],[2,32],[3,32],[2,2],[3,2],[3,3],[4,2],[5,2],[6,6],[8,2],[9,2],[10,2],[11,1]]){
  const bad=valid.slice();bad[index]=value;assert.throws(()=>validateRuleConfig(bad),RangeError);assert.throws(()=>runRulesCPU(bad,[]),RangeError);
 }
 for(const name of ['threeCushion','search','allowKiss','kissFacts','conditionOnly'])for(const value of [0,1,null,undefined,NaN,'false']){
  assert.throws(()=>packRuleConfig({[name]:value}),TypeError);
 }
 assert.throws(()=>packRuleConfig({opponent:2}),RangeError);
 assert.throws(()=>packRuleConfig({method:null}),TypeError);
 assert.equal(packRuleConfig({game:3,opponent:2})[3],2);
 assert.equal(packRuleConfig({method:'toString'})[6],0xffffffff);
});
test('gameplay-only irreversible foul proof never fabricates final status or score',()=>{
 for(const options of [{},{game:3,first:1,second:2}]){
  const config=packRuleConfig({...options,conditionOnly:true});
  for(const [events,expected] of [[[],0],[[O(1)],options.game===3?0:1],[[event(E.FLOOR)],1],[[event(E.FLOOR),event(E.UNSUPPORTED)],0],[[event(E.FLOOR),event(E.BUDGET)],0],[[event(E.FLOOR),event(E.BUDGET),R()],1]]){
   const state=check({...options,conditionOnly:true},events),before=state.slice();assert.equal(gameplayFailureProof(config,state),expected);assert.deepEqual(state,before);
   if(!state[13]){assert.notEqual(state[18],2);assert.equal(gameplayDelta(config,state),null);}
  }
 }
 const c=packRuleConfig({search:true,method:'turn'}),s=check({search:true,method:'turn'},[event(E.FLOOR)]);assert.equal(gameplayFailureProof(c,s),1);assert.equal(s[19],4);
});
test('ordinary integer WGSL equals CPU every state word', {skip:process.env.REQUIRE_WEBGPU!=='1',timeout:60000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice();
 try{
  const stride=160,input=new Uint32Array(cases.length*stride);for(let i=0;i<cases.length;i++){const row=cases[i];assert.ok(row.events.length<=36);validateRuleConfig(row.config);input.set(row.config,i*stride);input[i*stride+12]=row.events.length;input.set(row.events.flat(),i*stride+16);}
  device.pushErrorScope('validation');const module=device.createShaderModule({code:RULE_WGSL+`\n@group(0) @binding(0) var<storage,read> src: array<u32>;\n@group(0) @binding(1) var<storage,read_write> dst: array<u32>;\n@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) tid: vec3<u32>){let i=tid.x;if(i>=${cases.length}u){return;}let b=i*160u;var c: RuleConfig;for(var j=0u;j<12u;j++){c.w[j]=src[b+j];}var s=rule_init(c);for(var j=0u;j<src[b+12u];j++){let p=b+16u+j*4u;s=rule_event(s,c,vec4<u32>(src[p],src[p+1u],src[p+2u],src[p+3u]));}s=rule_status(s,c);for(var j=0u;j<20u;j++){dst[i*21u+j]=s.w[j];}dst[i*21u+20u]=rule_gameplay_failure_proof(s,c);}`});
  const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}),bytes=cases.length*21*4;
  const src=device.createBuffer({size:input.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),dst=device.createBuffer({size:bytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),read=device.createBuffer({size:bytes,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(src,0,input);
  const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:src}},{binding:1,resource:{buffer:dst}}]}),enc=device.createCommandEncoder(),pass=enc.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(cases.length/64));pass.end();enc.copyBufferToBuffer(dst,0,read,0,bytes);device.queue.submit([enc.finish()]);await read.mapAsync(GPUMapMode.READ);const got=new Uint32Array(read.getMappedRange().slice(0));read.unmap();assert.equal(await device.popErrorScope(),null);
  for(let i=0;i<cases.length;i++){assert.deepEqual(got.slice(i*21,i*21+20),cases[i].actual,`case ${i}`);assert.equal(got[i*21+20],gameplayFailureProof(cases[i].config,cases[i].actual),`proof ${i}`);}t.diagnostic(JSON.stringify({cases:cases.length,words:got.length,exactWords:true,fullShot:false}));src.destroy();dst.destroy();read.destroy();
 }finally{device.destroy();}
});
