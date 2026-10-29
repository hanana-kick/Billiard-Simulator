/** Build-time packaging of an exact captured/lowered GPU program, NOT an engine
 * qualification or universal physics model. No GPU/CPU physics executes here.
 * Trust root: the caller must obtain the expected digest/revision/config/width
 * independently of this artifact (e.g. its bundled build manifest).
 */
import {planLiveWorldResources} from '../direct-candidate/experimental-live-world-resources.mjs';
const sha256Text=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
export const WASM_GPU_ENGINE_ARTIFACT_FORMAT='wasm-gpu-live-program-v1';
const MAX_BYTES=64*1024*1024;
const loadedArtifacts=new WeakSet();
export function assertLoadedWasmGpuEngineArtifact(engine){if(!loadedArtifacts.has(engine))throw TypeError('Owned loaded WASM GPU engine artifact required');return engine;}
const freeze=(x,seen=new WeakSet())=>{if(x&&typeof x==='object'&&!seen.has(x)){seen.add(x);Object.values(x).forEach(v=>freeze(v,seen));Object.freeze(x);}return x;};
function packCommands(commands){
 const dictionary=[],indices=[],bindings=[],known=new Map(),knownBindings=new Map();
 for(const command of commands){let entry=command;if(command.entries){const key=canonicalEngineArtifactJSON(command.entries);let id=knownBindings.get(key);if(id===undefined){id=bindings.length;bindings.push(command.entries);knownBindings.set(key,id);}entry={...command,entries:id};}const key=canonicalEngineArtifactJSON(entry);let index=known.get(key);if(index===undefined){index=dictionary.length;dictionary.push(entry);known.set(key,index);}indices.push(index);}
 return {dictionary,indices,bindings};
}
function unpackCommands(packed){
 keys(packed,['dictionary','indices','bindings']);if(!Array.isArray(packed.dictionary)||!Array.isArray(packed.indices)||!Array.isArray(packed.bindings)||!packed.dictionary.length||!packed.indices.length)throw Error('Packed command dictionary/stream required');
 if(packed.indices.length>65536||packed.dictionary.length>packed.indices.length||packed.bindings.length>packed.dictionary.length)throw RangeError('Packed command counts exceed scheduler capacity');
 const bindingUsed=new Set(),dictionary=packed.dictionary.map(c=>{if(!Object.hasOwn(c,'entries'))return c;const id=c.entries;if(!Number.isSafeInteger(id)||id<0||id>=packed.bindings.length||!Array.isArray(packed.bindings[id]))throw Error('Invalid packed bindings handle');bindingUsed.add(id);return {...c,entries:packed.bindings[id]};});
 const used=new Set(),commands=packed.indices.map(index=>{if(!Number.isSafeInteger(index)||index<0||index>=dictionary.length)throw Error('Invalid packed command handle');used.add(index);return dictionary[index];});
 if(used.size!==dictionary.length||bindingUsed.size!==packed.bindings.length)throw Error('Unused packed dictionary entry');return commands;
}
// Canonical JSON only: no typed arrays, undefined, nonfinite numbers, prototypes,
// cycles or getters are part of the on-disk structural format. The byte cap
// is checked after normalization; it is not an adversarial streaming parser.
function normalizeJSON(value){
 const active=new Set();
 const visit=x=>{
  if(x===null||typeof x==='string'||typeof x==='boolean')return x;
  if(typeof x==='number'&&Number.isFinite(x))return x;
  if(!x||typeof x!=='object'||active.has(x))throw TypeError('Artifact requires finite acyclic JSON');
  if(!Array.isArray(x)&&Object.getPrototypeOf(x)!==Object.prototype&&Object.getPrototypeOf(x)!==null)throw TypeError('Artifact requires plain JSON');
  active.add(x);let out;
  if(Array.isArray(x)){out=[];for(let i=0;i<x.length;i++){const d=Object.getOwnPropertyDescriptor(x,String(i));if(!d||!Object.hasOwn(d,'value'))throw TypeError('Sparse/accessor artifact array');out.push(visit(d.value));}}
  else{out={};for(const k of Object.keys(x).sort()){const d=Object.getOwnPropertyDescriptor(x,k);if(!Object.hasOwn(d,'value'))throw TypeError('Artifact accessor forbidden');Object.defineProperty(out,k,{value:visit(d.value),enumerable:true,writable:true,configurable:true});}}
  active.delete(x);return out;
 };
 return visit(value);
}
export function canonicalEngineArtifactJSON(value){
 const json=JSON.stringify(normalizeJSON(value));if(json.length>MAX_BYTES||(json.length>MAX_BYTES/3&&new TextEncoder().encode(json).length>MAX_BYTES))throw RangeError('Artifact exceeds structural byte limit');return json;
}
const copy=normalizeJSON;
const keys=(x,want)=>{if(!x||Object.keys(x).sort().join(',')!==want.slice().sort().join(','))throw Error('Unexpected artifact fields');};
const digest=x=>sha256Text(canonicalEngineArtifactJSON(x));
const validDigest=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
function validateHeader(p){
 keys(p,['count','sourceRevision','structuralConfig','lowered','rawAllocations','sourceHashes']);
 if(![1,3].includes(p.count))throw RangeError('First-slice artifact widths N1/N3 only; wider qualification is not inherited');
 if(typeof p.sourceRevision!=='string'||!p.sourceRevision.trim())throw Error('Explicit source revision required');
 keys(p.lowered,['identity','sourcePlan','shared','definitions','commands','ownershipReport']);
 const config=p.structuralConfig,plan=p.lowered?.sourcePlan;
 if(!config||Array.isArray(config)||typeof config!=='object'||!Object.keys(config).length)throw Error('Explicit structural config required');
 if(!plan||!['experimental-live-mmq1-graph-v1','experimental-live-mmq2-cushion-graph-v1'].includes(plan.kind))throw Error('Unsupported source graph');
 if(config.profile!==(plan.kind.includes('mmq2')?'mmq2-cushion':'mmq1-no-cushion')||config.strikeBackend!==plan.strikeBackend||plan.strikeBackend!==p.rawAllocations?.strikeBackend)throw Error('Structural profile/backend mismatch');
 if(!Array.isArray(plan.allocations)||!Array.isArray(plan.definitions)||!Array.isArray(p.lowered.definitions))throw Error('Complete structural graph arrays required');
 for(const a of plan.allocations){keys(a,['size','usage','external']);if(!Number.isSafeInteger(a.usage)||a.usage<1||a.usage>1023)throw Error('Invalid allocation usage');}
 if(plan.sourceQualified!==false||plan.nativeQualified!==false)throw Error('Artifact cannot assert execution qualification');
}
async function sourceHashes(lowered){
 const result={plan:await digest(lowered.sourcePlan),original:[],lowered:[]};
 // Bound temporary encoded shader bytes to one definition at a time.
 for(const d of lowered.sourcePlan.definitions)result.original.push(await sha256Text(d.source));
 for(const d of lowered.definitions)result.lowered.push(await sha256Text(d.code));
 return result;
}
/** initialUploads is an owned base-plan snapshot, not a multi-candidate input
 * provider. Supply independently prepared per-candidate uploads at execution. */
