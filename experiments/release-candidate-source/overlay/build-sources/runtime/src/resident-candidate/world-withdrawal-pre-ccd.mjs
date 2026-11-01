// DISTINCT OPT-IN extension. No original/default source or qualified bytes are
// changed. Actual same-h removal is admitted only by both original inactive
// predicates and the exact source-owned scene/journal/application receipts.
import {generateWorldHCurrentPreCcdPlan,generateWorldCurrentPreCcdWGSL,WORLD_CURRENT_PRE_CCD_PROFILE,WORLD_CURRENT_PRE_CCD_CAPABILITY} from './world-current-pre-ccd.mjs';
import {CONTACT_JOURNAL_LAYOUT as J} from './contact-journal.mjs';
import {SCENE_LAYOUT as S} from './scene-activation.mjs';
import {SCENE_WORLD_LAYOUT as W} from './scene-world.mjs';
import {WORLD_BROAD_LAYOUT as B} from './world-broad.mjs';
import {WORLD_APPLICATION_LAYOUT as A} from './world-application.mjs';
import {APPLICATION_LAYOUT as APP} from './application.mjs';
import {CUE_LAYOUT as Q} from './cue.mjs';
import {generateCcdWGSL} from './ccd.mjs';
import {linkResidentWGSL} from './wgsl-linker.mjs';
export const WORLD_WITHDRAWAL_PRE_CCD_PROFILE='four-ball-native-current-pre-same-h-inactive-v1';
export const WORLD_WITHDRAWAL_PRE_CCD_LAYOUT=Object.freeze({adapter:1184,receipt:45,receiptWords:30,magic:0x52435744,fields:Object.freeze({magic:45,h:46,priorCueFrame:47,validForceMask:48,dt:49,postComplete:50,forceWords:51}),forceRows:4,forceStride:6});
export const WORLD_WITHDRAWAL_PRE_CCD_CAPABILITY=Object.freeze({...WORLD_CURRENT_PRE_CCD_CAPABILITY,sameHWithdrawalSupported:'only exact source-owned compliant separation with all current pre and solved-post predicates inactive',activeSameHWithdrawal:false,partialStateOnUnsupported:true});
const need=(p,m)=>{if(!p)throw new RangeError('Withdrawal pre-CCD profile: '+m);};
function once(code,old,value,label){need(code.split(old).length===2,'exact source seam '+label);return code.replace(old,value);}
function sourceFunction(code,name){const start=code.indexOf('fn '+name+'(');need(start>=0,'source function '+name);const open=code.indexOf('{',start);let end=open+1,depth=1;for(;depth&&end<code.length;end++){if(code[end]==='{')depth++;if(code[end]==='}')depth--;}need(!depth,'complete source function '+name);return code.slice(start,end);}
function removeMain(code){const start=code.lastIndexOf('@compute');need(start>=0,'source compute');const open=code.indexOf('{',start);let end=open+1,depth=1;for(;depth&&end<code.length;end++){if(code[end]==='{')depth++;if(code[end]==='}')depth--;}need(!depth,'complete compute');return code.slice(0,start)+code.slice(end);}
/** Source-derived current-pre control, not new equations. The only new storage
 * is a 30-word receipt in previously unused adapter45..74. Captured before the
 * original cue call can swap-remove live chunk rows; no early CCD check/rejection. */
