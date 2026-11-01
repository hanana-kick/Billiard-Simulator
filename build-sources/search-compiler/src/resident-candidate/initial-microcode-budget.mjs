/* SPDX-License-Identifier: Apache-2.0
 * Source-only admission for the CURRENT fixed world layout. These full caller
 * AST identities are the independently checked six-row source contract, not
 * name-only approval or a claim about arbitrary pointer programs. Only the
 * explicit candidate-count guard of the cap initializer is parameterized.
 */
import {createHash} from './source-sha256.mjs';
import {parseMicrocodeWGSL} from './microcode-parser.mjs';
import {approveSourceMacros} from './microcode-source-macros.mjs';
import {MICROCODE_ISA as I} from './microcode-isa.mjs';
const need=(ok,message)=>{if(!ok)throw new RangeError('Initial microcode budget: '+message);};
const sha=x=>createHash('sha256').update(typeof x==='string'||ArrayBuffer.isView(x)?x:JSON.stringify(x)).digest('hex');
const CALLERS=Object.freeze({rc_owner_coupled_body_1:'a63fb14642c0cf164b826c9955b7103630bfecc3dfe90fa99313d08367b5397b',rc_owner_cue_body_1:'f98050492c535db4acc1f107cd86dc7d029152f6941d39f918ed8ee6a33086c4',rc_owner_coupled_guard:'43fbc3256c3a4bf5be7235831159fb2a9021d1f0d4e8c5cbfd5f49bfcd814404'});
const CALLER_CODE=Object.freeze({rc_owner_coupled_body_1:'3c06892f540ef41a92dbb760ae2b4463a6b578b514e39d85153dc6270beeb89c',rc_owner_cue_body_1:'9394fd88f49e3119b55cad6851b954526584ca4ea93cfc4686cf7c15f6acbf05'});
const PHASE_CODE='ab187dd4533af1c9503c1ca428337b1f584875884de908979f7e313e188b0d8d';
const PHASE='226201014e15fd84529b81802490af65a0f41398fb1614fadb2488e49e33f5e0';
const walk=(x,fn)=>{if(!x||typeof x!=='object')return;fn(x);for(const v of Object.values(x))if(Array.isArray(v))v.forEach(y=>walk(y,fn));else walk(v,fn);};
export function inspectInitialMicrocodeBudget({code,compiled,count,stateWords,scratchWords}={}){
 need(Number.isInteger(count)&&count>=1&&count<=4096,'bounded explicit count');need(stateWords===62976&&scratchWords===13632,'current independently admitted world/scratch layout only');
 const sourceSha256=sha(code);need(compiled?.sourceSha256===sourceSha256,'fresh complete source compiler identity');
 const ast=parseMicrocodeWGSL(code),byName=new Map(ast.functions.map(f=>[f.name,f]));
 for(const[name,hash]of Object.entries(CALLERS))need(sha(byName.get(name))===hash,'complete original caller/guard '+name);
 const phase=structuredClone(byName.get('rc_pc_source_stage_owner_phase_1'));need(phase?.body?.body?.[0]?.test?.right?.text===count+'u','actual candidate guard matches declared count');phase.body.body[0].test.right.text='6u';need(sha(phase)===PHASE,'original source cap initializer except declared count guard');
 const sites=[];for(const f of ast.functions)walk(f.body,n=>{if(n.kind==='call'&&n.callee?.name==='rc_coupled_transport_advance')sites.push({caller:f.name,node:n});});need(sites.length===1&&sites[0].caller==='rc_owner_coupled_body_1','sole coupled source call');
 const sourceApproval=approveSourceMacros(code,{functionNames:['rc_coupled_transport_advance'],storageBindings:I.bindings}).entries[0],descriptor=compiled.externalFunctions.find(d=>d.id===3);need(descriptor&&sha(descriptor.approval)===sha(sourceApproval),'canonical source closure/signature/body/declaration approval');
 const words=compiled.instructions;need(words instanceof Uint32Array&&words.length%8===0,'whole generated instructions');const calls=[];for(let pc=0;pc<words.length/8;pc++)if(words[pc*8]===I.opcodes.CALL&&words[pc*8+2]===descriptor.entryPc)calls.push(pc);
 const sorted=[...compiled.functions].sort((a,b)=>a.entryPc-b.entryPc);
 const body=name=>{const i=sorted.findIndex(f=>f.name===name);need(i>=0,'compiled source function '+name);return words.subarray(sorted[i].entryPc*8,(sorted[i+1]?.entryPc??words.length/8)*8);};
 for(const[name,hash]of Object.entries(CALLER_CODE))need(sha(body(name))===hash,'complete compiled caller/guard words '+name);
 const phaseCode=body('rc_pc_source_stage_owner_phase_1').slice();need(phaseCode[24]===I.opcodes.SET&&phaseCode[26]===count,'only declared compiled lane-guard constant');phaseCode[26]=6;need(sha(phaseCode)===PHASE_CODE,'complete compiled cap initializer except lane-count constant');
 const index=sorted.findIndex(f=>f.name==='rc_owner_coupled_body_1'),f=sorted[index],end=sorted[index+1]?.entryPc??words.length/8;
 need(calls.length===1&&f&&calls[0]>=f.entryPc&&calls[0]<end,'sole compiled call in exact source caller');
 need(Array.from(words.subarray(descriptor.entryPc*8,descriptor.entryPc*8+16)).join(',')===[I.opcodes.EXTERNAL_CALL,0,3,0,0,0,0,0,I.opcodes.RET,0,0,0,0,0,0,0].join(','),'ordinary source id3 stub and RET');
 return Object.freeze({kind:'resident-initial-microcode-budget-source-proof-v1',count,sourceSha256,bytecodeSha256:sha(words),descriptorsSha256:sha(compiled.externalFunctions),callerAstSha256:CALLERS,callerBytecodeSha256:CALLER_CODE,normalizedCapInitializerSha256:PHASE,normalizedCapInitializerBytecodeSha256:PHASE_CODE,coupledClosureSha256:sourceApproval.closureSha256,coupledSignatureSha256:sourceApproval.signatureSha256,coupledBodySha256:sourceApproval.bodySha256,sourceInstructionBudget:32768,sourceMaximumInstructionBudget:1000000,bankWords:stateWords,scratchWords,budgetOffset:62744,coupledCallPC:calls[0],coupledEntryPC:descriptor.entryPc,argumentSlot:descriptor.params[5].slot,literalArgumentSubstitution:false,sourceOnly:true,numericalQualified:false,arbitraryPointerSafetyQualified:false});
}
