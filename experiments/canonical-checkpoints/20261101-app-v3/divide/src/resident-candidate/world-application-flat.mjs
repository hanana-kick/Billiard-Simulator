/* SPDX-License-Identifier: Apache-2.0
 * Opt-in bounded-instruction driver for the original application continuation.
 * Source gather/scatter, event walk, angular order, binary64 clocks and rule
 * boundaries are unchanged. This is not a whole-world or performance proof.
 */
import {generateApplicationWGSL,APPLICATION_DRIVER} from './application.mjs';
import {generateWorldApplicationWGSL} from './world-application.mjs';
import {generateNumericContinuationWGSL} from './numeric-continuation.mjs';
import {generateSourceNumberContinuationWGSL} from './source-number-continuation.mjs';
import {NUMERIC_PROFILE} from './numeric-profile.mjs';
export const WORLD_APPLICATION_FLAT=Object.freeze({words:16,magic:0x52434146,status:1,hSequence:2,mode:3,worldPhase:4,
 activeKind:5,jobs:6,program:7,numericControl:8,maximumJobs:APPLICATION_DRIVER.maximumJobs,
 defaultInstructionBudget:32768,maxInstructionBudget:1000000,optIn:true,nativeQualified:false,defaultBackend:false});
function functionEnd(code,start){const open=code.indexOf('{',start);let depth=1,end=open+1;for(;depth&&end<code.length;end++){if(code[end]==='{')depth++;else if(code[end]==='}')depth--;}if(depth)throw Error('Unbalanced application evaluator');return end;}
function integerApplication(programs){const code=generateApplicationWGSL(programs),start=code.indexOf('fn rc_application_stage_evaluate(');if(start<0)throw Error('Original application evaluator boundary changed');return code.slice(0,start)+code.slice(functionEnd(code,start));}
const DRIVER=String.raw`
fn rc_world_application_flat_fail(bank:u32,control:u32,status:u32)->u32{
 rc_app_fail(bank+WAO_application,status);rc_world_application_check(bank);rc_state[control+1u]=2u;return 2u;
}
// Caller begins exactly once after the existing owner begins mode15 or mode16.
// A non-outer h's scheduled outer call is a no-op, just like the baseline.
fn rc_world_application_flat_begin(bank:u32,control:u32)->u32{
 if(rc_state[bank+2u]!=1u){return 2u;}let phase=rc_state[bank+WAO_worldApplication+WA_phase];if(phase!=4u&&phase!=6u){return 1u;}
 if(control>arrayLength(&rc_state)||arrayLength(&rc_state)-control<16u){rc_world_application_fail(bank,6u,1u);return 2u;}
 let a=bank+WAO_application;if(rc_state[a+WAA_jobType]!=0u||rc_state[a+WAA_complete]!=0u){return rc_world_application_flat_fail(bank,control,1u);}
 for(var i=0u;i<16u;i++){rc_state[control+i]=0u;}rc_state[control]=0x52434146u;rc_state[control+2u]=rc_state[bank+5u];rc_state[control+3u]=rc_state[a+WAA_mode];rc_state[control+4u]=phase;return 0u;
}
fn rc_world_application_flat_advance(bank:u32,scratch:u32,control:u32,instructionBudget:u32)->u32{
 if(rc_state[bank+2u]!=1u){return 2u;}let phase=rc_state[bank+WAO_worldApplication+WA_phase];if(phase!=4u&&phase!=6u){return 1u;}
 if(control>arrayLength(&rc_state)||arrayLength(&rc_state)-control<16u){rc_world_application_fail(bank,6u,1u);return 2u;}
 let a=bank+WAO_application;let w=rc_world_application_work(bank,scratch);
 if(rc_state[control]!=0x52434146u||rc_state[control+2u]!=rc_state[bank+5u]||rc_state[control+3u]!=rc_state[a+WAA_mode]||rc_state[control+4u]!=phase||instructionBudget==0u||instructionBudget>1000000u){return rc_world_application_flat_fail(bank,control,1u);}
 let prior=rc_state[control+1u];if(prior!=0u){return prior;}var executed=0u;
 loop{
  if(executed>=instructionBudget){return 0u;}
  if(rc_state[a+WAA_jobType]==0u){rc_world_application_gather(bank,scratch);if(rc_state[bank+2u]!=1u){rc_state[control+1u]=2u;return 2u;}}
  if(rc_state[a+WAA_complete]!=0u){if(rc_state[a+WAA_jobType]!=0u||rc_state[control+5u]!=0u){return rc_world_application_flat_fail(bank,control,1u);}rc_state[control+1u]=1u;return 1u;}
  let kind=rc_state[a+WAA_jobType];let program=rc_state[a+WAA_jobProgram];if(kind!=1u&&kind!=2u){return rc_world_application_flat_fail(bank,control,1u);}
  if(rc_state[control+5u]==0u){
   if(rc_state[control+6u]>=1542u){return rc_world_application_flat_fail(bank,control,2u);}
   rc_state[control+5u]=kind;rc_state[control+6u]++;rc_state[control+7u]=program;
   if(kind==2u){let started=rc_num_cont_begin(program,w.numeric,control+8u);if(started!=0u){rc_state[a+WAA_jobDone]=started;rc_world_application_scatter(bank,scratch);rc_state[control+1u]=2u;return 2u;}}
  }
  if(rc_state[control+5u]!=kind||rc_state[control+7u]!=program||rc_state[a+WAA_jobDone]!=0u){return rc_world_application_flat_fail(bank,control,1u);}
  var done=0u;if(kind==1u){done=rc_source_program_instruction(program,w.registers,w.control);}else{done=rc_num_cont_instruction(control+8u);}executed++;
  if(done==0u){continue;}
  if(kind==1u){done=rc_source_program_finish(program,w.registers,w.control,w.output);}
  rc_state[a+WAA_jobDone]=done;rc_world_application_scatter(bank,scratch);rc_state[control+5u]=0u;rc_state[control+7u]=0u;
  if(rc_state[bank+2u]!=1u){rc_state[control+1u]=2u;return 2u;}
 }
}
`;
/** includeLibraries=false emits ONLY the driver; link with existing world
 * application integer helpers and both shared one-instruction libraries.
 * Explicit controlBase may reuse a sequential owner's 16-word control region.
 * Existing finish_post_h/finish_outer remain the only publication authorities. */
