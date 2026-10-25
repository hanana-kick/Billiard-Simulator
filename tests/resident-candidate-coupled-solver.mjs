import {test} from 'node:test';
import assert from 'node:assert/strict';
import Source from '../src/experimental-coupled-contact-math.js';
import Graph from '../src/experimental-arithmetic-graph.js';
import {COUPLED_LAYOUT, COUPLED_BODY_OFFSETS, COUPLED_CONTACT_OFFSETS, createCoupledProgramBundle,
  coupledStateLayout, packCoupledInitialState, unpackCoupledState, executeCoupledForTest,
  generateCoupledSolverWGSL,generateCoupledStagedWGSL} from '../src/resident-candidate/coupled-solver.mjs';

// Prepared numerical fixtures only: source geometry/lifecycle/CCD are separate
// gates. Original Source.buildPlan is the independent unmodified graph oracle.
const f=Math.fround,vec=x=>x.map(f),zero=()=>[0,0,0],clone=x=>structuredClone(x);
const common={dt:f(1/960),lengthUnit:1,normalizedMaxLinearVelocity:1000,dynamicFrequency:30,
  dynamicDamping:5,staticFrequency:120,staticDamping:5,warmstartCoefficient:.8,
  normalizedMaxCorrectiveVelocity:10,frictionInBiasPass:false,gravity:[0,f(-9.81),0],
  substeps:12,pgsIterations:4,stabilizationIterations:1};
function body(x=0,z=0){const radius=f(.03),mass=f(.17),inertia=f(f(f(.4)*mass)*f(radius*radius)),inv=f(1/inertia);
  return {linear:vec([.4,0,.15]),angular:vec([1,2,-3]),translation:vec([x,radius-.00001,z]),rotation:[0,0,0,1],
    invMass:Array(3).fill(f(1/mass)),invInertia:[inv,0,0,0,inv,0,0,0,inv],principalInertia:Array(3).fill(inertia),
    invPrincipalInertia:Array(3).fill(inv),principalFrame:[0,0,0,1],userForce:zero(),userTorque:zero(),
    gravityScale:1,linearDamping:0,angularDamping:0,gyroscopic:true,allowFastRotation:false,radius};}
