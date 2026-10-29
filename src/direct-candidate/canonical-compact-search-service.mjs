/** Bounded compact search over the CURRENT sealed raw→world GPU producer.
 * No trajectory capture, CPU dynamics, legacy fallback, or default activation.
 */
import {createCanonicalRequest,createCanonicalCandidate,CanonicalContractError} from './canonical-engine-contract.mjs';
import {prepareRawWorldBinding} from './deterministic-raw-world.mjs';
import {prepareCanonicalWorldContinuation} from './canonical-world-continuation.mjs';
import {createExperimentalLiveWorldBatchGPU} from './experimental-live-world-batch.mjs';
import {LIVE_WORLD_UPLOAD_SOURCE_SEALED,LIVE_WORLD_UPLOAD_SOURCE_REVISION} from './experimental-live-world-build-seal.mjs';
import {assertWasmGpuProductionRuntime} from '../wasm-gpu/production-runtime.mjs';
const verifiedWasmServices=new WeakSet();
export const isCanonicalWasmCompactSearchService=service=>verifiedWasmServices.has(service);
const own=x=>structuredClone(x),freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const fail=(code,message)=>new CanonicalContractError(code,message);
const profiles=Object.freeze({'mmq1-ball-ball':Object.freeze({profile:'mmq1-no-cushion',mixedMotionRevision:'mmq1',enableCushionContinuation:false}),'mmq2-cushion':Object.freeze({profile:'mmq2-cushion',mixedMotionRevision:'mmq2',enableCushionContinuation:true})});
const unavailable=0x80000000;
function compactRow(candidate,words){
 if(!(words instanceof Uint32Array)||words.length!==4||words[0]!==candidate.candidateId)throw fail('SEARCH_BACKEND_IDENTITY','Exact candidate compact packet required');
 const [id,status,reason,scoreBits]=words,score=scoreBits===unavailable?null:scoreBits|0;
 // These are trusted-producer wire checks, not invented full-state evidence.
 // In particular compact words are never fed fabricated MODEL_REST evidence.
 if(status===1 ? (!candidate.admitted||reason!==0||score!==1) :
    status===2 ? (!candidate.admitted||reason!==1||![-1,0].includes(score)) :
    status===3 ? (![3,8,9,10,11].includes(reason)||score!==null) :
    status===4 ? (![4,5,6,12].includes(reason)||score!==null) : true)
  throw fail('SEARCH_BACKEND_CONTRACT','Invalid full-gameplay compact outcome; incomplete/unsupported are never misses');
 return freeze({candidateId:id,candidateKey:candidate.candidateKey,settings:own(candidate.settings),packet:Array.from(words),
  status:({1:'PASS',2:'MISS',3:'INCOMPLETE',4:'UNSUPPORTED'})[status],reason,score,selectable:status===1});
}
function core({device,selectedWorldProfile,maximumCandidates=4096},runtime){
 if(!Object.hasOwn(profiles,selectedWorldProfile))throw fail('SEARCH_PROFILE_UNSUPPORTED','Explicit selected-world profile required');
 if(!Number.isInteger(maximumCandidates)||maximumCandidates<1||maximumCandidates>4096)throw RangeError('Explicit population bound1..4096');
 const expectedPreparation=runtime.expectedPreparation??'sealed-uploads';
 if(!['sealed-uploads','wasm-program'].includes(expectedPreparation))throw TypeError('Exact supported preparation required');
 const profile=profiles[selectedWorldProfile],supportsN16=selectedWorldProfile==='mmq1-ball-ball';let generation=0,disposed=false,activeAbort=null,tail=Promise.resolve();
 const cancel=reason=>{generation++;activeAbort?.abort(reason);activeAbort=null;};
 return Object.freeze({selectedWorldProfile,sourceRevision:runtime.sourceRevision,
  capabilities:freeze({experimental:true,productionEnabled:false,implementation:runtime.implementation,selectedWorldProfile,
   sourceRevision:runtime.sourceRevision,compactBatch:true,parallelWidth:supportsN16?16:3,supportedWidths:supportsN16?[1,3,16]:[1,3],
   n16RosterCount:supportsN16?4:null,n16MaximumSteps:supportsN16?2048:null,tailWidth:1,maximumCandidates,
   physicalHardwareVerified:false,cumulativeWorkBudgetEnforced:false,cumulativeEventBudgetEnforced:false}),
  cancel,dispose(){if(!disposed){disposed=true;cancel('search service disposed');}return tail;},
  async runSearch({request:requestOptions,population,raw,continuation,strikeBackend='staged',signal,onBatch=()=>{},onPhase=()=>{},assertCurrent=()=>{}}={}){
   if(disposed)throw fail('SEARCH_DISPOSED','Search owner disposed');
   cancel('search replacement');const token=generation,abortController=new AbortController();activeAbort=abortController;
   const input=own({requestOptions,population,raw,continuation,strikeBackend});
   if(typeof onBatch!=='function'||typeof onPhase!=='function'||typeof assertCurrent!=='function')throw TypeError('Synchronous progress/source guards required');
   if(signal?.aborted)abortController.abort(signal.reason);
   const onAbort=()=>abortController.abort(signal.reason);signal?.addEventListener('abort',onAbort,{once:true});
   const current=()=>{if(disposed||token!==generation||abortController.signal.aborted)throw fail('SEARCH_CANCELLED','Cancelled or superseded search result');const result=assertCurrent();if(result&&typeof result.then==='function')throw TypeError('Source guard must be synchronous');};
   const phase=(phase,detail={})=>{current();const result=onPhase(freeze({phase,...detail}));if(result&&typeof result.then==='function')throw TypeError('Progress callback must be synchronous');current();};
   let release,predecessor,resultReady=false;const engines=new Map();
   try{
    phase('preparing');
    if(input.strikeBackend!=='staged')throw fail('SEARCH_BACKEND_UNSUPPORTED','Search and selected execution require explicit staged raw backend');
    if(input.requestOptions?.purpose!=='search'||Object.hasOwn(input.requestOptions??{},'epoch'))throw fail('SEARCH_REQUEST','Search service owns epoch; purpose must be search');
    const r=input.requestOptions?.rules;
    if(!r||r.search!==false||r.allowKiss!==true||r.conditionOnly!==false)throw fail('SEARCH_RULES_UNSUPPORTED','Initial search uses exact full-gameplay rules, not early/search-filter verdicts');
    if((input.continuation?.mixedMotionRevision??profile.mixedMotionRevision)!==profile.mixedMotionRevision||
       (input.continuation?.enableCushionContinuation??profile.enableCushionContinuation)!==profile.enableCushionContinuation)
      throw fail('SEARCH_PROFILE_MISMATCH','Search/selected motion profile mismatch');
    if(!Array.isArray(input.population)||input.population.length<1||input.population.length>maximumCandidates||new Set(input.population.map(x=>x?.candidateId)).size!==input.population.length)
      throw RangeError('Bounded nonempty population with unique IDs required');
    const request=createCanonicalRequest({...input.requestOptions,epoch:token}),candidates=input.population.map(row=>{
     if(!row||Object.keys(row).sort().join(',')!=='candidateId,settings')throw TypeError('Exact candidateId/settings population entries required');
     return createCanonicalCandidate(request,row.candidateId,row.settings);
    });
    const rawBinding=prepareRawWorldBinding(request,input.raw),binding=prepareCanonicalWorldContinuation(request,rawBinding.shotClock,{
     ...input.continuation,mixedMotionRevision:profile.mixedMotionRevision,enableCushionContinuation:profile.enableCushionContinuation,
     sceneKey:rawBinding.sceneKey,requestKey:rawBinding.requestKey,
    });
    // One owner never compiles/submits two arenas concurrently after supersession.
    predecessor=tail;tail=new Promise(resolve=>{release=resolve;});phase('queued');await predecessor;current();
    const rows=[],counts={pass:0,miss:0,incomplete:0,unsupported:0},metrics=[],batchWidths=[],maximumSteps=input.raw?.maximumSteps??2048,
     n16Eligible=supportsN16&&rawBinding.bodyCount===4&&maximumSteps===2048;
    const progress=()=>freeze({rows:[...rows],counts:{...counts},batchWidths:[...batchWidths],total:candidates.length,tested:rows.length});
    for(let offset=0;offset<candidates.length;){
     current();const remaining=candidates.length-offset,width=n16Eligible&&remaining>=16&&candidates.slice(offset,offset+16).every(c=>c.admitted===true)?16:remaining>=3?3:1,tile=candidates.slice(offset,offset+width);let engine=engines.get(width);
     if(!engine){phase('preparing',{width});engine=await runtime.createEngine(device,{request,binding,rawBinding,candidates:tile,maximumSteps,
       signal:abortController.signal,onCompilePhase:detail=>phase('compiling',{width,compileCompleted:detail.compileOrdinal+(detail.stage==='end'?1:0),compileTotal:detail.total,compileStage:detail.stage}),preparation:expectedPreparation,strikeBackend:input.strikeBackend,profile:profile.profile,faultPolicy:'atomic-per-access',compileOrder:width===16?'source':'largest-first',validationProfile:width===16?'mmq1-n16-repeat-qualification-v1':null,expectedBuildRevision:runtime.sourceRevision});
      engines.set(width,engine);current();if(engine.buildRevision!==runtime.sourceRevision||engine.candidateCount!==width||engine.preparation!==expectedPreparation||(width===16&&engine.validationProfile!=='mmq1-n16-repeat-qualification-v1'))throw fail('SEARCH_SOURCE_MISMATCH','Only exact same-build sealed compact engine accepted');}
     phase('running',{width});const result=await engine.run({signal:abortController.signal,candidates:tile,onPhase:detail=>phase(detail.phase,{width,...detail})});current();
     if(result.buildRevision!==runtime.sourceRevision||result.requestIdentity!==binding.requestIdentity||result.sceneIdentity!==binding.sceneIdentity||result.epoch!==request.epoch||
        !Array.isArray(result.candidateKeys)||result.candidateKeys.length!==width||result.candidateKeys.some((key,i)=>key!==tile[i].candidateKey)||
        !(result.compact instanceof Uint32Array)||result.compact.length!==width*4||result.metrics?.readbackBytes!==width*16)
       throw fail('SEARCH_BACKEND_IDENTITY','Compact result must retain exact source/request/scene/epoch/candidate identities and16-byte rows');
     const chunk=tile.map((candidate,i)=>compactRow(candidate,result.compact.slice(i*4,i*4+4)));
     for(const row of chunk){rows.push(row);counts[row.status.toLowerCase()]++;}
     metrics.push(own(result.metrics));batchWidths.push(width);offset+=width;current();const notified=onBatch(progress());if(notified&&typeof notified.then==='function')throw TypeError('Progress callback must be synchronous');current();
    }
    current();resultReady=true;return Object.freeze({kind:'canonical-compact-search-result-v1',selectedWorldProfile,sourceRevision:runtime.sourceRevision,
     requestIdentity:request.requestKey,sceneIdentity:request.sceneId,epoch:request.epoch,...progress(),metrics:freeze(metrics),
     assertCurrent:current,readRequest(){current();return request;}});
   }finally{try{for(const engine of engines.values())await engine?.dispose?.();if(resultReady)current();}finally{signal?.removeEventListener('abort',onAbort);if(activeAbort===abortController)activeAbort=null;if(release){await predecessor;release();}}}
  },
 });
}
/** Available only inside an exact reviewed source bundle. Caller flags cannot seal it. */
export function createCanonicalCompactSearchService(options={}){
 if(!LIVE_WORLD_UPLOAD_SOURCE_SEALED)throw fail('SEARCH_UNSEALED_SOURCE','Use the reviewed sealed browser bundle');
 return core(options,{createEngine:createExperimentalLiveWorldBatchGPU,sourceRevision:LIVE_WORLD_UPLOAD_SOURCE_REVISION,implementation:'webgpu-sealed-compact-search-v1'});
}
/** Explicit host lifecycle seam; never re-exported by the browser sealed entry. */
export function createCanonicalCompactSearchServiceHarness(options={},runtime){
 if(typeof runtime?.createEngine!=='function'||typeof runtime?.sourceRevision!=='string')throw TypeError('Explicit fake runtime required');
 return core(options,{...runtime,implementation:'injected-compact-search-test-v1'});
}

/** Owned static-build runtime only; injected lookups cannot acquire this brand. */
export function createCanonicalWasmCompactSearchService({productionRuntime,device,selectedWorldProfile='mmq2-cushion',...options}={}){
 const runtime=assertWasmGpuProductionRuntime(productionRuntime,device);
 if(selectedWorldProfile!=='mmq2-cushion')throw fail('SEARCH_PROFILE_UNSUPPORTED','WASM public mode is MMQ2 only');
 const service=core({device,selectedWorldProfile,...options},{createEngine:runtime.createSearchEngine,sourceRevision:runtime.sourceRevision,expectedPreparation:'wasm-program',implementation:'webgpu-wasm-compact-search-v1'});verifiedWasmServices.add(service);return service;
}
