import{test}from'node:test';import assert from'node:assert/strict';
import Source from'../src/experimental-coupled-contact-math.js';import Graph from'../src/experimental-arithmetic-graph.js';
import{fixture,largestFixture}from'./resident-candidate-coupled-flat-fixtures.mjs';
import{createCoupledProgramBundle,packCoupledInitialState,unpackCoupledState,executeCoupledForTest}from'../src/resident-candidate/coupled-solver.mjs';
import{executeCoupledFlatForTest,generateCoupledFlatWGSL,COUPLED_FLAT_LAYOUT}from'../src/resident-candidate/coupled-flat.mjs';
import{beginNumericContinuationForTest,advanceNumericContinuationForTest,generateNumericContinuationWGSL}from'../src/resident-candidate/numeric-continuation.mjs';
import{compileGraph,executeLowered,generateNumericLibraryWGSL}from'../src/resident-candidate/numeric-program.mjs';
import{createCueProgramBundle,packCueInitialState}from'../src/resident-candidate/cue-orchestration.mjs';
import{originalRegisteredFixture}from'./resident-candidate-original-fixture.mjs';
import Joint from'../src/experimental-cue-joint-stepper.js';import Cloth from'../src/experimental-cue-cloth-joint-stepper.js';import ClothFixture from'./cue-cloth-joint-fixture.cjs';
const B=createCoupledProgramBundle(),raw=a=>new Uint32Array(a.buffer,a.byteOffset,a.length),compiledByBase=new Map(B.entries.map((e,i)=>[B.program[4+i*6],e]));
function prepare(fx){const plan=Source.buildPlan(fx.spec),packed=Source.pack(fx.input,plan),source=Graph.execute(packed,plan);return{...packCoupledInitialState(fx.spec,packed),expected:Source.unpack(source,plan),source,plan};}
function compare(state,layout,expected,plan){const got=unpackCoupledState(state,layout);for(const key of Object.keys(plan.layout))assert.deepEqual(raw(Float32Array.from(got[key])),raw(Float32Array.from(expected[key])),key+' exact original bits');}
function instructionBound(spec){let n=spec.bodyCount*(B.entries[3].compiled.nodeCount+B.entries[15].compiled.nodeCount);const pair=i=>spec.contacts[i].kind==='dynamic-sphere',sum=fn=>spec.contactOrder.reduce((v,i)=>v+B.entries[fn(i)].compiled.nodeCount,0);n+=sum(i=>pair(i)?0:spec.contacts[i].kind==='cloth'?1:2)+sum(i=>pair(i)?12:13)+sum(()=>14);n+=spec.substeps*(spec.bodyCount*(B.entries[4].compiled.nodeCount+B.entries[9].compiled.nodeCount)+sum(i=>pair(i)?5:6)+spec.pgsIterations*sum(i=>pair(i)?7:8)+spec.stabilizationIterations*sum(i=>pair(i)?10:11));return n+1;}
const options=p=>({testOnly:true,coefficientBase:p.layout.coefficientBase,rosterBase:p.layout.rosterBase});
const corpus=new Map();
test('flat integer driver retains full source roster/order and exact four-body 27-contact 12/4/1 equations',()=>{
 for(const fx of[fixture(1,false),fixture(2,true),fixture(4,true),largestFixture()]){
  const p=prepare(fx);for(const budget of[64,32768]){
   const a=executeCoupledFlatForTest(B,p.state,{...options(p),instructionBudget:budget,dispatches:Math.ceil(instructionBound(fx.spec)/budget),onProgram:r=>{if(!corpus.has(r.programBase))corpus.set(r.programBase,r.input);}});
   assert.equal(a.status,1);compare(a.state,p.layout,p.expected,p.plan);
   const baseline=executeCoupledForTest(B,p.state,options(p));assert.deepEqual(unpackCoupledState(a.state,p.layout),unpackCoupledState(baseline,p.layout));assert.equal(a.state[13],baseline[13]);
  }
 }
 assert.equal(corpus.size,16,'all fixed numerical programs exercised');
 assert.equal(COUPLED_FLAT_LAYOUT.nativeQualified,false);assert.equal(COUPLED_FLAT_LAYOUT.defaultBackend,false);
});
test('all sixteen production microprograms retain liveness bits across one-instruction boundaries',()=>{
 assert.equal(corpus.size,16);
 for(const[base,input]of corpus){const c=compiledByBase.get(base).compiled,expected=executeLowered(c,input,{testOnly:true});for(const budget of[1,7,65536]){const s=beginNumericContinuationForTest(c,input,{testOnly:true});while(s.status===0)advanceNumericContinuationForTest(s,{testOnly:true,instructions:budget});assert.equal(s.status,1);assert.deepEqual(raw(s.output),raw(expected));assert.equal(s.instruction,c.nodeCount);assert.equal(s.words.length,c.scratchWords);}}
});
test('actual full cue joint/cloth and first-created graphs use the same continuation, not stage-sized approximations',async()=>{
 const{seed}=await originalRegisteredFixture(),cue=createCueProgramBundle(),q=seed.cueInitial.cue,initial=new Float32Array(packCueInitialState(seed.cueInitial,cue).buffer);
 const cases=[{compiled:cue.entries[0].compiled,input:Float32Array.from([0,0,0,1,0,0,.03676,0,0,0])},
  {compiled:cue.entries[1].compiled,input:Float32Array.from(['shaft','head'].flatMap(k=>[...q[k].translation,...q[k].rotation,...q[k].localCom]))},
  ...seed.cueInitial.initializationInputs.map((_,i)=>({compiled:cue.entries[2].compiled,input:initial.slice(374+i*40,414+i*40)})),
  {compiled:cue.entries[3].compiled,input:Joint.pack(q)},
  {compiled:cue.entries[4].compiled,input:Cloth.pack(ClothFixture.fixtures(ClothFixture.load(ClothFixture.ROOT+'speed2-full.v8').data,[424])[0].input)}];
 for(const c of cases){const expected=executeLowered(c.compiled,c.input,{testOnly:true}),s=beginNumericContinuationForTest(c.compiled,c.input,{testOnly:true});while(s.status===0)advanceNumericContinuationForTest(s,{testOnly:true,instructions:17});assert.equal(s.status,1);assert.deepEqual(raw(s.output),raw(expected));}
});
test('continuation retains every eager operation, signed zero, subnormal and failure status',()=>{
 const plans=[{inputFloats:2,nodes:[],outputs:[0,1]},...Graph.OPERATIONS.map((op,i)=>({inputFloats:3,nodes:[{kind:op.name,args:i===0?[-0]:Array.from({length:[0,2,2,2,2,2,2,1,1,2,3,2,2,2,1,1][i]},(_,j)=>j)}],outputs:[3]}))];
 const inputs=[Float32Array.of(-0,0,1),new Float32Array(Uint32Array.of(1,0x80000001,0x3f800000).buffer),Float32Array.of(-1,0,2),Float32Array.of(Infinity,1,0)];
 for(const plan of plans)for(const input of inputs){const c=compileGraph(plan),value=input.slice(0,plan.inputFloats),s=beginNumericContinuationForTest(c,value,{testOnly:true});let expected,status=1;try{expected=executeLowered(c,value,{testOnly:true});}catch(e){status=e.numericStatus;}while(s.status===0)advanceNumericContinuationForTest(s,{testOnly:true});assert.equal(s.status,status);if(status===1)assert.deepEqual(raw(s.output),raw(expected));const before=s.words.slice();advanceNumericContinuationForTest(s,{testOnly:true});assert.deepEqual(s.words,before);}
 const c=compileGraph({inputFloats:1,nodes:[{kind:'sqrt',args:[0]}],outputs:[1]});c.program[12]=99;const s=beginNumericContinuationForTest(c,Float32Array.of(4),{testOnly:true});assert.equal(advanceNumericContinuationForTest(s,{testOnly:true}),2);
 assert.throws(()=>beginNumericContinuationForTest(c,Float32Array.of(4)),/TEST-ONLY/);
});
test('flat driver pauses inside a graph, resumes retained state and accepts source runtime order changes next h',()=>{
 const fx=fixture(2,true),p=prepare(fx),short=executeCoupledFlatForTest(B,p.state,{...options(p),instructionBudget:1,dispatches:1});assert.equal(short.status,0);assert.equal(short.state[31],1);assert.equal(short.state[13],0);assert.throws(()=>unpackCoupledState(short.state,p.layout),/not complete/);
 const first=executeCoupledFlatForTest(B,p.state,options(p)),next=first.state.slice();next.set(fx.spec.contactOrder.slice().reverse(),p.layout.orderBase);next[18]=0;next[27]=0;next[p.layout.rosterBase+6]=0;
 const expected=executeCoupledForTest(B,next,options(p)),actual=executeCoupledFlatForTest(B,next,options(p));assert.equal(actual.status,1);assert.deepEqual(unpackCoupledState(actual.state,p.layout),unpackCoupledState(expected,p.layout));
 const bad=p.state.slice();bad[p.layout.orderBase+1]=bad[p.layout.orderBase];assert.equal(executeCoupledFlatForTest(B,bad,options(p)).status,2);
});
test('generated flat shader copies the source instruction body verbatim and contains no complete graph loop',()=>{
 const old=generateNumericLibraryWGSL({preserveSubnormals:true}),start=old.indexOf('    let at=programBase+instructions+i*5u;'),end=old.indexOf('\n  }\n  if (initialized!=registers)',start),body=old.slice(start,end),next=generateNumericContinuationWGSL(),flat=generateCoupledFlatWGSL();
 assert.ok(next.includes(body),'every ordered opcode/domain/sign/subnormal operation is unchanged');assert.doesNotMatch(flat,/fn rc_num_eval\(|for\(var i=0u;i<nodes/);assert.match(flat,/let inputWords=rc_program\[np\+3u\]/);assert.match(flat,/if\(inputWords!=352u\)/);
 assert.equal((flat.match(/rc_num_cont_instruction\(control\)/g)||[]).length,1,'single numeric instruction callsite in flat driver');
});

// Production candidate mapping: one invocation/workgroup, seven independent
// workgroups. Same fixtures, source budgets, instruction budget and dispatch
// counts as the former 32-wide transport; only workgroup mapping changes.
test('actual native flat coupled driver matches same seven full fixtures with resident instruction budgets',
 {skip:process.env.REQUIRE_WEBGPU!=='1'},async t=>{
 const{createNativeOwner,dispatchWordStages}=await import('./resident-candidate-gpu-support.mjs'),owner=await createNativeOwner('resident-coupled-flat');
 try{
  const rows=[{name:'one-cloth',fx:fixture(1,false)},{name:'two-pair-cloth',fx:fixture(2,false)},{name:'invalid-order',fx:fixture(2,true),bad:'order'},{name:'four-chain-rails',fx:fixture(4,true)},{name:'invalid-numeric',fx:fixture(2,true),bad:'numeric'},{name:'four-reverse',fx:fixture(4,true)},{name:'27-contact-bound',fx:largestFixture()}];rows[5].fx.spec.contactOrder.reverse();
  const guard=0xfacefeed,budget=32768;let size=0;for(const row of rows){Object.assign(row,prepare(row.fx));row.base=size+1;size+=row.state.length+2;}
  const state=new Uint32Array(size),scratch=new Uint32Array(rows.length*(B.scratchWords+2)),jobs=[];
  for(const[i,row]of rows.entries()){state[row.base-1]=guard;state[row.base+row.state.length]=guard;state.set(row.state,row.base);if(row.bad==='order')state[row.base+row.layout.orderBase+1]=state[row.base+row.layout.orderBase];if(row.bad==='numeric')state[row.base+64]=0x7f800000;const s=i*(B.scratchWords+2)+1;scratch[s-1]=guard;scratch[s+B.scratchWords]=guard;jobs.push(row.base,row.base+row.layout.coefficientBase,row.base+row.layout.rosterBase,s,budget);}
  const code=`@group(0) @binding(0) var<storage,read> rc_program:array<u32>;
@group(0) @binding(1) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;
@group(0) @binding(3) var<storage,read> rc_jobs:array<u32>;
@group(0) @binding(4) var<storage,read_write> rc_results:array<u32>;
${generateCoupledFlatWGSL({numericProfile:process.env.RESIDENT_NUMERIC_PROFILE})}
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){let row=id.x;if(row>=arrayLength(&rc_jobs)/5u){return;}let at=row*5u;rc_results[row]=rc_coupled_flat_advance(rc_jobs[at],rc_jobs[at+1u],rc_jobs[at+2u],0u,rc_jobs[at+3u],rc_jobs[at+4u]);}`;
  const dispatches=Math.max(...rows.map(row=>Math.ceil(instructionBound(row.fx.spec)/budget))),[,actual,work,,statuses]=await dispatchWordStages(owner,{stages:[{code,repeat:dispatches}],buffers:[{input:B.program},{input:state,readback:true},{input:scratch,readback:true},{input:Uint32Array.from(jobs)},{words:rows.length,readback:true}],bindingTypes:['read-only-storage','storage','storage','read-only-storage','storage'],workgroups:rows.length,label:'flat-source-ordered-coupled'});
  for(const[i,row]of rows.entries()){assert.equal(actual[row.base-1],guard);assert.equal(actual[row.base+row.state.length],guard);const s=i*(B.scratchWords+2)+1;assert.equal(work[s-1],guard);assert.equal(work[s+B.scratchWords],guard);assert.equal(statuses[i],row.bad==='order'?2:row.bad==='numeric'?3:1,row.name+' status');if(!row.bad)compare(actual.slice(row.base,row.base+row.state.length),row.layout,row.expected,row.plan);}
  t.diagnostic(JSON.stringify({gate:'flat-coupled-native',fixtures:rows.length,dispatches,instructionBudget:budget,bitwise:true,hardwarePerformance:false,workgroupSize:1,workgroups:7,adapterInfo:owner.adapterInfo}));
 }finally{owner.release();}
});
