// SPDX-License-Identifier: Apache-2.0
// Optional HOST contract/codec only. No GPU accumulator, physical evaluator,
// solver adapter, backend activation, or candidate generation exists here.
import {createHash} from './source-sha256.mjs';
import {isOwnedUint32Array} from './abi.mjs';
export const INVERSE_TERMINAL_ABI=Object.freeze({kind:'resident-inverse-terminal-observation-v1',version:1,magic:0x5243494f,words:64,bytes:256,
  residualCount:3,inequalityCount:9,offsets:Object.freeze({magic:0,version:1,id:2,status:3,reason:4,purpose:5,flags:6,stageKind:7,stage:8,eventPrefix:9,steps:10,boundary:11,contractSha256:12,residuals:20,inequalities:26,clearance:44,cellObjectId:46,cellStepDt:48,cellRoundedTime:50,reserved:52})});
export const INVERSE_STATUS=Object.freeze({evaluated:1,unsupported:2,incomplete:3,cancelled:4,stale:5,failed:6});
export const INVERSE_REASON=Object.freeze({none:0,'missing-target':1,'missing-cushion-geometry':2,'unsupported-scope':3,'unsupported-numeric':4,capacity:5,'transport-budget':6,'physical-verification-incomplete':7,cancelled:8,'stale-source':9,'device-lost':10,'execution-error':11});
export const INVERSE_BOUNDARY=Object.freeze({none:0,'initial-clearance':1,'physical-stop':2,'full-rest':3,'horizon-probe':4});
const PURPOSE=Object.freeze({evaluate:1,residual:2,jacobian:3,trial:4,verify:5,clearance:6});
const FIELDS=Object.freeze(['residuals','inequalities','residualAvailable','residualStage','eventPrefix','contactCell','clearance','goalVerified','verified','unsupported','steps','purpose']);
const need=(ok,message)=>{if(!ok)throw new RangeError('Inverse terminal contract: '+message);};
const own=(x,keys)=>{need(x&&Object.getPrototypeOf(x)===Object.prototype,'plain data object required');const d=Object.getOwnPropertyDescriptors(x);need(Reflect.ownKeys(d).length===keys.length&&keys.every(k=>d[k]&&'value'in d[k]),'exact fields '+keys.join(','));};
const uint=x=>Number.isInteger(x)&&x>=0&&x<0xffffffff;
const vector=(a,n,p)=>Array.isArray(a)&&a.length===n&&Array.from({length:n},(_,i)=>Object.getOwnPropertyDescriptor(a,i)).every(d=>d&&'value'in d&&p(d.value));
const hash=x=>createHash('sha256').update(x).digest('hex');
const sha=x=>need(typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),'SHA256 identity required');
const numberBits=x=>{const v=new DataView(new ArrayBuffer(8));v.setFloat64(0,x,true);return Array.from(new Uint8Array(v.buffer),b=>b.toString(16).padStart(2,'0')).join('');};
const canonical=x=>typeof x==='number'?['f64',numberBits(x)]:Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const invert=t=>Object.fromEntries(Object.entries(t).map(([k,v])=>[v,k]));
const STATUS_NAME=invert(INVERSE_STATUS),REASON_NAME=invert(INVERSE_REASON),BOUNDARY_NAME=invert(INVERSE_BOUNDARY),PURPOSE_NAME=invert(PURPOSE);
const settingsKeys=['angle','elevation','speed','tipX','tipY'];

/** Initial-only source/request/candidate identity. Digests are caller-bound
 * source artifacts, not proof a GPU produced any observations. Owns a frozen
 * copy; no expected future outputs may be included. */
