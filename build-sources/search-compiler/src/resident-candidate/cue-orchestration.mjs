import {generateProfiledNumericWGSL,NUMERIC_PROFILE} from './numeric-profile.mjs';
/* SPDX-License-Identifier: Apache-2.0
 * Resident source-created cue owner. Arithmetic programs are immutable, per-
 * candidate body/tangent/clock/impulse state is mutable device storage. The
 * external world transaction owns scene registration, geometry, CCD and commit.
 */
import {CUE_LAYOUT as L,compileCueLateralProgram,compileCueTipProgram} from './cue.mjs';
import {compileGraph,executeLowered} from './numeric-program.mjs';
import {SourceNumberProgramBuilder,compileSourceNumberProgram,executeSourceNumberProgramReference,generateRawStrikeProgramWGSL} from './raw-strike.mjs';
import {numberWords,wordsNumber} from './source-number.mjs';
const J=globalThis.LabCueJointStepperExperimental,C=globalThis.LabCueClothJointStepperExperimental,
  Init=globalThis.LabCueInitializationExperimental,Created=globalThis.LabCueCreatedStrokeStageExperimental;
const f=Math.fround,NONE=0xffffffff;
// Private source graphs copied without arithmetic changes from
// experimental-cue-created-stroke-stage.js:16-17 (the original exports stay intact).
function comPlan(){const inputFloats=20,nodes=[],op=(kind,...args)=>{nodes.push({kind,args});return inputFloats+nodes.length-1;},c=x=>op('const',f(x)),two=c(2),add=(a,b)=>op('add',a,b),sub=(a,b)=>op('sub',a,b),mul=(a,b)=>op('mul',a,b),v=(i,n=3)=>Array.from({length:n},(_,j)=>i+j),va=(a,b)=>a.map((x,i)=>add(x,b[i])),vm=(a,s)=>a.map(x=>mul(x,s)),dot=(a,b)=>add(add(mul(a[0],b[0]),mul(a[1],b[1])),mul(a[2],b[2])),cross=(a,b)=>[sub(mul(a[1],b[2]),mul(a[2],b[1])),sub(mul(a[2],b[0]),mul(a[0],b[2])),sub(mul(a[0],b[1]),mul(a[1],b[0]))],outputs=[];for(const base of[0,10]){const q=v(base+3,4),b=q.slice(0,3),a=v(base+7);outputs.push(...va(va(va(vm(a,sub(mul(q[3],q[3]),dot(b,b))),vm(b,mul(dot(a,b),two))),vm(cross(b,a),mul(q[3],two))),v(base)));}return{inputFloats,nodes,outputs};}
function separationPlan(){const inputFloats=10,nodes=[],op=(kind,...args)=>{nodes.push({kind,args});return inputFloats+nodes.length-1;},c=x=>op('const',f(x));let separated=c(0);for(let i=0;i<3;i++){const d=op('sub',i,3+i),abs=op('max',d,op('negate',d));separated=op('max',separated,op('gt',abs,6));}return{inputFloats,nodes,outputs:[separated]};}
function clockProgram(){
  const b=new SourceNumberProgramBuilder(),x=Array.from({length:16},()=>b.alloc()),c=x=>b.c(x),op=(n,a,z)=>b.op(n,a,z),choose=(p,yes,no)=>{const r=b.alloc();b.branch(p,()=>b.set(r,yes()),()=>b.set(r,no()));return r;};
  // time,elapsed,h,peakNormal,maxCompression,normalImpulse,fn,compression,
  // touching,firstValid,firstContact,lastContact,endedValid,ended,remove,birth.
  const time=op('add',x[0],x[2]),elapsed=op('add',x[1],x[2]);
  const peak=choose(x[8],()=>choose(op('lt',x[3],x[6]),()=>x[6],()=>x[3]),()=>x[3]);
  const compression=choose(x[8],()=>choose(op('lt',x[4],x[7]),()=>x[7],()=>x[4]),()=>x[4]);
  const normalImpulse=choose(x[8],()=>op('add',x[5],op('mul',x[6],x[2])),()=>x[5]);
  const first=choose(op('mul',x[15],op('eq',x[9],c(0))),()=>x[0],()=>x[10]);
  const last=choose(x[8],()=>x[0],()=>x[11]),ended=choose(x[14],()=>x[0],()=>x[13]);
  b.emit('halt');return compileSourceNumberProgram(b,{inputs:x,outputs:[time,elapsed,peak,compression,normalImpulse,first,last,ended].map((r,i)=>[i*2,r,0]),outputWords:96,maximumInstructions:256,scope:'original-cue-application-clock-and-stats'});
}
export function createCueProgramBundle(){
  const plans=[separationPlan(),comPlan(),Init.buildPlan(),J.buildPlan(),C.buildPlan()],entries=plans.map(plan=>({plan,compiled:compileGraph(plan)}));
  const numbers=[compileCueLateralProgram(),compileCueTipProgram(),clockProgram()];
  const header=new Uint32Array(36),chunks=[];header.set([0x52434355,1,0,Math.max(...entries.map(x=>x.compiled.scratchWords)),Math.max(...numbers.map(x=>x.registerWords)),Math.max(...numbers.map(x=>x.controlWords)),0,16]);
  let at=header.length;entries.forEach(({compiled},i)=>{header.set([at,compiled.inputCount,compiled.outputCount,compiled.scratchWords],16+i*4);chunks.push(compiled.program);at+=compiled.program.length;});
  numbers.forEach((p,i)=>{header[8+i]=at;chunks.push(p.words);at+=p.words.length;});sourceInputMaps().forEach((rows,i)=>{if(rows.length!==numbers[i].words[10])throw new Error('Exact cue source input map width');header[11+i]=at;const words=Uint32Array.from(rows.flat());chunks.push(words);at+=words.length;});header[2]=at;header[6]=L.sourceRegisters+header[4]+header[5];
  const program=new Uint32Array(at);program.set(header);at=header.length;for(const chunk of chunks){program.set(chunk,at);at+=chunk.length;}
  return Object.freeze({program,entries:Object.freeze(entries),numbers:Object.freeze(numbers),scratchWords:header[3],sourceRegisterWords:header[4],sourceControlWords:header[5],stateWords:header[6]});
}
function initialPack(s){s=Init.validate(s);const a=new Float32Array(40);a.set(s.translation);a.set(s.rotation,3);a.set(s.localCom,7);a[10]=s.localInvMass;a.set(s.invPrincipalInertia,11);a.set(s.principalFrame,14);a[18]=+(s.bodyType==='Dynamic');a[19]=s.colliders.length;for(let i=0;i<2;i++){a[29+i*10]=1;const c=s.colliders[i];if(c)a.set([c.shape==='Cylinder'?2:1,c.radius,c.halfHeight,...c.localTranslation,...c.localRotation],20+i*10);}return a;}
/** INITIAL INPUT ONLY. No post-h source values enter this packing path. */
export function packCueInitialState(initial,bundle,{sceneSlots=[NONE,NONE,NONE,NONE]}={}){
  const s=Created.validate(initial);if(s.initializationInputs.map(x=>x.role).join(',')!=='shaft,head,guide')throw new RangeError('Registered common scene requires three source-created cue roles, not a new fourth ball');
  if(!Array.isArray(sceneSlots)||sceneSlots.length!==4||sceneSlots.some(n=>!Number.isInteger(n)||n<0||n>NONE))throw new RangeError('Four resolved scene body slots required');
  const state=new Uint32Array(bundle.stateWords),floats=new Float32Array(state.buffer),a=s.application,p=s.sourceCreation.created.integration;
  state.set([0x52434351,1,1,0,1]);state.set(sceneSlots,16);state.set(numberWords(a.initialTime),20);state.set(numberWords(a.initialElapsed),22);state.set(numberWords(a.dt/a.subdivisions),24);state.set(numberWords(a.started),38);
  floats.set(J.pack(s.cue),L.joint);floats.set([p.contact_softness.natural_frequency,p.contact_softness.damping_ratio,p.static_contact_softness.natural_frequency,p.static_contact_softness.damping_ratio,p.warmstart_coefficient],L.joint+176);
  s.initializationInputs.forEach((input,i)=>floats.set(initialPack(input),L.initialInputs+i*40));
  const constants=[...a.axis,a.dt/a.subdivisions,a.lateralStiffness,a.lateralDamping,a.radius,a.tipRadius,a.normalStiffness,a.normalDamping,a.tangentStiffness,a.tangentDamping,a.friction];
  constants.forEach((value,i)=>state.set(numberWords(value),L.applicationConstants+i*2));return state;
}
export const CUE_ORCHESTRATION_CAPABILITY=Object.freeze({initialCreatedCueOnly:true,deviceMutableState:true,
  sourceNumberLateralTip:true,sourceF32Joints:true,firstHNumericInitialization:true,
  sourceIntegerInitialization:'external scene-initialization owner consumes outputs494/524/554',
  otherSphereTipContact:'unsupported unless source conservative separation proves no contact',
  activeCcd:'external resident CCD owner',wholeWorld:false});

