(function(G){
'use strict';
class OptimizerService{
 constructor(onProgress,onResult,onError){this.version=0;this.onProgress=onProgress;this.onResult=onResult;this.onError=onError;this.worker=null;this.latest=null;this.mode='worker';}
 request(req){
  this.cancel();const id=this.version;this.latest=req;
  try{
   const code=['engine','math','physics','forecast','route-rules','route-sampler','optimizer-core','optimizer','optimizer-worker'].map(k=>document.getElementById('source-'+k).textContent).join('\n');
   const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));this.worker=new Worker(url);URL.revokeObjectURL(url);
   this.worker.onmessage=({data})=>{if(data.requestId!==this.version)return;if(data.error){this.onError(data.error);this.worker?.terminate();this.worker=null;}else if(data.progress)this.onProgress(data.progress);else{this.onResult(data.result);this.worker?.terminate();this.worker=null;this.latest=null;}};
   this.worker.onerror=e=>{e.preventDefault();this.worker?.terminate();this.worker=null;if(id===this.version)this.fallback(req,id);};
   this.worker.postMessage({...req,type:'search',requestId:id});
  }catch{this.fallback(req,id);}
 }
 async fallback(req,id){
  this.mode='cooperative';let search;
  try{
   search=G.LabOptimizer.createSearch(G.RAPIER,req);let last=0,done=false;
   while(!done){const until=performance.now()+8;
    do{done=G.LabOptimizer.advanceSearch(search,16);}while(!done&&performance.now()<until);
    if(id!==this.version){G.LabOptimizer.disposeSearch(search);return;}
    if(performance.now()-last>180||done){this.onProgress({...G.LabOptimizer.progress(search),partialResult:G.LabOptimizer.previewSearch(search)});last=performance.now();}
    if(!done)await new Promise(r=>setTimeout(r,0));
   }
   if(id===this.version)this.onResult(G.LabOptimizer.finishSearch(search));search=null;
  }catch(e){if(search)G.LabOptimizer.disposeSearch(search);if(id===this.version)this.onError(e.message||String(e));}
 }
 cancel(){this.version++;this.worker?.terminate();this.worker=null;this.latest=null;}
 dispose(){this.cancel();}
}
G.OptimizerService=OptimizerService;
})(globalThis);
