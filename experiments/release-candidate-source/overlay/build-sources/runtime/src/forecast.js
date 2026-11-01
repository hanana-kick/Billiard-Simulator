/* Prediction is a second, isolated instance of the SAME engine and material laws.
 * No ray-bounce shortcut, analytic billiards path or velocity substitution. */
(function(G){
'use strict';
const {len,sub}=G.LabMath;
function begin(R,{snapshot,selectedId,settings,horizon=8}){
 if(!Number.isFinite(horizon)||horizon<=0||horizon>30)throw new RangeError('Prediction horizon must be 0–30 seconds.');
 const lab=G.PhysicsLab.fromSnapshot(R,snapshot),start=lab.time;
 const job={lab,start,horizon,iterations:0,maxSteps:Math.round(horizon/lab.dt),sampleStride:Math.max(1,Math.round(1/60/lab.dt)),tracks:lab.objects.map(o=>({id:o.id,label:o.label,color:o.color,radius:o.radius,shape:o.shape,half:o.half,points:[{...o.body.translation(),t:0}]})),events:[],done:false,rested:false};
 lab.onEvent=e=>{if(e.kind==='contact')job.events.push({...e,time:e.time-start});};
 try{const result=lab.strike(selectedId,{...settings},{saveSnapshot:false});if(!result.ok)throw new Error(result.reason);}catch(e){lab.dispose();throw e;}
 return job;
}
function sample(job,force=false){
 const t=job.lab.time-job.start;
 job.lab.objects.forEach((o,i)=>{const points=job.tracks[i].points,p=o.body.translation(),last=points[points.length-1];
  if(force||len(sub(p,last))>.00025)points.push({...p,t});
 });
}
function advance(job,budget=240){
 if(job.done)return true;
 const stop=Math.min(job.maxSteps,job.iterations+budget);
 while(job.iterations<stop){
  job.lab.step();job.iterations++;
  if(job.iterations%job.sampleStride===0)sample(job);
  if(!job.lab.cue&&job.iterations>job.sampleStride&&job.lab.objects.every(o=>o.body.isSleeping())){job.rested=true;job.done=true;break;}
 }
 if(job.iterations>=job.maxSteps)job.done=true;
 if(job.done)sample(job,true);
 return job.done;
}
function finish(job){
 const result={tracks:job.tracks,events:job.events,seconds:job.lab.time-job.start,iterations:job.iterations,hz:Math.round(1/job.lab.dt),rested:job.rested,
  final:job.lab.objects.map(o=>({id:o.id,position:{...o.body.translation()},rotation:{...o.body.rotation()},velocity:{...o.body.linvel()},angularVelocity:{...o.body.angvel()}}))};
 job.lab.dispose();return result;
}
function predict(R,request){const job=begin(R,request);try{while(!advance(job,480));return finish(job);}catch(e){job.lab.dispose();throw e;}}
G.LabForecast={begin,advance,finish,predict};
})(globalThis);