/** TEST ONLY memory/stage oracle. No runtime fallback or source-world stepping. */
export function executeCueForTest(bundle,initial,{mode=0,ball,others=[],testOnly=false}={}){
  if(testOnly!==true)throw new TypeError('Cue host staging is TEST-ONLY');
  if(!(initial instanceof Uint32Array)||initial.length!==bundle.stateWords||!(ball instanceof Uint32Array)||ball.length!==64||!Array.isArray(others)||others.some(x=>!(x instanceof Uint32Array)||x.length!==64))throw new TypeError('Owned exact cue/body words required');
  const state=initial.slice(),body=ball.slice(),sf=new Float32Array(state.buffer),bf=new Float32Array(body.buffer),read=(at,n)=>Array.from(sf.subarray(at,at+n)),put=(at,v)=>sf.set(v,at),num=at=>wordsNumber(state.subarray(at,at+2)),setnum=(at,x)=>state.set(numberWords(x),at),q=L.joint;
  const graph=(index,values)=>executeLowered(bundle.entries[index].compiled,Float32Array.from(values),{testOnly:true});
  const source=(index,input)=>{const r=executeSourceNumberProgramReference(bundle.numbers[index],input);if(!r.done||index<2&&r.raw[94]!==1)throw new RangeError('Cue source-number stage did not complete');return r.raw;};
  const values=(out,at,n=3)=>Array.from({length:n},(_,i)=>wordsNumber(out.subarray(at+2*i,at+2*i+2)));
  if(state[2]!==1||state[0]!==0x52434351||![0,1].includes(mode))throw new RangeError('Completed source cue boundary required');state[2]=0;
  if(mode===1){
    if(!state[12]||!state[4])throw new RangeError('One deferred cue solve required');const active=!!state[15],entry=bundle.entries[active?4:3],out=graph(active?4:3,read(q,entry.compiled.inputCount)),p=entry.plan;
    if(out[p.guardOffset]<1e-7)throw new RangeError('Relative quaternion hemisphere tie unsupported');
    p.bodyLayout.forEach((offset,i)=>{put(q+i*48,out.slice(offset,offset+13));put(q+i*48+19,out.slice(offset+13,offset+19));});put(L.jointImpulses,out.slice(p.impulsesOffset,p.impulsesOffset+10));
    if(active){const cache=Array.from(out.slice(p.contactOffset,p.contactOffset+7),x=>x===0?0:x);put(q+144+19,[cache[0]]);put(q+144+18,[cache[1]]);put(q+144+22,cache.slice(2,4));put(q+144+15,cache.slice(4));}
    state[12]=0;state[2]=1;return {state,ball:body};
  }
  if(!state[4]||state[12])throw new RangeError('Source cue application must follow completed prior solve');
  state[10]=0;state[11]=0;
  for(const other of others){const of=new Float32Array(other.buffer,other.byteOffset,64),out=graph(0,[...read(q+54,3),...of.slice(6,9),f(f(.03075)+.006+.00001),0,0,0]);if(out[0]!==1)throw new RangeError('Unsupported possible other-sphere compliant tip contact');}
  put(L.worldCom,graph(1,[...read(q+6,7),...read(q+13,3),...read(q+54,7),...read(q+61,3)]));
  const constants=Array.from({length:13},(_,i)=>num(L.applicationConstants+i*2));
  const lat=source(0,[...read(q+54,3),...read(q+6,3),...read(L.worldCom+3,3),...read(L.worldCom,3),...read(q+48,3),...read(q,3),...read(q+51,3),...read(q+3,3),...read(q+64,3),...read(q+16,3),...read(q+19,6),...constants.slice(0,6)]);
  put(q+48,values(lat,0));put(q+51,values(lat,6));put(q,values(lat,12));put(q+3,values(lat,18));const latWake=values(lat,30).some(x=>x!==0);
  const calls=[[0,+latWake,state[16]],[1,+latWake,state[17]]];
  const tip=source(1,[...read(q+54,3),...read(L.worldCom+3,3),...read(q+48,6),...read(q+64,3),...read(q+67,6),...Array.from(bf.slice(6,9)),...Array.from(bf.slice(6,9)),...Array.from(bf.slice(0,6)),...Array.from(bf.slice(13,16)),...[16,17,18,20,21,24].map(i=>bf[i]),constants[6],constants[7],constants[3],...constants.slice(8),...Array.from({length:3},(_,i)=>num(26+i*2)),state[5],state[6]]);
  put(q+48,values(tip,26));put(q+51,values(tip,32));bf.set(values(tip,38),0);bf.set(values(tip,44),3);state[5]=tip[0];if(tip[1]){state[6]=1;state[9]++;}state.set(tip.subarray(4,10),26);
  state.set([tip[1],tip[2],tip[0],+values(tip,50).some(x=>x!==0)],43);
  if(tip[0]){const wake=+values(tip,50).some(x=>x!==0);calls.push([3,wake,state[19]],[0,wake,state[16]]);}state[10]=calls.length;calls.forEach((row,i)=>state.set(row,L.mutableCalls+i*3));
  if(state[7]===0){for(let i=0;i<3;i++){const out=graph(2,read(L.initialInputs+i*40,40));put(L.initialOutputs+i*30,out);state[47]|=1<<i;if(i<2){put(q+i*48+16,out.slice(3,6));put(q+i*48+19,out.slice(6,12));put(L.worldCom+i*3,out.slice(0,3));}}state[13]=1;}
  const clock=source(2,[num(20),num(22),num(24),num(50),num(52),num(54),values(tip,10,1)[0],values(tip,12,1)[0],tip[0],state[40],num(32),num(34),state[42],num(36),tip[2],tip[1]]);
  [20,22,50,52,54,32,34,36].forEach((at,i)=>state.set(clock.subarray(i*2,i*2+2),at));if(tip[1])state[40]=1;if(tip[0])state[41]=1;
  if(tip[2]){state[4]=0;state[42]=1;state[11]=3;state.set([0,1,2],L.removedRoles);}state[12]=state[4];state[7]++;state[8]=(state[8]+1)%64;state[2]=1;
  return{state,ball:body};
}