export function generateWorldWithdrawalPreCcdWGSL(t){
 let code=generateWorldCurrentPreCcdWGSL(t);const o=Object.fromEntries(Object.entries(t.segments).map(([k,v])=>[k,v.offset])),l=WORLD_WITHDRAWAL_PRE_CCD_LAYOUT;
 need(l.receipt+l.receiptWords<=96,'disjoint adapter tail');const removed=[];
 for(const role of[5,4,6]){const binding=t.bindings[role],owned=[];for(let i=0;i<t.state[o.journal+J.header.colliders];i++){const p=o.journal+J.colliderOffset+i*J.colliderStride;if(t.state[p+J.collider.bodyIndex]===binding.body.index&&t.state[p+J.collider.bodyGeneration]===binding.body.generation){need(t.state[p+J.collider.cue]===1,'source cue collider');owned.push({slot:i,rank:t.state[p+J.collider.bodyColliderRank]});}}owned.sort((a,b)=>a.rank-b.rank);need(owned.every((x,i)=>x.rank===i),'complete source parent collider order');removed.push(...owned.map(x=>x.slot));}need(removed.length===3&&new Set(removed).size===3,'exact three original cue colliders');
 const helper=`
const RC_WCW_REMOVED:array<u32,3>=array<u32,3>(${removed.map(x=>x+'u').join(',')});
// This copy occurs BEFORE cue impulses/removal. Source forceOffset is still
// paired with its previous energy traversal's activeOffset. That snapshot
// remains distinct from the live chunk that removal can compact. Invalid evidence is recorded, not admitted early.
fn rc_wcw_capture(bank:u32){let a=bank+${o.ccd+1184}u;for(var n=45u;n<75u;n++){rc_state[a+n]=0u;}if(rc_state[bank+2u]!=1u||rc_state[bank+${o.worldH}u]!=1u){return;}let q=bank+${o.cue}u;let scene=bank+${o.scene}u;let bridge=bank+${o.sceneWorld}u;rc_state[a+45u]=${l.magic}u;rc_state[a+46u]=rc_state[bank+5u];rc_state[a+47u]=rc_state[q+7u];rc_state[a+49u]=rc_state[bank+10u];if(rc_state[scene+${S.header.activeCount}u]>6u){return;}
 for(var role=0u;role<4u;role++){let src=bank+${o.bodies}u+role*64u;let dst=a+51u+role*6u;var matches=0u;var valid=true;for(var n=0u;n<3u;n++){rc_state[dst+n]=rc_state[src+47u+n];rc_state[dst+3u+n]=rc_state[src+38u+n];}
  for(var row=0u;row<rc_state[scene+${S.header.activeCount}u];row++){if(rc_state[scene+${S.activeOffset}u+row]==RC_WCP_SLOTS[role]){matches++;for(var n=0u;n<6u;n++){if(rc_state[bridge+${W.forceOffset}u+row*6u+n]!=rc_state[dst+n]){valid=false;}}}}
  if(matches>1u){valid=false;}if(matches==0u){for(var n=0u;n<6u;n++){if(rc_state[dst+n]!=RC_WCP_INITIAL_FORCE_TORQUE[role*6u+n]){valid=false;}}}if(valid){rc_state[a+48u]|=1u<<role;}
 }
}
fn rc_wcw_retired(bank:u32)->bool{return rc_state[bank+${o.worldH}u]==1u&&rc_state[bank+${o.cue+Q.header.present}u]==0u;}
// No inference from cue absence. Require the actual current source call receipt,
// head->shaft->guide retirement, consumed original collider FIFO and old clock.
fn rc_wcw_removal_receipt(bank:u32)->bool{let q=bank+${o.cue}u;let scene=bank+${o.scene}u;let j=bank+${o.journal}u;let broad=bank+${o.broad}u;let app=bank+${o.worldApplication}u;let a=bank+${o.ccd+1184}u;
 if(!rc_wcw_retired(bank)||rc_state[app+${A.header.cueAtEntry}u]!=1u||rc_state[app+${A.header.phase}u]!=3u||rc_state[q+${Q.header.status}u]!=1u||rc_state[q+${Q.header.removedCount}u]!=3u||rc_state[q+${Q.header.mutableCount}u]!=2u||rc_state[q+${Q.header.needsSolve}u]!=0u||rc_state[q+${Q.header.contacted}u]!=1u||rc_state[q+43u]!=0u||rc_state[q+44u]!=1u||rc_state[q+45u]!=0u||rc_state[q+${Q.header.endedValid}u]!=1u||rc_state[a+45u]!=${l.magic}u||rc_state[a+46u]!=rc_state[bank+5u]||rc_state[a+47u]==0xffffffffu||rc_state[a+47u]+1u!=rc_state[q+7u]||rc_state[app+${A.header.cueFrame}u]!=rc_state[a+47u]||rc_state[a+48u]!=15u||rc_state[a+49u]!=rc_state[bank+10u]){return false;}
 for(var n=0u;n<2u;n++){if(rc_state[q+${Q.header.ended}u+n]!=rc_state[bank+${o.application+APP.header.time}u+n]){return false;}}
 if(rc_state[scene+${S.header.bodyCount}u]!=${t.sceneTemplate.bodies.length-3}u||rc_state[j+${J.header.cuePresent}u]!=0u||rc_state[j+${J.header.cueCount}u]!=3u||rc_state[j+${J.header.removed}u]!=3u||rc_state[broad+${B.header.removedCount}u]!=3u||rc_state[broad+${B.header.removalConsumed}u]!=1u||rc_state[broad+${B.header.removalFrame}u]!=rc_state[q+7u]){return false;}
 ${[5,4,6].map((role,i)=>{const r=t.bindings[role];return `if(rc_state[q+${Q.header.headSlot+i}u]!=${r.sceneSlot}u||rc_state[q+${Q.removedRoles+i}u]!=${i}u){return false;}let p${i}=scene+${S.bodyOffset+r.sceneSlot*S.bodyStride}u;if(rc_state[p${i}+${S.body.present}u]!=0u||rc_state[p${i}+${S.body.index}u]!=${r.body.index}u||rc_state[p${i}+${S.body.generation}u]!=${r.body.generation}u){return false;}`;}).join('\n')}
 for(var i=0u;i<3u;i++){let slot=RC_WCW_REMOVED[i];let c=j+${J.colliderOffset}u+slot*${J.colliderStride}u;if(rc_state[j+${J.removedOffset}u+i]!=slot||rc_state[c+${J.collider.cue}u]!=1u||rc_state[c+${J.collider.live}u]!=0u||rc_state[broad+${B.removedOffset}u+i]!=rc_state[c+${J.collider.index}u]){return false;}}
 return true;
}
fn rc_wcw_presence(bank:u32)->bool{if(rc_state[bank+${o.cue+Q.header.present}u]==1u){return true;}return rc_wcw_removal_receipt(bank);}
fn rc_wcw_population(bank:u32)->bool{let scene=bank+${o.scene}u;let j=bank+${o.journal}u;if(rc_wcw_retired(bank)){return rc_wcw_removal_receipt(bank);}return rc_state[scene+${S.header.bodyCount}u]==${t.sceneTemplate.bodies.length}u&&rc_state[j+${J.header.cuePresent}u]==1u&&rc_state[j+${J.header.cueCount}u]==3u&&rc_state[j+${J.header.removed}u]==0u;}
fn rc_wcw_finish(bank:u32)->bool{if(!rc_wcw_retired(bank)){return true;}let a=bank+${o.ccd+1184}u;let scene=bank+${o.scene}u;var count=0u;let mask=rc_state[a+12u];for(var role=0u;role<4u;role++){if((mask&(1u<<role))!=0u){count++;}let p=rc_wcp_body(bank,role);if(p==0xffffffffu||((rc_state[p+${S.body.activation+4}u]==0u)!=((mask&(1u<<role))!=0u))){rc_wcp_fail(bank,9u);return false;}}
 if(!rc_wcw_removal_receipt(bank)||rc_state[a]!=15u||rc_state[a+41u]!=1u||rc_state[a+43u]!=1u||rc_state[a+40u]!=rc_state[a+39u]||(mask&~rc_state[a+40u])!=0u||rc_state[a+13u]!=mask||rc_state[a+7u]!=count||rc_state[a+1u]!=0u||rc_state[a+50u]!=0u){rc_wcp_fail(bank,9u);return false;}rc_state[a+50u]=1u;return true;
}
`;
 code=once(code,'if(role>=6u){return 0xffffffffu;}','if(role>=select(6u,4u,rc_wcw_retired(bank))){return 0xffffffffu;}','source body role limit');
 code=once(code,'rc_state[q+4u]==1u','rc_wcw_presence(bank)','identity actual presence');
 code=once(code,'rc_state[q+4u]!=1u','!rc_wcw_presence(bank)','begin actual presence');
 code=once(code,`rc_state[scene+${S.header.bodyCount}u]!=${t.sceneTemplate.bodies.length}u`,'!rc_wcw_population(bank)','exact population');
 code=once(code,`||rc_state[journal+${J.header.cuePresent}u]!=1u||rc_state[journal+${J.header.cueCount}u]!=3u||rc_state[journal+${J.header.removed}u]!=0u`,'','population owns original live or exact retired journal guards');
 code=once(code,'for(var n=0u;n<96u;n++){rc_state[a+n]=0u;}','for(var n=0u;n<45u;n++){rc_state[a+n]=0u;}','preserve disjoint retained force receipt');
 for(const name of['rc_wcp_begin','rc_wcp_after_energy']){const old=sourceFunction(code,name);let updated=once(old,'role<6u','role<select(6u,4u,rc_wcw_retired(bank))',name+' actual surviving roster');code=once(code,old,updated,name);}
 const gather=sourceFunction(code,'rc_wcp_gather'),from=gather.indexOf(' for(var row=0u;'),end=gather.indexOf('\n for(var n=0u;n<64u;n++)',from);need(from>=0&&end>from,'original retained force guard');const oldGuard=gather.slice(from,end),newGuard=` if(rc_wcw_retired(bank)){for(var n=0u;n<3u;n++){if(rc_state[src+47u+n]!=rc_state[a+51u+role*6u+n]||rc_state[src+38u+n]!=rc_state[a+54u+role*6u+n]){return rc_wcp_fail(bank,3u);}}}else{${oldGuard}\n }`;
 code=once(code,gather,gather.slice(0,from)+newGuard+gather.slice(end),'retained pre-removal source force identity');
 return code+'\n'+helper;
}
/** Complete existing current-pre schedule with three source-control extensions:
 * pre-cue retained-force receipt, exact current roster and both predicate proof
 * before application. Original equations/caps and next-h active path unchanged. */
