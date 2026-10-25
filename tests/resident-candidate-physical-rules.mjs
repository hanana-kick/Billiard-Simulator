import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {STATUS,UNSET,decodeResults} from '../src/resident-candidate/abi.mjs';
import {RULE_STATUS as S,RULE_REASON as R,RULE_EVENT as E,RULE_FLAG as F,RULE_LAYOUT as L,RULE_WORDS,createRuleState,decodeRuleState,consumeRuleEvent,sampleKiss,finishOuter,filterNativeEvent,seedEventHistory,appendNonkeyEventHistory,ruleTerminalRow,invalidateRules,binary64Words as bits,binary64Value as value,generatePhysicalRulesWGSL,CONTRACT} from '../src/resident-candidate/physical-rules.mjs';
const require=createRequire(import.meta.url);for(const name of ['math','physics','route-rules','optimizer-core','game-rules'])require('../src/'+name+'.js');
const Core=globalThis.ShotSearchCore,Game=globalThis.FourBallGame;
const railLabels=['unknown','오른쪽 쿠션','왼쪽 쿠션','앞쪽 쿠션','뒤쪽 쿠션'];
const ball=(id,time)=>({kind:'contact',time,a:{id:1,kind:'ball'},b:{id,kind:'ball',label:String(id)}});
const rail=(code,time)=>({kind:'contact',time,a:{id:1,kind:'ball'},b:{id:null,kind:'cushion',label:railLabels[code]}});
const floor=time=>({kind:'contact',time,a:{id:1,kind:'ball'},b:{id:null,kind:'floor'}});
function compare({method='none',threeCushion=false,allowKiss=true,maxSteps=20,start=0,frames=[]}={}){
 const req={selectedId:1,options:{gameMode:'four',mode:'carom',targetId:2,secondId:3,opponentId:4,fourBallThreeCushion:threeCushion,allowKiss,horizon:maxSteps,objective:'shortest',...(method==='none'?{}:{methodId:method})}};
 const t=Core.createPhysicalAccumulator({speed:2},undefined,start,{x:0,y:.03075,z:0}),g=new Game([1,4],[2,3],{threeCushion});g.begin(1);
 const s=createRuleState({cueId:1,firstId:2,secondId:3,opponentId:4,method,threeCushion,allowKiss,maxOuterSteps:maxSteps});let stopped=false,outer=0;
 for(const frame of frames){
  assert.equal(stopped,false,'fixture must not advance terminal reference');outer++;
  for(const event of frame.events??[]){Core.observePhysicalEvent(req,t,event);g.contact(event);const e=event.kind==='cue-obstruction'?{kind:E.cueObstruction}:event.b.kind==='cushion'?{kind:E.cushion,rail:railLabels.indexOf(event.b.label)}:event.b.kind==='floor'?{kind:E.floor}:{kind:E.ball,id:event.b.id};const time=(event.time??start+outer)-start;
   const sameGroup=!!s[L.groupOpen]&&Math.abs(time-value(s[L.groupTimeLo],s[L.groupTimeHi]))<1e-9;
   consumeRuleEvent(s,{...e,time:bits(time),sameGroup});
  }
  const now=frame.time??start+outer,positions={1:{x:frame.offTable?1.6:0,y:.03075,z:0},2:{x:.2,y:.03075,z:0},3:{x:.4,y:.03075,z:0},4:{x:.6,y:.03075,z:0}};
  const impact=frame.impact??[false,false,false],separated=frame.separated??[true,true,true];[2,3,4].forEach((id,i)=>{if(!separated[i])positions[id]={x:positions[1].x+.0615,y:.03075,z:0};});
  const cue=frame.cue??false,sleeping=frame.sleeping??false,input={dt:1,time:now,cuePresent:()=>cue,allSleeping:()=>sleeping,sphereIds:()=>[1,2,3,4],positiveImpulse:(_a,id)=>impact[id-2],radius:()=>.03075,position:id=>positions[id]};
  const expectedGame=g.snapshot().pending;
  for(let i=0;i<3;i++)sampleKiss(s,{objectSlot:i,impact:impact[i],separated:separated[i],time:bits(now-start)});
  const firstKiss=value(s[L.firstKissLo],s[L.firstKissHi]),hitTime=value(s[L.hitTimeLo],s[L.hitTimeHi]);
  const got=finishOuter(s,{cuePresent:cue,allSleeping:sleeping,opponentImpulse:impact[2],offTable:!!frame.offTable,finitePosition:true,firstKissBeforeGoal:firstKiss<=hitTime+1e-9});
  stopped=Core.observePhysicalStep(req,t,input)||Core.finishPhysicalHorizon(req,t,input);
  const d=decodeRuleState(s),expectedStatus=stopped?t.verificationIncomplete?S.incomplete:t.success&&!t.invalid?S.pass:S.miss:S.running;
  assert.equal(got,expectedStatus,`status ${method} outer ${outer}`);
  for(const [key,expected]of Object.entries({steps:t.steps,firstHit:t.firstHit,success:t.success,invalid:t.invalid,goalLatched:!!t.goalLatched,fourBallFoul:!!t.fourBallFoul,cueObstructed:!!t.cueObstructed,ambiguous:!!t.ambiguous,rails:t.rails}))assert.equal(d[key],expected,`${key} ${method} outer ${outer}`);
  if(t.hitTime!==undefined){assert.equal(d.hitTime,t.hitTime,'source binary64 goal timestamp');assert.equal(d.hitRails,t.hitRails);}
  assert.equal(d.game.redMask,(expectedGame.reds.includes(2)?1:0)|(expectedGame.reds.includes(3)?2:0));assert.equal(d.game.cushions,expectedGame.cushions);assert.equal(d.game.goalCushions,expectedGame.goalCushions);
  if(t.rule){assert.equal(d.before,t.rule.before);assert.equal(d.after,t.rule.after);}
 }
 return {s,t,stopped,decoded:decodeRuleState(s)};
}
test('terminal ABI is shared and preserves unevaluated pass sentinel',()=>{
 assert.equal(S.running,STATUS.RUNNING);assert.equal(S.pass,STATUS.PASS);const s=createRuleState({cueId:1,firstId:2,secondId:3,opponentId:4,maxOuterSteps:20});assert.equal(s.length,RULE_WORDS);assert.equal(decodeRuleState(s).pass,null);assert.equal(ruleTerminalRow(s,9)[2],UNSET);
 for(const status of ['unsupported','cancelled','failed']){const a=s.slice();invalidateRules(a,status,status==='cancelled'?'cancelled':'contract');assert.equal(ruleTerminalRow(a,9)[2],UNSET);assert.equal(decodeResults(ruleTerminalRow(a,9),[9])[0].pass,null);}
});
test('ordered carom goal waits for complete physical rest; game cushion count freezes',()=>{
 const a=compare({method:'carom',frames:[{events:[ball(2,.1),rail(1,.2),ball(3,.3)]},{events:[rail(2,1.5)],sleeping:true}]});assert.equal(a.decoded.status,'pass');assert.equal(a.decoded.hitRails,1);assert.equal(a.decoded.game.goalCushions,1);assert.equal(a.decoded.game.cushions,2);
});
test('post-goal opponent presentation and impulse fouls remain failures',()=>{
 for(const last of [{events:[ball(4,1.2)]},{impact:[false,false,true]}]){const a=compare({method:'carom',frames:[{events:[ball(2,.1),ball(3,.2)]},last]});assert.equal(a.decoded.status,'miss');assert.equal(a.decoded.fourBallFoul,true);assert.equal(a.decoded.pass,false);}
});
test('post-goal cue obstruction precedence and off-table predicates survive latch',()=>{
 for(const last of [{events:[{kind:'cue-obstruction',time:1.2}]},{offTable:true},{events:[floor(1.2)]}])assert.equal(compare({method:'none',frames:[{events:[ball(2,.1),ball(3,.2)]},last]}).decoded.status,'miss');
});
test('goal reaching horizon without physical rest is incomplete, not a miss',()=>{
 const {s,decoded}=compare({method:'carom',maxSteps:2,frames:[{events:[ball(2,.1),ball(3,.2)]},{}]});assert.equal(decoded.status,'incomplete');assert.equal(decoded.pass,null);assert.equal(ruleTerminalRow(s,5)[2],UNSET);
 assert.equal(compare({maxSteps:1,frames:[{}]}).decoded.status,'miss');
});
test('same-time groups retain ambiguity and duplicate handling through goal suffix',()=>{
 for(const events of [[ball(2,.1),ball(3,.1)],[ball(2,.1),rail(1,.1)],[ball(2,.1),ball(3,.2),ball(2,.3),rail(2,.3)]])assert.equal(compare({method:'carom',frames:[{events}]}).decoded.ambiguous,true);
 assert.equal(compare({method:'carom',frames:[{events:[ball(2,.1),ball(2,.1),ball(3,.2)],sleeping:true}]}).decoded.status,'pass');
});
test('group tolerance compares to first timestamp rather than the preceding timestamp',()=>{
 const a=compare({method:'carom',frames:[{events:[ball(2,.1),ball(2,.1+.7e-9),ball(3,.1+1.4e-9)],sleeping:true}]});assert.equal(a.decoded.status,'pass');
});
test('all source route families preserve prefix, masks, return and cross predicates',()=>{
 const paths={direct:[2,3],carom:[2,3],any:[2,'a','b','c',3],turn:[2,'a','b','c',3],grand:[2,'a','b','c','a',3],return:[2,'a','b','a',3],cross:[2,'c','d','c',3],bank1:['a',2,'b','c',3],bank2:['a','b',2,'c',3],bank3:['a','b','c',2,3],allWalls:['a','b','c','d',2,3]};
 for(const [method,path]of Object.entries(paths)){const events=path.map((p,i)=>typeof p==='number'?ball(p,.01*(i+1)):rail('abcd'.indexOf(p)+1,.01*(i+1)));assert.equal(compare({method,frames:[{events,sleeping:true}]}).decoded.status,'pass',method);}
});
test('three-cushion goal cannot acquire missing cushion credit after second red',()=>{
 for(const method of ['none','carom'])assert.equal(compare({method,threeCushion:true,frames:[{events:[ball(2,.1),rail(1,.2),ball(3,.3),rail(2,.4),rail(3,.5)],sleeping:true}]}).decoded.status,'miss');
});
test('kisses depend on outer impulse separation, not the presentation contact ring',()=>{
 const frames=[{impact:[true,false,false],separated:[false,true,true]},{impact:[false,false,false],separated:[true,true,true]},{impact:[true,false,false],separated:[false,true,true]}];const a=compare({allowKiss:false,frames});assert.equal(a.decoded.status,'miss');assert.equal(a.decoded.kiss,true);
});
test('a kiss sampled after goal timestamp in the same outer step is allowed; post-latch kisses are ignored',()=>{
 const a=compare({method:'carom',allowKiss:false,frames:[{impact:[true,false,false],separated:[false,true,true]},{separated:[true,true,true]},{events:[ball(2,2.1),ball(3,2.2)],impact:[true,false,false],separated:[false,true,true]},{sleeping:true}]});assert.equal(a.decoded.status,'pass');
});
test('source absolute debounce preserves last eight events and strict thresholds',()=>{
 const s=createRuleState({cueId:1,firstId:2,secondId:3,opponentId:4,maxOuterSteps:20});seedEventHistory(s,[{pairId:7,time:bits(0)}]);
 const submit=(pairId,time,extra={})=>{let recentMask=0;for(let i=0;i<8;i++){const at=L.ring+i*4;if(s[at+3]&&time-value(s[at+1],s[at+2])<.12)recentMask|=1<<i;}return filterNativeEvent(s,{pairId,time:bits(time),started:true,movingBall:true,clothEarly:false,clothOrFloorSlow:false,recentMask,...extra});};
 assert.equal(submit(7,.12-Number.EPSILON),false);assert.equal(submit(7,.12),true);assert.equal(submit(7,.12+1e-9),false);assert.equal(submit(8,.13,{clothEarly:true}),false);assert.equal(submit(8,.13,{clothOrFloorSlow:true}),false);assert.equal(submit(8,.13,{started:false}),false);assert.equal(submit(8,.13,{movingBall:false}),false);
 for(let i=0;i<8;i++)assert.equal(submit(100+i,.14+i*.001),true);assert.equal(submit(7,.16),true,'eight unrelated contacts evict old pair exactly');assert.equal(s[L.ringCount],8);
});
test('counter overflow and nonfinite measurements cannot become physical misses',()=>{
 const s=createRuleState({cueId:1,firstId:2,secondId:3,opponentId:4,maxOuterSteps:20});s[L.rails]=0xffffffff;consumeRuleEvent(s,{kind:E.cushion,rail:1,time:bits(.1)});assert.equal(s[L.status],S.unsupported);assert.equal(s[L.reason],R.overflow);assert.equal(ruleTerminalRow(s,0)[2],UNSET);
 const a=createRuleState({cueId:1,firstId:2,secondId:3,opponentId:4,maxOuterSteps:20});finishOuter(a,{cuePresent:false,allSleeping:false,opponentImpulse:false,offTable:false,finitePosition:false,firstKissBeforeGoal:false});assert.equal(a[L.status],S.failed);assert.equal(ruleTerminalRow(a,0)[2],UNSET);
});
test('deterministic generated contact streams match unchanged original physical reducer',()=>{
 let rng=0x345f6789;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/2**32;};const methods=['none','direct','carom','any','turn','grand','return','cross','bank1','bank2','bank3','allWalls'];
 for(let n=0;n<1200;n++){const method=methods[n%methods.length],events=[];let t=.01;for(let i=0,count=Math.floor(random()*12);i<count;i++){if(random()>.16)t+=.01;const k=Math.floor(random()*8);events.push(k<3?ball(k+2,t):k===7?floor(t):rail(k-2,t));}compare({method,threeCushion:n%3===0,allowKiss:n%2===0,frames:[{events,sleeping:true}]});}
});
test('WGSL library is candidate-local integer state with explicit exact-predicate contract',()=>{
 const code=generatePhysicalRulesWGSL();assert.ok(code.includes('fn rc_rules_finish_outer'));assert.ok(code.includes('fn rc_rules_filter_native'));assert.ok(code.includes('fn rc_rules_sample_kiss'));assert.ok(code.includes(`const RCR_S_pass:u32=${STATUS.PASS}u;`));assert.ok(!code.includes('f32'));assert.ok(!code.includes('atomic'));assert.ok(CONTRACT.numericProducer.includes('no f32 approximation'));assert.equal(CONTRACT.physics,false);
});

