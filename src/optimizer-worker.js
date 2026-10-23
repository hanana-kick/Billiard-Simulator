
'use strict';
const ready=RAPIER.init();let activeToken=0;
self.onmessage=async({data})=>{
 const token=++activeToken;if(data.type!=='evaluate')return;
 const reply=payload=>self.postMessage({requestId:data.requestId,candidateId:data.candidateId,...payload});let evaluation;
 try{
  await ready;if(token!==activeToken)return;
  evaluation=ShotSearchCore.beginCandidate(RAPIER,data.job);let last=0,done=!evaluation.trial;reply({steps:0});
  while(!done){const until=performance.now()+32;do{done=ShotSearchCore.stepTrial(evaluation.search,evaluation.trial,64);}while(!done&&performance.now()<until);
   if(performance.now()-last>=160){reply({steps:evaluation.trial.steps});last=performance.now();}
   if(!done)await new Promise(r=>setTimeout(r,0));if(token!==activeToken){evaluation.trial?.lab.dispose();return;}
  }
  const outcome=ShotSearchCore.finishCandidate(evaluation);evaluation=null;if(token===activeToken)reply({outcome});
 }catch(e){try{evaluation?.trial?.lab.dispose();}catch{}if(token===activeToken)reply({error:e.message||String(e),stack:e.stack,failedStep:evaluation?.trial?.steps});}
};