export function generateWorldHWithdrawalPreCcdPlan(t,{profile,...options}={}){
 need(profile===WORLD_WITHDRAWAL_PRE_CCD_PROFILE,'explicit separate profile required');const base=generateWorldHCurrentPreCcdPlan(t,{...options,profile:WORLD_CURRENT_PRE_CCD_PROFILE}),library=generateWorldWithdrawalPreCcdWGSL(t);
 const pipelines=base.pipelines.map(p=>{let body=p.devicePc.body;if(p.name==='begin-h')body+='rc_wcw_capture(bank);';if(p.name==='application-post-begin')body='if(!rc_wcw_finish(bank)){return;}'+body;const hasCurrent=/\bfn rc_wcp_\w+\(/.test(p.code);if(body===p.devicePc.body&&!hasCurrent)return p;
  let code=removeMain(p.code);for(const m of[...code.matchAll(/\bfn (rc_wcp_\w+)\(/g)])code=once(code,sourceFunction(code,m[1]),'','replace current source helper '+m[1]);
  const entry=`@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=${base.count}u){return;}let bank=gid.x*${t.state.length}u;let scratch=gid.x*${t.numericScratchWords}u;if(!(${p.devicePc.guard})){return;}${body}}`;
  const linked=linkResidentWGSL([code,generateCcdWGSL(t.bundles.ccd),library,entry]);need(p.owner!=='control'||!/\bfn (?:rc_num_eval|rc_source_program_step)\(/.test(linked.code),'integer control closure contains no numeric VM');return Object.freeze({...p,code:linked.code,functions:linked.functions,devicePc:Object.freeze({...p.devicePc,body})});});
 return Object.freeze({...base,profile,capability:WORLD_WITHDRAWAL_PRE_CCD_CAPABILITY,pipelines:Object.freeze(pipelines),sourceOrderProfile:Object.freeze({...base.sourceOrderProfile,name:profile,sameHWithdrawal:'exact current source removal receipts plus both original inactive predicates; active/unsupported stops before h publication',retainedForceReceipt:WORLD_WITHDRAWAL_PRE_CCD_LAYOUT,sourceEquationsChanged:false,sourceCapsChanged:false,outerLatchChanged:false,wholeHQualified:false})});
}
