/* SPDX-License-Identifier: Apache-2.0
 * Experimental owner routing over the ORIGINAL device-PC bytecode. Explicit
 * owner metadata only. A heavy visit completes at most one original CALL.
 * Light control emits a straight-line list of static original callsites; no
 * source helper is invoked from a loop or from the integer PC interpreter.
 */
import {linkResidentWGSL} from './wgsl-linker.mjs';
import {WORLD_DEVICE_PC} from './world-device-pc.mjs';
export const WORLD_DEVICE_OWNERS=Object.freeze({result:Object.freeze({wait:0,complete:1,invalid:2}),defaultRequestWords:24,capability:Object.freeze({optIn:true,defaultBackend:false,sourceCapsUnchanged:true,nativeQualified:false,fullRestQualified:false,hostStateReadback:false})});
const integer=(n,name)=>{if(!Number.isSafeInteger(n)||n<0||n>0xffffffff)throw new RangeError(name+' must be a bounded u32');return n;};
const mask=s=>s.replace(/\/\*[\s\S]*?\*\//g,x=>x.replace(/[^\n]/g,' ')).replace(/\/\/[^\n]*/g,x=>' '.repeat(x.length));
function declarations(code){
 const m=mask(code),result=[];let at=0;
 while(at<m.length){while(at<m.length&&/\s/.test(m[at]))at++;if(at===m.length)break;const start=at,re=/\b(fn|struct|alias|const|var|enable|requires|diagnostic)\b/g;re.lastIndex=at;const found=re.exec(m);if(!found)throw new SyntaxError('Unsupported owner source declaration');const kind=found[1];let end;
  if(kind==='fn'||kind==='struct'){const open=m.indexOf('{',re.lastIndex);let d=1;end=open+1;for(;d&&end<m.length;end++){if(m[end]==='{')d++;else if(m[end]==='}')d--;}if(d)throw new SyntaxError('Unclosed owner source function');if(m[end]===';')end++;}else{end=m.indexOf(';',re.lastIndex)+1;if(!end)throw new SyntaxError('Unclosed owner declaration');}
  const text=code.slice(start,end),name=kind==='fn'?/^\s+(\w+)/.exec(m.slice(re.lastIndex))?.[1]:null;result.push({kind,name,code:text});at=end;
 }
 return result;
}
const calls=s=>[...mask(s).matchAll(/\b(\w+)\s*\(/g)].map(m=>m[1]);
/** Only the two known phase adapter names and the original entry receive
 * per-pipeline names. All other source helpers remain byte-identical and the
 * linker rejects any conflict; never hide an unexpected owner disagreement. */
function sourceCalls(pc,ids,{light=false}={}){
 const pieces=[],roots=new Map(),allowed=new Set(['rc_pc_source_stage','rc_world_geometry_stage','rc_world_cue_geometry_stage']);
 for(const id of ids){const ds=declarations(pc.pipelines[id].code),fs=new Map(ds.filter(d=>d.kind==='fn').map(d=>[d.name,d.code]));pieces.push(...ds.filter(d=>d.kind!=='fn').map(d=>d.code));if(!fs.has('rc_pc_source_stage'))throw new TypeError('Exact phase-PC source entry required');const keep=new Set(),todo=['rc_pc_source_stage'];
  while(todo.length){const name=todo.pop();if(keep.has(name))continue;keep.add(name);for(const called of calls(fs.get(name)))if(called!==name&&fs.has(called))todo.push(called);}
  if(light&&[...keep].some(name=>['rc_num_eval','rc_source_program_step','rc_raw_program_step','rc_num_cont_instruction','rc_source_program_instruction'].includes(name)))throw new TypeError('Source-control group must not contain a reachable numerical VM');
  const rename=new Map([...keep].filter(x=>allowed.has(x)).map(x=>[x,x+'_owner_phase_'+id]));for(const name of keep)pieces.push(fs.get(name).replace(/\b(\w+)(?=\s*\()/g,x=>rename.get(x)??x));roots.set(id,rename.get('rc_pc_source_stage'));
 }
 return{pieces,roots};
}
function controller(pc){return declarations(pc.begin.code).filter(d=>d.kind!=='fn'||d.name!=='main').map(d=>d.code);}

/** owners: [{id,name,pipelineIds,heavy,sourceCode?,entry?}], explicit/disjoint/
 * exhaustive original pipeline IDs. Custom ENTRY has the fixed ABI:
 * (bank,scratch,request,originalPC,originalPipeline)->u32.
 * 0 WAIT: no CALL receipt or PC advancement; retain request/device state.
 * 1 COMPLETE: original prefix/helper/suffix (or original early/error return)
 * has completed; the router alone records one CALL and advances original PC.
 * 2 INVALID: fail the transport, never synthesize a physics MISS.
 * Optional light visitPolicy:'single-call' emits a source switch followed by
 * exactly ONE completion/advance callsite. Default light static-chain stays
 * unchanged; single-call changes scheduling only, not source caps or order.
 * Explicit singletonPassthrough:true admits exactly one non-custom phase and
 * reuses its phase-PC shader bytes verbatim (including all PC receipts).
 * Noncustom single-call receiptPolicy:'phase-direct' inlines the exact phase
 * receipt stores/advance after the switch. Custom WAIT/error receipts always
 * retain validation; omitted receiptPolicy preserves wrapped shader bytes.
 * A source error is still COMPLETE after its original error stores. sourceResult
 * and request.status are separate from these routing return codes.
 */
export function compileWorldDeviceOwners(pc,{owners,routes,requestTailBase=pc?.totalStateWords,requestWordsPerCandidate=WORLD_DEVICE_OWNERS.defaultRequestWords}={}){
 if(pc?.kind!=='resident-world-device-pc'||!Array.isArray(owners)||!owners.length)throw new TypeError('Exact phase-PC and explicit owners required');integer(requestTailBase,'requestTailBase');integer(requestWordsPerCandidate,'requestWordsPerCandidate');if(requestTailBase<pc.totalStateWords||requestWordsPerCandidate<24)throw new RangeError('Owned request tail must follow all PC control words and hold at least24 words');
 const totalStateWords=requestTailBase+requestWordsPerCandidate*pc.count;integer(totalStateWords,'totalStateWords');const route=new Array(pc.pipelines.length),ownerIds=new Set();
 const groups=owners.map(owner=>{integer(owner.id,'owner id');if(ownerIds.has(owner.id)||typeof owner.name!=='string'||!owner.name||typeof owner.heavy!=='boolean'||!Array.isArray(owner.pipelineIds)||!owner.pipelineIds.length)throw new TypeError('Unique named owner with explicit heavy flag and source IDs required');ownerIds.add(owner.id);const visitPolicy=owner.visitPolicy??(owner.heavy?'single-call':'static-chain');if(!['single-call','static-chain'].includes(visitPolicy)||(owner.heavy&&visitPolicy!=='single-call'))throw new TypeError('Explicit source owner visit policy is invalid');const ids=[...owner.pipelineIds].sort((a,b)=>a-b);for(const id of ids){integer(id,'original pipeline');if(id>=route.length||route[id]!==undefined)throw new RangeError('Owner routes must cover each original phase exactly once');route[id]=owner.id;}const custom=owner.sourceCode!==undefined||owner.entry!==undefined;if(custom&&(typeof owner.sourceCode!=='string'||!/^\w+$/.test(owner.entry??'')))throw new TypeError('Custom owner needs sourceCode and fixed entry identifier');if(owner.heavy&&ids.length>1&&!custom)throw new TypeError('Heavy multi-phase owner requires one explicit shared callsite adapter');const receiptPolicy=owner.receiptPolicy??'guarded';if(!['guarded','phase-direct'].includes(receiptPolicy)||(receiptPolicy==='phase-direct'&&(custom||visitPolicy!=='single-call')))throw new TypeError('Direct phase receipts require a noncustom single-call owner');const singletonPassthrough=owner.singletonPassthrough??false;if(typeof singletonPassthrough!=='boolean'||(singletonPassthrough&&(ids.length!==1||custom)))throw new TypeError('Phase passthrough requires exactly one original source ID and no custom adapter');return Object.freeze({...owner,visitPolicy,receiptPolicy,singletonPassthrough,pipelineIds:Object.freeze(ids),custom});});
 if(route.some(x=>x===undefined)||Object.keys(route).length!==route.length)throw new RangeError('Every original phase needs an explicit owner');if(routes&&(!Array.isArray(routes)||routes.length!==route.length||routes.some((x,i)=>x!==route[i])))throw new RangeError('Explicit route table disagrees with owner phase IDs');
 const support=controller(pc),common=`if(gid.x>=${pc.count}u){return;}let bank=gid.x*${pc.stateWords}u;let scratch=gid.x*${pc.scratchWords}u;let cb=${pc.controlTailBase}u+gid.x*${pc.controlWords}u;let request=${requestTailBase}u+gid.x*${requestWordsPerCandidate}u;if(rc_state[cb]!=${WORLD_DEVICE_PC.magic}u||rc_state[cb+1u]!=1u||rc_state[cb+4u]!=1u){return;}rc_state[cb+14u]++;`,helpers=`
fn rc_owner_matches(cb:u32,id:u32)->bool{if(rc_state[cb+4u]!=1u){return false;}let pc=rc_state[cb+2u];if(pc>=${pc.instructions}u){rc_pc_fail(cb,2u);return false;}let ip=${pc.programBase}u+pc*4u;return rc_program[ip]==1u&&rc_program[ip+1u]==id;}
fn rc_owner_complete(bank:u32,scratch:u32,cb:u32,originalPC:u32,id:u32,result:u32){
 if(result==0u){if(rc_state[bank+2u]!=1u){rc_pc_fail(cb,11u);}return;}
 if(result!=1u||rc_state[cb+4u]!=1u||rc_state[cb+2u]!=originalPC){rc_pc_fail(cb,11u);return;}
 rc_state[cb+8u]++;rc_state[cb+12u]=id;rc_state[cb+2u]=originalPC+1u;rc_pc_advance(bank,scratch,cb);
}
`;
 const pipelines=groups.map(owner=>{if(owner.singletonPassthrough){const original=pc.pipelines[owner.pipelineIds[0]];return Object.freeze({name:'device-owner-'+owner.name,ownerId:owner.id,pipelineIds:owner.pipelineIds,heavy:owner.heavy,visitPolicy:owner.visitPolicy,receiptPolicy:owner.receiptPolicy,custom:false,singletonPassthrough:true,sourcePipeline:owner.pipelineIds[0],code:original.code,functions:original.functions});}let pieces=[],body='';
  if(owner.custom){pieces.push(owner.sourceCode);if(owner.heavy||owner.visitPolicy==='single-call'){body=`let originalPC=rc_state[cb+2u];if(originalPC>=${pc.instructions}u){rc_pc_fail(cb,2u);return;}let ip=${pc.programBase}u+originalPC*4u;if(rc_program[ip]!=1u){return;}let id=rc_program[ip+1u];if(!(${owner.pipelineIds.map(id=>`id==${id}u`).join('||')})){return;}if(!rc_pc_guard(bank,scratch,id)){rc_pc_advance(bank,scratch,cb);return;}let result=${owner.entry}(bank,scratch,request,originalPC,id);rc_owner_complete(bank,scratch,cb,originalPC,id,result);`;}else{body=owner.pipelineIds.map(id=>`if(rc_owner_matches(cb,${id}u)){let originalPC=rc_state[cb+2u];if(!rc_pc_guard(bank,scratch,${id}u)){rc_pc_advance(bank,scratch,cb);}else{let result=${owner.entry}(bank,scratch,request,originalPC,${id}u);rc_owner_complete(bank,scratch,cb,originalPC,${id}u,result);if(result==0u){return;}}}`).join('\n');}}
  else{const original=sourceCalls(pc,owner.pipelineIds,{light:!owner.heavy});pieces=original.pieces;if((!owner.heavy&&owner.visitPolicy==='single-call')||owner.receiptPolicy==='phase-direct'){const receipt=owner.receiptPolicy==='phase-direct'?`rc_state[cb+8u]++;rc_state[cb+12u]=id;rc_state[cb+2u]=originalPC+1u;rc_pc_advance(bank,scratch,cb);`:'rc_owner_complete(bank,scratch,cb,originalPC,id,1u);';body=`let originalPC=rc_state[cb+2u];if(originalPC>=${pc.instructions}u){rc_pc_fail(cb,2u);return;}let ip=${pc.programBase}u+originalPC*4u;if(rc_program[ip]!=1u){return;}let id=rc_program[ip+1u];switch id{${owner.pipelineIds.map(id=>`case ${id}u:{${original.roots.get(id)}(gid);}`).join('')}default:{return;}}${receipt}`;}else{body=owner.pipelineIds.map(id=>`if(rc_owner_matches(cb,${id}u)){let originalPC=rc_state[cb+2u];${original.roots.get(id)}(gid);rc_owner_complete(bank,scratch,cb,originalPC,${id}u,1u);}`).join('\n');}}
  const linked=linkResidentWGSL([...support,...pieces,helpers,`@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){${common}${body}}`]);return Object.freeze({name:'device-owner-'+owner.name,ownerId:owner.id,pipelineIds:owner.pipelineIds,heavy:owner.heavy,visitPolicy:owner.visitPolicy,receiptPolicy:owner.receiptPolicy,custom:owner.custom,code:linked.code,functions:linked.functions});});
 return Object.freeze({...pc,kind:'resident-world-device-owners',capability:WORLD_DEVICE_OWNERS.capability,phasePc:pc,totalStateWords,requestTailBase,requestWordsPerCandidate,phasePipelineCount:pc.pipelines.length,phaseWorstCaseSweeps:pc.worstCaseSweeps,worstCaseSweeps:null,ownerIds:Object.freeze(groups.map(x=>x.id)),routes:Object.freeze(route),owners:Object.freeze(groups),pipelines:Object.freeze(pipelines),sweep:Object.freeze(pipelines.map((_,i)=>i)),begin:pc.begin});
}
/** Compatibility with the earlier three-argument contract; source plan must
 * be the same immutable phase catalog. No inferred owner partition. */
export function compileOwnerRouting(pc,plan,options){if(plan?.kind!=='resident-source-world-h-plan'||plan.pipelines.length!==pc?.pipelines.length||plan.stateWords!==pc.stateWords)throw new TypeError('Matching original whole-h plan required');return compileWorldDeviceOwners(pc,options);}
export function* worldDeviceOwnerCommands(compiled,{sweeps,includeBegin=true}={}){if(compiled?.kind!=='resident-world-device-owners')throw new TypeError('Compiled source owners required');integer(sweeps,'sweeps');if(includeBegin)yield-1;for(let i=0;i<sweeps;i++)yield* compiled.sweep;}

/** TEST ONLY ordering adapter over the independently tested phase-PC reference.
 * customReady models pending requests only; the original test source callback
 * is invoked exactly once on COMPLETE. It never supplies production physics. */
export function createWorldDeviceOwnersReferenceForTest(compiled,state,{testOnly=false,phase,customReady=()=>1}={}){
 if(!testOnly||compiled?.kind!=='resident-world-device-owners'||!(state instanceof Uint32Array)||!phase?.phase)throw new TypeError('Explicit test-only packed state and phase reference required');const pc=compiled.phasePc;
 return{begin:c=>phase.begin(c),visit(c,index){const owner=compiled.owners[index];if(!owner)throw new RangeError('Unknown owner');const cb=pc.controlTailBase+c*pc.controlWords;if(state[cb]!==WORLD_DEVICE_PC.magic||state[cb+1]!==1||state[cb+4]!==1)return;state[cb+14]++;const visits=state[cb+14],ids=owner.heavy||owner.visitPolicy==='single-call'?[pc.bytecode[state[cb+2]*4+1]]:owner.pipelineIds;for(const id of ids){if(state[cb+4]!==1)break;const originalPC=state[cb+2];if(pc.bytecode[originalPC*4]!==1||pc.bytecode[originalPC*4+1]!==id||!owner.pipelineIds.includes(id))continue;if(owner.custom){const result=customReady(owner,id,c,originalPC);if(result===0)return;if(result!==1){state[cb+4]=4;state[cb+13]=11;return;}}phase.phase(c,id);state[cb+14]=visits;}},control:c=>phase.control(c)};
}
