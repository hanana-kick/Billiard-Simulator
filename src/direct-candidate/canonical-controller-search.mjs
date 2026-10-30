/** Explicit finite parameter search on the same canonical gameplay model.
 * Compact packets contain no trajectory, distance or contact-order metadata. */
import {canonicalApplicationRules} from './canonical-application-adapter.mjs';
const own=x=>structuredClone(x);
const stable=x=>Array.isArray(x)?'['+x.map(stable).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}':JSON.stringify(x);
import {canonicalSearchPopulation,CANONICAL_SEARCH_AXES as axes} from './canonical-search-domain.mjs';
export {canonicalSearchPopulation} from './canonical-search-domain.mjs';
/** Display only: maximum eligible tile, never a claim every input is admitted. */
export function canonicalSearchRuntimeDomain(domain,{capabilities,selectedWorldProfile,bodyCount,maximumSteps}={}){
 const wide=selectedWorldProfile==='mmq1-ball-ball'&&bodyCount===4&&maximumSteps===2048&&capabilities?.supportedWidths?.includes(16)&&capabilities.n16RosterCount===4&&capabilities.n16MaximumSteps===2048;
 const supportedWidths=Object.freeze(wide?[1,3,16]:[1,3]);
 const parallelWidth=wide&&domain.total>=16?16:domain.total>=3?3:1;
 return Object.freeze({...domain,supportedWidths,parallelWidth,parallelWidthKind:'maximum-eligible'});
}
export function createCanonicalControllerSearch({controller:c,stateStore,selectedWorldProfile,service,searchOptions,makeRequest,canStart,beforeSearch,beforeApply,rawMaximumSteps}){
 if(!service||service.selectedWorldProfile!==selectedWorldProfile||typeof service.runSearch!=='function'||typeof service.cancel!=='function')throw TypeError('Matching explicit canonical compact search service required');
 const maximumCandidates=searchOptions?.maximumCandidates??4096;const decorate=domain=>canonicalSearchRuntimeDomain(domain,{capabilities:service.capabilities,selectedWorldProfile,bodyCount:stateStore.readScene().slotToId.length,maximumSteps:rawMaximumSteps});let {population,domain}=canonicalSearchPopulation(searchOptions);domain=decorate(domain);let settingsById=new Map(population.map(row=>[row.candidateId,row.settings]));let epoch=0,pending=null,receipt=null,applying=false,disposed=false;
 const stamp=()=>stable({revision:stateStore.readRevision(),sceneId:stateStore.readScene().sceneId,provenance:stateStore.readProvenance(),selectedId:c.state.selectedId,game:c.game.snapshot(),gameMode:c.state.gameMode,fourBallThreeCushion:c.state.routeOptions.fourBallThreeCushion});
 const current=(source,token)=>{if(disposed||token!==epoch||stamp()!==source)throw Error('Canonical 검색의 배치·게임·입력이 바뀌었습니다. 다시 계산하세요.');};
 const clear=(reason,invalidate)=>{if(applying)return;epoch++;pending?.abort.abort();pending=null;service.cancel(reason);if(invalidate){receipt=null;c.state.routeApplied=null;if(c.state.routeResult||c.state.routeStatus==='searching'){c.state.routeStatus='stale';c.state.routeError=reason;if(c.state.routeResult)c.state.routeResult={...c.state.routeResult,continuable:false};}}else if(c.state.routeStatus==='searching'){c.state.routeStatus='canceled';c.state.routeError=reason;}};
 const publish=(rows,source,token,partial,elapsedMs,batchWidths=[])=>{current(source,token);const all=own(rows),results=[],reasonCounts={incomplete:{},unsupported:{}};let evaluated=0,unsupported=0,incomplete=0,miss=0;const byId=new Map();
  for(const row of all){const packet=Array.from(row.packet??[]),id=row.candidateId,settings=settingsById.get(id);
   if(!settings||packet.length!==4||packet[0]!==id||byId.has(id))throw Error('Invalid canonical compact candidate identity');byId.set(id,row);
   if(packet[1]===1&&packet[2]===0&&packet[3]===1){evaluated++;results.push(Object.freeze({id,settings:own(settings),score:1,compact:packet}));}
   else if(packet[1]===2&&packet[3]!==0x80000000){evaluated++;miss++;}else if(packet[1]===3){incomplete++;reasonCounts.incomplete[packet[2]]=(reasonCounts.incomplete[packet[2]]??0)+1;}else{unsupported++;reasonCounts.unsupported[packet[2]]=(reasonCounts.unsupported[packet[2]]??0)+1;}
  }
  if(!Array.isArray(batchWidths)||batchWidths.some(n=>![1,3,16].includes(n))||(batchWidths.length&&batchWidths.reduce((sum,n)=>sum+n,0)!==all.length))throw Error('Invalid actual batch widths');
  receipt={source,token,results:own(results)};const result={kind:'canonical-compact-search-v1',results,total:population.length,tested:all.length,evaluated,unsupported,incomplete,miss,found:results.length,partial,continuable:false,elapsedMs,reasonCounts,batchWidths:batchWidths.slice()};c.state.routeResult=result;c.state.routeProgress={...result,results:undefined};return result;
 };
 async function start(extra){if(extra!==undefined)return false;if(disposed||!canStart())return false;clear('새 canonical 검색',true);beforeSearch();const token=++epoch,source=stamp(),abort=new AbortController(),started=performance.now();pending={abort,source,token};receipt=null;let lastProgressNotify=-Infinity,lastProgressGroup=null;
  c.state.routeStatus='searching';c.state.routeError='';c.state.routeResult=null;c.state.routeApplied=null;c.state.routeProgress={total:population.length,tested:0,evaluated:0,unsupported:0,incomplete:0,miss:0,found:0,elapsedMs:0,reasonCounts:{incomplete:{},unsupported:{}},phase:'preparing'};c.notify();
  try{const config=makeRequest('search'),scene=stateStore.readScene(),rules=canonicalApplicationRules(c.game.snapshot(),c.state.selectedId,scene.slotToId);
   const request={scene,requestId:config.requestId,selectedId:c.state.selectedId,purpose:'search',rules,executionProfile:config.executionProfile,budget:config.budget};
   const result=await service.runSearch({request,population:own(population),raw:config.raw,continuation:config.continuation,strikeBackend:config.strikeBackend??'staged',signal:abort.signal,onPhase:progress=>{current(source,token);const time=performance.now();c.state.routeProgress={...c.state.routeProgress,...progress,elapsedMs:time-started};
    // Always retain the latest evidence synchronously, even when rendering is
    // throttled. Encoding/submitted alternate per chunk: one display group.
    const group=['encoding','submitted'].includes(progress.phase)?'executing':progress.phase;
    if(group!==lastProgressGroup||time-lastProgressNotify>=100){lastProgressNotify=time;lastProgressGroup=group;c.notify(false);}},assertCurrent:()=>current(source,token),onBatch:progress=>{publish(progress.rows,source,token,true,performance.now()-started,progress.batchWidths);c.notify(false);}});
   current(source,token);result.assertCurrent();publish(result.rows,source,token,false,performance.now()-started,result.batchWidths);pending=null;c.state.routeStatus='done';c.state.routeProgress={...c.state.routeProgress,phase:'done'};c.notify();return true;
  }catch(error){if(token!==epoch||disposed)return false;pending=null;receipt=null;c.state.routeStatus='error';c.state.routeError=error.message??String(error);c.state.routeApplied=null;c.notify();return false;}
 }
 function stop(){if(!pending)return false;const p=pending;try{current(p.source,p.token);}catch{clear('배치가 바뀌었습니다.',true);c.notify();return false;}const saved=receipt;epoch++;pending=null;p.abort.abort();service.cancel('사용자 중단');if(saved){receipt={...saved,token:epoch};c.state.routeResult={...c.state.routeResult,partial:true,continuable:false};}c.state.routeStatus='done';c.state.routeError='';c.state.routeProgress={...c.state.routeProgress,phase:'stopped'};c.notify();return true;}
 function apply(id){if(disposed||!canStart()||!receipt||!['done','searching'].includes(c.state.routeStatus))return false;try{current(receipt.source,receipt.token);if(pending)stop();const row=receipt.results.find(r=>r.id===id);if(!row)return false;current(receipt.source,receipt.token);beforeApply();applying=true;try{c.changeSettings(own(row.settings));}finally{applying=false;}current(receipt.source,receipt.token);if(axes.some(([,key])=>c.state.settings[key]!==row.settings[key]))throw Error('검증한 타격 설정을 정확히 적용할 수 없습니다.');c.state.routeApplied=id;c.notify();c.announce('GPU 검증 후보 '+id+'의 타격 설정을 적용했습니다. 타격은 직접 실행하세요.');return true;}catch(error){clear(error.message,true);c.notify();return false;}}
 return Object.freeze({get domain(){return domain;},update({parameterGrid,...other}={}){if(Object.keys(other).length)throw TypeError('Only explicit parameterGrid may change');if(disposed)throw Error('Search owner disposed');if(!canStart())throw Error('타격이 끝난 뒤 탐색 조합을 변경하세요.');const next=canonicalSearchPopulation({parameterGrid,maximumCandidates});clear('탐색 조합이 바뀌었습니다. 다시 계산하세요.',true);population=next.population;settingsById=new Map(population.map(row=>[row.candidateId,row.settings]));domain=decorate(next.domain);return domain;},start,stop,apply,cancel:clear,check(){if(!receipt&&!pending)return;try{const r=pending??receipt;current(r.source,r.token);}catch(error){clear(error.message,true);}},dispose(){if(!disposed){clear('controller disposed',true);disposed=true;service.dispose?.();}}});
}