const HEADER_WGSL=`
fn rc_cue_fail(b:u32,status:u32,reason:u32)->u32{rc_state[b+2u]=status;rc_state[b+3u]=reason;return status;}
fn rc_cue_valid(b:u32,p:u32)->bool{let n=arrayLength(&rc_state);let pn=arrayLength(&rc_program);return p<=pn&&pn-p>=36u&&rc_program[p]==0x52434355u&&rc_program[p+1u]==1u&&b<=n&&rc_program[p+6u]<=n-b&&rc_state[b]==0x52434351u&&rc_state[b+1u]==1u;}
fn rc_cue_np(b:u32,p:u32)->u32{let phase=rc_state[b+14u];var index=0u;if(phase==1u){index=1u;}if(phase==4u){index=2u;}if(phase==6u){index=select(3u,4u,rc_state[b+15u]!=0u);}return p+rc_program[p+16u+index*4u];}
fn rc_cue_copy(a:u32,d:u32,n:u32){for(var i=0u;i<n;i++){rc_state[d+i]=rc_state[a+i];}}
`;
function sourceInputMaps(){
  const blocks=(rows)=>rows.flatMap(([group,offset,count])=>Array.from({length:count},(_,i)=>[group,offset+i]));
  const lat=blocks([[0,118,3],[0,70,3],[0,251,3],[0,248,3],[0,112,3],[0,64,3],[0,115,3],[0,67,3],[0,128,3],[0,80,3],[0,83,6]]);
  lat.push(...Array.from({length:6},(_,i)=>[3,1232+i*2]));
  const tip=blocks([[0,118,3],[0,251,3],[0,112,3],[0,115,3],[0,128,3],[0,131,6],[1,6,3],[1,6,3],[1,0,3],[1,3,3],[1,13,3]]);
  tip.push(...[16,17,18,20,21,24].map(offset=>[1,offset]),...[6,7,3,8,9,10,11,12].map(i=>[3,1232+i*2]),...[26,28,30].map(offset=>[3,offset]),[2,5],[2,6]);
  const clock=[...[20,22,24,50,52,54,1386,1388].map(offset=>[3,offset]),[2,45],[2,40],[3,32],[3,34],[2,42],[3,36],[2,44],[2,43]];
  return[lat,tip,clock];
}
function sourceGatherWGSL(){return `
 let map=p+rc_program[p+11u+index];let inputs=rc_program[np+10u];
 if(map>arrayLength(&rc_program) || inputs>(arrayLength(&rc_program)-map)/2u){return rc_cue_fail(b,2u,4u);}
 for(var i=0u;i<inputs;i++){
  let kind=rc_program[map+i*2u];let offset=rc_program[map+i*2u+1u];var value=RcF64(0u);
  if(kind<2u){let address=select(b,ball,kind==1u);value=rc_f64_from_f32_bits(rc_state[address+offset]);}
  else if(kind==2u){value=rc_f64_from_u32(rc_state[b+offset]);}
  else if(kind==3u){value=RcF64(rc_state[b+offset],rc_state[b+offset+1u]);}
  else{return rc_cue_fail(b,2u,4u);}
  rc_source_program_input(np,regs,i,value);
 }
`;}
/** Four fixed compiler stages. One candidate owns each slice, no barriers or
 * host per-h plans. Repeated prepare/numeric/source/scatter cycles advance only
 * the resident phase; final status stays sticky until explicit begin(mode).
 * The world owner must run CCD/geometry/scene lifecycle between application
 * completion and begin(mode=1), then its post-CCD/commit after solve completion.
 * Globals: rc_program read, rc_inputs read (generic source VM ABI), rc_state rw,
 * rc_scratch rw. Values are word offsets, not byte offsets. */
