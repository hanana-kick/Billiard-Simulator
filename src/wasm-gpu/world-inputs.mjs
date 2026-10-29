/** Current owned request -> original source-owned host input bytes. No factory
 * capture and no physics evaluation. Every arena is reset, including zeros. */
import {snapshotCanonicalWorldContinuation} from '../direct-candidate/canonical-world-continuation.mjs';
import {snapshotRawWorldBatch} from '../direct-candidate/deterministic-raw-world.mjs';
import {bindCanonicalJournalRules,snapshotCanonicalJournalRules} from '../direct-candidate/canonical-journal-rules.mjs';
import {packRawJournalPrefixConfig} from '../direct-candidate/canonical-raw-journal-prefix.mjs';
import {packPreparedWorldInputs} from '../direct-candidate/deterministic-prepared-world-inputs.mjs';
import {packCushionResolverV2Inputs} from '../direct-candidate/deterministic-cushion-resolver-v2-inputs.mjs';
import {assertLoadedWasmGpuEngineArtifact,canonicalEngineArtifactJSON} from './engine-artifact.mjs';
import {assertLoadedWasmGpuRawArtifact} from './raw-artifact.mjs';
export const WORLD_UPLOAD_MANIFEST_FORMAT='wasm-gpu-world-upload-manifest-v1';
export const WORLD_INPUT_ROLES=Object.freeze(['rows','scene','context','recurContext','landingConfig','cloth','tailScene','pairMaterial','iterations','qtSearchConfig','qtFixedConfig'].map(x=>'world:'+x).concat(['rules:config','rules:identity','raw-prefix:identity'],['scene','rails','queryConfig','mergeConfig','releaseConfig',...Array.from({length:4},(_,i)=>'hull:'+i),...Array.from({length:4},(_,i)=>'material:'+i),...Array.from({length:4},(_,i)=>'release:'+i)].map(x=>'cushion-v2:'+x)));
const bytes=x=>new Uint8Array(x.buffer,x.byteOffset,x.byteLength).slice();
const equal=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
// Weak ownership keys only: neither an engine nor a global strong request list
// retains prior requests. Cached arrays never leave this module.
const requestInputCache=new WeakMap();
export function packWasmGpuWorldInputRoles({binding,batch}={}){
 // snapshotRawWorldBatch verifies EVERY incoming batch's source-owned receipt.
 const raw=snapshotRawWorldBatch(batch),b=batch.binding;
 let byRaw=requestInputCache.get(binding),cached=byRaw?.get(b);
 const d=cached?null:snapshotCanonicalWorldContinuation(binding);
 if(batch.count!==1||b.requestIdentity!==binding.requestIdentity||b.sceneId!==binding.sceneIdentity||b.sceneKey!==binding.sceneKey||b.requestKey!==binding.requestKey||b.shotClock.startingTick!==binding.shotClock.startingTick||b.shotClock.deadlineTick!==binding.shotClock.deadlineTick)throw Error('Current owned world/raw binding mismatch');
 if(d&&(d.options.mixedMotionRevision!=='mmq2'||d.options.enableCushionContinuation!==true||d.options.selectedTrace))throw Error('Current input adapter requires MMQ2 cushion profile without trace');
 const original=raw.template.slice();original[1]=raw.rawRows[0];
 const request=cached?cached.request:d.request,rules=snapshotCanonicalJournalRules(bindCanonicalJournalRules(request,batch));
 if(!cached){
  const p=packPreparedWorldInputs(original,d.scene,d.hulls,d.options);
  const c=packCushionResolverV2Inputs({scene:p.tailScene,hulls:d.hulls,rails:p.cushionSettings.rails,bodyCount:original[2],material:p.cushionSettings.material,options:p.cushionSettings});
  const roles=new Map();for(const role of WORLD_INPUT_ROLES.filter(x=>x.startsWith('world:')&&x!=='world:rows'))roles.set(role,bytes(p[role.slice(6)]));
  roles.set('rules:config',bytes(rules.config));
  for(const key of ['scene','rails','queryConfig','mergeConfig','releaseConfig'])roles.set('cushion-v2:'+key,bytes(c[key]));
  for(let i=0;i<4;i++)for(const [name,values]of [['hull',c.hulls],['material',c.materials],['release',c.releaseConfigs]])roles.set('cushion-v2:'+name+':'+i,bytes(values[i]));
  cached={request,roles,template:raw.template.slice(),bodyCount:original[2],maxWorldSteps:d.options.maxWorldSteps};
  if(!byRaw){byRaw=new WeakMap();requestInputCache.set(binding,byRaw);}byRaw.set(b,cached);
 }else if(!equal(cached.template,raw.template)||!equal(cached.roles.get('rules:config'),bytes(rules.config)))throw Error('Owned request-invariant input changed within binding');
 // Candidate rows and both identity roles are regenerated on every call, even
 // when the raw-chain manifest does not upload world:rows.
 const roles=new Map([...cached.roles].map(([role,value])=>[role,value.slice()]));
 roles.set('world:rows',bytes(original));roles.set('rules:identity',bytes(rules.identity));roles.set('raw-prefix:identity',bytes(packRawJournalPrefixConfig(batch)));
 return {roles,shape:{profile:'mmq2-cushion',strikeBackend:'staged',bodyCount:cached.bodyCount,maximumSteps:batch.effectiveMaximumSteps,maxWorldSteps:cached.maxWorldSteps},candidateId:raw.rawRows[0]};
}
export function validateWasmGpuWorldUploadManifest(manifest,plan){
 if(manifest?.format!==WORLD_UPLOAD_MANIFEST_FORMAT||!manifest.shape||!Array.isArray(manifest.allocations)||manifest.allocations.length!==plan.allocations.length)throw Error('Signed complete world upload manifest required');
 manifest.allocations.forEach((m,index)=>{const a=plan.allocations[index];if(!m||m.index!==index||m.size!==a.size||m.usage!==a.usage||m.external!==a.external||!['zero','external',...WORLD_INPUT_ROLES].includes(m.role)||typeof m.hostInitialized!=='boolean')throw Error('Upload manifest allocation/resource mismatch');if(a.external?(m.role!=='external'||m.hostInitialized):(m.role==='external'||(m.role==='zero')===m.hostInitialized))throw Error('Upload manifest initialization classification mismatch');});
 return manifest;
}
export function prepareWasmGpuWorldUploads({engine,bindings,batches}={}){
 assertLoadedWasmGpuEngineArtifact(engine);const plan=engine.lowered.sourcePlan,manifest=validateWasmGpuWorldUploadManifest(engine.structuralConfig.uploadManifest,plan);
 if(!Array.isArray(bindings)||!Array.isArray(batches)||bindings.length!==engine.count||batches.length!==engine.count)throw Error('Exact current owned candidate width required');
 const candidates=batches.map((batch,i)=>packWasmGpuWorldInputRoles({binding:bindings[i],batch}));
 for(const c of candidates)if(canonicalEngineArtifactJSON(c.shape)!==canonicalEngineArtifactJSON(manifest.shape))throw Error('Current input structural shape mismatch');
 const initialUploads=[];for(const m of manifest.allocations){if(m.external)continue;const rows=candidates.map(c=>m.role==='zero'?new Uint8Array(m.size):c.roles.get(m.role));if(rows.some(x=>!(x instanceof Uint8Array)||x.byteLength!==m.size))throw Error('Current semantic upload size mismatch');const shared=engine.lowered.shared[m.index];if(shared&&rows.some(x=>!equal(x,rows[0])))throw Error('Current inputs differ in a structurally shared allocation');const initial=new Uint8Array(m.size*(shared?1:engine.count));for(let i=0;i<(shared?1:rows.length);i++)initial.set(rows[i],i*m.size);initialUploads.push({index:m.index,initial});}
 return {initialUploads,candidateIds:Uint32Array.from(candidates,c=>c.candidateId)};
}
export function prepareWasmGpuRawUploads({rawEngine,batch}={}){
 assertLoadedWasmGpuRawArtifact(rawEngine);const s=snapshotRawWorldBatch(batch);if(batch.count!==rawEngine.count||batch.effectiveMaximumSteps!==rawEngine.maximumSteps)throw Error('Current raw batch structural shape mismatch');
 const data={scene:s.rawScene,strikeInput:s.rawRows,handoffInput:s.rawRows,rosterTemplate:s.template,admitted:s.admitted,budget:s.budgetWords};
 return rawEngine.allocations.map((a,index)=>{const initial=Object.hasOwn(data,a.role)?bytes(data[a.role]):new Uint8Array(a.bytes);if(initial.byteLength!==a.bytes)throw Error('Current raw role size mismatch');return {index,initial};});
}
/** Bind world and raw inputs to the same current owned batch, not merely the
 * same allocation sizes or copied candidate IDs. */
