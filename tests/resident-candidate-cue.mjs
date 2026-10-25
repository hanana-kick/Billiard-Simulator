import {test} from 'node:test';
import assert from 'node:assert/strict';
import Compliance from '../src/experimental-cue-joint-compliance.js';
import Tip from '../src/experimental-cue-joint-tip-contact.js';
import {numberWords,wordsNumber} from '../src/resident-candidate/source-number.mjs';
import {compileCueLateralProgram,compileCueTipProgram,executeCueNumberForTest} from '../src/resident-candidate/cue.mjs';
test('cue source dependencies initialize as browser ESM without hidden CommonJS require',async()=>{
  const {spawnSync}=await import('node:child_process');
  // CPU-only native-module loader: no browser/GPU claim. Original .js UMD
  // sources see module/require undefined, as under browser ESM imports.
  const script=`import vm from 'node:vm';import fs from 'node:fs/promises';import path from 'node:path';
    const context=vm.createContext({structuredClone}),cache=new Map();
    async function load(file){if(cache.has(file))return cache.get(file);const m=new vm.SourceTextModule(await fs.readFile(file,'utf8'),{context,identifier:file});cache.set(file,m);await m.link((s,r)=>load(path.resolve(path.dirname(r.identifier),s)));return m;}
    const m=await load(${JSON.stringify(new URL('../src/resident-candidate/cue-orchestration.mjs',import.meta.url).pathname)});await m.evaluate();
    console.log(JSON.stringify(m.namespace.createCueProgramBundle().entries.map(e=>e.plan.nodes.length)));`;
  const run=spawnSync(process.execPath,['--experimental-vm-modules','--input-type=module','-e',script],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout),[16,83,418,72546,80912]);
});
const f=Math.fround,vec=a=>a.map(f),bits=values=>values.flatMap(x=>Array.from(numberWords(x)));
const lateral=()=>({kind:'actual-cue-lateral-prefix',phase:'pre-world-step-pre-tip-contact',dynamicAwake:true,
  headPosition:vec([-.04,.04,.001]),shaftPosition:vec([-.04,.04,.001]),headCom:vec([-.04,.04,.001]),shaftCom:vec([-.7,.14,.002]),
  headLinear:vec([2,-.2,.02]),shaftLinear:vec([1.9,-.21,.01]),headAngular:vec([.2,-.1,.3]),shaftAngular:vec([.3,-.2,.1]),
  headInvMass:[f(1/.012),f(1/.012),f(1/.012)],shaftInvMass:Array(3).fill(f(1/.528)),shaftInvInertia:vec([1,0,0,1000,0,1]),
  axis:[Math.cos(.15),-Math.sin(.15),0],h:1/61440,stiffness:1200,damping:1});
function lateralInput(s){return [...['headPosition','shaftPosition','headCom','shaftCom','headLinear','shaftLinear','headAngular','shaftAngular','headInvMass','shaftInvMass','shaftInvInertia','axis'].flatMap(k=>s[k]),s.h,s.stiffness,s.damping];}
function tipInput(s){return [...['head','ball'].flatMap(k=>['position','worldCom','linear','angular','invMass','invInertia'].flatMap(q=>s[k][q])),...['radius','tipRadius','h','normalStiffness','normalDamping','tangentStiffness','tangentDamping','friction'].map(k=>s[k]),...s.tangent,+s.active,+s.contacted];}
function tip(){return {kind:'actual-cue-single-sphere-tip',phase:'post-lateral-prefix-pre-world-step',head:{position:vec([-.036,.03075,0]),worldCom:vec([-.036,.03075,0]),linear:vec([2,-.1,.3]),angular:vec([0,.01,.02]),invMass:Array(3).fill(f(1/.012)),invInertia:vec([1000,0,0,1000,0,1000])},ball:{position:vec([0,.03075,0]),worldCom:vec([0,.03075,0]),linear:vec([.1,.01,.02]),angular:vec([.03,.04,.05]),invMass:Array(3).fill(f(1/.21)),invInertia:vec([12590,0,0,12590,0,12590])},radius:.03075,tipRadius:.006,h:1/61440,normalStiffness:1e6,normalDamping:110,tangentStiffness:4e5,tangentDamping:10,friction:.7,tangent:[0,0,0],active:false,contacted:false};}
const LP=compileCueLateralProgram(),TP=compileCueTipProgram();
const numbers=(raw,at,n=3)=>Array.from({length:n},(_,i)=>wordsNumber(raw.subarray(at+2*i,at+2*i+2)));
function checkLateral(s){const expected=Compliance.sourceReference(s),raw=executeCueNumberForTest(LP,lateralInput(s),{testOnly:true});
  for(const [at,values]of[[0,expected.head.linear],[6,expected.head.angular],[12,expected.shaft.linear],[18,expected.shaft.angular],[24,expected.impulse],[30,expected.impulseF32],[36,expected.shaft.torque],[42,expected.headPointVelocity],[48,expected.shaftPointVelocity],[54,expected.lateral],[60,expected.relativeLateral]])assert.deepEqual(bits(numbers(raw,at)),bits(values),'lateral field'+at);return raw;}
