import{test}from'node:test';import assert from'node:assert/strict';
import Compliance from'../src/experimental-cue-joint-compliance.js';import Tip from'../src/experimental-cue-joint-tip-contact.js';
import Cloth from'../src/experimental-cue-cloth-joint-stepper.js';import ClothFixture from'./cue-cloth-joint-fixture.cjs';
import Init from'../src/experimental-cue-initialization.js';import Joint from'../src/experimental-cue-joint-stepper.js';
import{originalRegisteredFixture}from'./resident-candidate-original-fixture.mjs';
import{createCueProgramBundle,packCueInitialState,executeCueForTest,generateCueOrchestrationWGSL}from'../src/resident-candidate/cue-orchestration.mjs';
import{CUE_LAYOUT as L}from'../src/resident-candidate/cue.mjs';
import{COUPLED_BODY_OFFSETS as BO}from'../src/resident-candidate/coupled-solver.mjs';
import{wordsNumber,numberWords}from'../src/resident-candidate/source-number.mjs';
const bundle=createCueProgramBundle(),f=Math.fround,clone=x=>structuredClone(x),bits=x=>new Uint32Array(Float32Array.from(x).buffer);
function ballWords(state){const a=new Uint32Array(64),fl=new Float32Array(a.buffer);for(const[k,i]of Object.entries(BO)){const x=state[k];if(x!==undefined)fl.set(Array.isArray(x)?x:[+x],i);}return a;}
const read=(s,at,n)=>Array.from(new Float32Array(s.buffer,s.byteOffset,s.length).slice(at,at+n));
const read64=(s,at)=>wordsNumber(s.subarray(at,at+2));
function sourceApplication(seed,q,ball,active=false,contacted=false,tangent=[0,0,0]){
 const a=seed.application,h=a.dt/a.subdivisions,com=role=>{const i=clone(seed.initializationInputs.find(x=>x.role===role));i.translation=q[role].translation;i.rotation=q[role].rotation;return Init.initializeReference(i).worldCom;};
 const shaftCom=com('shaft'),headCom=com('head');
 const lateral=Compliance.sourceReference({kind:'actual-cue-lateral-prefix',phase:'pre-world-step-pre-tip-contact',dynamicAwake:true,headPosition:q.head.translation,shaftPosition:q.shaft.translation,headCom,shaftCom,headLinear:q.head.linear,shaftLinear:q.shaft.linear,headAngular:q.head.angular,shaftAngular:q.shaft.angular,headInvMass:q.head.invMass,shaftInvMass:q.shaft.invMass,shaftInvInertia:q.shaft.invInertia,axis:a.axis,h,stiffness:a.lateralStiffness,damping:a.lateralDamping});
 Object.assign(q.head,lateral.head);Object.assign(q.shaft,lateral.shaft);
 const tip=Tip.sourceReference({kind:'actual-cue-single-sphere-tip',phase:'post-lateral-prefix-pre-world-step',head:{position:q.head.translation,worldCom:headCom,linear:q.head.linear,angular:q.head.angular,invMass:q.head.invMass,invInertia:q.head.invInertia},ball:{position:ball.translation,worldCom:ball.translation,linear:ball.linear,angular:ball.angular,invMass:ball.invMass,invInertia:[0,1,2,4,5,8].map(i=>ball.invInertia[i])},radius:a.radius,tipRadius:a.tipRadius,h,normalStiffness:a.normalStiffness,normalDamping:a.normalDamping,tangentStiffness:a.tangentStiffness,tangentDamping:a.tangentDamping,friction:a.friction,active,contacted,tangent});
 Object.assign(q.head,tip.head);Object.assign(ball,tip.ball);return{q,ball,tip,lateral};
}
function compareCue(state,q){for(const[role,base]of[['shaft',L.joint],['head',L.joint+48]])for(const[key,offset,n]of[['linear',0,3],['angular',3,3],['translation',6,3],['rotation',9,4],['invMass',16,3],['invInertia',19,6]])assert.deepEqual(bits(read(state,base+offset,n)),bits(q[role][key]),role+'.'+key);}
async function fixture(){const{seed}=await originalRegisteredFixture();return{seed,initial:packCueInitialState(seed.cueInitial,bundle,{sceneSlots:[6,5,7,0]}),bodies:seed.balls.map(({state})=>ballWords(state))};}

