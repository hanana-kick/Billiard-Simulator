/** Separate CPU-only common-clock policy using exact axis-event descriptors. */
import {runPreparedWorldCPU} from './deterministic-recurring-world.mjs';
import {advanceSupportedWorldCPU,buildRecurringProbeCPU} from './deterministic-world-supported.mjs';
import {mergeAndClearTubePrefixCPU,normalSpinReceipt} from './deterministic-tube-prefix.mjs';
import {qMath} from './deterministic-q-continuation.mjs';
import {runExactCollinearCPU,EXACT_COLLINEAR_POLICY} from './experimental-exact-collinear.mjs';
const Q=2**24;
export function advanceExactCollinearWorldCPU(current,context,resolve,options){
  const fallback=()=>advanceSupportedWorldCPU(current,context,resolve,options),n=current.state[3],modes=Array.from({length:n},(_,i)=>current.state[64+i*48+40]);
  if(current.state[1]!==1||current.state[6]!==0xffffffff||context[13]!==1||modes.some(m=>m!==0&&m!==1)||modes.filter(m=>m===1).length!==1)return fallback();
  const source=new Int32Array(current.state.buffer,current.state.byteOffset,current.state.length),material=new Int32Array(context.buffer,context.byteOffset,context.length);
  if([current.state,current.dense,context].some(x=>Object.prototype.toString.call(x.buffer)==='[object SharedArrayBuffer]'))return fallback();
  for(let i=0;i<n;i++){const a=64+i*48;if(source[a+22]<=0||source[a+23]<=0||source[a+25]!==material[8]+source[a+22]||source[a+28]!==0)return fallback();if(modes[i]===0&&[27,28,29,30,32].some(k=>source[a+k]!==0))return fallback();}
  const body=modes.indexOf(1),rows=buildRecurringProbeCPU(current,context),proof=runExactCollinearCPU(rows.slice(body*64,body*64+64));
  if(!proof.accepted)return fallback();
  const state=current.state.slice(),dense=new Uint32Array(256),s=new Int32Array(state.buffer),d=new Int32Array(dense.buffer),old=new Int32Array(current.dense.buffer),c=new Int32Array(context.buffer),h=proof.durationTicks;
  state[1]=0;state[2]=0;state[4]=h;state[8]=state[5];state[14]=0;state[17]=0;state[18]=0x58414301;state[40]=0;state[60]=0;
  for(let i=0;i<n;i++){
    const a=64+i*48,b=i*64;d[b]=i===body?3:0;d[b+1]=s[a+22];d.set(s.slice(a+24,a+27),b+4);d.set(s.slice(a+24,a+27),b+16);d.set(s.slice(a+27,a+30),b+20);d.set(s.slice(a+30,a+33),b+24);
    if(i===body){
      for(let axis=0;axis<2;axis++){const [lo,hi]=proof.positionBounds[axis],center=lo+Math.floor((hi-lo)/2);d[b+4+2*axis]=center;d[b+28+2*axis]=Math.max(center-lo,hi-center);}
      const e=proof.endpoint;d.set([e[0],s[a+25],e[1]],b+16);d.set([e[2],0,e[3]],b+20);d.set([e[4],e[6],e[5]],b+24);d[b+41]=1;
    }else{const spin=normalSpinReceipt(s[a+31],0,c[7],h);d[b+25]=spin[0];d[b+37]=spin[1];if(spin[1]>c[22])return fallback();}
  }
  const prepared={state,dense,rows:new Uint32Array(256),context,priorState:current.state,priorDense:current.dense},ctx=context.slice();ctx[15]=0;
  mergeAndClearTubePrefixCPU(prepared,new Uint32Array(256),ctx);
  if(state[1]!==1)return fallback();
  const pathDense=dense.slice();state[28]++;state[29]=0;state[7]=0;
  for(let i=0;i<n;i++){
    const a=64+i*48,b=i*64,mode=i===body?proof.mode:0,positionErrors=i===body?proof.errors.slice(0,2):[0,0],localRho=i===body&&proof.errors.slice(2,6).some(x=>x)?2:0;
    state[a+40]=mode;state[7]|=mode<<(2*i);d[b]=mode;d.set(d.slice(b+16,b+19),b+4);d.set(d.slice(b+20,b+23),b+48);d.fill(0,b+8,b+15);d.fill(0,b+52,b+59);d[b+41]=2;
    const growth=qMath.term(old[b+40],h,20,true),rho=old[b+40]+localRho,checks=[growth,rho,old[b+28]+growth+positionErrors[0],old[b+30]+growth+positionErrors[1],Math.ceil(rho*26527108/Q)];if(checks.some(x=>!Number.isSafeInteger(x)||x<0||x>0x7fffffff))return fallback();d[b+28]=old[b+28]+growth+positionErrors[0];d[b+30]=old[b+30]+growth+positionErrors[1];d[b+40]=rho;d[b+32]=rho;d[b+34]=rho;d[b+36]=Math.ceil(rho*26527108/Q);d[b+38]=d[b+36];d[b+37]=normalSpinReceipt(new Int32Array(current.state.buffer)[a+31],old[b+37],c[7],h)[1];
  }
  return {...prepared,pathDense,exactCollinearProof:proof,experimentalExactCollinear:true,globalReceiptCertified:false};
}
export function runExperimentalExactCollinearWorldCPU(world,scene,hulls,options){
  if(options?.selectedTrace)throw RangeError('Exact collinear policy is not selected-trace qualified');
  if(options?.mixedMotionRevision!=='mmq2')throw RangeError('Explicit MMQ2 research source required');
  return {...runPreparedWorldCPU(world,scene,hulls,options,null,advanceExactCollinearWorldCPU),integrationPolicy:EXACT_COLLINEAR_POLICY,gpuQualified:false};
}
