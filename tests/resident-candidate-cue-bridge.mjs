import{test}from'node:test';import assert from'node:assert/strict';
import{originalRegisteredFixture}from'./resident-candidate-original-fixture.mjs';
import{createCueProgramBundle,packCueInitialState,executeCueForTest}from'../src/resident-candidate/cue-orchestration.mjs';
import{writeCueBridgeInitialState,cueBridgeTestKernels,createCueCcdPrograms,generateCueCanonicalBridgeWGSL,generateCueInactiveCcdWGSL}from'../src/resident-candidate/cue-bridge.mjs';
import{COUPLED_BODY_OFFSETS as O}from'../src/resident-candidate/coupled-solver.mjs';
import Checker from'../src/experimental-ccd-inactive.js';
import{executeLowered}from'../src/resident-candidate/numeric-program.mjs';
const B=createCueProgramBundle(),CCD=createCueCcdPrograms(),F=Math.fround;
function packBody(s){const a=new Uint32Array(64),f=new Float32Array(a.buffer);for(const[k,i]of Object.entries(O))if(s[k]!==undefined)f.set(Array.isArray(s[k])?s[k]:[+s[k]],i);return a;}
const read=(s,at,n)=>Array.from(new Float32Array(s.buffer,s.byteOffset,s.length).slice(at,at+n));
async function fixture(){const{seed}=await originalRegisteredFixture();const cue=writeCueBridgeInitialState(packCueInitialState(seed.cueInitial,B),seed.cueInitial),bodies=seed.balls.map(x=>packBody(x.state));const cb=7,bb=cb+B.stateWords+11,saved=bb+384+11,state=new Uint32Array(saved+128+7);state.fill(0xfacefeed);state.set(cue,cb);bodies.forEach((x,i)=>state.set(x,bb+i*64));return{seed,cue,bodies,cb,bb,saved,state,k:cueBridgeTestKernels(state)};}
function checkerInput(state,cue,current,next){return{kind:'dynamic-body-ccd-check',bodyType:'dynamic',sleeping:false,softFrame:false,ccdEnabled:true,maxCcdSubsteps:4,softCcdPrediction:0,linear:read(state,current,3),angular:read(state,current+3,3),translation:read(state,current+6,3),rotation:read(state,current+9,4),force:read(state,current+47,3),torque:read(state,current+38,3),invMass:read(state,current+13,3),invInertia:read(state,current+16,9),localCom:read(state,current+56,3),maxExtent:read(state,current+62,1)[0],ccdThickness:read(state,current+63,1)[0],dt:read(state,cue+195,1)[0],...(next===undefined?{}:{nextTranslation:read(state,next+6,3),nextRotation:read(state,next+9,4)})};}
function compareChecker(input,post){const e=post?CCD.post:CCD.pre,raw=executeLowered(e.compiled,Checker.pack(input),{testOnly:true}),expected=post?Checker.postReference(input):Checker.preReference(input);for(const[k,l]of Object.entries(e.plan.layout)){const values=Array.from(raw.slice(l.offset,l.offset+l.length)),want=Array.isArray(expected[k])?expected[k]:[+expected[k]];assert.deepEqual(new Uint32Array(Float32Array.from(values).buffer),new Uint32Array(Float32Array.from(want).buffer),k);}return expected;}
test('cue canonical bridge preserves exact original words and initial/user-change extent boundary',async()=>{
 const f=await fixture(),before=f.state.slice();assert.equal(f.k.rc_cue_to_canonical(f.cb,f.bb),1);
 for(const[role,i]of[['shaft',0],['head',1]]){const at=f.bb+(4+i)*64,q=f.seed.cueInitial.cue[role];assert.deepEqual(read(f.state,at,13),[...q.linear,...q.angular,...q.translation,...q.rotation]);assert.deepEqual(read(f.state,at+56,3),q.localCom);assert.deepEqual(read(f.state,at+59,3),q.worldCom);assert.equal(read(f.state,at+62,1)[0],0);assert.equal(read(f.state,at+63,1)[0],f.seed.cueInitial.ccd[role].ccdThickness);assert.deepEqual(read(f.state,at+25,3),[0,0,0]);assert.equal(f.state[at+46],0);}
 assert.deepEqual(f.state.slice(f.bb,f.bb+256),before.slice(f.bb,f.bb+256),'all four ball words untouched');
 const app=executeCueForTest(B,f.cue,{ball:f.bodies[f.seed.selectedIndex],others:f.bodies.filter((_,i)=>i!==f.seed.selectedIndex),testOnly:true});f.state.set(app.state,f.cb);assert.equal(f.k.rc_cue_to_canonical(f.cb,f.bb),1);
 for(let role=0;role<2;role++){const at=f.bb+(4+role)*64;assert.deepEqual(read(f.state,at+62,2),read(f.state,f.cb+494+role*30+12,2));assert.ok(read(f.state,at+62,1)[0]>0);}
 assert.equal(f.state[f.cb-1],0xfacefeed);assert.equal(f.state[f.bb+384],0xfacefeed);
});
test('cue CCD source checker uses saved pre-solve source state and independently solved next pose',async()=>{
 const f=await fixture(),others=f.bodies.filter((_,i)=>i!==f.seed.selectedIndex),app=executeCueForTest(B,f.cue,{ball:f.bodies[f.seed.selectedIndex],others,testOnly:true});f.state.set(app.state,f.cb);f.k.rc_cue_to_canonical(f.cb,f.bb);
 for(let role=0;role<2;role++)assert.equal(compareChecker(checkerInput(f.state,f.cb,f.bb+(4+role)*64),false).admitted,true);
 assert.equal(f.k.rc_cue_capture_pre_solve(f.cb,f.bb,f.saved),1);const solve=executeCueForTest(B,app.state,{ball:app.ball,others,mode:1,testOnly:true});f.state.set(solve.state,f.cb);f.state[f.cb+60]=1;f.state[f.cb+61]=solve.state[7];f.k.rc_cue_to_canonical(f.cb,f.bb);
 for(let role=0;role<2;role++)assert.equal(compareChecker(checkerInput(f.state,f.cb,f.saved+role*64,f.bb+(4+role)*64),true).admitted,true);
 const before=f.state.slice(f.cb+64,f.cb+64+184);assert.equal(f.k.rc_cue_adopt_canonical_pose(f.cb,f.bb),1);assert.deepEqual(f.state.slice(f.cb+64,f.cb+64+184),before);
 const active=checkerInput(f.state,f.cb,f.bb+256);active.linear[0]=F(1000);assert.equal(compareChecker(active,false).status,'unsupported-active-ccd');
 assert.match(generateCueInactiveCcdWGSL(),/rc_cue_bridge_fail\(cue,14u\)/);assert.doesNotMatch(generateCueCanonicalBridgeWGSL(),/rc_num_eval|bitcast<f32>|sqrt|rc_f64/);
});

