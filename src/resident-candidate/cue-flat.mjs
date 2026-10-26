/* SPDX-License-Identifier: Apache-2.0
 * Opt-in source-ordered cue application/joint instruction driver. The original
 * stage prepare/scatter bodies and all original program budgets are retained.
 * Flat scheduling changes dispatch transport, never source physics equations.
 */
import {generateCueOrchestrationWGSL} from './cue-orchestration.mjs';
import {generateNumericContinuationWGSL,beginNumericContinuationForTest,advanceNumericContinuationForTest} from './numeric-continuation.mjs';
import {generateSourceNumberContinuationWGSL,createSourceNumberContinuationForTest} from './source-number-continuation.mjs';
import {NUMERIC_PROFILE} from './numeric-profile.mjs';
import {sourceNumberReference as N,numberWords} from './source-number.mjs';

export const CUE_FLAT_LAYOUT=Object.freeze({controlWords:8,defaultInstructionBudget:32768,
 maxInstructionBudget:1000000,optIn:true,nativeQualified:false,defaultBackend:false});
function cueFunctions(stage){
 const source=generateCueOrchestrationWGSL(stage),parts=[];
 for(const match of source.matchAll(/\bfn (rc_cue_\w+)\(/g)){
  const open=source.indexOf('{',match.index);let depth=1,end=open+1;
  for(;depth&&end<source.length;end++){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;}
  if(depth)throw new Error('Original cue stage source boundary changed');parts.push(source.slice(match.index,end));
 }return parts;
}
function stages(){
 const unique=new Map();for(const part of[...cueFunctions('prepare'),...cueFunctions('scatter')]){
  const name=/fn (\w+)/.exec(part)[1],old=unique.get(name);if(old!==undefined&&old!==part)throw new Error('Original cue helper differs between stages');unique.set(name,part);
 }return [...unique.values()].join('\n');
}
const DRIVER=`
fn rc_cue_flat_begin(b:u32,p:u32,mode:u32,control:u32)->u32{
 if(control>arrayLength(&rc_state)||arrayLength(&rc_state)-control<8u){return 2u;}
 let status=rc_cue_begin(b,p,mode);if(status!=0u){return status;}
 for(var i=0u;i<8u;i++){rc_state[control+i]=0u;}return 0u;
}
fn rc_cue_flat_advance(b:u32,ball:u32,others:u32,otherCount:u32,p:u32,scratch:u32,control:u32,instructionBudget:u32)->u32{
 if(!rc_cue_valid(b,p)){return 2u;}
 let prior=rc_state[b+2u];if(prior!=0u){return prior;}
 if(control>arrayLength(&rc_state)||arrayLength(&rc_state)-control<8u||instructionBudget==0u||instructionBudget>1000000u){return rc_cue_fail(b,2u,4u);}
 var executed=0u;
 loop{
  if(executed>=instructionBudget){return 0u;}
  if(rc_state[b+48u]==0u){
   let prepared=rc_cue_prepare(b,ball,others,otherCount,p,scratch);if(prepared!=0u){return prepared;}
   rc_state[control]=0u;
  }
  let kind=rc_state[b+48u];var status=0u;
  if(kind==1u){
   if(rc_state[control]==0u){let started=rc_num_cont_begin(rc_state[b+58u],scratch,control);if(started!=0u){return rc_cue_fail(b,started,6u);}}
   status=rc_num_cont_instruction(control);executed++;
   rc_state[b+59u]=status;if(status>1u){return rc_cue_fail(b,status,6u);}
  }else if(kind==2u){
   let regs=b+1472u;let sourceControl=regs+rc_program[p+4u];
   status=rc_source_program_instruction(rc_state[b+58u],regs,sourceControl);executed++;
   rc_state[b+59u]=status;if(status>1u){return rc_cue_fail(b,select(2u,4u,status==3u),7u);}
  }else{return rc_cue_fail(b,2u,5u);}
  if(status==0u){continue;}
  let scattered=rc_cue_scatter(b,ball,p,scratch);if(scattered!=0u){return scattered;}
  rc_state[control]=0u;
 }
}
`;
/** Both cursors live in rc_state. The caller loads instructionBudget from
 * immutable dispatch metadata. Mode0 must stop before world scene/geometry/CCD;
 * mode1 is begun separately after the genuine world solver prerequisites.
 * Each begin resets the eight external f32 words; source controls are reset by
 * the unchanged per-source-stage prepare. No physics-dependent host planning. */
export function generateCueFlatWGSL({numericProfile=NUMERIC_PROFILE.PRESERVED_F32}={}){
 return generateNumericContinuationWGSL({numericProfile})+
  generateSourceNumberContinuationWGSL({includeNumberLibrary:numericProfile===NUMERIC_PROFILE.DEVICE_F32})+stages()+DRIVER;
}
/** TEST ONLY exact integer staging dialect with explicit instruction oracles.
 * Accepts a retained result for another fixed-budget dispatch; no CPU runtime
 * fallback. Input state is copied and explicit testOnly is mandatory. */
export function executeCueFlatForTest(bundle,initial,{testOnly=false,cueBase=0,ballBase,othersBase,
 otherCount=3,programBase=0,scratchBase=0,controlBase,mode=0,begin=true,
 instructionBudget=32768,dispatches=16,retained}={}){
 if(testOnly!==true)throw new TypeError('Cue flat oracle is TEST-ONLY');
 if(!(initial instanceof Uint32Array)||!(bundle?.program instanceof Uint32Array))throw new TypeError('Owned cue allocation and immutable bundle required');
 if(!Number.isSafeInteger(dispatches)||dispatches<1||!Number.isInteger(instructionBudget)||instructionBudget<1||instructionBudget>1000000)throw new RangeError('Fixed positive cue instruction schedule required');
 const rc_state=retained?.state??initial.slice(),rc_program=bundle.program,rc_scratch=retained?.scratch??new Uint32Array(scratchBase+bundle.scratchWords),continuations=retained?.continuations??new Map();
 const source=createSourceNumberContinuationForTest(rc_program,rc_state,{testOnly:true});
 const beginNumeric=(pb,sb,control)=>{
  if(control>rc_state.length||rc_state.length-control<8)return 2;rc_state.fill(0,control,control+8);
  let item;try{item=beginNumericContinuationForTest(rc_program,new Float32Array(rc_scratch.buffer,sb*4,rc_program[pb+3]),{testOnly:true,programBase:pb});}catch(e){return e.numericStatus??2;}
  if(sb>rc_scratch.length||rc_scratch.length-sb<item.words.length)return 2;
  // Original rc_num_cont_begin changes only the status slot, not unassigned
  // registers. Keep dirty words so a partial node budget does not invent zeros.
  const status=item.status;item.words.set(rc_scratch.subarray(sb,sb+item.words.length));item.words[item.registers]=status;rc_scratch.set(item.words,sb);
  if(status!==0)return status;continuations.set(control,item);rc_state.set([0x52434e43,pb,sb,0,item.initialized,0,0,0],control);return 0;
 };
 const instruction=control=>{const item=continuations.get(control);if(!item)return 2;const status=advanceNumericContinuationForTest(item,{testOnly:true});rc_scratch.set(item.words,rc_state[control+2]);rc_state[control+3]=item.instruction;rc_state[control+4]=item.initialized;rc_state[control+5]=status;return status;};
 let code=(stages()+DRIVER).replace(/fn (\w+)\(([^)]*)\)(?:->(?:u32|bool))?\s*\{/g,(_,name,args)=>`function ${name}(${args.replace(/:(?:u32|bool)/g,'')}){`)
  .replace(/:(?:u32|bool)(?=\s*=)/g,'').replace(/\b(0x[0-9a-f]+|\d+)u\b/g,'$1').replace(/\bvar\b/g,'let').replace(/\bloop\s*\{/g,'while(true){')
  .replace(/arrayLength\(&([a-z_]+)\)/g,'$1.length').replace(/bitcast<f32>\(/g,'number(');
 const word=new Uint32Array(1),float=new Float32Array(word.buffer),number=w=>(word[0]=w,float[0]);
 const names=['rc_state','rc_program','rc_scratch','rc_num_cont_begin','rc_num_cont_instruction','rc_source_program_init','rc_source_program_input','rc_source_program_instruction','rc_source_program_finish','RcF64','rc_f64_from_f32_bits','rc_f64_from_u32','rc_f64_to_f32_bits','rc_f64_zero','select','number'];
 const values=[rc_state,rc_program,rc_scratch,beginNumeric,instruction,source.init,source.input,source.instruction,source.finish,(lo=0,hi=0)=>Uint32Array.of(lo,hi),N.fromF32,x=>numberWords(x>>>0),N.toF32,x=>((x[0]|(x[1]&0x7fffffff))===0),(a,b,p)=>p?b:a,number];
 const api=new Function(...names,code+'\nreturn {begin:rc_cue_flat_begin,advance:rc_cue_flat_advance};')(...values);
 let status=begin?api.begin(cueBase,programBase,mode,controlBase):rc_state[cueBase+2],used=0;
 for(;used<dispatches&&status===0;used++)status=api.advance(cueBase,ballBase,othersBase,otherCount,programBase,scratchBase,controlBase,instructionBudget);
 return{state:rc_state,scratch:rc_scratch,continuations,status,dispatches:used};
}
/** Immutable upper bound only: retain every source program's declared maximum
 * instructions plus its exhaustion check, all three separation/initialization
 * jobs, and the full larger
 * cloth-joint graph. This does not inspect mutable physics or shorten a solve. */
export function cueFlatDispatchCapacity(bundle,{instructionBudget=32768,includeSolve=true}={}){
 if(!Number.isInteger(instructionBudget)||instructionBudget<1||instructionBudget>1000000)throw new RangeError('Bounded cue instruction budget required');
 const application=3*bundle.entries[0].compiled.nodeCount+bundle.entries[1].compiled.nodeCount+3*bundle.entries[2].compiled.nodeCount+bundle.numbers.reduce((n,p)=>n+p.words[13]+1,0),solve=Math.max(bundle.entries[3].compiled.nodeCount,bundle.entries[4].compiled.nodeCount);
 return Object.freeze({applicationInstructions:application,solveInstructions:solve,dispatches:Math.ceil(application/instructionBudget)+(includeSolve?Math.ceil(solve/instructionBudget):0),instructionBudget});
}
