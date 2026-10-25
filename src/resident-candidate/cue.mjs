/* SPDX-License-Identifier: Apache-2.0
 * Original PhysicsLab.compliantTipContact source-number application and native
 * f32 API boundaries. Binary64 is integer-emulated; no double-single admission.
 * Native formulas: Rapier b716d375efc0201003f0cd9ef7168eee0b62c177.
 * See vendor/RAPIER-LICENSE.txt. World lifecycle/transaction owner stays external.
 */
import {SourceNumberProgramBuilder,compileSourceNumberProgram,defineSourceNumberHypotFunctions,
  executeSourceNumberProgramReference,generateRawStrikeProgramWGSL} from './raw-strike.mjs';
import {numberWords,wordsNumber} from './source-number.mjs';
import {compileGraph,executeLowered} from './numeric-program.mjs';
// Native browser ESM has no CommonJS require to fill these captured UMD
// dependencies. Keep their original initialization order explicit.
import '../experimental-cue-joint.js';
import '../experimental-cue-joint-stepper.js';
import '../experimental-cue-cloth-joint-stepper.js';
import '../experimental-live-registered-origin.js';
import '../experimental-live-three-ball-origin.js';
import '../experimental-cue-created-variant.js';
import '../experimental-cue-initialization.js';
import '../experimental-cue-created-stroke-stage.js';
const J=globalThis.LabCueJointStepperExperimental,Cloth=globalThis.LabCueClothJointStepperExperimental,
  Init=globalThis.LabCueInitializationExperimental,Created=globalThis.LabCueCreatedStrokeStageExperimental;
const NONE=0xffffffff;
export const CUE_CAPABILITY=Object.freeze({sourceNumberApplication:true,doubleSingle:false,
  originalSourceNumberProfile:'pinned V8 Math.hypot; IEEE binary64 ordered basic operations',
  nativeApiArithmetic:'source-ordered f32 round-to-nearest',wholeWorld:false,hardwarePerformance:false});
export const CUE_LAYOUT=Object.freeze({headerWords:64,joint:64,jointWords:184,worldCom:248,
  lateralInput:254,tipInput:302,initialInputs:374,initialInputStride:40,initialOutputs:494,
  initialOutputStride:30,jointImpulses:584,mutableCalls:594,mutableStride:3,removedRoles:606,
  numericalOutput:640,numericalOutputWords:592,
  header:Object.freeze({magic:0,version:1,status:2,reason:3,present:4,active:5,contacted:6,
    frame:7,outerSubstep:8,contactEpisodes:9,mutableCount:10,removedCount:11,needsSolve:12,
    initialized:13,stage:14,clothActive:15,headSlot:16,shaftSlot:17,guideSlot:18,ballSlot:19,
    time:20,elapsed:22,h:24,tangent:26,firstContact:32,lastContact:34,ended:36,started:38,
    firstContactValid:40,lastContactValid:41,endedValid:42,initialNumericMask:47}),
  applicationConstants:1232,sourceInput:1264,sourceInputWords:112,sourceOutput:1376,
  sourceOutputWords:96,sourceRegisters:1472,
  roles:Object.freeze({head:0,shaft:1,guide:2,ball:3})});