// Run only in the coordinator's serialized numerical GPU slot. Host checks above
// do not pretend to execute this WGSL. This command stream supplies measurements,
// not native trajectories or expected rule outcomes, to independent GPU lanes.
test('actual WGSL 1024 independent resident rule recurrences equal packed host reducer',{
 skip:process.env.RUN_RESIDENT_RULES_GPU!=='1',timeout:120000
},async t=>{
 const {pathToFileURL}=await import('node:url');assert.ok(process.env.GPU_NATIVE_MODULE,'GPU_NATIVE_MODULE required for explicit GPU gate');
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);
 const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter,'Actual WebGPU adapter required');const device=await adapter.requestDevice();
 const release=require('./native-gpu-test-owner.cjs').retain(gpu,adapter,device,'resident four-ball physical rules');
 const count=1024,stride=8+64*8,input=new Uint32Array(count*stride),expected=new Uint32Array(count*RULE_WORDS);let randomState=0x3154beef;const rand=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState;};
 for(let candidate=0;candidate<count;candidate++){
  const method=Object.keys((await import('../src/resident-candidate/physical-rules.mjs')).RULE_METHOD)[candidate%12],threeCushion=candidate%3===0,allowKiss=candidate%2===0,maxSteps=4;
  const state=createRuleState({cueId:1,firstId:2,secondId:3,opponentId:4,method,threeCushion,allowKiss,maxOuterSteps:maxSteps}),commands=[];
  const push=c=>{assert.ok(c.length===8);commands.push(c);};
  for(let j=0;j<10;j++){const tw=bits(j*.001);push([4,...tw,0,0,0,0,0]);appendNonkeyEventHistory(state,tw);}
  for(let outer=0;outer<4;outer++){
   let time=outer+.01;
   for(let j=0,n=2+rand()%6;j<n;j++){
    if(rand()%6)time+=.01;const kind=rand()%9===0?E.cueObstruction:rand()%7===0?E.floor:rand()%2?E.ball:E.cushion,id=kind===E.ball?2+rand()%3:0,rail=kind===E.cushion?rand()%5:0,tw=bits(time),same=!!state[L.groupOpen]&&Math.abs(time-value(state[L.groupTimeLo],state[L.groupTimeHi]))<1e-9;
    push([1,kind,id,rail,...tw,same?1:0,0]);consumeRuleEvent(state,{kind,id,rail,time:tw,sameGroup:same});
   }
   for(let objectSlot=0;objectSlot<3;objectSlot++){const impact=rand()%3===0,separated=rand()%2===0,tw=bits(outer+1);push([2,objectSlot,impact?1:0,separated?1:0,...tw,0,0]);sampleKiss(state,{objectSlot,impact,separated,time:tw});}
   const cuePresent=outer===0&&candidate%5===0,allSleeping=outer===3,opponentImpulse=candidate%31===0&&outer===2,offTable=candidate%43===0&&outer===2,firstKissBeforeGoal=value(state[L.firstKissLo],state[L.firstKissHi])<=value(state[L.hitTimeLo],state[L.hitTimeHi])+1e-9,flags=1|(cuePresent?2:0)|(allSleeping?4:0)|(opponentImpulse?8:0)|(offTable?16:0)|(firstKissBeforeGoal?32:0);
   push([3,flags,0,0,0,0,0,0]);finishOuter(state,{cuePresent,allSleeping,opponentImpulse,offTable,finitePosition:true,firstKissBeforeGoal});
  }
  const at=candidate*stride;input.set([state[L.method],state[L.options],maxSteps,commands.length,0,0,0,0],at);commands.forEach((c,i)=>input.set(c,at+8+i*8));expected.set(state,candidate*RULE_WORDS);
 }
 const code=`@group(0) @binding(0) var<storage,read> commands:array<u32>;
 @group(0) @binding(1) var<storage,read_write> rc_state:array<u32>;
 ${generatePhysicalRulesWGSL()}
 @compute @workgroup_size(32) fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let candidate=gid.x;if(candidate>=${count}u){return;}let input=candidate*${stride}u;let b=candidate*${RULE_WORDS}u;
 rc_rules_init(b,1u,2u,3u,4u,commands[input],commands[input+1u],commands[input+2u]);
 for(var i=0u;i<commands[input+3u];i++){let at=input+8u+i*8u;let kind=commands[at];
 if(kind==1u){rc_rules_event(b,commands[at+1u],commands[at+2u],commands[at+3u],vec2<u32>(commands[at+4u],commands[at+5u]),commands[at+6u]!=0u);}
 else if(kind==2u){rc_rules_sample_kiss(b,commands[at+1u],commands[at+2u]!=0u,commands[at+3u]!=0u,vec2<u32>(commands[at+4u],commands[at+5u]));}
 else if(kind==3u){rc_rules_finish_outer(b,commands[at+1u]);}
 else if(kind==4u){rc_rules_append_nonkey_history(b,vec2<u32>(commands[at+1u],commands[at+2u]));}
 }
 }`;
 const owned=[];const make=(size,usage)=>{const b=device.createBuffer({size,usage});owned.push(b);return b;};let scopeOpen=false;
 try{
  device.pushErrorScope('validation');scopeOpen=true;const module=device.createShaderModule({code}),info=await module.getCompilationInfo();assert.deepEqual(info.messages.filter(m=>m.type==='error').map(m=>m.message),[]);
  const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}),source=make(input.byteLength,136),state=make(expected.byteLength,132),read=make(expected.byteLength,9);
  device.queue.writeBuffer(source,0,input);const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[source,state].map((buffer,binding)=>({binding,resource:{buffer}}))});
  const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(count/32);pass.end();encoder.copyBufferToBuffer(state,0,read,0,expected.byteLength);device.queue.submit([encoder.finish()]);
  const scope=device.popErrorScope();scopeOpen=false;await read.mapAsync(1);const actual=new Uint32Array(read.getMappedRange().slice(0));read.unmap();assert.equal(await scope,null);
  assert.deepEqual(actual,expected,'every persistent rule word, not only terminal pass');t.diagnostic(JSON.stringify({candidates:count,dispatches:1,readbacks:1,persistentWords:expected.length,fullStateExact:true,physics:false,sourcePredicateProducer:false,hardwarePerformance:false}));
 }finally{if(scopeOpen)await device.popErrorScope();for(const buffer of owned)buffer.destroy();release();}
});

