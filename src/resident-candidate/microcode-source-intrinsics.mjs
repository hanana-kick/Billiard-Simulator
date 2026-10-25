/* SPDX-License-Identifier: Apache-2.0
 * HOST preparation: explicit exact-source primitive admission. Native bodies
 * are the existing software-binary64/profiled graph implementations, unchanged.
 * This does not qualify their numerical domains, devices, or whole shots.
 */
import {createHash} from 'node:crypto';
import {parseMicrocodeWGSL} from './microcode-parser.mjs';
import {generateSourceNumberWGSL} from './source-number.mjs';
import {generateProfiledNumericWGSL,NUMERIC_PROFILE} from './numeric-profile.mjs';
import {generateNumericContinuationWGSL} from './numeric-continuation.mjs';
import {generateSourceNumberContinuationWGSL} from './source-number-continuation.mjs';
import {linkResidentWGSL} from './wgsl-linker.mjs';
const rows=[
 ['rc_f64_add','F64_ADD',[2,2],2],['rc_f64_sub','F64_SUB',[2,2],2],
 ['rc_f64_mul','F64_MUL',[2,2],2],['rc_f64_div','F64_DIV',[2,2],2],
 ['rc_f64_sqrt','F64_SQRT',[2],2],['rc_f64_from_u32','F64_FROM_U32',[1],2],
 ['rc_f64_from_f32_bits','F64_FROM_F32',[1],2],['rc_f64_to_f32_bits','F64_TO_F32',[2],1],
 ['rc_f64_eq','F64_EQ',[2,2],1],['rc_f64_lt','F64_LT',[2,2],1],
 ['rc_f64_le','F64_LE',[2,2],1],['rc_f64_finite','F64_FINITE',[2],1],
 ['rc_num_eval','NUM_EVAL',[1,1],1],['rc_num_soft_arithmetic','NUM_SOFT_ARITH',[1,1,1],1],
 ['rc_num_widen','NUM_WIDEN',[1],2],
 ['rc_num_cont_instruction','NUM_CONT_INSTRUCTION',[1],1],
 ['rc_source_program_instruction','SOURCE_PROGRAM_INSTRUCTION',[1,1,1],1]
];
export const MICROCODE_SOURCE_INTRINSICS=Object.freeze(rows.map(([name,opcode,parameterWords,resultWords])=>Object.freeze({name,opcode,parameterWords:Object.freeze(parameterWords),resultWords,family:name==='rc_num_cont_instruction'?'numeric-continuation':name==='rc_source_program_instruction'?'source-continuation':name.startsWith('rc_f64_')?'f64':'numeric'})));
export const MICROCODE_INTRINSIC_PROFILES=Object.freeze(['none','source-f64-v1','source-numeric-v1','source-continuations-v1']);
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const walk=(x,visit)=>{if(!x||typeof x!=='object')return;visit(x);for(const v of Object.values(x))if(Array.isArray(v))v.forEach(y=>walk(y,visit));else walk(v,visit);};
const index=rows=>new Map(rows.map(x=>[x.name,x]));
export function sourceIntrinsicNativeWGSL(profile){
 if(!MICROCODE_INTRINSIC_PROFILES.includes(profile))throw new RangeError('Explicit exact-source intrinsic profile required');
 if(profile==='source-continuations-v1'){
  // Link only verbatim existing source bodies. The synthetic root exists only
  // to retain approved closures, and is removed before parsing/submission.
  const root='fn rc_micro_intrinsic_keep(){'+MICROCODE_SOURCE_INTRINSICS.map(x=>x.name+'('+x.parameterWords.map(w=>w===2?'RcF64()':'0u').join(',')+');').join('')+'}';
  const code=linkResidentWGSL([generateProfiledNumericWGSL(NUMERIC_PROFILE.PRESERVED_F32),generateNumericContinuationWGSL(),generateSourceNumberContinuationWGSL({includeNumberLibrary:false}),root],{entry:'rc_micro_intrinsic_keep'}).code;
  if(code.split(root).length!==2)throw new Error('Exact intrinsic retention boundary changed');
  return code.replace(root,'');
 }
 return profile==='none'?'':profile==='source-f64-v1'?generateSourceNumberWGSL():generateProfiledNumericWGSL(NUMERIC_PROFILE.PRESERVED_F32);
}
const canonicalCache=new Map();
function canonical(profile){if(canonicalCache.has(profile))return canonicalCache.get(profile);const code=sourceIntrinsicNativeWGSL(profile),ast=parseMicrocodeWGSL(code),value={code,ast,functions:index(ast.functions)};canonicalCache.set(profile,value);return value;}
/** Approval checks the whole reachable original helper closure, including
 * function signatures and exact parsed body/literal/operator order, not merely
 * an entry name. All canonical aliases/struct layouts/profile constants also
 * match. A changed helper dependency fails even if the root text is unchanged.
 * Parsed hashes ignore only whitespace/comments, never numerical operations.
 */
