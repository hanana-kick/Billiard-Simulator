import{canonicalWidthProfile}from'./width-profiles.mjs';
import {canonicalRuntimeClosure} from './runtime-closure.mjs';
import {snapshotOwnedBytes} from './owned-bytes.mjs';
/** Explicit experimental input-only lookup. Bytecode authority and runtime build
 * closure are independently pinned; original WGSL graphs are never loaded. */
import {assertIntegrityVerifiedWasmGpuInputLibrary} from '../wasm-gpu/input-library.mjs';
import {assertWasmGpuWorldInputContract,assertWasmGpuRawInputContract} from '../wasm-gpu/input-contract.mjs';
import {loadCanonicalProgramArtifact,assertCanonicalRuntimePack} from './program-artifact.mjs';
import {createResidentSchedulerPlan,assertResidentSchedulerPlan} from './resident-scheduler-plan.mjs';
const entries=new WeakSet(),libraries=new WeakSet();
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const exact=(x,names)=>{if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join(',')!==names.split(',').sort().join(','))throw Error('Exact compiled manifest schema required');};
const copy=snapshotOwnedBytes;
const check=signal=>{if(signal?.aborted)throw Object.assign(Error(String(signal.reason??'Cancelled')),{name:'AbortError'});};

export function assertExperimentalCompiledEntry(entry){if(!entries.has(entry))throw Error('Owned compiled input entry required');assertCanonicalRuntimePack(entry.pack);assertResidentSchedulerPlan(entry.plan);return entry;}
export function assertExperimentalCompiledLibrary(library){if(!libraries.has(library))throw Error('Owned compiled input library required');return library;}
export async function createExperimentalCompiledInputLibrary({inputLibrary,manifestBytes,compiledBytes,expectedManifestSHA256,expectedPhysicsSourceRevision,expectedCompilerRevision,expectedRuntimeRevision,signal}={}){
 assertIntegrityVerifiedWasmGpuInputLibrary(inputLibrary);check(signal);
 if(![expectedManifestSHA256,expectedPhysicsSourceRevision,expectedCompilerRevision,expectedRuntimeRevision].every(hash))throw Error('Independent compiled manifest/source/compiler/runtime pins required');
 const bytes=copy(manifestBytes,256*1024);if(await sha(bytes)!==expectedManifestSHA256)throw Error('Compiled manifest digest mismatch');check(signal);
 const m=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));exact(m,'kind,version,physicsSourceRevision,compilerRevision,runtimeRevision,runtimeClosure,inputManifestSHA256,program');
 if(m.kind!=='experimental-compiled-search-manifest-v1'||m.version!==1||m.physicsSourceRevision!==expectedPhysicsSourceRevision||m.compilerRevision!==expectedCompilerRevision||m.runtimeRevision!==expectedRuntimeRevision||m.inputManifestSHA256!==inputLibrary.manifestSha256||inputLibrary.sourceRevision!==m.physicsSourceRevision)throw Error('Compiled/input build identity mismatch');
 const closure=JSON.parse(canonicalRuntimeClosure(m.runtimeClosure));if(await sha(new TextEncoder().encode(canonicalRuntimeClosure(closure)))!==expectedRuntimeRevision)throw Error('Runtime closure digest mismatch');
 const p=m.program;exact(p,'count,profile,strikeBackend,bodyCount,maximumSteps,maxWorldSteps,artifactSHA256,artifactByteLength,worldArtifactSHA256,rawArtifactSHA256,commandSourceSHA256');
 const widthProfile=canonicalWidthProfile(p.count);if(p.profile!=='mmq2-cushion'||p.strikeBackend!=='staged'||p.bodyCount!==4||p.maximumSteps!==2048||p.maxWorldSteps!==128||![p.artifactSHA256,p.worldArtifactSHA256,p.rawArtifactSHA256,p.commandSourceSHA256].every(hash))throw Error('Only exact experimental width profile is supported');if(p.worldArtifactSHA256!==widthProfile.worldArtifactSHA256||p.rawArtifactSHA256!==widthProfile.rawArtifactSHA256)throw Error('Original width profile identity mismatch');
 const payload=copy(compiledBytes,32*1024*1024);if(payload.byteLength!==p.artifactByteLength)throw Error('Compiled artifact length mismatch');
 const pack=loadCanonicalProgramArtifact(payload,{expectedSHA256:p.artifactSHA256,expectedSourceRevision:m.physicsSourceRevision,expectedCompilerRevision:m.compilerRevision,expectedCount:p.count});
 // Deliberately fails closed while older loaders omit these validated fields.
 if(pack.worldArtifactSHA256!==p.worldArtifactSHA256||pack.rawArtifactSHA256!==p.rawArtifactSHA256||pack.sourceManifestSHA256!==m.inputManifestSHA256||pack.commandSourceSHA256!==p.commandSourceSHA256)throw Error('Compiled pack provenance projection missing or mismatched');
 const plan=createResidentSchedulerPlan(pack);let cached=null;
 const library=Object.freeze({experimental:true,productionEnabled:false,inputOnly:true,sourceRevision:m.physicsSourceRevision,compilerRevision:m.compilerRevision,runtimeRevision:m.runtimeRevision,manifestSHA256:expectedManifestSHA256,schedulerSHA256:closure.scheduler.sha256,
  async lookupProgram(selector,{signal}={}){check(signal);exact(selector,'sourceRevision,count,profile,strikeBackend,bodyCount,maximumSteps,maxWorldSteps');if(selector.sourceRevision!==m.physicsSourceRevision||['count','profile','strikeBackend','bodyCount','maximumSteps','maxWorldSteps'].some(k=>selector[k]!==p[k]))throw Error('Exact compiled width selector required');if(cached)return assertExperimentalCompiledEntry(cached);
   const original=await inputLibrary.lookupProgram(selector,{signal});check(signal);const engine=assertWasmGpuWorldInputContract(original.engine),rawEngine=assertWasmGpuRawInputContract(original.rawEngine);
   if(engine.sourceRevision!==m.physicsSourceRevision||rawEngine.sourceRevision!==m.physicsSourceRevision||engine.count!==p.count||rawEngine.count!==p.count||engine.artifactSha256!==p.worldArtifactSHA256||rawEngine.artifactSha256!==p.rawArtifactSHA256)throw Error('Owned input contract/source artifact identity mismatch');
   const world=engine.lowered.sourcePlan.allocations;if(world.length!==pack.banks.world.length||rawEngine.allocations.length!==pack.banks.raw.length)throw Error('Compiled arena/input count mismatch');
   for(const [index,a]of rawEngine.allocations.entries()){const arena=pack.arenas[pack.banks.raw[index]];if(arena.bank!=='raw'||arena.index!==index||arena.bytes!==a.bytes||arena.atomic)throw Error('Compiled raw input mapping mismatch');}
   for(const [index,a]of world.entries()){const arena=pack.arenas[pack.banks.world[index]];if(arena.bytes!==a.size*(a.external?p.count:engine.lowered.shared[index]?1:p.count)||arena.atomic||(!a.external&&(arena.bank!=='world'||arena.index!==index)))throw Error('Compiled world input mapping mismatch');if(a.external){const rawIndex=rawEngine.allocations.findIndex(x=>x.role===a.external);if(pack.banks.world[index]!==pack.banks.raw[rawIndex])throw Error('Compiled raw/world alias mismatch');}}
   const entry=Object.freeze({engine,rawEngine,pack,plan,inputOnly:true,experimental:true,productionEnabled:false,resources:Object.freeze({totalOwnedBytes:plan.totalOwnedBytes}),runtimeRevision:m.runtimeRevision,schedulerSHA256:closure.scheduler.sha256});entries.add(entry);cached=entry;return entry;
  },lookupSelectedProgram(){return Promise.reject(Error('Experimental compiled selected program is not qualified'));},
 });libraries.add(library);return library;
}