test('genuine created seed runs COM/application/first numeric initialization/deferred source joints in order',async()=>{
 const{seed,initial,bodies}=await fixture(),index=seed.selectedIndex,others=bodies.filter((_,i)=>i!==index);let q=clone(seed.cueInitial.cue),ball=clone(seed.balls[index].state),state=initial,body=bodies[index];
 let time=seed.cueInitial.application.initialTime,elapsed=0;
 for(let h=0;h<5;h++){
  const expected=sourceApplication(seed.cueInitial,q,ball,!!state[5],!!state[6],[0,1,2].map(i=>read64(state,26+2*i)));
  const app=executeCueForTest(bundle,state,{ball:body,others,testOnly:true});state=app.state;body=app.ball;
  if(h===0){for(const role of['shaft','head']){const out=Init.initializeReference(seed.cueInitial.initializationInputs.find(x=>x.role===role));q[role].invMass=out.invMass;q[role].invInertia=out.invInertia;}}
  compareCue(state,q);assert.deepEqual(bits(read(body,0,6)),bits([...ball.linear,...ball.angular]));assert.equal(state[47],7);assert.equal(state[13],1);assert.equal(state[12],1);assert.equal(state[10],expected.tip.touching?4:2);
  time+=1/61440;elapsed+=1/61440;assert.deepEqual(numberWords(read64(state,20)),numberWords(time));assert.deepEqual(numberWords(read64(state,22)),numberWords(elapsed));
  const solve=Joint.stepReference(q);Object.assign(q.shaft,solve.shaft);Object.assign(q.head,solve.head);
  const result=executeCueForTest(bundle,state,{ball:body,others,mode:1,testOnly:true});state=result.state;compareCue(state,q);assert.deepEqual(bits(read(state,L.jointImpulses,10)),bits(solve.impulses));assert.equal(state[12],0);
 }
});
test('first-h numerical receipt is consumed externally and no host runtime fallback exists',async()=>{
 const{seed,initial,bodies}=await fixture(),ball=bodies[seed.selectedIndex],others=bodies.filter((_,i)=>i!==seed.selectedIndex);
 assert.throws(()=>executeCueForTest(bundle,initial,{ball,others}),/TEST-ONLY/);
 const out=executeCueForTest(bundle,initial,{ball,others,testOnly:true});
 for(const[i,input]of seed.cueInitial.initializationInputs.entries()){
  const expected=Init.initializeReference(input),at=L.initialOutputs+i*30;assert.deepEqual(bits(read(out.state,at,12)),bits([...expected.worldCom,...expected.invMass,...expected.invInertia]));assert.equal(read(out.state,at+12,1)[0],expected.maxExtent);assert.equal(read(out.state,at+13,1)[0],expected.ccdThickness);
 }
 assert.equal(bundle.scratchWords,811);assert.equal(bundle.stateWords,2678);assert.ok(bundle.program.byteLength<4e6);
 for(const stage of['prepare','numeric','source','scatter']){const code=generateCueOrchestrationWGSL(stage);assert.match(code,new RegExp('fn rc_cue_'+stage));assert.doesNotMatch(code,/@binding|@compute|storageBarrier|workgroupBarrier/);}
});
test('retirement records are stable, ordered and tied to completed application frame',async()=>{
 const{seed,initial,bodies}=await fixture(),ball=bodies[seed.selectedIndex],others=bodies.filter((_,i)=>i!==seed.selectedIndex);initial[6]=1;
 const out=executeCueForTest(bundle,initial,{ball,others,testOnly:true});assert.equal(out.state[4],0);assert.equal(out.state[11],3);assert.deepEqual(Array.from(out.state.subarray(606,609)),[0,1,2]);assert.equal(out.state[7],1);assert.equal(out.state[12],0);assert.equal(read64(out.state,36),seed.cueInitial.application.initialTime);
 assert.throws(()=>executeCueForTest(bundle,out.state,{ball:out.ball,others,testOnly:true}),/application/);
});

