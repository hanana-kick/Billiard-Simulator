// HOST source-plan + generated resident scalar join. No CPU forward evaluation,
// no supplied physical-success Boolean, no final-gameplay receipt/activation.
import {createHash} from './source-sha256.mjs';
import '../math.js';import '../physics.js';import '../route-rules.js';import '../optimizer-core.js';import '../source-finalization-request.js';import '../inverse-events.js';
import {assertInverseWorldObservationPlan,generateInverseWorldObservationWGSL} from './inverse-world-observation.mjs';
import {assertWorldInitializationPlan,packWorldInitializationRows} from './world-initialization.mjs';
import {assertPreparedLiveFourBallCandidate} from '../browser-initial-import/prepare-live-candidate.mjs';
import {CREATION_SOURCE} from './creation-template.mjs';
import {createInverseTerminalContract,packInverseTerminalObservations} from './inverse-terminal-observation.mjs';
import {RULE_LAYOUT as R,RULE_METHOD,generatePhysicalRulesWGSL} from './physical-rules.mjs';
import {WORLD_APPLICATION_LAYOUT as W} from './world-application.mjs';
import {numberWords,generateSourceNumberWGSL} from './source-number.mjs';
import {generatePinnedMathWGSL} from './raw-strike.mjs';
import {linkResidentWGSL} from './wgsl-linker.mjs';
import {isOwnedUint32Array} from './abi.mjs';
const need=(v,m)=>{if(!v)throw new RangeError('Inverse source query join: '+m);},sha=x=>createHash('sha256').update(x).digest('hex'),proofs=new WeakMap();
const purposeIds=Object.freeze({evaluate:1,residual:2,jacobian:3,trial:4,verify:5});
const F=n=>{const w=numberWords(n);return`RcF64(${w[0]}u,${w[1]}u)`;};
export const INVERSE_QUERY_JOIN_PROFILE='source-four-ball-inverse-query-join-v1';
export const INVERSE_QUERY_JOIN_CAPABILITY=Object.freeze({sourceQueryOnly:true,acceptedRawOnly:true,residentInequalities:true,residentScorerJoin:true,hostSourcePlanOnly:true,physicalReplayImplemented:false,solverAdapterImplemented:false,gpuQualified:false,fullRestQualified:false,finalGameplayQualified:false,defaultEnabled:false});
/** Immutable INITIAL plan only. request.snapshot is checked against the actual
 * authenticated prestrike bytes. The complete original request snapshot (metadata AND bytes) is bound by the
 * existing cohesive same-realm preparation authority. All candidate rows are raw unchanged inputs.
 * Candidate normalization/restoration and explicit finalization policy are not
 * silently modeled. The original inverse private fixed-elevation trial is used.
 */