export function generateCueOrchestrationWGSL(stage,{numericProfile=NUMERIC_PROFILE.PRESERVED_F32}={}){
  if(!['prepare','numeric','source','scatter'].includes(stage))throw new RangeError('Cue compiler stage required');
  if(stage==='numeric')return generateProfiledNumericWGSL(numericProfile)+HEADER_WGSL+`
fn rc_cue_numeric(b:u32,p:u32,scratch:u32)->u32{
 if(!rc_cue_valid(b,p)){return 2u;}let prior=rc_state[b+2u];if(prior!=0u){return prior;}if(rc_state[b+48u]!=1u){return 0u;}
 let status=rc_num_eval(rc_state[b+58u],scratch);rc_state[b+59u]=status;if(status!=1u){return rc_cue_fail(b,status,6u);}return 0u;
}
`;
  const source=generateRawStrikeProgramWGSL();
  if(stage==='source')return source+HEADER_WGSL+`
fn rc_cue_source(b:u32,p:u32)->u32{
 if(!rc_cue_valid(b,p)){return 2u;}let prior=rc_state[b+2u];if(prior!=0u){return prior;}if(rc_state[b+48u]!=2u){return 0u;}
 let regs=b+1472u;let control=regs+rc_program[p+4u];rc_source_program_step(rc_state[b+58u],regs,control,64u);
 let status=rc_state[control+1u];rc_state[b+59u]=status;if(status>1u){return rc_cue_fail(b,select(2u,4u,status==3u),7u);}return 0u;
}
`;
  if(stage==='prepare')return source+HEADER_WGSL+`
fn rc_cue_begin(b:u32,p:u32,mode:u32)->u32{
 if(!rc_cue_valid(b,p)){return 2u;}if(rc_state[b+2u]!=1u || mode>1u){return rc_cue_fail(b,2u,1u);}
 if(rc_state[b+4u]==0u || (mode==0u && rc_state[b+12u]!=0u) || (mode==1u && rc_state[b+12u]==0u)){return rc_cue_fail(b,2u,2u);}
 rc_state[b+2u]=0u;rc_state[b+3u]=0u;rc_state[b+14u]=select(0u,6u,mode==1u);rc_state[b+48u]=0u;rc_state[b+49u]=0u;rc_state[b+56u]=mode;rc_state[b+59u]=0u;
 if(mode==0u){rc_state[b+10u]=0u;rc_state[b+11u]=0u;}return 0u;
}
fn rc_cue_prepare(b:u32,ball:u32,others:u32,otherCount:u32,p:u32,scratch:u32)->u32{
 if(!rc_cue_valid(b,p)){return 2u;}let prior=rc_state[b+2u];if(prior!=0u){return prior;}if(rc_state[b+48u]!=0u){return 0u;}
 let n=arrayLength(&rc_state);if(ball>n || n-ball<64u || otherCount<2u || otherCount>3u || others>n || otherCount>n-others){return rc_cue_fail(b,2u,3u);}
 let q=b+64u;var phase=rc_state[b+14u];var item=rc_state[b+49u];
 if(phase==0u && item>=otherCount){phase=1u;item=0u;}
 if(phase==4u && (rc_state[b+7u]!=0u || item>=3u)){phase=5u;item=0u;rc_state[b+13u]=1u;}
 rc_state[b+14u]=phase;rc_state[b+49u]=item;rc_state[b+59u]=0u;
 if(phase==0u || phase==1u || phase==4u || phase==6u){
  let np=rc_cue_np(b,p);let count=rc_program[np+3u];if(scratch>arrayLength(&rc_scratch) || rc_program[np+5u]+1u>arrayLength(&rc_scratch)-scratch){return rc_cue_fail(b,2u,4u);}
  for(var i=0u;i<count;i++){rc_scratch[scratch+i]=0u;}
  if(phase==0u){let other=rc_state[others+item];if(other>n || n-other<64u){return rc_cue_fail(b,2u,3u);}for(var i=0u;i<3u;i++){rc_scratch[scratch+i]=rc_state[q+54u+i];rc_scratch[scratch+3u+i]=rc_state[other+6u+i];}rc_scratch[scratch+6u]=${new Uint32Array(Float32Array.of(f(f(.03075)+.006+.00001)).buffer)[0]}u;}
  if(phase==1u){for(var role=0u;role<2u;role++){for(var i=0u;i<7u;i++){rc_scratch[scratch+role*10u+i]=rc_state[q+role*48u+6u+i];}for(var i=0u;i<3u;i++){rc_scratch[scratch+role*10u+7u+i]=rc_state[q+role*48u+13u+i];}}}
  if(phase==4u){for(var i=0u;i<40u;i++){rc_scratch[scratch+i]=rc_state[b+374u+item*40u+i];}}
  if(phase==6u){for(var i=0u;i<count;i++){rc_scratch[scratch+i]=rc_state[q+i];}}
  rc_state[b+58u]=np;rc_state[b+48u]=1u;return 0u;
 }
 if(phase!=2u && phase!=3u && phase!=5u){return rc_cue_fail(b,2u,5u);}
 var index=0u;if(phase==3u){index=1u;}if(phase==5u){index=2u;}let np=p+rc_program[p+8u+index];let regs=b+1472u;let control=regs+rc_program[p+4u];
 rc_source_program_init(np,regs,control);
 ${sourceGatherWGSL()}
 rc_state[b+58u]=np;rc_state[b+48u]=2u;return 0u;
}
`;
  return source+HEADER_WGSL+`
fn rc_cue_result_f32(out:u32,dst:u32,count:u32){for(var i=0u;i<count;i++){rc_state[dst+i]=rc_f64_to_f32_bits(RcF64(rc_state[out+i*2u],rc_state[out+i*2u+1u]));}}
fn rc_cue_nonzero(out:u32)->u32{for(var i=0u;i<3u;i++){if(!rc_f64_zero(RcF64(rc_state[out+i*2u],rc_state[out+i*2u+1u]))){return 1u;}}return 0u;}
fn rc_cue_mutable(b:u32,index:u32,role:u32,wake:u32,slot:u32){let at=b+594u+index*3u;rc_state[at]=role;rc_state[at+1u]=wake;rc_state[at+2u]=slot;}
fn rc_cue_scatter(b:u32,ball:u32,p:u32,scratch:u32)->u32{
 if(!rc_cue_valid(b,p)){return 2u;}let prior=rc_state[b+2u];if(prior!=0u){return prior;}let kind=rc_state[b+48u];if(kind==0u){return 0u;}if(rc_state[b+59u]==0u){return 0u;}if(rc_state[b+59u]!=1u){return rc_cue_fail(b,2u,6u);}
 let phase=rc_state[b+14u];let item=rc_state[b+49u];let np=rc_state[b+58u];let q=b+64u;
 if(kind==1u){
  let count=rc_program[np+4u];let outmap=np+rc_program[np+8u];let out=b+640u;
  if(count>592u){return rc_cue_fail(b,2u,4u);}for(var i=0u;i<count;i++){rc_state[out+i]=rc_scratch[scratch+rc_program[outmap+i]];}
  if(phase==0u){if(bitcast<f32>(rc_state[out])!=1.0){return rc_cue_fail(b,4u,8u);}rc_state[b+49u]++;}
  else if(phase==1u){rc_cue_copy(out,b+248u,6u);rc_state[b+14u]=2u;}
  else if(phase==4u){rc_cue_copy(out,b+494u+item*30u,30u);rc_state[b+47u]|=1u<<item;if(item<2u){rc_cue_copy(out+3u,q+item*48u+16u,3u);rc_cue_copy(out+6u,q+item*48u+19u,6u);rc_cue_copy(out,b+248u+item*3u,3u);}rc_state[b+49u]++;}
  else if(phase==6u){
   let clothEnabled=rc_state[b+15u]!=0u;let bodyOut=select(432u,516u,clothEnabled);let impulseOut=select(470u,554u,clothEnabled);let guard=select(480u,578u,clothEnabled);
   if(bitcast<f32>(rc_state[out+guard])<1e-7){return rc_cue_fail(b,4u,9u);}
   for(var role=0u;role<2u;role++){rc_cue_copy(out+bodyOut+role*19u,q+role*48u,13u);rc_cue_copy(out+bodyOut+role*19u+13u,q+role*48u+19u,6u);}rc_cue_copy(out+impulseOut,b+584u,10u);
   if(clothEnabled){for(var i=0u;i<7u;i++){var word=rc_state[out+564u+i];if((word&0x7fffffffu)==0u){word=0u;}var dest=q+144u+15u+i-4u;if(i==0u){dest=q+144u+19u;}else if(i==1u){dest=q+144u+18u;}else if(i<4u){dest=q+144u+22u+i-2u;}rc_state[dest]=word;}}
   rc_state[b+12u]=0u;rc_state[b+2u]=1u;
  }else{return rc_cue_fail(b,2u,5u);}
 }else if(kind==2u){
  let regs=b+1472u;let control=regs+rc_program[p+4u];let out=b+1376u;
  if(rc_source_program_finish(np,regs,control,out)!=1u){return rc_cue_fail(b,2u,7u);}if(phase!=5u && rc_state[out+94u]!=1u){return rc_cue_fail(b,3u,10u);}
  if(phase==2u){rc_cue_result_f32(out,q+48u,6u);rc_cue_result_f32(out+12u,q,6u);let wake=rc_cue_nonzero(out+30u);rc_cue_mutable(b,0u,0u,wake,rc_state[b+16u]);rc_cue_mutable(b,1u,1u,wake,rc_state[b+17u]);rc_state[b+10u]=2u;rc_state[b+14u]=3u;}
  else if(phase==3u){
   rc_cue_result_f32(out+26u,q+48u,6u);rc_cue_result_f32(out+38u,ball,6u);rc_cue_copy(out+4u,b+26u,6u);
   rc_state[b+5u]=rc_state[out];rc_state[b+43u]=rc_state[out+1u];rc_state[b+44u]=rc_state[out+2u];rc_state[b+45u]=rc_state[out];let wake=rc_cue_nonzero(out+50u);rc_state[b+46u]=wake;
   if(rc_state[out+1u]!=0u){rc_state[b+6u]=1u;rc_state[b+9u]++;}if(rc_state[out]!=0u){rc_cue_mutable(b,2u,3u,wake,rc_state[b+19u]);rc_cue_mutable(b,3u,0u,wake,rc_state[b+16u]);rc_state[b+10u]=4u;}
   rc_state[b+14u]=4u;rc_state[b+49u]=0u;
  }else if(phase==5u){
   ${[20,22,50,52,54,32,34,36].map((offset,i)=>`rc_cue_copy(out+${i*2}u,b+${offset}u,2u);`).join('\n')}
   if(rc_state[b+43u]!=0u){rc_state[b+40u]=1u;}if(rc_state[b+45u]!=0u){rc_state[b+41u]=1u;}
   if(rc_state[b+44u]!=0u){rc_state[b+4u]=0u;rc_state[b+42u]=1u;rc_state[b+11u]=3u;rc_state[b+606u]=0u;rc_state[b+607u]=1u;rc_state[b+608u]=2u;}
   rc_state[b+12u]=rc_state[b+4u];rc_state[b+7u]++;rc_state[b+8u]=(rc_state[b+8u]+1u)%64u;rc_state[b+2u]=1u;
  }else{return rc_cue_fail(b,2u,5u);}
 }else{return rc_cue_fail(b,2u,5u);}
 rc_state[b+48u]=0u;rc_state[b+59u]=0u;return rc_state[b+2u];
}
`;
}
