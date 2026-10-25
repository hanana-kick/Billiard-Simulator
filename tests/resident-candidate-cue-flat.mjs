import{test}from'node:test';import assert from'node:assert/strict';
import{generateCueFlatWGSL,executeCueFlatForTest,cueFlatDispatchCapacity,CUE_FLAT_LAYOUT}from'../src/resident-candidate/cue-flat.mjs';
import{createCueProgramBundle,packCueInitialState,executeCueForTest,generateCueOrchestrationWGSL}from'../src/resident-candidate/cue-orchestration.mjs';
import{NUMERIC_PROFILE as P}from'../src/resident-candidate/numeric-profile.mjs';
import{COUPLED_BODY_OFFSETS as O}from'../src/resident-candidate/coupled-solver.mjs';
import{CUE_LAYOUT as L}from'../src/resident-candidate/cue.mjs';
import{originalRegisteredFixture}from'./resident-candidate-original-fixture.mjs';
import Cloth from'../src/experimental-cue-cloth-joint-stepper.js';import ClothFixture from'./cue-cloth-joint-fixture.cjs';
import{linkResidentWGSL}from'../src/resident-candidate/wgsl-linker.mjs';
const B=createCueProgramBundle(),GUARD=0xfacefeed,ranges=[[0,14],[15,28],[43,13],[64,184],[248,6],[374,120],[494,90],[584,10],[594,12],[606,3],[1232,26]];
const bodyWords=s=>{const w=new Uint32Array(64),f=new Float32Array(w.buffer);for(const[k,i]of Object.entries(O))if(s[k]!==undefined)f.set(Array.isArray(s[k])?s[k]:[+s[k]],i);return w;};
async function fixture(){const{seed}=await originalRegisteredFixture();return{seed,cue:packCueInitialState(seed.cueInitial,B,{sceneSlots:[6,5,7,0]}),bodies:seed.balls.map(({state})=>bodyWords(state))};}
function allocation(fx,{cloth=false,retire=false,invalid=false,obstructed=false}={}){
 const cue=fx.cue.slice(),bodies=fx.bodies.map(x=>x.slice());if(retire)cue[6]=1;if(invalid)bodies[fx.seed.selectedIndex][0]=0x7f800000;
 if(obstructed)bodies.find((_,i)=>i!==fx.seed.selectedIndex).set(cue.subarray(L.joint+54,L.joint+57),6);
 if(cloth){const prepared=ClothFixture.fixtures(ClothFixture.load(ClothFixture.ROOT+'speed2-full.v8').data,[424])[0].input;new Float32Array(cue.buffer).set(Cloth.pack(prepared),64);cue[7]=424;cue[12]=1;cue[13]=1;cue[15]=1;cue[47]=7;}
 const cueBase=1,bodyBase=cueBase+B.stateWords,othersBase=bodyBase+256,controlBase=othersBase+3,state=new Uint32Array(controlBase+9);state[0]=state[state.length-1]=GUARD;state.set(cue,cueBase);bodies.forEach((w,i)=>state.set(w,bodyBase+i*64));state.set(bodies.map((_,i)=>i).filter(i=>i!==fx.seed.selectedIndex).map(i=>bodyBase+i*64),othersBase);
 return{state,cue,bodies,cueBase,bodyBase,ballBase:bodyBase+fx.seed.selectedIndex*64,othersBase,controlBase,mode:cloth?1:0};
}
function compare(result,row,expected){for(const[at,n]of ranges)assert.deepEqual(result.state.slice(row.cueBase+at,row.cueBase+at+n),expected.state.slice(at,at+n),'cue semantic '+at);assert.deepEqual(result.state.slice(row.ballBase,row.ballBase+64),expected.ball,'selected body');assert.equal(result.state[0],GUARD);assert.equal(result.state[result.state.length-1],GUARD);}
function run(row,opts={}){return executeCueFlatForTest(B,row.state,{testOnly:true,...row,...opts});}
// Test-only concatenation relocates every stored absolute other-body pointer,
// not just the job's pointer to that list. Candidate bodies remain disjoint.
function writeRelocated(state,row){state.set(row.state,row.base);for(let i=0;i<3;i++)state[row.base+row.othersBase+i]+=row.base;}