export function createInverseTerminalContract(input){
  own(input,['sourceSha256','initialSnapshotSha256','requestSha256','generationId','gameMode','mode','requiresFullRest','candidates']);
  for(const k of ['sourceSha256','initialSnapshotSha256','requestSha256'])sha(input[k]);
  need(typeof input.generationId==='string'&&input.generationId.length>0&&input.generationId.length<=256,'bounded generation identity');need(['four','free'].includes(input.gameMode)&&['carom','three','target','direct'].includes(input.mode),'explicit original game/search mode');
  need(input.gameMode!=='four'||input.mode==='carom','initial four-ball contract is carom only');
  need(input.requiresFullRest===(input.gameMode==='four'),'full-shot policy derives from original fullShot(gameMode), never an independent toggle');
  need(Array.isArray(input.candidates)&&input.candidates.length>0&&input.candidates.length<=4096,'bounded candidate roster, not qualified capacity');
  const ids=new Set();for(const c of input.candidates){own(c,['id','purpose','topologyId','topologyLength','settings']);need(uint(c.id)&&!ids.has(c.id),'distinct original candidate IDs');ids.add(c.id);need(Object.hasOwn(PURPOSE,c.purpose),'original inverse purpose');need(typeof c.topologyId==='string'&&c.topologyId.length>0&&c.topologyId.length<=4096,'topology identity');need(uint(c.topologyLength)&&c.topologyLength>0,'positive topology length');own(c.settings,settingsKeys);need(settingsKeys.every(k=>Number.isFinite(c.settings[k])),'unchanged finite source settings');}
  const identity=structuredClone(input),contractSha256=hash(JSON.stringify(canonical(identity)));
  return freeze({kind:INVERSE_TERMINAL_ABI.kind,version:1,identity,contractSha256});
}
function contract(c){own(c,['kind','version','identity','contractSha256']);need(c.kind===INVERSE_TERMINAL_ABI.kind&&c.version===1,'known contract');const rebuilt=createInverseTerminalContract(c.identity);need(c.contractSha256===rebuilt.contractSha256,'unchanged entire initial identity');return rebuilt;}
export function inverseTerminalObservationScope(context){const c=contract(context);return freeze({gameMode:c.identity.gameMode,mode:c.identity.mode,requiresFullRest:c.identity.requiresFullRest,qualificationScope:c.identity.gameMode==='four'?'original-full-shot-search-query':'original-early-search-query-only',finalGameplayQualified:false,gpuProducerImplemented:false});}
function cell(value){
  if(value===null)return null;
  need(typeof value==='string','nullable exact source contact-cell string');let a;try{a=JSON.parse(value);}catch{need(false,'malformed contact cell');}
  need(Array.isArray(a)&&a.length===3&&uint(a[0])&&Number.isFinite(a[1])&&a[1]>0&&Number.isSafeInteger(a[2])&&a[2]>=0,'exact first-object, stepDt, rounded-time tuple');need(JSON.stringify(a)===value,'canonical original JSON.stringify contact cell');return a;
}
function observation(o,c){
  own(o,FIELDS);need(o.purpose===c.purpose,'original candidate purpose');
  need(vector(o.residuals,3,Number.isFinite),'three genuine finite source residuals');
  // Original rows() rejects nonfinite inequalities; transport MUST preserve
  // them for that rejection, not clamp/zero/coerce them into a feasible probe.
  need(vector(o.inequalities,9,x=>typeof x==='number'),'nine source Number inequalities');
  need(typeof o.residualAvailable==='boolean'&&typeof o.goalVerified==='boolean'&&typeof o.verified==='boolean'&&o.unsupported===false,'evaluated source flags; unsupported uses its own transport');
  need(o.clearance===null||typeof o.clearance==='number','source nullable Number clearance');
  need(o.residualStage==='clearance'||uint(o.residualStage)&&o.residualStage<=c.topologyLength,'source stage index or clearance');need(uint(o.eventPrefix)&&o.eventPrefix<=c.topologyLength&&uint(o.steps),'source prefix and outer step count');
  if(o.residualStage!=='clearance')need(o.residualStage===o.eventPrefix,'original active stage equals prefix');
  if(!o.residualAvailable)need(o.residuals.every(x=>Object.is(x,0)),'only original unavailable carrier zeros; never a root');
  if(o.goalVerified)need(o.residualAvailable&&o.eventPrefix===c.topologyLength&&o.residualStage===c.topologyLength&&o.residuals.every(x=>Object.is(x,0))&&o.inequalities.every(x=>Number.isFinite(x)&&x<=0),'original goal projection conditions');
  need(o.verified===(c.purpose==='verify'&&o.goalVerified),'verification is explicit verify purpose only');return cell(o.contactCell);
}
/** Copy only fields actually consumed by current solver/planner accounting.
 * This does NOT evaluate residuals or convert id/pass into solver observations.
 * Unsupported and incomplete source results require explicit outer transport.
 */