export async function createWasmGpuEngineArtifact({lowered,count,sourceRevision,structuralConfig,rawAllocations}={}){
 if(!lowered?.sourcePlan?.allocations)throw TypeError('Genuine captured lowered recipe required');
 const initialUploads=lowered.sourcePlan.allocations.map((a,index)=>{if(!(a.initial instanceof Uint8Array)||a.initial.byteLength!==a.size)throw Error('Exact initial upload bytes required');return {index,initial:a.initial.slice()};});
 const sourcePlan={...lowered.sourcePlan,allocations:lowered.sourcePlan.allocations.map(({size,usage,external})=>({size,usage,external}))};
 const recipe=copy({...lowered,sourcePlan:{...sourcePlan,commands:packCommands(sourcePlan.commands)},commands:packCommands(lowered.commands)});
 const payload=copy({count,sourceRevision,structuralConfig,rawAllocations,lowered:recipe,sourceHashes:await sourceHashes(recipe)});
 const artifact={format:WASM_GPU_ENGINE_ARTIFACT_FORMAT,sha256:await digest(payload),payload};
 await loadWasmGpuEngineArtifact(artifact,{expectedArtifactSha256:artifact.sha256,expectedSourceRevision:sourceRevision,expectedStructuralConfig:structuralConfig,expectedCount:count});
 return {artifact:freeze(artifact),initialUploads};
}
/** Fresh resource receipts are derived from exact graph facts, never accepted
 * from serialized receipts. Caller still checks actual GPU limits and budget. */