export function prepareWasmGpuCurrentInputs({engine,rawEngine,bindings,batches,rawBatch}={}){
 if(!Array.isArray(bindings)||!bindings.length||bindings.some(b=>b!==bindings[0]))throw Error('One owned world binding per current request required');
 const world=prepareWasmGpuWorldUploads({engine,bindings,batches});assertLoadedWasmGpuRawArtifact(rawEngine);
 if(rawEngine.count!==engine.count||rawEngine.sourceRevision!==engine.sourceRevision)throw Error('Current raw/world artifact ownership mismatch');
 const complete=snapshotRawWorldBatch(rawBatch);
 if(rawBatch.count!==batches.length)throw Error('Current raw/world batch width mismatch');
 for(let i=0;i<batches.length;i++){const one=snapshotRawWorldBatch(batches[i]);
  for(const key of ['requestIdentity','sceneId','epoch','sceneKey','requestKey'])if(rawBatch.binding[key]!==batches[i].binding[key])throw Error('Current raw/world owned binding identity mismatch');
  if(canonicalEngineArtifactJSON(rawBatch.binding.shotClock)!==canonicalEngineArtifactJSON(batches[i].binding.shotClock))throw Error('Current raw/world shot clock mismatch');
  for(const key of ['template','rawScene','budgetWords'])if(!equal(complete[key],one[key]))throw Error('Current raw/world shared request input mismatch');
  if(!equal(complete.rawRows.subarray(i*16,(i+1)*16),one.rawRows)||complete.admitted[i]!==one.admitted[0]||rawBatch.candidateKeys[i]!==batches[i].candidateKeys[0])throw Error('Current raw/world candidate input mismatch');
 }
 return {...world,rawUploads:prepareWasmGpuRawUploads({rawEngine,batch:rawBatch})};
}

export function prepareWasmGpuInputs({engine,rawEngine,binding,singleBatches,batch}={}){
 assertLoadedWasmGpuEngineArtifact(engine);return prepareWasmGpuCurrentInputs({engine,rawEngine,bindings:Array(engine.count).fill(binding),batches:singleBatches,rawBatch:batch});
}