test('all non-key PhysicsLab.emit events evict last-eight native debounce entries',()=>{
 const s=createRuleState({cueId:1,firstId:2,secondId:3,opponentId:4,maxOuterSteps:10}),event={pairId:U32_MAX,time:bits(1),started:true,movingBall:true,clothEarly:false,clothOrFloorSlow:false,recentMask:255};
 assert.equal(filterNativeEvent(s,event),true);for(let i=0;i<7;i++)appendNonkeyEventHistory(s,bits(1.001+i*.001));assert.equal(filterNativeEvent(s,{...event,time:bits(1.01)}),false);
 appendNonkeyEventHistory(s,bits(1.011));assert.equal(s[L.ringCount],8);assert.equal(filterNativeEvent(s,{...event,time:bits(1.012)}),true,'eighth non-key emit evicts old native key');
 const t=createRuleState({cueId:1,firstId:2,secondId:3,opponentId:4,maxOuterSteps:10});seedEventHistory(t,[{pairId:0,time:bits(1)},...Array.from({length:8},(_,i)=>({time:bits(1.001+i*.001)}))]);assert.equal(filterNativeEvent(t,{...event,pairId:0,time:bits(1.012)}),true,'non-key ring rows never match native pair 0');
});
const U32_MAX=0xffffffff;
