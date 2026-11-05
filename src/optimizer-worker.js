
'use strict';
const ready=RAPIER.init();let activeToken=0;
self.onmessage=async({data})=>{
 const token=++activeToken;if(data.type!=='evaluate')return;
 const reply=payload=>self.postMessage({requestId:data.requestId,candidateId:data.candidateId,...payload});let evaluation,evaluator;
 try{
  await ready;if(token!==activeToken)return;
  const inverse=data.job.kind==='inverse-constraint',beginOptions={purpose:data.job.purpose,eventPrefixOnly:data.job.eventPrefixOnly===true,...(data.job.prefixMismatchWindow===true?{prefixMismatchWindow:true}:{})};
  evaluator=inverse?(data.job.prefixMismatchWindow===true?globalThis.LabInverseEventsWindow:globalThis.LabInverseEvents):null;
  if(inverse&&!evaluator)throw Error('Requested inverse evaluator unavailable');
  if(inverse&&Object.hasOwn(data.job.req,'finalization')){if(!globalThis.LabSourceFinalizationRequest)throw Error('Explicit source finalization modules unavailable');if(LabSourceFinalizationRequest.needsAdmission(data.job.req,data.job.purpose)){beginOptions.finalizationAdmission=await LabSourceFinalizationRequest.admit(data.job.req);if(token!==activeToken)return;}}
  evaluation=inverse?evaluator.begin(RAPIER,data.job.req,data.job.topology,data.job.settings,beginOptions):ShotSearchCore.beginCandidate(RAPIER,data.job);let last=0,done=inverse?false:!evaluation.trial;reply({steps:0});
  while(!done){const until=performance.now()+(data.background?4:32);do{done=inverse?evaluator.advance(evaluation,data.background?16:64):ShotSearchCore.stepTrial(evaluation.search,evaluation.trial,data.background?16:64);}while(!done&&performance.now()<until);
   if(performance.now()-last>=160){reply({steps:evaluation.trial?.steps||evaluation.steps||0});last=performance.now();}
   if(!done)await new Promise(r=>setTimeout(r,data.background?8:0));if(token!==activeToken){if(inverse)evaluator.dispose(evaluation);else evaluation.trial?.lab.dispose();return;}
  }
  const outcome=inverse?evaluator.finish(evaluation):ShotSearchCore.finishCandidate(evaluation);evaluation=null;if(token===activeToken)reply({outcome});
 }catch(e){try{if(evaluation&&evaluator)evaluator.dispose(evaluation);else evaluation?.trial?.lab.dispose();}catch{}if(token===activeToken)reply({error:e.message||String(e),stack:e.stack,failedStep:evaluation?.trial?.steps});}
};