const baseContact=()=>({warmWorld:zero(),warmImpulse:0,impulse:0,friction:f(.2),restitution:f(.8)});
function cloth(b){const p=b.translation,r=b.radius;return {...baseContact(),normal:[0,1,0],anchor1:[p[0],0,p[2]],anchor2:[0,-r,0],dp1:[p[0],f(p[1]-r),p[2]],dp2:[0,-r,0],friction:f(.25),restitution:0};}
function pair(a,b){const delta=b.translation.map((x,i)=>f(x-a.translation[i])),length=Math.hypot(...delta),n=vec(delta.map(x=>x/length)),p1=n.map(x=>f(x*a.radius)),p2=n.map(x=>f(-x*b.radius));return {...baseContact(),normal:n,anchor1:p1,anchor2:p2,dp1:p1,dp2:p2};}
function convex(b,normal){const n=vec(normal),dp=n.map(x=>f(-b.radius*x));return {...baseContact(),normal:n,anchor1:b.translation.map((x,i)=>f(x+dp[i])),anchor2:dp,dp1:b.translation.map((x,i)=>f(x+dp[i])),dp2:dp,friction:f(.15),restitution:f(.7)};}
function fixture(count=4,rails=true){
  const bodies=Array.from({length:count},(_,i)=>body((i-(count-1)/2)*.0599));
  bodies.forEach((b,i)=>b.linear=vec([1-i*.4,0,(i%2?-.03:.02)]));
  const descriptors=[],contacts=[];
  for(let i=0;i<count-1;i++){descriptors.push({kind:'dynamic-sphere',body1:i,body2:i+1});contacts.push(pair(bodies[i],bodies[i+1]));}
  bodies.forEach((b,i)=>{descriptors.push({kind:'cloth',body1:null,body2:i});contacts.push(cloth(b));});
  if(rails){for(const [i,n]of[[0,[0,0,1]],[count-1,[-1,0,0]]]){descriptors.push({kind:'static-convex',body1:null,body2:i});contacts.push(convex(bodies[i],n));}}
  const order=contacts.map((_,i)=>i);if(order.length>3)[order[1],order[2]]=[order[2],order[1]];
  contacts[0].warmImpulse=f(.0001);contacts[0].impulse=f(.0004);contacts[0].warmWorld=vec([0,.00001,-.00003]);
  return {spec:{bodyCount:count,substeps:common.substeps,pgsIterations:common.pgsIterations,stabilizationIterations:common.stabilizationIterations,contacts:descriptors,contactOrder:order},input:{...common,bodies,contacts}};
}
const BUNDLE=createCoupledProgramBundle();
function sourceExpected(spec,input){const plan=Source.buildPlan(spec),packed=Source.pack(input,plan),raw=Graph.execute(packed,plan);return {plan,packed,raw,decoded:Source.unpack(raw,plan)};}
function bitArray(values){return new Uint32Array(new Float32Array(values).buffer);}
function compareState(state,layout,expected,label=''){
  const got=unpackCoupledState(state,layout);
  for(const key of Object.keys(expected.plan.layout))assert.deepEqual(bitArray(got[key]),bitArray(expected.decoded[key]),label+'.'+key+' source f32 bits');
  for(const i of expected.plan.config.contactOrder){const field=expected.plan.layout['contact'+i];assert.deepEqual(bitArray(got.rawContactOutputs[i]),new Uint32Array(expected.raw.buffer,expected.raw.byteOffset+field.offset*4,field.length),label+' raw pre-canonical cache'+i);}
  assert.equal(got.contacts.filter(Boolean).length,expected.plan.config.contactOrder.length);
  return got;
}
function run(fx){const expected=sourceExpected(fx.spec,fx.input),initial=packCoupledInitialState(fx.spec,expected.packed);
  const state=executeCoupledForTest(BUNDLE,initial.state,{testOnly:true,coefficientBase:initial.layout.coefficientBase,rosterBase:initial.layout.rosterBase});
  return {...initial,state,expected,got:compareState(state,initial.layout,expected)};}

test('source layouts and fixed program library do not depend on topology or permutations',t=>{
  assert.equal(COUPLED_BODY_OFFSETS.invInertia,16);assert.equal(COUPLED_BODY_OFFSETS.force,47);
  assert.equal(COUPLED_CONTACT_OFFSETS.warmWorld,15);assert.equal(COUPLED_CONTACT_OFFSETS.impulse,19);
  assert.equal(BUNDLE.entries.length,16);assert.equal(BUNDLE.scratchWords,353);
  assert.ok(BUNDLE.program.byteLength<100000);
  assert.deepEqual(BUNDLE.program,createCoupledProgramBundle().program);
  t.diagnostic(JSON.stringify({sharedProgramBytes:BUNDLE.program.byteLength,scratchBytes:BUNDLE.scratchWords*4,
    numericalStateMaxBytes:coupledStateLayout(4,27).stateWords*4,fullWorld:false}));
});

test('one/two/four bodies and all three contact kinds match unmodified source graph exactly',()=>{
  for(const count of[1,2,4])for(const rails of[false,true])run(fixture(count,rails));
});

test('original h and solver schedules remain data-driven rather than compiled permutations',()=>{
  for(const [h,substeps,pgs,stabilization]of[[1/61440,12,4,1],[1/960,12,4,1],[1/240,4,1,1],[1/960,3,2,2],[1/960,1,1,1]]){
    const fx=fixture(2,true);Object.assign(fx.spec,{substeps,pgsIterations:pgs,stabilizationIterations:stabilization});
    Object.assign(fx.input,{dt:f(h),substeps,pgsIterations:pgs,stabilizationIterations:stabilization});run(fx);
  }
});