test('flat cue preserves genuine first/recurrent application, initialization and deferred source joint across instruction budgets',async()=>{
 const fx=await fixture();for(const budget of[17,32768]){let row=allocation(fx),state=row.cue,ball=row.bodies[fx.seed.selectedIndex],others=row.bodies.filter((_,i)=>i!==fx.seed.selectedIndex);
  for(let h=0;h<3;h++){
   const expected=executeCueForTest(B,state,{ball,others,testOnly:true}),app=run(row,{mode:0,instructionBudget:budget,dispatches:cueFlatDispatchCapacity(B,{instructionBudget:budget,includeSolve:false}).dispatches});assert.equal(app.status,1);compare(app,row,expected);assert.equal(app.state[row.cueBase+47],7);
   const solved=executeCueForTest(B,expected.state,{ball:expected.ball,others,mode:1,testOnly:true}),actual=executeCueFlatForTest(B,app.state,{testOnly:true,...row,mode:1,instructionBudget:budget,dispatches:Math.ceil(80912/budget),retained:app});assert.equal(actual.status,1);compare(actual,row,solved);state=solved.state;ball=solved.ball;row={...row,state:actual.state};
  }
 }
});
test('flat cue retains source-number and f32 instruction PC across dispatches, retirement and invalid lanes',async()=>{
 const fx=await fixture(),row=allocation(fx);let r=run(row,{instructionBudget:1,dispatches:1});assert.equal(r.status,0);assert.equal(r.state[row.controlBase+3],1);assert.equal(r.state[row.cueBase+7],0);let sawSource=false,sawF32=false;
 while(r.status===0){r=executeCueFlatForTest(B,row.state,{testOnly:true,...row,begin:false,instructionBudget:1,dispatches:1,retained:r});sawF32 ||=r.state[row.cueBase+48]===1;sawSource ||=r.state[row.cueBase+48]===2&&r.state[row.cueBase+1472+B.sourceRegisterWords]>0;}
 assert.equal(r.status,1);assert.ok(sawSource&&sawF32);compare(r,row,executeCueForTest(B,row.cue,{ball:row.bodies[fx.seed.selectedIndex],others:row.bodies.filter((_,i)=>i!==fx.seed.selectedIndex),testOnly:true}));
 for(const opt of[{retire:true},{invalid:true},{obstructed:true}]){const a=allocation(fx,opt),actual=run(a);assert.equal(actual.status,opt.invalid?3:opt.obstructed?4:1);if(opt.retire){assert.equal(actual.state[a.cueBase+11],3);assert.deepEqual(actual.state.slice(a.cueBase+606,a.cueBase+609),Uint32Array.of(0,1,2));assert.equal(actual.state[a.cueBase+12],0);}}
 assert.throws(()=>executeCueFlatForTest(B,row.state,{...row}),/TEST-ONLY/);
});
test('flat cue native fixture relocation preserves candidate-local obstruction pointers',async()=>{
 const fx=await fixture(),first=allocation(fx),blocked=allocation(fx,{obstructed:true});first.base=0;blocked.base=first.state.length;const state=new Uint32Array(first.state.length+blocked.state.length);writeRelocated(state,first);writeRelocated(state,blocked);
 for(const row of[first,blocked])for(let i=0;i<3;i++){const pointer=state[row.base+row.othersBase+i];assert.ok(pointer>=row.base+row.bodyBase&&pointer<row.base+row.bodyBase+256);assert.equal(pointer,row.state[row.othersBase+i]+row.base);assert.deepEqual(state.slice(pointer,pointer+64),row.state.slice(row.state[row.othersBase+i],row.state[row.othersBase+i]+64));}
 const p=state[blocked.base+blocked.othersBase];assert.deepEqual(state.slice(p+6,p+9),blocked.cue.slice(L.joint+54,L.joint+57));assert.notDeepEqual(state.slice(first.state[first.othersBase]+6,first.state[first.othersBase]+9),blocked.cue.slice(L.joint+54,L.joint+57));
});
test('flat cue keeps full actual original 80912-node cloth joint/cache output, not an isolated replacement',async()=>{
 const fx=await fixture(),row=allocation(fx,{cloth:true}),expected=executeCueForTest(B,row.cue,{ball:row.bodies[fx.seed.selectedIndex],others:row.bodies.filter((_,i)=>i!==fx.seed.selectedIndex),mode:1,testOnly:true}),actual=run(row,{mode:1});assert.equal(actual.status,1);compare(actual,row,expected);
 const cap=cueFlatDispatchCapacity(B);assert.deepEqual(cap,{applicationInstructions:41644,solveInstructions:80912,dispatches:5,instructionBudget:32768});assert.equal(CUE_FLAT_LAYOUT.nativeQualified,false);
});
test('flat cue generated source retains stage bodies and both VMs have only one-instruction entry points',()=>{
 for(const profile of[P.DEVICE_F32,P.PRESERVED_F32,P.INTEGER_F32]){const code=generateCueFlatWGSL({numericProfile:profile});assert.doesNotMatch(code,/fn rc_num_eval\(|fn rc_raw_program_step\(|fn rc_source_program_step\(/);assert.match(code,/rc_source_program_instruction\(rc_state\[b\+58u\],regs,sourceControl\)/);
  for(const stage of['prepare','scatter']){const source=generateCueOrchestrationWGSL(stage),start=source.indexOf('fn rc_cue_'+stage+'('),end=source.indexOf('\n}\n',start)+2;assert.ok(code.includes(source.slice(start,end)),stage+' source unchanged');}
  const linked=linkResidentWGSL([code,'@compute @workgroup_size(1) fn main(){rc_cue_flat_advance(0u,0u,0u,3u,0u,0u,0u,32768u);}']);assert.match(linked.code,/fn rc_cue_flat_advance/);
 }
});

// Production candidate mapping: one invocation/workgroup, seven independent
// workgroups. Same fixtures, source budgets, instruction budget and dispatch
// counts as the former 32-wide transport; only workgroup mapping changes.
test('actual native flat cue keeps same seven source orchestration lanes with resident instruction budgets',
 {skip:process.env.REQUIRE_WEBGPU!=='1'},async t=>{
 const{createNativeOwner,dispatchWordStages}=await import('./resident-candidate-gpu-support.mjs'),fx=await fixture(),cases=[{name:'genuine application and joint',solve:1},{name:'retirement receipt',solve:1,retire:true},{name:'invalid ball lane',solve:1,invalid:true},{name:'genuine later lane',solve:1},{name:'other sphere exclusion',solve:1,obstructed:true},{name:'application initialization receipt',solve:0},{name:'prepared original cloth',solve:1,cloth:true}];
 let total=0;for(const row of cases){Object.assign(row,allocation(fx,row));row.base=total;total+=row.state.length;if(!row.invalid&&!row.obstructed){const others=row.bodies.filter((_,i)=>i!==fx.seed.selectedIndex);row.expected=executeCueForTest(B,row.cue,{ball:row.bodies[fx.seed.selectedIndex],others,mode:row.mode,testOnly:true});if(row.solve&&row.expected.state[12])row.expected=executeCueForTest(B,row.expected.state,{ball:row.expected.ball,others,mode:1,testOnly:true});}}
 const state=new Uint32Array(total),scratch=new Uint32Array(cases.length*(B.scratchWords+2)),jobs=[];for(const[i,row]of cases.entries()){writeRelocated(state,row);const sb=i*(B.scratchWords+2)+1;scratch[sb-1]=GUARD;scratch[sb+B.scratchWords]=GUARD;jobs.push(row.base+row.cueBase,row.base+row.ballBase,row.base+row.othersBase,sb,row.base+row.controlBase,row.solve,32768);}
 const code=`@group(0) @binding(0) var<storage,read> rc_program:array<u32>;
@group(0) @binding(1) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;
@group(0) @binding(3) var<storage,read> rc_jobs:array<u32>;
@group(0) @binding(4) var<storage,read_write> rc_results:array<u32>;
${generateCueFlatWGSL({numericProfile:process.env.RESIDENT_NUMERIC_PROFILE})}
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){let row=id.x;if(row>=arrayLength(&rc_jobs)/7u){return;}let j=row*7u;let b=rc_jobs[j];let control=rc_jobs[j+4u];if(rc_state[b+2u]==1u){if(rc_state[b+7u]==0u){rc_cue_flat_begin(b,0u,0u,control);}else if(rc_jobs[j+5u]!=0u&&rc_state[b+12u]!=0u){rc_cue_flat_begin(b,0u,1u,control);}}rc_results[row]=rc_cue_flat_advance(b,rc_jobs[j+1u],rc_jobs[j+2u],3u,0u,rc_jobs[j+3u],control,rc_jobs[j+6u]);}`;
 const owner=await createNativeOwner('resident-cue-flat');try{const cap=cueFlatDispatchCapacity(B),[,actual,work,,statuses]=await dispatchWordStages(owner,{stages:[{code,repeat:cap.dispatches}],buffers:[{input:B.program},{input:state,readback:true},{input:scratch,readback:true},{input:Uint32Array.from(jobs)},{words:cases.length,readback:true}],bindingTypes:['read-only-storage','storage','storage','read-only-storage','storage'],workgroups:cases.length,label:'flat-cue-source-orchestration'});for(const[i,row]of cases.entries()){assert.equal(statuses[i],row.invalid?3:row.obstructed?4:1,row.name+' status');const local={state:actual.slice(row.base,row.base+row.state.length)};assert.equal(local.state[0],GUARD);assert.equal(local.state[local.state.length-1],GUARD);if(row.expected)compare(local,row,row.expected);const sb=i*(B.scratchWords+2)+1;assert.equal(work[sb-1],GUARD);assert.equal(work[sb+B.scratchWords],GUARD);}t.diagnostic(JSON.stringify({gate:'cue-flat',rows:cases.length,dispatches:cap.dispatches,instructionBudget:cap.instructionBudget,sourceBudgetsUnchanged:true,strictBits:true,hardwarePerformance:false,workgroupSize:1,workgroups:7,adapterInfo:owner.adapterInfo}));}finally{owner.release();}
});
