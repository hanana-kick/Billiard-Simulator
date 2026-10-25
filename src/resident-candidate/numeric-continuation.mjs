/* SPDX-License-Identifier: Apache-2.0
 * Source-generated ONE-instruction continuation of the liveness VM. The
 * original instruction body is copied verbatim; only its surrounding loop is
 * externalized. This is opt-in and does not replace the proven staged VM.
 */
import {generateProfiledNumericWGSL,NUMERIC_PROFILE} from './numeric-profile.mjs';
import {NUMERIC_ABI as ABI,NUMERIC_STATUS as S} from './numeric-program.mjs';
import '../experimental-arithmetic-graph.js';
const Graph=globalThis.LabArithmeticGraphExperimental,MAGIC=0x52434e43;
export const NUMERIC_CONTINUATION=Object.freeze({words:8,magic:MAGIC,program:1,scratch:2,instruction:3,initialized:4,status:5,reserved:6});
function endBrace(code,open){let depth=1,end=open+1;for(;depth&&end<code.length;end++){if(code[end]==='{')depth++;else if(code[end]==='}')depth--;}if(depth)throw new Error('Numeric source body no longer balanced');return end;}
/** Requires rc_state as well as the usual immutable rc_program / rc_scratch.
 * The control record and scratch slice belong to exactly one invocation.
 * The program is immutable from begin through completion. No shader barrier
 * or cross-lane data exchange is required. There is NO nested node loop. */
