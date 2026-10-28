/* SPDX-License-Identifier: Apache-2.0
 * Compact source-WGSL scalar bytecode transport. No physics equation, host
 * forward step, software-f64 substitution, or result admission lives here.
 * All continuation authority is in candidate-owned storage words. The host
 * adapter below is explicitly test-only and is never a runtime fallback.
 */
import {MICROCODE_ISA as I} from './microcode-isa.mjs';
import {generateCachedMicrocodeControlWGSL,createCachedMicrocodeReferenceForTest} from './microcode-control-cache.mjs';
import {MICROCODE_ALL_SOURCE_MACROS as M,sourceMacroNativeWGSL,approveSourceMacros} from './microcode-source-macros.mjs';
import {generateNumberProgramMacroAdmissionWGSL} from './number-program-macro-admission.mjs';
import {MICROCODE_SOURCE_INTRINSICS as D,MICROCODE_INTRINSIC_PROFILES,sourceIntrinsicNativeWGSL,sourceIntrinsicProfileAllows} from './microcode-source-intrinsics.mjs';
import {PREPARATION_PROFILE,assertPreparationDescriptor,assertPreparationInputs} from './microcode-preparation.mjs';
import {MICROCODE_NUMERIC_CONTINUATION as Q,generateMicrocodeNumericContinuationWGSL,assertMicrocodeNumericContinuationDescriptor} from './microcode-numeric-continuation.mjs';
const intrinsicByOpcode=new Map(D.map(d=>[d.opcode,d]));
const intrinsicEnabled=sourceIntrinsicProfileAllows;
const intrinsicAdmitted=(p,d)=>intrinsicEnabled(p.intrinsics,d)&&(p.intrinsicFunctions===null||p.intrinsicFunctions.includes(d.name));
const C=I.control,S=I.status,E=I.error,O=I.opcodes;
const bounded=(n,label,zero=false)=>{if(!Number.isSafeInteger(n)||n<(zero?0:1)||n>0xffffffff)throw new RangeError(label+' must be a bounded u32');return n;};
export const MICROCODE_VM_CAPABILITY=Object.freeze({...I.capability,storageContinuation:true,hostPhysicsFallback:false,hardwareF64:false});
export function microcodeVmLayout({count=1,localWords,stackCapacity=64,numericContinuation}){
 bounded(count,'candidate count');bounded(localWords,'local words');bounded(stackCapacity,'call capacity');
 const phased=numericContinuation!==undefined;if(phased&&numericContinuation!==Q.mode)throw new TypeError('Explicit source-num-eval-phased-v1 continuation mode required');
 const tail=C.words+localWords+stackCapacity,stride=tail+(phased?Q.words:0),totalWords=count*stride;bounded(stride,'candidate stride');bounded(totalWords,'VM storage words');
 return Object.freeze({count,localWords,stackCapacity,controlWords:C.words,localsOffset:C.words,stackOffset:C.words+localWords,stride,totalWords,...(phased?{numericContinuation:Q.mode,numericTailOffset:tail,numericTailWords:Q.words}:{})});
}
const macroApprovalCache=new Map();
function macroApproval(spec){
 if(!macroApprovalCache.has(spec.id)){
  const bindings='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;';
  macroApprovalCache.set(spec.id,approveSourceMacros(bindings+sourceMacroNativeWGSL(spec.name),{functionNames:[spec.name]}).entries[0]);
 }return macroApprovalCache.get(spec.id);
}
function externalConfiguration(rows,l,instructionCount){
 if(rows===undefined)return Object.freeze([]);if(!Array.isArray(rows))throw new TypeError('Explicit external function descriptor array required');const ids=new Set(),pcs=new Set();
 return Object.freeze(rows.map(row=>{
  const spec=M.find(x=>x.id===row?.id&&x.name===row?.name);if(!spec||ids.has(spec.id))throw new TypeError('Unique approved external source macro required');ids.add(spec.id);
  const expected=macroApproval(spec),approval=row.approval,approvalKeys=['id','name','signatureSha256','bodySha256','closureSha256','nativeSourceSha256',...['numericProfile','declarationsSha256','numericProfileDeclarationSha256'].filter(k=>Object.hasOwn(expected,k))];if(!approval||approvalKeys.some(k=>approval[k]!==expected[k])||Object.keys(expected.dependencies).some(k=>approval.dependencies?.[k]!==expected.dependencies[k])||Object.keys(approval.dependencies??{}).length!==Object.keys(expected.dependencies).length)throw new TypeError('Exact external source macro approval required');
  const entryPc=bounded(row.entryPc,'external entry PC',true);if(entryPc+1>=instructionCount||pcs.has(entryPc))throw new RangeError('Unique external stub and RET in instruction range required');pcs.add(entryPc);
  if(!Array.isArray(row.params)||row.params.length!==spec.parameterWords.length||row.returnWords!==spec.resultWords)throw new TypeError('Exact external scalar signature required');
  const params=row.params.map((arg,i)=>{const slot=bounded(arg.slot,'external parameter slot',true),words=arg.words;if(words!==spec.parameterWords[i]||slot>=l.localWords||words>l.localWords-slot)throw new RangeError('External parameter span outside local storage');return Object.freeze({...arg,slot,words});});
  const returnSlot=bounded(row.returnSlot,'external return slot',true);if(spec.resultWords===0&&returnSlot!==0)throw new TypeError('Void external macro has no return slot');if(returnSlot>=l.localWords||spec.resultWords>l.localWords-returnSlot)throw new RangeError('External return span outside local storage');
  return Object.freeze({...row,entryPc,params:Object.freeze(params),returnSlot,returnWords:spec.resultWords,approval:expected});
 }));
}
function configuration(options){
 const explicitMode=Object.hasOwn(options,'controlMode'),explicitDisjoint=Object.hasOwn(options,'vmStateDisjoint');if(explicitMode!==explicitDisjoint)throw new TypeError('Complete VM control/disjointness contract required');const controlMode=explicitMode?options.controlMode:'storage-v1',vmStateDisjoint=explicitDisjoint?options.vmStateDisjoint:false;if(!['storage-v1','invocation-cache-v1'].includes(controlMode)||typeof vmStateDisjoint!=='boolean'||controlMode==='invocation-cache-v1'&&!vmStateDisjoint)throw new TypeError('Explicit disjoint invocation-cache-v1 or storage-v1 control mode required');if(controlMode==='invocation-cache-v1'&&options.state&&[options.code,...options.bindings??[]].some(x=>x?.buffer===options.state.buffer))throw new TypeError('Cached VM storage must not alias code or source backing buffers');
 const l=microcodeVmLayout(options),instructionCount=bounded(options.instructionCount??options.code?.length/I.instructionWords,'instruction count'),entryPc=bounded(options.entryPc??0,'entry PC',true),instructionBudget=bounded(options.instructionBudget??4096,'instruction budget');
 if(entryPc>=instructionCount)throw new RangeError('Entry PC outside immutable instruction table');const externalFunctions=externalConfiguration(options.externalFunctions,l,instructionCount);
 const seen=new Set(),initialSlots=(options.initialSlots??[]).map(row=>{if(!row||typeof row!=='object')throw new TypeError('Explicit initial local slot required');const slot=bounded(row.slot,'initial slot',true);if(slot>=l.localWords||seen.has(slot))throw new RangeError('Unique initial local slot in range required');seen.add(slot);const candidateStride=bounded(row.candidateStride??0,'candidate stride',true),value=bounded(row.value??0,'initial value',true);if(Object.keys(row).some(k=>!['slot','candidateStride','value'].includes(k)))throw new TypeError('Unknown initial local input');return Object.freeze({slot,candidateStride,value});});
 const intrinsics=options.intrinsics??'none';const preparationApproval=intrinsics===PREPARATION_PROFILE?assertPreparationDescriptor(options.preparationApproval,{count:l.count}):null;if(intrinsics!==PREPARATION_PROFILE&&options.preparationApproval!==undefined)throw new TypeError('Preparation descriptor requires explicit preparation profile');if(!MICROCODE_INTRINSIC_PROFILES.includes(intrinsics))throw new TypeError('Explicit exact-source intrinsic profile required');let intrinsicFunctions=null;if(options.intrinsicFunctions!==undefined&&options.intrinsicFunctions!==null){if(!Array.isArray(options.intrinsicFunctions)||new Set(options.intrinsicFunctions).size!==options.intrinsicFunctions.length)throw new TypeError('Unique exact-source intrinsic function names required');intrinsicFunctions=Object.freeze(options.intrinsicFunctions.map(name=>{const d=D.find(x=>x.name===name);if(!d||!intrinsicEnabled(intrinsics,d))throw new TypeError('Unknown or out-of-profile intrinsic function: '+name);return name;}));}if(options.eventAudit!==undefined&&typeof options.eventAudit!=='boolean')throw new TypeError('Explicit eventAudit boolean required');const workgroupSize=bounded(options.workgroupSize??1,'workgroup size');if(workgroupSize>256)throw new RangeError('Explicit workgroup size must not exceed 256; caller must check device limit');let numericContinuationDescriptor;if(l.numericContinuation){if(!vmStateDisjoint||options.state&&[options.code,...options.bindings??[]].some(x=>x?.buffer===options.state.buffer))throw new TypeError('Phased numeric VM tail requires disjoint VM/source/code storage');if(intrinsics!=='source-numeric-v1'||intrinsicFunctions?.length!==1||intrinsicFunctions[0]!=='rc_num_eval'||externalFunctions.some(x=>x.name==='rc_num_eval'))throw new TypeError('Phased continuation admits only explicit exact-source rc_num_eval intrinsic');numericContinuationDescriptor=assertMicrocodeNumericContinuationDescriptor(options.numericContinuationDescriptor,{candidateCount:l.count,vmStride:l.stride,tailOffset:l.numericTailOffset});}else if(options.numericContinuationDescriptor!==undefined)throw new TypeError('Numeric continuation descriptor requires explicit phased mode');return Object.freeze({...l,...(numericContinuationDescriptor?{numericContinuationDescriptor}:{}),instructionCount,entryPc,instructionBudget,intrinsics,intrinsicFunctions,...(preparationApproval?{preparationApproval}:{}),externalFunctions,controlMode,vmStateDisjoint,workgroupSize,workgroups:Math.ceil(l.count/workgroupSize),eventAudit:options.eventAudit===true,initialSlots:Object.freeze(initialSlots)});
}
const unary=new Set(['MOV','NOT','LNOT','INEG','FNEG','UCLZ','UCTZ','POPCOUNT','FABS','FSQRT','FLOOR','CEIL','TRUNC','ROUND','UTOF','ITOF','FTOU','FTOI']);
const binary=new Set(['UADD','USUB','UMUL','UDIV','UREM','IADD','ISUB','IMUL','IDIV','IREM','FADD','FSUB','FMUL','FDIV','AND','OR','XOR','SHL','USHR','ISHR','EQ','NE','ULT','ULE','UGT','UGE','ILT','ILE','IGT','IGE','FEQ','FNE','FLT','FLE','FGT','FGE','FMIN','FMAX']);
const use=Object.freeze(Object.fromEntries(I.names.map(name=>[name,intrinsicByOpcode.has(name)?[1,...intrinsicByOpcode.get(name).parameterWords.map((_,i)=>i+2)]:unary.has(name)?[1,2]:binary.has(name)?[1,2,3]:({HALT:[],SET:[1,2],LOAD:[1,2,3],STORE:[2,3,4],LENGTH:[1,2],LOCAL_LOAD:[1,2],LOCAL_STORE:[2,3],JUMP:[2],BRANCH:[2,3,4],CALL:[2],RET:[],EXTERNAL_CALL:[2],GUARD:[2],SELECT:[1,2,3,4]})[name]])));
const reg=Object.freeze(Object.fromEntries(I.names.map(name=>[name,intrinsicByOpcode.has(name)?[1,...intrinsicByOpcode.get(name).parameterWords.map((_,i)=>i+2)]:unary.has(name)?[1,2]:binary.has(name)?[1,2,3]:({HALT:[],SET:[1],LOAD:[1,3],STORE:[3,4],LENGTH:[1],LOCAL_LOAD:[1,2],LOCAL_STORE:[2,3],JUMP:[],BRANCH:[2],CALL:[],RET:[],EXTERNAL_CALL:[],GUARD:[2],SELECT:[1,2,3,4]})[name]])));
const scalarLoadOperands=name=>unary.has(name)?['a']:binary.has(name)?['a','b']:({SELECT:['a','b','c'],GUARD:['a'],BRANCH:['a'],LOCAL_LOAD:['a'],LOCAL_STORE:['a','b'],LOAD:['b'],STORE:['b','c']})[name]??[];
const words=new Uint32Array(1),floats=new Float32Array(words.buffer),fword=x=>{floats[0]=x;return words[0];},real=x=>{words[0]=x;return floats[0];};
const trunc=Math.trunc,roundEven=x=>{const lower=Math.floor(x),fraction=x-lower,r=fraction<.5?lower:fraction>.5?lower+1:lower%2===0?lower:lower+1;return r===0&&x<0?-0:r;};
const pop=x=>{x-=(x>>>1)&0x55555555;x=(x&0x33333333)+((x>>>2)&0x33333333);return Math.imul((x+(x>>>4))&0x0f0f0f0f,0x01010101)>>>24;};
function scalar(name,a,b,c){
 switch(name){
 case'MOV':return a;case'UADD':case'IADD':return(a+b)>>>0;case'USUB':case'ISUB':return(a-b)>>>0;case'UMUL':case'IMUL':return Math.imul(a,b)>>>0;
 case'UDIV':return Math.floor(a/b)>>>0;case'UREM':return(a%b)>>>0;case'IDIV':return trunc((a|0)/(b|0))>>>0;case'IREM':return((a|0)%(b|0))>>>0;
 case'AND':return(a&b)>>>0;case'OR':return(a|b)>>>0;case'XOR':return(a^b)>>>0;case'SHL':return(a<<(b&31))>>>0;case'USHR':return a>>>(b&31);case'ISHR':return((a|0)>>(b&31))>>>0;
 case'EQ':return+(a===b);case'NE':return+(a!==b);case'ULT':return+(a<b);case'ULE':return+(a<=b);case'UGT':return+(a>b);case'UGE':return+(a>=b);case'ILT':return+((a|0)<(b|0));case'ILE':return+((a|0)<=(b|0));case'IGT':return+((a|0)>(b|0));case'IGE':return+((a|0)>=(b|0));
 case'NOT':return(~a)>>>0;case'LNOT':return+(a===0);case'INEG':return(-a)>>>0;case'FNEG':return(a^0x80000000)>>>0;case'UCLZ':return Math.clz32(a);case'UCTZ':return a===0?32:31-Math.clz32((a&-a)>>>0);case'POPCOUNT':return pop(a);case'FABS':return a&0x7fffffff;case'SELECT':return c!==0?b:a;
 case'FADD':return fword(real(a)+real(b));case'FSUB':return fword(real(a)-real(b));case'FMUL':return fword(real(a)*real(b));case'FDIV':return fword(real(a)/real(b));case'FEQ':return+(real(a)===real(b));case'FNE':return+(real(a)!==real(b));case'FLT':return+(real(a)<real(b));case'FLE':return+(real(a)<=real(b));case'FGT':return+(real(a)>real(b));case'FGE':return+(real(a)>=real(b));case'FMIN':return fword(Math.min(real(a),real(b)));case'FMAX':return fword(Math.max(real(a),real(b)));case'FSQRT':return fword(Math.sqrt(real(a)));case'FLOOR':return fword(Math.floor(real(a)));case'CEIL':return fword(Math.ceil(real(a)));case'TRUNC':return fword(trunc(real(a)));case'ROUND':return fword(roundEven(real(a)));case'UTOF':return fword(a);case'ITOF':return fword(a|0);case'FTOU':return trunc(real(a))>>>0;case'FTOI':return trunc(real(a))>>>0;
 default:throw new Error('Unknown scalar handler '+name);
 }
}
function domain(name,a,b){if(['UDIV','UREM','IDIV','IREM'].includes(name)&&b===0)return false;if(['IDIV','IREM'].includes(name)&&a===0x80000000&&b===0xffffffff)return false;if(name==='FTOU')return Number.isFinite(real(a))&&real(a)>=0&&real(a)<4294967296;if(name==='FTOI')return Number.isFinite(real(a))&&real(a)>=-2147483648&&real(a)<2147483648;return true;}
/** This reference accepts only explicit testOnly:true. State may be copied to
 * another adapter between chunks: PC, locals, stack and diagnostics are complete
 * in words, with no hidden execution state or saved CPU future. Optional onCall
 * receives only a frozen {lane,pc,targetPc} diagnostic, never writable storage.
 * onReturn mirrors it after valid RET; targetPc:null denotes root completion.
 * pcCounters is optional TEST-only nonaliasing storage: cumulative committed
 * instruction counts across lanes/chunks; begin does not reset the observer.
 * Counter overflow aborts the test instead of wrapping or publishing a result. */
