/* SPDX-License-Identifier: Apache-2.0
 * Opt-in, source-ordered CCD instruction driver. The unchanged persistent
 * pre/post owner selects each program; one generic numeric instruction executes
 * or one input/output copy/control micro-op per loop iteration. There is no
 * nested complete-graph interpreter or host
 * per-program continuation. Baseline staged CCD remains unchanged.
 */
import {generateCcdWGSL,pruneCcdWGSL,CCD_LAYOUT} from './ccd.mjs';
import {generateWorldCcdWGSL} from './world-ccd.mjs';
import {generateBvhWGSL} from './bvh.mjs';
import {generateNumericContinuationWGSL} from './numeric-continuation.mjs';
import {NUMERIC_PROFILE} from './numeric-profile.mjs';

export const CCD_FLAT_LAYOUT=Object.freeze({words:16,numericWords:8,owner:8,mode:9,jobs:10,phase:11,cursor:12,instructions:13,reserved:14,magic:15,magicValue:0x52434643,
 sourceJobCapacity:4096,defaultInstructionBudget:32768,maxInstructionBudget:1000000,
 phaseIdle:0,phaseNumeric:1,phaseComplete:2,phaseFailed:3,phaseGather:4,phasePublish:5,phaseControl:6,
 statusPending:0,statusComplete:1,statusFailed:2,optIn:true,nativeQualified:false,defaultBackend:false});
const need=(v,m)=>{if(!v)throw new RangeError('Flat CCD: '+m);};
const validate=(p,mode)=>{need(mode==='pre'||mode==='post','separate pre or post source call tree required');need(p?.program instanceof Uint32Array&&p.entries&&Object.keys(p.entries).length>0,'original CCD program bundle required');};
/** Immutable transport capacity, not a replacement physics iteration count.
 * The same 4096 completed source numerical jobs as the debug schedule remain
 * available. Budget counts one input copy, source opcode, output copy, or
 * source control completion. A lower budget changes dispatch count only. */
export function planCcdFlatDispatches(programs,{instructionBudget=CCD_FLAT_LAYOUT.defaultInstructionBudget}={}){
 validate(programs,'pre');need(Number.isInteger(instructionBudget)&&instructionBudget>=1&&instructionBudget<=CCD_FLAT_LAYOUT.maxInstructionBudget,'bounded instruction budget required');
 const maximumProgramInstructions=Math.max(...Object.values(programs.entries).map(e=>Math.max(1,e.compiled.nodeCount)));
 need(Number.isInteger(maximumProgramInstructions)&&maximumProgramInstructions>=1,'finite compiled source instruction counts');
 const maximumInstructions=CCD_FLAT_LAYOUT.sourceJobCapacity*maximumProgramInstructions;
 const maximumProgramMicroOps=Math.max(...Object.values(programs.entries).map(e=>e.compiled.inputCount+Math.max(1,e.compiled.nodeCount)+e.compiled.outputCount+1)),maximumMicroOps=CCD_FLAT_LAYOUT.sourceJobCapacity*maximumProgramMicroOps;
 return Object.freeze({instructionBudget,microOpBudget:instructionBudget,sourceJobCapacity:CCD_FLAT_LAYOUT.sourceJobCapacity,maximumProgramInstructions,maximumInstructions,maximumProgramMicroOps,maximumMicroOps,dispatches:Math.ceil(maximumMicroOps/instructionBudget),controlWords:16,hostContinuation:false,nativeQualified:false});
}

