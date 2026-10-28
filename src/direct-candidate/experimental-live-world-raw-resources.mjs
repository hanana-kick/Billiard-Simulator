/** Original raw factories on a nonexecuting recorder. No raw physics is run.
 * Roles derive from complete consuming WGSL and exact binding views, not IDs or
 * matching byte values. Streaming observation avoids retaining28k raw commands. */
import {createLiveWorldCaptureDevice} from './experimental-live-world-capture.mjs';
import {createRawWorldGPU,snapshotRawWorldBatch,RAW_WORLD_HANDOFF_WGSL} from './deterministic-raw-world.mjs';
import {generateRawStrikePhases} from './deterministic-raw-strike.mjs';
import {generateChunkedRawStrikePhases} from './experimental-raw-strike-chunks.mjs';
export async function captureRawWorldResourceFacts(batch,{strikeBackend='staged'}={}){
 if(!Number.isSafeInteger(batch?.count)||batch.count<1||batch.count>33)throw RangeError('Bounded nonexecuting raw resource capture count1..33');
 if(!['staged','chunked-16'].includes(strikeBackend))throw RangeError('Explicit raw backend');
 const snapshot=snapshotRawWorldBatch(batch),phases=strikeBackend==='staged'?generateRawStrikePhases():generateChunkedRawStrikePhases(),roles=new Map(),bufferRoles=new Map();let dispatches=0,handoffs=0;
 const r=createLiveWorldCaptureDevice({onCommand(command){
  if(command.kind!=='dispatch'||command.indirect||command.x!==Math.ceil(batch.count/32))throw Error('Unknown original raw command/dispatch shape');
  const pipeline=r.pipelines[command.pipeline];if(pipeline.entryPoint!=='main'||pipeline.layout!=='auto'||Object.keys(pipeline.constants).length)throw Error('Unknown original raw pipeline shape');
  const code=pipeline.module.code,workgroups=[...code.matchAll(/@workgroup_size\(([^)]+)\)/g)];if(workgroups.length!==1||workgroups[0][1].trim()!=='32'||/var\s*<\s*workgroup\b|(?:workgroupBarrier|storageBarrier|textureBarrier)\s*\(/.test(code))throw Error('Unreviewed raw workgroup resources');
  const index=phases.findIndex(p=>p.code===code);let names;
  if(code===RAW_WORLD_HANDOFF_WGSL){handoffs++;names=['strikeResult','handoffInput','rosterTemplate','admitted','prepared','status','budget'];}
  else if(index>=0&&batch.effectiveMaximumSteps){names=['scene','strikeInput','strikeResult','strikeScratch',...(strikeBackend==='chunked-16'&&index===1?['chunkControl']:[])];}
  else throw Error('Unknown original raw consuming source');
  if(command.entries.length!==names.length)throw Error('Unknown original raw binding role');
  command.entries.forEach((entry,i)=>{const buffer=r.buffers[entry.buffer],role=names[i];if(!buffer||entry.binding!==i||entry.offset!==0||entry.size!==buffer.size)throw Error('Exact raw role full-buffer view required');if(roles.has(role)&&roles.get(role)!==buffer.id||bufferRoles.has(buffer.id)&&bufferRoles.get(buffer.id)!==role)throw Error('Raw role alias or changing owner');roles.set(role,buffer.id);bufferRoles.set(buffer.id,role);});dispatches++;
 }}),engine=await createRawWorldGPU(r.device,{strikeBackend}),bank=engine.createBank(batch);
 try{bank.encode(r.device.createCommandEncoder());if(r.submits!==0||r.commands.length!==0||handoffs!==1||dispatches!==bank.dispatches||bufferRoles.size!==r.buffers.length)throw Error('Incomplete original raw resource ownership');if(bank.count!==batch.count||bank.identity!==batch||roles.get('prepared')!==bank.preparedWorldBuffer.id||roles.get('status')!==bank.handoffStatusBuffer.id||roles.get('strikeResult')!==bank.rawResultBuffer.id||bank.preparedWorldWordStride!==192||bank.handoffStatusWordStride!==16||bank.rawResultWordStride!==128)throw Error('Raw exported resource ownership mismatch');return {strikeBackend,effectiveMaximumSteps:batch.effectiveMaximumSteps,sceneBytes:snapshot.rawScene.byteLength,allocations:r.buffers.map(b=>({role:bufferRoles.get(b.id),bytes:b.size,usage:b.usage}))};}finally{bank.dispose();}
}
