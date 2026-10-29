/** BUILD ONLY: execute original factories on a nonexecuting recorder. */
import {createLiveWorldCaptureDevice} from '../direct-candidate/experimental-live-world-capture.mjs';
import {createRawWorldGPU,RAW_WORLD_HANDOFF_WGSL} from '../direct-candidate/deterministic-raw-world.mjs';
import {generateRawStrikePhases} from '../direct-candidate/deterministic-raw-strike.mjs';
import {WASM_GPU_RAW_ARTIFACT_FORMAT,rawArtifactHash,loadWasmGpuRawArtifact} from './raw-artifact.mjs';
export async function createWasmGpuRawArtifact({batch,sourceRevision}={}){
 if(![1,3].includes(batch?.count)||!Number.isSafeInteger(batch.effectiveMaximumSteps)||batch.effectiveMaximumSteps<1||batch.effectiveMaximumSteps>4096||typeof sourceRevision!=='string'||!sourceRevision.trim())throw Error('Explicit staged N1/N3 positive-step raw capture/revision required');
 const r=createLiveWorldCaptureDevice(),factory=await createRawWorldGPU(r.device,{strikeBackend:'staged'}),bank=factory.createBank(batch);
 try{
 bank.encode(r.device.createCommandEncoder());if(r.submits!==0||r.commands.length!==bank.dispatches||r.commands.length!==4*batch.effectiveMaximumSteps+3)throw Error('Raw capture command count mismatch');
 const phases=generateRawStrikePhases(),roles=new Map(),bufferRoles=new Map(),definitions=[],definitionIds=new Map(),dictionary=[],indices=[],commandIds=new Map();
 for(const c of r.commands){const p=r.pipelines[c.pipeline];if(c.kind!=='dispatch'||c.indirect||c.x!==Math.ceil(batch.count/32)||p.layout!=='auto'||p.entryPoint!=='main'||Object.keys(p.constants).length)throw Error('Unsupported raw capture command');
 const code=p.module.code,names=code===RAW_WORLD_HANDOFF_WGSL?['strikeResult','handoffInput','rosterTemplate','admitted','prepared','status','budget']:phases.some(x=>x.code===code)?['scene','strikeInput','strikeResult','strikeScratch']:null;
 if(!names||c.entries.length!==names.length)throw Error('Unknown raw consuming source');
 c.entries.forEach((e,i)=>{const b=r.buffers[e.buffer],role=names[i];if(e.binding!==i||e.offset!==0||e.size!==b.size||roles.has(role)&&roles.get(role)!==b.id||bufferRoles.has(b.id)&&bufferRoles.get(b.id)!==role)throw Error('Raw source role ownership mismatch');roles.set(role,b.id);bufferRoles.set(b.id,role);});
 let definition=definitionIds.get(p.id);if(definition===undefined){definition=definitions.length;definitionIds.set(p.id,definition);definitions.push({code,layout:p.layout,entryPoint:p.entryPoint,constants:p.constants});}
 const command={kind:'dispatch',definition,x:c.x,entries:c.entries},key=JSON.stringify(command);let id=commandIds.get(key);if(id===undefined){id=dictionary.length;commandIds.set(key,id);dictionary.push(command);}indices.push(id);
 }
 if(bufferRoles.size!==r.buffers.length||roles.get('prepared')!==bank.preparedWorldBuffer.id||roles.get('status')!==bank.handoffStatusBuffer.id||roles.get('strikeResult')!==bank.rawResultBuffer.id)throw Error('Raw exported ownership mismatch');
 const allocations=r.buffers.map(b=>({role:bufferRoles.get(b.id),bytes:b.size,sourceUsage:b.usage,usage:b.usage|8}));
 const payload={count:batch.count,maximumSteps:batch.effectiveMaximumSteps,sourceRevision,strikeBackend:'staged',allocations,definitions,commands:{dictionary,indices},outputs:{prepared:roles.get('prepared'),status:roles.get('status')},sourceHashes:await Promise.all(definitions.map(d=>rawArtifactHash(d.code)))};
 const artifact={format:WASM_GPU_RAW_ARTIFACT_FORMAT,sha256:await rawArtifactHash(payload),payload};
 await loadWasmGpuRawArtifact(artifact,{expectedArtifactSha256:artifact.sha256,expectedSourceRevision:sourceRevision,expectedCount:batch.count,expectedMaximumSteps:batch.effectiveMaximumSteps});
 return {artifact,initialUploads:r.buffers.map(b=>({index:b.id,initial:b.bytes.slice()}))};
 }finally{bank.dispose();}
}
