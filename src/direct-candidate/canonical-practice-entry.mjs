/** Explicit fresh practice preset. Never imports or normalizes the live world.
 * Static geometry comes from a NEW unstepped authored table; bodies are authored
 * at their declared resting height before canonical admission, not moved/snapped. */
import {encodeCanonicalScene,CANONICAL_DEFAULT_PARAMETERS} from './canonical-engine-contract.mjs';
import {createCanonicalStateStore} from './canonical-state-store.mjs';
const own=x=>structuredClone(x),zero=()=>({x:0,y:0,z:0});
const pending=new WeakSet();
export function createCanonicalPracticePreset({PhysicsLab=globalThis.PhysicsLab,RAPIER=globalThis.RAPIER,selectedWorldProfile='mmq2-cushion'}={}){
 if(!['mmq1-ball-ball','mmq2-cushion'].includes(selectedWorldProfile))throw TypeError('명시된 canonical 프로필이 필요합니다.');
 if(typeof PhysicsLab!=='function'||!RAPIER)throw Error('초기화된 기본 테이블 형상이 필요합니다.');
 const template=new PhysicsLab(RAPIER);let snapshot;try{snapshot=template.snapshot({trails:false});}finally{template.dispose();}
 if(snapshot.steps!==0||snapshot.time!==0)throw Error('새 게임은 시뮬레이션하지 않은 테이블에서만 시작합니다.');
 const R=.03075,positions=[[-.5,R,-.1],[-.42,R,-.08],[-.38645598584933644,R,-.1441006472903296],[.8,R,-.5]],ids=[50,8,300,19],labels=['흰 수구','빨간 공 A','빨간 공 B','노란 수구'],colors=['#f6f3e9','#e34b55','#c92a3c','#f2c94c'];
 snapshot.params={...CANONICAL_DEFAULT_PARAMETERS};snapshot.objects=positions.map(([x,y,z],i)=>({id:ids[i],shape:'sphere',kind:'ball',radius:R,mass:.210,pos:{x,y,z},v:zero(),w:zero(),rot:{x:0,y:0,z:0,w:1},label:labels[i],color:colors[i]}));
 const admission=encodeCanonicalScene(snapshot,{objectIds:ids,staticCount:snapshot.statics.length});if(!admission.admitted)throw Error('새 canonical 연습 배치가 지원 범위를 벗어났습니다.');
 return {scene:admission.scene,selectedWorldProfile,selectedId:50,settings:{angle:0,elevation:25,speed:.5,tipX:0,tipY:.2},
  searchOptions:{parameterGrid:{angles:[-2,0,2],speeds:[.5,.6,.7],elevations:[25],tipXs:[0],tipYs:[.2]},maximumCandidates:4096},
  requestOptions:{executionProfile:'canonical-local-v1',budget:{maximumTicks:2**24,maximumEvents:1024,maximumWorkItems:1000000},raw:{absoluteTick:0,sceneKey:11,requestKey:23,maximumSteps:2048},continuation:{durationTicks:65535,budgets:[2000,2000,20000,20000,20000,20000,20000],maxWorldSteps:128},maximumRecords:256,strikeBackend:'staged'}};
}
function ready(c){if(!c?.state?.ready||!c.lab||c.disposed||c.canonicalPlayback)throw Error('새 GPU 연습을 시작할 수 있는 기본 화면이 아닙니다.');
 if(!c.state.paused||c.lab.cue||c.lab.anyMotion()||c.game?.pending||c.drag||c.windup||c.state.routeStatus==='searching')throw Error('현재 타격·탐색을 마치고 공이 멈춘 뒤 시작하세요.');
 if(c.undoStack.length||c.redoStack.length)throw Error('기존 기록은 옮기지 않습니다. 먼저 기본 게임을 초기화한 뒤 다시 시작하세요.');}
