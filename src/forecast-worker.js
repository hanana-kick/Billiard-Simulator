/* This source runs inside a Blob Web Worker, including in an offline HTML file. */
'use strict';
const initialized=globalThis.RAPIER.init();
let latest=0;
self.onmessage=async({data})=>{
 latest=data.requestId;
 if(data.type==='cancel')return;
 const id=data.requestId;let job;
 try{
  await initialized;if(id!==latest)return;
  job=LabForecast.begin(RAPIER,data);
  const started=performance.now();
  while(!LabForecast.advance(job,240)){
   // Yield to accept cancellation when a slider or ball position changes.
   await new Promise(resolve=>setTimeout(resolve,0));
   if(id!==latest){job.lab.dispose();return;}
  }
  if(id!==latest){job.lab.dispose();return;}
  const result=LabForecast.finish(job);job=null;
  self.postMessage({requestId:id,result,elapsedMs:performance.now()-started});
 }catch(error){if(job)job.lab.dispose();if(id===latest)self.postMessage({requestId:id,error:String(error.message||error)});}
};
