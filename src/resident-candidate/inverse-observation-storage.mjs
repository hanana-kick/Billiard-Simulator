// Opt-in SOURCE composition only. Two disjoint logical binding-5 views share
// one physical eighth binding. No physics buffer enlargement, native execution,
// future-state input, or change to observation-only v2/default admission.
import {isOwnedUint32Array} from './abi.mjs';
import {createHash} from './source-sha256.mjs';
import {tokenizeMicrocodeWGSL} from './microcode-parser.mjs';
import {linkResidentWGSL} from './wgsl-linker.mjs';
import {compileWorldDevicePc} from './world-device-pc.mjs';
import {compileWorldSourceOwners} from './world-owners.mjs';
import {composeWorldMicrocodeSource} from './world-microcode-source.mjs';
import {composeTipImpactMicrocodeCheckpoints} from './tip-impact-microcode-checkpoints.mjs';
import {generateWorldApplicationWGSL} from './world-application.mjs';
import {assertInverseWorldObservationPlan,generateInverseWorldObservationWGSL} from './inverse-world-observation.mjs';
const need=(v,m)=>{if(!v)throw new RangeError('Inverse audit observation storage: '+m);},U=0xffffffff,sha=s=>createHash('sha256').update(s).digest('hex'),owned=new WeakSet(),compositions=new WeakMap();
export const INVERSE_AUDIT_OBSERVATION_PROFILE='source-four-ball-inverse-audited-storage-v1';
export const INVERSE_AUDIT_OBSERVATION_CAPABILITY=Object.freeze({sourceOnly:true,originalPhysicsViewsUnchanged:true,fullAuditViewPreserved:true,diagnosticSnapshotsIncluded:true,checkedFinalAddress:true,nativeQualified:false,fullRestQualified:false,rawAdmissionQualified:false,solverAdapterImplemented:false,defaultEnabled:false});
const uint=(n,label)=>{need(Number.isSafeInteger(n)&&n>=0&&n<=U,label+' bounded u32');return n;};
const norm=s=>tokenizeMicrocodeWGSL(s).filter(t=>t.kind!=='eof').map(t=>t.text).join(' ');
function edit(code,edits){let at=0,result='';const proof=[];for(const e of edits.sort((a,b)=>a.start-b.start||a.end-b.end)){need(e.start>=at&&e.end>=e.start&&e.end<=code.length,'nonoverlapping exact source edits');result+=code.slice(at,e.start);const mappedStart=result.length;result+=e.after;proof.push(Object.freeze({...e,before:code.slice(e.start,e.end),mappedStart,mappedEnd:result.length}));at=e.end;}result+=code.slice(at);return Object.freeze({code:result,edits:Object.freeze(proof)});}
export function restoreInverseLogicalViewSource(code,edits){let at=0,result='';for(const e of edits){need(e.mappedStart>=at&&code.slice(e.mappedStart,e.mappedEnd)===e.after,'reversible source edit mismatch');result+=code.slice(at,e.mappedStart)+e.before;at=e.mappedEnd;}return result+code.slice(at);}
/** Every index expression executes once, in its original source order. The
 * helper result is the FINAL physical index; never add an offset to a sentinel.
 * Only this single documented global is mapped. All other bytes are untouched.
 * Mapping is for scalar VM lowering; out-of-view is VM storageRange/unsupported,
 * never a silently adjacent access or an ordinary physical miss. */
