/** Explicit experimental integration into ONE already-mounted LabController.
 * No automatic activation, device request, legacy import, or search fallback. */
import {validateCanonicalScene,CanonicalContractError} from './canonical-engine-contract.mjs';
import {createCanonicalStateApplicationAdapter,createCanonicalStateApplicationAdapterHarness,canonicalApplicationRules} from './canonical-application-adapter.mjs';
import {createCanonicalRenderView,prepareCanonicalGameProjection} from './canonical-controller-projection.mjs';
import {createCanonicalControllerSearch,canonicalSearchPopulation} from './canonical-controller-search.mjs';
const own=x=>structuredClone(x),Q20=2**20;
const fail=(code,message)=>new CanonicalContractError(code,message);
const stable=x=>Array.isArray(x)?'['+x.map(stable).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}':JSON.stringify(x);
function install(controller,{stateStore,selectedWorldProfile,device,requestOptions,session,searchService,searchOptions},harness) {
 const c=controller,G=globalThis;
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
 if(searchService){if(searchService.selectedWorldProfile!==selectedWorldProfile||typeof searchService.runSearch!=='function'||typeof searchService.cancel!=='function')throw TypeError('Matching canonical search service required');canonicalSearchPopulation(searchOptions);}
 if(searchService&&!harness&&(searchService.capabilities?.implementation!=='webgpu-sealed-compact-search-v1'||searchService.capabilities?.compactBatch!==true||!/^[a-f0-9]{64}$/.test(searchService.sourceRevision??'')))
  throw fail('CONTROLLER_SEARCH_SOURCE','Production search requires the packaged sealed GPU service; injected services belong to the harness');
 const options=own(requestOptions),legacy=c.lab,original={};
 let active=null,forecastIntent=null,sequence=0,generation=0,disposed=false,projection,shots=0,lastPoseTick=null,renderRevision=null,forecastReceipt=null,sourceUnavailable=false,search=null,resetting=false;
 const gameRuleCompatible=()=>c.state.gameMode!=='four'||c.game.threeCushion===!!c.state.routeOptions.fourBallThreeCushion;
 const intent=()=>({selectedId:c.state.selectedId,settings:own(c.state.settings),game:c.game.snapshot()});
 // Freeze selected cue/aim for this shot, but never freeze away live game edits.
 const readContext=()=>{if(!gameRuleCompatible())throw fail('CONTROLLER_RULE_BOUNDARY','Live game and shot rule option disagree');const i=active?.intent??forecastIntent;return i?{selectedId:i.selectedId,settings:own(i.settings),game:c.game.snapshot()}:intent();};
 const adapter=(harness?createCanonicalStateApplicationAdapterHarness:createCanonicalStateApplicationAdapter)({stateStore,selectedWorldProfile,device,readContext,...(harness?{session}:{})});
 const status=patch=>{c.state.canonicalPlayback={...c.state.canonicalPlayback,...patch};};
 const refresh=()=>{sourceUnavailable=false;renderRevision=stateStore.readRevision();projection=createCanonicalRenderView({scene:stateStore.readScene(),pose:G.PhysicsLab.prototype.pose,isBusy:()=>!!active||sourceUnavailable});c.lab=projection.view;c.lab.shots=shots;lastPoseTick=stateStore.readClock()??null;c.lab.time=(lastPoseTick??0)/Q20;status({poseTick:lastPoseTick,playheadTick:lastPoseTick,sampleStatus:stateStore.readFinalState()?'authoritative-rest':'authored-rest',held:false,scoreAndTurnCommitted:false});c.dirty=true;};
 const report=(phase,message)=>{status({phase});c.state.forecastStatus=message;c.state.predictionBusy=false;c.notify();};
 const cancel=(reason)=>{search?.cancel(reason,true);generation++;adapter.cancel(reason);forecastIntent=null;forecastReceipt=null;active=null;c.state.predictionBusy=false;c.state.paused=true;};
 const unsupported=what=>{c.announce(`실험적 canonical 모드: ${what}은 아직 지원하지 않습니다. 기존 엔진으로 대체하지 않습니다.`);return false;};
 const capture=()=>({canonicalState:stateStore.snapshot(),selectedId:c.state.selectedId,settings:own(c.state.settings),paused:true,
  gameMode:c.state.gameMode,game:c.game.snapshot(),canonicalShots:shots});
 const restore=(saved,{silent=false}={})=>{if(!saved?.canonicalState)throw fail('CONTROLLER_HISTORY_SOURCE','Canonical owner snapshots only; no legacy migration');
  cancel('history restore');stateStore.restore(saved.canonicalState);shots=saved.canonicalShots;c.game.restore(saved.game);
  Object.assign(c.state,{selectedId:saved.selectedId,settings:own(saved.settings),paused:true,gameMode:saved.gameMode,cuePull:0,gesture:'',forecast:null});
  c.accumulator=0;c.cooldownUntil=0;refresh();c.repairRouteTargets();if(!silent){c.queuePrediction();c.notify();}};
 const request=purpose=>{const id=++sequence;if(id>0xffffffff)throw fail('CONTROLLER_ID_EXHAUSTED','Install a new explicit owner');
  return {...own(options),purpose,requestId:id,candidateId:id,raw:{...own(options.raw),absoluteTick:stateStore.readClock()??options.raw.absoluteTick}};};
 const override=(name,fn)=>{original[name]=c[name];c[name]=fn;};
 const rollbackHistory=a=>{if(a){c.undoStack=a.originalUndo.slice();c.redoStack=a.originalRedo.slice();}};
 const checkIdleAuthority=()=>{if(active||disposed)return;search?.check();try{if(renderRevision!==stateStore.readRevision()){forecastReceipt=null;c.state.forecast=null;refresh();status({phase:'source-changed'});}if(forecastReceipt)forecastReceipt.assertCurrent();}
  catch(error){forecastReceipt=null;c.state.forecast=null;status({phase:'stale-source',sampleStatus:'source-invalid',held:true});c.state.forecastStatus='Canonical 표시 결과가 현재 소스와 다릅니다. 다시 계산하세요.';try{stateStore.readRevision();}catch{sourceUnavailable=true;c.state.paused=true;}}};
 const abort=(error,a=active)=>{if(a!==active)return;rollbackHistory(a);cancel('canonical result refused');try{refresh();}catch{sourceUnavailable=true;status({sampleStatus:'source-invalid',held:true});}c.state.forecast=null;report('refused','Canonical 거부: '+(error.code??error.message??String(error)));};
 const finish=()=>{const a=active;if(!a?.result)return;
  // Every value is derived/validated before the atomic state commit. Never
  // access the precommit result again after its source revision changes.
  const game=prepareCanonicalGameProjection({scene:stateStore.readScene(),game:c.game.snapshot(),selectedId:a.intent.selectedId,result:a.result});
  a.result.assertCurrent();const commit=a.result.commitState();
  c.game.restore(game.snapshot);c.state.selectedId=game.result.nextCue;shots++;active=null;c.state.paused=true;refresh();
  c.repairRouteTargets();c.state.forecast=null;status({phase:'rest',commitRevision:commit.revision,scoreAndTurnCommitted:true});
  c.state.forecastStatus='Canonical 정지·점수·차례 반영 완료';c.notify();
 };
 const advance=elapsed=>{checkIdleAuthority();if(active?.result){try{active.result.assertCurrent();}catch(error){abort(error);return;}}if(!active?.result||c.state.paused||c.drag)return;const a=active;
  try{a.result.assertCurrent();a.playhead=Math.min(a.endTick,a.playhead+Math.max(0,elapsed)*c.state.rate*Q20);const tick=Math.floor(a.playhead);
   const shown=a.result.presentAt(tick,sample=>{projection.present(sample);lastPoseTick=tick;});
   status({phase:'playing',playheadTick:tick,poseTick:lastPoseTick,sampleStatus:shown.presented?shown.sample.status:!a.result.captureComplete?'capture-incomplete':shown.sample.status??'unavailable',held:!shown.presented,
    captureComplete:a.result.captureComplete,samplingComplete:a.result.samplingComplete});
   if(!shown.presented)c.state.forecastStatus=`Canonical 표본 없음 (${c.state.canonicalPlayback.sampleStatus}); 표시 시각 ${lastPoseTick??'초기 장면'} / 재생 시각 ${tick}`;
   else c.state.forecastStatus=`Canonical 정확 표본 · ${tick} Q20`;
   c.dirty=true;if(tick===a.endTick)finish();
  }catch(error){abort(error,a);}
 };
 const notify=c.notify;override('notify',(...args)=>{if(resetting)return;if(active?.result){try{active.result.assertCurrent();}catch(error){abort(error);return;}}checkIdleAuthority();return notify.apply(c,args);});
 const activation=capture();
 override('captureHistory',capture);override('restoreHistory',restore);
 override('reset',()=>{if(disposed||resetting)return false;resetting=true;try{c.cancelGesture();clearTimeout(c.predictionTimer);restore(activation,{silent:true});c.undoStack=[];c.redoStack=[];c.state.routeResult=null;c.state.routeApplied=null;c.state.routeStatus=search?'idle':'unavailable';c.state.routeError='';status({phase:'ready'});}finally{resetting=false;}c.queuePrediction();c.notify();return true;});
 for(const name of ['changeSettings','select']){const base=c[name];override(name,(...args)=>{search?.cancel('타격 입력·선택이 바뀌었습니다.',true);if(!active){generation++;adapter.cancel('future aim changed');forecastIntent=null;forecastReceipt=null;c.state.forecast=null;c.state.predictionBusy=false;}if(active&&name==='changeSettings')active.originalRedo=[];return base.apply(c,args);});}
 const routeOption=c.routeOption;override('routeOption',(key,value)=>key==='fourBallThreeCushion'?unsupported('게임 규칙 변경'):routeOption.call(c,key,value));
 override('invalidate',()=>{clearTimeout(c.predictionTimer);c.state.forecast=null;forecastReceipt=null;c.requestKey=null;if(!active){generation++;adapter.cancel('forecast invalidated');forecastIntent=null;c.state.predictionBusy=false;}});
 override('queuePrediction',()=>{
  if(disposed||active||c.state.canonicalPlayback?.deviceLost||c.state.routeStatus==='searching'||!c.state.predict||!c.state.paused||c.drag)return;
  clearTimeout(c.predictionTimer);c.predictionTimer=setTimeout(async()=>{
   if(disposed||active||c.state.canonicalPlayback?.deviceLost||c.state.routeStatus==='searching'||!c.state.predict)return;if(!gameRuleCompatible()){report('refused','Canonical 게임 규칙과 타격 옵션 불일치');return;}const token=++generation;forecastReceipt=null;forecastIntent=intent();c.state.predictionBusy=true;c.state.forecast=null;report('forecast','Canonical 정확 표본 계산 중');c.state.predictionBusy=true;c.notify(false);
   try{const r=await adapter.runSelected(request('forecast'));if(disposed||token!==generation||active)return;
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
 override('fire',async()=>{
  checkIdleAuthority();if(disposed||active||sourceUnavailable||c.state.canonicalPlayback?.deviceLost||c.drag||c.windup)return false;
  if(!gameRuleCompatible())return unsupported('서로 다른 게임 규칙과 타격 옵션');
  if(!c.game.cueIds.includes(c.state.selectedId)){c.announce('흰 수구 또는 노란 수구를 선택하세요.');return false;}
  search?.cancel('수동 타격으로 검색 결과를 무효화했습니다.',true);clearTimeout(c.predictionTimer);generation++;adapter.cancel('manual replaces forecast');forecastIntent=null;forecastReceipt=null;c.state.forecast=null;c.state.predictionBusy=false;
  const before=capture(),a={intent:intent(),before,result:null,originalUndo:c.undoStack.slice(),originalRedo:c.redoStack.slice()};active=a;c.state.paused=true;c.state.previewCueVisible=false;c.state.cuePull=0;report('calculating','Canonical 수동 타격 계산 중');
  try{const r=await adapter.runSelected(request('manual'));if(active!==a||disposed)return false;
   if(r.kind!=='canonical-application-selected-v1'||!r.physicsResultComplete||typeof r.commitState!=='function')throw fail('CONTROLLER_SHOT_INCOMPLETE','Complete manual REST required');
   prepareCanonicalGameProjection({scene:stateStore.readScene(),game:c.game.snapshot(),selectedId:a.intent.selectedId,result:r});
   const end=r.readFinalState()[5],start=stateStore.readClock()??options.raw.absoluteTick;
   c.commitHistory(before,'shot');a.entry=c.undoStack.at(-1);a.result=r;a.playhead=start;a.endTick=end;c.state.paused=false;status({phase:'playing',playheadTick:start,poseTick:lastPoseTick,sampleStatus:'not-sampled',held:true,scoreAndTurnCommitted:false});c.notify();advance(0);return true;
  }catch(error){if(active===a)abort(error,a);return false;}
 });
 override('pause',(value=true)=>{if(!value&&!active)return unsupported('타격 없는 물리 재생');c.state.paused=value;c.accumulator=0;if(value&&!active)c.queuePrediction();c.notify();});
 override('finishGameShot',()=>{});
 override('undo',()=>{if(c.drag?.type==='ball'&&c.drag.changed){c.cancelGesture();return true;}c.cancelGesture();if(active){const a=active;const entry=a.entry;rollbackHistory(a);if(entry)c.redoStack=[entry];restore(a.before);return true;}
  const entry=c.undoStack.pop();if(!entry)return false;entry.after=capture();c.redoStack.push(entry);restore(entry.before);return true;});
 override('redo',()=>{if(active)return false;c.cancelGesture();const entry=c.redoStack.pop();if(!entry)return false;
  if(entry.after){restore(entry.after);c.undoStack.push(entry);c.notify();return true;}
  const remaining=c.redoStack.slice();restore(entry.before);const promise=c.fire();if(active)active.originalRedo=[...remaining,entry];c.redoStack=remaining;return promise;});
 override('move',(id,p,{interactive=false}={})=>{
  if(disposed||active||sourceUnavailable||c.state.canonicalPlayback?.deviceLost||c.windup||c.game?.pending)return false;
  const revision=stateStore.readRevision(),body=stateStore.readScene().physical.bodies.find(b=>b.id===id);
  if(!body||!p||Object.keys(p).some(k=>!['x','y','z'].includes(k))||(Object.hasOwn(p,'y')&&p.y!==body.pos.y))return false;
  const before=interactive?null:capture();
  try{if(!stateStore.placeBall({id,position:{x:p.x,z:p.z},expectedRevision:revision}))return false;}
  catch(error){if(!interactive)c.announce('배치 거부: '+(error.message??String(error)));return false;}
  clearTimeout(c.predictionTimer);cancel('공 배치가 바뀌었습니다.');c.state.forecast=null;refresh();status({phase:'ready'});
  if(interactive){c.inputPending=true;c.dirty=true;}else{c.commitHistory(before);c.queuePrediction();c.notify();}return true;
 });
 override('setPosition',p=>{const body=stateStore.readScene().physical.bodies.find(b=>b.id===c.state.selectedId);
  if(!body||!p||Object.keys(p).some(k=>!['x','z'].includes(k)))return false;
  return c.move(body.id,{x:Object.hasOwn(p,'x')?p.x:body.pos.x,z:Object.hasOwn(p,'z')?p.z:body.pos.z});});
 for(const name of ['setHeight','add','remove','params','setGameMode'])override(name,()=>unsupported('장면·재질·게임 변경'));
 if(searchService){search=createCanonicalControllerSearch({controller:c,stateStore,selectedWorldProfile,service:searchService,searchOptions,makeRequest:request,rawMaximumSteps:options.raw.maximumSteps??2048,
  canStart:()=>!disposed&&!active&&!sourceUnavailable&&!c.state.canonicalPlayback?.deviceLost&&!c.drag&&!c.windup&&c.state.paused&&gameRuleCompatible(),
  beforeSearch:()=>{clearTimeout(c.predictionTimer);generation++;adapter.cancel('search replaces forecast');forecastIntent=null;forecastReceipt=null;c.state.forecast=null;c.state.predictionBusy=false;},
  beforeApply:()=>{c.state.paused=true;}});
  override('startSearch',search.start);override('stopSearch',search.stop);override('applyRoute',search.apply);
  override('updateCanonicalSearchGrid',input=>{const domain=search.update(input);status({searchDomain:domain});c.notify();return domain;});
  override('cancelSearch',(reason='검색 취소',invalidate=true)=>search.cancel(reason,invalidate));
  for(const name of ['startFinalizedSearch','startSearchRequest','resumeSearch'])override(name,()=>unsupported('별도 요청·이어서 탐색'));
 }else for(const name of ['startSearch','startFinalizedSearch','startSearchRequest','resumeSearch','applyRoute'])override(name,()=>{c.state.routeStatus='unavailable';c.state.routeError='Canonical 같은 모델 배치 검색 미연결 · 기존 CPU 검증으로 대체하지 않음';c.notify();return false;});
 override('step',()=>{if(!active?.result)return unsupported('독립 물리 스텝');const paused=c.state.paused;c.state.paused=false;advance(16*c.lab.dt);c.state.paused=active?paused:true;c.notify();});
 override('advanceSeconds',seconds=>{if(!Number.isFinite(seconds)||seconds<0)throw RangeError('Finite nonnegative playback duration');if(!active?.result)return unsupported('독립 물리 진행');const paused=c.state.paused;c.state.paused=false;advance(seconds/c.state.rate);c.state.paused=active?paused:true;c.notify();});
 override('worldStamp',()=>stable({revision:stateStore.readRevision(),sceneId:stateStore.readScene().sceneId,game:c.game.snapshot()}));
 override('dispose',()=>{if(disposed)return;disposed=true;search?.dispose();cancel('controller disposed');adapter.dispose();original.dispose.call(c);});
 const owner=Object.freeze({kind:'canonical-controller-owner-v1',experimental:true,productionEnabled:false,implementation:harness?'injected-controller-test':'webgpu-selected-controller',advance,
  readCommittedState(){if(disposed)throw fail('CONTROLLER_DISPOSED','Controller is disposed');return stateStore.readFinalState();},
  capabilities:Object.freeze({search:!!search,sceneEdits:'resting-xz-only',legacyMigration:false,historyMigration:false,exactSourceSamplesOnly:true,browserVerified:false}),
  cancel(){if(active){const a=active;rollbackHistory(a);restore(a.before);}else{cancel('explicit cancellation');refresh();c.notify();}}});
 clearTimeout(c.predictionTimer);c.predictor?.dispose();c.optimizer?.dispose();c.predictor=null;c.optimizer=null;
 c.canonicalPlayback=owner;status({phase:'ready',selectedWorldProfile,experimental:true,productionEnabled:false,scoreAndTurnCommitted:false,searchEnabled:!!search,searchDomain:search?.domain??null});refresh();legacy.dispose();c.state.forecast=null;c.state.routeResult=null;c.state.routeStatus=search?'idle':'unavailable';c.state.routeError=search?'':'Canonical 같은 모델 배치 검색 미연결';c.notify();
 return owner;
}
export function installCanonicalController(controller,options){return install(controller,options,false);}
/** Lifecycle-only injected backend; never included as native/GPU evidence. */
export function installCanonicalControllerHarness(controller,options){return install(controller,options,true);}
