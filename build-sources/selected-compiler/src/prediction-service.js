(function(G){
'use strict';
class PredictionService{
 constructor(onResult,onError){
  this.onResult=onResult;this.onError=onError;this.version=0;this.mode='worker';this.worker=null;this.latestRequest=null;
  try{
   const code=['engine','math','physics','forecast','worker'].map(name=>document.getElementById('source-'+name)?.textContent||'').join('\n');
   const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
   this.worker=new Worker(url);URL.revokeObjectURL(url);
   this.worker.onmessage=({data})=>{if(data.requestId!==this.version)return;if(data.error)this.onError(data.error);else this.onResult(data.result,{elapsedMs:data.elapsedMs,mode:this.mode});};
   this.worker.onerror=event=>{event.preventDefault();this.worker?.terminate();this.worker=null;this.mode='cooperative';if(this.latestRequest)this.fallback(this.latestRequest,this.version);};
  }catch{this.mode='cooperative';}
 }
 cancel(){this.version++;this.latestRequest=null;if(this.worker)this.worker.postMessage({type:'cancel',requestId:this.version});}
 request(request){
  const id=++this.version;this.latestRequest=request;
  if(this.worker)this.worker.postMessage({...request,requestId:id,type:'predict'});
  else this.fallback(request,id);
  return id;
 }
 async fallback(request,id){
  let job;const started=performance.now();
  try{
   job=G.LabForecast.begin(G.RAPIER,request);
   while(!G.LabForecast.advance(job,96)){
    await new Promise(r=>setTimeout(r,0));if(id!==this.version){job.lab.dispose();return;}
   }
   const result=G.LabForecast.finish(job);job=null;
   if(id===this.version)this.onResult(result,{elapsedMs:performance.now()-started,mode:'cooperative'});
  }catch(error){if(job)job.lab.dispose();if(id===this.version)this.onError(error.message||String(error));}
 }
 dispose(){this.cancel();this.worker?.terminate();this.worker=null;}
}
G.PredictionService=PredictionService;
})(globalThis);
