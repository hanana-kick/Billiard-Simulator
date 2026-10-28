/* Explicit request integrity/admission for original-source gameplay verification.
 * This binds initial data; a digest is NOT attestation of arbitrary caller history.
 * Controller owns live source capture. No physics, defaults, or GPU execution. */
(function(G){
'use strict';
const GAME='source-gameplay-finalization-v1',ROUTE='source-route-query-v1',KIND='source-finalization-request-v1',tokens=new WeakMap();
const need=(x,m)=>{if(!x)throw new RangeError('Source finalization request: '+m);};
const own=(x,keys)=>{need(x&&typeof x==='object'&&!Array.isArray(x),'plain record');const ds=Object.getOwnPropertyDescriptors(x);need(Reflect.ownKeys(ds).length===keys.length&&keys.every(k=>ds[k]&&'value'in ds[k]),'exact fields '+keys.join(','));};
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const numberBuffer=new ArrayBuffer(8),numberView=new DataView(numberBuffer);
/** Deterministic typed data; Number values retain all binary64 bits, including
 * signed zero/subnormals. Undefined fields differ from omission. No getters. */
function fingerprint(value){
 const active=new Set();
 const encode=x=>{
  if(x===null)return'n';if(x===undefined)return'u';if(typeof x==='boolean')return x?'b1':'b0';if(typeof x==='string')return's'+JSON.stringify(x);
  if(typeof x==='number'){need(Number.isFinite(x),'finite source Number');numberView.setFloat64(0,x,false);return'd'+hex(new Uint8Array(numberBuffer));}
  need(x&&typeof x==='object','plain source data, no function/symbol/bigint');need(!active.has(x),'acyclic source data');
  if(ArrayBuffer.isView(x)){need(Object.prototype.toString.call(x.buffer)==='[object ArrayBuffer]','owned non-shared source bytes');return'v'+x.constructor.name+':'+x.byteLength+':'+hex(new Uint8Array(x.buffer,x.byteOffset,x.byteLength));}
  if(Object.prototype.toString.call(x)==='[object ArrayBuffer]')return'a'+x.byteLength+':'+hex(new Uint8Array(x));
  const proto=Object.getPrototypeOf(x);need(Array.isArray(x)||proto&&Object.getPrototypeOf(proto)===null&&proto.constructor?.name==='Object','plain source object');
  const ds=Object.getOwnPropertyDescriptors(x);need(Object.getOwnPropertySymbols(x).length===0,'no source symbol properties');active.add(x);let out;
  if(Array.isArray(x)){need(Object.keys(ds).length===x.length+1,'dense source arrays without extras');out='['+Array.from({length:x.length},(_,i)=>{need(ds[i]&&'value'in ds[i],'dense source array values');return encode(ds[i].value);}).join(',')+']';}
  else{out='{'+Object.keys(ds).sort().map(k=>{need('value'in ds[k]&&ds[k].enumerable,'plain enumerable source values');return JSON.stringify(k)+':'+encode(ds[k].value);}).join(',')+'}';}
  active.delete(x);return out;
 };return encode(value);
}
const clone=x=>G.structuredClone(x),freeze=x=>{if(x&&typeof x==='object'&&!ArrayBuffer.isView(x)){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
const policyApi=()=>{need(G.LabSourceFinalizationPolicy?.createSourceFinalizationPolicy,'original policy module loaded');return G.LabSourceFinalizationPolicy;};
const query=(req,topology)=>({gameMode:req.options.gameMode??null,mode:req.options.mode,selectedId:req.selectedId,targetId:topology?.firstId??req.options.targetId,secondId:topology?.secondId??req.options.secondId??null});
function envelope(req){
 if(!Object.hasOwn(req,'finalization'))return null;const f=req.finalization;need(f&&f.kind===KIND,'known explicit envelope');need([GAME,ROUTE].includes(f.policy),'known explicit policy');
 if(f.policy===ROUTE){own(f,['kind','policy']);return f;}
 own(f,['kind','policy','sourceIdentity','gameBinding']);need(typeof f.sourceIdentity==='string'&&/^[a-f0-9]{64}$/.test(f.sourceIdentity),'initial source SHA256');
 const b=f.gameBinding;own(b,['kind','sourceIdentity','gameKind','snapshot','worldObjectIds','shotRules']);need(b.sourceIdentity===f.sourceIdentity,'matching initial identities');
 const s=b.snapshot,keys=['threeCushion','cueIds','redIds','scores','activeCue','pending','lastResult'];own(s,b.gameKind==='three'?[...keys,'objectIds','kind']:keys);need(typeof s.threeCushion==='boolean'&&typeof s.lastResult==='string','original game snapshot values');
 own(s.scores,s.cueIds.map(String));need(req.snapshot&&Array.isArray(req.snapshot.objects),'original request world roster');need(fingerprint(b.worldObjectIds)===fingerprint(req.snapshot.objects.map(o=>o.id)),'same complete ordered world roster');
 need(req.snapshot.world instanceof Uint8Array||Object.prototype.toString.call(req.snapshot.world)==='[object Uint8Array]','original native snapshot bytes');
 if(b.gameKind==='four')need(b.shotRules.threeCushion===req.options.fourBallThreeCushion,'actual four-ball per-shot option');
 policyApi().createSourceFinalizationPolicy({policy:GAME,purpose:'verify',sourceIdentity:f.sourceIdentity,query:query(req),gameBinding:b});return f;
}
function validate(req){need(req&&typeof req==='object','request');const f=envelope(req);if(f)fingerprint(req);return f?.policy??null;}
function payload(req){const {finalization,...source}=req;const f=envelope(req);need(f,'explicit request');if(f.policy===ROUTE)return{kind:KIND,policy:ROUTE,source};const {sourceIdentity,...game}=f.gameBinding;return{kind:KIND,policy:GAME,source,gameBinding:game};}
async function digest(value){need(G.crypto?.subtle&&G.TextEncoder,'browser SHA256 capability');return hex(new Uint8Array(await G.crypto.subtle.digest('SHA-256',new G.TextEncoder().encode(fingerprint(value)))));}
async function bind(req,{gameKind,snapshot,worldObjectIds,shotRules}){
 need(!Object.hasOwn(req,'finalization'),'bind fresh request only');fingerprint(req);fingerprint({gameKind,snapshot,worldObjectIds,shotRules});
 const r=clone(req),sourceIdentity='0'.repeat(64);r.finalization={kind:KIND,policy:GAME,sourceIdentity,gameBinding:{kind:'original-game-binding-v1',sourceIdentity,gameKind,snapshot:clone(snapshot),worldObjectIds:clone(worldObjectIds),shotRules:clone(shotRules)}};
 validate(r);const hash=await digest(payload(r));r.finalization.sourceIdentity=hash;r.finalization.gameBinding.sourceIdentity=hash;validate(r);return r;
}
function route(req){need(!Object.hasOwn(req,'finalization'),'route fresh request only');fingerprint(req);const r=clone(req);r.finalization={kind:KIND,policy:ROUTE};validate(r);return r;}
async function admit(req){
 const f=envelope(req);if(!f)return undefined;const before=fingerprint(req),sourceIdentity=await digest(payload(req));need(fingerprint(req)===before,'request changed during admission');if(f.policy===GAME)need(sourceIdentity===f.sourceIdentity,'initial request/game digest mismatch');
 const token=Object.freeze({});tokens.set(token,{fingerprint:before,sourceIdentity,policy:f.policy});return token;
}
function admitted(token,req){const a=tokens.get(token);need(a,'same-realm admission token');need(fingerprint(req)===a.fingerprint,'request changed after admission');return a;}
function policyFor(token,req,topology,purpose){const a=admitted(token,req);return policyApi().createSourceFinalizationPolicy({policy:a.policy,purpose,sourceIdentity:a.sourceIdentity,query:query(req,topology),gameBinding:a.policy===GAME?req.finalization.gameBinding:null});}
function evaluationBindingFor(token,req,topology,settings,purpose){const a=admitted(token,req);fingerprint({topology,settings,purpose});return freeze({kind:'source-finalization-evaluation-binding-v1',sourceIdentity:a.sourceIdentity,purpose,settings:clone(settings),topology:clone(topology)});}
function needsAdmission(req,purpose){if(!Object.hasOwn(req,'finalization'))return false;const f=req.finalization;need(f&&f.kind===KIND&&[GAME,ROUTE].includes(f.policy),'known explicit policy');if(f.policy===ROUTE){own(f,['kind','policy']);return false;}if(purpose!=='verify')return false;validate(req);return true;}
function matchesEvaluation(req,job,receipt){
 if(!receipt||receipt.kind!=='source-gameplay-finalization-result-v1'||receipt.policy!==GAME||receipt.sourceIdentity!==req.finalization?.sourceIdentity||receipt.purpose!=='verify'||job.purpose!=='verify')return false;
 const expected={kind:'source-finalization-evaluation-binding-v1',sourceIdentity:receipt.sourceIdentity,purpose:'verify',settings:job.settings,topology:job.topology};
 try{own(receipt,['kind','policy','sourceIdentity','purpose','status','gameplayVerified','physicalRest','finishedGameResult','reason','evaluationBinding']);return fingerprint(receipt.evaluationBinding)===fingerprint(expected);}catch{return false;}
}
function verifiedGameplay(req,job,outcome){
 const f=outcome?.finalization;if(!matchesEvaluation(req,job,f))return false;
 const result=f.finishedGameResult,cue=req.selectedId;
 try{own(result,['cueId','delta','nextCue']);if(fingerprint(outcome.settings)!==fingerprint(job.settings)||fingerprint(outcome.physicalResult?.settings)!==fingerprint(job.settings)||fingerprint(outcome.physicalResult)!==fingerprint(outcome.routeQueryPhysicalResult))return false;}catch{return false;}
 if(outcome.physicalResult?.firstId!==(job.topology.firstId??req.options.targetId)||outcome.physicalResult?.secondId!==(job.topology.secondId??req.options.secondId))return false;
 return outcome.incomplete!==true&&outcome.unsupported!==true&&outcome.purpose==='verify'&&outcome.verified===true&&outcome.goalVerified===true&&outcome.physicalResult?.success===true&&f.status==='verified-final-gameplay'&&f.gameplayVerified===true&&f.physicalRest===true&&f.reason===null&&result?.cueId===cue&&result.delta===1&&result.nextCue===cue;
}
function matchesGameplayOutcome(req,job,outcome){
 const f=outcome?.finalization;if(!matchesEvaluation(req,job,f))return false;
 try{
  if(outcome.purpose!=='verify'||outcome.status!==f.status||outcome.reason!==f.reason||fingerprint(outcome.settings)!==fingerprint(job.settings)||fingerprint(outcome.verification?.finalization)!==fingerprint(f)||outcome.incomplete!==(f.status==='incomplete')||outcome.unsupported!==(f.status==='unsupported'))return false;
  if(f.status==='verified-final-gameplay')return verifiedGameplay(req,job,outcome);
  if(!['evaluated-negative','incomplete','cancelled','stale','unsupported','failed'].includes(f.status)||f.gameplayVerified!==false||typeof f.physicalRest!=='boolean'||typeof f.reason!=='string'||outcome.verified!==false||outcome.goalVerified!==false||outcome.physicalResult!==null)return false;
  if(f.status!=='evaluated-negative'){
   // This version has no authoritative terminal residual, stage, prefix, cell,
   // clearance or other query projection for an unfinished/interrupted result.
   own(outcome,['id','settings','purpose','steps','status','reason','finalization','verification','verified','goalVerified','physicalResult','incomplete','unsupported','routeQueryObservation']);
   if(f.finishedGameResult!==null||f.physicalRest!==false)return false;
  }
  return true;
 }catch{return false;}
}
G.LabSourceFinalizationRequest=Object.freeze({GAMEPLAY_FINALIZATION_POLICY:GAME,ROUTE_QUERY_POLICY:ROUTE,fingerprint,validate,bind,route,admit,policyFor,evaluationBindingFor,needsAdmission,matchesEvaluation,verifiedGameplay,matchesGameplayOutcome});
})(globalThis);
