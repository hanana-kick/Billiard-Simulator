/* SPDX-License-Identifier: Apache-2.0
 * Opt-in execution transport for one approved rc_num_eval CALL. This is NOT a
 * replacement arithmetic implementation. Its header, input check, node body
 * and output check are extracted from the original preserved-f32 source.
 * Only the traversal loops and their authority move to a disjoint VM tail.
 */
import {createHash} from './source-sha256.mjs';
import {generateProfiledNumericWGSL,NUMERIC_PROFILE} from './numeric-profile.mjs';
import {approveSourceIntrinsics} from './microcode-source-intrinsics.mjs';
import {linkResidentWGSL} from './wgsl-linker.mjs';

const MODE='source-num-eval-phased-v1',MAGIC=0x52434e56;
const fields=Object.freeze({magic:0,phase:1,ownerPC:2,destination:3,program:4,scratch:5,
 nodeIndex:6,initialized:7,validationCursor:8,sourceResult:9,registers:10,nodes:11,
 inputs:12,outputs:13,microWorkLow:14,microWorkHigh:15});
export const MICROCODE_NUMERIC_CONTINUATION=Object.freeze({mode:MODE,words:16,ownedWords:14,magic:MAGIC,
 fields,phases:Object.freeze({IDLE:0,HEADER:1,INPUT_CHECK:2,NODE:3,OUTPUT_CHECK:4,RETURN:5}),
 pending:0,protocolFault:5,numericProfile:NUMERIC_PROFILE.PRESERVED_F32,
 capability:Object.freeze({optIn:true,sourceDerived:true,defaultBackend:false,nativeQualified:false,hardwarePerformance:false})});
