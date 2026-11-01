/** CPU-only revised integration policy. Not a GPU-parity or physical-accuracy claim. */
import {runPreparedWorldCPU} from './deterministic-recurring-world.mjs';
import {advanceSupportedWorldCPU,buildRecurringProbeCPU,chooseRecurringPrefixCPU,finishRecurringPrefixCPU} from './deterministic-world-supported.mjs';
import {runQtBridgeCPU} from './deterministic-qt-bridge.mjs';
import {runSmoothSegmentsCPU} from './deterministic-smooth-segment.mjs';

export function advanceExperimentalEarlyQtCPU(current,context,resolve,options){
  const fallback=()=>advanceSupportedWorldCPU(current,context,resolve,options);
  const n=current.state[3],modes=Array.from({length:n},(_,i)=>current.state[64+i*48+40]);
  // No rolling/airborne or active-contact reinterpretation; retain existing pending routes.
  if(current.state[1]!==1||current.state[6]!==0xffffffff||modes.some(m=>m!==0&&m!==1))return fallback();
  const probeRows=buildRecurringProbeCPU(current,context),proposals=new Uint32Array(256),bridgeProbes=new Uint32Array(512);
  let preferQtMask=0;
  for(let i=0;i<n;i++){
    const b=i*64,z=i*128,row=probeRows.slice(b,b+64);if(!row[1])continue;
    const smooth=runSmoothSegmentsCPU(row);proposals.set(smooth,b);
    // Keep failed-proposal handling in the unchanged default routine.
    if(smooth[1]!==1)return fallback();
    if(smooth[5]===row[2])continue;
    const qt=runQtBridgeCPU(row).output;
    if(qt[1]!==1||qt[4]<=smooth[5])continue;
    preferQtMask|=1<<i;bridgeProbes.set(qt,z);bridgeProbes[z+5]=qt[4];bridgeProbes[z+53]=qt[6];
  }
  if(!preferQtMask)return fallback();
  const prepared=chooseRecurringPrefixCPU(current,context,proposals,bridgeProbes,{preferQtMask});
  const smooth=new Uint32Array(256),bridges=new Uint32Array(512);
  if(prepared.state[1]===0)for(let i=0;i<n;i++){
    const b=i*64,z=i*128;
    if(prepared.rows[b+1])smooth.set(runSmoothSegmentsCPU(prepared.rows.slice(b,b+64)),b);
    if(prepared.bridgeRows[b+1]){const qt=runQtBridgeCPU(prepared.bridgeRows.slice(b,b+64),{durationMode:'fixed'}).output;bridges.set(qt,z);prepared.state[48]+=qt[6];}
  }
  // Crucially no event resolver/journal side effects before whole-interval clearance.
  const result=finishRecurringPrefixCPU(prepared,smooth,bridges,undefined,null,options?.rollingV2);
  if(result.state[1]!==1)return fallback();
  return {...result,probeRows,proposals,bridgeProbes,experimentalEarlyQt:true};
}

export function runExperimentalEarlyQtWorldCPU(world,scene,hulls,options){
  if(options?.selectedTrace)throw new RangeError('Experimental early qt policy is not selected-trace qualified');
  return {...runPreparedWorldCPU(world,scene,hulls,options,null,advanceExperimentalEarlyQtCPU),
    integrationPolicy:'experimental-early-qt-v1',gpuQualified:false};
}