/** Functions only; caller supplies rc_state, rc_program and rc_scratch.
 * controlBase is an exclusive, NONOVERLAPPING 16-word candidate-local span
 * (worldH+8..23 is available while serialized flat owners reuse the span).
 * Call rc_ccd_flat_begin AFTER the original pre_begin/post_begin, once for each
 * pass owner. rc_ccd_flat_advance returns 0 pending / 1 complete / 2 failed;
 * rc_state[b] retains the original CCD error. Only completion authorizes the
 * outer world adapter to proceed. No scratch/continuation may be shared across
 * simultaneous candidates or owners. The legacy instructionBudget argument
 * now counts bounded micro-ops (copies/opcodes/control); storage-load it.
 * With worldTemplate, word14 saves the starting world evaluation count; each
 * completed job calls the unchanged world wrapper, and rc_ccd_flat_finish
 * checks the completed receipt. This preserves all adapter words exactly.
 */
export function generateCcdFlatDriverWGSL(programs,{mode,worldTemplate}={}){
 validate(programs,mode);const post=mode==='post',tag=post?2:1;
 const world=worldTemplate!==undefined,ccdOffset=worldTemplate?.segments?.ccd?.offset,bodyOffset=worldTemplate?.segments?.bodies?.offset;
 if(world)need(worldTemplate.kind==='resident-created-world-layout'&&Number.isInteger(ccdOffset)&&ccdOffset>=0&&Number.isInteger(bodyOffset)&&bodyOffset>=0,'canonical world CCD/body segment offsets required');
 const count=post?7:6,expectedPhase=post?3:1,completePhase=post?4:2;
 const valid=world?`
fn rc_ccd_flat_world_valid(b:u32,complete:bool)->bool{if(b<${ccdOffset}u){return false;}let a=rc_world_ccd_adapter(b);if(rc_state[a+1u]!=0u){return false;}if(complete){return rc_state[a]==${completePhase}u${post?'':`&&rc_state[b-${ccdOffset}u+10u]==rc_state[b+6u]`};}return rc_state[a]==${expectedPhase}u;}
`:'';
 const publish=world?`let a=rc_world_ccd_adapter(b);if(!rc_ccd_flat_world_valid(b,false)||rc_state[a+${count}u]!=rc_state[control+14u]+rc_state[control+10u]){return rc_ccd_flat_fail(b,control,4u);}
 // Identical completed-job receipt to rc_world_ccd_evaluate, including a
 // nonzero prior count. The unchanged wrapper consumes ready and publishes
 // phase/solveDt/clamps at the original job boundary, not a later collapsed sum.
 rc_state[a+1u]=1u;rc_state[a+${count}u]++;
 ${post?`rc_world_ccd_post_control(b,b-${ccdOffset}u+${bodyOffset}u,scratch,programBase);`:`rc_world_ccd_pre_control(b-${ccdOffset}u,b,scratch,programBase);`}`:`${post?'rc_ccd_post_control':'rc_ccd_pre_control'}(b,scratch,programBase);`;
 const finish=world?`
fn rc_ccd_flat_finish(b:u32,control:u32)->u32{
 let n=arrayLength(&rc_state);if(b>n||n-b<${CCD_LAYOUT.words}u||control>n||n-control<16u){return 2u;}
 if(rc_state[control+15u]!=0x52434643u||rc_state[control+8u]!=b||rc_state[control+9u]!=${tag}u){return rc_ccd_flat_fail(b,control,4u);}
 if(rc_state[b]!=0u||rc_state[control+11u]==3u){return 2u;}if(rc_state[control+11u]!=2u){return 0u;}
 if(!rc_ccd_flat_complete(b)||!rc_ccd_flat_world_valid(b,true)||rc_state[b+1184u+${count}u]!=rc_state[control+14u]+rc_state[control+10u]){return rc_ccd_flat_fail(b,control,4u);}return 1u;
}
`:'';
 const select=Object.values(programs.entries).map(e=>`case ${e.id}u:{program=programBase+${e.base}u;inputs=${e.compiled.inputCount}u;outputs=${e.compiled.outputCount}u;}`).join('\n');
 return `${valid}
fn rc_ccd_flat_fail(b:u32,control:u32,error:u32)->u32{rc_ccd_fail(b,error);rc_state[control+11u]=3u;return 2u;}
fn rc_ccd_flat_complete(b:u32)->bool{return rc_state[b+14u]==0u&&rc_state[b+1u]==2u${post?'&&rc_state[b+13u]==1u':''};}
fn rc_ccd_flat_begin(b:u32,control:u32)->u32{
 let n=arrayLength(&rc_state);if(b>n||n-b<${CCD_LAYOUT.words}u||control>n||n-control<16u){return 2u;}
 if(control<b+${CCD_LAYOUT.words}u&&b<control+16u){return 2u;}
 for(var i=0u;i<16u;i++){rc_state[control+i]=0u;}
 rc_state[control+8u]=b;rc_state[control+9u]=${tag}u;rc_state[control+15u]=0x52434643u;
 if(rc_state[b]!=0u){rc_state[control+11u]=3u;return 2u;}
 ${world?`if(!rc_ccd_flat_world_valid(b,rc_ccd_flat_complete(b))){return rc_ccd_flat_fail(b,control,4u);}rc_state[control+14u]=rc_state[b+1184u+${count}u];`:''}
 if(rc_ccd_flat_complete(b)){rc_state[control+11u]=2u;return 1u;}
 if(${post?'rc_state[b+1u]!=2u||rc_state[b+14u]!=4u':'rc_state[b+1u]!=1u||rc_state[b+14u]<1u||rc_state[b+14u]>3u'}){return rc_ccd_flat_fail(b,control,4u);}return 0u;
}
fn rc_ccd_flat_gather_begin(b:u32,control:u32,scratch:u32,programBase:u32)->u32{
 let request=${post?'rc_ccd_body_numeric_request':'rc_ccd_pre_numeric_request'}(b);var program=0u;var inputs=0u;var outputs=0u;
 switch request.x{${select}default:{return rc_ccd_flat_fail(b,control,3u);}}
 let n=arrayLength(&rc_state);let pn=arrayLength(&rc_program);
 if(request.y>n||inputs>n-request.y||program>pn||pn-program<12u||outputs>64u||rc_program[program+3u]!=inputs||rc_program[program+4u]!=outputs){return rc_ccd_flat_fail(b,control,3u);}
 let sn=arrayLength(&rc_scratch);if(scratch>sn||inputs>sn-scratch){return rc_ccd_flat_fail(b,control,3u);}
 // The first8 numeric-control words are free until begin. Input gathering
 // is now a persistent one-word micro-op, with identical source index order.
 rc_state[control]=request.y;rc_state[control+1u]=program;rc_state[control+2u]=scratch;
 rc_state[control+12u]=0u;rc_state[control+11u]=4u;return 0u;
}
fn rc_ccd_flat_gather_one(b:u32,control:u32,scratch:u32)->u32{
 let program=rc_state[control+1u];let inputs=rc_program[program+3u];let index=rc_state[control+12u];
 if(index>=inputs){return rc_ccd_flat_fail(b,control,4u);}
 rc_scratch[scratch+index]=rc_state[rc_state[control]+index];rc_state[control+12u]=index+1u;
 if(index+1u==inputs){if(rc_num_cont_begin(program,scratch,control)!=0u){return rc_ccd_flat_fail(b,control,1u);}rc_state[control+11u]=1u;}
 return 0u;
}
fn rc_ccd_flat_publish_one(b:u32,control:u32,scratch:u32)->u32{
 let program=rc_state[control+1u];let outputs=rc_program[program+4u];let index=rc_state[control+12u];
 if(index>=outputs){return rc_ccd_flat_fail(b,control,4u);}
 let indices=program+rc_program[program+8u];rc_state[b+704u+index]=rc_scratch[scratch+rc_program[indices+index]];
 rc_state[control+12u]=index+1u;if(index+1u==outputs){rc_state[control+11u]=6u;}return 0u;
}
fn rc_ccd_flat_control(b:u32,control:u32,scratch:u32,programBase:u32)->u32{
 ${publish}
 rc_state[control+10u]++;rc_state[control+11u]=0u;
 if(rc_state[b]!=0u){rc_state[control+11u]=3u;return 2u;}
 if(rc_ccd_flat_complete(b)){rc_state[control+11u]=2u;return 1u;}if(rc_state[control+10u]>=4096u){return rc_ccd_flat_fail(b,control,5u);}return 0u;
}
fn rc_ccd_flat_advance(b:u32,control:u32,scratch:u32,programBase:u32,instructionBudget:u32)->u32{
 let n=arrayLength(&rc_state);if(b>n||n-b<${CCD_LAYOUT.words}u||control>n||n-control<16u){return 2u;}
 if(control<b+${CCD_LAYOUT.words}u&&b<control+16u){return 2u;}
 if(rc_state[control+15u]!=0x52434643u||rc_state[control+8u]!=b||rc_state[control+9u]!=${tag}u${world?'':'||rc_state[control+14u]!=0u'}){return rc_ccd_flat_fail(b,control,4u);}
 if(rc_state[b]!=0u||rc_state[control+11u]==3u){return 2u;}
 if(rc_state[control+11u]==2u){return ${world?'rc_ccd_flat_finish(b,control)':'1u'};}
 ${world?`if(!rc_ccd_flat_world_valid(b,false)||rc_state[b+1184u+${count}u]!=rc_state[control+14u]+rc_state[control+10u]){return rc_ccd_flat_fail(b,control,4u);}`:''}
 if(instructionBudget==0u||instructionBudget>1000000u){return rc_ccd_flat_fail(b,control,3u);}
 var executed=0u;
 loop{
  if(executed>=instructionBudget){return 0u;}
  if(rc_state[control+10u]>=4096u){return rc_ccd_flat_fail(b,control,5u);}
  if(rc_state[control+11u]==0u){if(rc_ccd_flat_gather_begin(b,control,scratch,programBase)!=0u){return 2u;}}
  if(rc_state[control+1u]<programBase||rc_state[control+2u]!=scratch){return rc_ccd_flat_fail(b,control,4u);}
  let phase=rc_state[control+11u];executed++;
  if(phase==4u){if(rc_ccd_flat_gather_one(b,control,scratch)!=0u){return 2u;}continue;}
  if(phase==1u){
   let status=rc_num_cont_instruction(control);rc_state[control+13u]++;
   if(status==0u){continue;}if(status!=1u){return rc_ccd_flat_fail(b,control,1u);}
   rc_state[control+12u]=0u;rc_state[control+11u]=5u;continue;
  }
  if(phase==5u){if(rc_ccd_flat_publish_one(b,control,scratch)!=0u){return 2u;}continue;}
  if(phase==6u){let result=rc_ccd_flat_control(b,control,scratch,programBase);if(result!=0u){return result;}continue;}
  return rc_ccd_flat_fail(b,control,4u);
 }
}
${finish}`;
}
export function generateCcdFlatWGSL(programs,{mode,worldTemplate,numericProfile=NUMERIC_PROFILE.PRESERVED_F32}={}){
 const driver=generateCcdFlatDriverWGSL(programs,{mode,worldTemplate}),source=generateNumericContinuationWGSL({numericProfile})+generateBvhWGSL()+generateCcdWGSL(programs)+(worldTemplate?generateWorldCcdWGSL(worldTemplate,programs):'')+driver;
 // Keep both callable public entries, then remove the synthetic root. This
 // strips synchronous rc_ccd_eval/rc_num_eval and the opposite control tree.
 const root='\nfn rc_ccd_flat_link_root(){rc_ccd_flat_begin(0u,0u);rc_ccd_flat_advance(0u,0u,0u,0u,1u);'+(worldTemplate?'rc_ccd_flat_finish(0u,0u);':'')+'}\n';
 return pruneCcdWGSL(source+root,'rc_ccd_flat_link_root').replace(root,'');
}