test('runtime order matters and body/contact storage permutations preserve an unchanged order',()=>{
  const fx=fixture(),normal=run(fx),reversed=clone(fx);reversed.spec.contactOrder.reverse();const reverse=run(reversed);
  assert.notDeepEqual(normal.got.body0,reverse.got.body0,'ordered PGS must not become independent contact solves');
  const bodyOrder=[2,0,3,1],contactOrder=[8,3,1,6,2,0,7,5,4],bi=i=>bodyOrder.indexOf(i),ci=i=>contactOrder.indexOf(i);
  const changed={spec:{...fx.spec,contacts:contactOrder.map(i=>({...fx.spec.contacts[i],body1:fx.spec.contacts[i].body1===null?null:bi(fx.spec.contacts[i].body1),body2:bi(fx.spec.contacts[i].body2)})),contactOrder:fx.spec.contactOrder.map(ci)},
    input:{...fx.input,bodies:bodyOrder.map(i=>fx.input.bodies[i]),contacts:contactOrder.map(i=>fx.input.contacts[i])}};
  const remapped=run(changed);
  for(let i=0;i<4;i++)assert.deepEqual(bitArray(normal.got['body'+i]),bitArray(remapped.got['body'+bi(i)]));
  for(let i=0;i<9;i++)assert.deepEqual(bitArray(normal.got['contact'+i]),bitArray(remapped.got['contact'+ci(i)]));
});

test('inactive manifolds retain state and an uncoupled body integrates once',()=>{
  const fx=fixture(4,false);fx.spec.contactOrder=fx.spec.contactOrder.filter(i=>![2,6].includes(i));
  const actual=run(fx),free=clone(fx);free.spec.contactOrder=[];const expected=run(free);
  assert.deepEqual(bitArray(actual.got.body3),bitArray(expected.got.body3));
  assert.equal(actual.got.contacts[2],null);assert.equal(actual.got.contacts[6],null);
  assert.equal(expected.got.contacts.filter(Boolean).length,0);
});

test('gyroscopic correction, damping, caps and retained warm starts preserve scalar ordering',()=>{
  for(const fast of[false,true]){
    const fx=fixture(2,true);fx.input.warmstartCoefficient=f(.65);fx.input.normalizedMaxLinearVelocity=f(.3);
    fx.input.bodies.forEach((b,i)=>{b.allowFastRotation=fast;b.angular=vec([10000,-3000,8000]);b.linearDamping=f(.2);b.angularDamping=f(.3);b.userForce=vec([.01,0,-.02]);b.userTorque=vec([.001,-.002,.003]);
      b.rotation=vec([Math.sin(.13+i*.03),0,0,Math.cos(.13+i*.03)]);b.principalFrame=vec([0,Math.sin(.17),0,Math.cos(.17)]);b.principalInertia=vec([.00004,.00005,.00006]);b.invPrincipalInertia=b.principalInertia.map(x=>f(1/x));});
    run(fx);
  }
});

function largestFixture(){const fx=fixture(4,true);while(fx.spec.contacts.length<27){const i=fx.spec.contacts.length,b=i%4,n=i%2?[0,0,-1]:[0,1,0];fx.spec.contacts.push({kind:'static-convex',body1:null,body2:b});fx.input.contacts.push(convex(fx.input.bodies[b],n));fx.spec.contactOrder.push(i);}return fx;}
test('27-contact bound executes without changing source numeric schedule',()=>{run(largestFixture());});

