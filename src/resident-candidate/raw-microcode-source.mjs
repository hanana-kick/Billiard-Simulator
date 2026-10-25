/* SPDX-License-Identifier: Apache-2.0
 * HOST-ONLY exact initializer source composition. This is source for scalar
 * microcode lowering, NOT a giant native shader, numeric proof or CPU fallback.
 * All original logical buffer views survive physical slab concatenation.
 */
import {createHash} from 'node:crypto';
import {tokenizeMicrocodeWGSL} from './microcode-parser.mjs';
import {linkResidentWGSL} from './wgsl-linker.mjs';
import {MICROCODE_ISA} from './microcode-isa.mjs';
const need=(ok,message)=>{if(!ok)throw new TypeError('Raw microcode source: '+message);};
const uint=(n,label)=>{need(Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff,label+' must be u32');return n;};
const hash=x=>createHash('sha256').update(typeof x==='string'?x:new Uint8Array(x.buffer,x.byteOffset,x.byteLength)).digest('hex');
const names=Object.keys(MICROCODE_ISA.bindings);
const headers=names.map((n,i)=>`@group(0) @binding(${i}) var<storage,${i===0||i===3?'read_write':'read'}> ${n}:array<u32>;`).join('\n');
const adapters=new Set(['rc_raw_contact_stage','rc_raw_cast_stage','rc_project_convex_stage','rc_world_creation_stage']);
function applyEdits(source,edits){
 edits.sort((a,b)=>a.start-b.start||a.end-b.end);let at=0,out='';const proof=[];
 for(const e of edits){need(e.start>=at&&e.end>=e.start,'overlapping source transport edit');out+=source.slice(at,e.start);const mappedStart=out.length;out+=e.after;proof.push(Object.freeze({...e,before:source.slice(e.start,e.end),mappedStart,mappedEnd:out.length}));at=e.end;}
 out+=source.slice(at);return{code:out,edits:Object.freeze(proof)};
}
/** Reversible proof utility: every original byte, including arithmetic, loop
 * caps, guards, and comments, is recovered after undoing declared transport. */
