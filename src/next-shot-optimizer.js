/* The speculative coordinator AND its physics live off the playback thread.
 * While moving it uses one Worker, not a main-thread planner plus a worker pool.
 * At verified rest the same retained search can use its ordinary foreground pool.
 */
(function(G){
'use strict';
function coordinatorBootstrap(){
 let service=null,requestId=0,lastResult=null,suspended=false,errorRevision=0,resultRevision=0;
 const ready=RAPIER.init(),reply=(type,value)=>self.postMessage({type,requestId,value});
 const ensure=()=>service||(service=new OptimizerService(p=>reply('progress',p),r=>{lastResult=r;resultRevision++;reply('result',r);},e=>{errorRevision++;reply('error',String(e));},{background:true,coordinator:true}));
 self.onmessage=async({data})=>{
  if(data.type==='sources'){const sources=data.sources;globalThis.document={getElementById:id=>({textContent:sources[id.slice(7)]||''})};return;}
  if(data.type==='foreground-frame'){if(data.requestId===requestId)service?.observeForegroundFrame(data.frame);return;}
  requestId=data.requestId;const token=requestId;
  if(data.type==='cancel'){service?.cancel();return;}
  if(data.type==='suspend'){suspended=service?.suspend()===true;reply('retained',service?.retainedState());return;}
  try{await ready;if(token!==requestId)return;const current=ensure();
   if(data.type==='request'){suspended=false;lastResult=null;current.request(data.req);}
   else if(data.type==='recover-background'){
    const revision=errorRevision,completed=resultRevision;
    const recovered=current.resumeBackground();suspended=!!current.suspended;
    if(recovered)reply('retained',current.retainedState());
    else if(revision===errorRevision&&completed===resultRevision&&!current.latest&&lastResult)reply('result',lastResult);
   }
   else if(data.type==='resume'){const revision=errorRevision;if(!current.resume()&&revision===errorRevision)reply('result',lastResult||{results:[],continuable:false});}
   else if(data.type==='promote'){const continueUnresolved=data.options?.continueUnresolved===true||(suspended&&(!lastResult||lastResult.results?.length===0))||(!current.latest&&lastResult?.results?.length===0&&lastResult?.continuable===true);suspended=false;const revision=errorRevision,completed=resultRevision;current.promoteToForeground({continueUnresolved});if(revision===errorRevision&&completed===resultRevision&&!current.latest)reply('result',lastResult||{results:[],continuable:false});}
  }catch(error){if(token===requestId)reply('error',String(error.message||error));}
 };
}
class NextShotOptimizer{
 constructor(onProgress,onResult,onError){
  Object.assign(this,{onProgress,onResult,onError,version:0,background:true,worker:null,workers:[],latest:null,result:null,disposed:false});
  const names=['engine','math','physics','game-rules','forecast','route-rules','route-sampler','optimizer-core','optimizer','inverse-geometry','inverse-solver','source-query-finalization-policy','source-finalization-request','source-gameplay-finalization-owner','inverse-events','inverse-events-window','inverse-planner','inverse-event-search','inverse-event-tail-search','inverse-event-adaptive-search','cpu-event-planner','inverse-event-window-search','inverse-event-window-tail-search','inverse-event-window-adaptive-search','cpu-event-window-planner','optimizer-service'];
  const sources=Object.fromEntries([...names,'optimizer-worker'].map(name=>[name,document.getElementById('source-'+name)?.textContent||'']));
  try{
   if(names.some(name=>!sources[name])||!sources['optimizer-worker'])throw Error('Background search source unavailable');
   const url=URL.createObjectURL(new Blob([names.map(name=>sources[name]).join('\n'),'\n(',coordinatorBootstrap.toString(),')();'],{type:'text/javascript'}));
   try{this.worker=new Worker(url);}finally{URL.revokeObjectURL(url);}
   this.worker.onmessage=({data})=>{if(this.disposed||data.requestId!==this.version)return;
    if(data.type==='retained'){this.retainedState=data.value;}
    else if(data.type==='progress'){this.plan=data.value.workerPlan;this.onProgress(data.value);}
    else if(data.type==='result'){this.result=data.value;this.latest=null;this.workers=[];this.onResult(data.value);}
    else if(data.type==='error'){this.latest=null;this.workers=[];this.onError(data.value);}
   };
   this.worker.onerror=event=>{event.preventDefault?.();if(this.disposed)return;this.worker?.terminate();this.worker=null;this.workers=[];this.latest=null;this.onError('Background coordinator worker unavailable');};
   this.worker.postMessage({type:'sources',sources});
  }catch(error){this.worker?.terminate();this.worker=null;this.creationError=String(error.message||error);}
 }
 send(type,extra={}){if(!this.worker||this.disposed){this.onError(this.creationError||'Search worker unavailable');return false;}this.worker.postMessage({type,requestId:this.version,...extra});return true;}
 request(req){this.version++;this.latest=req;this.result=null;this.workers=this.worker?[this.worker]:[];return this.send('request',{req});}
 suspend(){if(!this.background||!this.latest||this.suspended||!this.plan)return false;this.suspended=true;this.version++;this.workers=[];return this.send('suspend');}
 resumeBackground(){if(this.disposed||!this.worker||!this.background||!this.latest||!this.suspended)return false;this.version++;this.suspended=false;this.workers=[this.worker];return this.send('recover-background');}
 // Reuse the existing 750ms/40ms healthy-frame policy. Send no traffic
 // while waiting for health except a single revocation of a prior grant.
 observeFrame(deltaMs){
  if(this.background||this.disposed||!this.worker||(!this.latest&&!this.workers.length))return;
  const now=performance.now(),gap=this.foregroundLastFrameAt==null?deltaMs:now-this.foregroundLastFrameAt;
  this.foregroundLastFrameAt=now;
  const healthy=!G.document?.hidden&&Number.isFinite(deltaMs)&&deltaMs>0&&deltaMs<=40&&Number.isFinite(gap)&&gap>0&&gap<=40;
  if(!healthy)this.foregroundHealthySince=null;
  else if(this.foregroundHealthySince==null)this.foregroundHealthySince=now;
  const allowed=healthy&&now-this.foregroundHealthySince>=750;
  if(allowed||this.foregroundFrameAllowed)this.send('foreground-frame',{frame:{allowed,at:performance.timeOrigin+now}});
  this.foregroundFrameAllowed=allowed;
 }
 resetForegroundFrames(){this.foregroundHealthySince=null;this.foregroundLastFrameAt=null;this.foregroundFrameAllowed=false;}
 promoteToForeground(options={}){this.resetForegroundFrames();this.suspended=false;this.version++;this.background=false;if(this.latest||options.continueUnresolved)this.workers=this.worker?[this.worker]:[];return this.send('promote',{options});}
 resume(){this.resetForegroundFrames();if(this.disposed||!this.worker||this.result?.continuable===false)return false;this.version++;this.workers=[this.worker];return this.send('resume');}
 cancel(){this.resetForegroundFrames();this.version++;this.latest=null;this.workers=[];if(this.worker&&!this.disposed)this.send('cancel');}
 dispose(){if(this.disposed)return;this.cancel();this.disposed=true;this.worker?.terminate();this.worker=null;this.workers=[];}
}
G.NextShotOptimizer=NextShotOptimizer;
})(globalThis);