export function selectSourceInverseTerminalObservation(outcome){
  need(outcome&&typeof outcome==='object','original detailed terminal result required');
  need(!Object.hasOwn(outcome,'finalization')&&!Object.hasOwn(outcome,'routeQueryPhysicalResult'),'final-gameplay policy requires a versioned/profile-bound observation contract; v1 is legacy source-query only');
  need(!outcome.unsupported,'source unavailable is unsupported, not evaluated');
  need(!['four-ball-shot-incomplete','cue-tail-incomplete'].includes(outcome.physicalResult?.failureReason),'unfinished physical verification is incomplete, not a negative result');
  for(const k of ['reason','verification','physicalGoal'])need(!Object.hasOwn(outcome,k),'source consumer field '+k+' requires a versioned contract extension');
  return structuredClone(Object.fromEntries(FIELDS.map(k=>[k,outcome[k]])));
}
function row(r,c,identity){
  own(r,['id','status','reason','boundary','observation']);need(r.id===c.id,'exact original row order/id');need(Object.hasOwn(INVERSE_STATUS,r.status)&&Object.hasOwn(INVERSE_REASON,r.reason)&&Object.hasOwn(INVERSE_BOUNDARY,r.boundary),'explicit known status/reason/boundary');
  if(r.status!=='evaluated'){
    need(r.observation===null,'unevaluated records carry no solver values');need(r.boundary==='none','no physical completion claim for unevaluated row');
    const allowed={unsupported:['missing-target','missing-cushion-geometry','unsupported-scope','unsupported-numeric','capacity'],incomplete:['transport-budget','physical-verification-incomplete'],cancelled:['cancelled'],stale:['stale-source'],failed:['device-lost','execution-error']};need(allowed[r.status].includes(r.reason),'reason matches distinct unevaluated status');return null;
  }
  need(r.reason==='none'&&r.boundary!=='none','evaluated original boundary required');const first=observation(r.observation,c);
  const o=r.observation;
  if(r.boundary==='initial-clearance')need(o.residualStage==='clearance'&&o.steps===0&&!o.goalVerified&&!o.verified&&o.contactCell===null,'initial-only clearance boundary');
  else need(o.residualStage!=='clearance'&&c.purpose!=='clearance','physical source boundary');
  if(r.boundary==='horizon-probe')need(c.purpose!=='verify'&&!o.goalVerified&&!o.verified,'unfinished verify horizon is incomplete; horizon probes never certify');
  if(identity.gameMode==='free')need(r.boundary!=='full-rest','non-four source-query values cannot claim full-rest or final gameplay');
  if(identity.requiresFullRest&&o.goalVerified)need(r.boundary==='full-rest','four-ball successful goal waits through actual full rest');
  return first;
}
function ownedWords(words,count){need(isOwnedUint32Array(words)&&words.length===count*64,'complete detached fixed-width observation bank');}
export function packInverseTerminalObservations(context,rows){
  const c=contract(context);need(Array.isArray(rows)&&rows.length===c.identity.candidates.length,'complete explicit observation roster');
  const words=new Uint32Array(rows.length*64),view=new DataView(words.buffer),f64=(at,v)=>view.setFloat64(at*4,v,true);
  rows.forEach((r,i)=>{const candidate=c.identity.candidates[i],first=row(r,candidate,c.identity),b=i*64;
    words.set([INVERSE_TERMINAL_ABI.magic,1,r.id,INVERSE_STATUS[r.status],INVERSE_REASON[r.reason],PURPOSE[candidate.purpose]],b);words[b+11]=INVERSE_BOUNDARY[r.boundary];
    for(let k=0;k<8;k++)words[b+12+k]=parseInt(c.contractSha256.slice(k*8,k*8+8),16);
    if(r.status!=='evaluated')return;
    const o=r.observation;words[b+6]=(o.residualAvailable?1:0)|(o.clearance!==null?2:0)|(first?4:0)|(o.goalVerified?8:0)|(o.verified?16:0);words[b+7]=o.residualStage==='clearance'?1:0;words[b+8]=o.residualStage==='clearance'?0:o.residualStage;words[b+9]=o.eventPrefix;words[b+10]=o.steps;
    o.residuals.forEach((v,j)=>f64(b+20+j*2,v));o.inequalities.forEach((v,j)=>f64(b+26+j*2,v));if(o.clearance!==null)f64(b+44,o.clearance);if(first){words[b+46]=first[0];f64(b+48,first[1]);f64(b+50,first[2]);}
  });return words;
}
export function decodeInverseTerminalObservations(context,words){
  const c=contract(context);ownedWords(words,c.identity.candidates.length);const view=new DataView(words.buffer,words.byteOffset,words.byteLength),f64=at=>view.getFloat64(at*4,true);
  return c.identity.candidates.map((candidate,i)=>{const b=i*64;need(words[b]===INVERSE_TERMINAL_ABI.magic&&words[b+1]===1&&words[b+2]===candidate.id&&words[b+5]===PURPOSE[candidate.purpose],'record magic/version/id/purpose');
    for(let k=0;k<8;k++)need(words[b+12+k]===parseInt(c.contractSha256.slice(k*8,k*8+8),16),'entire source/request/candidate contract binding');
    need(words[b+47]===0&&words.slice(b+52,b+64).every(x=>x===0),'reserved words zero');const status=STATUS_NAME[words[b+3]],reason=REASON_NAME[words[b+4]],boundary=BOUNDARY_NAME[words[b+11]];let o=null;
    if(status==='evaluated'){
      const flags=words[b+6];need((flags&~31)===0&&words[b+7]<=1,'known flags/stage');need(words[b+7]===0||words[b+8]===0,'canonical clearance index');
      if(!(flags&2))need(words[b+44]===0&&words[b+45]===0,'absent clearance has no payload');if(!(flags&4))need([46,48,49,50,51].every(k=>words[b+k]===0),'absent contact cell has no payload');
      o={residuals:Array.from({length:3},(_,j)=>f64(b+20+2*j)),inequalities:Array.from({length:9},(_,j)=>f64(b+26+2*j)),residualAvailable:!!(flags&1),residualStage:words[b+7]?'clearance':words[b+8],eventPrefix:words[b+9],contactCell:flags&4?JSON.stringify([words[b+46],f64(b+48),f64(b+50)]):null,clearance:flags&2?f64(b+44):null,goalVerified:!!(flags&8),verified:!!(flags&16),unsupported:false,steps:words[b+10],purpose:candidate.purpose};
    }else need([...words.slice(b+6,b+11),...words.slice(b+20,b+52)].every(x=>x===0),'unevaluated payload must remain absent');
    const result={id:candidate.id,status,reason,boundary,observation:o};row(result,candidate,c.identity);return freeze(result);
  });
}
/** Comparison-only winner artifact seam. It performs NO replay and returns no
 * substitute physical result. Caller must already hold genuine independent GPU
 * qualification; this host equality check does not grant that authority. */