export function restoreRawMicrocodeStageSource(code,edits){
 let at=0,out='';for(const e of edits){need(e.mappedStart>=at&&code.slice(e.mappedStart,e.mappedEnd)===e.after,'mapped source proof mismatch');out+=code.slice(at,e.mappedStart)+e.before;at=e.mappedEnd;}return out+code.slice(at);
}
function mapStage(source,views,entry,index){
 const edits=[],declarations=[];
 const binding=/@group\(0\)\s*@binding\((\d+)\)\s*var<storage,(read|read_write)>\s+(\w+):array<u32>;/g;
 for(const m of source.matchAll(binding)){
  const view=views[Number(m[1])];need(view,'unknown source binding');need((m[2]==='read_write')===view.writable,'source access changed for '+view.resource);
  declarations.push({start:m.index,end:m.index+m[0].length,name:m[3],view});edits.push({start:m.index,end:m.index+m[0].length,after:'',kind:'binding-remap'});
 }
 need(declarations.length===views.length,'exact documented binding declarations required');
 const byName=new Map(declarations.map(d=>[d.name,d.view]));need(byName.size===declarations.length,'unique source binding names');
 const signature=/@compute\s+@workgroup_size\((1|32)\)\s+fn main\(@builtin\(global_invocation_id\) gid:vec3<u32>\)/g;
 const matches=[...source.matchAll(signature)];need(matches.length===1,'one exact original single-gid compute entry required');const root=matches[0];
 edits.push({start:root.index,end:root.index+root[0].length,after:`fn ${entry}(gid:vec3<u32>)`,kind:'logical-invocation-entry'});
 const tokens=tokenizeMicrocodeWGSL(source),lengths=[],mappedAccesses=[];
 const covered=at=>declarations.some(d=>at>=d.start&&at<d.end)||at>=root.index&&at<root.index+root[0].length;
 for(let i=0;i<tokens.length;i++){
  const t=tokens[i];if(covered(t.at))continue;
  if(t.text==='arrayLength'&&tokens[i+1]?.text==='('&&tokens[i+2]?.text==='&'&&byName.has(tokens[i+3]?.text)&&tokens[i+4]?.text===')'){
   const view=byName.get(tokens[i+3].text);edits.push({start:t.at,end:tokens[i+4].at+1,after:view.words+'u',kind:'logical-view-length'});lengths.push(tokens[i+3].text);i+=4;continue;
  }
  if(byName.has(t.text)){
   const view=byName.get(t.text);need(tokens[i+1]?.text==='[','only direct indexed logical storage or arrayLength admitted: '+t.text);
   let end=i+2,depth=1;for(;end<tokens.length&&depth;end++){if(tokens[end].text==='[')depth++;else if(tokens[end].text===']')depth--;}
   need(depth===0,'balanced source storage index');const close=tokens[end-1];
   // Preserve the logical view before physical concatenation. Out-of-view
   // accesses become an explicit VM storage-range failure, never an adjacent
   // resource read or an ordinary rejected/miss result.
   edits.push({start:t.at,end:tokens[i+1].at+1,after:`${view.target}[rc_micro_raw_address_${view.resource}(`,kind:'checked-logical-view-address'});
   edits.push({start:close.at,end:close.at+1,after:')]',kind:'checked-logical-view-address'});
   mappedAccesses.push(t.text);continue;
  }
  if(adapters.has(t.text))edits.push({start:t.at,end:t.at+t.text.length,after:t.text+'_raw_micro_'+index,kind:'phase-adapter-name'});
 }
 const mapped=applyEdits(source,edits);need(restoreRawMicrocodeStageSource(mapped.code,mapped.edits)===source,'exact reversible source proof');
 return{...mapped,logicalLengthNames:Object.freeze([...new Set(lengths)]),mappedAccessNames:Object.freeze([...new Set(mappedAccesses)])};
}
/** TEST ONLY transport probe; never an alternate source initializer. */
export function mapRawMicrocodeStageForTest({source,views,entry='rc_micro_raw_probe',testOnly=false}){
 need(testOnly===true,'source transport probe is TEST ONLY');
 return mapStage(source,views,entry,0);
}
function privateDeclarations(code){
 const masked=code.replace(/\/\*[\s\S]*?\*\//g,x=>x.replace(/[^\n]/g,' ')).replace(/\/\/[^\n]*/g,x=>' '.repeat(x.length));
 return [...masked.matchAll(/\bvar\s*<\s*private\s*>\s+(\w+)\s*:\s*([^;]+);/g)].map(m=>{const text=m[2].trim(),at=text.indexOf('='),type=(at<0?text:text.slice(0,at)).trim();return Object.freeze({name:m[1],type,initial:at<0?type+'()':text.slice(at+1).trim()});});
}
const append=(prefix,parts)=>{let words=prefix.length;for(const p of parts)words=uint(words+p.length,'combined immutable words');const out=new Uint32Array(words);out.set(prefix);let at=prefix.length;for(const p of parts){out.set(p,at);at+=p.length;}return out;};

/** Consumes the same initial-only serialized plan used by the accepted staged
 * gate. Raw state begins AFTER every existing world/PC/request tail. Immutable
 * source programs/geometry/templates are appended, never uploaded as future
 * state. Shared scratch is allowed only for identical per-candidate strides;
 * a candidate cannot overlap another candidate still initializing.
 *
 * Only source-f64-v1 is currently compatible with this mapping. Numeric helper
 * arrayLength guards are specialized to their EXACT pre-concatenation views;
 * their bodies therefore intentionally fail existing numeric intrinsic hash
 * approval. Do not use name-only approval to hide this necessary distinction.
 */
export function composeRawMicrocodeSource(runtime){
 need(runtime?.kind==='resident-raw-pc-initial-only-runtime-v1','original initial-only runtime required');
 const {init,pc,count}=runtime;uint(count,'candidate count');need(count>0&&count<=4096,'bounded nonzero rows');
 need(pc.count===count&&runtime.input instanceof Uint32Array&&runtime.input.length===count*16,'raw row identity');
 need(runtime.program instanceof Uint32Array&&runtime.sharedGeometry instanceof Uint32Array,'original immutable source words');
 need(init.hostReadbacksBeforeH===0&&init.numericalGpuExecuted!==true,'initial-only initializer descriptors');
 const r=init.resources;for(const name of ['rawProgram','rawGeometry','worldTemplate','worldProgram'])need(r[name] instanceof Uint32Array,name+' original immutable words');
 for(const name of ['rawState','rawScratch','numericScratch','worldState','inputs'])uint(r[name],name);
 need(r.inputs===runtime.input.length&&r.rawScratch===r.numericScratch&&r.rawScratch===init.scratchAlias.words&&r.rawScratch%count===0,'identical raw/world scratch stride required per row');
 need(pc.controlTailBase===r.worldState&&pc.controlWords===80&&pc.requestWordsPerCandidate===24&&pc.requestTailBase===pc.controlTailBase+count*pc.controlWords&&pc.totalStateWords===pc.requestTailBase+count*24,'all original PC/request tails must precede raw state');
 need(r.rawState>0&&r.rawScratch>0&&r.worldState>0&&r.rawState%count===0,'positive candidate raw/scratch/world stride');
 need(runtime.program.length>=r.worldProgram.length&&r.worldProgram.every((word,i)=>word===runtime.program[i]),'unchanged original world program prefix');
 const rawStateBase=uint(pc.totalStateWords,'raw state offset'),rawProgramBase=runtime.program.length,rawGeometryBase=runtime.sharedGeometry.length,templateBase=rawGeometryBase+r.rawGeometry.length;
 const stageNames=Object.keys(init.stages),id=new Map(stageNames.map((name,i)=>[name,i]));need(stageNames.length>0&&id.has('world-transfer')&&id.has('creation-finish'),'complete original initialization stages');
 const schedule=new Uint32Array(init.commands.length*2);let calls=0;
 for(const [i,c]of init.commands.entries()){need(id.has(c.stage)&&Number.isSafeInteger(c.repeat)&&c.repeat>0&&c.repeat<=0xffffffff,'original bounded stage schedule');schedule[i*2]=id.get(c.stage);schedule[i*2+1]=c.repeat;calls+=c.repeat;}
 need(calls===init.dispatches&&init.commands.at(-1).stage==='creation-finish','complete unchanged original invocation schedule');
 const scheduleBase=uint(rawProgramBase+r.rawProgram.length,'schedule offset');
 const layout=Object.freeze({count,worldStateWords:pc.totalStateWords,rawStateBase,rawStateWords:r.rawState,stateWords:uint(rawStateBase+r.rawState,'state words'),worldProgramWords:runtime.program.length,rawProgramBase,rawProgramWords:r.rawProgram.length,scheduleBase,scheduleWords:schedule.length,worldGeometryWords:runtime.sharedGeometry.length,rawGeometryBase,rawGeometryWords:r.rawGeometry.length,templateBase,templateWords:r.worldTemplate.length,scratchWords:r.rawScratch,scratchStride:r.rawScratch/count,rawStateStride:r.rawState/count});
 const resources={
  inputs:{target:'rc_inputs',offset:0,words:runtime.input.length,writable:false},
  rawState:{target:'rc_state',offset:rawStateBase,words:r.rawState,writable:true},
  rawProgram:{target:'rc_program',offset:rawProgramBase,words:r.rawProgram.length,writable:false},
  rawGeometry:{target:'rc_geometry',offset:rawGeometryBase,words:r.rawGeometry.length,writable:false},
  rawScratch:{target:'rc_scratch',offset:0,words:r.rawScratch,writable:true},
  worldState:{target:'rc_state',offset:0,words:pc.totalStateWords,writable:true},
  worldProgram:{target:'rc_program',offset:0,words:runtime.program.length,writable:false},
  numericScratch:{target:'rc_scratch',offset:0,words:r.numericScratch,writable:true},
  worldTemplate:{target:'rc_geometry',offset:templateBase,words:r.worldTemplate.length,writable:false},
 };
 const viewHelpers=Object.entries(resources).map(([name,v])=>`fn rc_micro_raw_address_${name}(index:u32)->u32{if(index>=${v.words}u){return 0xffffffffu;}return ${v.offset}u+index;}`).join('\n');
 const pieces=[],entries=[];
 for(const [index,name]of stageNames.entries()){
  const source=init.stages[name];need(typeof source.code==='string'&&source.resources.length===source.bindingTypes.length,'original stage bindings');
  const views=source.resources.map((resource,binding)=>{need(resources[resource],'documented original resource '+resource);const view={...resources[resource],resource};view.writable=source.bindingTypes[binding]==='storage';need(!view.writable||resources[resource].writable,'immutable template/program cannot become writable');return Object.freeze(view);});
  const entry='rc_micro_raw_original_'+index,mapped=mapStage(source.code,views,entry,index);
  pieces.push(mapped.code);entries.push(Object.freeze({index,name,entry,views:Object.freeze(views),sourceCode:source.code,sourceSha256:hash(source.code),mappedCode:mapped.code,mappedSha256:hash(mapped.code),edits:mapped.edits,logicalLengthNames:mapped.logicalLengthNames,mappedAccessNames:mapped.mappedAccessNames}));
 }
 const retain='fn rc_micro_raw_retain(gid:vec3<u32>){'+entries.map(x=>x.entry+'(gid);').join('')+'}';
 const all=linkResidentWGSL([headers,viewHelpers,...pieces,retain],{entry:'rc_micro_raw_retain'}),globals=privateDeclarations(all.code);
 need(new Set(globals.map(x=>x.name)).size===globals.length,'unique source private globals');
 const reset='fn rc_micro_raw_reset_private(){'+globals.map(x=>x.name+'='+x.initial+';').join('')+'}';
 const entry='rc_micro_raw_initialize';
 const driver=`fn ${entry}(gid:vec3<u32>){if(gid.x>=${count}u){return;}for(var command=0u;command<${init.commands.length}u;command++){let at=${scheduleBase}u+command*2u;let stage=rc_program[at];let repetitions=rc_program[at+1u];for(var invocation=0u;invocation<repetitions;invocation++){rc_micro_raw_reset_private();switch stage{${entries.map(x=>'case '+x.index+'u:{'+x.entry+'(gid);}').join('')}default:{return;}}}}}`;
 const linked=linkResidentWGSL([headers,viewHelpers,...pieces,reset,driver],{entry});
 const state=new Uint32Array(layout.stateWords);
 for(const upload of init.initialUploads){need(upload.resource==='worldState'&&upload.data instanceof Uint32Array&&upload.offsetWords===count*pc.stateWords&&upload.offsetWords+upload.data.length===r.worldState,'only original immutable fixed CCD tail upload');state.set(upload.data,upload.offsetWords);}
 need(init.initialUploads.length===1,'one original fixed CCD upload');
 const bindings=[state,append(runtime.program,[r.rawProgram,schedule]),append(runtime.sharedGeometry,[r.rawGeometry,r.worldTemplate]),new Uint32Array(layout.scratchWords),runtime.input.slice()];
 const worldBindingViews=Object.freeze([pc.totalStateWords,runtime.program.length,runtime.sharedGeometry.length,layout.scratchWords,runtime.input.length].map((words,binding)=>Object.freeze({binding,offsetBytes:0,sizeBytes:words*4})));
 return Object.freeze({kind:'resident-raw-microcode-source-v1',entry,code:linked.code,functions:linked.functions,count,layout,bindings:Object.freeze(bindings),worldBindingViews,entries:Object.freeze(entries),privateGlobals:Object.freeze(globals),schedule,originalInvocations:calls,sourceIdentity:runtime.identity?.sourceIdentity??null,preStrikeIdentity:runtime.identity?.preStrikeIdentity??null,
  intrinsicProfile:'source-f64-v1',intrinsicGaps:Object.freeze(['rc_num_eval has exact logical-view length specialization; existing numeric intrinsic approval must reject it','raw source-program helpers use relocated raw state/program views; source-continuation intrinsic is not admitted']),
  capability:Object.freeze({interpretedOnly:true,worldPcBegun:false,sourceArithmeticUnchanged:true,sourceCapsUnchanged:true,logicalViewsPreserved:true,logicalViewAddress:'final physical address; no offset after sentinel',outOfViewAccess:'VM invalid/storageRange; caller must report unsupported, never ordinary miss',requiresCompleteVmBeforeWorld:true,sourceDispatchOrderPerCandidate:true,privateResetPerOriginalInvocation:true,hostStateReadback:false,hostForwardFallback:false,nativeQualified:false,fullRestQualified:false,hardwarePerformance:false,defaultBackend:false})});
}
