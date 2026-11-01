// SPDX-License-Identifier: Apache-2.0
// Source-backed, discrete four-ball search reducer. No collision detection,
// trajectory synthesis, native forward execution, or production backend switch.
// Numeric predicates belong to the resident numerical producer: see CONTRACT.
import {STATUS,REASON as ABI_REASON,UNSET} from './abi.mjs';
export const RULE_STATUS=Object.freeze(Object.fromEntries(Object.entries(STATUS).map(([k,v])=>[k.toLowerCase(),v])));
export const RULE_REASON=Object.freeze({none:0,cueObstruction:1,foul:2,ambiguous:3,invalidRoute:4,kiss:5,firstNotHit:6,insufficientCushions:7,secondNotHit:8,horizon:9,overflow:10,nonfinite:11,contract:12,cancelled:13});
export const RULE_METHOD=Object.freeze({none:0,direct:1,carom:2,any:3,turn:4,grand:5,return:6,cross:7,bank1:8,bank2:9,bank3:10,allWalls:11});
export const RULE_EVENT=Object.freeze({ignore:0,cushion:1,ball:2,floor:3,cueObstruction:4});
export const RULE_FLAG=Object.freeze({firstSeen:1,wrong:2,complete:4,success:8,invalid:16,goalLatched:32,foul:64,cueObstructed:128,ambiguous:256,kiss:512,gameFinished:1024});
export const RULE_WORDS=128;
export const RULE_LAYOUT=Object.freeze({version:0,status:1,reason:2,method:3,flags:4,options:5,steps:6,maxSteps:7,rails:8,before:9,after:10,preMask:11,postMask:12,firstThreeMask:13,after0:14,after1:15,after2:16,last0:17,last1:18,returning:19,hitRails:20,hitTimeLo:21,hitTimeHi:22,kissSeen:23,kissActive:24,firstKissLo:25,firstKissHi:26,groupMask:27,groupTimeLo:28,groupTimeHi:29,groupOpen:30,pending:31,gameReds:32,gameCushions:33,gameGoalCushions:34,ringCount:35,ringHead:36,cueId:37,firstId:38,secondId:39,opponentId:40,ring:64,ringStride:4,ringCapacity:8});
const L=RULE_LAYOUT,F=RULE_FLAG,S=RULE_STATUS,R=RULE_REASON,M=RULE_METHOD,E=RULE_EVENT,U=0xffffffff;
export const CONTRACT=Object.freeze({version:1,scope:'registered-four-ball-search-rules',words:RULE_WORDS,historyEntries:8,physics:false,source:['optimizer-core.js:201-224,252-289','route-rules.js:22-90','game-rules.js:6-8'],
 numericProducer:'All times are source JS Number bit pairs. Filter/history times are absolute; rule/group/kiss times are the source-rounded time minus trial.start. Producer must evaluate source binary64 predicates on GPU; no f32 approximation or host readback is permitted.',
 ordering:'History includes every PhysicsLab.emit, even non-key stroke/compliant/obstruction messages. Native contacts in original emission order; route events in stable nondecreasing source time order within each OUTER step. sameGroup compares event time to GROUP FIRST time, abs(delta)<1e-9. Call sampleKiss only at outer boundary before finishOuter.',
 predicates:Object.freeze(['native started; moving ball exists','cloth event time < .15','floor/cloth own speed < .12','event.time - each last-eight event.time < .12','route same-time group abs(delta)<1e-9','kiss geometric separation > .00005','first kiss time <= hit time + 1e-9','off-table predicate with original dimensions','finite position sum; positive opponent impulse; cue presence; all balls sleeping']),
 diagnosticsOmitted:'Path/residual/ranking and full event history are not needed for terminal pass filtering; winner replay supplies them.'});