export function createMicrocodeVmReferenceForTest(options){
 if(options?.testOnly!==true)throw new TypeError('Microcode host execution is TEST ONLY');for(const key of['onCall','onReturn','numericContinuationHandler'])if(options[key]!==undefined&&typeof options[key]!=='function')throw new TypeError('TEST-only call/return observer must be a function');if(options.stopAfterCommittedReturn!==undefined&&typeof options.stopAfterCommittedReturn!=='function')throw new TypeError('TEST-only committed return stop must be a function');const p=configuration(options),code=options.code;
 if(!(code instanceof Uint32Array)||code.length!==p.instructionCount*8)throw new TypeError('Exact owned u32 instruction array required');
 const bindings=options.bindings??Array.from({length:p.eventAudit?6:5},()=>new Uint32Array(1));if(!Array.isArray(bindings)||bindings.length!==(p.eventAudit?6:5)||bindings.some(b=>!(b instanceof Uint32Array)))throw new TypeError('Exact original u32 source bindings required (optional eventAudit is explicit)');
 const state=options.state??new Uint32Array(p.totalWords);if(!(state instanceof Uint32Array)||state.length!==p.totalWords)throw new TypeError('Exact candidate VM state array required');
 const pcCounters=options.pcCounters;if(pcCounters!==undefined&&(!(pcCounters instanceof Uint32Array)||pcCounters.length!==p.instructionCount))throw new TypeError('TEST-only PC counters require exactly instructionCount u32 words');if(pcCounters&&[code,state,...bindings].some(words=>words.buffer===pcCounters.buffer))throw new TypeError('TEST-only PC counters must not alias code, VM or source backing buffers');
 const recordStep=pc=>{if(!pcCounters)return;if(pcCounters[pc]===0xffffffff)throw new RangeError('TEST-only PC instruction counter overflow');pcCounters[pc]++;};
 const base=lane=>{bounded(lane,'candidate index',true);if(lane>=p.count)throw new RangeError('Candidate index');return lane*p.stride;};
 const fail=(at,error,status=S.invalid)=>{state[at+C.status]=status;state[at+C.error]=error;return status;};
 const controlValid=at=>state[at+C.magicWord]===C.magic&&state[at+C.versionWord]===C.version&&state[at+C.entryPc]===p.entryPc&&!state.subarray(at+C.reservedStart,at+C.words).some(x=>x!==0)&&state[at+C.sp]<=p.stackCapacity;
 const externalValid=(at,id)=>{
  const descriptor=p.externalFunctions.find(x=>x.id===id),pc=state[at+C.pc],sp=state[at+C.sp];if(!descriptor||pc!==descriptor.entryPc||pc+1>=p.instructionCount||state[at+C.error]!==0)return false;
  const stub=code.subarray(pc*8,pc*8+8),ret=code.subarray((pc+1)*8,(pc+2)*8);if(stub[0]!==O.EXTERNAL_CALL||stub[2]!==id||stub.some((v,i)=>i!==0&&i!==2&&v!==0)||ret[0]!==O.RET||ret.subarray(1).some(x=>x!==0))return false;
  if(sp===0)return pc===p.entryPc;const back=state[at+p.stackOffset+sp-1];return back>0&&back<p.instructionCount&&code[(back-1)*8]===O.CALL&&code[(back-1)*8+2]===pc&&!code.subarray((back-1)*8,(back-1)*8+8).some((v,i)=>i!==0&&i!==2&&v!==0);
 };
 const serviceExternal=(lane=0,macroId,handler)=>{
  const at=base(lane),lb=at+p.localsOffset;if(!controlValid(at))return fail(at,E.malformedControl);const status=state[at+C.status],pending=state[at+C.pendingMacro];if(p.numericContinuation&&status===S.waiting&&state.subarray(at+p.numericTailOffset,at+p.numericTailOffset+Q.ownedWords).some(x=>x!==0))return fail(at,E.malformedControl);if(!Number.isInteger(macroId)||!p.externalFunctions.some(x=>x.id===macroId))return fail(at,E.externalProtocol);
  if(status!==S.waiting){if([S.invalid,S.unsupported].includes(status))return status;if(![S.ready,S.complete].includes(status)||pending!==0)return fail(at,E.externalProtocol);return status;}
  if(pending===0||!externalValid(at,pending-1)||state[at+C.lastOpcode]!==O.EXTERNAL_CALL)return fail(at,E.externalProtocol);
  if(pending!==macroId+1)return S.waiting;if(state[at+C.stepsLow]===0xffffffff&&state[at+C.stepsHigh]===0xffffffff)return fail(at,E.counterOverflow);
  const descriptor=p.externalFunctions.find(x=>x.id===macroId),args=descriptor.params.map(arg=>state.slice(lb+arg.slot,lb+arg.slot+arg.words));if(typeof handler!=='function')return fail(at,E.unsupportedPrimitive,S.unsupported);
  const result=handler(descriptor,args,{bindings});if(!(result instanceof Uint32Array)||result.length!==descriptor.returnWords)throw new TypeError('Exact TEST-only external result words required');
  recordStep(state[at+C.pc]);state.set(result,lb+descriptor.returnSlot);state[at+C.pendingMacro]=0;state[at+C.pc]++;state[at+C.stepsLow]=(state[at+C.stepsLow]+1)>>>0;if(state[at+C.stepsLow]===0)state[at+C.stepsHigh]++;state[at+C.status]=S.ready;return S.ready;
 };
 const numericAdvance=(at,pc,dst,programBase,scratchBase)=>{
  const t=at+p.numericTailOffset,F=Q.fields,handler=options.numericContinuationHandler;
  if(typeof handler!=='function'){fail(at,E.unsupportedPrimitive,S.unsupported);return null;}
  const phase=state[t+F.phase];if(phase===0){if(state.subarray(t,t+Q.ownedWords).some(x=>x!==0)){fail(at,E.malformedControl);return null;}}
  else if(state[t+F.ownerPC]!==pc||state[t+F.destination]!==dst||state[t+F.program]!==programBase||state[t+F.scratch]!==scratchBase){fail(at,E.malformedControl);return null;}
  if(state[t+F.microWorkLow]===0xffffffff&&state[t+F.microWorkHigh]===0xffffffff){fail(at,E.counterOverflow);return null;}
  const invoke=(operation,args)=>{const r=handler(operation,Object.freeze(args),{state,bindings,configuration:p});if(!Number.isInteger(r)||r<0||r>Q.protocolFault)throw new TypeError('Exact TEST phased numeric transport return required');return r;};
  const result=phase===0?invoke('start',[at,programBase,scratchBase,pc,dst]):invoke('step',[at]);
  if(result===Q.protocolFault){fail(at,E.malformedControl);return null;}
  if(result!==0){if(state[t+F.phase]!==Q.phases.RETURN||state[t+F.sourceResult]!==result||invoke('clear',[at])!==0){fail(at,E.malformedControl);return null;}}
  state[t+F.microWorkLow]=(state[t+F.microWorkLow]+1)>>>0;if(state[t+F.microWorkLow]===0)state[t+F.microWorkHigh]++;
  return result===0?null:result;
 };
 const begin=(lane=0)=>{const at=base(lane);state.fill(0,at,at+p.stride);state[at+C.magicWord]=C.magic;state[at+C.versionWord]=C.version;state[at+C.status]=S.ready;state[at+C.pc]=p.entryPc;state[at+C.entryPc]=p.entryPc;for(const x of p.initialSlots)state[at+p.localsOffset+x.slot]=(Math.imul(lane,x.candidateStride)+x.value)>>>0;return S.ready;};
 const advance=(lane=0,budget=p.instructionBudget)=>{bounded(budget,'instruction budget');const at=base(lane),lb=at+p.localsOffset,sb=at+p.stackOffset;
  if(!controlValid(at))return fail(at,E.malformedControl);
  if(p.numericContinuation&&state[at+p.numericTailOffset+Q.fields.phase]===0&&state.subarray(at+p.numericTailOffset,at+p.numericTailOffset+Q.ownedWords).some(x=>x!==0))return fail(at,E.malformedControl);
 const prior=state[at+C.status],pending=state[at+C.pendingMacro];if(p.numericContinuation&&state[at+p.numericTailOffset+Q.fields.phase]!==0&&![S.ready,S.invalid,S.unsupported].includes(prior))return fail(at,E.malformedControl);if(prior===S.waiting){if(pending===0||!externalValid(at,pending-1)||state[at+C.lastOpcode]!==O.EXTERNAL_CALL)return fail(at,E.externalProtocol);return prior;}if(prior!==S.ready){if(![S.complete,S.invalid,S.unsupported].includes(prior))return fail(at,E.malformedControl);if(prior===S.complete&&pending!==0)return fail(at,E.externalProtocol);return prior;}if(pending!==0)return fail(at,E.externalProtocol);
  for(let work=0;work<budget&&state[at+C.status]===S.ready;work++){
   const pc=state[at+C.pc];if(pc>=p.instructionCount)return fail(at,E.instructionRange);const ins=code.subarray(pc*8,pc*8+8),name=I.names[ins[0]];state[at+C.lastOpcode]=ins[0];if(p.numericContinuation&&state[at+p.numericTailOffset+Q.fields.phase]!==0&&name!=='NUM_EVAL')return fail(at,E.malformedControl);if(state[at+C.stepsLow]===0xffffffff&&state[at+C.stepsHigh]===0xffffffff)return fail(at,E.counterOverflow);if(!name)return fail(at,E.unknownOpcode);
   if(Array.from(ins).some((v,i)=>i>0&&!use[name].includes(i)&&v!==0))return fail(at,E.unknownOpcode);
   if(reg[name].some(i=>ins[i]>=p.localWords))return fail(at,E.localRange);const intrinsic=intrinsicByOpcode.get(name);if(intrinsic&&[intrinsic.resultWords,...intrinsic.parameterWords].some((width,i)=>width>p.localWords-ins[i+1]))return fail(at,E.localRange);
   const[op,dst,aa,bb,cc]=ins,a=state[lb+aa],b=state[lb+bb],c=state[lb+cc];let next=pc+1;
   if(intrinsic&&p.numericContinuation&&name==='NUM_EVAL'){const result=numericAdvance(at,pc,dst,a,b);if(result===null){if(state[at+C.status]!==S.ready)return state[at+C.status];continue;}state[lb+dst]=result;}
   else if(intrinsic){if(!intrinsicAdmitted(p,intrinsic))return fail(at,E.unsupportedPrimitive,S.unsupported);if(intrinsic.family==='preparation'){try{assertPreparationInputs(Array.from(ins.slice(2,8),slot=>state[lb+slot]),bindings,{lane});}catch{return fail(at,E.sourceDomain,S.unsupported);}}const args=intrinsic.parameterWords.map((width,i)=>state.slice(lb+ins[i+2],lb+ins[i+2]+width)),handler=options.intrinsicHandler,result=typeof handler==='function'?handler(intrinsic,args,{bindings,state,configuration:p,lane,localBase:lb}):null;if(result===null||result===undefined)return fail(at,E.unsupportedPrimitive,S.unsupported);if(intrinsic.family==='preparation'&&result?.kind==='source-preparation-failure'){if(result.error!==E.storageRange||result.status!==S.invalid)throw new TypeError('Exact preparation failure transport');return fail(at,result.error,result.status);}if(!(result instanceof Uint32Array)||result.length!==intrinsic.resultWords)throw new TypeError('Exact test-only intrinsic result words required for '+name);state.set(result,lb+dst);}
   else if(name==='EXTERNAL_CALL'){if(!p.externalFunctions.length)return fail(at,E.unsupportedPrimitive,S.unsupported);if(!externalValid(at,aa))return fail(at,E.externalProtocol);state[at+C.pendingMacro]=aa+1;state[at+C.status]=S.waiting;return S.waiting;}
   else if(name==='HALT'){state[at+C.status]=S.complete;}
   else if(name==='GUARD'){if(a===0)return fail(at,E.sourceDomain,S.unsupported);}
   else if(name==='SET')state[lb+dst]=aa;
   else if(name==='JUMP'||name==='BRANCH'||name==='CALL'){const target=name==='BRANCH'?(a!==0?bb:cc):aa;if(target>=p.instructionCount)return fail(at,E.invalidBranch);if(name==='CALL'){const sp=state[at+C.sp];if(sp>=p.stackCapacity)return fail(at,E.callCapacity,S.unsupported);state[sb+sp]=next;state[at+C.sp]=sp+1;if(options.onCall)options.onCall(Object.freeze({lane,pc,targetPc:target}));}next=target;}
   else if(name==='RET'){const sp=state[at+C.sp];if(sp===0)state[at+C.status]=S.complete;else{next=state[sb+sp-1];if(next>=p.instructionCount)return fail(at,E.invalidBranch);state[at+C.sp]=sp-1;}if(options.onReturn)options.onReturn(Object.freeze({lane,pc,targetPc:sp===0?null:next}));}
   else if(name==='LOAD'||name==='STORE'||name==='LENGTH'){if(aa>=bindings.length)return fail(at,E.storageRange);const storage=bindings[aa];if(name==='LENGTH')state[lb+dst]=storage.length;else{if(b>=storage.length)return fail(at,E.storageRange);if(name==='STORE'){if(!I.writableBindings.includes(aa)&&!(p.eventAudit&&aa===5))return fail(at,E.readonlyStorage);storage[b]=c;}else state[lb+dst]=storage[b];}}
   else if(name==='LOCAL_LOAD'||name==='LOCAL_STORE'){if(a>=p.localWords)return fail(at,E.localRange);if(name==='LOCAL_LOAD')state[lb+dst]=state[lb+a];else state[lb+a]=b;}
   else{if(!domain(name,a,b))return fail(at,E.sourceDomain,S.unsupported);state[lb+dst]=scalar(name,a,b,c);}
   recordStep(pc);state[at+C.stepsLow]=(state[at+C.stepsLow]+1)>>>0;if(state[at+C.stepsLow]===0)state[at+C.stepsHigh]++;state[at+C.pc]=next;
   if(name==='RET'&&options.stopAfterCommittedReturn){let stop;try{stop=options.stopAfterCommittedReturn(Object.freeze({lane,pc,targetPc:state[at+C.status]===S.complete?null:next}));if(typeof stop!=='boolean')throw new TypeError('TEST-only committed return stop requires boolean');}catch(error){fail(at,E.malformedControl);throw error;}if(stop)break;}
  }
  if(state[at+C.status]===S.ready){if(state[at+C.yields]===0xffffffff)return fail(at,E.counterOverflow);state[at+C.yields]++;}return state[at+C.status];
 };
 return Object.freeze({configuration:p,layout:p,state,bindings,pcCounters,begin,advance,serviceExternal,local:(lane,slot)=>{const at=base(lane);bounded(slot,'local slot',true);if(slot>=p.localWords)throw new RangeError('Local slot');return state[at+p.localsOffset+slot];}});
}

