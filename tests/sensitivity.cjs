'use strict';
// Diagnostic, not an empirical calibration or a claim of convergence.
const fs=require('node:fs'),R=require('../vendor/rapier.cjs');
require('../src/math.js');require('../src/physics.js');
(async()=>{
 await R.init();const cases=[];
 for(const [name,tipX,tipY] of [['center-cue-multiple-contacts',0,0],['off-center-cue-cushions',.25,-.15]]){
  const settings={angle:0,elevation:8,tipX,tipY,speed:2},rows=[];
  for(const hz of [480,960,1920]){
   const lab=new PhysicsLab(R,{}, {dt:1/hz});
   try{
    const result=lab.strike(1,settings);if(!result.ok)throw new Error(result.reason);
    lab.step(hz*8);
    rows.push({hz,positions:lab.objects.map(o=>({id:o.id,label:o.label,position:{...o.body.translation()}})),contacts:lab.events.filter(e=>e.kind==='contact').map(e=>({label:e.label,time:e.time}))});
   }finally{lab.dispose()}
  }
  const changes960vs1920=rows[1].positions.map((p,i)=>{const q=rows[2].positions[i].position;return{id:p.id,label:p.label,positionChangeMeters:Math.hypot(p.position.x-q.x,p.position.y-q.y,p.position.z-q.z)}});
  cases.push({name,settings,seconds:8,rows,changes960vs1920,maxChangeMeters:Math.max(...changes960vs1920.map(x=>x.positionChangeMeters))});
 }
 const result={engine:R.version(),description:'Timestep sensitivity is not a measured real-world prediction error.',cases};
 if(process.env.QA_REPORT)fs.writeFileSync(process.env.QA_REPORT,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