export function approveSourceIntrinsics(code,{profile='none',storageBindings={rc_state:0,rc_program:1,rc_scratch:3},functionNames}={}){
 if(!MICROCODE_INTRINSIC_PROFILES.includes(profile))throw new RangeError('Unknown source intrinsic profile');
 if(profile==='none')return Object.freeze({profile,entries:Object.freeze([]),nativeSourceSha256:null});
 const source=parseMicrocodeWGSL(code),actual=index(source.functions),c=canonical(profile),wanted=functionNames?new Set(functionNames):new Set(actual.keys());
 const selected=MICROCODE_SOURCE_INTRINSICS.filter(x=>wanted.has(x.name)&&actual.has(x.name)&&(profile==='source-continuations-v1'||profile==='source-numeric-v1'&&['f64','numeric'].includes(x.family)||x.family==='f64'));
 if(!selected.length)return Object.freeze({profile,entries:Object.freeze([]),nativeSourceSha256:hash(c.code)});
 const requiredStorage=new Map();
 for(const x of selected){
  if(x.family!=='f64')requiredStorage.set('rc_program',[1,'read']);
  if(['numeric','numeric-continuation'].includes(x.family))requiredStorage.set('rc_scratch',[3,'read_write']);
  if(x.family.endsWith('-continuation'))requiredStorage.set('rc_state',[0,'read_write']);
 }
 for(const[name,[binding,access]]of requiredStorage){
  const g=source.globals.find(x=>x.name===name),bindingAttribute=g?.attributes.find(x=>x.name==='binding'),groupAttribute=g?.attributes.find(x=>x.name==='group');
  if(!g||g.storage!=='storage'||g.access!==access||g.type?.name!=='array'||g.type.args.length!==1||g.type.args[0].name!=='u32'||g.type.args[0].args.length!==0||bindingAttribute?.args.length!==1||Number(bindingAttribute.args[0].text)!==binding||groupAttribute?.args.length!==1||Number(groupAttribute.args[0].text)!==0)throw new TypeError('Exact native graph storage declaration required: '+name);
  if(storageBindings[name]!==binding)throw new TypeError('Exact native graph source address-space bindings required: '+name);
 }
 for(const group of['aliases','structs','globals']){const found=index(source[group]);for(const row of c.ast[group])if(!found.has(row.name)||hash(found.get(row.name))!==hash(row))throw new TypeError('Exact intrinsic source '+group+' declaration mismatch: '+row.name);}
 const entries=selected.map(spec=>{
  const todo=[spec.name],seen=new Set(),dependencies={};
  while(todo.length){const name=todo.pop();if(seen.has(name))continue;seen.add(name);const expected=c.functions.get(name),got=actual.get(name);if(!expected||!got||hash(expected)!==hash(got))throw new TypeError('Exact intrinsic function signature/body mismatch: '+name);
   dependencies[name]=hash(expected);walk(expected.body,node=>{if(node.kind==='call'&&node.callee?.kind==='name'&&c.functions.has(node.callee.name))todo.push(node.callee.name);});
  }
  return Object.freeze({...spec,signatureSha256:hash({params:c.functions.get(spec.name).params,returnType:c.functions.get(spec.name).returnType}),bodySha256:hash(c.functions.get(spec.name).body),dependencies:Object.freeze(dependencies),closureSha256:hash(Object.fromEntries(Object.entries(dependencies).sort()))});
 });
 return Object.freeze({profile,entries:Object.freeze(entries),nativeSourceSha256:hash(c.code)});
}
