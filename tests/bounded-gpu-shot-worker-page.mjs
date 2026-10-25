// Actual browser dedicated-worker harness, opt-in. No injected doubles.
import {createBoundedFourBallWorkerClient} from '../src/bounded-gpu-shot/four-ball-worker-client.mjs';
import {unpack} from './browser-initial-import-evidence.mjs';
const element=id=>document.getElementById(id),output=element('result');
let client,operation,raw,available=false,working=0;
const budget={maxSteps:1,maxWallMs:30000};
function controls(){element('connect').disabled=!!client||!!working;element('start').disabled=!available||!raw||working;
  element('resume').disabled=!operation||operation.snapshot().status!=='budget-suspended'||working;
  element('cancel').disabled=!operation||['complete','cancelled','unsupported','failed','device-lost'].includes(operation.snapshot().status);
  element('dispose').disabled=!client;}
function show(result){output.textContent=JSON.stringify({browser:navigator.userAgent,secureContext:isSecureContext,
  implementation:'actual-dedicated-worker-and-existing-gpu-only-service',result,
  qualification:result?.progress?.committedH>0?'Committed GPU h only; not full-rest parity or performance evidence.':'No committed GPU h demonstrated by this result.'},null,2);controls();}
async function task(fn){working++;controls();try{show(await fn());}catch(error){show({status:'failed',error:String(error?.stack??error)});}finally{working--;controls();}}
element('connect').onclick=()=>task(async()=>{const opening=createBoundedFourBallWorkerClient({onProgress:view=>{if(client===opening)show(view);}});
  client=opening;controls();const ready=await opening.ready;if(client!==opening)return {status:'stale-worker-ready-ignored'};
  available=ready.status==='ready';void opening.deviceLost.then(info=>{if(client!==opening)return;available=false;show({status:'device-lost',info});});return ready;});
element('capture').onchange=()=>task(async()=>{raw=null;const file=element('capture').files[0];if(!file)return {status:'no-input'};
  const decoded=unpack(JSON.parse(await file.text()));if(decoded.schema!=='live-original-four-ball-initial-capture-v1')throw Error('Original raw live capture evidence required');
  raw={snapshot:decoded.snapshot,capture:decoded.capture};return {status:'raw-input-loaded',bytes:raw.snapshot.byteLength,gpuWork:false};});
element('start').onclick=()=>task(async()=>{operation=client.start(raw,{budget});return operation.result;});
element('resume').onclick=()=>task(()=>operation.resume({budget}));
element('cancel').onclick=()=>task(()=>operation.cancel());
element('dispose').onclick=()=>task(async()=>{const closing=client,result=await closing.dispose();if(client===closing){client=null;operation=null;available=false;}return result;});