export function createInverseWorldQueryJoinPlan({observer,initialization,prepared,request,topology,rows,purpose='verify',generationId}={}){
 const p=assertInverseWorldObservationPlan(observer),init=assertWorldInitializationPlan(initialization),o=request?.options;
 need(p.sourceIdentity===init.sourceIdentity&&p.stateWords===init.template.state.length,'same authenticated world initial owner');
 need(!Object.hasOwn(request??{},'finalization'),'legacy query only; final-gameplay requires a different versioned receipt');
 need(o?.gameMode==='four'&&o.mode==='carom'&&Object.hasOwn(purposeIds,purpose),'four-ball original query purpose, not clearance-only or free mode');
 const source=assertPreparedLiveFourBallCandidate(prepared,request.snapshot);
 need(source.seed.initialSnapshotSha256===init.sourceIdentity&&source.seed.sourceOrigin.preStrikeSnapshotSha256===init.preStrikeIdentity&&source.seed.initialEventHistoryProfile==='source-full-application-history-v1','same full-history created/prestrike source');
 need(request.snapshot?.world instanceof Uint8Array&&sha(request.snapshot.world)===init.preStrikeIdentity,'actual prestrike native snapshot identity');
 need(request.selectedId===init.template.state[init.template.segments.application.offset+64+init.selectedIndex*16],'actual selected source ball');
 const fingerprint=globalThis.LabSourceFinalizationRequest.fingerprint;fingerprint(request);fingerprint(topology);
 // The original inverse owner changes only these private trial options.
 // Preserve that exact validation, including topology target/method overrides.
 globalThis.ShotSearchCore.validate({...request,testBudget:true,options:{...o,budget:1,elevationMode:'fixed',inputStrategy:'hybrid',targetId:topology.firstId??o.targetId,secondId:topology.secondId??o.secondId,methodId:topology.method??o.methodId,methods:undefined}});
 const expected=globalThis.LabInverseEvents.expectedEvents(topology);need(fingerprint(expected)===fingerprint(p.layout.expected),'same original ordered observation topology');
 const settings={minSpeed:o.minSpeed??.5,maxSpeed:o.maxSpeed??4.5,minElevation:o.elevationMode==='search'?(o.minElevation??0):request.settings.elevation,maxElevation:o.elevationMode==='search'?(o.maxElevation??85):request.settings.elevation,spin:o.spin};
 need(['fixed','search'].includes(o.elevationMode)&&typeof settings.spin==='boolean','explicit original input-constraint mode/spin');
 need(Object.entries(settings).filter(([k])=>k!=='spin').every(([,v])=>Number.isFinite(v))&&settings.minSpeed>=.5&&settings.maxSpeed<=4.5&&settings.minSpeed<=settings.maxSpeed&&settings.minElevation>=0&&settings.maxElevation<=85&&settings.minElevation<=settings.maxElevation,'bounded source input-constraint domain');
 need([8,16,30].includes(o.horizon),'original supported physical horizon');
 const method=topology.method??o.methodId??'none',r=init.template.state.slice(init.template.segments.rules.offset,init.template.segments.rules.offset+128),first=topology.firstId??o.targetId,second=topology.secondId??o.secondId;
 need(Object.hasOwn(RULE_METHOD,method)&&r[R.version]===1&&r[R.method]===RULE_METHOD[method]&&r[R.cueId]===request.selectedId&&r[R.firstId]===first&&r[R.secondId]===second&&r[R.opponentId]===o.opponentId,'same original physical method and four identities');
 need(typeof o.fourBallThreeCushion==='boolean'&&typeof o.allowKiss==='boolean'&&r[R.options]===(+o.fourBallThreeCushion|(o.allowKiss?2:0))&&r[R.maxSteps]===Math.round(o.horizon/(1/960)),'same original per-shot rules and horizon');
 need(p.segments.inverseQuery.offset+64===p.observerWords,'terminal record reuses ONLY dead query output/padding; no view extension');
 const inputs=packWorldInitializationRows(init,rows),count=rows.length;need(count<=4096,'bounded initial rows, not qualified concurrency');
 const topologyId=topology.id||topology.topologyId||JSON.stringify(expected),requestSha256=sha(fingerprint({request,topology,purpose}));
 need(source.seed.cueInitial.application.dt===1/960,'unchanged original outer clock');
 const ruleFields=Object.freeze(Object.fromEntries([R.version,R.method,R.options,R.maxSteps,R.cueId,R.firstId,R.secondId,R.opponentId].map(i=>[i,r[i]])));
 const draft={kind:INVERSE_QUERY_JOIN_PROFILE,observer:p,count,purpose,purposeId:purposeIds[purpose],settings:Object.freeze(settings),ruleFields,selectedIndex:init.selectedIndex,ruleId:init.ruleId,obstacles:init.roster.obstacles.length,selectedObstacle:init.roster.selectedObstacleIndex,outputOffset:p.segments.inverseQuery.offset,initialInputSha256:sha(inputs),preStrikeIdentity:init.preStrikeIdentity,capability:INVERSE_QUERY_JOIN_CAPABILITY};
 // The identity describes the actual join/observer/rule numerical source plus
 // pinned original creation authority, not proof of hardware execution. Header
 // digest words are excluded to avoid a circular hash; actual runtime manifests
 // must still pin the complete physical executor and all immutable buffers.
 const sourceSha256=sha([CREATION_SOURCE.physicsSha256,globalThis.LabInverseEvents.inputInequalities.toString(),globalThis.LabInverseEvents.projectResult.toString(),generateInverseWorldObservationWGSL(p,{entry:'library',count}),generatePhysicalRulesWGSL(),generateJoin(draft,Array(8).fill(0))].join('\n'));
 const context=createInverseTerminalContract({sourceSha256,initialSnapshotSha256:init.preStrikeIdentity,requestSha256,generationId,gameMode:'four',mode:'carom',requiresFullRest:true,candidates:rows.map(row=>({id:row.id,purpose,topologyId,topologyLength:expected.length,settings:structuredClone(row.settings)}))});
 // Reuse the existing codec's complete initial identity admission. This does
 // not inject any future observation into the resident executor.
 packInverseTerminalObservations(context,rows.map(row=>({id:row.id,status:'incomplete',reason:'transport-budget',boundary:'none',observation:null})));
 const plan=Object.freeze({...draft,context});proofs.set(plan,{inputs:inputs.slice(),initialization:init});return Object.freeze({plan,context,inputs});
}
function assertPlan(plan){const proof=proofs.get(plan);need(proof,'locally admitted immutable query join');assertWorldInitializationPlan(proof.initialization);assertInverseWorldObservationPlan(plan.observer);return proof;}
export function assertInverseQueryInitialInputs(plan,words){const proof=assertPlan(plan);need(isOwnedUint32Array(words)&&words.length===proof.inputs.length&&words.every((v,i)=>v===proof.inputs[i]),'all exact raw words/id/settings/selection/rule identity before upload');return true;}
export function generateInverseWorldQueryJoinWGSL(plan){assertPlan(plan);const words=Array.from({length:8},(_,i)=>parseInt(plan.context.contractSha256.slice(i*8,i*8+8),16));return generateJoin(plan,words);}
function generateJoin(p,identity){
 const q=p.observer,o=q.sourceOffsets,obs=q.segments,output=p.outputOffset,s=p.settings;
 const declarations=`@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(4) var<storage,read> rc_inputs:array<u32>;@group(0) @binding(5) var<storage,read_write> rc_event_audit:array<u32>;`;
 const body=`
 fn ij_state(at:u32)->RcF64{return RcF64(rc_state[at],rc_state[at+1u]);}
 fn ij_input(at:u32)->RcF64{return RcF64(rc_inputs[at],rc_inputs[at+1u]);}
 fn ij_observation(at:u32)->RcF64{return RcF64(rc_event_audit[at],rc_event_audit[at+1u]);}
 fn ij_put(at:u32,v:RcF64){rc_event_audit[at]=v.x;rc_event_audit[at+1u]=v.y;}
 fn ij_empty(out:u32,status:u32,reason:u32){for(var i=6u;i<12u;i++){rc_event_audit[out+i]=0u;}for(var i=20u;i<64u;i++){rc_event_audit[out+i]=0u;}rc_event_audit[out+3u]=status;rc_event_audit[out+4u]=reason;}
 fn rc_inverse_world_query_join(candidate:u32){
 if(candidate>=${p.count}u||arrayLength(&rc_inputs)!=${p.count*16}u||arrayLength(&rc_event_audit)!=${q.observerWords*p.count}u){return;}
 let b=candidate*${q.stateWords}u;let input=candidate*16u;let ob=candidate*${q.observerWords}u;let out=ob+${output}u;
 for(var i=0u;i<64u;i++){rc_event_audit[out+i]=0u;}rc_event_audit[out]=0x5243494fu;rc_event_audit[out+1u]=1u;rc_event_audit[out+2u]=rc_inputs[input];rc_event_audit[out+5u]=${p.purposeId}u;
 ${identity.map((w,i)=>`rc_event_audit[out+${12+i}u]=${w}u;`).join('')}
 ij_empty(out,3u,6u);
 if(b>arrayLength(&rc_state)||arrayLength(&rc_state)-b<${q.stateWords}u){ij_empty(out,6u,11u);return;}
 if(rc_inputs[input+1u]!=0u||rc_inputs[input+12u]!=${p.selectedIndex}u||rc_inputs[input+13u]!=${p.ruleId}u||rc_inputs[input+14u]!=0u||rc_inputs[input+15u]!=0u||rc_state[b]!=0x52435753u||rc_state[b+1u]!=1u||rc_state[b+4u]!=rc_inputs[input]||rc_state[b+8u]!=${p.selectedIndex}u){ij_empty(out,6u,11u);return;}
 let status=rc_state[b+2u];if(status==0u||status==1u){return;}if(status==5u){ij_empty(out,3u,7u);return;}if(status==6u){ij_empty(out,4u,8u);return;}if(status==7u){ij_empty(out,6u,11u);return;}if(status==4u||status==8u){ij_empty(out,2u,3u);return;}if(status!=2u&&status!=3u){ij_empty(out,6u,11u);return;}
 let r=b+${o.rules}u;let w=b+${o.worldApplication}u;let c=ob+${obs.inverseControl.offset}u;let state=ob+${obs.inverseObservation.offset}u;let projection=ob+${obs.inverseProjection.offset}u;let creation=b+${o.rawCreation}u;let clearance=b+${o.rawClearance}u;
 if(rc_state[w+${W.header.phase}u]!=7u||rc_state[w+${W.header.terminalPublished}u]!=1u||rc_state[r+${R.status}u]!=status||rc_state[r+${R.steps}u]!=rc_state[w+${W.header.outer}u]){ij_empty(out,6u,11u);return;}
 ${Object.entries(p.ruleFields).map(([at,v])=>`if(rc_state[r+${at}u]!=${v}u){ij_empty(out,2u,3u);return;}`).join('')}
 if(rc_state[creation]!=0u||rc_state[creation+1u]!=3u||rc_state[creation+2u]!=0u||rc_state[creation+3u]!=1u||rc_state[creation+4u]!=1u||rc_state[creation+5u]!=3u||rc_state[b+${o.rawPose}u]!=1u){ij_empty(out,2u,3u);return;}
 // Same raw read-set/roster and source completion transcript as creation's
 // original admission. Accepted source path has no normalization/restoration.
 if(rc_state[clearance]!=1u||rc_state[clearance+1u]!=${p.obstacles*3}u||rc_state[clearance+2u]!=0u||rc_state[clearance+3u]!=${p.selectedObstacle}u||rc_state[clearance+8u]!=0u||rc_state[clearance+9u]!=0xffffffffu||rc_state[clearance+10u]!=${(p.obstacles*3-1)*3}u||rc_state[clearance+11u]!=${p.obstacles*3-1}u||rc_state[clearance+12u]!=0u){ij_empty(out,2u,3u);return;}
 if(rc_event_audit[c]!=0x52494f57u||rc_event_audit[c+1u]!=1u||rc_event_audit[c+2u]!=2u||rc_event_audit[c+3u]!=0u||rc_event_audit[c+4u]!=rc_state[b+5u]||rc_event_audit[c+5u]+1u!=rc_state[b+5u]||rc_event_audit[c+7u]!=1u||rc_event_audit[state]!=0x52494f53u||rc_event_audit[state+1u]!=1u||rc_event_audit[state+2u]!=1u||rc_event_audit[state+3u]!=0u||rc_event_audit[state+4u]!=rc_state[b+5u]||rc_event_audit[projection]!=0x52494f50u||rc_event_audit[projection+1u]!=1u||rc_event_audit[projection+2u]!=0u||rc_event_audit[projection+6u]!=rc_state[b+5u]){ij_empty(out,2u,3u);return;}
 if(rc_event_audit[state+5u]!=1u||rc_event_audit[state+7u]>2u||rc_event_audit[state+11u]>2u||rc_event_audit[state+12u]>${q.layout.eventCapacity}u||rc_event_audit[state+13u]>rc_event_audit[state+12u]){ij_empty(out,6u,11u);return;}
 if(rc_event_audit[state+11u]!=0u){ij_empty(out,2u,select(2u,1u,rc_event_audit[state+11u]==1u));return;}
 let flags=rc_state[r+${R.flags}u];let success=(flags&8u)!=0u&&(flags&16u)==0u;let rest=(flags&1024u)!=0u;
 if((status==2u&&(!success||!rest))||(status==3u&&success)){ij_empty(out,6u,11u);return;}
 let speed=ij_input(input+6u);let elevation=ij_input(input+4u);let tipX=ij_input(input+8u);let tipY=ij_input(input+10u);let distance=ij_state(clearance+4u);
 if(!rc_f64_finite(ij_input(input+2u))||!rc_f64_finite(speed)||!rc_f64_finite(elevation)||!rc_f64_finite(tipX)||!rc_f64_finite(tipY)||!rc_f64_finite(distance)||rc_f64_lt(distance,${F(0)})){ij_empty(out,2u,4u);return;}
 ij_put(out+26u,rc_f64_neg(distance));ij_put(out+28u,rc_f64_sub(${F(s.minSpeed)},speed));ij_put(out+30u,rc_f64_sub(speed,${F(s.maxSpeed)}));ij_put(out+32u,rc_f64_sub(${F(s.minElevation)},elevation));ij_put(out+34u,rc_f64_sub(elevation,${F(s.maxElevation)}));ij_put(out+36u,rc_f64_sub(rc_f64_abs(tipX),${F(.55)}));ij_put(out+38u,rc_f64_sub(rc_f64_abs(tipY),${F(.45)}));ij_put(out+40u,rc_f64_sub(rc_f64_pinned_hypot2(tipX,tipY),${F(.6)}));ij_put(out+42u,${s.spin?F(-1):'rc_f64_pinned_hypot2(tipX,tipY)'});
 var feasible=true;for(var i=0u;i<9u;i++){let v=ij_observation(out+26u+2u*i);if(!rc_f64_finite(v)||rc_f64_lt(${F(0)},v)){feasible=false;}}
 let pf=rc_event_audit[projection+5u];let prefix=rc_event_audit[projection+3u];let matched=(pf&2u)!=0u;let goal=success&&matched&&feasible;
 if((pf&0xffffffeCu)!=0u||prefix>${q.layout.expected.length}u||rc_event_audit[projection+4u]!=prefix||matched!=(rc_event_audit[state+7u]==0u&&prefix==${q.layout.expected.length}u)||prefix!=rc_event_audit[state+6u]){ij_empty(out,6u,11u);return;}
 let hasCell=(pf&16u)!=0u;let first=rc_event_audit[state+13u];
 if(hasCell!=(first!=0u)){ij_empty(out,6u,11u);return;}
 if(hasCell){let ev=state+${q.layout.eventBase}u+8u*(first-1u);
 if(rc_event_audit[ev]!=0u||rc_event_audit[ev+1u]!=rc_event_audit[projection+20u]||rc_event_audit[ev+6u]>rc_state[b+5u]){ij_empty(out,6u,11u);return;}
 for(var i=0u;i<4u;i++){if(rc_event_audit[ev+2u+i]!=rc_event_audit[projection+14u+i]){ij_empty(out,6u,11u);return;}}
 let dt=ij_observation(projection+16u);let rounded=ij_observation(projection+18u);
 if(!rc_f64_finite(dt)||!rc_f64_lt(${F(0)},dt)||!rc_f64_finite(rounded)||rc_f64_lt(rounded,${F(0)})||rc_f64_lt(${F(Number.MAX_SAFE_INTEGER)},rounded)){ij_empty(out,2u,4u);return;}}
 let available=matched||(prefix<${q.layout.expected.length}u&&rc_event_audit[state+64u+12u*prefix]!=0u);
 if(((pf&1u)!=0u)!=available){ij_empty(out,6u,11u);return;}
 for(var i=0u;i<3u;i++){let v=ij_observation(projection+8u+2u*i);if(!rc_f64_finite(v)||((!available||matched)&&(v.x!=0u||v.y!=0u))){ij_empty(out,2u,4u);return;}}
 rc_event_audit[out+6u]=(pf&1u)|2u|select(0u,4u,(pf&16u)!=0u)|select(0u,8u,goal)|select(0u,16u,goal&&${p.purpose==='verify'});rc_event_audit[out+8u]=prefix;rc_event_audit[out+9u]=prefix;rc_event_audit[out+10u]=rc_state[r+${R.steps}u];rc_event_audit[out+11u]=select(2u,3u,rest);
 for(var i=0u;i<6u;i++){rc_event_audit[out+20u+i]=rc_event_audit[projection+8u+i];}ij_put(out+44u,distance);
 if((pf&16u)!=0u){rc_event_audit[out+46u]=rc_event_audit[projection+20u];for(var i=0u;i<2u;i++){rc_event_audit[out+48u+i]=rc_event_audit[projection+16u+i];}let rounded=ij_observation(projection+18u);ij_put(out+50u,select(rounded,${F(0)},rc_f64_zero(rounded)));}
 rc_event_audit[out+4u]=0u;rc_event_audit[out+3u]=1u;
 }
 @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){rc_inverse_world_query_join(gid.x);}
 `;
 // Keep the original V8/SunPro attribution for the unchanged pinned hypot.
 const math=generatePinnedMathWGSL(),license=math.slice(0,math.indexOf('*/')+2);
 return license+'\n'+linkResidentWGSL([declarations,generateSourceNumberWGSL(),math,body]).code;
}