export function assertInverseWinnerReplayAgreement({context,words,id,replay}){
  const c=contract(context),rows=decodeInverseTerminalObservations(c,words),i=c.identity.candidates.findIndex(x=>x.id===id);need(i>=0,'known winner ID');const candidate=c.identity.candidates[i],r=rows[i];
  need(r.status==='evaluated'&&candidate.purpose==='verify'&&r.observation.goalVerified&&r.observation.verified,'only already verified winner values eligible for display replay');if(c.identity.requiresFullRest)need(r.boundary==='full-rest','winner full rest');
  own(replay,['sourceSha256','initialSnapshotSha256','requestSha256','generationId','candidateId','outcome','wallMs']);for(const k of ['sourceSha256','initialSnapshotSha256','requestSha256','generationId'])need(replay[k]===c.identity[k],'replay source identity mismatch');need(replay.candidateId===id,'replay winner identity');need(Number.isFinite(replay.wallMs)&&replay.wallMs>=0,'separate replay wall timing');
  need(replay.outcome.id===candidate.topologyId,'winner replay topology identity mismatch');
  need(JSON.stringify(canonical(replay.outcome.settings))===JSON.stringify(canonical(candidate.settings)),'winner replay observation controls mismatch');
  const projected=selectSourceInverseTerminalObservation(replay.outcome);observation(projected,candidate);
  need(JSON.stringify(canonical(projected))===JSON.stringify(canonical(r.observation)),'winner replay terminal observation mismatch');
  need(replay.outcome.physicalResult?.success===true,'winner replay physical scorer mismatch');
  need(JSON.stringify(canonical(replay.outcome.physicalResult.settings))===JSON.stringify(canonical(candidate.settings)),'winner replay controls mismatch');need(Number.isFinite(replay.outcome.physicalResult.distance)&&replay.outcome.physicalResult.distance>=0,'original finite display/ranking distance');
  return freeze({kind:'resident-inverse-winner-replay-comparison-v1',candidateId:id,contractSha256:c.contractSha256,comparison:'equal',replayWallMs:replay.wallMs,qualificationGranted:false,qualificationScope:inverseTerminalObservationScope(c).qualificationScope,finalGameplayQualified:false,solverAdapterImplemented:false});
}