test('a retained numerical state can run another h with new runtime order, without rebuilding programs',()=>{
  const fx=fixture(2,true),first=run(fx),next=clone(fx);next.spec.contactOrder.reverse();
  first.got.bodies.forEach((b,i)=>Object.assign(next.input.bodies[i],b));
  first.got.contacts.forEach((c,i)=>{if(c)Object.assign(next.input.contacts[i],{impulse:c.impulse,warmImpulse:c.warmImpulse,warmWorld:c.warmWorld,warmTangent:c.warmTangent});});
  // Fixed prepared anchors are intentional: this is solver recurrence, not a
  // fabricated collision-discovery claim. The independent source sees the same.
  const expected=sourceExpected(next.spec,next.input),retained=first.state.slice();
  retained.set(next.spec.contactOrder,first.layout.orderBase);
  const result=executeCoupledForTest(BUNDLE,retained,{testOnly:true,coefficientBase:first.layout.coefficientBase,rosterBase:first.layout.rosterBase});
  compareState(result,first.layout,expected,'second numerical h');
});

test('explicit source bounds reject unsupported rosters and host runtime fallback is unavailable',()=>{
  assert.throws(()=>coupledStateLayout(5,0));assert.throws(()=>coupledStateLayout(4,28));
  const fx=fixture(2,true),expected=sourceExpected(fx.spec,fx.input),initial=packCoupledInitialState(fx.spec,expected.packed);
  assert.throws(()=>executeCoupledForTest(BUNDLE,initial.state,{coefficientBase:initial.layout.coefficientBase,rosterBase:initial.layout.rosterBase}),/TEST-ONLY/);
  assert.throws(()=>unpackCoupledState(initial.state,initial.layout),/not complete/);
  for(const edit of[x=>x.contactOrder=[0,0],x=>x.contacts[0].body1=1,x=>x.substeps=0,x=>x.contacts[1].kind='mesh']){
    const bad=clone(fx.spec);edit(bad);assert.throws(()=>packCoupledInitialState(bad,expected.packed));
  }
  const malformed=initial.state.slice();malformed[initial.layout.orderBase+1]=malformed[initial.layout.orderBase];
  assert.throws(()=>executeCoupledForTest(BUNDLE,malformed,{testOnly:true,coefficientBase:initial.layout.coefficientBase,rosterBase:initial.layout.rosterBase}),/ordered/);
  assert.throws(()=>executeCoupledForTest(BUNDLE,initial.state,{testOnly:true,coefficientBase:64,rosterBase:initial.layout.rosterBase}),/overlap/);
  const friction=initial.state.slice();new Float32Array(friction.buffer)[9]=1;
  assert.throws(()=>executeCoupledForTest(BUNDLE,friction,{testOnly:true,coefficientBase:initial.layout.coefficientBase,rosterBase:initial.layout.rosterBase}),/frictionInBiasPass/);
  const code=generateCoupledSolverWGSL();assert.match(code,/fn rc_coupled_step/);assert.doesNotMatch(code,/@binding|@compute|workgroupBarrier|storageBarrier/);
});