const wgslScalar={MOV:'a',UADD:'a+b',USUB:'a-b',UMUL:'a*b',UDIV:'a/b',UREM:'a%b',IADD:'a+b',ISUB:'a-b',IMUL:'a*b',IDIV:'bitcast<u32>(bitcast<i32>(a)/bitcast<i32>(b))',IREM:'bitcast<u32>(bitcast<i32>(a)%bitcast<i32>(b))',AND:'a&b',OR:'a|b',XOR:'a^b',SHL:'a<<(b&31u)',USHR:'a>>(b&31u)',ISHR:'bitcast<u32>(bitcast<i32>(a)>>(b&31u))',EQ:'select(0u,1u,a==b)',NE:'select(0u,1u,a!=b)',ULT:'select(0u,1u,a<b)',ULE:'select(0u,1u,a<=b)',UGT:'select(0u,1u,a>b)',UGE:'select(0u,1u,a>=b)',ILT:'select(0u,1u,bitcast<i32>(a)<bitcast<i32>(b))',ILE:'select(0u,1u,bitcast<i32>(a)<=bitcast<i32>(b))',IGT:'select(0u,1u,bitcast<i32>(a)>bitcast<i32>(b))',IGE:'select(0u,1u,bitcast<i32>(a)>=bitcast<i32>(b))',NOT:'~a',LNOT:'select(0u,1u,a==0u)',INEG:'0u-a',FNEG:'a^0x80000000u',UCLZ:'countLeadingZeros(a)',UCTZ:'countTrailingZeros(a)',POPCOUNT:'countOneBits(a)',FABS:'a&0x7fffffffu',SELECT:'select(a,b,c!=0u)',UTOF:'bitcast<u32>(f32(a))',ITOF:'bitcast<u32>(f32(bitcast<i32>(a)))',FTOU:'u32(bitcast<f32>(a))',FTOI:'bitcast<u32>(i32(bitcast<f32>(a)))'};
for(const[name,op]of[['FADD','+'],['FSUB','-'],['FMUL','*'],['FDIV','/']])wgslScalar[name]=`bitcast<u32>(bitcast<f32>(a)${op}bitcast<f32>(b))`;
for(const[name,op]of[['FEQ','=='],['FNE','!='],['FLT','<'],['FLE','<='],['FGT','>'],['FGE','>=']])wgslScalar[name]=`select(0u,1u,bitcast<f32>(a)${op}bitcast<f32>(b))`;
for(const[name,fn]of[['FSQRT','sqrt'],['FLOOR','floor'],['CEIL','ceil'],['TRUNC','trunc'],['ROUND','round']])wgslScalar[name]=`bitcast<u32>(${fn}(bitcast<f32>(a)))`;
for(const[name,fn]of[['FMIN','min'],['FMAX','max']])wgslScalar[name]=`bitcast<u32>(${fn}(bitcast<f32>(a),bitcast<f32>(b)))`;
function externalValidationWGSL(p){
 if(!p.externalFunctions.length)return 'fn rc_vm_external_valid(base:u32,id:u32)->bool{return false;}';
 return `fn rc_vm_external_valid(base:u32,id:u32)->bool{
 if(arrayLength(&rc_microcode)!=${p.instructionCount*8}u){return false;}
 let pc=rc_vm_state[base+${C.pc}u];let sp=rc_vm_state[base+${C.sp}u];if(pc>=${p.instructionCount-1}u||sp>${p.stackCapacity}u||rc_vm_state[base+${C.error}u]!=0u){return false;}
 switch id{${p.externalFunctions.map(x=>`case ${x.id}u:{if(pc!=${x.entryPc}u){return false;}}`).join('')}default:{return false;}}
 let ip=pc*8u;if(rc_microcode[ip]!=${O.EXTERNAL_CALL}u||rc_microcode[ip+2u]!=id||rc_microcode[ip+8u]!=${O.RET}u){return false;}
 for(var k=1u;k<8u;k++){if(k!=2u&&rc_microcode[ip+k]!=0u){return false;}if(rc_microcode[ip+8u+k]!=0u){return false;}}
 if(sp==0u){return pc==${p.entryPc}u;}let back=rc_vm_state[base+${p.stackOffset}u+sp-1u];if(back==0u||back>=${p.instructionCount}u){return false;}
 let caller=(back-1u)*8u;if(rc_microcode[caller]!=${O.CALL}u||rc_microcode[caller+2u]!=pc){return false;}for(var k=1u;k<8u;k++){if(k!=2u&&rc_microcode[caller+k]!=0u){return false;}}return true;
 }`;
}
function vmBindingsWGSL(p){return `@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;
@group(0) @binding(1) var<storage,read> rc_program:array<u32>;
@group(0) @binding(2) var<storage,read> rc_geometry:array<u32>;
@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;
@group(0) @binding(4) var<storage,read> rc_inputs:array<u32>;
@group(0) @binding(5) var<storage,read> rc_microcode:array<u32>;
@group(0) @binding(6) var<storage,read_write> rc_vm_state:array<u32>;
${p.eventAudit?'@group(0) @binding(7) var<storage,read_write> rc_event_audit:array<u32>;':''}`;}
/** Default profile emits one compact primitive switch and a bounded instruction
 * loop; original helpers are bytecode data. Explicit source-intrinsic profiles
 * additionally link the approved original helper closures verbatim, with scalar
 * marshalling only. Their compiler/device performance needs independent gates.
 * begin/main share seven bindings (eight with audit); begin ONCE per fresh run.
 */
