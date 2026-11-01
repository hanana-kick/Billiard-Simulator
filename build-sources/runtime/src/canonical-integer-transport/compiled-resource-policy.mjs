/** Explicit compiled-transport policy, separate from original WGSL 8/12 MiB.
 * Authority comes only from an owned authenticated entry and closed width profile. */
import {assertExperimentalCompiledEntry} from './compiled-program-library.mjs';
import {canonicalWidthProfile} from './width-profiles.mjs';
const owned=new WeakMap(),byEntry=new WeakMap();
export function admitCompiledResourcePolicy(entry){
 assertExperimentalCompiledEntry(entry);const profile=canonicalWidthProfile(entry.pack.count),p=entry.plan;
 const total=p.bufferBytes.reduce((n,size)=>n+size,0)+p.readbackBytes;
 if(p.count!==profile.count||entry.engine.count!==profile.count||entry.rawEngine.count!==profile.count||p.allocationCeilingBytes!==profile.schedulerBudgetBytes||p.totalOwnedBytes!==total||entry.resources.totalOwnedBytes!==total||!Number.isSafeInteger(total)||total<1||total>profile.schedulerBudgetBytes)throw Error('Authenticated compiled VM allocation/profile mismatch');
 let policy=byEntry.get(entry);if(!policy){policy=Object.freeze({kind:'owned-compiled-transport-resource-policy-v1',count:profile.count,totalOwnedBytes:total,allocationCeilingBytes:profile.schedulerBudgetBytes,sourceRevision:entry.pack.sourceRevision,artifactSHA256:entry.pack.artifactSHA256,runtimeRevision:entry.runtimeRevision,maximumResidentOwners:2,aggregateCeilingBytes:24*1024*1024});owned.set(policy,entry);byEntry.set(entry,policy);}return policy;
}
export function assertCompiledResourcePolicy(policy,entry){const actual=owned.get(policy);if(!actual||entry!==undefined&&actual!==entry)throw Error('Owned matching compiled resource policy required');assertExperimentalCompiledEntry(actual);return policy;}