const sha=x=>createHash('sha256').update(x).digest('hex');
const need=(x,m)=>{if(!x)throw new TypeError('Phased numeric continuation: '+m);};
function balanced(s,open){let d=1,end=open+1;for(;d&&end<s.length;end++)d+=(s[end]==='{')-(s[end]==='}');need(d===0,'balanced canonical source');return end;}
function block(s,marker){const at=s.indexOf(marker);need(at>=0&&s.indexOf(marker,at+1)<0,'unique source boundary '+marker);const open=s.indexOf('{',at),end=balanced(s,open);return{at,open,end,body:s.slice(open+1,end-1)};}
let canonical;
function sourceParts(){
 if(canonical)return canonical;
 const source=generateProfiledNumericWGSL(NUMERIC_PROFILE.PRESERVED_F32),fn=block(source,'fn rc_num_eval('),body=fn.body;
 const input=block(body,'  for(var i=0u;i<inputs;i++) {'),node=block(body,'  for(var i=0u;i<nodes;i++) {'),output=block(body,'  for(var i=0u;i<outputs;i++) {');
 need(body.slice(input.end,node.at).trim()==='var initialized=inputs;','original input/node boundary');
 const assignment='  if (initialized!=registers) { return rc_num_fail(scratchBase,registers,2u); }';
 need(body.slice(node.end,output.at).trim()===assignment.trim(),'original initialized check');
 need(body.slice(output.end).trim()==='rc_scratch[scratchBase+registers]=1u;\n  return 1u;','original completion stores');
 const bindings='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;\n@group(0) @binding(1) var<storage,read> rc_program:array<u32>;\n@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;\n';
 const approval=approveSourceIntrinsics(bindings+source,{profile:'source-numeric-v1',functionNames:['rc_num_eval']}).entries[0];
 canonical=Object.freeze({source,library:source.slice(0,fn.at)+source.slice(fn.end),header:body.slice(0,input.at),input:input.body,node:node.body,assignment,output:output.body,
  completion:body.slice(output.end),approval});return canonical;
}
function layout(o={}){
 const {candidateCount,vmStride,tailOffset}=o;
 for(const[k,v]of Object.entries({candidateCount,vmStride,tailOffset}))need(Number.isSafeInteger(v)&&v>0&&v<=0xffffffff,'bounded positive '+k);
 need(tailOffset>=16&&tailOffset+16===vmStride,'tail is exactly appended after original control/locals/stack');
 need(candidateCount*vmStride<=0xffffffff,'bounded total VM words');
 return Object.freeze({candidateCount,vmStride,tailOffset,totalWords:candidateCount*vmStride});
}
function helperSource(l){
 const s=sourceParts(),F=fields,clear=Array.from({length:14},(_,i)=>`rc_vm_state[t+${i}u]=0u;`).join(''),idle=Array.from({length:14},(_,i)=>`rc_vm_state[t+${i}u]!=0u`).join('||');
 return s.library+`
// VM-owned tail only. Source physical rc_state is never referenced.
fn rc_vm_num_base_valid(base:u32)->bool{
 return arrayLength(&rc_vm_state)==${l.totalWords}u && base%${l.vmStride}u==0u && base/${l.vmStride}u<${l.candidateCount}u;
}
fn rc_vm_num_done(t:u32,status:u32)->u32{rc_vm_state[t+${F.sourceResult}u]=status;rc_vm_state[t+${F.phase}u]=5u;return status;}
fn rc_vm_num_start(base:u32,programBase:u32,scratchBase:u32,ownerPC:u32,destination:u32)->u32{
 if(!rc_vm_num_base_valid(base)){return 5u;}let t=base+${l.tailOffset}u;
 if(${idle}){return 5u;}
 rc_vm_state[t]=${MAGIC}u;rc_vm_state[t+1u]=1u;rc_vm_state[t+2u]=ownerPC;rc_vm_state[t+3u]=destination;
 rc_vm_state[t+4u]=programBase;rc_vm_state[t+5u]=scratchBase;return 0u;
}
fn rc_vm_num_clear(base:u32)->u32{
 if(!rc_vm_num_base_valid(base)){return 5u;}let t=base+${l.tailOffset}u;
 if(rc_vm_state[t]!=${MAGIC}u||rc_vm_state[t+1u]!=5u||rc_vm_state[t+9u]<1u||rc_vm_state[t+9u]>4u){return 5u;}
 ${clear}return 0u;
}
fn rc_vm_num_header(programBase:u32,scratchBase:u32)->u32{
${s.header}
 return 0u;
}
fn rc_vm_num_input(programBase:u32,scratchBase:u32,i:u32)->u32{
 let registers=rc_program[programBase+5u];
${s.input}
 return 0u;
}
fn rc_vm_num_node(programBase:u32,scratchBase:u32,t:u32)->u32{
 let registers=rc_program[programBase+5u];let instructions=rc_program[programBase+7u];
 let i=rc_vm_state[t+6u];var initialized=rc_vm_state[t+7u];
${s.node}
 rc_vm_state[t+6u]=i+1u;rc_vm_state[t+7u]=initialized;return 0u;
}
fn rc_vm_num_output(programBase:u32,scratchBase:u32,i:u32,initialized:u32)->u32{
 let registers=rc_program[programBase+5u];let outputOffset=rc_program[programBase+8u];
${s.output}
 return 0u;
}
fn rc_vm_num_step(base:u32)->u32{
 if(!rc_vm_num_base_valid(base)){return 5u;}let t=base+${l.tailOffset}u;
 if(rc_vm_state[t]!=${MAGIC}u){return 5u;}
 let phase=rc_vm_state[t+1u];let result=rc_vm_state[t+9u];
 if(phase==5u){if(result<1u||result>4u){return 5u;}return result;}
 if(phase<1u||phase>4u||result!=0u){return 5u;}
 let programBase=rc_vm_state[t+4u];let scratchBase=rc_vm_state[t+5u];
 if(phase==1u){
  if(rc_vm_state[t+6u]!=0u||rc_vm_state[t+7u]!=0u||rc_vm_state[t+8u]!=0u||rc_vm_state[t+10u]!=0u||rc_vm_state[t+11u]!=0u||rc_vm_state[t+12u]!=0u||rc_vm_state[t+13u]!=0u){return 5u;}
  let status=rc_vm_num_header(programBase,scratchBase);if(status!=0u){return rc_vm_num_done(t,status);}
  rc_vm_state[t+10u]=rc_program[programBase+5u];rc_vm_state[t+11u]=rc_program[programBase+6u];
  rc_vm_state[t+12u]=rc_program[programBase+3u];rc_vm_state[t+13u]=rc_program[programBase+4u];
  rc_vm_state[t+7u]=rc_program[programBase+3u];rc_vm_state[t+1u]=2u;return 0u;
 }
 let registers=rc_vm_state[t+10u];let nodes=rc_vm_state[t+11u];let inputs=rc_vm_state[t+12u];let outputs=rc_vm_state[t+13u];
 let i=rc_vm_state[t+6u];let initialized=rc_vm_state[t+7u];let cursor=rc_vm_state[t+8u];
 // These are continuation-authority checks, not additional source admission.
 // A successful HEADER captured these exact immutable header words. No source
 // memory is written if a retained VM tail no longer describes that header.
 let plen=arrayLength(&rc_program);let slen=arrayLength(&rc_scratch);
 if(programBase>plen||plen-programBase<12u||inputs!=rc_program[programBase+3u]||outputs!=rc_program[programBase+4u]||registers!=rc_program[programBase+5u]||nodes!=rc_program[programBase+6u]){return 5u;}
 if(inputs<1u||inputs>65536u||outputs<1u||outputs>1000000u||nodes>1000000u||registers<inputs||registers>inputs+nodes||scratchBase>slen||slen-scratchBase<registers+1u){return 5u;}
 if(i>nodes||initialized<inputs||initialized>registers){return 5u;}
 if(phase==2u){
  if(cursor>=inputs||i!=0u||initialized!=inputs){return 5u;}
  let status=rc_vm_num_input(programBase,scratchBase,cursor);if(status!=0u){return rc_vm_num_done(t,status);}
  if(cursor+1u==inputs){rc_vm_state[t+8u]=0u;rc_vm_state[t+1u]=3u;}else{rc_vm_state[t+8u]=cursor+1u;}return 0u;
 }
 if(phase==3u){
  if(cursor!=0u){return 5u;}
  if(i<nodes){let status=rc_vm_num_node(programBase,scratchBase,t);if(status!=0u){return rc_vm_num_done(t,status);}}
  if(rc_vm_state[t+6u]==nodes){
   let initialized=rc_vm_state[t+7u];
${s.assignment.replace('return rc_num_fail(scratchBase,registers,2u);','return rc_vm_num_done(t,rc_num_fail(scratchBase,registers,2u));')}
   rc_vm_state[t+1u]=4u;
  }return 0u;
 }
 if(cursor>=outputs||i!=nodes||initialized!=registers){return 5u;}
 let status=rc_vm_num_output(programBase,scratchBase,cursor,initialized);if(status!=0u){return rc_vm_num_done(t,status);}
 if(cursor+1u<outputs){rc_vm_state[t+8u]=cursor+1u;return 0u;}
 rc_scratch[scratchBase+registers]=1u;return rc_vm_num_done(t,1u);
}
`;
}
/** No bindings/entry point. The caller owns immutable rc_program and separate
 * rc_scratch / rc_vm_state arrays. No source state or host callbacks are used. */
