import{test}from'node:test';import assert from'node:assert/strict';
import Source from'../src/experimental-coupled-contact-math.js';import Graph from'../src/experimental-arithmetic-graph.js';
import{fixture,largestFixture}from'./resident-candidate-coupled-flat-fixtures.mjs';
import{createCoupledProgramBundle,packCoupledInitialState,unpackCoupledState,executeCoupledForTest}from'../src/resident-candidate/coupled-solver.mjs';
import{generateCoupledTransportWGSL,executeCoupledTransportForTest,coupledTransportWorkBound,COUPLED_TRANSPORT}from'../src/resident-candidate/coupled-transport.mjs';
import{generateNumericContinuationWGSL}from'../src/resident-candidate/numeric-continuation.mjs';
import{NUMERIC_PROFILE as P}from'../src/resident-candidate/numeric-profile.mjs';
const B=createCoupledProgramBundle(),raw=a=>new Uint32Array(a.buffer,a.byteOffset,a.length);
function prepare(fx){const plan=Source.buildPlan(fx.spec),packed=Source.pack(fx.input,plan),source=Graph.execute(packed,plan);return{...packCoupledInitialState(fx.spec,packed),expected:Source.unpack(source,plan),plan};}
function compare(state,layout,expected,plan){const got=unpackCoupledState(state,layout);for(const key of Object.keys(plan.layout))assert.deepEqual(raw(Float32Array.from(got[key])),raw(Float32Array.from(expected[key])),key+' exact original bits');}
const options=p=>({testOnly:true,coefficientBase:p.layout.coefficientBase,rosterBase:p.layout.rosterBase});
const bound=(fx,budget=32768)=>coupledTransportWorkBound(B,{...fx.spec,contactCount:fx.spec.contacts.length,instructionBudget:budget});
test('transport micro-ops retain full source solver 4/27/12/4/1 and all sixteen numerical programs',()=>{
 const seen=new Set();for(const fx of[fixture(1,false),fixture(2,true),fixture(4,true),largestFixture()]){const p=prepare(fx);for(const budget of[127,32768]){const capacity=bound(fx,budget),actual=executeCoupledTransportForTest(B,p.state,{...options(p),instructionBudget:budget,dispatches:capacity.dispatches,onProgram:r=>seen.add(r.programBase)});assert.equal(actual.status,1);compare(actual.state,p.layout,p.expected,p.plan);const baseline=executeCoupledForTest(B,p.state,options(p));assert.equal(actual.state[13],baseline[13]);assert.equal(actual.state[14],10);assert.deepEqual(unpackCoupledState(actual.state,p.layout),unpackCoupledState(baseline,p.layout));}}
 assert.equal(seen.size,16);assert.equal(COUPLED_TRANSPORT.nativeQualified,false);assert.equal(COUPLED_TRANSPORT.defaultBackend,false);
 for(const e of B.entries)for(const[,group,offset]of e.reads)if(group===0)assert.ok(offset<=12||offset===63,'transport metadata never aliases original common numerical input');
});
test('transport validation, source input checks, finite failures and retained next-h order stay exact',()=>{
 const fx=fixture(2,true),p=prepare(fx),short=executeCoupledTransportForTest(B,p.state,{...options(p),instructionBudget:1,dispatches:1});assert.equal(short.status,0);assert.equal(short.state[13],0);assert.equal(short.state[37],1,'one descriptor, not a whole nested validation loop');
 const first=executeCoupledTransportForTest(B,p.state,options(p)),next=first.state.slice();next.set(fx.spec.contactOrder.slice().reverse(),p.layout.orderBase);next[18]=0;next[27]=0;next[p.layout.rosterBase+6]=0;
 const baseline=executeCoupledForTest(B,next,options(p)),second=executeCoupledTransportForTest(B,next,options(p));assert.equal(second.status,1);assert.deepEqual(unpackCoupledState(second.state,p.layout),unpackCoupledState(baseline,p.layout));
 for(const defect of['order','numeric','friction-subnormal']){const s=p.state.slice();if(defect==='order')s[p.layout.orderBase+1]=s[p.layout.orderBase];else if(defect==='numeric')s[64]=0x7f800000;else s[9]=1;const got=executeCoupledTransportForTest(B,s,options(p));assert.equal(got.status,defect==='numeric'?3:2,defect);assert.throws(()=>unpackCoupledState(got.state,p.layout),/not complete/);}
 assert.throws(()=>executeCoupledTransportForTest(B,p.state,{coefficientBase:p.layout.coefficientBase,rosterBase:p.layout.rosterBase}),/TEST-ONLY/);
});
test('transport moves only loops, retaining original numeric instruction body and input-check order',()=>{
 for(const profile of[P.PRESERVED_F32,P.INTEGER_F32]){const original=generateNumericContinuationWGSL({numericProfile:profile}),code=generateCoupledTransportWGSL({numericProfile:profile}),start=original.indexOf('    let at=programBase+instructions+i*5u;'),end=original.indexOf('  rc_state[control+3u]=i+1u;',start);assert.ok(code.includes(original.slice(start,end)),'ordered arithmetic opcode body unchanged');assert.doesNotMatch(code,/fn rc_coupled_gather|fn rc_coupled_scatter|for\(var i=0u;i<inputs|for\(var i=0u;i<readCount|for\(var i=0u;i<writeCount/);assert.match(code,/if\(!rc_num_finite\(rc_scratch\[scratch\+index\]\)\)/);}
 const cap=bound(largestFixture());assert.ok(cap.dispatches>9&&cap.dispatches<6390);assert.equal(cap.sourceBodies,4);assert.equal(cap.sourceContacts,27);assert.equal(cap.sourceSubsteps,12);assert.equal(cap.sourcePgs,4);assert.equal(cap.sourceRelax,1);
 for(let n=1;n<=32;n++){const e=31-Math.clz32(n),word=((e+127)<<23)|((n<<(23-e))&0x7fffff);assert.equal(word>>>0,raw(Float32Array.of(n))[0]);}
});

// Same seven full original fixtures and WG1-per-candidate mapping as the prior
// gate. Dispatch capacity now counts EVERY validation/clear/copy/finite-check
// micro-op as well as every unchanged numerical node; no physics cap is cut.
test('actual native flat transport coupled matches same seven full source fixtures',
 {skip:process.env.REQUIRE_WEBGPU!=='1'},async t=>{
 const{createNativeOwner,dispatchWordStages}=await import('./resident-candidate-gpu-support.mjs'),owner=await createNativeOwner('resident-coupled-transport');
 try{const rows=[{name:'one-cloth',fx:fixture(1,false)},{name:'two-pair-cloth',fx:fixture(2,false)},{name:'invalid-order',fx:fixture(2,true),bad:'order'},{name:'four-chain-rails',fx:fixture(4,true)},{name:'invalid-numeric',fx:fixture(2,true),bad:'numeric'},{name:'four-reverse',fx:fixture(4,true)},{name:'27-contact-bound',fx:largestFixture()}];rows[5].fx.spec.contactOrder.reverse();const guard=0xfacefeed,budget=32768;let size=0;for(const row of rows){Object.assign(row,prepare(row.fx));row.base=size+1;size+=row.state.length+2;}
  const state=new Uint32Array(size),scratch=new Uint32Array(rows.length*(B.scratchWords+2)),jobs=[];for(const[i,row]of rows.entries()){state[row.base-1]=guard;state[row.base+row.state.length]=guard;state.set(row.state,row.base);if(row.bad==='order')state[row.base+row.layout.orderBase+1]=state[row.base+row.layout.orderBase];if(row.bad==='numeric')state[row.base+64]=0x7f800000;const s=i*(B.scratchWords+2)+1;scratch[s-1]=guard;scratch[s+B.scratchWords]=guard;jobs.push(row.base,row.base+row.layout.coefficientBase,row.base+row.layout.rosterBase,s,budget);}
  const code=`@group(0) @binding(0) var<storage,read> rc_program:array<u32>;
@group(0) @binding(1) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;
@group(0) @binding(3) var<storage,read> rc_jobs:array<u32>;
@group(0) @binding(4) var<storage,read_write> rc_results:array<u32>;
${generateCoupledTransportWGSL({numericProfile:process.env.RESIDENT_NUMERIC_PROFILE})}
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){let row=id.x;if(row>=arrayLength(&rc_jobs)/5u){return;}let at=row*5u;rc_results[row]=rc_coupled_transport_advance(rc_jobs[at],rc_jobs[at+1u],rc_jobs[at+2u],0u,rc_jobs[at+3u],rc_jobs[at+4u]);}`;
  const dispatches=Math.max(...rows.map(row=>bound(row.fx,budget).dispatches)),[,actual,work,,statuses]=await dispatchWordStages(owner,{stages:[{code,repeat:dispatches}],buffers:[{input:B.program},{input:state,readback:true},{input:scratch,readback:true},{input:Uint32Array.from(jobs)},{words:rows.length,readback:true}],bindingTypes:['read-only-storage','storage','storage','read-only-storage','storage'],workgroups:rows.length,label:'transport-source-ordered-coupled'});
  for(const[i,row]of rows.entries()){assert.equal(actual[row.base-1],guard);assert.equal(actual[row.base+row.state.length],guard);const s=i*(B.scratchWords+2)+1;assert.equal(work[s-1],guard);assert.equal(work[s+B.scratchWords],guard);assert.equal(statuses[i],row.bad==='order'?2:row.bad==='numeric'?3:1,row.name+' status');if(!row.bad)compare(actual.slice(row.base,row.base+row.state.length),row.layout,row.expected,row.plan);}
  t.diagnostic(JSON.stringify({gate:'coupled-transport-native',fixtures:rows.length,dispatches,instructionBudget:budget,bitwise:true,sourceCapsUnchanged:true,hardwarePerformance:false,workgroupSize:1,workgroups:7,adapterInfo:owner.adapterInfo}));
 }finally{owner.release();}
});