export async function loadWasmGpuEngineArtifact(input,{expectedArtifactSha256,expectedSourceRevision,expectedStructuralConfig,expectedCount}={}){
 if(!validDigest(expectedArtifactSha256)||typeof expectedSourceRevision!=='string'||!expectedSourceRevision||!expectedStructuralConfig||!Number.isSafeInteger(expectedCount))throw Error('Independent expected digest/revision/config/width required');
 if(typeof input==='string'){if(new TextEncoder().encode(input).length>MAX_BYTES)throw RangeError('Artifact exceeds byte limit');input=JSON.parse(input);}
 const artifact=copy(input);keys(artifact,['format','sha256','payload']);
 if(artifact.format!==WASM_GPU_ENGINE_ARTIFACT_FORMAT||!validDigest(artifact.sha256)||artifact.sha256!==expectedArtifactSha256||await digest(artifact.payload)!==expectedArtifactSha256)throw Error('Artifact integrity hash mismatch');
 const p=artifact.payload;validateHeader(p);
 if(p.sourceRevision!==expectedSourceRevision)throw Error('Source revision mismatch');
 if(p.count!==expectedCount)throw Error('Artifact width mismatch');
 if(canonicalEngineArtifactJSON(p.structuralConfig)!==canonicalEngineArtifactJSON(expectedStructuralConfig))throw Error('Structural config mismatch');
 if(canonicalEngineArtifactJSON(p.sourceHashes)!==canonicalEngineArtifactJSON(await sourceHashes(p.lowered)))throw Error('Shader source hash mismatch');
 p.lowered.commands=unpackCommands(p.lowered.commands);p.lowered.sourcePlan.commands=unpackCommands(p.lowered.sourcePlan.commands);
 for(const c of p.lowered.sourcePlan.commands)if(c.kind==='dispatch'&&!c.indirect&&(!Number.isSafeInteger(c.x)||c.x<1||c.x>0xffffffff))throw Error('Invalid original dispatch width');
 // Legacy identity/report strings are descriptive only; the trusted digest and
 // freshly derived source hashes authenticate the actual complete graph.
 const args={plan:p.lowered.sourcePlan,...p.lowered,count:p.count,rawAllocations:p.rawAllocations};
 const resources=planLiveWorldResources(args),diagnosticResources=planLiveWorldResources({...args,diagnostic:true});
 // The report is descriptive, never a resource-admission capability.
 if(p.lowered.ownershipReport?.requiredStorageBuffersPerShaderStage!==resources.requiredLimits.maxStorageBuffersPerShaderStage)throw Error('Ownership storage count mismatch');
 const result=freeze({lowered:p.lowered,count:p.count,sourceRevision:p.sourceRevision,structuralConfig:p.structuralConfig,rawAllocations:p.rawAllocations,resources,diagnosticResources,artifactSha256:artifact.sha256});
 loadedArtifacts.add(result);return result;
}