function numberBuilder(inputCount,{hypot=false}={}){
  const b=new SourceNumberProgramBuilder(),jump=b.emit('jump');
  const names=hypot?defineSourceNumberHypotFunctions(b,{prefix:'cueHypot'}):null;
  b.patch(jump,b.code.length);const inputs=Array.from({length:inputCount},()=>b.alloc());
  const c=x=>b.c(x),op=(k,a,z)=>b.op(k,a,z),add=(a,z)=>op('add',a,z),sub=(a,z)=>op('sub',a,z),mul=(a,z)=>op('mul',a,z),div=(a,z)=>op('div',a,z),neg=a=>op('neg',a),round=a=>op('fround',a),v=(i,n=3)=>inputs.slice(i,i+n),
    va=(a,z)=>a.map((x,i)=>add(x,z[i])),vs=(a,z)=>a.map((x,i)=>sub(x,z[i])),vm=(a,s)=>a.map(x=>mul(x,s)),
    dot=(a,z)=>add(add(mul(a[0],z[0]),mul(a[1],z[1])),mul(a[2],z[2])),
    choose=(p,yes,no)=>{const r=b.alloc();b.branch(p,()=>b.set(r,yes()),()=>b.set(r,no()));return r;},
    fa=(a,z)=>round(add(a,z)),fs=(a,z)=>round(sub(a,z)),fm=(a,z)=>round(mul(a,z)),
    cross=(a,z)=>[fs(fm(a[1],z[2]),fm(a[2],z[1])),fs(fm(a[2],z[0]),fm(a[0],z[2])),fs(fm(a[0],z[1]),fm(a[1],z[0]))],
    pointVelocity=(linear,angular,point,com)=>cross(angular,point.map((x,i)=>fs(x,com[i]))).map((x,i)=>fa(linear[i],x)),
    nonzero=xs=>xs.map(x=>op('eq',op('zero',x),c(0))).reduce(add),
    apply=(linear,angular,im,ii,q,point,com)=>{
      const changed=nonzero(q),torque=point?cross(point.map((x,i)=>fs(x,com[i])),q):[c(0),c(0),c(0)],angularChanged=nonzero(torque);
      return{linear:linear.map((x,i)=>choose(changed,()=>fa(x,fm(q[i],im[i])),()=>x)),
        angular:angular.map((x,i)=>choose(angularChanged,()=>{const row=[[0,1,2],[1,3,4],[2,4,5]][i];return fa(x,fa(fa(fm(ii[row[0]],torque[0]),fm(ii[row[1]],torque[1])),fm(ii[row[2]],torque[2])));},()=>x)),torque};
    };
  const status=b.variable(c(1));for(const r of inputs)b.branch(op('finite',r),()=>{},()=>{b.set(status,c(3));b.emit('halt');});
  const finish=(fields,scope)=>{const outputs=[[94,status,1]];for(const[,values,integer=0]of fields)if(!integer)for(const r of values)b.branch(op('finite',r),()=>{},()=>b.set(status,c(3)));for(const [at,values,integer=0]of fields)values.forEach((r,i)=>outputs.push([at+i*(integer?1:2),r,integer]));b.emit('halt');return compileSourceNumberProgram(b,{inputs,outputs,outputWords:96,maximumInstructions:20000,scope});};
  return {b,inputs,c,op,add,sub,mul,div,neg,round,v,va,vs,vm,dot,choose,pointVelocity,apply,finish,
    hypot:a=>b.call(names.hypot3,a)[0]};
}
/** Lateral input42 is the original compliance pack BEFORE f32 conversion:
 * position/COM/vel/mass/ii0..35, exact Number axis36..38,h39,k40,d41.
 * Binary64 output vectors: head linear0/angular6,shaft linear12/angular18,
 * impulse24,impulseF32 30,torque36,point velocities42/48,lateral54,vl60. */
export function compileCueLateralProgram(){
  const g=numberBuilder(42),{inputs:x,c,op,neg,round,v,va,vs,vm,dot,pointVelocity,apply,finish}=g;
  const vh=pointVelocity(v(12),v(18),v(0),v(6)),sv=pointVelocity(v(15),v(21),v(0),v(9));
  const d=vs(v(0),v(3)),lateral=vs(d,vm(v(36),dot(d,v(36)))),rv=vs(vh,sv),vl=vs(rv,vm(v(36),dot(rv,v(36))));
  const impulse=vm(va(vm(lateral,neg(x[40])),vm(vl,neg(x[41]))),x[39]),q=impulse.map(round),negative=impulse.map(a=>round(neg(a)));
  const head=apply(v(12),v(18),v(24),Array(6).fill(c(0)),q,null,null),shaft=apply(v(15),v(21),v(27),v(30,6),negative,v(0),v(9));
  return finish([[0,head.linear],[6,head.angular],[12,shaft.linear],[18,shaft.angular],[24,impulse],[30,q],[36,shaft.torque],[42,vh],[48,sv],[54,lateral],[60,vl]],'original-source-cue-lateral');
}
/** Tip input55: head21 + ball21 (position,worldCom,linear,angular,im,ii6),
 * original Number parameters42..49, tangent50..52,active53,contacted54.
 * Output flags0..3; vectors stored as binary64: tangent4,normal10,compression12,
 * impulse14,point20,head linear26/angular32,ball linear38/angular44, q50,p3256.
 * No eager evaluation of a no-contact branch; original JS predicates retained. */
