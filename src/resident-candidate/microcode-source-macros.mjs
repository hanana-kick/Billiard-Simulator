/* SPDX-License-Identifier: Apache-2.0
 * HOST-only admission of explicitly selected source-authentic bounded calls.
 * Native handlers execute separately from the generic scalar instruction loop.
 * This is source-closure admission, not device/whole-shot qualification.
 */
import {createHash} from 'node:crypto';
import {parseMicrocodeWGSL} from './microcode-parser.mjs';
import {generateCueFlatWGSL} from './cue-flat.mjs';
import {generateProfiledNumericWGSL,NUMERIC_PROFILE} from './numeric-profile.mjs';
import {generateWorldBroadWGSL} from './world-broad.mjs';
import {generateBvhWGSL} from './bvh.mjs';
import {generateContactJournalWGSL} from './contact-journal.mjs';
import {linkResidentWGSL} from './wgsl-linker.mjs';
export const MICROCODE_SOURCE_MACROS=Object.freeze([
 Object.freeze({id:0,name:'rc_cue_flat_advance',parameterWords:Object.freeze(Array(8).fill(1)),resultWords:1,sourceBudget:'original argument8; no budget substitution'}),
 Object.freeze({id:1,name:'rc_num_eval',parameterWords:Object.freeze([1,1]),resultWords:1,sourceBudget:'original immutable graph node/operand/output limits'}),
 Object.freeze({id:2,name:'rc_world_broad_commit_collision',parameterWords:Object.freeze([1,1,1]),resultWords:0,sourceBudget:'original bounded BVH lifecycle and ordered changed-tree journal walk'}),
]);
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const index=rows=>new Map(rows.map(x=>[x.name,x]));
const walk=(x,visit)=>{if(!x||typeof x!=='object')return;visit(x);for(const v of Object.values(x))if(Array.isArray(v))v.forEach(y=>walk(y,visit));else walk(v,visit);};
const cache=new Map();
function canonical(name){
 if(cache.has(name))return cache.get(name);
 const spec=MICROCODE_SOURCE_MACROS.find(x=>x.name===name);if(!spec)throw new TypeError('Unknown exact source macro '+name);
 const source=name==='rc_cue_flat_advance'?generateCueFlatWGSL({numericProfile:NUMERIC_PROFILE.PRESERVED_F32}):name==='rc_num_eval'?generateProfiledNumericWGSL(NUMERIC_PROFILE.PRESERVED_F32):[generateWorldBroadWGSL(),generateBvhWGSL(),generateContactJournalWGSL()].join('\n');
 const root='fn rc_micro_macro_keep(){'+name+'('+spec.parameterWords.map(()=> '0u').join(',')+');}',linked=linkResidentWGSL([source,root],{entry:'rc_micro_macro_keep'}).code;
 if(linked.split(root).length!==2)throw new TypeError('Exact source macro retention boundary');
 const code=linked.replace(root,''),ast=parseMicrocodeWGSL(code);
 // There is no private invocation state to silently lose across dispatches.
 if(ast.globals.some(g=>g.storage==='private'))throw new TypeError('Source macro private state requires explicit transport');
 const value={spec,code,ast,functions:index(ast.functions)};cache.set(name,value);return value;
}
/** Returns the unchanged source dependency closure, without bindings/entry. */
export function sourceMacroNativeWGSL(name){return canonical(name).code;}
/** Compare parsed exact signatures, bodies, transitive callees, declarations
 * and profile. Whitespace/comments are irrelevant; numerical/source ordering
 * is not. Explicit storage views retain the original logical array lengths.
 */
export function approveSourceMacros(code,{functionNames=[],storageBindings={rc_state:0,rc_program:1,rc_scratch:3}}={}){
 if(!Array.isArray(functionNames)||functionNames.some(x=>typeof x!=='string')||new Set(functionNames).size!==functionNames.length)throw new TypeError('Explicit unique external function names required');
 const source=parseMicrocodeWGSL(code),actual=index(source.functions),entries=[];
 for(const name of functionNames){
  const c=canonical(name);if(!actual.has(name))throw new TypeError('External source macro is absent: '+name);
  const requiredBindings=name==='rc_world_broad_commit_collision'?[['rc_state',0,'read_write']]:[['rc_program',1,'read'],['rc_scratch',3,'read_write'],...(name==='rc_cue_flat_advance'?[['rc_state',0,'read_write']]:[])];
  for(const [bindingName,binding,access]of requiredBindings){
   const g=source.globals.find(x=>x.name===bindingName),b=g?.attributes.find(a=>a.name==='binding'),group=g?.attributes.find(a=>a.name==='group');
   if(!g||g.storage!=='storage'||g.access!==access||g.type?.name!=='array'||g.type.args.length!==1||g.type.args[0].name!=='u32'||g.type.args[0].args.length!==0||b?.args.length!==1||Number(b.args[0].text)!==binding||group?.args.length!==1||Number(group.args[0].text)!==0||storageBindings[bindingName]!==binding)throw new TypeError('Exact external source address-space binding required: '+bindingName);
  }
  for(const group of['aliases','structs','globals']){const got=index(source[group]);for(const row of c.ast[group])if(!got.has(row.name)||hash(got.get(row.name))!==hash(row))throw new TypeError('External source '+group+' declaration mismatch: '+row.name);}
  const dependencies={},todo=[name],seen=new Set();while(todo.length){const f=todo.pop();if(seen.has(f))continue;seen.add(f);const want=c.functions.get(f),got=actual.get(f);if(!want||!got||hash(want)!==hash(got))throw new TypeError('Exact external source signature/body mismatch: '+f);dependencies[f]=hash(want);walk(want.body,n=>{if(n.kind==='call'&&n.callee?.kind==='name'&&c.functions.has(n.callee.name))todo.push(n.callee.name);});}
  const f=c.functions.get(name),returnMatches=c.spec.resultWords===0?f.returnType===null:f.returnType?.name==='u32'&&f.returnType.args.length===0;
  if(f.params.length!==c.spec.parameterWords.length||f.params.some(p=>p.type.name!=='u32'||p.type.args.length)||!returnMatches)throw new TypeError('Exact scalar-word/void external signature required');
  entries.push(Object.freeze({...c.spec,signatureSha256:hash({params:f.params,returnType:f.returnType}),bodySha256:hash(f.body),dependencies:Object.freeze(dependencies),closureSha256:hash(Object.fromEntries(Object.entries(dependencies).sort())),nativeSourceSha256:hash(c.code)}));
 }
 return Object.freeze({kind:'resident-source-macro-approval-v1',sourceSha256:hash(code),entries:Object.freeze(entries)});
}
