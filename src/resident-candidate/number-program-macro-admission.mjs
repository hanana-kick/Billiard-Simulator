/* SPDX-License-Identifier: Apache-2.0
 * Optional Number-program macro transport admission, not new arithmetic.
 * The unchanged owner may only address its candidate's original state slab.
 * Invalid transport is rejected before source writes, never a shot miss.
 */
const bounded=(n,label)=>{if(!Number.isSafeInteger(n)||n<1||n>0xffffffff)throw new RangeError('Number macro '+label+' must be a positive bounded u32');return n;};
export function assertNumberProgramMacroViews(value,{count,vmStateDisjoint}={}){
 if(vmStateDisjoint!==true)throw new TypeError('Number macro requires disjoint VM and source storage');
 if(!value||typeof value!=='object'||Object.keys(value).sort().join(',')!=='programWords,stateWordsPerCandidate,totalStateWords')throw new TypeError('Explicit exact Number macro logical views required');
 bounded(count,'candidate count');const stateWordsPerCandidate=bounded(value.stateWordsPerCandidate,'state stride'),totalStateWords=bounded(value.totalStateWords,'state length'),programWords=bounded(value.programWords,'program length');
 if(count*stateWordsPerCandidate>totalStateWords||stateWordsPerCandidate<4||programWords<14)throw new RangeError('Number macro candidate/header span exceeds original logical storage');
 return Object.freeze({count,stateWordsPerCandidate,totalStateWords,programWords});
}
export function generateNumberProgramMacroAdmissionWGSL(value,options){
 const v=assertNumberProgramMacroViews(value,options);
 return `// Admission only: canonical rc_raw_program_step below is unchanged.
fn rc_vm_number_span(start:u32,words:u32,lo:u32,hi:u32)->bool{return start>=lo&&start<=hi&&words<=hi-start;}
fn rc_vm_number_admit(lane:u32,pb:u32,sb:u32,cb:u32,budget:u32)->bool{
 if(lane>=${v.count}u||arrayLength(&rc_state)!=${v.totalStateWords}u||arrayLength(&rc_program)!=${v.programWords}u){return false;}
 let lo=lane*${v.stateWordsPerCandidate}u;let hi=lo+${v.stateWordsPerCandidate}u;
 if(!rc_vm_number_span(cb,2u,lo,hi)){return false;}
 // The source returns before reading any program/register words when terminal.
 if(rc_state[cb+1u]!=0u){return true;}
 if(budget>20000u||!rc_vm_number_span(cb,4u,lo,hi)||!rc_vm_number_span(pb,14u,0u,${v.programWords}u)){return false;}
 let count=rc_program[pb+3u];let instructions=rc_program[pb+4u];let offset=rc_program[pb+5u];let capacity=rc_program[pb+12u];
 if(sb<lo||sb>hi||count>(hi-sb)/2u||capacity>hi-cb-4u||rc_state[cb+3u]>capacity){return false;}
 let registersEnd=sb+count*2u;let controlEnd=cb+4u+capacity;
 if(count!=0u&&!(registersEnd<=cb||controlEnd<=sb)){return false;}
 if(offset>${v.programWords}u-pb){return false;}let code=pb+offset;
 if(instructions>(${v.programWords}u-code)/4u){return false;}
 return true;
}
`;
}