function checkTip(s){const expected=Tip.sourceReference(s),raw=executeCueNumberForTest(TP,tipInput(s),{testOnly:true});
  assert.deepEqual(Array.from(raw.subarray(0,4)),[+expected.touching,+expected.birth,+expected.removeCue,+expected.sliding]);
  for(const [at,values]of[[4,expected.tangent],[10,[expected.normalForce]],[12,[expected.compression]],[26,expected.head.linear],[32,expected.head.angular],[38,expected.ball.linear],[44,expected.ball.angular],[50,expected.impulseF32],[56,expected.pointF32]])assert.deepEqual(bits(numbers(raw,at,values.length)),bits(values),'tip field'+at);
  if(expected.touching){assert.deepEqual(bits(numbers(raw,14)),bits(expected.impulse));assert.deepEqual(bits(numbers(raw,20)),bits(expected.point));}return raw;}
test('original source-number lateral keeps every binary64 result and every native f32 API boundary',()=>{
  checkLateral(lateral());for(let i=0;i<300;i++){const s=lateral();s.headPosition[2]=f((i-150)*1e-6);s.shaftLinear[1]=f(-i/400);s.headAngular[0]=f(i/100);s.axis=[Math.cos(i*.01),-Math.sin(i*.01),0];checkLateral(s);}
  const s=lateral();for(const k of['headLinear','shaftLinear','headAngular','shaftAngular'])s[k]=[-0,0,-0];s.shaftPosition=s.headPosition.slice();checkLateral(s);
});
test('original source-number tip preserves no-contact/birth/slip/tangent recurrence and threshold predicates',()=>{
  checkTip(tip());for(let i=0;i<300;i++){const s=tip();s.head.position[0]=f(-.03675+(i-150)*1e-5);s.head.worldCom=s.head.position.slice();s.head.linear[2]=f((i-150)/50);s.active=i%2===0;s.contacted=s.active;s.tangent=[i*1e-8,-i*1e-8,i*1e-9];checkTip(s);}
  for(const x of[-.03675,-.036749999,-.036750001,-.1])for(const contacted of[false,true]){const s=tip();s.head.position[0]=f(x);s.head.worldCom=s.head.position.slice();s.contacted=contacted;checkTip(s);}
  const s=tip();s.active=true;s.contacted=true;s.tangent=[2**-80,-(2**-70),2**-60];for(let h=0;h<20;h++){const out=checkTip(s);s.tangent=numbers(out,4);s.head.linear=numbers(out,26);s.head.angular=numbers(out,32);s.ball.linear=numbers(out,38);s.ball.angular=numbers(out,44);}
});
test('source-number cue programs are explicit bounded bytecode, never an implicit CPU continuation',()=>{
  assert.throws(()=>executeCueNumberForTest(LP,lateralInput(lateral())),/TEST-ONLY/);
  assert.ok(LP.instructionCount<2000);assert.ok(TP.instructionCount<4000);
  console.log(JSON.stringify({gate:'source-number-cue-host',lateralInstructions:LP.instructionCount,tipInstructions:TP.instructionCount,lateralRegisterWords:LP.registerWords,tipRegisterWords:TP.registerWords,doubleSingle:false}));
});

