// Phase-boundary lifetime tests; fake device does not execute numerical shaders.
import test from 'node:test';import assert from 'node:assert/strict';
import {createInitialMicrocodeBatchExecutor} from '../src/resident-candidate/initial-microcode-batch-executor.mjs';
import {REASON as R} from '../src/resident-candidate/abi.mjs';
import {fixture,fakeBatchDevice,optionsFor,released} from './resident-candidate-initial-microcode-batch-fixture.mjs';
const phases=['preflight','pipeline','allocation','upload','initialization','continuation','publication','copy','map','cleanup'];
for(const mode of['cancel','stale','loss'])test(mode+' is atomic across every owned bank lifetime phase',async()=>{const{plan:p}=await fixture();let f,e,phase,fired,current,abort;
 const trigger=()=>{if(fired)return;fired=true;if(mode==='cancel')abort.abort();else if(mode==='stale')current={...p.identity,generationIdentity:'changed at '+phase};else f.lose();};
 const hooks={preflight(){if(phase==='preflight')trigger();},pipeline(){if(phase==='pipeline')trigger();},allocate(){if(phase==='allocation')trigger();},write(){if(phase==='upload')trigger();},submit(log){if(phase==='initialization')trigger();if(phase==='continuation'&&log.counts.get('0:initial-microcode core pump'))trigger();if(phase==='publication'&&log.counts.get('0:initial microcode compact publication'))trigger();if(phase==='copy'&&log.copies.length)trigger();},map(){if(phase==='map')trigger();},destroy(){if(phase==='cleanup')trigger();}};
 for(phase of phases){fired=false;current=p.identity;abort=new AbortController();if(!f||mode==='loss'){f=fakeBatchDevice(p,{hooks});e=createInitialMicrocodeBatchExecutor(f.device,{experimental:true,maxDispatchesPerSubmission:4096});}else{released(f.log);f.log.counts.clear();f.log.tail.length=0;f.log.runs.length=0;f.log.copies.length=0;f.log.maps.length=0;}
  const out=await e.evaluate(p,optionsFor(p,{signal:abort.signal,getIdentity:()=>current}));assert.ok(fired,phase+' reached');assert.deepEqual(out.results.map(x=>x.id),p.orderedIds);assert.ok(out.results.every(x=>x.pass===null&&x.reasonCode===(mode==='cancel'?R.CANCELLED:mode==='stale'?R.STALE_SOURCE:R.DEVICE_LOST)),phase+' cannot publish a partial wave');assert.ok(f.log.maps.length<=(['map','cleanup'].includes(phase)?1:0));released(f.log);if(mode==='loss'){await e.dispose();assert.throws(()=>createInitialMicrocodeBatchExecutor(f.device,{experimental:true}),/lost/);}console.log(JSON.stringify({mode,phase,terminal:'pass',bankResourcesDestroyed:true,physicalExecution:false}));
 }if(mode!=='loss')await e.dispose();
});