function uint(x,label){if(!Number.isInteger(x)||x<0||x>U)throw new TypeError('u32 '+label+' required');return x;}
function bool(x,label){if(typeof x!=='boolean')throw new TypeError('Boolean '+label+' source predicate required');return x;}
function words(s){if(!(s instanceof Uint32Array)||s.length!==RULE_WORDS||s[L.version]!==1)throw new TypeError('Owned rule state required');return s;}
function has(s,f){return !!(s[L.flags]&f);}function set(s,f){s[L.flags]|=f;}
function terminal(s,status,reason=R.none){s[L.status]=status;s[L.reason]=reason;return status;}
function inc(s,k){if(s[k]===U){terminal(s,S.unsupported,R.overflow);return false;}s[k]++;return true;}
function timeWords(t){if(!Array.isArray(t)&&!(t instanceof Uint32Array)||t.length!==2)throw new TypeError('Two source binary64 words required');return [uint(t[0],'time low'),uint(t[1],'time high')];}
export function binary64Words(value){if(!Number.isFinite(value))throw new TypeError('Finite source time required');const a=new ArrayBuffer(8),d=new DataView(a);d.setFloat64(0,value,true);return [d.getUint32(0,true),d.getUint32(4,true)];}
export function binary64Value(lo,hi){const a=new ArrayBuffer(8),d=new DataView(a);d.setUint32(0,uint(lo,'low'),true);d.setUint32(4,uint(hi,'high'),true);return d.getFloat64(0,true);}
export function createRuleState({cueId,firstId,secondId,opponentId,method='none',threeCushion=false,allowKiss=true,maxOuterSteps}={}){
 const ids=[cueId,firstId,secondId,opponentId].map((v,i)=>uint(v,'identity '+i));if(new Set(ids).size!==4)throw new RangeError('Four distinct original identities required');
 if(!Object.hasOwn(M,method))throw new RangeError('Unknown rule method');bool(threeCushion,'threeCushion');bool(allowKiss,'allowKiss');uint(maxOuterSteps,'maxOuterSteps');if(!maxOuterSteps)throw new RangeError('Positive outer horizon required');
 const s=new Uint32Array(RULE_WORDS);s[L.version]=1;s[L.status]=S.running;s[L.method]=M[method];s[L.options]=(threeCushion?1:0)|(allowKiss?2:0);s[L.maxSteps]=maxOuterSteps;s[L.gameGoalCushions]=U;
 [L.cueId,L.firstId,L.secondId,L.opponentId].forEach((k,i)=>s[k]=ids[i]);return s;
}
export function decodeRuleState(input){const s=words(input),f=s[L.flags];return {status:Object.keys(S).find(k=>S[k]===s[L.status]),pass:s[L.status]===S.pass?true:s[L.status]===S.miss?false:null,reason:Object.keys(R).find(k=>R[k]===s[L.reason]),steps:s[L.steps],firstHit:!!(f&F.firstSeen)&&!(f&F.wrong),success:!!(f&F.success),invalid:!!(f&F.invalid),goalLatched:!!(f&F.goalLatched),fourBallFoul:!!(f&F.foul),cueObstructed:!!(f&F.cueObstructed),ambiguous:!!(f&F.ambiguous),kiss:!!(f&F.kiss),rails:s[L.rails],before:s[L.before],after:s[L.after],hitRails:s[L.hitRails],hitTime:binary64Value(s[L.hitTimeLo],s[L.hitTimeHi]),game:{redMask:s[L.gameReds],cushions:s[L.gameCushions],goalCushions:s[L.gameGoalCushions]===U?null:s[L.gameGoalCushions],finished:!!(f&F.gameFinished)}};}
// Initial history is copied, not replayed into this shot's scorer/game reducer.
export function seedEventHistory(input,history){const s=words(input);if(s[L.steps]||s[L.ringCount])throw new Error('History can only seed a fresh state');if(!Array.isArray(history))throw new TypeError('Original contact history required');for(const e of history.slice(-8)){if(e.pairId===undefined||e.pairId===null)appendNonkeyEventHistory(s,e.time);else appendHistory(s,uint(e.pairId,'pairId'),timeWords(e.time));}return s;}
function appendHistory(s,pairId,t){const slot=s[L.ringHead],at=L.ring+slot*L.ringStride;s[at]=pairId;s[at+1]=t[0];s[at+2]=t[1];s[at+3]=1;s[L.ringHead]=(slot+1)%8;s[L.ringCount]=Math.min(8,s[L.ringCount]+1);}
// PhysicsLab.emit appends every event, including stroke/compliant-tip contact/
// cue obstruction without a native pair key. Such rows still evict last-eight
// history entries but must never equal any native pair identifier.
export function appendNonkeyEventHistory(input,time){const s=words(input),slot=s[L.ringHead];appendHistory(s,0,timeWords(time));s[L.ring+slot*L.ringStride+3]=0;return s;}
// recentMask bit i means the exact source predicate time - ring[i].time < .12.
// Non-selected ball contacts MUST pass this filter too: source debounce uses all contacts.
export function filterNativeEvent(input,{pairId,time,started,movingBall,clothEarly,clothOrFloorSlow,recentMask}){const s=words(input),t=timeWords(time);uint(pairId,'pairId');uint(recentMask,'recentMask');if(recentMask>255)throw new RangeError('Eight ring predicate bits required');for(const[k,v]of Object.entries({started,movingBall,clothEarly,clothOrFloorSlow}))bool(v,k);if(s[L.status]!==S.running||!started||!movingBall||clothEarly||clothOrFloorSlow)return false;for(let i=0;i<8;i++){const at=L.ring+i*4;if(s[at+3]&&s[at]===pairId&&(recentMask&(1<<i)))return false;}appendHistory(s,pairId,t);return true;}
function gameEvent(s,kind,id){if(kind===E.cushion)inc(s,L.gameCushions);if(kind===E.ball){if(id===s[L.firstId])s[L.gameReds]|=1;if(id===s[L.secondId])s[L.gameReds]|=2;if(s[L.gameReds]===3&&s[L.gameGoalCushions]===U)s[L.gameGoalCushions]=s[L.gameCushions];}if(kind===E.floor||kind===E.ball&&id===s[L.opponentId])set(s,F.foul|F.invalid);}
function goal(s,t){set(s,F.success|F.complete);s[L.hitRails]=s[L.rails];s[L.hitTimeLo]=t[0];s[L.hitTimeHi]=t[1];}
function addRail(s,rail){if(!inc(s,L.rails))return;if(!has(s,F.firstSeen)){inc(s,L.before);if(rail)s[L.preMask]|=1<<(rail-1);return;}const n=s[L.after];inc(s,L.after);if(rail)s[L.postMask]|=1<<(rail-1);if(n<3){s[L.after0+n]=rail;if(rail)s[L.firstThreeMask]|=1<<(rail-1);}if(n>=2&&rail&&rail===s[L.last0]&&rail!==s[L.last1])s[L.returning]=1;s[L.last0]=s[L.last1];s[L.last1]=rail;}
export function consumeRuleEvent(input,{kind,id=0,rail=0,time,sameGroup=false}){const s=words(input),t=timeWords(time);if(!Object.values(E).includes(kind))throw new RangeError('Known event kind required');uint(id,'object id');uint(rail,'rail');if(rail>4)throw new RangeError('Rail 0..4 required');bool(sameGroup,'sameGroup');if(s[L.status]!==S.running)return;
 if(kind===E.cueObstruction){set(s,F.cueObstructed|F.invalid);return;}if(kind===E.ignore)return;gameEvent(s,kind,id);if(s[L.status]!==S.running||has(s,F.goalLatched)||kind===E.floor)return;
 if(kind===E.ball&&![s[L.firstId],s[L.secondId],s[L.opponentId]].includes(id)){terminal(s,S.unsupported,R.contract);return;}
 if(s[L.method]===M.none){if(kind===E.cushion){inc(s,L.rails);return;}if(!has(s,F.firstSeen)){if(id!==s[L.firstId]){set(s,F.invalid);return;}set(s,F.firstSeen);}else if(id===s[L.secondId]){if(s[L.rails]>=((s[L.options]&1)?3:0))goal(s,t);else set(s,F.invalid);}else if(id!==s[L.firstId])set(s,F.invalid);return;}
 s[L.pending]=1;if(!s[L.groupOpen]||!sameGroup){s[L.groupMask]=0;s[L.groupTimeLo]=t[0];s[L.groupTimeHi]=t[1];s[L.groupOpen]=1;}
 const bit=kind===E.cushion?1<<(4+rail):id===s[L.firstId]?1:id===s[L.secondId]?2:4,old=s[L.groupMask];
 if(kind===E.cushion?(old&7)!==0:((old&0x1f0)!==0||((old&7)&~bit)!==0))set(s,F.ambiguous);
 if(old&bit)return;s[L.groupMask]=old|bit;if(has(s,F.complete))return;
 if(kind===E.cushion){addRail(s,rail);return;}if(!has(s,F.firstSeen)){set(s,F.firstSeen);if(id!==s[L.firstId])set(s,F.wrong);}else if(!has(s,F.wrong)){if(id===s[L.secondId]){set(s,F.complete);s[L.hitTimeLo]=t[0];s[L.hitTimeHi]=t[1];s[L.hitRails]=s[L.rails];}else if(id!==s[L.firstId])set(s,F.wrong);}
}
export function sampleKiss(input,{objectSlot,impact,separated,time}){const s=words(input),t=timeWords(time);uint(objectSlot,'objectSlot');if(objectSlot>2)throw new RangeError('Exactly three cue/object pairs required');bool(impact,'impact');bool(separated,'separated');if(s[L.status]!==S.running||has(s,F.goalLatched))return;const bit=1<<objectSlot;if(separated)s[L.kissActive]&=~bit;if(impact&&!(s[L.kissActive]&bit)){if(s[L.kissSeen]&bit){if(!has(s,F.kiss)){s[L.firstKissLo]=t[0];s[L.firstKissHi]=t[1];}set(s,F.kiss);}s[L.kissSeen]|=bit;s[L.kissActive]|=bit;}}
function popcount(x){let n=0;for(;x;x&=x-1)n++;return n;}
function evaluateRoute(s){const m=s[L.method],first=has(s,F.firstSeen)&&!has(s,F.wrong),complete=has(s,F.complete)&&!has(s,F.wrong),before=s[L.before],after=s[L.after],total=s[L.rails];let bad=has(s,F.wrong|F.ambiguous);const prefix=m===M.bank1?1:m===M.bank2?2:m===M.bank3?3:m===M.allWalls?4:[M.direct,M.turn,M.grand,M.return,M.cross].includes(m)?0:-1;
 if(m===M.direct&&total>0)bad=true;if(!first&&prefix>=0&&m!==M.allWalls&&before>prefix)bad=true;if(first&&prefix>=0){if(m===M.allWalls){if(popcount(s[L.preMask])!==4)bad=true;}else if(before!==prefix)bad=true;}if((m===M.bank3||m===M.allWalls)&&first&&after>0)bad=true;
 let condition=true;if(m===M.direct)condition=total===0;else if(m===M.turn)condition=before===0&&after>=3&&popcount(s[L.firstThreeMask])===3;else if(m===M.grand)condition=before===0&&after>=4&&popcount(s[L.postMask])>=3;else if(m===M.return)condition=before===0&&!!s[L.returning];else if(m===M.cross)condition=before===0&&after>=3&&[s[L.after0],s[L.after1],s[L.after2]].every(x=>x===3||x===4)&&s[L.after0]!==s[L.after1]&&s[L.after0]===s[L.after2];else if(m===M.bank1)condition=before===1;else if(m===M.bank2)condition=before===2;else if(m===M.bank3)condition=before===3&&after===0;else if(m===M.allWalls)condition=before>=4&&popcount(s[L.preMask])===4&&after===0;
 const required=Math.max((s[L.options]&1)?3:0,m===M.direct||m===M.carom?0:3),success=complete&&!bad&&total>=required&&condition;if(complete&&!success)bad=true;s[L.flags]&=~(F.success|F.invalid);if(success)set(s,F.success);if(bad)set(s,F.invalid);
}
function failure(s){return has(s,F.cueObstructed)?R.cueObstruction:has(s,F.foul)?R.foul:has(s,F.ambiguous)?R.ambiguous:has(s,F.invalid)?has(s,F.kiss)&&!(s[L.options]&2)?R.kiss:R.invalidRoute:!has(s,F.firstSeen)||has(s,F.wrong)?R.firstNotHit:s[L.rails]<((s[L.options]&1)?3:0)?R.insufficientCushions:R.secondNotHit;}
export function finishOuter(input,{cuePresent,allSleeping,opponentImpulse,offTable,finitePosition,firstKissBeforeGoal}){const s=words(input);for(const[k,v]of Object.entries({cuePresent,allSleeping,opponentImpulse,offTable,finitePosition,firstKissBeforeGoal}))bool(v,k);if(s[L.status]!==S.running)return s[L.status];if(!inc(s,L.steps))return s[L.status];if(!finitePosition)return terminal(s,S.failed,R.nonfinite);if(opponentImpulse||offTable)set(s,F.foul|F.invalid);if(!cuePresent&&allSleeping)set(s,F.gameFinished);
 if(!has(s,F.goalLatched)){if(s[L.method]!==M.none&&s[L.pending])evaluateRoute(s);if(has(s,F.cueObstructed|F.foul))set(s,F.invalid);if(!(s[L.options]&2)&&has(s,F.kiss)&&(!has(s,F.success)||firstKissBeforeGoal))set(s,F.invalid);if(has(s,F.success)&&!has(s,F.invalid))set(s,F.goalLatched);}
 s[L.pending]=0;s[L.groupOpen]=0;s[L.groupMask]=0;
 if(has(s,F.invalid))return terminal(s,S.miss,failure(s));if(!cuePresent&&allSleeping){set(s,F.gameFinished);return terminal(s,has(s,F.success)?S.pass:S.miss,has(s,F.success)?R.none:failure(s));}
 if(s[L.steps]>=s[L.maxSteps]){if(has(s,F.goalLatched)){set(s,F.invalid);return terminal(s,S.incomplete,R.horizon);}return terminal(s,S.miss,failure(s));}return S.running;
}
export function invalidateRules(input,status='unsupported',reason='contract'){const s=words(input);if(!['unsupported','cancelled','failed'].includes(status)||!Object.hasOwn(R,reason))throw new RangeError('Explicit non-physical terminal status required');return terminal(s,S[status],R[reason]);}

