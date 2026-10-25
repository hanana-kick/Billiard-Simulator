import test from 'node:test';
import assert from 'node:assert/strict';
import {createCcdPrograms,generateCcdWGSL,CCD_LAYOUT} from '../src/resident-candidate/ccd.mjs';
import {CCD_FLAT_LAYOUT,generateCcdFlatWGSL,generateCcdFlatDriverWGSL,planCcdFlatDispatches} from '../src/resident-candidate/ccd-flat.mjs';
import {beginNumericContinuationForTest,advanceNumericContinuationForTest} from '../src/resident-candidate/numeric-continuation.mjs';
import {generateWorldCcdWGSL} from '../src/resident-candidate/world-ccd.mjs';
import {executeLowered} from '../src/resident-candidate/numeric-program.mjs';
import Schedule from '../src/experimental-ccd-substep.js';
import MathStage from '../src/experimental-ccd-sweep-math.js';
import Checker from '../src/experimental-ccd-inactive.js';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),captured=require('./fixtures/active-ccd/original-e35-prediction.json');
const programs=createCcdPrograms({pointCounts:[8,22]}),word=new Uint32Array(1),float=new Float32Array(word.buffer),bits=x=>(float[0]=x,word[0]),number=x=>(word[0]=x,float[0]);
const control=1280,guard=0xfacefeed;
function functionCode(source,name){const start=source.indexOf('fn '+name+'(');assert.ok(start>=0,name);const open=source.indexOf('{',start);let depth=1,end=open+1;for(;depth;end++){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;}return source.slice(start,end);}
// TEST ONLY: actual new integer driver and original non-geometric pre control.
// Numeric substitution is the independently tested one-instruction oracle.
// No missing geometry function is mocked: an unexpected call throws. Native
// gates below are the only active sweep/body-control evidence for the flat path.
function scheduleMachine({mode='pre',dt=Math.fround(1/960),steps=4,minDt=0,fraction=null,worldTemplate,postClamp}={}){
 const b=worldTemplate?.segments.ccd.offset??0,bodies=worldTemplate?.segments.bodies.offset??0,c=worldTemplate?bodies+256:control,adapter=b+1184;
 const state=new Uint32Array(c+17),scratch=new Uint32Array(programs.scratchWords),continuations=new Map();state[c+16]=guard;
 state[b+1]=mode==='pre'?1:2;state[b+3]=steps;state[b+4]=bits(dt);state[b+5]=bits(dt);state[b+7]=bits(minDt);state[b+14]=mode==='pre'?(fraction===null?3:2):0;state[b+13]=mode==='post'?1:0;
 if(fraction===null){state.set([bits(dt),bits(steps),0,0,bits(minDt)],b+448);}else{state[b+501]=bits(fraction);state[b+502]=bits(dt);}
 if(worldTemplate){state[10]=bits(dt);state[adapter]=mode==='pre'?1:4;state[adapter+6]=7;state[adapter+7]=11;state[adapter+2]=15;state[adapter+3]=23;state[adapter+4]=31;state[adapter+5]=37;state[adapter+16]=3;}
 if(postClamp){
  assert.equal(mode,'post');state[b+13]=0;state[b+14]=4;state[adapter]=3;
  state.set([7,programs.entries.inertia.id,b+448,0,1,0,0,b+32,b+352],b+976);
  state[b+354]=1;state.set(postClamp.pose.map(bits),b+356);state.set(postClamp.inputs.map(bits),b+448);
  for(let i=1;i<4;i++)state[b+32+i*80+71]=1;
  // Canonical data intentionally differ, so the exact source clamp writes
  // (and absence of velocity/force writes) are observable at this boundary.
  for(let i=0;i<256;i++)state[bodies+i]=bits(i+.25);
 }
 const source=generateCcdWGSL(programs),functions=['rc_ccd_fail','rc_ccd_f','rc_ccd_put','rc_ccd_copy','rc_ccd_select_pass_prepare','rc_ccd_select_pass_finish','rc_ccd_pre_next','rc_ccd_pre_control','rc_ccd_pre_numeric_request'];
 if(postClamp)functions.push('rc_ccd_body_numeric_request','rc_ccd_body_control','rc_ccd_body_step','rc_ccd_post_next','rc_ccd_post_control');
 const begin=(pb,sb,base)=>{let q;try{q=beginNumericContinuationForTest(programs.program,new Float32Array(scratch.buffer,sb*4,programs.program[pb+3]),{testOnly:true,programBase:pb});}catch(error){return error.numericStatus??2;}if(q.status!==0)return q.status;continuations.set(base,q);state.set([0x52434e43,pb,sb,0,q.initialized,0,0,0],base);return 0;};
 const instruction=base=>{const q=continuations.get(base);if(!q)return 2;const status=advanceNumericContinuationForTest(q,{testOnly:true});scratch.set(q.words,state[base+2]);state[base+3]=q.instruction;state[base+4]=q.initialized;state[base+5]=status;return status;};
 const evaluate=(pb,sb)=>{const e=Object.values(programs.entries).find(e=>e.base===pb);try{const out=executeLowered(e.compiled,new Float32Array(scratch.buffer,sb*4,e.compiled.inputCount),{testOnly:true}),words=new Uint32Array(out.buffer);for(let i=0;i<words.length;i++)scratch[sb+e.compiled.outputSlots[i]]=words[i];return 1;}catch(error){return error.numericStatus??2;}};
 let code=functions.map(n=>functionCode(source,n)).join('\n');
 if(worldTemplate){const world=generateWorldCcdWGSL(worldTemplate,programs);code+='\n'+['rc_world_ccd_adapter','rc_world_ccd_pre_control','rc_world_ccd_post_control','rc_world_ccd_apply_clamps','rc_world_ccd_evaluate'].map(n=>functionCode(world,n)).join('\n')+'\n'+functionCode(source,'rc_ccd_eval');}
 code+=generateCcdFlatDriverWGSL(programs,{mode,worldTemplate});
 code=code.replace(/fn (\w+)\(([^)]*)\)(?:->(?:u32|bool|f32|vec2<u32>))?\s*\{/g,(_,n,args)=>`function ${n}(${args.replace(/:(?:u32|bool|f32)/g,'')}){`).replace(/:(?:u32|bool|f32)(?=\s*=)/g,'').replace(/\b(0x[0-9a-f]+|\d+)u\b/g,'$1').replace(/\bvar\b/g,'let').replace(/\bloop\s*\{/g,'while(true){').replace(/\bswitch\s+([^{}]+?)\s*\{/g,'switch($1){').replace(/}\s*(?=case\b|default\s*:)/g,'break;}').replace(/arrayLength\(&([a-z_]+)\)/g,'$1.length').replace(/bitcast<f32>\(/g,'number(').replace(/bitcast<u32>\(/g,'bits(').replace(/\bf32\(/g,'Math.fround(').replace(/\bu32\(/g,'Math.trunc(').replace(/vec2<u32>\(/g,'vec2(');
 const exports='begin:rc_ccd_flat_begin,advance:rc_ccd_flat_advance'+(worldTemplate?',finish:rc_ccd_flat_finish,staged:()=>{rc_world_ccd_evaluate('+b+',0,0);'+(mode==='pre'?'rc_world_ccd_pre_control(0,'+b+',0,0)':'rc_world_ccd_post_control('+b+','+bodies+',0,0)')+';}':'');
 const kernels=new Function('rc_state','rc_program','rc_scratch','rc_num_cont_begin','rc_num_cont_instruction','rc_num_eval','number','bits','vec2',code+'\nreturn {'+exports+'};')(state,programs.program,scratch,begin,instruction,evaluate,number,bits,(x,y)=>({x,y}));
 return {state,scratch,b,control:c,bodies,adapter,begin:()=>kernels.begin(b,c),advance:budget=>kernels.advance(b,c,0,0,budget),finish:()=>kernels.finish(b,c),staged:kernels.staged};
}

test('flat CCD source trees keep numeric instructions and original pre/post order without whole-graph loops',()=>{
 const p=planCcdFlatDispatches(programs);assert.equal(p.sourceJobCapacity,4096);assert.equal(p.maximumProgramInstructions,932);assert.equal(p.maximumProgramMicroOps,959);assert.equal(p.dispatches,120);assert.equal(p.controlWords,16);
 for(const mode of ['pre','post']){const code=generateCcdFlatWGSL(programs,{mode});assert.doesNotMatch(code,/fn rc_num_eval\(|fn rc_ccd_eval\(|fn rc_ccd_pd_proxyDistance\(|for\(var i=0u;i<nodes|rc_ccd_flat_link_root/);assert.match(code,/rc_num_cont_instruction\(control\)/);assert.match(code,new RegExp('fn rc_ccd_'+mode+'_control\\('));assert.doesNotMatch(code,new RegExp('fn rc_ccd_'+(mode==='pre'?'post':'pre')+'_control\\('));assert.match(code,/rc_state\[control\+10u\]>=4096u/);assert.match(code,/rc_state\[control\+13u\]\+\+/);}
 assert.equal(CCD_FLAT_LAYOUT.nativeQualified,false);assert.equal(CCD_FLAT_LAYOUT.defaultBackend,false);assert.throws(()=>planCcdFlatDispatches(programs,{instructionBudget:0}),/budget/);assert.throws(()=>generateCcdFlatWGSL(programs,{mode:'both'}),/separate/);
});

test('actual flat driver and original control preserve schedule, remaining time and eager source jobs across chunks',()=>{
 for(const dt of [Math.fround(1/960),Math.fround(1/61440)])for(const steps of[1,2,4])for(const fraction of[null,Math.fround(.1),Math.fround(.9)]){
  if(steps===1&&fraction!==null)continue;
  for(const budget of[1,7,32768]){const minDt=Math.fround(1/6000),m=scheduleMachine({dt,steps,minDt,fraction});assert.equal(m.begin(),0);let status=0,dispatches=0;while(status===0){status=m.advance(budget);assert.ok(++dispatches<1000);}assert.equal(status,1);assert.equal(m.state[0],0);assert.equal(m.state[1],2);assert.equal(m.state[14],0);assert.equal(m.state[control+10],fraction===null?1:2);assert.equal(m.state[control+16],guard);
   const firstImpact=fraction===null?null:MathStage.reference('multiply',{a:fraction,b:dt}).value,wanted=Schedule.reference({remainingTime:dt,remainingSubsteps:steps,minCcdDt:minDt,firstImpact});assert.deepEqual([number(m.state[6]),number(m.state[11]),m.state[12]],[wanted.dt,wanted.remainingTime,wanted.remainingSubsteps]);const saved=m.state.slice();assert.equal(m.advance(budget),1);assert.deepEqual(m.state,saved,'completed owner is idempotent');}
 }
 const short=scheduleMachine();short.begin();assert.equal(short.advance(1),0);assert.equal(short.state[control+11],4,'paused after one original input copy');assert.equal(short.state[control+12],1);assert.equal(short.advance(programs.entries.schedule.compiled.inputCount),0);assert.equal(short.state[control+3],1);assert.equal(short.state[control+11],1,'paused inside the original graph');
 const post=scheduleMachine({mode:'post'});assert.equal(post.begin(),1);assert.equal(post.advance(1),1);assert.equal(post.state[control+10],0,'zero awake post bodies complete without fabricated math jobs');
});

test('flat source transport capacity and corrupted numeric data fail closed, never complete or miss',()=>{
 const cap=scheduleMachine();cap.begin();cap.state[control+10]=4096;assert.equal(cap.advance(32768),2);assert.equal(cap.state[0],5);
 const invalid=scheduleMachine();invalid.begin();invalid.state[448]=0x7f800000;assert.equal(invalid.advance(32768),2);assert.equal(invalid.state[0],1);
 const budget=scheduleMachine();budget.begin();assert.equal(budget.advance(0),2);assert.equal(budget.state[0],3);
 const ownership=scheduleMachine();ownership.begin();ownership.state[control+8]=4;assert.equal(ownership.advance(1),2);assert.equal(ownership.state[0],4);
 const offset=programs.entries.schedule.base,old=programs.program[offset+3];try{const shape=scheduleMachine();shape.begin();programs.program[offset+3]=999;assert.equal(shape.advance(1),2);assert.equal(shape.state[0],3);}finally{programs.program[offset+3]=old;}
});

test('full original current-body pre/post checker graphs retain exact arithmetic with one-instruction pauses',()=>{
 const q=captured,m=q.massProperties,ii=m.effective_world_inv_inertia,input={kind:'dynamic-body-ccd-check',bodyType:'dynamic',sleeping:false,softFrame:false,ccdEnabled:true,maxCcdSubsteps:4,softCcdPrediction:0,linear:q.velocities.linvel,angular:q.velocities.angvel,translation:q.position.translation,rotation:q.position.rotation,force:q.forces.force,torque:q.forces.torque,invMass:m.effective_inv_mass,invInertia:[ii.m11,ii.m12,ii.m13,ii.m12,ii.m22,ii.m23,ii.m13,ii.m23,ii.m33],localCom:m.local_mprops.local_com,dt:q.nativeDt,maxExtent:m.max_extent,ccdThickness:q.ccd.ccd_thickness};
 const prediction=MathStage.reference('predictSphereCenter',{dt:Math.fround(input.dt*2),localCenter:input.localCom,translation:input.translation,linear:input.linear,force:input.force,invMass:input.invMass});
 for(const mode of['pre','post']){const value=mode==='post'?{...input,nextTranslation:prediction.c2,nextRotation:input.rotation}:input,compiled=programs.entries[mode].compiled,packed=Checker.pack(value),expected=executeLowered(compiled,packed,{testOnly:true});for(const budget of[1,17,32768]){const c=beginNumericContinuationForTest(compiled,packed,{testOnly:true});while(c.status===0)advanceNumericContinuationForTest(c,{testOnly:true,instructions:budget});assert.equal(c.status,1);assert.deepEqual(new Uint32Array(c.output.buffer),new Uint32Array(expected.buffer));}}
});

test('registered flat fixture retains the original four-ball roster, active fractions and non-isotropic clamp',async()=>{
 const {registeredCcdFlatFixture}=await import('./resident-candidate-ccd-flat-fixture.mjs'),f=await registeredCcdFlatFixture();
 assert.equal(f.expected.pre.fraction,0.4004574120044708);assert.equal(f.expected.post.fraction,0.20029640197753906);assert.equal(f.expected.inertia[5],0.00048828125);assert.equal(f.expected.inertia[7],0.00048828125);assert.deepEqual(f.programs.pointCounts,[8,22]);assert.equal(f.state[f.controlAt+15],0);
});

test('actual native flat registered CCD retains original BVH lifecycle, active pre selection and full post clamp',{
 skip:process.env.RUN_RESIDENT_CCD_FLAT_GPU!=='1',timeout:240000
},async t=>{
 const {registeredCcdFlatFixture}=await import('./resident-candidate-ccd-flat-fixture.mjs'),f=await registeredCcdFlatFixture();
 const {createNativeOwner,dispatchWordStages}=await import('./resident-candidate-gpu-support.mjs');
 const {generateNumericLibraryWGSL}=await import('../src/resident-candidate/numeric-program.mjs');
 const {generateBvhWGSL,unpackBvhState,BVH_LAYOUT}=await import('../src/resident-candidate/bvh.mjs');
 const {pruneCcdWGSL}=await import('../src/resident-candidate/ccd.mjs');
 const prefix=`@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(1) var<storage,read> rc_program:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;\n`;
 const source=generateNumericLibraryWGSL()+generateBvhWGSL()+generateCcdWGSL(f.programs);
 const initialize=pruneCcdWGSL(prefix+source+`@compute @workgroup_size(1) fn main(){if(rc_state[0u]!=0u||rc_state[960u]!=0u){return;}let bvh=${f.bvhAt}u;let cursor=rc_state[962u];if(cursor<2u){if(cursor==0u&&rc_bvh_set_scratch(bvh,${f.scratchAt}u)!=0u){return;}let command=${f.initCommandsAt}u+cursor*9u;if(rc_bvh_prepare_update(bvh,rc_state[command],rc_state[command+1u],rc_state[command+2u],rc_state[command+3u],rc_state[command+4u],rc_state[command+5u],rc_state[command+6u],rc_state[command+7u],rc_state[command+8u])!=0u){return;}rc_bvh_join(bvh);rc_state[962u]++;return;}if(cursor!=2u){rc_ccd_fail(0u,4u);return;}rc_ccd_begin(0u,bitcast<f32>(${f.dtWord}u),bitcast<f32>(${f.minDtWord}u));rc_ccd_pre_begin(0u,${f.seedAt}u,bvh,${f.activeAt}u,1u);rc_state[962u]=3u;rc_state[960u]=1u;}`);
 const pre=prefix+generateCcdFlatWGSL(f.programs,{mode:'pre'})+`@compute @workgroup_size(1) fn main(){if(rc_state[0u]!=0u||rc_state[960u]!=1u){return;}let c=${f.controlAt}u;if(rc_state[c+15u]==0u){rc_ccd_flat_begin(0u,c);}let status=rc_ccd_flat_advance(0u,c,0u,0u,rc_state[${f.budgetAt}u]);if(status==1u){rc_ccd_copy(820u,352u,24u);rc_ccd_copy(448u,32u,64u);rc_state[484u]=${f.predictionDtWord}u;rc_state[960u]=3u;rc_state[963u]=rc_state[c+10u];rc_state[964u]=rc_state[c+13u];}}`;
 const predict=pruneCcdWGSL(prefix+source+`@compute @workgroup_size(1) fn main(){if(rc_state[0u]!=0u||rc_state[960u]!=3u){return;}if(!rc_ccd_eval(0u,448u,${f.programs.entries.predict.id}u,0u,0u)){return;}rc_ccd_copy(69u,707u,3u);rc_ccd_copy(72u,41u,4u);rc_ccd_post_begin(0u,${f.seedAt}u,${f.bvhAt}u);rc_state[${f.controlAt+15}u]=0u;rc_state[960u]=4u;}`);
 const post=prefix+generateCcdFlatWGSL(f.programs,{mode:'post'})+`@compute @workgroup_size(1) fn main(){if(rc_state[0u]!=0u||rc_state[960u]!=4u){return;}let c=${f.controlAt}u;if(rc_state[c+15u]==0u){rc_ccd_flat_begin(0u,c);}let status=rc_ccd_flat_advance(0u,c,0u,0u,rc_state[${f.budgetAt}u]);if(status==1u){rc_state[960u]=5u;rc_state[965u]=rc_state[c+10u];rc_state[966u]=rc_state[c+13u];}}`;
 const plan=planCcdFlatDispatches(f.programs),stages=[{code:initialize,repeat:3},{code:pre,repeat:plan.dispatches},{code:predict},{code:post,repeat:plan.dispatches}];
 const owner=await createNativeOwner('flat-registered-four-ball-ccd');try{
  const [actual]=await dispatchWordStages(owner,{stages,bindingTypes:['storage','read-only-storage','storage'],buffers:[{input:f.state,readback:true},{input:f.programs.program},{words:f.programs.scratchWords}],label:'flat-registered-four-ball-ccd'});
  assert.equal(actual[0],0,'source CCD error');assert.equal(actual[960],5,'unfinished numeric chunk is not a clear/miss');assert.equal(actual[f.bvhAt+18],0);assert.deepEqual(unpackBvhState(actual.slice(f.bvhAt,f.bvhAt+BVH_LAYOUT.words)),f.expected.bvh);const floats=new Float32Array(actual.buffer),e=f.expected;
  assert.equal(floats[820],e.pre.fraction);assert.equal(floats[352],e.post.fraction);assert.equal(actual[354],1);assert.deepEqual(Array.from(floats.slice(356,363)),[...e.post.clampedPose.translation,...e.post.clampedPose.rotation]);assert.deepEqual(Array.from(floats.slice(363,372)),e.inertia);
  assert.equal(floats[9],e.impact);assert.equal(floats[6],e.schedule.dt);assert.equal(floats[11],e.schedule.remainingTime);assert.equal(actual[12],e.schedule.remainingSubsteps);assert.equal(floats[5],e.dt);assert.equal(actual[1],2);
  assert.ok(actual[963]>0&&actual[963]<=4096);assert.ok(actual[965]>0&&actual[965]<=4096);
  t.diagnostic(JSON.stringify({scope:'flat-original-four-ball-current-active-component-not-full-h',dispatches:2*plan.dispatches+4,instructionBudget:plan.instructionBudget,preJobs:actual[963],postJobs:actual[965],preInstructions:actual[964],postInstructions:actual[966],sourceJobCapacity:4096,intermediateReadbacks:0,futureEndpointsUploaded:false,hardwarePerformance:false,adapter:owner.adapterInfo}));
 }finally{owner.release();}
});

const worldTransportTemplate={kind:'resident-created-world-layout',segments:{ccd:{offset:64},bodies:{offset:1344}},bindings:Array.from({length:4},(_,i)=>({body:{index:16+i,generation:0},sceneSlot:i}))};
test('world-specialized flat pre matches every original adapter word and selected dt with nonzero prior counts',()=>{
 for(const fraction of[null,Math.fround(.1)])for(const budget of[1,17,32768]){
  const options={worldTemplate:worldTransportTemplate,fraction,minDt:Math.fround(1/6000)},actual=scheduleMachine(options),staged=scheduleMachine(options);assert.equal(actual.begin(),0);assert.equal(actual.state[actual.control+14],7);
  let status=0,jobs=0;while(status===0){status=actual.advance(budget);while(jobs<actual.state[actual.control+10]){staged.staged();jobs++;}if(jobs&&[0,2].includes(actual.state[actual.control+11]))assert.deepEqual(actual.state.slice(0,actual.control),staged.state.slice(0,staged.control),'same source state at each completed-job boundary');}
  assert.equal(status,1);assert.equal(actual.finish(),1);assert.equal(actual.state[actual.adapter],2);assert.equal(actual.state[actual.adapter+1],0);assert.equal(actual.state[actual.adapter+6],7+(fraction===null?1:2));assert.equal(actual.state[10],actual.state[actual.b+6]);assert.deepEqual(actual.state.slice(actual.adapter,actual.adapter+96),staged.state.slice(staged.adapter,staged.adapter+96));
  const code=generateCcdFlatWGSL(programs,{mode:'pre',worldTemplate:worldTransportTemplate});assert.match(code,/fn rc_world_ccd_pre_control\(/);assert.doesNotMatch(code,/fn rc_world_ccd_post_control\(|fn rc_num_eval\(/);assert.match(code,/fn rc_ccd_flat_finish\(/);
 }
});
test('world-specialized flat post preserves exact canonical clamp and count, including immediate all-sleeping completion',async()=>{
 const {registeredCcdFlatFixture}=await import('./resident-candidate-ccd-flat-fixture.mjs'),f=await registeredCcdFlatFixture(),pose=f.expected.post.clampedPose,m=captured.massProperties.local_mprops;
 const postClamp={pose:[...pose.translation,...pose.rotation],inputs:[...pose.rotation,...m.principal_inertia_local_frame,...m.inv_principal_inertia]};
 for(const budget of[1,17,32768]){const options={mode:'post',worldTemplate:worldTransportTemplate,postClamp},actual=scheduleMachine(options),staged=scheduleMachine(options),before=actual.state.slice(actual.bodies,actual.bodies+256);assert.equal(actual.begin(),0);assert.equal(actual.state[actual.control+14],11);let status=0;while(status===0)status=actual.advance(budget);staged.staged();assert.equal(status,1);assert.equal(actual.finish(),1);assert.deepEqual(actual.state.slice(0,actual.control),staged.state.slice(0,staged.control));assert.equal(actual.state[actual.adapter],4);assert.equal(actual.state[actual.adapter+1],0);assert.equal(actual.state[actual.adapter+7],12);assert.equal(actual.state[actual.adapter+8],1);
  assert.deepEqual(Array.from(actual.state.slice(actual.bodies+6,actual.bodies+13),number),postClamp.pose);assert.deepEqual(Array.from(actual.state.slice(actual.bodies+16,actual.bodies+25),number),f.expected.inertia);assert.deepEqual(actual.state.slice(actual.bodies,actual.bodies+6),before.slice(0,6),'clamp never changes velocities');assert.deepEqual(actual.state.slice(actual.bodies+47,actual.bodies+50),before.slice(47,50),'clamp never replaces current force');
 }
 const immediate=scheduleMachine({mode:'post',worldTemplate:worldTransportTemplate}),before=immediate.state.slice(0,immediate.control);assert.equal(immediate.begin(),1);assert.equal(immediate.advance(1),1);assert.equal(immediate.finish(),1);assert.equal(immediate.state[immediate.control+10],0);assert.deepEqual(immediate.state.slice(0,immediate.control),before,'original all-sleeping post_begin receipt unchanged');
 const code=generateCcdFlatWGSL(programs,{mode:'post',worldTemplate:worldTransportTemplate});assert.match(code,/fn rc_world_ccd_post_control\(/);assert.match(code,/fn rc_world_ccd_apply_clamps\(/);assert.doesNotMatch(code,/fn rc_world_ccd_pre_control\(|fn rc_num_eval\(/);
});
test('world flat finish cannot authorize unfinished, stale-count or wrong-ready source receipts',()=>{
 const pending=scheduleMachine({worldTemplate:worldTransportTemplate});pending.begin();pending.advance(1);assert.equal(pending.finish(),0);
 for(const slot of[1,6]){const m=scheduleMachine({worldTemplate:worldTransportTemplate});m.begin();m.state[m.adapter+slot]++;assert.equal(m.advance(32768),2);assert.equal(m.state[m.b],4);}
 const late=scheduleMachine({worldTemplate:worldTransportTemplate});late.begin();assert.equal(late.advance(32768),1);late.state[late.adapter+6]++;assert.equal(late.finish(),2);assert.equal(late.state[late.b],4);
});
