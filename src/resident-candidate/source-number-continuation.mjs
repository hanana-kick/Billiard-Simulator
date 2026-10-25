/* SPDX-License-Identifier: Apache-2.0
 * Opt-in one-instruction continuation of the ORIGINAL binary64 source VM.
 * Registers, source PC, call stack and per-program instruction cap are unchanged.
 * No complete-program loop is nested inside a world's resident job loop.
 */
import {generateRawStrikeProgramWGSL,executeSourceNumberProgramReference} from './raw-strike.mjs';
import {generateSourceNumberWGSL,numberWords,wordsNumber} from './source-number.mjs';

function closingBrace(text,open){let depth=1,end=open+1;for(;depth&&end<text.length;end++){if(text[end]==='{')depth++;else if(text[end]==='}')depth--;}if(depth)throw Error('Unbalanced source VM boundary');return end;}
function fn(source,name){const begin=source.indexOf('fn '+name+'(');if(begin<0)throw Error('Missing original source VM function '+name);return source.slice(begin,closingBrace(source,source.indexOf('{',begin)));}
/** Caller declares rc_program and rc_state. No rc_inputs binding is required.
 * rc_source_program_instruction(pb,sb,cb) returns the original control status:
 * 0 pending, 1 halt, 2 malformed, 3 source instruction/call-stack capacity.
 * The dispatch instruction budget never replaces the source program cap. */
export function generateSourceNumberContinuationWGSL({includeNumberLibrary=true}={}){
 const source=generateRawStrikeProgramWGSL({includeNumberLibrary:false}),original=fn(source,'rc_raw_program_step'),open=original.indexOf('{'),body=original.slice(open+1,-1);
 const marker=' for(var step=0u;step<budget;step++){',start=body.indexOf(marker),loopOpen=body.indexOf('{',start),end=closingBrace(body,loopOpen);
 if(start<0||!body.includes('if(rc_state[cb+1u]!=0u){return;}'))throw Error('Original Number instruction boundaries changed');
 const prefix=body.slice(0,start).replace('if(rc_state[cb+1u]!=0u){return;}','if(rc_state[cb+1u]!=0u){return rc_state[cb+1u];}'),instruction=body.slice(loopOpen+1,end-1),tail=body.slice(end);
 // The original instruction body's break statements leave its instruction
 // loop. A single switch/default preserves precisely that exit/writeback
 // behavior without another loop or an early return that loses pc/sp.
 const step=`fn rc_source_program_instruction(pb:u32,sb:u32,cb:u32)->u32{${prefix}\n switch 0u {default:{${instruction}\n }}${tail}\n return rc_state[cb+1u];\n}`;
 const names=['rc_rsp_get','rc_rsp_set','rc_rsp_int','rc_rsp_trunc','rc_rsp_scalbn','rc_source_program_init','rc_source_program_input','rc_source_program_finish'];
 return (includeNumberLibrary?generateSourceNumberWGSL():'')+names.map(name=>fn(source,name)).join('\n')+'\n'+step;
}

// TEST ONLY: extract the unchanged original JS reference opcode body as well.
// This reference is never imported by production submission as a fallback.
const reference=executeSourceNumberProgramReference.toString(),loop=reference.indexOf(' while(!done&&steps++<maximumInstructions){'),loopOpen=reference.indexOf('{',loop),loopEnd=closingBrace(reference,loopOpen);
if(loop<0)throw Error('Original source reference instruction boundary changed');
const referenceInstruction=reference.slice(loopOpen+1,loopEnd-1);
const advanceReference=new Function('s','instructions','numberWords','wordsNumber',`
 const p=s.compilation,w=p.words,regs=s.registers,stack=s.stack,maximumInstructions=s.maximumInstructions;
 let pc=s.pc,steps=s.steps,done=s.status===1;
 try{for(let n=0;n<instructions&&s.status===0;n++){
  if(steps>=maximumInstructions){s.status=3;break;}steps++;
  ${referenceInstruction}
  if(done)s.status=1;
 }}catch(error){s.status=error.message==='Raw call capacity'?3:2;s.error=error.message;}
 s.pc=pc;s.steps=steps;
 if(s.status===1&&!s.output){const raw=new Uint32Array(p.outputWords);
  for(let i=0;i<w[8];i++){const at=w[9]+i*3,[dest,reg,integer]=w.subarray(at,at+3);if(integer===1)raw[dest]=regs[reg]>>>0;else if(integer===2)raw[dest]=new Uint32Array(Float32Array.of(regs[reg]).buffer)[0];else raw.set(numberWords(regs[reg]),dest);}s.output=raw;
 }return s.status;`);
