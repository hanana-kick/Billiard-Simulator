'use strict';
const ready=RAPIER.init();let activeId=0;
self.onmessage=async({data})=>{
 activeId=data.requestId;if(data.type==='cancel')return;
 const id=activeId;let search;
 try{
  await ready;if(id!==activeId)return;
  search=LabOptimizer.createSearch(RAPIER,data);let last=0,done=false;
  self.postMessage({requestId:id,progress:LabOptimizer.progress(search)});
  while(!done){
   const until=performance.now()+32;
   do {done=LabOptimizer.advanceSearch(search,64);}while(!done&&performance.now()<until);
   const now=performance.now();
   if(now-last>=160||done){self.postMessage({requestId:id,progress:{...LabOptimizer.progress(search),partialResult:LabOptimizer.previewSearch(search)}});last=now;}
   if(!done)await new Promise(r=>setTimeout(r,0));
   if(id!==activeId){LabOptimizer.disposeSearch(search);return;}
  }
  const result=LabOptimizer.finishSearch(search);search=null;
  if(id===activeId)self.postMessage({requestId:id,result});
 }catch(e){if(search)LabOptimizer.disposeSearch(search);if(id===activeId)self.postMessage({requestId:id,error:e.message||String(e)});}
};
