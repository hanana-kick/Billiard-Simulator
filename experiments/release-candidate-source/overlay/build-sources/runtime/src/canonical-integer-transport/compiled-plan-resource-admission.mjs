/** Worker-side receipt check against the actual authenticated VM plan, before GPU allocation. */
import{assertExperimentalCompiledEntry}from'./compiled-program-library.mjs';
import{assertCompiledSelectedEntry}from'./selected-program-library.mjs';
import{compiledResourceFor}from'./frontend-resource-policy.mjs';
export function assertCompiledPlanResources(policy,value){const entry=value?.rawEngine?assertExperimentalCompiledEntry(value):assertCompiledSelectedEntry(value),r=compiledResourceFor(policy,entry),p=entry.plan;
 if(entry.pack.artifactSHA256!==r.compiledArtifactSHA256||entry.pack.compilerRevision!==r.compilerRevision||entry.runtimeRevision!==policy.runtimeRevision||entry.schedulerSHA256!==policy.schedulerSHA256||p.totalOwnedBytes!==r.totalOwnedBytes||entry.resources.totalOwnedBytes!==r.totalOwnedBytes||p.allocationCeilingBytes!==r.allocationCeilingBytes||p.readbackBytes!==r.readbackBytes||p.bufferBytes.length!==r.bufferBytes.length||p.bufferBytes.some((n,i)=>n!==r.bufferBytes[i]))throw Error('Compiled resource receipt differs from authenticated VM plan');return r;
}
