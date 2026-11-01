/** Independently pinned VM allocation facts. Original input contracts stay branded
 * and unchanged; this receipt, not their old arena totals, accounts GPU ownership. */
import{snapshotOwnedBytes}from'./owned-bytes.mjs';
import{assertWasmGpuWorldInputContract,assertWasmGpuRawInputContract,assertWasmGpuSelectedInputContract}from'../wasm-gpu/input-contract.mjs';
const owned=new WeakMap(),MiB=1024*1024,hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const exact=(x,keys)=>{if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join(',')!==keys.split(',').sort().join(','))throw Error('Exact compiled resource receipt fields required');};
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
export async function loadCompiledFrontendResourcePolicy(input,{expectedSHA256,expectedSourceRevision,expectedRuntimeRevision,expectedInputManifestSHA256}={}){
 if(![expectedSHA256,expectedSourceRevision,expectedRuntimeRevision,expectedInputManifestSHA256].every(hash))throw Error('Independent compiled resource pins required');
 const bytes=snapshotOwnedBytes(input,128*1024);if(await sha(bytes)!==expectedSHA256)throw Error('Compiled resource receipt digest mismatch');const m=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));exact(m,'kind,version,physicsSourceRevision,runtimeRevision,inputManifestSHA256,schedulerSHA256,programs');
 if(m.kind!=='compiled-app-resource-receipt-v1'||m.version!==1||m.physicsSourceRevision!==expectedSourceRevision||m.runtimeRevision!==expectedRuntimeRevision||m.inputManifestSHA256!==expectedInputManifestSHA256||!hash(m.schedulerSHA256))throw Error('Compiled resource receipt identity mismatch');
 exact(m.programs,'search-N1,search-N3,selected-N1');const profiles=new Map();
 for(const key of ['search-N1','search-N3','selected-N1']){const r=m.programs[key],kind=key.startsWith('search')?'search':'selected',count=key==='search-N3'?3:1;const native=kind==='selected'&&r.transport==='native-wgsl';exact(r,native?'kind,count,transport,compiledManifestSHA256,compiledArtifactSHA256,transformRevision,sourceArtifacts,bufferBytes,readbackBytes,totalOwnedBytes':'kind,count,compiledManifestSHA256,compiledArtifactSHA256,compilerRevision,sourceArtifacts,bufferBytes,readbackBytes,totalOwnedBytes');
  if(r.kind!==kind||r.count!==count||![r.compiledManifestSHA256,r.compiledArtifactSHA256,native?r.transformRevision:r.compilerRevision].every(hash))throw Error('Closed compiled resource profile required');exact(r.sourceArtifacts,kind==='search'?'world,raw':'selected');if(!Object.values(r.sourceArtifacts).every(hash))throw Error('Original artifact identities required');
  const allocationCeilingBytes=(kind==='selected'?24:count===3?16:8)*MiB;const size=n=>Number.isSafeInteger(n)&&n>=4&&n%4===0&&n<=allocationCeilingBytes;
  if(!Array.isArray(r.bufferBytes)||r.bufferBytes.length!==(native?233:10)||!r.bufferBytes.every(size)||!size(r.readbackBytes)||!Number.isSafeInteger(r.totalOwnedBytes)||r.bufferBytes.reduce((a,b)=>a+b,0)+r.readbackBytes!==r.totalOwnedBytes||r.totalOwnedBytes>allocationCeilingBytes)throw Error('Exact compiled allocation ledger exceeds fixed profile');
  if(native&&(r.totalOwnedBytes!==9048004||r.readbackBytes!==262208||r.bufferBytes.at(-1)!==512))throw Error('Closed native resource ledger');
  profiles.set(key,freeze({...r,key,allocationCeilingBytes,aggregateCeilingBytes:24*MiB,maximumResidentOwners:kind==='search'?2:1}));
 }
 const policy=Object.freeze({kind:'owned-compiled-frontend-resource-policy-v1',physicsSourceRevision:m.physicsSourceRevision,runtimeRevision:m.runtimeRevision,inputManifestSHA256:m.inputManifestSHA256,schedulerSHA256:m.schedulerSHA256,receiptSHA256:expectedSHA256,maximumOwnedBytes:24*MiB,groupBudgets:Object.freeze({search:24*MiB,selected:24*MiB})});owned.set(policy,profiles);return policy;
}
export function assertCompiledFrontendResourcePolicy(policy){if(!owned.has(policy))throw Error('Owned compiled frontend resource policy required');return policy;}
export function compiledResourceProfile(policy,key){assertCompiledFrontendResourcePolicy(policy);const r=owned.get(policy).get(key);if(!r)throw Error('Registered compiled profile required');return r;}
export function assertCompiledResourceFact(policy,fact){const r=compiledResourceProfile(policy,fact?.key);if(r!==fact)throw Error('Owned matching compiled resource fact required');return fact;}
export function compiledResourceFor(policy,{engine,rawEngine}){
 assertCompiledFrontendResourcePolicy(policy);let key;if(rawEngine){assertWasmGpuWorldInputContract(engine);assertWasmGpuRawInputContract(rawEngine);key='search-N'+engine.count;}else{assertWasmGpuSelectedInputContract(engine);key='selected-N1';}const r=compiledResourceProfile(policy,key);
 if(engine.sourceRevision!==policy.physicsSourceRevision||engine.count!==r.count||rawEngine&&(rawEngine.count!==r.count||rawEngine.sourceRevision!==policy.physicsSourceRevision)||rawEngine&&(engine.artifactSha256!==r.sourceArtifacts.world||rawEngine.artifactSha256!==r.sourceArtifacts.raw)||!rawEngine&&engine.artifactSha256!==r.sourceArtifacts.selected)throw Error('Compiled resource/original input identity mismatch');return r;
}