export function generateNumericContinuationWGSL({numericProfile=NUMERIC_PROFILE.PRESERVED_F32}={}){
 const source=generateProfiledNumericWGSL(numericProfile),start=source.indexOf('fn rc_num_eval('),open=source.indexOf('{',start),end=endBrace(source,open),body=source.slice(open+1,end-1);
 const initialize=body.indexOf('  var initialized=inputs;'),loop=body.indexOf('  for(var i=0u;i<nodes;i++) {'),loopOpen=body.indexOf('{',loop),loopEnd=endBrace(body,loopOpen);
 if(start<0||initialize<0||loop<initialize||loopOpen<0)throw new Error('Numeric source continuation boundaries changed');
 const preamble=body.slice(0,initialize),instruction=body.slice(loopOpen+1,loopEnd-1),finish=body.slice(loopEnd);
 if(!finish.includes('  if (initialized!=registers)'))throw new Error('Numeric source completion boundary changed');
 return source.slice(0,start)+source.slice(end)+`
fn rc_num_cont_begin(programBase:u32,scratchBase:u32,control:u32)->u32{
 if(control>arrayLength(&rc_state)||arrayLength(&rc_state)-control<8u){return 2u;}
 for(var k=0u;k<8u;k++){rc_state[control+k]=0u;}
${preamble}
 rc_state[control]=${MAGIC}u;rc_state[control+1u]=programBase;rc_state[control+2u]=scratchBase;
 rc_state[control+3u]=0u;rc_state[control+4u]=inputs;rc_state[control+5u]=0u;return 0u;
}
fn rc_num_cont_instruction_inner(control:u32)->u32{
 let programBase=rc_state[control+1u];let scratchBase=rc_state[control+2u];
 let inputs=rc_program[programBase+3u];let outputs=rc_program[programBase+4u];
 let registers=rc_program[programBase+5u];let nodes=rc_program[programBase+6u];
 let instructions=rc_program[programBase+7u];let outputOffset=rc_program[programBase+8u];
 let i=rc_state[control+3u];var initialized=rc_state[control+4u];
 if(i>nodes||initialized<inputs||initialized>registers){return rc_num_fail(scratchBase,registers,2u);}
 if(i<nodes){
${instruction}
  rc_state[control+3u]=i+1u;rc_state[control+4u]=initialized;
  if(i+1u<nodes){return 0u;}
 }
${finish}
}
fn rc_num_cont_instruction(control:u32)->u32{
 if(control>arrayLength(&rc_state)||arrayLength(&rc_state)-control<8u){return 2u;}
 if(rc_state[control]!=${MAGIC}u||rc_state[control+6u]!=0u||rc_state[control+7u]!=0u){return 2u;}
 let prior=rc_state[control+5u];if(prior!=0u){return prior;}
 let status=rc_num_cont_instruction_inner(control);rc_state[control+5u]=status;return status;
}
`;
}
const bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0],finite=w=>(w&0x7f800000)!==0x7f800000;
const arities=[0,2,2,2,2,2,2,1,1,2,3,2,2,2,1,1];
/** TEST ONLY host oracle; never a production continuation/fallback. */
export function beginNumericContinuationForTest(compilation,input,{testOnly=false,programBase=0}={}){
 if(testOnly!==true)throw new TypeError('Numeric continuation oracle is TEST-ONLY');
 const p=compilation instanceof Uint32Array?compilation:compilation?.program,b=programBase;
 const bad=()=>{const e=new RangeError('Malformed numeric continuation program');e.numericStatus=S.MALFORMED;throw e;};
 if(!(p instanceof Uint32Array)||!Number.isSafeInteger(b)||b<0||p.length-b<12)bad();
 const [magic,version,total,inputs,outputs,registers,nodes,instructions,outputOffset,iw,statusSlot,reserved]=p.subarray(b,b+12);
 if(magic!==ABI.magic||version!==ABI.version||total<12||total>p.length-b||inputs<1||inputs>65536||outputs<1||outputs>1000000||nodes>1000000||registers<inputs||registers>inputs+nodes||instructions!==12||outputOffset!==12+nodes*5||total!==outputOffset+outputs||iw!==5||statusSlot!==registers||reserved!==0)bad();
 if(!(input instanceof Float32Array)||input.length!==inputs)throw new TypeError('Exact f32 continuation inputs required');
 const words=new Uint32Array(registers+1);words.set(new Uint32Array(input.buffer,input.byteOffset,input.length));
 const state={program:p,programBase:b,inputs,outputs,registers,nodes,instructions,outputOffset,words,instruction:0,initialized:inputs,status:S.INCOMPLETE,output:null};
 if(Array.from(words.subarray(0,inputs)).some(w=>!finite(w)))state.status=words[registers]=S.NONFINITE;
 return state;
}
export function advanceNumericContinuationForTest(state,{testOnly=false,instructions=1}={}){
 if(testOnly!==true)throw new TypeError('Numeric continuation oracle is TEST-ONLY');
 if(!Number.isSafeInteger(instructions)||instructions<1)throw new RangeError('Positive instruction budget required');
 const s=state,p=s.program,b=s.programBase,w=s.words,f=new Float32Array(w.buffer,w.byteOffset,w.length),fail=status=>(s.status=w[s.registers]=status);
 for(let step=0;step<instructions&&s.status===S.INCOMPLETE;step++){
  if(s.instruction<s.nodes){const at=b+s.instructions+s.instruction*5,[op,dst,aa,bb,cc]=p.subarray(at,at+5),arity=arities[op];
   if(op>15||dst>=s.registers||dst>s.initialized||[aa,bb,cc].slice(0,arity).some(x=>x>=s.initialized)){fail(S.MALFORMED);break;}
   let word;if(op===0)word=aa;else{const a=f[aa],q=arity>1?f[bb]:0,c=arity>2?f[cc]:0;
    if(op===4&&q===0||op===7&&a<0){fail(S.DOMAIN);break;}
    if(op===15)word=(w[aa]^0x80000000)>>>0;else if(op===14)word=(0x3f800000|(w[aa]&0x80000000))>>>0;else if(op===10)word=w[a!==0?bb:cc];else word=bits(Graph.OPERATIONS[op].cpu(...[a,q,c].slice(0,arity)));
   }
   if(!finite(word)){fail(S.NONFINITE);break;}w[dst]=word;if(dst===s.initialized)s.initialized++;s.instruction++;
  }
  if(s.instruction===s.nodes){if(s.initialized!==s.registers){fail(S.MALFORMED);break;}const out=new Uint32Array(s.outputs);for(let i=0;i<s.outputs;i++){const slot=p[b+s.outputOffset+i];if(slot>=s.initialized){fail(S.MALFORMED);break;}if(!finite(w[slot])){fail(S.NONFINITE);break;}out[i]=w[slot];}if(s.status!==S.INCOMPLETE)break;s.output=new Float32Array(out.buffer);s.status=w[s.registers]=S.COMPLETE;}
 }
 return s.status;
}
