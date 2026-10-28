/** CPU-only audit fixture recorder. Uses actual fixture hull assets; no solver changes. */
import fs from 'node:fs';
import {rollingCushionFixture} from '../tests/fixtures/world-mixed-v2.mjs';
import {runPreparedWorldCPU} from '../src/direct-candidate/deterministic-recurring-world.mjs';
export function recordRollingHorizonFixtures(){
 const out=[];
 for(const [speed,x] of [[2,0],[4,1.3],[.2,1.38]]){
  const f=rollingCushionFixture(speed,{x}),r=runPreparedWorldCPU(f.world,f.scene,f.hulls,f.options);
  const history=r.history.map(h=>({kind:h.kind??'supported',startTick:h.priorState?.[5],endTick:h.state?.[5],horizon:h.state?.[4],status:h.state?.[1],reason:h.state?.[2],nextHorizonCap:h.state?.[60],modes:h.state?Array.from({length:h.state[3]},(_,i)=>h.state[64+i*48+40]):undefined,impactTick:h.impact?.state?.[5],state:h.state?Array.from(h.state):undefined,impactState:h.impact?.state?Array.from(h.impact.state):undefined}));
  out.push({speed,x,options:f.options,state:Array.from(r.state),steps:r.history.length,history});
 }
 return out;
}
if(process.argv[1]&&import.meta.url===new URL(process.argv[1],'file://').href){
 const out=JSON.stringify(recordRollingHorizonFixtures(),null,2)+'\n';
 if(process.argv[2])fs.writeFileSync(process.argv[2],out);else process.stdout.write(out);
}