/** Internal dependency seam. Public browser wrapper owns install/device APIs. */
export async function startCanonicalPracticeInternal(c,{install,requestDevice,disposeDevice,signal,selectedWorldProfile='mmq2-cushion'}={}){
 if(!['mmq1-ball-ball','mmq2-cushion'].includes(selectedWorldProfile))throw TypeError('명시된 canonical 프로필이 필요합니다.');
 ready(c);if(pending.has(c))throw Error('이미 새 GPU 연습을 준비 중입니다.');if(typeof install!=='function'||typeof requestDevice!=='function')throw TypeError('Owned browser installer/device request required');
 if(disposeDevice!==undefined&&typeof disposeDevice!=='function')throw TypeError('Owned device cleanup required');
 let cleanupStarted=false,cleanupResult;
 const cleanupDevice=device=>{if(!cleanupStarted){cleanupStarted=true;cleanupResult=disposeDevice?disposeDevice(device):device.destroy();}return cleanupResult;};
 const source={lab:c.lab,game:c.game,stamp:c.worldStamp(),settings:JSON.stringify(c.state.settings),routeOptions:JSON.stringify(c.state.routeOptions)};
 const check=()=>{if(signal?.aborted)throw Error('GPU 연습 시작을 취소했습니다.');ready(c);if(c.lab!==source.lab||c.game!==source.game||c.worldStamp()!==source.stamp||JSON.stringify(c.state.settings)!==source.settings||JSON.stringify(c.state.routeOptions)!==source.routeOptions)throw Error('준비 중 현재 게임이 바뀌었습니다. 다시 시작하세요.');};pending.add(c);let device,store,installed=false;
 try{check();device=await requestDevice();check();const preset=createCanonicalPracticePreset({selectedWorldProfile});store=createCanonicalStateStore({scene:preset.scene,selectedWorldProfile:preset.selectedWorldProfile});
  const saved={game:c.game,gameMode:c.state.gameMode,selectedId:c.state.selectedId,settings:c.state.settings,routeOptions:c.state.routeOptions,predict:c.state.predict,activePanel:c.state.activePanel};
  try{check();c.game=new globalThis.FourBallGame([50,19],[8,300],{threeCushion:false});c.state.gameMode='four';c.state.selectedId=preset.selectedId;c.state.settings=own(preset.settings);c.state.routeOptions={...c.state.routeOptions,fourBallThreeCushion:false};c.state.predict=false;c.state.activePanel='routes';
   const owner=install(c,{stateStore:store,device,selectedWorldProfile:preset.selectedWorldProfile,requestOptions:preset.requestOptions,searchOptions:preset.searchOptions});installed=true;
   const dispose=c.dispose;c.dispose=function(...args){try{return dispose.apply(this,args);}finally{store.dispose();const cleanup=cleanupDevice(device);if(cleanup?.then)cleanup.catch(error=>{c.state.canonicalPlayback??={};c.state.canonicalPlayback.disposalError=error.message??String(error);});}};
   device.lost?.then(info=>{if(c.disposed)return;
    // Capture before cancellation: cancel/late search completions can replace
    // routeError and progress. Keep the original loss evidence independently.
    c.state.canonicalPlayback??={};
    const progress=c.state.routeProgress;
    const deviceLoss=Object.freeze({reason:info.reason??'unknown',message:info.message??'',timestamp:new Date().toISOString(),
     phase:c.state.canonicalPlayback.phase??'ready',routeStatus:c.state.routeStatus,
     searchProgress:progress?Object.freeze(Object.fromEntries(Object.entries(progress).filter(([,v])=>v===null||['string','number','boolean'].includes(typeof v)))):null});
    c.state.canonicalPlayback.deviceLoss=deviceLoss;c.state.canonicalPlayback.deviceLost=true;
    try{owner.cancel();}catch{}
    c.state.paused=true;c.state.predictionBusy=false;c.state.routeStatus='error';
    c.state.routeError='GPU 장치를 사용할 수 없습니다: '+(deviceLoss.message||deviceLoss.reason)+' · 마지막 단계: '+(deviceLoss.routeStatus==='searching'?deviceLoss.searchProgress?.phase??deviceLoss.phase:deviceLoss.phase);
    c.state.forecastStatus=c.state.routeError;try{c.notify();}catch{}
   });
   try{c.repairRouteTargets();c.notify();}catch(error){c.state.canonicalPlayback??={};c.state.canonicalPlayback.entryWarning='GPU 모드는 시작됐지만 화면 갱신에 실패했습니다: '+(error.message??String(error));}return owner;
  }catch(error){if(!installed){c.game=saved.game;Object.assign(c.state,{gameMode:saved.gameMode,selectedId:saved.selectedId,settings:saved.settings,routeOptions:saved.routeOptions,predict:saved.predict,activePanel:saved.activePanel});try{c.notify();}catch{}}throw error;}
 }finally{try{if(!installed){store?.dispose();if(device)await cleanupDevice(device);}}finally{pending.delete(c);}}
}