export function mapInverseLogicalViewSource({code,view}={}){
 need(typeof code==='string'&&code.length>0,'source text');need(view&&['audit','observer'].includes(view.name),'explicit logical view name');uint(view.offset,'logical offset');uint(view.words,'logical length');uint(view.totalWords,'physical length');need(view.words>0&&view.totalWords<U&&view.offset+view.words<=view.totalWords,'bounded disjoint physical view');
 const declaration=/@group\(0\)\s*@binding\(5\)\s*var<storage,\s*read_write>\s*rc_event_audit\s*:\s*array<u32>\s*;/g,found=[...code.matchAll(declaration)];need(found.length===1,'one exact existing read/write source binding5');const decl=found[0],tokens=tokenizeMicrocodeWGSL(code),changes=[],helper='rc_inverse_'+view.name+'_address',lengthUses=[],indexUses=[];
 need(!tokens.some(t=>t.text===helper),'logical address helper collision');
 for(let i=0;i<tokens.length;i++){const t=tokens[i];if(t.at>=decl.index&&t.at<decl.index+decl[0].length)continue;
  if(t.text==='arrayLength'&&tokens[i+1]?.text==='('&&tokens[i+2]?.text==='&'&&tokens[i+3]?.text==='rc_event_audit'&&tokens[i+4]?.text===')'){changes.push({start:t.at,end:tokens[i+4].at+1,after:view.words+'u',kind:'logical-view-length'});lengthUses.push(t.at);i+=4;continue;}
  if(t.text!=='rc_event_audit')continue;need(tokens[i+1]?.text==='[','only direct indexed storage and arrayLength permitted; no escaping alias');let end=i+2,depth=1;for(;end<tokens.length&&depth;end++){if(tokens[end].text==='[')depth++;else if(tokens[end].text===']')depth--;}need(depth===0,'balanced original index expression');const close=tokens[end-1];changes.push({start:t.at,end:tokens[i+1].at+1,after:`rc_event_audit[${helper}(`,kind:'final-checked-address-open'},{start:close.at,end:close.at+1,after:')]',kind:'final-checked-address-close'});indexUses.push(t.at);
 }
 const mapped=edit(code,changes);need(restoreInverseLogicalViewSource(mapped.code,mapped.edits)===code,'every original source byte is recoverable');
 const helperCode=`fn ${helper}(index:u32)->u32{if(index>=${view.words}u){return 0xffffffffu;}return ${view.offset}u+index;}`;
 return Object.freeze({...mapped,helperCode,view:Object.freeze({...view}),sourceSha256:sha(code),mappedSha256:sha(mapped.code),lengthUses:Object.freeze(lengthUses),indexUses:Object.freeze(indexUses)});
}
export function planInverseAuditObservationStorage({observer,count,auditViewWords,limits}={}){
 const p=assertInverseWorldObservationPlan(observer);uint(count,'candidate count');need(count>0&&count<=4096,'declared count, not qualified capacity');uint(auditViewWords,'complete audit/checkpoint view');need(auditViewWords>0,'positive complete audit view');const observerBase=Math.ceil(auditViewWords/64)*64,observerWords=uint(count*p.observerWords,'all observer words'),totalWords=uint(observerBase+observerWords,'whole physical slab');need(totalWords<U,'sentinel outside physical binding');
 need(limits&&Number.isSafeInteger(limits.maxStorageBufferBindingSize)&&limits.maxStorageBufferBindingSize>0&&Number.isSafeInteger(limits.maxBufferSize)&&limits.maxBufferSize>0&&Number.isSafeInteger(limits.maxStorageBuffersPerShaderStage)&&limits.maxStorageBuffersPerShaderStage>=8,'explicit actual/planned eighth-binding limits');const bytes=totalWords*4;need(Number.isSafeInteger(bytes)&&bytes<=limits.maxStorageBufferBindingSize&&bytes<=limits.maxBufferSize,'complete qualification slab exceeds admitted binding/buffer; never truncate');
 const layout=Object.freeze({kind:INVERSE_AUDIT_OBSERVATION_PROFILE,count,auditViewWords,observerBase,observerStride:p.observerWords,observerWords,paddingWords:observerBase-auditViewWords,totalWords,bytes,sourceBinding:5,gpuBinding:7,physicalBindings:8,qualificationAllocationOnly:true,compactProductionBudget:false,measured:false,limits:Object.freeze({...limits})});owned.add(layout);return layout;
}
function span(code,name){const tokens=tokenizeMicrocodeWGSL(code),at=tokens.findIndex((t,i)=>t.text==='fn'&&tokens[i+1]?.text===name);need(at>=0,'exact original function '+name);let i=at+2;for(;i<tokens.length&&tokens[i].text!=='{';i++);need(i<tokens.length,'function body '+name);let end=i+1,depth=1;for(;end<tokens.length&&depth;end++){if(tokens[end].text==='{')depth++;else if(tokens[end].text==='}')depth--;}need(depth===0,'balanced original function '+name);return {start:tokens[at].at,end:tokens[end-1].at+1,nameStart:tokens[at+1].at,nameEnd:tokens[at+1].at+name.length,text:code.slice(tokens[at].at,tokens[end-1].at+1)};}
/** Build canonical audited owners/checkpoints FIRST, so their existing exact
 * helper/source admission is not bypassed. Only then map their complete view
 * and attach observation at the original application entry boundaries. */
