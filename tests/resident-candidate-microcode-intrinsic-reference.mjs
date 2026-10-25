// TEST ONLY independent numeric models for differential interpreter gates.
// Never imported by lean GPU submission or used as a production fallback.
import {sourceNumberReference as N,numberWords} from '../src/resident-candidate/source-number.mjs';
import {beginNumericContinuationForTest,advanceNumericContinuationForTest} from '../src/resident-candidate/numeric-continuation.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {sourceIntrinsicNativeWGSL} from '../src/resident-candidate/microcode-source-intrinsics.mjs';
const one=value=>Uint32Array.of(Number(value)>>>0);
function graph(programBase,scratchBase,bindings){
 const program=bindings[1],scratch=bindings[3];
 if(programBase>program.length||program.length-programBase<12)return one(2);
 const inputs=program[programBase+3],registers=program[programBase+5];
 if(inputs<1||inputs>65536||scratchBase>scratch.length||registers+1>scratch.length-scratchBase||inputs>registers)return one(2);
 let state;
 try{state=beginNumericContinuationForTest(program,new Float32Array(scratch.slice(scratchBase,scratchBase+inputs).buffer),{testOnly:true,programBase});}
 catch(error){if(error.numericStatus===2)return one(2);throw error;}
 // The original graph does not clear unassigned scratch registers. Preserve
 // every prior word, then reproduce status and only actual graph writes.
 state.words.set(scratch.subarray(scratchBase,scratchBase+registers+1));state.words[registers]=state.status;
 if(state.status===0)advanceNumericContinuationForTest(state,{testOnly:true,instructions:Math.max(1,state.nodes+1)});
 scratch.set(state.words,scratchBase);return one(state.status);
}
// Reconstruct each continuation from the authoritative words on every call.
// There is deliberately no hidden Map retaining graph PC, registers or status.
function numericInstruction(control,bindings){
 const state=bindings[0],program=bindings[1],scratch=bindings[3];
 if(control>state.length||state.length-control<8)return one(2);
 if(state[control]!==0x52434e43||state[control+6]!==0||state[control+7]!==0)return one(2);
 if(state[control+5]!==0)return one(state[control+5]);
 const programBase=state[control+1],scratchBase=state[control+2],inputs=program[programBase+3],outputs=program[programBase+4],registers=program[programBase+5],nodes=program[programBase+6],instructions=program[programBase+7],outputOffset=program[programBase+8],instruction=state[control+3],initialized=state[control+4];
 const fail=status=>{scratch[scratchBase+registers]=status;state[control+5]=status;return one(status);};
 if(instruction>nodes||initialized<inputs||initialized>registers)return fail(2);
 const model={program,programBase,inputs,outputs,registers,nodes,instructions,outputOffset,words:scratch.slice(scratchBase,scratchBase+registers+1),instruction,initialized,status:0,output:null};
 advanceNumericContinuationForTest(model,{testOnly:true,instructions:1});
 scratch.set(model.words,scratchBase);
 // A failed node returns before cursor writeback. A successful final node
 // writes cursor/initialized before the final output validation can fail.
 state[control+3]=model.instruction;state[control+4]=model.initialized;state[control+5]=model.status;
 return one(model.status);
}
const sourceHelpers=new Map();
// Three source conversion helpers have delicate integer-wrap/pack semantics.
// This TEST adapter keeps their exact lowered source instead of substituting
// JS Math.trunc/scalbn behavior. These helper bits are not an independent oracle.
function sourceHelper(name,args){
 let p=sourceHelpers.get(name);if(!p){p=compileMicrocodeWGSL(sourceIntrinsicNativeWGSL('source-continuations-v1'),{entry:name,intrinsics:'source-f64-v1'});sourceHelpers.set(name,p);}
 const root=p.functions.find(f=>f.name===name),vm=createMicrocodeVmReferenceForTest({testOnly:true,code:p.instructions,localWords:p.localWords,stackCapacity:p.callDepth,entryPc:p.entryPc,intrinsics:p.intrinsicProfile,intrinsicHandler:microcodeIntrinsicReference,initialSlots:args.flatMap((arg,i)=>Array.from(arg,(value,j)=>({slot:root.params[i].slot+j,value})))});
 vm.begin();let status=1,budget=0;while(status===1&&budget++<64)status=vm.advance(0,65536);
 if(status!==2)throw new Error('TEST exact source conversion did not complete: '+name);
 return Uint32Array.from({length:root.returnWords},(_,i)=>vm.local(0,root.returnSlot+i));
}
function sourceInstruction(pb,sb,cb,bindings){
 const state=bindings[0],program=bindings[1],read=(a)=>{a>>>=0;if(a>=state.length)throw new RangeError('TEST source storage read outside admitted words');return state[a];},write=(a,v)=>{a>>>=0;if(a>=state.length)throw new RangeError('TEST source storage write outside admitted words');state[a]=v;};
 if(read(cb+1)!==0)return one(read(cb+1));
 let pc=read(cb),sp=read(cb+3);const count=program[pb+3];
 if(read(cb+2)>=program[pb+13]){write(cb+1,3);return one(3);}
 write(cb+2,read(cb+2)+1);
 if(pc>=program[pb+4]){write(cb+1,2);return one(2);}
 const at=(pb+program[pb+5]+pc*4)>>>0,[code,d,a,b]=program.subarray(at,at+4);pc=(pc+1)>>>0;
 const get=i=>Uint32Array.of(read(sb+i*2),read(sb+i*2+1)),put=(i,v)=>{write(sb+i*2,v[0]);write(sb+i*2+1,v[1]);},x=a<count?get(a):Uint32Array.of(0,0),y=b<count?get(b):Uint32Array.of(0,0),integer=v=>sourceHelper('rc_rsp_int',[v])[0];
 let value=Uint32Array.of(0,0),writes=true;
 switch(code){
  case 0:value=x;break;case 1:value=N.add(x,y);break;case 2:value=N.sub(x,y);break;case 3:value=N.mul(x,y);break;case 4:value=N.div(x,y);break;
  case 5:value=N.sqrt(x);break;case 6:value=N.neg(x);break;case 7:value=N.abs(x);break;
  case 8:value=numberWords(+N.lt(x,y));break;case 9:value=numberWords(+(N.lt(x,y)||N.eq(x,y)));break;case 10:value=numberWords(+N.eq(x,y));break;case 11:value=numberWords(+N.finite(x));break;case 12:value=numberWords(+((x[0]|(x[1]&0x7fffffff))===0));break;
  case 13:value=numberWords(x[1]);break;case 14:value=numberWords((integer(x)&integer(y))>>>0);break;case 15:value=numberWords((integer(x)|integer(y))>>>0);break;case 16:value=numberWords((integer(x)<<(integer(y)&31))>>>0);break;case 17:value=numberWords(integer(x)>>>(integer(y)&31));break;
  case 18:value=sourceHelper('rc_rsp_trunc',[x]);break;case 19:value=sourceHelper('rc_rsp_scalbn',[x,y]);break;case 20:value=Uint32Array.of(x[0],integer(y));break;
  case 21:{const index=(a+integer(y))>>>0;if(index>=count){write(cb+1,2);writes=false;}else value=get(index);break;}
  case 22:{const index=(d+integer(x))>>>0;if(index>=count)write(cb+1,2);else put(index,y);writes=false;break;}
  case 23:pc=d;writes=false;break;case 24:if((x[0]|(x[1]&0x7fffffff))===0)pc=d;writes=false;break;
  case 25:if(sp>=program[pb+12])write(cb+1,3);else{write(cb+4+sp,pc);sp=(sp+1)>>>0;pc=d;}writes=false;break;
  case 26:if(sp===0)write(cb+1,2);else{sp=(sp-1)>>>0;pc=read(cb+4+sp);}writes=false;break;
  case 27:write(cb+1,1);writes=false;break;case 28:value=N.fromF32(N.toF32(x));break;
  default:write(cb+1,2);writes=false;
 }
 if(writes){if(d>=count)write(cb+1,2);else put(d,value);}
 write(cb,pc);write(cb+3,sp);return one(read(cb+1));
}
export function microcodeIntrinsicReference(spec,args,{bindings}={}){
 const name=spec.name;
 if(name==='rc_num_cont_instruction')return numericInstruction(args[0][0],bindings);
 if(name==='rc_source_program_instruction')return sourceInstruction(args[0][0],args[1][0],args[2][0],bindings);
 if(name==='rc_num_eval')return graph(args[0][0],args[1][0],bindings);
 if(name==='rc_num_widen')return N.fromF32(args[0][0]);
 if(name==='rc_num_soft_arithmetic'){
  const op=args[0][0],a=N.fromF32(args[1][0]),b=N.fromF32(args[2][0]);let result=numberWords(0);
  if(op===1)result=N.add(a,b);else if(op===2)result=N.sub(a,b);else if(op===3)result=N.mul(a,b);else if(op===4)result=N.div(a,b);else if(op===7)result=N.sqrt(a);else if(op===8)result=N.div(numberWords(1),a);else if(op===9)result=N.div(b,a);
  return one(N.toF32(result));
 }
 const method={rc_f64_add:'add',rc_f64_sub:'sub',rc_f64_mul:'mul',rc_f64_div:'div',rc_f64_sqrt:'sqrt',rc_f64_eq:'eq',rc_f64_lt:'lt',rc_f64_finite:'finite'}[name];
 if(method){const result=N[method](...args);return result instanceof Uint32Array?result:one(result);}
 if(name==='rc_f64_le')return one(N.lt(args[0],args[1])||N.eq(args[0],args[1]));
 if(name==='rc_f64_from_u32')return numberWords(args[0][0]);
 if(name==='rc_f64_from_f32_bits')return N.fromF32(args[0][0]);
 if(name==='rc_f64_to_f32_bits')return one(N.toF32(args[0]));
 throw new TypeError('Unknown exact-source TEST intrinsic '+name);
}