let preparedCloth;
function actualPreparedCloth(){return preparedCloth??=(ClothFixture.fixtures(ClothFixture.load(ClothFixture.ROOT+'speed2-full.v8').data,[424])[0].input);}
function clothCueState(initial){const state=initial.slice();new Float32Array(state.buffer).set(Cloth.pack(actualPreparedCloth()),L.joint);state[7]=424;state[12]=1;state[13]=1;state[15]=1;state[47]=7;return state;}
test('actual original prepared cue-cloth component selects shared joint/contact recurrence and writes native cache',async()=>{
 const{seed,initial,bodies}=await fixture(),state=clothCueState(initial),input=actualPreparedCloth(),expected=Cloth.stepReference(input),result=executeCueForTest(bundle,state,{ball:bodies[seed.selectedIndex],others:bodies.filter((_,i)=>i!==seed.selectedIndex),mode:1,testOnly:true});
 for(const[role,base]of[['shaft',L.joint],['head',L.joint+48]])for(const[k,offset,n]of[['linear',0,3],['angular',3,3],['translation',6,3],['rotation',9,4],['invInertia',19,6]])assert.deepEqual(bits(read(result.state,base+offset,n)),bits(expected[role][k]));
 assert.deepEqual(bits(read(result.state,L.jointImpulses,10)),bits(expected.impulses));
 const c=L.joint+144;assert.deepEqual(bits([...read(result.state,c+19,1),...read(result.state,c+18,1),...read(result.state,c+22,2),...read(result.state,c+15,3)]),bits([expected.contact.impulse,expected.contact.warmImpulse,...expected.contact.warmTangent,...expected.contact.warmWorld]));
});

