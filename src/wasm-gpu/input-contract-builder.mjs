/** Build-only projection. Runtime input contracts cannot mint native engine brands. */
import{assertLoadedWasmGpuEngineArtifact}from'./engine-artifact.mjs';
import{assertLoadedWasmGpuRawArtifact}from'./raw-artifact.mjs';
import{assertLoadedWasmGpuSelectedArtifact}from'./selected-artifact.mjs';
export function createWasmGpuInputContract(kind,engine){
 let payload;
 if(kind==='world'){
  assertLoadedWasmGpuEngineArtifact(engine);const p=engine.lowered.sourcePlan;
  payload={count:engine.count,structuralConfig:engine.structuralConfig,resources:{totalOwnedBytes:engine.resources.totalOwnedBytes},lowered:{identity:engine.lowered.identity,shared:engine.lowered.shared,sourcePlan:{allocations:p.allocations,sourceCommandCount:p.commands.length,cushionLowering:p.cushionLowering,queryLowering:p.queryLowering}}};
 }else if(kind==='raw'){
  assertLoadedWasmGpuRawArtifact(engine);payload={count:engine.count,maximumSteps:engine.maximumSteps,strikeBackend:engine.strikeBackend,allocations:engine.allocations,totalOwnedBytes:engine.totalOwnedBytes};
 }else if(kind==='selected'){
  assertLoadedWasmGpuSelectedArtifact(engine);payload={count:1,structuralConfig:engine.structuralConfig,allocations:engine.allocations,initialization:engine.initialization,outputs:engine.outputs,resourcePlan:{totalOwnedBytes:engine.resourcePlan.totalOwnedBytes},commandCount:engine.commands.length,cushionLowering:engine.cushionLowering,queryLowering:engine.queryLowering};
 }else throw Error('Exact input contract kind required');
 return JSON.parse(JSON.stringify({format:'wasm-gpu-input-contract-v1',kind,sourceRevision:engine.sourceRevision,artifactSha256:engine.artifactSha256,payload}));
}