export function composeInverseAuditObservationSource({observer,pc,template,auditPlan,diagnostics='emission-only',limits}={}){
 const p=assertInverseWorldObservationPlan(observer);need(pc?.kind==='resident-world-device-owners'&&pc.bindingTypes?.length===6&&pc.bindingTypes[5]==='storage','original audited six-source-binding PC');need(template?.state?.length===p.stateWords&&pc.stateWords===p.stateWords&&template.sourceIdentity===p.sourceIdentity,'matching original physical owner');need(auditPlan?.kind==='resident-source-world-h-plan'&&auditPlan.count===pc.count&&auditPlan.stateWords===pc.stateWords&&auditPlan.bindingTypes.length===6&&auditPlan.audit?.kind==='test-only-device-emission-audit','original audited source plan');need(!auditPlan.inverseObservation,'never compose an already-observed source');
 const audit=auditPlan.audit;need(Number.isInteger(audit.capacityPerCandidate)&&audit.capacityPerCandidate>0&&audit.strideWords===4+audit.capacityPerCandidate*16&&audit.words===pc.count*audit.strideWords,'complete original static event cap');need(['emission-only','tip-impact-128-192'].includes(diagnostics),'explicit diagnostics profile');
 need(pc.controlVisitPolicy==='single-call'&&pc.controlPartition==='source-closures-v1','explicit unchanged source owner profile');
 const rebuiltPhase=compileWorldDevicePc(auditPlan,{programBase:pc.programBase,controlTailBase:pc.controlTailBase,maxH:pc.maxH,maxLoopDepth:pc.maxLoopDepth}),rebuilt=compileWorldSourceOwners(template,auditPlan,rebuiltPhase,{controlVisitPolicy:pc.controlVisitPolicy,controlPartition:pc.controlPartition});
 need(pc.begin.code===rebuilt.begin.code&&pc.bytecode.length===rebuilt.bytecode.length&&pc.bytecode.every((v,i)=>v===rebuilt.bytecode[i])&&pc.totalStateWords===rebuilt.totalStateWords&&pc.pipelines.length===rebuilt.pipelines.length&&pc.pipelines.every((row,i)=>row.code===rebuilt.pipelines[i].code),'exact original audited source plan/owner/PC agreement');
 const canonical=diagnostics==='emission-only'?composeWorldMicrocodeSource(pc):composeTipImpactMicrocodeCheckpoints(pc,template,{auditCapacityPerCandidate:audit.capacityPerCandidate,limits});
 const auditViewWords=canonical.checkpointLayout?.totalWords??audit.words,layout=planInverseAuditObservationStorage({observer:p,count:pc.count,auditViewWords,limits}),known=generateWorldApplicationWGSL(template),renames=[];
 for(const name of ['rc_world_application_begin_outer','rc_world_application_begin_post_h']){const actual=span(canonical.code,name),expected=span(known,name);need(norm(actual.text)===norm(expected.text),'unchanged source application signature/body '+name);const replacement='rc_inverse_original_'+name;need(!canonical.code.includes(replacement),'fresh application hook');renames.push({start:actual.nameStart,end:actual.nameEnd,after:replacement,kind:'original-declaration-name-only'});}
 const hookSource=edit(canonical.code,renames);need(restoreInverseLogicalViewSource(hookSource.code,hookSource.edits)===canonical.code,'original full audit/checkpoint source recovery');
 const auditMapped=mapInverseLogicalViewSource({code:hookSource.code,view:{name:'audit',offset:0,words:layout.auditViewWords,totalWords:layout.totalWords}});
 const observerLibrary=generateInverseWorldObservationWGSL(p,{entry:'library',count:pc.count});
 // These five pointer/position parameters are the only observer private words.
 // Every original point-stage entry overwrites ALL of them before any helper or
 // guard reads one; no newly appended global needs a mid-program/budget reset.
 const privateFields=[['rc_io_point_scratch','u32','scratch'],['rc_io_point_output','u32','output'],['rc_io_point_hull','u32','hull'],['rc_io_point_position','vec3<f32>','position'],['rc_io_point_solid','u32','solid']],privateDeclarations=[...observerLibrary.matchAll(/var<private>\s+(\w+)\s*:\s*([^;]+);/g)];
 need(privateDeclarations.length===privateFields.length&&privateFields.every(([name,type])=>privateDeclarations.some(m=>m[1]===name&&norm(m[2])===norm(type))&&!canonical.code.includes(name)),'exact disjoint observer private declarations');
 const assignments=privateFields.map(([name,,value])=>name+'='+value+';').join('');for(const stage of ['init','gjk','epa','finish']){const text=span(observerLibrary,'rc_io_query_'+stage).text,body=text.slice(text.indexOf('{')+1);need(norm(body).startsWith(norm(assignments)),'point private parameters written before any read '+stage);}
 const wrappers=`
fn rc_world_application_begin_outer(bank:u32)->bool{
 let scratch=(bank/${p.stateWords}u)*${p.scratchWords}u;let ob=(bank/${p.stateWords}u)*${p.observerWords}u;
 if(rc_event_audit[ob+${p.segments.inverseControl.offset}u]==0u){if(!rc_inverse_world_observe(bank,scratch,true)){rc_state[bank+2u]=4u;rc_state[bank+3u]=6u;return false;}}
 return rc_inverse_original_rc_world_application_begin_outer(bank);
}
fn rc_world_application_begin_post_h(bank:u32)->bool{
 let scratch=(bank/${p.stateWords}u)*${p.scratchWords}u;
 if(!rc_inverse_world_observe(bank,scratch,false)){rc_state[bank+2u]=4u;rc_state[bank+3u]=6u;return false;}
 return rc_inverse_original_rc_world_application_begin_post_h(bank);
}
`;
 const observerMapped=mapInverseLogicalViewSource({code:observerLibrary+'\n'+wrappers,view:{name:'observer',offset:layout.observerBase,words:layout.observerWords,totalWords:layout.totalWords}}),linked=linkResidentWGSL([auditMapped.code,auditMapped.helperCode,observerMapped.code,observerMapped.helperCode],{entry:canonical.entry});
 const composed=Object.freeze({kind:INVERSE_AUDIT_OBSERVATION_PROFILE,entry:canonical.entry,code:linked.code,functions:linked.functions,layout,canonicalSource:canonical,hookSource,auditMapped,observerMapped,sourceBytecode:canonical.sourceBytecode,sourceIdentity:p.sourceIdentity,checkpointLayout:canonical.checkpointLayout??null,observerPrivateState:Object.freeze({fields:Object.freeze(privateFields.map(x=>x[0])),overwriteBeforeEveryPointStageRead:true,resetOnVmYield:false}),originalPhysicalViews:Object.freeze({stateWords:pc.totalStateWords,programWords:pc.programBase+pc.bytecode.length,geometryWords:template.sharedGeometry.length,scratchWords:pc.count*p.scratchWords,inputsWords:pc.count*16}),capability:INVERSE_AUDIT_OBSERVATION_CAPABILITY});compositions.set(composed,p);return composed;
}
/** Identity admission for separate kernels sharing this exact physical slab. */
export function assertInverseAuditObservationComposition(composition,{observer}={}){const p=assertInverseWorldObservationPlan(observer);need(compositions.get(composition)===p&&owned.has(composition?.layout),'same-realm admitted audit/observer composition and exact observer');return composition;}
/** Transport only, not proof of source truth. The ORIGINAL audit and inverse
 * decoders must each receive their exact complete logical view for assertion. */
export function splitInverseAuditObservationStorage(layout,words){need(owned.has(layout),'locally admitted layout');need(isOwnedUint32Array(words)&&words.length===layout.totalWords,'complete detached final physical slab');return Object.freeze({audit:words.slice(0,layout.auditViewWords),padding:words.slice(layout.auditViewWords,layout.observerBase),observer:words.slice(layout.observerBase)});}