export function ruleTerminalRow(input,candidateId){const s=words(input);uint(candidateId,'candidateId');const status=s[L.status],pass=status===S.pass?1:status===S.miss?0:UNSET;const reason=status===S.unsupported?(s[L.reason]===R.overflow?ABI_REASON.CAPACITY:ABI_REASON.PHYSICS_SCOPE):status===S.incomplete?ABI_REASON.HORIZON:status===S.cancelled?ABI_REASON.CANCELLED:status===S.failed?ABI_REASON.NUMERIC:ABI_REASON.NONE;return Uint32Array.of(candidateId,status,pass,reason);}

/** Source-ordered discrete reducer. The embedding kernel declares
 * `var<storage,read_write> rc_state:array<u32>;` and passes an absolute WORD
 * offset to a RULE_WORDS region. Independent candidates never alias regions.
 * No workgroup barrier is necessary when one invocation owns one candidate.
 * Native-filter flags: started=1,movingBall=2,clothEarly=4,clothOrFloorSlow=8.
 * Outer flags: finite=1,cuePresent=2,allSleeping=4,opponentImpulse=8,
 * offTable=16,firstKissBeforeGoal=32. All are mandatory exact-source predicates.
 */
export function generatePhysicalRulesWGSL(){
 const constants=[...Object.entries(L).map(([k,v])=>`const RCR_L_${k}:u32=${v}u;`),...Object.entries(S).map(([k,v])=>`const RCR_S_${k}:u32=${v}u;`),...Object.entries(R).map(([k,v])=>`const RCR_R_${k}:u32=${v}u;`),...Object.entries(F).map(([k,v])=>`const RCR_F_${k}:u32=${v}u;`),...Object.entries(M).map(([k,v])=>`const RCR_M_${k}:u32=${v}u;`)].join('\n');
 return `${constants}
fn rc_rule_get(b:u32,k:u32)->u32{return rc_state[b+k];}
fn rc_rule_put(b:u32,k:u32,v:u32){rc_state[b+k]=v;}
fn rc_rule_has(b:u32,f:u32)->bool{return (rc_state[b+RCR_L_flags]&f)!=0u;}
fn rc_rule_set(b:u32,f:u32){rc_state[b+RCR_L_flags]|=f;}
fn rc_rule_terminal(b:u32,status:u32,reason:u32)->u32{rc_state[b+RCR_L_status]=status;rc_state[b+RCR_L_reason]=reason;return status;}
fn rc_rule_inc(b:u32,k:u32)->bool{if(rc_state[b+k]==0xffffffffu){rc_rule_terminal(b,RCR_S_unsupported,RCR_R_overflow);return false;}rc_state[b+k]++;return true;}
fn rc_rules_init(b:u32,cue:u32,first:u32,second:u32,opponent:u32,method:u32,options:u32,maxSteps:u32){
 for(var i=0u;i<${RULE_WORDS}u;i++){rc_state[b+i]=0u;}
 rc_state[b+RCR_L_version]=1u;rc_state[b+RCR_L_status]=RCR_S_running;rc_state[b+RCR_L_method]=method;rc_state[b+RCR_L_options]=options;rc_state[b+RCR_L_maxSteps]=maxSteps;rc_state[b+RCR_L_gameGoalCushions]=0xffffffffu;
 rc_state[b+RCR_L_cueId]=cue;rc_state[b+RCR_L_firstId]=first;rc_state[b+RCR_L_secondId]=second;rc_state[b+RCR_L_opponentId]=opponent;
 if(method>RCR_M_allWalls||options>3u||maxSteps==0u||cue==first||cue==second||cue==opponent||first==second||first==opponent||second==opponent){rc_rule_terminal(b,RCR_S_unsupported,RCR_R_contract);}
}
fn rc_rules_append_history(b:u32,pairId:u32,time:vec2<u32>){let slot=rc_state[b+RCR_L_ringHead];let at=b+RCR_L_ring+slot*4u;rc_state[at]=pairId;rc_state[at+1u]=time.x;rc_state[at+2u]=time.y;rc_state[at+3u]=1u;rc_state[b+RCR_L_ringHead]=(slot+1u)%8u;rc_state[b+RCR_L_ringCount]=min(8u,rc_state[b+RCR_L_ringCount]+1u);}
fn rc_rules_append_nonkey_history(b:u32,time:vec2<u32>){let slot=rc_state[b+RCR_L_ringHead];rc_rules_append_history(b,0u,time);rc_state[b+RCR_L_ring+slot*4u+3u]=0u;}
fn rc_rules_filter_native(b:u32,pairId:u32,time:vec2<u32>,flags:u32,recentMask:u32)->bool{
 if(rc_state[b+RCR_L_status]!=RCR_S_running||(flags&3u)!=3u||(flags&12u)!=0u){return false;}
 if(recentMask>255u||flags>15u){rc_rule_terminal(b,RCR_S_unsupported,RCR_R_contract);return false;}
 for(var i=0u;i<8u;i++){let at=b+RCR_L_ring+i*4u;if(rc_state[at+3u]!=0u&&rc_state[at]==pairId&&(recentMask&(1u<<i))!=0u){return false;}}
 rc_rules_append_history(b,pairId,time);return true;
}
fn rc_rule_game_event(b:u32,kind:u32,id:u32){
 if(kind==1u){rc_rule_inc(b,RCR_L_gameCushions);}
 if(kind==2u){if(id==rc_state[b+RCR_L_firstId]){rc_state[b+RCR_L_gameReds]|=1u;}if(id==rc_state[b+RCR_L_secondId]){rc_state[b+RCR_L_gameReds]|=2u;}if(rc_state[b+RCR_L_gameReds]==3u&&rc_state[b+RCR_L_gameGoalCushions]==0xffffffffu){rc_state[b+RCR_L_gameGoalCushions]=rc_state[b+RCR_L_gameCushions];}}
 if(kind==3u||(kind==2u&&id==rc_state[b+RCR_L_opponentId])){rc_rule_set(b,RCR_F_foul|RCR_F_invalid);}
}
fn rc_rule_goal(b:u32,t:vec2<u32>){rc_rule_set(b,RCR_F_success|RCR_F_complete);rc_state[b+RCR_L_hitRails]=rc_state[b+RCR_L_rails];rc_state[b+RCR_L_hitTimeLo]=t.x;rc_state[b+RCR_L_hitTimeHi]=t.y;}
fn rc_rule_add_rail(b:u32,rail:u32){
 if(!rc_rule_inc(b,RCR_L_rails)){return;}
 if(!rc_rule_has(b,RCR_F_firstSeen)){rc_rule_inc(b,RCR_L_before);if(rail!=0u){rc_state[b+RCR_L_preMask]|=1u<<(rail-1u);}return;}
 let n=rc_state[b+RCR_L_after];rc_rule_inc(b,RCR_L_after);if(rail!=0u){rc_state[b+RCR_L_postMask]|=1u<<(rail-1u);}if(n<3u){rc_state[b+RCR_L_after0+n]=rail;if(rail!=0u){rc_state[b+RCR_L_firstThreeMask]|=1u<<(rail-1u);}}
 if(n>=2u&&rail!=0u&&rail==rc_state[b+RCR_L_last0]&&rail!=rc_state[b+RCR_L_last1]){rc_state[b+RCR_L_returning]=1u;}rc_state[b+RCR_L_last0]=rc_state[b+RCR_L_last1];rc_state[b+RCR_L_last1]=rail;
}
fn rc_rules_event(b:u32,kind:u32,id:u32,rail:u32,t:vec2<u32>,sameGroup:bool){
 if(rc_state[b+RCR_L_status]!=RCR_S_running){return;}if(kind>4u||rail>4u){rc_rule_terminal(b,RCR_S_unsupported,RCR_R_contract);return;}
 if(kind==4u){rc_rule_set(b,RCR_F_cueObstructed|RCR_F_invalid);return;}if(kind==0u){return;}rc_rule_game_event(b,kind,id);if(rc_state[b+RCR_L_status]!=RCR_S_running||rc_rule_has(b,RCR_F_goalLatched)||kind==3u){return;}
 let first=rc_state[b+RCR_L_firstId];let second=rc_state[b+RCR_L_secondId];let opponent=rc_state[b+RCR_L_opponentId];
 if(kind==2u&&id!=first&&id!=second&&id!=opponent){rc_rule_terminal(b,RCR_S_unsupported,RCR_R_contract);return;}
 if(rc_state[b+RCR_L_method]==RCR_M_none){if(kind==1u){rc_rule_inc(b,RCR_L_rails);return;}if(!rc_rule_has(b,RCR_F_firstSeen)){if(id!=first){rc_rule_set(b,RCR_F_invalid);return;}rc_rule_set(b,RCR_F_firstSeen);}else if(id==second){if(rc_state[b+RCR_L_rails]>=select(0u,3u,(rc_state[b+RCR_L_options]&1u)!=0u)){rc_rule_goal(b,t);}else{rc_rule_set(b,RCR_F_invalid);}}else if(id!=first){rc_rule_set(b,RCR_F_invalid);}return;}
 rc_state[b+RCR_L_pending]=1u;if(rc_state[b+RCR_L_groupOpen]==0u||!sameGroup){rc_state[b+RCR_L_groupMask]=0u;rc_state[b+RCR_L_groupTimeLo]=t.x;rc_state[b+RCR_L_groupTimeHi]=t.y;rc_state[b+RCR_L_groupOpen]=1u;}
 var bit=4u;if(kind==1u){bit=1u<<(4u+rail);}else if(id==first){bit=1u;}else if(id==second){bit=2u;}
 let old=rc_state[b+RCR_L_groupMask];if((kind==1u&&(old&7u)!=0u)||(kind!=1u&&((old&496u)!=0u||((old&7u)&~bit)!=0u))){rc_rule_set(b,RCR_F_ambiguous);}
 if((old&bit)!=0u){return;}rc_state[b+RCR_L_groupMask]=old|bit;if(rc_rule_has(b,RCR_F_complete)){return;}
 if(kind==1u){rc_rule_add_rail(b,rail);return;}if(!rc_rule_has(b,RCR_F_firstSeen)){rc_rule_set(b,RCR_F_firstSeen);if(id!=first){rc_rule_set(b,RCR_F_wrong);}}else if(!rc_rule_has(b,RCR_F_wrong)){if(id==second){rc_rule_set(b,RCR_F_complete);rc_state[b+RCR_L_hitTimeLo]=t.x;rc_state[b+RCR_L_hitTimeHi]=t.y;rc_state[b+RCR_L_hitRails]=rc_state[b+RCR_L_rails];}else if(id!=first){rc_rule_set(b,RCR_F_wrong);}}
}
fn rc_rules_sample_kiss(b:u32,objectSlot:u32,impact:bool,separated:bool,t:vec2<u32>){
 if(rc_state[b+RCR_L_status]!=RCR_S_running||rc_rule_has(b,RCR_F_goalLatched)){return;}if(objectSlot>2u){rc_rule_terminal(b,RCR_S_unsupported,RCR_R_contract);return;}let bit=1u<<objectSlot;
 if(separated){rc_state[b+RCR_L_kissActive]&=~bit;}if(impact&&(rc_state[b+RCR_L_kissActive]&bit)==0u){if((rc_state[b+RCR_L_kissSeen]&bit)!=0u){if(!rc_rule_has(b,RCR_F_kiss)){rc_state[b+RCR_L_firstKissLo]=t.x;rc_state[b+RCR_L_firstKissHi]=t.y;}rc_rule_set(b,RCR_F_kiss);}rc_state[b+RCR_L_kissSeen]|=bit;rc_state[b+RCR_L_kissActive]|=bit;}
}
fn rc_rule_evaluate(b:u32){
 let m=rc_state[b+RCR_L_method];let first=rc_rule_has(b,RCR_F_firstSeen)&&!rc_rule_has(b,RCR_F_wrong);let complete=rc_rule_has(b,RCR_F_complete)&&!rc_rule_has(b,RCR_F_wrong);let before=rc_state[b+RCR_L_before];let after=rc_state[b+RCR_L_after];let total=rc_state[b+RCR_L_rails];var bad=rc_rule_has(b,RCR_F_wrong|RCR_F_ambiguous);var prefix=-1;
 if(m==RCR_M_bank1){prefix=1;}else if(m==RCR_M_bank2){prefix=2;}else if(m==RCR_M_bank3){prefix=3;}else if(m==RCR_M_allWalls){prefix=4;}else if(m==RCR_M_direct||m==RCR_M_turn||m==RCR_M_grand||m==RCR_M_return||m==RCR_M_cross){prefix=0;}
 if(m==RCR_M_direct&&total>0u){bad=true;}if(!first&&prefix>=0&&m!=RCR_M_allWalls&&before>u32(prefix)){bad=true;}if(first&&prefix>=0){if(m==RCR_M_allWalls){if(countOneBits(rc_state[b+RCR_L_preMask])!=4u){bad=true;}}else if(before!=u32(prefix)){bad=true;}}
 if((m==RCR_M_bank3||m==RCR_M_allWalls)&&first&&after>0u){bad=true;}
 var condition=true;
 if(m==RCR_M_direct){condition=total==0u;}
 else if(m==RCR_M_turn){condition=before==0u&&after>=3u&&countOneBits(rc_state[b+RCR_L_firstThreeMask])==3u;}
 else if(m==RCR_M_grand){condition=before==0u&&after>=4u&&countOneBits(rc_state[b+RCR_L_postMask])>=3u;}
 else if(m==RCR_M_return){condition=before==0u&&rc_state[b+RCR_L_returning]!=0u;}
 else if(m==RCR_M_cross){let a=rc_state[b+RCR_L_after0];let c=rc_state[b+RCR_L_after1];let d=rc_state[b+RCR_L_after2];condition=before==0u&&after>=3u&&(a==3u||a==4u)&&(c==3u||c==4u)&&(d==3u||d==4u)&&a!=c&&a==d;}
 else if(m==RCR_M_bank1){condition=before==1u;}else if(m==RCR_M_bank2){condition=before==2u;}else if(m==RCR_M_bank3){condition=before==3u&&after==0u;}else if(m==RCR_M_allWalls){condition=before>=4u&&countOneBits(rc_state[b+RCR_L_preMask])==4u&&after==0u;}
 let required=max(select(0u,3u,(rc_state[b+RCR_L_options]&1u)!=0u),select(3u,0u,m==RCR_M_direct||m==RCR_M_carom));let success=complete&&!bad&&total>=required&&condition;if(complete&&!success){bad=true;}rc_state[b+RCR_L_flags]&=~(RCR_F_success|RCR_F_invalid);if(success){rc_rule_set(b,RCR_F_success);}if(bad){rc_rule_set(b,RCR_F_invalid);}
}
fn rc_rule_failure(b:u32)->u32{
 if(rc_rule_has(b,RCR_F_cueObstructed)){return RCR_R_cueObstruction;}if(rc_rule_has(b,RCR_F_foul)){return RCR_R_foul;}if(rc_rule_has(b,RCR_F_ambiguous)){return RCR_R_ambiguous;}if(rc_rule_has(b,RCR_F_invalid)){if(rc_rule_has(b,RCR_F_kiss)&&(rc_state[b+RCR_L_options]&2u)==0u){return RCR_R_kiss;}return RCR_R_invalidRoute;}if(!rc_rule_has(b,RCR_F_firstSeen)||rc_rule_has(b,RCR_F_wrong)){return RCR_R_firstNotHit;}if(rc_state[b+RCR_L_rails]<select(0u,3u,(rc_state[b+RCR_L_options]&1u)!=0u)){return RCR_R_insufficientCushions;}return RCR_R_secondNotHit;
}
fn rc_rules_finish_outer(b:u32,flags:u32)->u32{
 if(rc_state[b+RCR_L_status]!=RCR_S_running){return rc_state[b+RCR_L_status];}if(flags>63u){return rc_rule_terminal(b,RCR_S_unsupported,RCR_R_contract);}if(!rc_rule_inc(b,RCR_L_steps)){return rc_state[b+RCR_L_status];}
 if((flags&1u)==0u){return rc_rule_terminal(b,RCR_S_failed,RCR_R_nonfinite);}let cue=(flags&2u)!=0u;let sleeping=(flags&4u)!=0u;if((flags&24u)!=0u){rc_rule_set(b,RCR_F_foul|RCR_F_invalid);}if(!cue&&sleeping){rc_rule_set(b,RCR_F_gameFinished);}
 if(!rc_rule_has(b,RCR_F_goalLatched)){if(rc_state[b+RCR_L_method]!=RCR_M_none&&rc_state[b+RCR_L_pending]!=0u){rc_rule_evaluate(b);}if(rc_rule_has(b,RCR_F_cueObstructed|RCR_F_foul)){rc_rule_set(b,RCR_F_invalid);}if((rc_state[b+RCR_L_options]&2u)==0u&&rc_rule_has(b,RCR_F_kiss)&&(!rc_rule_has(b,RCR_F_success)||(flags&32u)!=0u)){rc_rule_set(b,RCR_F_invalid);}if(rc_rule_has(b,RCR_F_success)&&!rc_rule_has(b,RCR_F_invalid)){rc_rule_set(b,RCR_F_goalLatched);}}
 rc_state[b+RCR_L_pending]=0u;rc_state[b+RCR_L_groupOpen]=0u;rc_state[b+RCR_L_groupMask]=0u;
 if(rc_rule_has(b,RCR_F_invalid)){return rc_rule_terminal(b,RCR_S_miss,rc_rule_failure(b));}if(!cue&&sleeping){if(rc_rule_has(b,RCR_F_success)){return rc_rule_terminal(b,RCR_S_pass,RCR_R_none);}return rc_rule_terminal(b,RCR_S_miss,rc_rule_failure(b));}
 if(rc_state[b+RCR_L_steps]>=rc_state[b+RCR_L_maxSteps]){if(rc_rule_has(b,RCR_F_goalLatched)){rc_rule_set(b,RCR_F_invalid);return rc_rule_terminal(b,RCR_S_incomplete,RCR_R_horizon);}return rc_rule_terminal(b,RCR_S_miss,rc_rule_failure(b));}return RCR_S_running;
}
fn rc_rules_result(b:u32,candidateId:u32)->vec4<u32>{
 let status=rc_state[b+RCR_L_status];var passFlag=0xffffffffu;if(status==RCR_S_pass){passFlag=1u;}else if(status==RCR_S_miss){passFlag=0u;}
 var reason=${ABI_REASON.NONE}u;if(status==RCR_S_unsupported){reason=select(${ABI_REASON.PHYSICS_SCOPE}u,${ABI_REASON.CAPACITY}u,rc_state[b+RCR_L_reason]==RCR_R_overflow);}else if(status==RCR_S_incomplete){reason=${ABI_REASON.HORIZON}u;}else if(status==RCR_S_cancelled){reason=${ABI_REASON.CANCELLED}u;}else if(status==RCR_S_failed){reason=${ABI_REASON.NUMERIC}u;}
 return vec4<u32>(candidateId,status,passFlag,reason);
}
`;
}
