/* SPDX-License-Identifier: Apache-2.0
 * Optional local module packaging only. No worker message receiver, device
 * request, candidate execution or default application activation occurs here.
 */
import {loadWorkerRuntime} from '../bounded-gpu-shot/four-ball-worker-runtime.mjs';
export const RESIDENT_BROWSER_RUNTIME_CAPABILITY=Object.freeze({experimentalOptIn:true,localAssetsOnly:true,automaticDeviceRequest:false,automaticExecution:false,hostForwardFallback:false,numericallyQualified:false,originalFullRestQualified:false,native1024TrajectoriesQualified:false,defaultBackend:false});
let loaded;
export function loadResidentBrowserRuntime(){return loaded??=(async()=>{
 // Original UMD dependencies capture globals during evaluation. Preserve the
 // existing tested postorder before importing resident modules that use them.
 await import('../math.js');await import('../physics.js');await import('../route-rules.js');
 await loadWorkerRuntime();
 const decoder=await import('../../tools/rapier-snapshot-decoder/browser.mjs');
 const initialization=await import('./world-initialization.mjs');
 const runtime=await import('./initial-microcode-runtime.mjs');
 const launch=await import('./initial-microcode-launch.mjs');
 const executor=await import('./initial-microcode-executor.mjs');
 const batch=await import('./initial-microcode-batch-plan.mjs');
 const batchExecutor=await import('./initial-microcode-batch-executor.mjs');
 const retained=await import('./retained-microcode-plan.mjs');
 const retainedExecutor=await import('./retained-microcode-executor.mjs');
 const abi=await import('./abi.mjs');
 return Object.freeze({createSnapshotDecoder:decoder.createSnapshotDecoder,
  createWorldInitializationPlan:initialization.createWorldInitializationPlan,
  createInitialMicrocodeRuntime:runtime.createInitialMicrocodeRuntime,
  assertInitialMicrocodeRuntime:runtime.assertInitialMicrocodeRuntime,
  createInitialMicrocodeLaunch:launch.createInitialMicrocodeLaunch,
  createInitialMicrocodeExecutor:executor.createInitialMicrocodeExecutor,
  createInitialMicrocodeBatchPlan:batch.createInitialMicrocodeBatchPlan,
  createInitialMicrocodeBatchExecutor:batchExecutor.createInitialMicrocodeBatchExecutor,
  createRetainedInitialMicrocodeRuntime:retained.createRetainedInitialMicrocodeRuntime,
  createRetainedInitialMicrocodeBatchPlan:retained.createRetainedInitialMicrocodeBatchPlan,
  createRetainedInitialMicrocodeBatchExecutor:retainedExecutor.createRetainedInitialMicrocodeBatchExecutor,
  decodeResults:abi.decodeResults,capability:RESIDENT_BROWSER_RUNTIME_CAPABILITY});
})();}