test('single-site phase machine traces the original nested source order including empty rosters',()=>{
  const shader=generateCoupledSolverWGSL();
  assert.equal([...shader.matchAll(/rc_cs_micro\(/g)].length,2,'one declaration and one interpreter call site');
  assert.doesNotMatch(shader,/fn rc_cs_contact/);
  for(const empty of[false,true]){
    const fx=fixture(2,true);if(empty)fx.spec.contactOrder=[];
    const expected=sourceExpected(fx.spec,fx.input),initial=packCoupledInitialState(fx.spec,expected.packed),trace=[];
    const state=executeCoupledForTest(BUNDLE,initial.state,{testOnly:true,trace,coefficientBase:initial.layout.coefficientBase,rosterBase:initial.layout.rosterBase});
    const source=[],oc=fx.spec.contactOrder.length,bc=fx.spec.bodyCount;
    const push=(phase,step,sweep,count)=>{for(let item=0;item<count;item++)source.push({phase,step,sweep,item});};
    push(0,0,0,oc);push(1,0,0,bc);
    for(let step=0;step<fx.spec.substeps;step++){
      push(2,step,0,bc);push(3,step,0,oc);
      for(let sweep=0;sweep<fx.spec.pgsIterations;sweep++)push(4,step,sweep,oc);
      push(5,step,0,bc);
      for(let sweep=0;sweep<fx.spec.stabilizationIterations;sweep++)push(6,step,sweep,oc);
    }
    push(7,fx.spec.substeps,0,oc);push(8,fx.spec.substeps,0,oc);push(9,fx.spec.substeps,0,bc);
    assert.deepEqual(trace.map(({program,...row})=>row),source);
    assert.equal(state[13],trace.length);assert.equal(state[14],10);compareState(state,initial.layout,expected);
  }
});

test('bounded advances retain whole source solver state across fixed dispatch boundaries',()=>{
  const code=generateCoupledSolverWGSL({boundedAdvance:true});assert.match(code,/fn rc_coupled_advance/);assert.doesNotMatch(code,/fn rc_coupled_step/);
  assert.equal([...code.matchAll(/rc_cs_micro\(/g)].length,2);
  for(const fx of[fixture(1,false),fixture(4,true),largestFixture()])for(const budget of[1,64]){
    const expected=sourceExpected(fx.spec,fx.input),initial=packCoupledInitialState(fx.spec,expected.packed),trace=[];
    let state=initial.state,dispatches=0;
    const bc=fx.spec.bodyCount,oc=fx.spec.contactOrder.length,bound=2*bc+3*oc+fx.spec.substeps*(2*bc+oc*(1+fx.spec.pgsIterations+fx.spec.stabilizationIterations))+1;
    for(;dispatches<Math.ceil(bound/budget);dispatches++)state=executeCoupledForTest(BUNDLE,state,{testOnly:true,trace,maximumOperations:budget,coefficientBase:initial.layout.coefficientBase,rosterBase:initial.layout.rosterBase});
    assert.equal(state[initial.layout.rosterBase+6],1);assert.equal(state[13],bound-1);assert.equal(trace.length,bound-1);compareState(state,initial.layout,expected,'bounded advances');
    assert.deepEqual(executeCoupledForTest(BUNDLE,state,{testOnly:true,maximumOperations:1,coefficientBase:initial.layout.coefficientBase,rosterBase:initial.layout.rosterBase}),state,'completed lane is unchanged');
  }
});

test('compiler-separated stages expose the same source boundaries with standalone numerical VM',()=>{
  const gather=generateCoupledStagedWGSL('gather'),evaluate=generateCoupledStagedWGSL('evaluate'),scatter=generateCoupledStagedWGSL('scatter');
  assert.doesNotMatch(gather,/rc_num_eval|rc_coupled_step|rc_cs_micro/);assert.doesNotMatch(scatter,/rc_num_eval|rc_cs_micro/);
  assert.match(gather,/rc_coupled_gather/);assert.match(scatter,/rc_coupled_scatter/);
  assert.equal([...evaluate.matchAll(/rc_num_eval\(/g)].length,2);assert.doesNotMatch(evaluate,/rc_cs_micro|var phase|switch phase/);
  assert.match(scatter,/word=0u/,'source cache signed-zero canonicalization stays in scatter');
});

function tracedNativeOwner(owner){
  const originals=new WeakMap(),stage=name=>console.error('[coupled native] '+name);
  const unwrap=x=>originals.get(x)??x;
  const wrap=(target,handlers)=>{const proxy=new Proxy(target,{get(t,k){if(handlers[k])return handlers[k];const v=t[k];return typeof v==='function'?v.bind(t):v;}});originals.set(proxy,target);return proxy;};
  const device=owner.device;
  return {...owner,device:wrap(device,{
    createShaderModule:descriptor=>{stage('shader module creation');const shader=device.createShaderModule(descriptor);return wrap(shader,{getCompilationInfo:async()=>{stage('WGSL compilation info');const info=await shader.getCompilationInfo();stage('WGSL compilation returned');return info;}});},
    createComputePipelineAsync:async descriptor=>{stage('compute pipeline creation');const pipeline=await device.createComputePipelineAsync({...descriptor,compute:{...descriptor.compute,module:unwrap(descriptor.compute.module)}});stage('compute pipeline returned');return pipeline;},
    createBuffer:descriptor=>{const buffer=device.createBuffer(descriptor);return wrap(buffer,{mapAsync:async(...args)=>{stage('mapAsync started');await buffer.mapAsync(...args);stage('mapAsync returned');}});},
    createBindGroup:descriptor=>device.createBindGroup({...descriptor,entries:descriptor.entries.map(e=>({...e,resource:{...e.resource,buffer:unwrap(e.resource.buffer)}}))}),
    createCommandEncoder:descriptor=>{const encoder=device.createCommandEncoder(descriptor);return wrap(encoder,{copyBufferToBuffer:(a,ao,b,bo,size)=>encoder.copyBufferToBuffer(unwrap(a),ao,unwrap(b),bo,size)});},
    queue:wrap(device.queue,{writeBuffer:(buffer,...args)=>device.queue.writeBuffer(unwrap(buffer),...args),submit:commands=>{stage('queue submit');device.queue.submit(commands);stage('queue submit returned');}})
  })};
}

test('actual native resident coupled solver uses runtime rosters and isolates invalid candidate lanes',
  {skip:process.env.REQUIRE_WEBGPU!=='1'},async t=>{
  const {createNativeOwner,dispatchWords,dispatchWordStages}=await import('./resident-candidate-gpu-support.mjs');
  const bounded=process.env.RESIDENT_COUPLED_ADVANCE==='1',staged=process.env.RESIDENT_COUPLED_STAGED==='1',advanceOperations=Number(process.env.RESIDENT_COUPLED_ADVANCE_OPS??64);
  const numericProfile=process.env.RESIDENT_NUMERIC_PROFILE;
  const owner=await createNativeOwner('resident-coupled-solver'),traced=tracedNativeOwner(owner);
  try{
    const rows=[{name:'one-cloth',fx:fixture(1,false)},{name:'two-pair-cloth',fx:fixture(2,false)},
      {name:'invalid-order',fx:fixture(2,true),bad:'order'},{name:'four-chain-rails',fx:fixture(4,true)},
      {name:'invalid-numeric',fx:fixture(2,true),bad:'numeric'},{name:'four-reverse',fx:fixture(4,true)},
      {name:'27-contact-bound',fx:largestFixture()}];
    rows[5].fx.spec.contactOrder.reverse();
    const GUARD=0xfacefeed;let stateWords=0;
    for(const row of rows){row.expected=sourceExpected(row.fx.spec,row.fx.input);Object.assign(row,packCoupledInitialState(row.fx.spec,row.expected.packed));row.base=stateWords+1;stateWords+=row.state.length+2;}
    const state=new Uint32Array(stateWords),scratch=new Uint32Array(rows.length*(BUNDLE.scratchWords+2)),jobs=[];
    for(const[rowIndex,row]of rows.entries()){
      state[row.base-1]=GUARD;state[row.base+row.state.length]=GUARD;state.set(row.state,row.base);
      if(row.bad==='order')state[row.base+row.layout.orderBase+1]=state[row.base+row.layout.orderBase];
      if(row.bad==='numeric')state[row.base+64]=0x7f800000;
      const s=rowIndex*(BUNDLE.scratchWords+2)+1;scratch[s-1]=GUARD;scratch[s+BUNDLE.scratchWords]=GUARD;
      jobs.push(row.base,row.base+row.layout.coefficientBase,row.base+row.layout.rosterBase,s);
    }
    const declarations=`
@group(0) @binding(0) var<storage,read> rc_program:array<u32>;
@group(0) @binding(1) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;
@group(0) @binding(3) var<storage,read> rc_jobs:array<u32>;
@group(0) @binding(4) var<storage,read_write> rc_results:array<u32>;
`;
    const code=declarations+`
${generateCoupledSolverWGSL({boundedAdvance:bounded,advanceOperations,numericProfile})}
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) gid:vec3<u32>){let row=gid.x;if(row>=arrayLength(&rc_jobs)/4u){return;}let at=row*4u;rc_results[row]=${bounded?'rc_coupled_advance':'rc_coupled_step'}(rc_jobs[at],rc_jobs[at+1u],rc_jobs[at+2u],0u,rc_jobs[at+3u]);}
`;
    const stagedCode=stage=>declarations+generateCoupledStagedWGSL(stage,{numericProfile})+`
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) gid:vec3<u32>){let row=gid.x;if(row>=arrayLength(&rc_jobs)/4u){return;}let at=row*4u;rc_results[row]=${stage==='gather'?'rc_coupled_gather(rc_jobs[at],rc_jobs[at+1u],rc_jobs[at+2u],0u,rc_jobs[at+3u])':`rc_coupled_${stage}(rc_jobs[at],rc_jobs[at+2u],rc_jobs[at+3u])`};}
`;
    const buffers=[{input:BUNDLE.program},{input:state,readback:true},{input:scratch,readback:true},{input:Uint32Array.from(jobs)},{words:rows.length,readback:true}];
    const operationBound=Math.max(...rows.map(({fx:{spec:s}})=>2*s.bodyCount+3*s.contactOrder.length+s.substeps*(2*s.bodyCount+s.contactOrder.length*(1+s.pgsIterations+s.stabilizationIterations))+1));
    const dispatchBound=Math.ceil(operationBound/advanceOperations);
    console.error('[coupled native] mode='+ (staged?'separated resident stages '+operationBound:bounded?'resident bounded advances '+dispatchBound:'whole-h single-site'));
    const[,result,actualScratch,,statuses]=staged?
      await dispatchWordStages(traced,{stages:['gather','evaluate','scatter'].map(stage=>({code:stagedCode(stage)})),cycles:operationBound,buffers,bindingTypes:['read-only-storage','storage','storage','read-only-storage','storage'],workgroups:1,label:'resident-source-ordered-coupled-separated'}):bounded?
      await dispatchWordStages(traced,{stages:[{code,repeat:dispatchBound}],buffers,bindingTypes:['read-only-storage','storage','storage','read-only-storage','storage'],workgroups:1,label:'resident-source-ordered-coupled-advances'}):
      await dispatchWords(traced,{code,buffers,workgroups:1,label:'resident-source-ordered-coupled-solver'});
    for(const[i,row]of rows.entries()){
      assert.equal(statuses[i],row.bad==='order'?2:row.bad==='numeric'?3:1,row.name+' status');
      assert.equal(result[row.base+row.layout.rosterBase+6],statuses[i],row.name+' completion');
      assert.equal(result[row.base-1],GUARD);assert.equal(result[row.base+row.state.length],GUARD);
      const s=i*(BUNDLE.scratchWords+2)+1;assert.equal(actualScratch[s-1],GUARD);assert.equal(actualScratch[s+BUNDLE.scratchWords],GUARD);
      if(!row.bad){
        compareState(result.subarray(row.base,row.base+row.state.length),row.layout,row.expected,row.name);
        const bc=row.fx.spec.bodyCount,oc=row.fx.spec.contactOrder.length,st=row.fx.spec.substeps;
        assert.equal(result[row.base+13],2*bc+3*oc+st*(2*bc+oc*(1+row.fx.spec.pgsIterations+row.fx.spec.stabilizationIterations)),row.name+' stage call count');
        assert.equal(result[row.base+14],10,row.name+' final stage trace');
      }
    }
    t.diagnostic(JSON.stringify({gate:'resident-coupled-actual-native',rows:rows.length,bitwise:true,
      sourceOracle:'unchanged experimental-coupled-contact-math',adapterInfo:owner.adapterInfo,
      programs:BUNDLE.entries.length,hostPerStepPlan:false,fullWorldParity:false,hardwarePerformance:false}));
  }finally{owner.release();}
});
