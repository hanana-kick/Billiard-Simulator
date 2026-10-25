/* SPDX-License-Identifier: Apache-2.0
 * Opt-in flat instruction driver for the original ordered coupled solver.
 * Proven gather/scatter/phase selection is retained; the numerical VM executes
 * ONE source instruction per outer iteration, not a nested complete graph.
 * This is unqualified until its own native differential gate passes.
 */
import {generateCoupledStagedWGSL} from './coupled-solver.mjs';
import {generateNumericContinuationWGSL,beginNumericContinuationForTest,advanceNumericContinuationForTest} from './numeric-continuation.mjs';
import {NUMERIC_PROFILE} from './numeric-profile.mjs';
export const COUPLED_FLAT_LAYOUT=Object.freeze({control:28,controlWords:8,maxInstructionBudget:1000000,
 defaultInstructionBudget:32768,optIn:true,nativeQualified:false,defaultBackend:false});
function integerStages(){
 let gather=generateCoupledStagedWGSL('gather');
 const old='  for(var i=0u;i<352u;i++) { rc_scratch[scratch+i]=0u; }';
 if(!gather.includes(old))throw new Error('Original coupled input-clear boundary changed');
 // Identical immutable352 bound, transported via program metadata to prevent
 // drivers from expanding the clear loop inside the instruction interpreter.
 gather=gather.replace(old,'  let inputWords=rc_program[np+3u];if(inputWords!=352u){return 2u;}\n  for(var i=0u;i<inputWords;i++) { rc_scratch[scratch+i]=0u; }');
 return gather+generateCoupledStagedWGSL('scatter');
}
const DRIVER=`
fn rc_coupled_flat_advance(commonBase:u32,coefficient:u32,roster:u32,bundle:u32,scratch:u32,instructionBudget:u32)->u32{
 let size=arrayLength(&rc_state);
 if(commonBase>size||size-commonBase<64u||roster>size||size-roster<8u){return 2u;}
 let prior=rc_state[roster+6u];if(prior!=0u){return prior;}
 if(instructionBudget==0u||instructionBudget>1000000u){return rc_cs_failure(roster,2u);}
 let control=commonBase+28u;var executed=0u;
 // Caller loads the budget from immutable dispatch metadata, not a literal
 // instruction-count unroll. Each iteration executes exactly one graph node.
 loop{
  if(executed>=instructionBudget){return 0u;}
  if(rc_state[commonBase+27u]==0u){
   let gathered=rc_coupled_gather(commonBase,coefficient,roster,bundle,scratch);
   if(gathered!=0u){return gathered;}
   if(rc_state[commonBase+27u]!=1u){return rc_cs_failure(roster,2u);}
   let started=rc_num_cont_begin(rc_state[commonBase+19u],scratch,control);
   if(started!=0u){return rc_cs_failure(roster,started);}
  }
  if(rc_state[commonBase+27u]!=1u){return rc_cs_failure(roster,2u);}
  let status=rc_num_cont_instruction(control);executed++;
  if(status==0u){continue;}
  if(status!=1u){return rc_cs_failure(roster,status);}
  rc_state[commonBase+27u]=2u;
  let scattered=rc_coupled_scatter(commonBase,roster,scratch);
  if(scattered!=0u){return scattered;}
 }
}
`;
export function generateCoupledFlatWGSL({numericProfile=NUMERIC_PROFILE.PRESERVED_F32}={}){
 return generateNumericContinuationWGSL({numericProfile})+integerStages()+DRIVER;
}
/** TEST ONLY: runs the exact integer driver dialect, substituting only the
 * explicit one-instruction numerical oracle. No production host forward path.
 * runBudgets is an immutable sequence; no body/contact facts choose work. */
export function executeCoupledFlatForTest(bundle,initial,{testOnly=false,stateBase=0,coefficientBase,rosterBase,
 scratchBase=0,instructionBudget=32768,dispatches=1000,onProgram}={}){
 if(testOnly!==true)throw new TypeError('Coupled flat host oracle is TEST-ONLY');
 if(!(initial instanceof Uint32Array)||!(bundle?.program instanceof Uint32Array)||!Number.isSafeInteger(dispatches)||dispatches<1)throw new TypeError('Owned initial state and immutable dispatch capacity required');
 if(!Number.isInteger(instructionBudget)||instructionBudget<1||instructionBudget>1000000)throw new RangeError('Bounded flat instruction budget required');
 const rc_state=initial.slice(),rc_program=bundle.program,rc_scratch=new Uint32Array(scratchBase+bundle.scratchWords),continuations=new Map();
 const begin=(pb,sb,control)=>{
  let item;try{item=beginNumericContinuationForTest(rc_program,new Float32Array(rc_scratch.buffer,sb*4,rc_program[pb+3]),{testOnly:true,programBase:pb});}catch(error){return error.numericStatus??2;}
  if(item.status!==0)return item.status;continuations.set(control,item);rc_state.set([0x52434e43,pb,sb,0,item.initialized,0,0,0],control);onProgram?.({programBase:pb,input:new Float32Array(item.words.buffer,0,item.inputs).slice()});return 0;
 };
 const instruction=control=>{const item=continuations.get(control);if(!item)return 2;const status=advanceNumericContinuationForTest(item,{testOnly:true});rc_scratch.set(item.words,rc_state[control+2]);rc_state[control+3]=item.instruction;rc_state[control+4]=item.initialized;rc_state[control+5]=status;return status;};
 let code=integerStages()+DRIVER;
 code=code.replace(/fn (\w+)\(([^)]*)\)(?:->(?:u32|bool))?\s*\{/g,(_,name,args)=>`function ${name}(${args.replace(/:(?:u32|bool)/g,'')}){`)
  .replace(/:(?:u32|bool)(?=\s*=)/g,'').replace(/\b(0x[0-9a-f]+|\d+)u\b/g,'$1').replace(/\bvar\b/g,'let')
  .replace(/\bloop\s*\{/g,'while(true){').replace(/\bswitch\s+(\w+)\s*\{/g,'switch($1){')
  .replace(/}\s*(?=case\b|default\s*:)/g,'break;}')
  .replace(/arrayLength\(&([a-z_]+)\)/g,'$1.length').replace(/bitcast<f32>\(/g,'number(').replace(/bitcast<u32>\(/g,'bits(').replace(/\bf32\(/g,'Math.fround(');
 const word=new Uint32Array(1),float=new Float32Array(word.buffer),number=w=>(word[0]=w,float[0]),bits=x=>(float[0]=x,word[0]);
 const run=new Function('rc_state','rc_program','rc_scratch','rc_num_cont_begin','rc_num_cont_instruction','select','number','bits',code+'\nreturn rc_coupled_flat_advance;')(rc_state,rc_program,rc_scratch,begin,instruction,(a,b,p)=>p?b:a,number,bits);
 let used=0,status=0;for(;used<dispatches&&status===0;used++)status=run(stateBase,coefficientBase,rosterBase,0,scratchBase,instructionBudget);
 return {state:rc_state,scratch:rc_scratch,status,dispatches:used};
}
