/* SPDX-License-Identifier: Apache-2.0
 * HOST-only, opt-in whole-call-frame overlap. This is not scalar liveness:
 * every function allocation stays live until its return, including address-
 * taken aggregates and caller values surviving nested calls / VM yields.
 * No instruction is removed, reordered or evaluated. Only certified local
 * operands and compiler-marked address constants are relocated.
 */
import {createHash} from './source-sha256.mjs';
import {MICROCODE_ISA as I} from './microcode-isa.mjs';
import {MICROCODE_SOURCE_INTRINSICS} from './microcode-source-intrinsics.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex'),bad=x=>{throw new TypeError('Microcode frame allocation: '+x);};
const unary=new Set(['MOV','NOT','LNOT','INEG','FNEG','UCLZ','UCTZ','POPCOUNT','FABS','FSQRT','FLOOR','CEIL','TRUNC','ROUND','UTOF','ITOF','FTOU','FTOI']);
const binary=new Set(['UADD','USUB','UMUL','UDIV','UREM','IADD','ISUB','IMUL','IDIV','IREM','FADD','FSUB','FMUL','FDIV','AND','OR','XOR','SHL','USHR','ISHR','EQ','NE','ULT','ULE','UGT','UGE','ILT','ILE','IGT','IGE','FEQ','FNE','FLT','FLE','FGT','FGE','FMIN','FMAX']);
const intrinsic=new Map(MICROCODE_SOURCE_INTRINSICS.map(x=>[x.opcode,x]));
function operands(name){
 const d=intrinsic.get(name);if(d)return[[1,d.resultWords],...d.parameterWords.map((words,i)=>[i+2,words])];
 if(unary.has(name))return[[1,1],[2,1]];if(binary.has(name))return[[1,1],[2,1],[3,1]];
 const fields={HALT:[],SET:[1],LOAD:[1,3],STORE:[3,4],LENGTH:[1],LOCAL_LOAD:[1,2],LOCAL_STORE:[2,3],JUMP:[],BRANCH:[2],CALL:[],RET:[],EXTERNAL_CALL:[],GUARD:[2],SELECT:[1,2,3,4]}[name];
 if(!fields)bad('Unknown instruction operand layout '+name);return fields.map(x=>[x,1]);
}
/** Requires opt-in compiler allocationMetadata:true. Default compiler output
 * and all existing noncompacted executors remain untouched. Sibling frames may
 * overlap; every ancestor/descendant pair is disjoint on every possible call
 * path. Private globals and module initializer temporaries never overlap.
 */