test('actual native cue canonical bridge and separate inactive CCD reject active domains',
 {skip:process.env.REQUIRE_WEBGPU!=='1'},async t=>{
  const{createNativeOwner,dispatchWords}=await import('./resident-candidate-gpu-support.mjs'),f=await fixture();
  const others=f.bodies.filter((_,i)=>i!==f.seed.selectedIndex),app=executeCueForTest(B,f.cue,{ball:f.bodies[f.seed.selectedIndex],others,testOnly:true});f.state.set(app.state,f.cb);f.k.rc_cue_to_canonical(f.cb,f.bb);f.k.rc_cue_capture_pre_solve(f.cb,f.bb,f.saved);
  const pre=f.state.slice(),solve=executeCueForTest(B,pre.slice(f.cb,f.cb+B.stateWords),{ball:app.ball,others,mode:1,testOnly:true});f.state.set(solve.state,f.cb);f.k.rc_cue_to_canonical(f.cb,f.bb);const post=f.state.slice();
  const cases=[{name:'shaft pre',post:false,role:0},{name:'head pre',post:false,role:1},{name:'shaft post',post:true,role:0},{name:'head post',post:true,role:1},{name:'active cue rejected',post:false,role:0,active:true},{name:'unsupported cue angle',post:true,role:0,angle:true}];
  const stride=pre.length,state=new Uint32Array(stride*cases.length),scratch=new Uint32Array((CCD.scratchWords+2)*cases.length),jobs=[],GUARD=0xfacefeed;
  for(const[i,row]of cases.entries()){
    row.state=(row.post?post:pre).slice();const a=new Float32Array(row.state.buffer),q=f.cb+64+row.role*48;
    if(row.active)a[q]=1000;if(row.angle)a.set([0,0,1,0],q+9);cueBridgeTestKernels(row.state).rc_cue_to_canonical(f.cb,f.bb);
    row.entry=row.post?CCD.post:CCD.pre;const input=checkerInput(row.state,f.cb,row.post?f.saved+row.role*64:f.bb+(4+row.role)*64,row.post?f.bb+(4+row.role)*64:undefined),expected=row.post?Checker.postReference(input):Checker.preReference(input);
    row.expected=executeLowered(row.entry.compiled,Checker.pack(input),{testOnly:true});row.status=expected.admitted?1:4;row.reason=!expected.supported?13:expected.active?14:0;row.base=i*stride;state.set(row.state,row.base);
    const sb=i*(CCD.scratchWords+2)+1;row.scratch=sb;scratch[sb-1]=GUARD;scratch[sb+CCD.scratchWords]=GUARD;jobs.push(row.base+f.cb,row.base+f.bb,row.base+f.saved,row.entry.base,sb,row.role,+row.post);
  }
  const code=`
@group(0) @binding(0) var<storage,read> rc_program:array<u32>;
@group(0) @binding(1) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(2) var<storage,read_write> rc_scratch:array<u32>;
@group(0) @binding(3) var<storage,read> rc_jobs:array<u32>;
@group(0) @binding(4) var<storage,read_write> rc_results:array<u32>;
${generateCueInactiveCcdWGSL()}
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){let row=id.x;if(row>=arrayLength(&rc_jobs)/7u){return;}let j=row*7u;let cue=rc_jobs[j];let bodies=rc_jobs[j+1u];let status=rc_cue_to_canonical(cue,bodies);if(status!=1u){rc_results[row]=status;return;}rc_results[row]=rc_cue_inactive_ccd(cue,bodies,rc_jobs[j+2u],rc_jobs[j+3u],rc_jobs[j+4u],rc_jobs[j+5u],rc_jobs[j+6u]!=0u);}
`;
  const owner=await createNativeOwner('resident-cue-canonical-inactive-ccd');
  try{
    const[,actual,work,,statuses]=await dispatchWords(owner,{code,buffers:[{input:CCD.program},{input:state,readback:true},{input:scratch,readback:true},{input:Uint32Array.from(jobs)},{words:cases.length,readback:true}],label:'source-cue-canonical-and-inactive-ccd'});
    for(const[i,row]of cases.entries()){
      assert.equal(statuses[i],row.status,row.name);if(row.reason)assert.equal(actual[row.base+f.cb+3],row.reason,row.name+' explicit reason');assert.deepEqual(actual.slice(row.base+f.bb,row.base+f.bb+384),row.state.slice(f.bb,f.bb+384),row.name+' exact canonical bank');
      assert.equal(work[row.scratch-1],GUARD);assert.equal(work[row.scratch+CCD.scratchWords],GUARD);const output=Uint32Array.from(row.entry.compiled.outputSlots,x=>work[row.scratch+x]);assert.deepEqual(output,new Uint32Array(row.expected.buffer),row.name+' unchanged source checker output bits');
    }
    t.diagnostic(JSON.stringify({gate:'cue-canonical-and-inactive-ccd',rows:cases.length,activeCueSweeps:false,sourceBits:true,adapterInfo:owner.adapterInfo,wholeWorld:false}));
  }finally{owner.release();}
});