export function compileCueTipProgram(){
  const g=numberBuilder(55,{hypot:true}),{b,inputs:x,c,op,add,sub,mul,div,neg,round,v,va,vs,vm,dot,choose,pointVelocity,apply,finish,hypot}=g;
  const touching=b.variable(c(0)),birth=b.variable(c(0)),remove=b.variable(x[54]),sliding=b.variable(c(0));
  const tangent=Array.from({length:3},()=>b.variable(c(0))),normal=b.variable(c(0)),impulse=Array.from({length:3},()=>b.variable(c(0))),point=Array.from({length:3},()=>b.variable(c(0))),q=Array.from({length:3},()=>b.variable(c(0))),p32=Array.from({length:3},()=>b.variable(c(0)));
  const hl=v(6).map(r=>b.variable(r)),ha=v(9).map(r=>b.variable(r)),bl=v(27).map(r=>b.variable(r)),ba=v(30).map(r=>b.variable(r));
  const delta=vs(v(21),v(0)),dist=hypot(delta),compression=sub(add(x[42],x[43]),dist);
  const setv=(to,from)=>to.forEach((r,i)=>b.set(r,from[i]));
  b.branch(op('le',compression,c(0)),()=>{},()=>b.branch(op('lt',dist,c(1e-9)),()=>{},()=>{
    b.set(touching,c(1));b.set(birth,sub(c(1),x[53]));b.set(remove,c(0));
    const n=vm(delta,div(c(1),dist));setv(point,va(v(0),vm(n,sub(x[43],mul(compression,c(.5))))));setv(p32,point.map(round));
    const relative=vs(pointVelocity(v(27),v(30),p32,v(24)),pointVelocity(v(6),v(9),p32,v(3))),vn=dot(relative,n),vt=vs(relative,vm(n,vn));
    const force=sub(mul(x[45],compression),mul(x[46],vn));b.set(normal,choose(op('lt',c(0),force),()=>force,()=>c(0)));
    const old=v(50).map(r=>choose(x[53],()=>r,()=>c(0)));setv(tangent,va(vs(old,vm(n,dot(old,n))),vm(vt,x[44])));
    const ft=va(vm(tangent,neg(x[47])),vm(vt,neg(x[48]))).map(r=>b.variable(r)),limit=mul(x[49],normal),mag=hypot(ft);
    b.branch(op('lt',limit,mag),()=>{
      b.set(sliding,c(1));b.branch(op('lt',c(0),mag),()=>setv(ft,vm(ft,div(limit,mag))),()=>setv(ft,[c(0),c(0),c(0)]));
      b.branch(op('lt',c(0),x[47]),()=>setv(tangent,vm(va(ft,vm(vt,x[48])),div(c(-1),x[47]))),()=>setv(tangent,[c(0),c(0),c(0)]));
    });
    setv(impulse,vm(va(vm(n,normal),ft),x[44]));setv(q,impulse.map(round));
    const ball=apply(v(27),v(30),v(33),v(36,6),q,p32,v(24)),head=apply(v(6),v(9),v(12),v(15,6),impulse.map(r=>round(neg(r))),p32,v(3));
    setv(hl,head.linear);setv(ha,head.angular);setv(bl,ball.linear);setv(ba,ball.angular);
  }));
  return finish([[0,[touching,birth,remove,sliding],1],[4,tangent],[10,[normal]],[12,[compression]],[14,impulse],[20,point],
    [26,hl],[32,ha],[38,bl],[44,ba],[50,q],[56,p32]],'original-source-cue-tip');
}

/** Explicit TEST ONLY independent source-number bytecode execution, not fallback. */
export function executeCueNumberForTest(program,inputs,{testOnly=false}={}){
  if(testOnly!==true)throw new TypeError('Cue host execution is TEST-ONLY');
  const result=executeSourceNumberProgramReference(program,inputs);if(!result.done)throw new RangeError('Cue source-number program incomplete');if(result.raw[94]!==1){const error=new RangeError('Cue source-number state is nonfinite');error.numericStatus=result.raw[94];throw error;}return result.raw;
}