export function generateWorldApplicationFlatWGSL(template,{numericProfile=NUMERIC_PROFILE.PRESERVED_F32,includeLibraries=true}={}){
 if(!template?.bundles?.application)throw TypeError('Exact application program bundle required');
 if(!includeLibraries)return DRIVER;
 return generateNumericContinuationWGSL({numericProfile})+generateSourceNumberContinuationWGSL({includeNumberLibrary:numericProfile===NUMERIC_PROFILE.DEVICE_F32})+
  integerApplication(template.bundles.application)+generateWorldApplicationWGSL(template)+DRIVER;
}
/** Static longest path through actual program bytecode, including call/return.
 * Application programs contain no recursive/backward cycle; if that changes,
 * retain the ORIGINAL program cap (+ its explicit exhaustion check), not an
 * assumed sampled instruction count. Branches are both explored, not pruned
 * using candidate values. This is a dispatch bound, never a physics bound. */
export function sourceProgramInstructionBound(compilation){
 const p=compilation,w=p.words,memo=new Map(),active=new Set();let cyclic=false;
 const visit=(pc,stack)=>{const key=pc+':'+stack.join(',');if(memo.has(key))return memo.get(key);if(active.has(key)){cyclic=true;return p.maximumInstructions+1;}if(pc>=w[4])return 1;active.add(key);const at=w[5]+pc*4,[op,d]=w.subarray(at,at+2);let next;
  if(op===27)next=0;else if(op===23)next=visit(d,stack);else if(op===24)next=Math.max(visit(d,stack),visit(pc+1,stack));else if(op===25)next=stack.length>=w[12]?0:visit(d,[...stack,pc+1]);else if(op===26)next=stack.length?visit(stack.at(-1),stack.slice(0,-1)):0;else next=visit(pc+1,stack);
  active.delete(key);const n=Math.min(p.maximumInstructions+1,1+next);memo.set(key,n);return n;};
 const instructions=visit(0,[]);return Object.freeze({instructions:cyclic?p.maximumInstructions+1:instructions,acyclic:!cyclic,sourceCap:p.maximumInstructions});
}
export function worldApplicationFlatDispatchBound(programs,{mode=15,instructionBudget=WORLD_APPLICATION_FLAT.defaultInstructionBudget}={}){
 if(!Number.isInteger(mode)||mode<1||mode>63||!Number.isInteger(instructionBudget)||instructionBudget<1||instructionBudget>WORLD_APPLICATION_FLAT.maxInstructionBudget)throw RangeError('Original mode and bounded instruction chunk required');
 const bounds=Object.fromEntries(Object.entries(programs.entries).map(([name,e])=>[name,name==='native'?e.compiled.nodeCount:sourceProgramInstructionBound(e.compiled).instructions]));
 // Preserve all 256 event rows, 4 bodies x128 incidences (with both numerical
 // jobs per angular application), and all four anyMotion checks. No sampled
 // smaller contact/event/solver cap is substituted to reduce dispatch count.
 let instructions=1,jobs=0;if(mode&1){instructions+=bounds.clock;jobs++;}if(mode&4){instructions+=256*(bounds.filter+bounds.group);jobs+=512;}if(mode&8){instructions+=4*128*(bounds.angular+bounds.native);jobs+=1024;}if(mode&16){instructions+=bounds.outer;jobs++;}if(mode&32){instructions+=4*bounds.motion;jobs+=4;}
 return Object.freeze({mode,instructionBudget,instructions,dispatches:Math.ceil(instructions/instructionBudget),maximumJobs:jobs,programBounds:Object.freeze(bounds),sourceMaximumJobs:APPLICATION_DRIVER.maximumJobs,finalGatherIncluded:true});
}