export function beginSourceNumberContinuationForTest(compilation,inputs,{testOnly=false,maximumInstructions=compilation?.maximumInstructions}={}){
 if(testOnly!==true)throw TypeError('Source Number continuation is TEST-ONLY');
 const p=compilation,w=p?.words;if(!(w instanceof Uint32Array)||inputs.length!==w[10]||!Number.isInteger(maximumInstructions)||maximumInstructions<1||maximumInstructions>p.maximumInstructions)throw RangeError('Exact source program/input/cap required');
 const registers=new Float64Array(p.registerCount);for(let i=0;i<w[6];i++){const at=w[7]+i*3;registers[w[at]]=wordsNumber(w.subarray(at+1,at+3));}inputs.forEach((value,i)=>{registers[w[w[11]+i]]=value;});
 return{compilation:p,registers,stack:[],pc:0,steps:0,status:0,output:null,maximumInstructions};
}
export function advanceSourceNumberContinuationForTest(state,{testOnly=false,instructions=1}={}){
 if(testOnly!==true)throw TypeError('Source Number continuation is TEST-ONLY');if(!Number.isInteger(instructions)||instructions<1)throw RangeError('Positive instruction budget required');return advanceReference(state,instructions,numberWords,wordsNumber);
}
/** TEST ONLY adapter over the actual packed register/control words. A fresh
 * adapter can resume another adapter's state: no hidden Map owns the PC/stack.
 * Designed for unchanged gather/scatter dialects in flat-owner host gates. */
export function createSourceNumberContinuationForTest(program,state,{testOnly=false}={}){
 if(testOnly!==true)throw TypeError('Source Number continuation is TEST-ONLY');if(!(program instanceof Uint32Array)||!(state instanceof Uint32Array))throw TypeError('Owned program and state words required');
 const cache=new Map(),compiled=pb=>{if(cache.has(pb))return cache.get(pb);if(!Number.isInteger(pb)||pb<0||pb+16>program.length||program[pb]!==0x52435350||program[pb+1]!==1||pb+program[pb+2]>program.length)throw RangeError('Original source program transport required');const w=program.subarray(pb,pb+program[pb+2]),p={words:w,registerCount:w[3],registerWords:w[3]*2,controlWords:4+w[12],maximumInstructions:w[13],outputWords:w[14]};cache.set(pb,p);return p;};
 const range=(base,count)=>{if(!Number.isInteger(base)||base<0||base+count>state.length)throw RangeError('Source state range');};
 const registers=(p,sb)=>{range(sb,p.registerWords);return new Float64Array(state.slice(sb,sb+p.registerWords).buffer);};
 const init=(pb,sb,cb)=>{const p=compiled(pb),w=p.words;range(sb,p.registerWords);range(cb,p.controlWords);state.fill(0,sb,sb+p.registerWords);state.fill(0,cb,cb+p.controlWords);for(let i=0;i<w[6];i++){const at=w[7]+i*3;state.set(w.subarray(at+1,at+3),sb+w[at]*2);}};
 const input=(pb,sb,index,value)=>{const p=compiled(pb),w=p.words;if(index>=w[10]||value.length!==2)throw RangeError('Source input index/words');const at=sb+w[w[11]+index]*2;range(at,2);state.set(value,at);};
 const instruction=(pb,sb,cb)=>{const p=compiled(pb);range(cb,p.controlWords);if(state[cb+1]!==0)return state[cb+1];const sp=state[cb+3];if(sp>p.controlWords-4){state[cb+1]=3;return 3;}const s={compilation:p,registers:registers(p,sb),stack:Array.from(state.subarray(cb+4,cb+4+sp)),pc:state[cb],steps:state[cb+2],status:0,output:null,maximumInstructions:p.maximumInstructions};advanceReference(s,1,numberWords,wordsNumber);state.set(new Uint32Array(s.registers.buffer),sb);state[cb]=s.pc;state[cb+1]=s.status;state[cb+2]=s.steps;state[cb+3]=s.stack.length;state.set(s.stack,cb+4);return s.status;};
 const finish=(pb,sb,cb,ob)=>{const p=compiled(pb),w=p.words;range(cb,p.controlWords);const done=state[cb+1];if(done!==1)return done;range(ob,p.outputWords);state.fill(0,ob,ob+p.outputWords);const r=registers(p,sb);for(let i=0;i<w[8];i++){const at=w[9]+i*3,[dest,reg,integer]=w.subarray(at,at+3);if(integer===1)state[ob+dest]=r[reg]>>>0;else if(integer===2)state[ob+dest]=new Uint32Array(Float32Array.of(r[reg]).buffer)[0];else state.set(numberWords(r[reg]),ob+dest);}return done;};
 return Object.freeze({init,input,instruction,finish});
}