function phasedNumericWGSL(p,fail){
 const t=`base+${p.numericTailOffset}u`,F=Q.fields;
 return `let nt=${t};let numericPhase=rc_vm_state[nt+${F.phase}u];let numericProgram=rc_vm_state[lb+aa];let numericScratch=rc_vm_state[lb+bb];
 if(numericPhase==0u){if(${Array.from({length:Q.ownedWords},(_,i)=>`rc_vm_state[nt+${i}u]!=0u`).join('||')}){${fail(E.malformedControl)}}}
 else if(rc_vm_state[nt+${F.ownerPC}u]!=pc||rc_vm_state[nt+${F.destination}u]!=dst||rc_vm_state[nt+${F.program}u]!=numericProgram||rc_vm_state[nt+${F.scratch}u]!=numericScratch){${fail(E.malformedControl)}}
 if(rc_vm_state[nt+${F.microWorkLow}u]==0xffffffffu&&rc_vm_state[nt+${F.microWorkHigh}u]==0xffffffffu){${fail(E.counterOverflow)}}
 var numericResult=0u;if(numericPhase==0u){numericResult=rc_vm_num_start(base,numericProgram,numericScratch,pc,dst);}else{numericResult=rc_vm_num_step(base);}
 if(numericResult==5u){${fail(E.malformedControl)}}
 if(numericResult!=0u){if(rc_vm_state[nt+${F.phase}u]!=5u||rc_vm_state[nt+${F.sourceResult}u]!=numericResult){${fail(E.malformedControl)}}if(rc_vm_num_clear(base)!=0u){${fail(E.malformedControl)}}}
 rc_vm_state[nt+${F.microWorkLow}u]++;if(rc_vm_state[nt+${F.microWorkLow}u]==0u){rc_vm_state[nt+${F.microWorkHigh}u]++;}
 if(numericResult==0u){return true;}rc_vm_state[lb+dst]=numericResult;`;
}
export function generateMicrocodeVmWGSL(options){
 const p=configuration(options),N=p.localWords,B=p.localsOffset,T=p.stackOffset;
 const fail=(error,status=S.invalid)=>`return rc_vm_fail(base,${error}u,${status}u);`;
 const cases=I.names.map((name,id)=>{const intrinsic=intrinsicByOpcode.get(name),unused=Array.from({length:7},(_,i)=>i+1).filter(i=>!use[name].includes(i)),regs=reg[name],pre=(unused.length?`if(${unused.map(i=>`rc_microcode[ip+${i}u]!=0u`).join('||')}){${fail(E.unknownOpcode)}}`:'')+(regs.length?`if(${regs.map(i=>`rc_microcode[ip+${i}u]>=${N}u`).join('||')}){${fail(E.localRange)}}`:'');let body;
  if(intrinsic&&p.numericContinuation&&name==='NUM_EVAL')body=phasedNumericWGSL(p,fail);
  else if(intrinsic){if(!intrinsicAdmitted(p,intrinsic))body=fail(E.unsupportedPrimitive,S.unsupported);else{const widths=[intrinsic.resultWords,...intrinsic.parameterWords];body=`if(${widths.map((width,i)=>`${width}u>${N}u-rc_microcode[ip+${i+1}u]`).join('||')}){${fail(E.localRange)}}`;const args=intrinsic.parameterWords.map((width,i)=>{const offset=['aa','bb','cc','dd','ee','ff'][i];return width===1?`rc_vm_state[lb+${offset}]`:`RcF64(rc_vm_state[lb+${offset}],rc_vm_state[lb+${offset}+1u])`;});if(intrinsic.family==='preparation')body+=`if(rc_vm_state[lb+aa]!=(base/${p.stride}u)*${p.preparationApproval.layout.bankWords}u||!rc_gp_begin(rc_vm_state[lb+aa])){${fail(E.sourceDomain,S.unsupported)}}`;body+=`let intrinsicResult=${intrinsic.name}(${args.join(',')});`;if(intrinsic.family==='preparation')body+=`if(rc_gp_error!=0u){${fail(E.storageRange)}}`;if(intrinsic.resultWords===2)body+='rc_vm_state[lb+dst]=intrinsicResult.x;rc_vm_state[lb+dst+1u]=intrinsicResult.y;';else body+=`rc_vm_state[lb+dst]=${['F64_EQ','F64_LT','F64_LE','F64_FINITE'].includes(name)?'select(0u,1u,intrinsicResult)':'intrinsicResult'};`;}}
  else if(name==='EXTERNAL_CALL')body=p.externalFunctions.length?`if(!rc_vm_external_valid(base,aa)){${fail(E.externalProtocol)}}rc_vm_state[base+${C.pendingMacro}u]=aa+1u;rc_vm_state[base+${C.status}u]=${S.waiting}u;return false;`:fail(E.unsupportedPrimitive,S.unsupported);
  else if(name==='GUARD')body=`if(a==0u){${fail(E.sourceDomain,S.unsupported)}}`;
  else if(name==='HALT')body=`rc_vm_state[base+2u]=${S.complete}u;`;
  else if(name==='SET')body='rc_vm_state[lb+dst]=aa;';
  else if(name==='JUMP'||name==='BRANCH'||name==='CALL'){body=`next=${name==='BRANCH'?'select(cc,bb,a!=0u)':'aa'};if(next>=${p.instructionCount}u){${fail(E.invalidBranch)}}`;if(name==='CALL')body+=`let sp=rc_vm_state[base+5u];if(sp>=${p.stackCapacity}u){${fail(E.callCapacity,S.unsupported)}}rc_vm_state[base+${T}u+sp]=pc+1u;rc_vm_state[base+5u]=sp+1u;`;}
  else if(name==='RET')body=`let sp=rc_vm_state[base+5u];if(sp==0u){rc_vm_state[base+2u]=${S.complete}u;}else{next=rc_vm_state[base+${T}u+sp-1u];if(next>=${p.instructionCount}u){${fail(E.invalidBranch)}}rc_vm_state[base+5u]=sp-1u;}`;
  else if(name==='LENGTH')body=`if(aa>=${p.eventAudit?6:5}u){${fail(E.storageRange)}}rc_vm_state[lb+dst]=rc_vm_storage_length(aa);`;
  else if(name==='LOAD'||name==='STORE'){body=`if(aa>=${p.eventAudit?6:5}u||b>=rc_vm_storage_length(aa)){${fail(E.storageRange)}}`;body+=name==='LOAD'?'rc_vm_state[lb+dst]=rc_vm_storage_read(aa,b);':`if(aa!=0u&&aa!=3u${p.eventAudit?'&&aa!=5u':''}){${fail(E.readonlyStorage)}}rc_vm_storage_write(aa,b,c);`;}
  else if(name==='LOCAL_LOAD'||name==='LOCAL_STORE')body=`if(a>=${N}u){${fail(E.localRange)}}`+(name==='LOCAL_LOAD'?'rc_vm_state[lb+dst]=rc_vm_state[lb+a];':'rc_vm_state[lb+a]=b;');
  else{body='';if(['UDIV','UREM','IDIV','IREM'].includes(name))body+=`if(b==0u){${fail(E.sourceDomain,S.unsupported)}}`;if(['IDIV','IREM'].includes(name))body+=`if(a==0x80000000u&&b==0xffffffffu){${fail(E.sourceDomain,S.unsupported)}}`;if(name==='FTOU'||name==='FTOI')body+=`if((a&0x7f800000u)==0x7f800000u||bitcast<f32>(a)<${name==='FTOU'?'0.0':'-2147483648.0'}||bitcast<f32>(a)>=${name==='FTOU'?'4294967296.0':'2147483648.0'}){${fail(E.sourceDomain,S.unsupported)}}`;body+=`rc_vm_state[lb+dst]=${wgslScalar[name]};`;}
  const loads=scalarLoadOperands(name).map(key=>`let ${key}=rc_vm_state[lb+${key}${key}];`).join('');return`case ${id}u:{${pre}${loads}${body}}`;
 }).join('\n');
 const storageCode=`// Source scalar VM ABI ${I.version}; exact source-intrinsic profile: ${p.intrinsics}.
${vmBindingsWGSL(p)}
${externalValidationWGSL(p)}
${p.numericContinuation?generateMicrocodeNumericContinuationWGSL({candidateCount:p.count,vmStride:p.stride,tailOffset:p.numericTailOffset}):sourceIntrinsicNativeWGSL(p.intrinsics,p.intrinsicFunctions===null?{}:{functionNames:p.intrinsicFunctions})}
fn rc_vm_fail(base:u32,error:u32,status:u32)->bool{rc_vm_state[base+2u]=status;rc_vm_state[base+3u]=error;return false;}
fn rc_vm_storage_length(binding:u32)->u32{switch binding{case 0u:{return arrayLength(&rc_state);}case 1u:{return arrayLength(&rc_program);}case 2u:{return arrayLength(&rc_geometry);}case 3u:{return arrayLength(&rc_scratch);}case 4u:{return arrayLength(&rc_inputs);}${p.eventAudit?'case 5u:{return arrayLength(&rc_event_audit);}':''}default:{return 0u;}}}
fn rc_vm_storage_read(binding:u32,address:u32)->u32{switch binding{case 0u:{return rc_state[address];}case 1u:{return rc_program[address];}case 2u:{return rc_geometry[address];}case 3u:{return rc_scratch[address];}case 4u:{return rc_inputs[address];}${p.eventAudit?'case 5u:{return rc_event_audit[address];}':''}default:{return 0u;}}}
fn rc_vm_storage_write(binding:u32,address:u32,value:u32){if(binding==0u){rc_state[address]=value;}else if(binding==3u){rc_scratch[address]=value;}${p.eventAudit?'else if(binding==5u){rc_event_audit[address]=value;}':''}}
fn rc_vm_step(base:u32)->bool{
 let pc=rc_vm_state[base+4u];if(pc>=${p.instructionCount}u){${fail(E.instructionRange)}}let ip=pc*8u;let op=rc_microcode[ip];rc_vm_state[base+9u]=op;${p.numericContinuation?`if(rc_vm_state[base+${p.numericTailOffset+Q.fields.phase}u]!=0u&&op!=${O.NUM_EVAL}u){${fail(E.malformedControl)}}`:''}
 if(rc_vm_state[base+6u]==0xffffffffu&&rc_vm_state[base+7u]==0xffffffffu){${fail(E.counterOverflow)}}
 let lb=base+${B}u;let dst=rc_microcode[ip+1u];let aa=rc_microcode[ip+2u];let bb=rc_microcode[ip+3u];let cc=rc_microcode[ip+4u];${p.intrinsics===PREPARATION_PROFILE?'let dd=rc_microcode[ip+5u];let ee=rc_microcode[ip+6u];let ff=rc_microcode[ip+7u];':''}
 // Only opcode-required local values are read, after its operand guards.
 var next=pc+1u;
 switch op{${cases}\ndefault:{${fail(E.unknownOpcode)}}}
 rc_vm_state[base+6u]++;if(rc_vm_state[base+6u]==0u){rc_vm_state[base+7u]++;}rc_vm_state[base+4u]=next;return rc_vm_state[base+2u]==1u;
}
@compute @workgroup_size(${p.workgroupSize}) fn begin(@builtin(global_invocation_id) gid:vec3<u32>){
 if(gid.x>=${p.count}u||arrayLength(&rc_vm_state)!=${p.totalWords}u){return;}let base=gid.x*${p.stride}u;
 for(var k=0u;k<${p.stride}u;k++){rc_vm_state[base+k]=0u;}rc_vm_state[base]=${C.magic}u;rc_vm_state[base+1u]=1u;rc_vm_state[base+2u]=1u;rc_vm_state[base+4u]=${p.entryPc}u;rc_vm_state[base+10u]=${p.entryPc}u;
 ${p.initialSlots.map(x=>`rc_vm_state[base+${B+x.slot}u]=gid.x*${x.candidateStride}u+${x.value}u;`).join('\n')}
}
@compute @workgroup_size(${p.workgroupSize}) fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 if(gid.x>=${p.count}u||arrayLength(&rc_vm_state)!=${p.totalWords}u){return;}let base=gid.x*${p.stride}u;
 if(rc_vm_state[base]!=${C.magic}u||rc_vm_state[base+1u]!=1u||rc_vm_state[base+10u]!=${p.entryPc}u||rc_vm_state[base+5u]>${p.stackCapacity}u){rc_vm_fail(base,1u,3u);return;}
 for(var k=${C.reservedStart}u;k<16u;k++){if(rc_vm_state[base+k]!=0u){rc_vm_fail(base,1u,3u);return;}}
 ${p.numericContinuation?`if(rc_vm_state[base+${p.numericTailOffset+Q.fields.phase}u]==0u&&(${Array.from({length:Q.ownedWords},(_,i)=>`rc_vm_state[base+${p.numericTailOffset+i}u]!=0u`).join('||')})){rc_vm_fail(base,${E.malformedControl}u,3u);return;}`:''}let status=rc_vm_state[base+2u];let pending=rc_vm_state[base+${C.pendingMacro}u];${p.numericContinuation?`if(rc_vm_state[base+${p.numericTailOffset+Q.fields.phase}u]!=0u&&status!=1u&&status!=3u&&status!=4u){rc_vm_fail(base,${E.malformedControl}u,3u);return;}`:''}if(status==${S.waiting}u){if(pending==0u||!rc_vm_external_valid(base,pending-1u)||rc_vm_state[base+${C.lastOpcode}u]!=${O.EXTERNAL_CALL}u){rc_vm_fail(base,${E.externalProtocol}u,3u);}return;}if(status!=1u){if(status<2u||status>4u){rc_vm_fail(base,1u,3u);}else if(status==2u&&pending!=0u){rc_vm_fail(base,${E.externalProtocol}u,3u);}return;}if(pending!=0u){rc_vm_fail(base,${E.externalProtocol}u,3u);return;}
 if(arrayLength(&rc_microcode)!=${p.instructionCount*8}u){rc_vm_fail(base,2u,3u);return;}
 for(var work=0u;work<${p.instructionBudget}u;work++){if(!rc_vm_step(base)){return;}}
 if(rc_vm_state[base+8u]==0xffffffffu){rc_vm_fail(base,${E.counterOverflow}u,3u);return;}rc_vm_state[base+8u]++;
}
`;
 return p.controlMode==='invocation-cache-v1'?generateCachedMicrocodeControlWGSL(storageCode,p):storageCode;
}