test('actual native resident cue application initialization and deferred joint remain device-owned',
 {skip:process.env.REQUIRE_WEBGPU!=='1'},async t=>{
  const{createNativeOwner,dispatchWordStages}=await import('./resident-candidate-gpu-support.mjs');
  const fx=await fixture(),owner=await createNativeOwner('resident-cue-orchestration');
  try{
    const cases=[{name:'genuine application and joint',solve:1},{name:'retirement receipt',solve:1,retire:true},
      {name:'invalid ball lane',solve:1,invalid:true},{name:'genuine later lane',solve:1},
      {name:'other sphere exclusion',solve:1,obstructed:true},{name:'application initialization receipt',solve:0},{name:'prepared original cue cloth component',solve:1,cloth:true}];
    const GUARD=0xfacefeed,jobs=[];let words=0;
    for(const row of cases){row.base=words+1;row.ballBase=row.base+bundle.stateWords;row.others=row.ballBase+4*64;row.end=row.others+3;words=row.end+1;row.cue=row.cloth?clothCueState(fx.initial):fx.initial.slice();row.bodies=fx.bodies.map(x=>x.slice());if(row.retire)row.cue[6]=1;if(row.invalid)row.bodies[fx.seed.selectedIndex][0]=0x7f800000;
      if(row.obstructed){const other=row.bodies.find((_,i)=>i!==fx.seed.selectedIndex);other.set(row.cue.subarray(L.joint+54,L.joint+57),6);}
      const otherBodies=row.bodies.filter((_,i)=>i!==fx.seed.selectedIndex);
      if(!row.invalid&&!row.obstructed){row.expected=executeCueForTest(bundle,row.cue,{ball:row.bodies[fx.seed.selectedIndex],others:otherBodies,mode:row.cloth?1:0,testOnly:true});if(row.solve&&row.expected.state[12])row.expected=executeCueForTest(bundle,row.expected.state,{ball:row.expected.ball,others:otherBodies,mode:1,testOnly:true});}
    }
    const state=new Uint32Array(words),scratch=new Uint32Array(cases.length*(bundle.scratchWords+2));
    for(const[i,row]of cases.entries()){state[row.base-1]=GUARD;state[row.end]=GUARD;state.set(row.cue,row.base);row.bodies.forEach((b,k)=>state.set(b,row.ballBase+k*64));state.set(row.bodies.map((_,k)=>k).filter(k=>k!==fx.seed.selectedIndex).map(k=>row.ballBase+k*64),row.others);const sb=i*(bundle.scratchWords+2)+1;scratch[sb-1]=GUARD;scratch[sb+bundle.scratchWords]=GUARD;jobs.push(row.base,row.ballBase+fx.seed.selectedIndex*64,row.others,sb,row.solve);}
    const prefix=`
@group(0) @binding(0) var<storage,read> rc_program:array<u32>;
@group(0) @binding(1) var<storage,read> rc_inputs:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;
@group(0) @binding(4) var<storage,read> rc_jobs:array<u32>;
@group(0) @binding(5) var<storage,read_write> rc_results:array<u32>;
`;
    const code=stage=>prefix+generateCueOrchestrationWGSL(stage)+`
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){let row=id.x;if(row>=arrayLength(&rc_jobs)/5u){return;}let j=row*5u;let b=rc_jobs[j];let ball=rc_jobs[j+1u];let scratch=rc_jobs[j+3u];
${stage==='prepare'?`if(rc_state[b+2u]==1u){if(rc_state[b+7u]==0u){rc_cue_begin(b,0u,0u);}else if(rc_jobs[j+4u]!=0u && rc_state[b+12u]!=0u){rc_cue_begin(b,0u,1u);}}rc_results[row]=rc_cue_prepare(b,ball,rc_jobs[j+2u],3u,0u,scratch);`:stage==='numeric'?'rc_results[row]=rc_cue_numeric(b,0u,scratch);':stage==='source'?'rc_results[row]=rc_cue_source(b,0u);':'rc_results[row]=rc_cue_scatter(b,ball,0u,scratch);'}
}
`;
    const stages=['prepare','numeric','source','scatter'].map(stage=>({code:code(stage)}));
    const[,,actual,actualScratch,,results]=await dispatchWordStages(owner,{stages,cycles:640,buffers:[{input:bundle.program},{words:1},{input:state,readback:true},{input:scratch,readback:true},{input:Uint32Array.from(jobs)},{words:cases.length,readback:true}],bindingTypes:['read-only-storage','read-only-storage','storage','storage','read-only-storage','storage'],label:'resident-cue-application-and-deferred-joint'});
    const ranges=[[0,14],[15,28],[47,1],[50,6],[L.joint,184],[L.worldCom,6],[L.initialInputs,120],[L.initialOutputs,90],[L.jointImpulses,10],[L.mutableCalls,12],[L.removedRoles,3],[L.applicationConstants,26]];
    for(const[i,row]of cases.entries()){
      const expectedStatus=row.invalid?3:row.obstructed?4:1;assert.equal(results[i],expectedStatus,row.name+' status');assert.equal(actual[row.base+2],expectedStatus,row.name+' sticky status');assert.equal(actual[row.base-1],GUARD);assert.equal(actual[row.end],GUARD);const sb=i*(bundle.scratchWords+2)+1;assert.equal(actualScratch[sb-1],GUARD);assert.equal(actualScratch[sb+bundle.scratchWords],GUARD);
      if(row.expected){for(const[offset,length]of ranges)assert.deepEqual(actual.slice(row.base+offset,row.base+offset+length),row.expected.state.slice(offset,offset+length),row.name+' semantic words'+offset);assert.deepEqual(actual.slice(row.ballBase+fx.seed.selectedIndex*64,row.ballBase+(fx.seed.selectedIndex+1)*64),row.expected.ball,row.name+' selected body');}
    }
    t.diagnostic(JSON.stringify({gate:'resident-cue-orchestration',rows:cases.length,sourceNumber:true,deviceOwnedApplicationAndJoint:true,initialNumericReceipt:true,wholeWorld:false,adapterInfo:owner.adapterInfo}));
  }finally{owner.release();}
});
