/** Explicit experimental integration into ONE already-mounted LabController.
 * No automatic activation, device request, legacy import, or search fallback. */
import {validateCanonicalScene,CanonicalContractError} from '../direct-candidate/canonical-engine-contract.mjs';
import {createCanonicalStateApplicationAdapter,createCanonicalStateApplicationAdapterHarness,canonicalApplicationRules} from './compiled-prefix-application-adapter.mjs';
import {createCanonicalRenderView,prepareCanonicalGameProjection} from '../direct-candidate/canonical-controller-projection.mjs';
import {createCanonicalControllerSearch,canonicalSearchPopulation} from '../direct-candidate/canonical-controller-search.mjs';
import {isCanonicalWasmCompactSearchService} from '../direct-candidate/canonical-compact-search-service.mjs';
import {assertWasmGpuProductionRuntime} from '../wasm-gpu/production-runtime.mjs';
const own=x=>structuredClone(x),Q20=2**20;
const fail=(code,message)=>new CanonicalContractError(code,message);
const stable=x=>Array.isArray(x)?'['+x.map(stable).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}':JSON.stringify(x);
function install(controller,{stateStore,selectedWorldProfile,device,requestOptions,session,searchService,searchOptions,productionRuntime,awaitPresentationHarness},harness) {
 const c=controller,G=globalThis;
 if(awaitPresentationHarness!==undefined&&(!harness||typeof awaitPresentationHarness!=='function'))throw TypeError('Presentation harness belongs only to injected controller tests');
 if(!G.LabController||!(c instanceof G.LabController)||!c.lab||!c.state.ready||c.disposed||c.canonicalPlayback)
  throw fail('CONTROLLER_NOT_READY','One mounted idle LabController without an existing canonical owner required');
 if(!c.state.paused||c.lab.cue||c.lab.anyMotion()||c.game?.pending||c.drag||c.windup||c.undoStack.length||c.redoStack.length)
  throw fail('CONTROLLER_ACTIVATION_BOUNDARY','Idle empty-history activation only; legacy history is never discarded or migrated');
 if(!stateStore||['snapshot','restore','readClock','placeBall','readScene','readRevision','readFinalState'].some(name=>typeof stateStore[name]!=='function'))throw TypeError('Explicit authoritative canonical store required');
 const scene=validateCanonicalScene(stateStore.readScene());
 if(!scene.admitted||scene.physical.bodies.some(b=>Object.values(b.v).some(Boolean)||Object.values(b.w).some(Boolean)))
  throw fail('CONTROLLER_SCENE_REJECTED','Explicit already-admitted resting scene required; no legacy height snap');
 canonicalApplicationRules(c.game?.snapshot(),c.state.selectedId,scene.slotToId);
 if(c.state.gameMode==='four'&&c.game.threeCushion!==!!c.state.routeOptions.fourBallThreeCushion)
  throw fail('CONTROLLER_RULE_BOUNDARY','Actual game and selected shot three-cushion option must agree at explicit activation');
 if(!requestOptions||!requestOptions.budget||!requestOptions.raw||!requestOptions.continuation||!requestOptions.executionProfile||
   !Number.isInteger(requestOptions.maximumRecords)||requestOptions.maximumRecords<1||requestOptions.maximumRecords>512||
   ['purpose','requestId','candidateId','signal'].some(k=>Object.hasOwn(requestOptions,k)))
  throw TypeError('Explicit bounded request options required; controller owns purpose, request IDs, candidate IDs and cancellation');
 if(productionRuntime!==undefined)assertWasmGpuProductionRuntime(productionRuntime,device);
 if(searchService){if(searchService.selectedWorldProfile!==selectedWorldProfile||typeof searchService.runSearch!=='function'||typeof searchService.cancel!=='function')throw TypeError('Matching canonical search service required');canonicalSearchPopulation(searchOptions);}
 if(searchService&&!harness&&((!isCanonicalWasmCompactSearchService(searchService)&&searchService.capabilities?.implementation!=='webgpu-sealed-compact-search-v1')||searchService.capabilities?.compactBatch!==true||!/^[a-f0-9]{64}$/.test(searchService.sourceRevision??'')))
  throw fail('CONTROLLER_SEARCH_SOURCE','Production search requires the packaged sealed GPU service; injected services belong to the harness');
 const options=own(requestOptions),legacy=c.lab,original={};
 let active=null,forecastIntent=null,sequence=0,generation=0,disposed=false,projection,shots=0,lastPoseTick=null,renderRevision=null,forecastReceipt=null,sourceUnavailable=false,search=null,resetting=false,draining=null,reusableCleanup=false,promotedCleanup=null,drainFailed=false,canonicalFrameDepth=0,manualEnabled=false,manualTicket=null,manualTimer=null,manualPending=null,manualSupersession=null,manualVersion=0,manualFailure=null;
 let presentationWaiter=null,presentationSequence=0,restGate=null,restLayoutSequence=0,unsubscribeRestPresentation=null;
 const pendingSelected=new Set();
 const runSelected=input=>{const promise=adapter.runSelected(input);pendingSelected.add(promise);promise.then(()=>pendingSelected.delete(promise),()=>pendingSelected.delete(promise));return promise;};
 const gameRuleCompatible=()=>c.state.gameMode!=='four'||c.game.threeCushion===!!c.state.routeOptions.fourBallThreeCushion;
 const intent=()=>({selectedId:c.state.selectedId,settings:own(c.state.settings),game:c.game.snapshot()});
 // Freeze selected cue/aim for this shot, but never freeze away live game edits.
 const readContext=()=>{if(!gameRuleCompatible())throw fail('CONTROLLER_RULE_BOUNDARY','Live game and shot rule option disagree');const i=active?.intent??forecastIntent;return i?{selectedId:i.selectedId,settings:own(i.settings),game:c.game.snapshot()}:intent();};
 const adapter=(harness?createCanonicalStateApplicationAdapterHarness:createCanonicalStateApplicationAdapter)({stateStore,selectedWorldProfile,device,readContext,productionRuntime,...(harness?{session}:{})});
 const status=patch=>{c.state.canonicalPlayback={...c.state.canonicalPlayback,...patch};};
 // Routine input supersession invalidates the private claim immediately but
 // lets the no-prefix computation settle; it never destroys a healthy owner.
 // Explicit undo/reset/search/dispose retain the existing destructive lane.
 const destructivelyCancelledTickets=new WeakSet(),supersededTickets=new WeakMap();
 const cancelAdapter=(reason,{settlePrepared=false}={})=>{const pending=manualPending!==null||manualSupersession!==null;clearTimeout(manualTimer);manualTimer=null;manualVersion++;
  if(pending&&settlePrepared){
   const ticket=manualTicket;if(!ticket){if(manualSupersession)return;throw fail('CONTROLLER_MANUAL_SUPERSESSION','Pending manual ticket is missing');}
   let record=supersededTickets.get(ticket);
   if(!record){
    let operation;try{operation=adapter.supersedePreparedManual(ticket,reason);}catch(error){manualFailure=error;report('refused','수동 준비 중단 실패: '+(error.message??String(error)));throw error;}
    if(typeof operation?.then!=='function')throw fail('CONTROLLER_MANUAL_SUPERSESSION','Owned settled supersession promise required');
    const readySettlement=manualPending?.then(()=>undefined,()=>undefined);const work=Promise.all([operation,readySettlement]).then(([receipt])=>receipt);record={work};supersededTickets.set(ticket,record);manualSupersession=work;pendingSelected.add(work);
    work.then(()=>{if(disposed)return;if(manualTicket===ticket){manualTicket=null;status({manualPreparation:{enabled:manualEnabled,state:'invalidated'}});}},error=>{if(disposed)return;manualFailure=error;status({manualPreparation:{enabled:manualEnabled,state:'failed'}});report('refused','수동 준비 중단 실패: '+(error.message??String(error))+(error.code?' ['+error.code+']':''));}).finally(()=>{pendingSelected.delete(work);if(manualSupersession===work)manualSupersession=null;scheduleManualPreparation();if(!disposed&&!manualEnabled)c.notify(false);}).catch(()=>{});
   }
   if(manualEnabled)status({manualPreparation:{enabled:true,state:'stale-pending'},preparedManualHit:false});return;
  }
  if(pending&&manualTicket)destructivelyCancelledTickets.add(manualTicket);manualTicket=null;adapter.cancel(reason);if(manualEnabled)status({manualPreparation:{enabled:true,state:pending?'canceling':'empty'},preparedManualHit:false});if(pending&&!disposed)beginDrain();};

 const readPreparation=()=>{
  const raw=(productionRuntime??(harness?session:undefined))?.status?.()?.nativePreparation;
  return raw&&['unprepared','preparing','ready'].includes(raw.phase)?{phase:raw.phase,completedPipelines:raw.completedPipelines,totalPipelines:raw.totalPipelines}:null;
 };
 const refresh=()=>{sourceUnavailable=false;renderRevision=stateStore.readRevision();projection=createCanonicalRenderView({scene:stateStore.readScene(),pose:G.PhysicsLab.prototype.pose,isBusy:()=>!!active||!!draining||drainFailed||sourceUnavailable});c.lab=projection.view;c.lab.shots=shots;lastPoseTick=stateStore.readClock()??null;c.lab.time=(lastPoseTick??0)/Q20;status({poseTick:lastPoseTick,playheadTick:lastPoseTick,sampleStatus:stateStore.readFinalState()?'authoritative-rest':'authored-rest',held:false,scoreAndTurnCommitted:false,streaming:false,awaitingFirstPrefix:false,prefixRecordCount:0,buffering:false,bufferingReason:null,availableUntilTick:null,bufferedWaitSeconds:0,physicsResultComplete:false});c.dirty=true;};
 const report=(phase,message)=>{status({phase});c.state.forecastStatus=message;c.state.predictionBusy=false;c.notify();};
 const cancel=(reason,options)=>{if(restGate)clearTimeout(restGate.timer);restGate=null;status({restPresentation:null});if(presentationWaiter)presentationWaiter.reject(fail('CONTROLLER_PRESENTATION_CANCELLED',String(reason)));search?.cancel(reason,true);generation++;cancelAdapter(reason,options);forecastIntent=null;forecastReceipt=null;active=null;c.state.predictionBusy=false;c.state.paused=true;};

 // A complete cached shot has no asynchronous GPU wait in which React can
 // mount its active status layout. This barrier acknowledges DOM/backing-size
 // readiness only; it does NOT claim a rendered bitmap or alter physics time.
 const acknowledgePresentation=(token,injected=false)=>{
  const w=presentationWaiter;if(!w||w.token!==token)return false;
  try{w.assertCurrent();if(!injected){
   if(!c.canvas||typeof c.canvas.getBoundingClientRect!=='function'||typeof c.renderer?.size!=='function')throw fail('CONTROLLER_PRESENTATION_LAYOUT','Mounted canvas and renderer sizing required');
   c.resizeViewport();c.renderer.size();w.assertCurrent();
   const r=c.canvas.getBoundingClientRect(),dpr=Math.min(globalThis.devicePixelRatio||1,2);
   if(!Number.isFinite(r.width)||!Number.isFinite(r.height)||r.width<1||r.height<1||!Number.isFinite(dpr)||dpr<=0||c.viewportBounds?.width!==r.width||c.viewportBounds?.height!==r.height||c.canvas.width!==Math.round(r.width*dpr)||c.canvas.height!==Math.round(r.height*dpr))throw fail('CONTROLLER_PRESENTATION_LAYOUT','Actual canvas bounds and backing size are not ready');
  }w.assertCurrent();w.resolve();return true;}catch(error){w.reject(error);return false;}
 };
 const awaitPreparedPresentation=(a,result)=>{
  const token=++presentationSequence,version=manualVersion,input=stable(intent()),revision=stateStore.readRevision(),deadline=performance.now()+5000;a.presentationPending=true;
  const assertCurrent=()=>{if(performance.now()>=deadline)throw fail('CONTROLLER_PRESENTATION_TIMEOUT','Presentation layout acknowledgment timed out');if(disposed||active!==a||draining||drainFailed||c.state.canonicalPlayback?.deviceLost||c.drag||c.windup||manualVersion!==version||stateStore.readRevision()!==revision||stable(intent())!==input)throw fail('CONTROLLER_PRESENTATION_STALE','Prepared presentation input or owner changed');result.assertCurrent();};
  let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});promise.catch(()=>{});
  const w={token,assertCurrent,resolve(){if(presentationWaiter!==w)return;clearTimeout(w.timer);presentationWaiter=null;resolve();},reject(error){if(presentationWaiter!==w)return;clearTimeout(w.timer);presentationWaiter=null;reject(error);},timer:null};
  presentationWaiter=w;w.timer=setTimeout(()=>w.reject(fail('CONTROLLER_PRESENTATION_TIMEOUT','Presentation layout acknowledgment timed out')),5000);
  status({presentationToken:token,presentationLayoutReady:false,bitmapReady:false});report('presentation-preparing','확인된 타격의 화면 배치를 준비 중입니다 · 아직 재생을 시작하지 않았습니다.');
  if(harness){if(typeof awaitPresentationHarness!=='function')w.reject(fail('CONTROLLER_PRESENTATION_HARNESS','Explicit presentation readiness test seam required'));else Promise.resolve().then(()=>awaitPresentationHarness(Object.freeze({token}))).then(()=>acknowledgePresentation(token,true),error=>w.reject(error));}
  return promise.then(()=>{assertCurrent();a.presentationPending=false;status({presentationLayoutReady:true});});
 };
 const invalidatePendingPresentation=reason=>{if(!active?.presentationPending)return;cancel(reason,{settlePrepared:true});refresh();report('ready','입력이 바뀌어 준비된 타격 재생을 취소했습니다.');};

 const expireRestPresentation=g=>{if(restGate!==g)return;g.failed=true;clearTimeout(g.timer);status({restPresentation:{revision:g.revision,poseTick:g.poseTick,layoutSequence:g.layoutSequence,layoutReady:!!g.bounds,bitmapPresented:false,failed:true,reason:'Final REST bitmap presentation timed out'}});try{c.notify(false);}catch{}};
 const armRestPresentation=(revision,poseTick)=>{
  clearTimeout(manualTimer);manualTimer=null;if(restGate)clearTimeout(restGate.timer);
  restGate={revision,poseTick,layoutSequence:++restLayoutSequence,opaque:Object.freeze({}),bounds:null,healthGuard:null,generation,manualVersion,inputStamp:stable(intent()),deadline:performance.now()+5000,failed:false,timer:null};
  const gate=restGate;gate.timer=setTimeout(()=>expireRestPresentation(gate),5000);
  try{const runtime=productionRuntime??(harness?session:undefined);restGate.healthGuard=runtime?.captureSelectedResultGuard?.()??null;restGate.healthGuard?.assertCurrent();}catch(error){manualFailure=error;restGate.healthGuard=null;}
  status({restPresentation:{revision,poseTick,layoutSequence:restGate.layoutSequence,layoutReady:false,bitmapPresented:false}});
 };
 const restCurrent=g=>!g.failed&&performance.now()<g.deadline&&!disposed&&!active&&!draining&&!drainFailed&&!c.state.canonicalPlayback?.deviceLost&&restGate===g&&generation===g.generation&&manualVersion===g.manualVersion&&stable(intent())===g.inputStamp&&stateStore.readRevision()===g.revision&&c.state.canonicalPlayback?.phase==='rest'&&c.state.canonicalPlayback?.poseTick===g.poseTick;
 const acknowledgeRestLayout=revision=>{
  const g=restGate;
  try{if(!g||g.revision!==revision||!restCurrent(g))return false;
   if(!c.canvas||typeof c.canvas.getBoundingClientRect!=='function'||typeof c.renderer?.size!=='function')return false;
   c.resizeViewport();c.renderer.size();if(!restCurrent(g))return false;
   const r=c.canvas.getBoundingClientRect(),dpr=Math.min(globalThis.devicePixelRatio||1,2);
   if(!Number.isFinite(r.width)||!Number.isFinite(r.height)||r.width<1||r.height<1||!Number.isFinite(dpr)||dpr<=0||c.viewportBounds?.width!==r.width||c.viewportBounds?.height!==r.height||c.canvas.width!==Math.round(r.width*dpr)||c.canvas.height!==Math.round(r.height*dpr))return false;
   g.bounds=Object.freeze({width:r.width,height:r.height,dpr,bitmapWidth:c.canvas.width,bitmapHeight:c.canvas.height});g.layoutAcknowledgedAt=performance.now();
   status({restPresentation:{revision:g.revision,poseTick:g.poseTick,layoutSequence:g.layoutSequence,layoutReady:true,bitmapPresented:false}});c.dirty=true;return true;
  }catch{return false;}
 };
 const restPresentationToken=()=>{try{const g=restGate;if(g&&performance.now()>=g.deadline){expireRestPresentation(g);return null;}if(!g||!g.bounds||!restCurrent(g)||!unsubscribeRestPresentation||!c.renderer?.workerMode||c.renderer?.isFallback)return null;return g.opaque;}catch(error){manualFailure=error;status({manualPreparation:{enabled:manualEnabled,state:'failed'},restPresentationFailure:error.message??String(error)});return null;}};
 const receiveRestPresentation=receipt=>{
  try{const g=restGate;if(g&&performance.now()>=g.deadline){expireRestPresentation(g);return null;}if(!g||!g.bounds||!restCurrent(g)||receipt?.presentationToken!==g.opaque||!c.renderer?.workerMode||c.renderer?.isFallback)return;
  if(!g.healthGuard)return;g.healthGuard.assertCurrent();
  const b=g.bounds,r=c.canvas.getBoundingClientRect(),size=receipt.submittedSize;
  if(!Number.isSafeInteger(receipt.workerSequence)||receipt.workerSequence<=0||!Number.isFinite(receipt.bitmapDrawCompletedAt)||receipt.bitmapDrawCompletedAt<g.layoutAcknowledgedAt||!size||size.width!==b.width||size.height!==b.height||size.dpr!==b.dpr||receipt.actualBitmapWidth!==b.bitmapWidth||receipt.actualBitmapHeight!==b.bitmapHeight||r.width!==b.width||r.height!==b.height||Math.min(globalThis.devicePixelRatio||1,2)!==b.dpr||c.canvas.width!==b.bitmapWidth||c.canvas.height!==b.bitmapHeight)return;
  clearTimeout(g.timer);restGate=null;status({restPresentation:{revision:g.revision,poseTick:g.poseTick,layoutSequence:g.layoutSequence,layoutReady:true,bitmapPresented:true,bitmapDrawCompletedAt:receipt.bitmapDrawCompletedAt}});scheduleManualPreparation();
  }catch(error){manualFailure=error;status({manualPreparation:{enabled:manualEnabled,state:'failed'},restPresentationFailure:error.message??String(error)});}
 };
 const unsupported=what=>{c.announce(`실험적 canonical 모드: ${what}은 아직 지원하지 않습니다. 기존 엔진으로 대체하지 않습니다.`);return false;};
 const capture=()=>({canonicalState:stateStore.snapshot(),selectedId:c.state.selectedId,settings:own(c.state.settings),paused:true,
  gameMode:c.state.gameMode,game:c.game.snapshot(),canonicalShots:shots});
 const restore=(saved,{silent=false,deferDrain=false}={})=>{if(!saved?.canonicalState)throw fail('CONTROLLER_HISTORY_SOURCE','Canonical owner snapshots only; no legacy migration');
  const needsDrain=pendingSelected.size>0||c.state.routeStatus==='searching';
  cancel('history restore');stateStore.restore(saved.canonicalState);shots=saved.canonicalShots;c.game.restore(saved.game);
  Object.assign(c.state,{selectedId:saved.selectedId,settings:own(saved.settings),paused:true,gameMode:saved.gameMode,cuePull:0,gesture:'',forecast:null});
  c.accumulator=0;c.cooldownUntil=0;refresh();c.repairRouteTargets();if((needsDrain||draining)&&!deferDrain)beginDrain();if(!silent){c.queuePrediction();c.notify();}};
 // Restore is synchronous; readiness is not. A stale run cannot commit, but
 // only the runtime's verified generation retirement establishes GPU cleanup.
 const beginDrain=(refusal=null,{reuse=false}={})=>{
  if(draining){if(!reuse&&reusableCleanup){reusableCleanup=false;try{promotedCleanup=Promise.resolve((productionRuntime??session)?.cancelAndDrain?.('Controller destructive cleanup requested'));}catch(error){promotedCleanup=Promise.reject(error);}promotedCleanup.catch(()=>{});}return draining;}
  reusableCleanup=reuse;promotedCleanup=null;
  clearTimeout(c.predictionTimer);
  const pending=[...pendingSelected];
  let cleanup;
  try{if(!harness&&!productionRuntime)throw fail('CONTROLLER_DRAIN_UNAVAILABLE','Verified runtime cleanup required');const runtime=productionRuntime??session;cleanup=reuse&&typeof runtime?.cancelAndReset==='function'?runtime.cancelAndReset('Controller cancellation'):runtime?.cancelAndDrain?.('Controller cancellation');}
  catch(error){cleanup=Promise.reject(error);}
  const result=Promise.all([Promise.allSettled(pending),cleanup]).then(async([,receipt])=>{
   if(promotedCleanup){await promotedCleanup;receipt=undefined;}
   if(disposed)return false;
   draining=null;drainFailed=false;status({nativePreparation:readPreparation(),cancellationCleanup:receipt?.kind==='native-selected-reset-receipt-v1'?'reusable-reset':'retired',resetSequence:receipt?.kind==='native-selected-reset-receipt-v1'?receipt.resetSequence:null});if(refusal)report('refused','Canonical 거부: '+refusal+' · GPU 작업 정리 확인');else report('ready','취소 완료 · GPU 작업 정리 확인');return true;
  }).catch(error=>{drainFailed=true;if(!disposed){draining=null;report('refused','GPU 취소 정리 실패: '+(error.code??error.message??String(error)));}throw error;});
  draining=result;report('canceling','취소 요청 · GPU 작업 정리 대기 중 (새 타격·검색 잠김)');
  // Legacy cancel/undo/reset are synchronous callers; explicit callers still
  // receive the same rejecting promise and must not mistake refusal for ready.
  result.catch(()=>{});return result;
 };
 const cancelAndDrain=()=>{
  if(draining)return beginDrain();
  if(disposed)return Promise.reject(fail('CONTROLLER_DISPOSED','Controller is disposed'));
  if(active){const a=active;rollbackHistory(a);restore(a.before,{silent:true});}
  else{cancel('explicit cancellation');refresh();}
  return draining??beginDrain();
 };
 // Explicit opt-in only. History restore, refusal and mode exit retain the
 // destructive cleanup contract; reusable reset is a separate operation.
 const cancelAndReset=()=>{
  if(draining)return draining;
  if(disposed)return Promise.reject(fail('CONTROLLER_DISPOSED','Controller is disposed'));
  if(active){const a=active;rollbackHistory(a);restore(a.before,{silent:true,deferDrain:true});}
  else{cancel('explicit reusable cancellation');refresh();}
  return beginDrain(null,{reuse:true});
 };
 const request=purpose=>{const id=++sequence;if(id>0xffffffff)throw fail('CONTROLLER_ID_EXHAUSTED','Install a new explicit owner');
  return {...own(options),purpose,requestId:id,candidateId:id,raw:{...own(options.raw),absoluteTick:stateStore.readClock()??options.raw.absoluteTick}};};
 const manualIdle=()=>manualEnabled&&!disposed&&!active&&!draining&&!drainFailed&&!manualFailure&&!manualSupersession&&!restGate&&!sourceUnavailable&&!c.state.canonicalPlayback?.deviceLost&&!c.drag&&!c.windup&&c.state.routeStatus!=='searching'&&c.state.paused&&gameRuleCompatible();
 const scheduleManualPreparation=()=>{
  if(!manualIdle()||manualTimer!==null||manualTicket||manualPending)return;
  manualTimer=setTimeout(()=>{manualTimer=null;if(!manualIdle()||manualTicket||manualPending)return;
   const token=++manualVersion;let ticket;try{ticket=adapter.prepareManual(request('manual'));if(ticket?.kind!=='canonical-prepared-manual-ticket-v1'||typeof ticket.status!=='function'||typeof ticket.ready?.then!=='function')throw fail('CONTROLLER_MANUAL_TICKET_CONTRACT','Private bounded manual ticket required');}
   catch(error){manualFailure=error;status({manualPreparation:{enabled:true,state:'failed'}});report('refused','수동 타격 준비 실패: '+(error.message??String(error))+(error.code?' ['+error.code+']':''));return;}
   manualTicket=ticket;const work=Promise.resolve(ticket.ready);manualPending=work;pendingSelected.add(work);status({manualPreparation:{enabled:true,state:'pending',requestId:ticket.status().requestId,candidateId:ticket.status().candidateId}});c.notify(false);
   work.then(()=>{if(disposed||token!==manualVersion||manualTicket!==ticket)return;const state=ticket.status().state;status({manualPreparation:{enabled:true,state,requestId:ticket.status().requestId,candidateId:ticket.status().candidateId}});c.notify(false);},error=>{
    const superseded=token!==manualVersion||manualTicket!==ticket,expected=error?.name==='AbortError'||['CANCELLED','STALE_APPLICATION_RESULT','STALE_SESSION_RESULT'].includes(error?.code);
    if(disposed||supersededTickets.has(ticket)||(superseded&&destructivelyCancelledTickets.has(ticket)&&expected))return;manualFailure=error;status({manualPreparation:{enabled:manualEnabled,state:'failed'}});report('refused','수동 타격 준비 실패: '+(error.message??String(error))+(error.code?' ['+error.code+']':''));
   }).finally(()=>{pendingSelected.delete(work);if(manualPending===work)manualPending=null;if(!manualSupersession&&manualTicket===ticket&&ticket.status().state==='invalidated')manualTicket=null;scheduleManualPreparation();}).catch(()=>{});
  },140);
 };
 const setManualPreparationEnabled=value=>{
  if(typeof value!=='boolean')throw TypeError('Explicit manual preparation boolean required');
  if(disposed||active||draining||drainFailed||manualFailure||manualSupersession||c.state.routeStatus==='searching')return false;
  if(value===manualEnabled)return true;
  const speculativePending=manualPending!==null&&manualTicket!==null;
  // An ordinary forecast/foreground task is not this toggle's cancellation
  // authority. Only its own speculative ticket uses the retained settlement.
  if(pendingSelected.size>(speculativePending?1:0))return false;
  if(!value&&speculativePending){
   manualEnabled=false;
   try{cancelAdapter('Manual preparation disabled',{settlePrepared:true});}
   catch(error){manualFailure=error;status({manualPreparation:{enabled:false,state:'failed'}});report('refused','수동 준비 중단 실패: '+(error.message??String(error)));return false;}
   status({manualPreparation:{enabled:false,state:'settling'},preparedManualHit:false});c.notify(false);return true;
  }
  cancelAdapter('Manual preparation option changed');manualEnabled=value;
  if(restGate)armRestPresentation(stateStore.readRevision(),c.state.canonicalPlayback.poseTick);
  status({manualPreparation:{enabled:value,state:value?'empty':'disabled'},preparedManualHit:false});
  if(value)scheduleManualPreparation();c.notify(false);return true;
 };

 const override=(name,fn)=>{original[name]=c[name];c[name]=fn;};
 const ownedRenderer=c.renderer,renderBefore=ownedRenderer.render;
 const renderWithRestToken=function(lab,state,options={}){return renderBefore.call(this,lab,state,{...options,presentationToken:restPresentationToken()});};
 ownedRenderer.render=renderWithRestToken;
 if(typeof ownedRenderer.subscribePresentation==='function')unsubscribeRestPresentation=ownedRenderer.subscribePresentation(receiveRestPresentation);
 const resizeBefore=c.resizeViewport;
 override('resizeViewport',(...args)=>{const value=resizeBefore.apply(c,args),g=restGate;if(g&&!g.failed&&performance.now()>=g.deadline)expireRestPresentation(g);if(g?.bounds&&!g.failed){const r=c.canvas.getBoundingClientRect();if(r.width!==g.bounds.width||r.height!==g.bounds.height||Math.min(globalThis.devicePixelRatio||1,2)!==g.bounds.dpr){armRestPresentation(g.revision,g.poseTick);c.notify(false);}}return value;});
 const rollbackHistory=a=>{if(a){c.undoStack=a.originalUndo.slice();c.redoStack=a.originalRedo.slice();}};
 const checkIdleAuthority=()=>{if(active||draining||drainFailed||disposed)return;search?.check();try{if(renderRevision!==stateStore.readRevision()){if(manualTicket)cancelAdapter('Authoritative scene changed',{settlePrepared:true});forecastReceipt=null;c.state.forecast=null;refresh();status({phase:'source-changed'});}if(forecastReceipt)forecastReceipt.assertCurrent();}
  catch(error){forecastReceipt=null;c.state.forecast=null;status({phase:'stale-source',sampleStatus:'source-invalid',held:true});c.state.forecastStatus='Canonical 표시 결과가 현재 소스와 다릅니다. 다시 계산하세요.';try{stateStore.readRevision();}catch{sourceUnavailable=true;c.state.paused=true;}}};
 const abort=(error,a=active)=>{if(a!==active)return;const needsDrain=pendingSelected.size>0;rollbackHistory(a);cancel('canonical result refused');try{refresh();}catch{sourceUnavailable=true;status({sampleStatus:'source-invalid',held:true});}c.state.forecast=null;const reason=error.code??error.message??String(error);if(needsDrain)beginDrain(reason);else report('refused','Canonical 거부: '+reason);};
 const finish=()=>{const a=active;if(!a?.result)return;
  // Every value is derived/validated before the atomic state commit. Never
  // access the precommit result again after its source revision changes.
  const game=prepareCanonicalGameProjection({scene:stateStore.readScene(),game:c.game.snapshot(),selectedId:a.intent.selectedId,result:a.result});
  a.result.assertCurrent();const commit=a.result.commitState();
  c.commitHistory(a.before,'shot');
  c.game.restore(game.snapshot);c.state.selectedId=game.result.nextCue;shots++;active=null;c.state.paused=true;refresh();
  c.repairRouteTargets();c.state.forecast=null;status({phase:'rest',commitRevision:commit.revision,scoreAndTurnCommitted:true,physicsResultComplete:true,availableUntilTick:a.endTick,bufferedWaitSeconds:a.bufferedWaitSeconds});
  armRestPresentation(commit.revision,a.endTick);c.state.forecastStatus='Canonical 정지·점수·차례 반영 완료';c.notify();scheduleManualPreparation();
 };
 const reflectPreparation=()=>{
  if(!active||active.result||active.prefix||draining)return;
  const nativePreparation=readPreparation();if(!nativePreparation)return;
  const phase=nativePreparation.phase==='ready'?'calculating':'preparing';
  if(c.state.canonicalPlayback.phase===phase&&stable(c.state.canonicalPlayback.nativePreparation)===stable(nativePreparation))return;
  status({phase,nativePreparation});
  c.state.forecastStatus=phase==='preparing'?'GPU 파이프라인 준비 중 · 확인된 움직임 구간을 기다립니다.':'GPU 준비 완료 · 첫 움직임 구간 계산 중';
  c.notify(false);
 };
 const updateBufferWait=(a,buffering)=>{
  const now=performance.now();
  if(buffering&&a.bufferedAt===null)a.bufferedAt=now;
  if(!buffering&&a.bufferedAt!==null){a.bufferedWallMs+=Math.max(0,now-a.bufferedAt);a.bufferedAt=null;}
  a.bufferedWaitSeconds=(a.bufferedWallMs+(a.bufferedAt===null?0:Math.max(0,now-a.bufferedAt)))/1000;
 };
 // The streaming clock consumes only certified source intervals. At an open
 // frontier, show buffering and hold the last exact pose; never extrapolate or
 // silently change the user-selected rate. Existing dense sampling is retained.
 const advance=elapsed=>{
  checkIdleAuthority();reflectPreparation();const a=active,source=a?.result??a?.prefix;
  if(source){try{source.assertCurrent();}catch(error){abort(error,a);return;}}
  if(!source||c.state.paused||c.drag)return;
  try{
   const previousPhase=c.state.canonicalPlayback?.phase,dt=Math.max(0,elapsed),frontier=a.result?a.endTick:a.prefix.certifiedThroughTick;
   // An unfinished prefix's rightmost tick may acquire another same-tick
   // impulse. Only its closed interior is after-side certified for playback.
   const limit=a.result?frontier:Math.max(a.startTick,frontier-1);
   const wanted=Math.min(limit,a.playhead+dt*c.state.rate*Q20),tick=Math.floor(wanted);
   let presentationChanged=false;
   const shown=source.presentAt(tick,sample=>{
    const identical=a.presentedTick===tick&&a.presentedWords&&sample.state.every((word,i)=>word===a.presentedWords[i]);
    if(!identical){projection.present(sample);lastPoseTick=tick;a.presentedTick=tick;a.presentedWords=sample.state.slice();presentationChanged=true;}
   });
   // The display cursor may cross a certified but unsampleable interior. Hold
   // the actual pose, not the clock; retrying the same dt offset forever makes
   // reaching the next exact source point depend on an accidental long frame.
   a.playhead=wanted;
   const buffering=!a.result&&(!shown.presented||wanted>=limit),bufferingReason=buffering?(!shown.presented?'source-sample-unavailable':'awaiting-gpu-prefix'):null;
   updateBufferWait(a,buffering);
   status({phase:buffering?'buffering':'playing',awaitingFirstPrefix:false,streaming:!!a.prefix,prefixRecordCount:a.prefix?.recordCount??0,buffering,bufferingReason,availableUntilTick:frontier,bufferedWaitSeconds:a.bufferedWaitSeconds,
    physicsResultComplete:!!a.result?.physicsResultComplete,playheadTick:Math.floor(a.playhead),poseTick:lastPoseTick,
    sampleStatus:shown.presented?shown.sample.status:a.result&&!a.result.captureComplete?'capture-incomplete':shown.sample.status??'unavailable',held:buffering||!shown.presented,
    captureComplete:a.result?.captureComplete??false,samplingComplete:a.result?.samplingComplete??false,scoreAndTurnCommitted:false});
   if(buffering)c.state.forecastStatus=`${bufferingReason==='source-sample-unavailable'?'정확 표시 표본 대기':'GPU 다음 구간 대기'} · 정확 표시 ${lastPoseTick??'초기 장면'} Q20 · 대기 ${a.bufferedWaitSeconds.toFixed(1)}초`;
   else if(!shown.presented)c.state.forecastStatus=`Canonical 표본 없음 (${c.state.canonicalPlayback.sampleStatus}); 표시 시각 ${lastPoseTick??'초기 장면'} / 재생 시각 ${tick}`;
   else c.state.forecastStatus=`Canonical 정확 표본 · ${tick} Q20${a.result?'':' · GPU 구간 수신 중'}`;
   if(presentationChanged)c.dirty=true;if(a.result&&tick===a.endTick)finish();else if(previousPhase!==c.state.canonicalPlayback.phase)c.notify(false);
  }catch(error){abort(error,a);}
 };
 const acceptPrefix=(a,prefix)=>{
  if(active!==a||disposed||draining)return; // Late callback never revives a shot.
  if(prefix?.kind!=='canonical-application-selected-prefix-v1'||prefix.complete!==false||
   typeof prefix.assertCurrent!=='function'||typeof prefix.presentAt!=='function'||
   !Number.isSafeInteger(prefix.recordCount)||prefix.recordCount<1||
   prefix.startTick!==a.startTick||!Number.isSafeInteger(prefix.certifiedThroughTick)||
   prefix.certifiedThroughTick<a.startTick||prefix.certifiedThroughTick>a.startTick+options.budget.maximumTicks||
   (a.prefix&&(prefix.recordCount<=a.prefix.recordCount||prefix.certifiedThroughTick<a.prefix.certifiedThroughTick)))
   throw fail('CONTROLLER_PREFIX_CONTRACT','Monotone guarded source prefix required');
  prefix.assertCurrent();a.prefix=prefix;
  if(!a.presentationStarted){a.presentationStarted=true;c.state.paused=a.userPaused??false;}
  advance(0);c.notify(false);
 };
 const notify=c.notify;override('notify',(...args)=>{if(resetting)return;if(active?.result||active?.prefix){try{(active.result??active.prefix).assertCurrent();}catch(error){abort(error);return;}}checkIdleAuthority();return notify.apply(c,canonicalFrameDepth&&args.length===0?[false]:args);});
 // The base frame polls UI every120ms. Canonical busy means GPU work is pending,
 // not that another scene bitmap is needed. Preserve existing dirty/input and
 // pending-bitmap work; only default UI polling loses its implicit redraw.
 override('frame',(...args)=>{canonicalFrameDepth++;try{return original.frame.apply(c,args);}finally{canonicalFrameDepth--;}});
 const activation=capture();
 override('captureHistory',capture);override('restoreHistory',restore);
 override('reset',()=>{if(disposed||resetting)return false;resetting=true;try{c.cancelGesture();clearTimeout(c.predictionTimer);restore(activation,{silent:true});c.undoStack=[];c.redoStack=[];c.state.routeResult=null;c.state.routeApplied=null;c.state.routeStatus=search?'idle':'unavailable';c.state.routeError='';status({phase:draining?'canceling':drainFailed?'refused':'ready'});}finally{resetting=false;}c.queuePrediction();c.notify();return true;});
 for(const name of ['changeSettings','select']){const base=c[name];override(name,(...args)=>{invalidatePendingPresentation('Presentation input changed');search?.cancel('타격 입력·선택이 바뀌었습니다.',true);if(!active){generation++;cancelAdapter('future aim changed',{settlePrepared:true});forecastIntent=null;forecastReceipt=null;c.state.forecast=null;c.state.predictionBusy=false;}if(active&&name==='changeSettings')active.originalRedo=[];const value=base.apply(c,args);if(restGate){armRestPresentation(stateStore.readRevision(),c.state.canonicalPlayback.poseTick);c.notify(false);}return value;});}
 const routeOption=c.routeOption;override('routeOption',(key,value)=>key==='fourBallThreeCushion'?unsupported('게임 규칙 변경'):routeOption.call(c,key,value));
 override('invalidate',()=>{invalidatePendingPresentation('Presentation input invalidated');clearTimeout(c.predictionTimer);c.state.forecast=null;forecastReceipt=null;c.requestKey=null;if(!active){generation++;cancelAdapter('forecast invalidated',{settlePrepared:true});forecastIntent=null;c.state.predictionBusy=false;}if(restGate){armRestPresentation(stateStore.readRevision(),c.state.canonicalPlayback.poseTick);c.notify(false);}});
 override('queuePrediction',()=>{
  if(manualEnabled){scheduleManualPreparation();return;}
  if(disposed||active||draining||drainFailed||c.state.canonicalPlayback?.deviceLost||c.state.routeStatus==='searching'||!c.state.predict||!c.state.paused||c.drag)return;
  clearTimeout(c.predictionTimer);c.predictionTimer=setTimeout(async()=>{
   if(disposed||active||draining||drainFailed||c.state.canonicalPlayback?.deviceLost||c.state.routeStatus==='searching'||!c.state.predict)return;if(!gameRuleCompatible()){report('refused','Canonical 게임 규칙과 타격 옵션 불일치');return;}const token=++generation;forecastReceipt=null;forecastIntent=intent();c.state.predictionBusy=true;c.state.forecast=null;report('forecast','Canonical 정확 표본 계산 중');c.state.predictionBusy=true;c.notify(false);
   try{const r=await runSelected(request('forecast'));if(disposed||token!==generation||active)return;
    if(r.kind!=='canonical-application-selected-v1'){report('forecast-unavailable','Canonical 예측 결과 미완료');return;}
    const finalTick=r.readFinalState()[5],start=stateStore.readClock()??options.raw.absoluteTick,end=Math.min(finalTick,start+Math.floor(c.state.horizon*Q20)),tracks=[];let exact=0,missing=0;
    // Rings mark source samples only. Never connect them with legacy forecast
    // geometry or interpolate across bounded/event/missing source intervals.
    for(let i=0;i<32;i++){const tick=start+Math.floor((end-start)*i/31);const shown=r.presentAt(tick,sample=>{
      const signed=new Int32Array(sample.state.buffer,sample.state.byteOffset,sample.state.length);exact++;
      sample.slotToId.forEach((id,j)=>{const p={x:signed[j*10+1]/2**24,y:signed[j*10+2]/2**24,z:signed[j*10+3]/2**24},ring=[];
       for(let k=0;k<=8;k++){const a=k*Math.PI/4;ring.push(p.x+.003*Math.cos(a),p.y,p.z+.003*Math.sin(a));}
       tracks.push({id,color:c.lab.get(id).color,points:[],segments:[],endRing:ring,sourceTick:tick});});});if(!shown.presented)missing++;}
    r.assertCurrent();forecastReceipt=r;c.state.forecast={tracks,events:[],seconds:(end-start)/Q20,rested:r.physicsResultComplete&&end===finalTick,physicsResultComplete:r.physicsResultComplete,previewEndTick:end,finalTick,exactSourceMarkers:true,exactSamples:exact,missingSamples:missing};
    report('forecast',`Canonical 정확 표본 ${exact} · 표본 없음 ${missing}${!r.physicsResultComplete?' · 물리 결과 미완료':end===finalTick?' · 정지까지':' · 선택한 미리보기 시간까지'}`);
   }catch(error){if(token===generation&&!disposed&&!active)report('forecast-unavailable','Canonical 예측 거부: '+(error.code??error.message));}
   finally{if(token===generation)forecastIntent=null;}
  },140);
 });
 // These original handlers include drag starts which do not all call invalidate.
 for(const name of ['pointerDown','beginAimPad']){const base=c[name];override(name,(...args)=>{const previous=c.drag;invalidatePendingPresentation('Presentation interrupted by pointer input');const value=base.apply(c,args);if(manualEnabled&&!active&&c.drag&&c.drag!==previous)cancelAdapter('Manual preparation invalidated by drag start',{settlePrepared:true});return value;});}
 const fireManual=async(clickStartedAt=null,completionClaim=false)=>{
  checkIdleAuthority();if(disposed||active||draining||drainFailed||sourceUnavailable||c.state.canonicalPlayback?.deviceLost||c.drag||c.windup)return false;
  if(!gameRuleCompatible())return unsupported('서로 다른 게임 규칙과 타격 옵션');
  if(!c.game.cueIds.includes(c.state.selectedId)){c.announce('흰 수구 또는 노란 수구를 선택하세요.');return false;}
  if(manualFailure){report('refused','수동 타격 준비 실패: '+(manualFailure.message??String(manualFailure))+(manualFailure.code?' ['+manualFailure.code+']':''));return false;}
  if(restGate)clearTimeout(restGate.timer);restGate=null;status({restPresentation:null});clickStartedAt??=performance.now();
  if(manualSupersession){const stamp=stable(capture()),work=manualSupersession,version=manualVersion;status({preparedManualHit:false,preparedManualCompletionClaim:false,preparedManualDisposition:'pending-supersession',manualClickStartedAt:clickStartedAt,manualPreparationWaitMs:null});report('calculating','이전 입력의 GPU 준비 작업 종료와 초기화를 확인 중입니다 · 이후 현재 입력으로 계산합니다.');try{await work;}catch{return false;}if(manualSupersession===work)manualSupersession=null;if(disposed||active||draining||drainFailed||manualFailure||manualVersion!==version||stable(capture())!==stamp)return false;return fireManual(clickStartedAt);}
  if(manualPending&&manualTicket?.status().state==='pending'){
   const ticket=manualTicket,work=manualPending,version=manualVersion,stamp=stable(capture());
   status({preparedManualHit:false,preparedManualCompletionClaim:false,preparedManualDisposition:'pending-same-input',manualClickStartedAt:clickStartedAt,manualPreparationWaitMs:null});report('calculating','같은 입력의 GPU 타격 계산이 진행 중입니다 · 완료 후 검증된 결과를 재생합니다.');
   try{await work;}catch{return false;}
   if(disposed||active||draining||drainFailed||manualVersion!==version||manualTicket!==ticket||stable(capture())!==stamp)return false;
   return fireManual(clickStartedAt,true);
  }
  if(manualPending&&manualTicket?.status().state!=='ready'){const stamp=stable(capture());cancelAdapter('Pending manual preparation replaced by Strike',{settlePrepared:true});const work=manualSupersession,version=manualVersion;if(!work)throw fail('CONTROLLER_MANUAL_SUPERSESSION','Owned supersession settlement missing');status({preparedManualHit:false,preparedManualMiss:'pending',manualClickStartedAt:clickStartedAt,manualPreparationWaitMs:null});report('calculating','이전 수동 준비 작업 완료 대기 중 · 현재 타격은 새 입력으로 계산됩니다.');try{await work;}catch{return false;}if(manualPending===work)manualPending=null;if(manualTicket?.status().state==='invalidated')manualTicket=null;if(disposed||active||drainFailed||manualVersion!==version||stable(capture())!==stamp)return false;return fireManual(clickStartedAt);}
  let prepared=null;
  if(manualTicket){try{prepared=adapter.claimPreparedManual(manualTicket);}catch(error){manualFailure=error;report('refused','수동 타격 준비 결과 거부: '+(error.message??String(error))+(error.code?' ['+error.code+']':''));return false;}manualTicket=null;}
  search?.cancel('수동 타격으로 검색 결과를 무효화했습니다.',true);clearTimeout(c.predictionTimer);clearTimeout(manualTimer);manualTimer=null;generation++;if(!prepared)cancelAdapter('manual replaces forecast');else manualVersion++;forecastIntent=null;forecastReceipt=null;c.state.forecast=null;c.state.predictionBusy=false;status({preparedManualHit:!!prepared&&!completionClaim,preparedManualCompletionClaim:!!prepared&&completionClaim,preparedManualDisposition:prepared?(completionClaim?'pending-completion-claim':'ready-hit'):'fresh-run',manualClickStartedAt:clickStartedAt,manualPreparationWaitMs:performance.now()-clickStartedAt,manualPreparation:{enabled:manualEnabled,state:prepared?'claimed':'empty'}});
  const before=capture(),startTick=stateStore.readClock()??options.raw.absoluteTick,a={intent:intent(),before,result:null,prefix:null,startTick,playhead:startTick,bufferedWaitSeconds:0,bufferedWallMs:0,bufferedAt:null,presentationStarted:false,originalUndo:c.undoStack.slice(),originalRedo:c.redoStack.slice()};active=a;c.state.paused=true;c.state.previewCueVisible=false;c.state.cuePull=0;status({awaitingFirstPrefix:true,streaming:false,prefixRecordCount:0,availableUntilTick:null,buffering:false,bufferingReason:null,bufferedWaitSeconds:0,physicsResultComplete:false,scoreAndTurnCommitted:false});if(!prepared)report('calculating','Canonical 수동 타격 계산 중');
  try{const r=prepared??await runSelected({...request('manual'),onPrefix:prefix=>acceptPrefix(a,prefix)});if(active!==a||disposed)return false;
   if(r.kind!=='canonical-application-selected-v1'||!r.physicsResultComplete||typeof r.commitState!=='function')throw fail('CONTROLLER_SHOT_INCOMPLETE','Complete manual REST required');
   prepareCanonicalGameProjection({scene:stateStore.readScene(),game:c.game.snapshot(),selectedId:a.intent.selectedId,result:r});
   if(prepared){await awaitPreparedPresentation(a,r);if(active!==a||disposed)return false;}
   const end=r.readFinalState()[5],start=stateStore.readClock()??options.raw.absoluteTick;
   if(a.prefix&&end<a.prefix.certifiedThroughTick)throw fail('CONTROLLER_PREFIX_CONTRACT','Final REST precedes certified prefix');
   updateBufferWait(a,false);a.entry={before,kind:'shot'};a.result=r;a.endTick=end;if(!a.presentationStarted){a.presentationStarted=true;c.state.paused=a.userPaused??false;}status({phase:'playing',awaitingFirstPrefix:false,buffering:false,bufferingReason:null,availableUntilTick:end,physicsResultComplete:true,playheadTick:Math.floor(a.playhead),poseTick:lastPoseTick,scoreAndTurnCommitted:false});c.notify(false);advance(0);return true;
  }catch(error){if(active===a)abort(error,a);return false;}
 };
 override('fire',()=>fireManual());
 override('pause',(value=true)=>{if(active?.presentationPending&&!value)return false;if(!value&&!active)return unsupported('타격 없는 물리 재생');if(active){active.userPaused=value;if(value)updateBufferWait(active,false);}c.state.paused=value;c.accumulator=0;if(value&&!active)c.queuePrediction();c.notify();});
 override('finishGameShot',()=>{});
 override('undo',()=>{if(draining||drainFailed)return false;if(!active&&manualTicket){cancelAdapter('Undo invalidates manual preparation');if(draining)return false;}if(c.drag?.type==='ball'&&c.drag.changed){c.cancelGesture();return true;}c.cancelGesture();if(active){const a=active;const entry=a.entry;rollbackHistory(a);if(entry)c.redoStack=[entry];restore(a.before);return true;}
  const entry=c.undoStack.pop();if(!entry)return false;entry.after=capture();c.redoStack.push(entry);restore(entry.before);return true;});
 override('redo',()=>{if(active||draining||drainFailed)return false;if(manualTicket){cancelAdapter('Redo invalidates manual preparation');if(draining)return false;}c.cancelGesture();const entry=c.redoStack.pop();if(!entry)return false;
  if(entry.after){restore(entry.after);c.undoStack.push(entry);c.notify();return true;}
  const remaining=c.redoStack.slice();restore(entry.before);const promise=c.fire();if(active)active.originalRedo=[...remaining,entry];c.redoStack=remaining;return promise;});
 override('move',(id,p,{interactive=false}={})=>{
  if(disposed||active||draining||drainFailed||sourceUnavailable||c.state.canonicalPlayback?.deviceLost||c.windup||c.game?.pending)return false;
  const revision=stateStore.readRevision(),body=stateStore.readScene().physical.bodies.find(b=>b.id===id);
  if(!body||!p||Object.keys(p).some(k=>!['x','y','z'].includes(k))||(Object.hasOwn(p,'y')&&p.y!==body.pos.y))return false;
  const before=interactive?null:capture();
  try{if(!stateStore.placeBall({id,position:{x:p.x,z:p.z},expectedRevision:revision}))return false;}
  catch(error){if(!interactive)c.announce('배치 거부: '+(error.message??String(error)));return false;}
  clearTimeout(c.predictionTimer);cancel('공 배치가 바뀌었습니다.',{settlePrepared:true});c.state.forecast=null;refresh();status({phase:'ready'});
  if(interactive){c.inputPending=true;c.dirty=true;}else{c.commitHistory(before);c.queuePrediction();c.notify();}return true;
 });
 override('setPosition',p=>{const body=stateStore.readScene().physical.bodies.find(b=>b.id===c.state.selectedId);
  if(!body||!p||Object.keys(p).some(k=>!['x','z'].includes(k)))return false;
  return c.move(body.id,{x:Object.hasOwn(p,'x')?p.x:body.pos.x,z:Object.hasOwn(p,'z')?p.z:body.pos.z});});
 for(const name of ['setHeight','add','remove','params','setGameMode'])override(name,()=>unsupported('장면·재질·게임 변경'));
 if(searchService){search=createCanonicalControllerSearch({controller:c,stateStore,selectedWorldProfile,service:searchService,searchOptions,makeRequest:request,rawMaximumSteps:options.raw.maximumSteps??2048,
  canStart:()=>!disposed&&!active&&!draining&&!drainFailed&&!sourceUnavailable&&!c.state.canonicalPlayback?.deviceLost&&!c.drag&&!c.windup&&c.state.paused&&gameRuleCompatible(),
  beforeSearch:()=>{clearTimeout(c.predictionTimer);generation++;cancelAdapter('search replaces forecast');forecastIntent=null;forecastReceipt=null;c.state.forecast=null;c.state.predictionBusy=false;},
  beforeApply:()=>{c.state.paused=true;}});
  override('startSearch',async extra=>{if(manualEnabled&&manualPending&&manualTicket?.status().state!=='ready'){const stamp=stable(capture());cancelAdapter('Search replaces pending manual preparation');const version=manualVersion;try{if(draining)await draining;}catch{return false;}if(disposed||active||drainFailed||manualVersion!==version||stable(capture())!==stamp)return false;}return search.start(extra);});override('stopSearch',search.stop);override('applyRoute',search.apply);
  override('updateCanonicalSearchGrid',input=>{const domain=search.update(input);status({searchDomain:domain});c.notify();return domain;});
  override('cancelSearch',(reason='검색 취소',invalidate=true)=>search.cancel(reason,invalidate));
  for(const name of ['startFinalizedSearch','startSearchRequest','resumeSearch'])override(name,()=>unsupported('별도 요청·이어서 탐색'));
 }else for(const name of ['startSearch','startFinalizedSearch','startSearchRequest','resumeSearch','applyRoute'])override(name,()=>{c.state.routeStatus='unavailable';c.state.routeError='Canonical 같은 모델 배치 검색 미연결 · 기존 CPU 검증으로 대체하지 않음';c.notify();return false;});
 override('step',()=>{if(!active?.result&&!active?.prefix)return unsupported('독립 물리 스텝');const paused=c.state.paused;c.state.paused=false;advance(16*c.lab.dt);c.state.paused=active?paused:true;c.notify();});
 override('advanceSeconds',seconds=>{if(!Number.isFinite(seconds)||seconds<0)throw RangeError('Finite nonnegative playback duration');if(!active?.result&&!active?.prefix)return unsupported('독립 물리 진행');const paused=c.state.paused;c.state.paused=false;advance(seconds/c.state.rate);c.state.paused=active?paused:true;c.notify();});
 override('worldStamp',()=>stable({revision:stateStore.readRevision(),sceneId:stateStore.readScene().sceneId,game:c.game.snapshot()}));
 override('dispose',()=>{if(disposed)return;unsubscribeRestPresentation?.();unsubscribeRestPresentation=null;if(ownedRenderer.render===renderWithRestToken)ownedRenderer.render=renderBefore;clearTimeout(manualTimer);manualTimer=null;disposed=true;search?.dispose();cancel('controller disposed');adapter.dispose();original.dispose.call(c);});
 const owner=Object.freeze({kind:'canonical-controller-owner-v1',experimental:true,productionEnabled:false,implementation:harness?'injected-controller-test':'webgpu-selected-controller',advance,
  readCommittedState(){if(disposed)throw fail('CONTROLLER_DISPOSED','Controller is disposed');return stateStore.readFinalState();},
  capabilities:Object.freeze({search:!!search,sceneEdits:'resting-xz-only',legacyMigration:false,historyMigration:false,exactSourceSamplesOnly:true,browserVerified:false}),
  setManualPreparationEnabled,acknowledgeRestLayout,
  acknowledgePresentationReady:token=>acknowledgePresentation(token,false),
  cancelAndDrain,cancelAndReset,cancel(){const promise=cancelAndDrain();promise.catch(()=>{});return promise;}});
 clearTimeout(c.predictionTimer);c.predictor?.dispose();c.optimizer?.dispose();c.predictor=null;c.optimizer=null;
 c.canonicalPlayback=owner;status({phase:'ready',manualPreparation:{enabled:false,state:'disabled'},preparedManualHit:false,nativePreparation:readPreparation(),selectedWorldProfile,experimental:true,productionEnabled:false,scoreAndTurnCommitted:false,searchEnabled:!!search,searchDomain:search?.domain??null});refresh();legacy.dispose();c.state.forecast=null;c.state.routeResult=null;c.state.routeStatus=search?'idle':'unavailable';c.state.routeError=search?'':'Canonical 같은 모델 배치 검색 미연결';
 // Ownership has committed and the legacy lab is disposed. Presentation errors
 // must not escape as an installation failure and trigger entry resource rollback.
 try{c.notify();}catch(error){status({entryWarning:'GPU 모드는 시작됐지만 화면 갱신에 실패했습니다: '+(error.message??String(error))});}
 return owner;
}
export function installCanonicalController(controller,options){return install(controller,options,false);}
/** Lifecycle-only injected backend; never included as native/GPU evidence. */
export function installCanonicalControllerHarness(controller,options){return install(controller,options,true);}