export function generateMicrocodeNumericContinuationWGSL(options){
 const l=layout(options),root='fn rc_vm_num_keep(){rc_vm_num_start(0u,0u,0u,0u,0u);rc_vm_num_step(0u);rc_vm_num_clear(0u);}';
 const code=linkResidentWGSL([helperSource(l),root],{entry:'rc_vm_num_keep'}).code;
 need(code.split(root).length===2,'known link root');return code.replace(root,'');
}
/** Pinned original closure plus the explicit loop/state-location transformation.
 * This descriptor does not assert native compilation or numerical admission. */
export function microcodeNumericContinuationDescriptor(options){
 const l=layout(options),s=sourceParts(),code=generateMicrocodeNumericContinuationWGSL(l);
 return Object.freeze({kind:'source-numeric-continuation-equivalence-v1',version:1,mode:MODE,
  numericProfile:NUMERIC_PROFILE.PRESERVED_F32,layout:l,sourceApproval:s.approval,
  sourceSha256:sha(s.source),parts:Object.freeze(Object.fromEntries(['header','input','node','assignment','output','completion'].map(k=>[k,sha(s[k])]))),
  transformation:'source HEADER; one original INPUT; one original NODE; original initialized check; one original OUTPUT; original status1; VM-only tail0..13; counters14..15 untouched',
  generatedSha256:sha(code),generatedBytes:code.length,capability:MICROCODE_NUMERIC_CONTINUATION.capability});
}
export function assertMicrocodeNumericContinuationDescriptor(descriptor,options){
 const expected=microcodeNumericContinuationDescriptor(options);
 need(JSON.stringify(descriptor)===JSON.stringify(expected),'exact source/layout/transformation descriptor required');return expected;
}
/** Source text exposed only for differential/structural HOST assertions. */
export function microcodeNumericSourcePartsForTest({testOnly=false}={}){need(testOnly===true,'TEST ONLY source inspection');return sourceParts();}