/** Explicit TEST-only control-cache differential model; the canonical storage
 * reference above remains unchanged and is the independent transport oracle. */
export function createMicrocodeCachedVmReferenceForTest(options){return createCachedMicrocodeReferenceForTest(options,createMicrocodeVmReferenceForTest,microcodeVmLayout);}

/** Separate exact-source macro kernel: no generic bytecode loop or native
 * callback. Source buffers and CALL stack remain resident. Wrong valid macro
 * selection/duplicate dispatch is inert; malformed protocol fails before the
 * source body. Default WGS1 matches the earlier independently compiled macro.
 */
export function generateMicrocodeExternalWGSL(options){
 const p=configuration(options),d=p.externalFunctions.find(x=>x.id===options.macroId);if(!d)throw new TypeError('Explicit approved external macro ID required');
 const numberGuard=d.id===4?generateNumberProgramMacroAdmissionWGSL(options.numberProgramViews,p):'';
 if(d.id!==4&&options.numberProgramViews!==undefined)throw new TypeError('Number macro logical views apply only to its explicit handler');
 return `// Source macro ${d.name}; closure ${d.approval.closureSha256}.
${vmBindingsWGSL(p)}
${sourceMacroNativeWGSL(d.name)}
${externalValidationWGSL(p)}${numberGuard}
fn rc_vm_external_fail(base:u32,error:u32){rc_vm_state[base+${C.status}u]=${S.invalid}u;rc_vm_state[base+${C.error}u]=error;}
@compute @workgroup_size(${p.workgroupSize}) fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 if(gid.x>=${p.count}u||arrayLength(&rc_vm_state)!=${p.totalWords}u){return;}let base=gid.x*${p.stride}u;
 if(rc_vm_state[base+${C.magicWord}u]!=${C.magic}u||rc_vm_state[base+${C.versionWord}u]!=${C.version}u||rc_vm_state[base+${C.entryPc}u]!=${p.entryPc}u||rc_vm_state[base+${C.sp}u]>${p.stackCapacity}u){rc_vm_external_fail(base,${E.malformedControl}u);return;}
 for(var k=${C.reservedStart}u;k<${C.words}u;k++){if(rc_vm_state[base+k]!=0u){rc_vm_external_fail(base,${E.malformedControl}u);return;}}
 let status=rc_vm_state[base+${C.status}u];let pending=rc_vm_state[base+${C.pendingMacro}u];
 ${p.numericContinuation?`if(status==${S.waiting}u&&(${Array.from({length:Q.ownedWords},(_,i)=>`rc_vm_state[base+${p.numericTailOffset+i}u]!=0u`).join('||')})){rc_vm_external_fail(base,${E.malformedControl}u);return;}`:''}if(status!=${S.waiting}u){if(status==${S.invalid}u||status==${S.unsupported}u){return;}if((status!=${S.ready}u&&status!=${S.complete}u)||pending!=0u){rc_vm_external_fail(base,${E.externalProtocol}u);}return;}
 if(pending==0u||!rc_vm_external_valid(base,pending-1u)||rc_vm_state[base+${C.lastOpcode}u]!=${O.EXTERNAL_CALL}u){rc_vm_external_fail(base,${E.externalProtocol}u);return;}if(pending!=${d.id+1}u){return;}
 if(rc_vm_state[base+${C.stepsLow}u]==0xffffffffu&&rc_vm_state[base+${C.stepsHigh}u]==0xffffffffu){rc_vm_external_fail(base,${E.counterOverflow}u);return;}
 let lb=base+${p.localsOffset}u;${numberGuard?`if(!rc_vm_number_admit(gid.x,${d.params.map(x=>`rc_vm_state[lb+${x.slot}u]`).join(',')})){rc_vm_external_fail(base,${E.storageRange}u);return;}`:''}${d.returnWords?'let result=':''}${d.name}(${d.params.map(x=>`rc_vm_state[lb+${x.slot}u]`).join(',')});
 ${d.returnWords?`rc_vm_state[lb+${d.returnSlot}u]=result;`:''}rc_vm_state[base+${C.pendingMacro}u]=0u;rc_vm_state[base+${C.pc}u]++;rc_vm_state[base+${C.stepsLow}u]++;if(rc_vm_state[base+${C.stepsLow}u]==0u){rc_vm_state[base+${C.stepsHigh}u]++;}rc_vm_state[base+${C.status}u]=${S.ready}u;
}
`;
}