export function allocateMicrocodeLocals(compiled,{mode}={}){
 if(mode!=='call-frames-v1')bad('Explicit call-frames-v1 opt-in required');
 const m=compiled?.allocationMetadata,code=compiled?.instructions;
 if(compiled?.kind!=='resident-wgsl-microcode-v1'||compiled.version!==I.version||!(code instanceof Uint32Array)||code.length%8||m?.kind!=='resident-microcode-allocation-metadata-v1'||m.version!==1||m.localWords!==compiled.localWords)bad('Compiler allocation metadata required');
 if(m.bytecodeSha256!==hash(code))bad('Bytecode changed after allocation metadata');
 if(m.escapingPointers.length)bad('Escaping pointer authority: '+m.escapingPointers.join(', '));
 const count=code.length/8,functions=new Map(compiled.functions.map(f=>[f.name,f])),entries=new Map(compiled.functions.map(f=>[f.entryPc,f])),owners=new Map([['$pinned',{name:'$pinned',allocations:[],words:0,base:0,callees:new Set()}]]);
 if(functions.size!==compiled.functions.length||entries.size!==functions.size)bad('Unique functions and entries required');
 for(const f of functions.values())owners.set(f.name,{name:f.name,allocations:[],words:0,base:0,callees:new Set()});
 const wordOwner=new Array(compiled.localWords),sorted=[...m.allocations].sort((a,b)=>a.slot-b.slot);let covered=0;
 for(const a of sorted){if(!owners.has(a.owner)||a.slot!==covered||!Number.isInteger(a.words)||a.words<1)bad('Exact contiguous allocation coverage required');covered+=a.words;if(covered>wordOwner.length)bad('Allocation outside source locals');const o=owners.get(a.owner);o.allocations.push({...a,offset:o.words});o.words+=a.words;wordOwner.fill(a.owner,a.slot,covered);}
 if(covered!==compiled.localWords)bad('Unowned source local words');
 const pcOwner=new Array(count).fill('$pinned'),ordered=[...functions.values()].sort((a,b)=>a.entryPc-b.entryPc);
 for(let i=0;i<ordered.length;i++){const f=ordered[i],end=ordered[i+1]?.entryPc??count;if(!Number.isInteger(f.entryPc)||f.entryPc<1||f.entryPc>=end)bad('Valid ordered function ranges required');pcOwner.fill(f.name,f.entryPc,end);}
 const calls=new Map();
 for(let pc=0;pc<count;pc++){const at=pc*8,name=I.names[code[at]],owner=pcOwner[pc];if(!name)bad('Unknown opcode');
  if(name==='JUMP'||name==='BRANCH'){const targets=name==='JUMP'?[code[at+2]]:[code[at+3],code[at+4]];if(targets.some(x=>x>=count||pcOwner[x]!==owner))bad('Cross-function branch');}
  if(name==='CALL'){const f=entries.get(code[at+2]);if(!f)bad('CALL target is not exact function entry');if(owner==='$pinned'&&f.name!==compiled.entryFunction)bad('Non-entry module initializer call');owners.get(owner).callees.add(f.name);calls.set(pc,{caller:owner,callee:f.name});}
 }
 // Source compiler certifies the only allowed explicit cross-frame accesses:
 // the adjacent argument MOVs before CALL and return MOVs immediately after it.
 const authorized=new Map();
 for(const r of m.foreignMoves){const c=calls.get(r.callPc),f=functions.get(r.callee),at=r.pc*8;if(!c||c.callee!==r.callee||pcOwner[r.pc]!==c.caller||code[at]!==I.opcodes.MOV||!f)bad('Unproven foreign MOV');let expected;
  if(r.kind==='argument'&&r.field===1){const params=f.params.flatMap(p=>Array.from({length:p.words},(_,i)=>p.slot+i)),index=r.pc-(r.callPc-params.length);if(index<0||index>=params.length)bad('Argument MOV not adjacent to CALL');expected=params[index];}
  else if(r.kind==='return'&&r.field===2){const index=r.pc-r.callPc-1;if(index<0||index>=f.returnWords)bad('Return MOV not adjacent to CALL');expected=f.returnSlot+index;}
  else bad('Unknown foreign MOV role');
  if(code[at+r.field]!==expected||wordOwner[expected]!==r.callee)bad('Foreign MOV outside exact parameter/return span');const key=r.pc+':'+r.field;if(authorized.has(key))bad('Duplicate foreign MOV proof');authorized.set(key,r.callee);
 }
 for(let pc=0;pc<count;pc++){const at=pc*8,name=I.names[code[at]],owner=pcOwner[pc];for(const[field,width]of operands(name)){const slot=code[at+field];if(slot+width>wordOwner.length)bad('Operand span outside source locals');for(let j=0;j<width;j++){const target=wordOwner[slot+j];if(target!=='$pinned'&&target!==owner&&authorized.get(pc+':'+field)!==target)bad('Unexplained foreign local reference at '+pc+':'+field);}}}
 const addresses=new Map();for(const r of m.addressConstants){const at=r.pc*8,owner=wordOwner[r.slot];if(!Number.isInteger(r.pc)||r.pc<0||r.pc>=count||code[at]!==I.opcodes.SET||code[at+2]!==r.slot||!owner||owner!=='$pinned'&&owner!==pcOwner[r.pc]||addresses.has(r.pc))bad('Invalid compiler-marked local address');addresses.set(r.pc,r.slot);}
 // Acyclic call graph, with every possible ancestor protected. Orphan helper
 // stubs retain a frame too; no code reachability pruning happens here.
 const colors=new Map(),topology=[];function visit(name){if(colors.get(name)===1)bad('Recursive CALL graph');if(colors.get(name)===2)return;colors.set(name,1);for(const child of owners.get(name).callees)visit(child);colors.set(name,2);topology.push(name);}for(const name of owners.keys())visit(name);topology.reverse();
 const pinned=owners.get('$pinned').words;for(const [name,o]of owners)if(name!=='$pinned')o.base=pinned;
 for(const name of topology){const o=owners.get(name);for(const child of o.callees){const target=owners.get(child);target.base=Math.max(target.base,o.base+o.words);}}
 const localWords=Math.max(...[...owners.values()].map(o=>o.base+o.words)),map=new Uint32Array(compiled.localWords);
 for(const o of owners.values())for(const a of o.allocations)for(let i=0;i<a.words;i++)map[a.slot+i]=o.base+a.offset+i;
 const relocated=code.slice();for(let pc=0;pc<count;pc++){const at=pc*8,name=I.names[code[at]];for(const[field,width]of operands(name)){const slot=code[at+field];for(let i=1;i<width;i++)if(map[slot+i]!==map[slot]+i)bad('Split intrinsic/aggregate operand span');relocated[at+field]=map[slot];}if(addresses.has(pc))relocated[at+2]=map[addresses.get(pc)];}
 const {allocationMetadata:discard,...rest}=compiled;
 return Object.freeze({...rest,instructions:relocated,words:relocated,localWords,externalFunctions:Object.freeze((compiled.externalFunctions??[]).map(f=>Object.freeze({...f,params:Object.freeze(f.params.map(p=>Object.freeze({...p,slot:map[p.slot],offset:map[p.slot]}))),returnSlot:f.returnWords?map[f.returnSlot]:0}))),functions:Object.freeze(compiled.functions.map(f=>Object.freeze({...f,params:Object.freeze(f.params.map(p=>Object.freeze({...p,slot:map[p.slot],offset:map[p.slot]}))),returnSlot:f.returnWords?map[f.returnSlot]:0}))),globals:Object.freeze(compiled.globals.map(g=>Object.freeze(g.storage?g:{...g,slot:map[g.slot]}))),allocation:Object.freeze({mode,pinnedWords:pinned,beforeWords:compiled.localWords,afterWords:localWords,sourceBytecodeSha256:m.bytecodeSha256,bytecodeSha256:hash(relocated),sourceInstructionsUnchanged:true,oldToNew:map,addressConstantCount:addresses.size,frames:Object.freeze([...owners.values()].map(o=>Object.freeze({name:o.name,base:o.base,words:o.words,callees:Object.freeze([...o.callees])}))),nativeQualified:false})});
}