test('actual native original source-number cue application preserves bits and isolates invalid lanes',
 {skip:process.env.REQUIRE_WEBGPU!=='1'},async t=>{
  const {createNativeOwner,dispatchWordStages}=await import('./resident-candidate-gpu-support.mjs');
  const {generateRawStrikeProgramWGSL,executeSourceNumberProgramReference}=await import('../src/resident-candidate/raw-strike.mjs');
  const owner=await createNativeOwner('resident-source-number-cue');
  try{
    const slip=tip();slip.head.linear[2]=f(8);slip.active=true;slip.contacted=true;slip.tangent=[.001,.00001,-.001];
    const separated=tip();separated.head.position[0]=f(-.1);separated.head.worldCom=separated.head.position.slice();separated.contacted=true;
    const invalid=tipInput(tip());invalid[7]=Infinity;
    const rows=[{name:'lateral',program:LP,input:lateralInput(lateral())},{name:'tip birth',program:TP,input:tipInput(tip())},
      {name:'invalid lane',program:TP,input:invalid},{name:'tip slip',program:TP,input:tipInput(slip)},{name:'tip separation',program:TP,input:tipInput(separated)},
      {name:'later lateral',program:LP,input:lateralInput(lateral())}];
    const program=new Uint32Array(LP.words.length+TP.words.length);program.set(LP.words);program.set(TP.words,LP.words.length);
    let inputWords=0,stateWords=0;const jobs=[];const GUARD=0xfacefeed;
    for(const row of rows){row.inputBase=inputWords;inputWords+=row.input.length*2;row.base=stateWords+1;row.control=row.base+row.program.registerWords;row.output=row.control+row.program.controlWords;row.end=row.output+96;stateWords=row.end+1;row.expected=executeSourceNumberProgramReference(row.program,row.input).raw;jobs.push(row.program===LP?0:LP.words.length,row.inputBase,row.base,row.control,row.output);}
    const inputs=new Uint32Array(inputWords),state=new Uint32Array(stateWords);
    for(const row of rows){row.input.forEach((x,i)=>inputs.set(numberWords(x),row.inputBase+2*i));state[row.base-1]=GUARD;state[row.end]=GUARD;state.fill(0xdeadbeef,row.output,row.end);}
    const code=`
@group(0) @binding(0) var<storage,read> rc_program:array<u32>;
@group(0) @binding(1) var<storage,read> rc_inputs:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(3) var<storage,read> rc_jobs:array<u32>;
${generateRawStrikeProgramWGSL()}
@compute @workgroup_size(32) fn initialize(@builtin(global_invocation_id) id:vec3<u32>){if(id.x>=arrayLength(&rc_jobs)/5u){return;}let j=id.x*5u;let p=rc_jobs[j];let s=rc_jobs[j+2u];rc_source_program_init(p,s,rc_jobs[j+3u]);for(var i=0u;i<rc_program[p+10u];i++){let a=rc_jobs[j+1u]+i*2u;rc_source_program_input(p,s,i,RcF64(rc_inputs[a],rc_inputs[a+1u]));}}
@compute @workgroup_size(32) fn advance(@builtin(global_invocation_id) id:vec3<u32>){if(id.x>=arrayLength(&rc_jobs)/5u){return;}let j=id.x*5u;rc_source_program_step(rc_jobs[j],rc_jobs[j+2u],rc_jobs[j+3u],64u);}
@compute @workgroup_size(32) fn finish(@builtin(global_invocation_id) id:vec3<u32>){if(id.x>=arrayLength(&rc_jobs)/5u){return;}let j=id.x*5u;rc_source_program_finish(rc_jobs[j],rc_jobs[j+2u],rc_jobs[j+3u],rc_jobs[j+4u]);}
`;
    const[,,actual]=await dispatchWordStages(owner,{stages:[{code,entryPoint:'initialize'},{code,entryPoint:'advance',repeat:313},{code,entryPoint:'finish'}],buffers:[{input:program},{input:inputs},{input:state,readback:true},{input:Uint32Array.from(jobs)}],bindingTypes:['read-only-storage','read-only-storage','storage','read-only-storage'],label:'original-source-number-cue'});
    for(const row of rows){assert.equal(actual[row.base-1],GUARD);assert.equal(actual[row.end],GUARD);assert.equal(actual[row.control+1],1,row.name+' interpreter completion');assert.deepEqual(actual.subarray(row.output,row.end),row.expected,row.name+' raw original source-number bits');}
    assert.equal(actual[rows[2].output+94],3);t.diagnostic(JSON.stringify({gate:'original-source-number-cue-native',rows:rows.length,bitwise:true,doubleSingle:false,adapterInfo:owner.adapterInfo,wholeWorld:false}));
  }finally{owner.release();}
});
