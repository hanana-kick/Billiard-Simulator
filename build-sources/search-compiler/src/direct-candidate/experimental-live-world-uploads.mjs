/** Experimental upload-only preparation. No GPU execution or production wiring.
 * Original factories own both packers; full consuming source bytes select roles.
 */
import {LIVE_WORLD_UPLOAD_SOURCE_SEALED,LIVE_WORLD_UPLOAD_SOURCE_REVISION} from './experimental-live-world-build-seal.mjs';
import {createLiveWorldCaptureDevice,captureLiveWorldPlan,assertLiveWorldPlansEqual} from './experimental-live-world-capture.mjs';
import {bindCanonicalJournalRules,createCanonicalJournalRulesGPU} from './canonical-journal-rules.mjs';
import {createRawJournalPrefixGPU} from './canonical-raw-journal-prefix.mjs';

async function captureIdentityUploads(request,batch,journalBytes,auxBytes){
 const r=createLiveWorldCaptureDevice(),d=r.device,alloc=size=>d.createBuffer({size,usage:128|8});
 const journal={buffer:alloc(journalBytes),auxBuffer:alloc(auxBytes)},raw={identity:batch,count:1,preparedWorldWordStride:192,handoffStatusWordStride:16,preparedWorldBuffer:alloc(768),handoffStatusBuffer:alloc(64)};
 const rules=await createCanonicalJournalRulesGPU(d),prefix=await createRawJournalPrefixGPU(d),ruleBank=rules.createBank(bindCanonicalJournalRules(request,batch),journal),prefixBank=prefix.createBank(raw,journal),encoder=d.createCommandEncoder();
 ruleBank.encode(encoder);prefixBank.encode(encoder);
 const roles=r.commands.map((c,i)=>{const entry=c.entries[2],buffer=r.buffers[entry.buffer];return{role:i===0?'rules':'raw-prefix',source:r.pipelines[c.pipeline].module.code,entryPoint:r.pipelines[c.pipeline].entryPoint,size:buffer.size,initial:buffer.bytes.slice(),entries:c.entries,layout:r.pipelines[c.pipeline].layout,x:c.x};});
 const identityBuffers=new Set(r.commands.map(c=>c.entries[2].buffer));
 const signature=JSON.stringify({buffers:r.buffers.map(b=>({size:b.size,usage:b.usage,initial:identityBuffers.has(b.id)?null:Array.from(b.bytes)})),modules:r.modules.map(m=>({code:m.code,label:m.label})),pipelines:r.pipelines.map(p=>({entryPoint:p.entryPoint,layout:p.layout,constants:p.constants,module:p.module.id})),commands:r.commands});
 return {roles,signature,ruleConfig:r.buffers[r.commands[0].entries[1].buffer].bytes.slice()};
}
function findRole(plan,role){
 const matches=plan.commands.filter(c=>c.kind==='dispatch'&&plan.definitions[c.definition].source===role.source&&plan.definitions[c.definition].entryPoint===role.entryPoint);
 if(matches.length!==1)throw Error('Exactly one original '+role.role+' consumer required');
 const command=matches[0];
 if(command.x!==1||role.x!==1||JSON.stringify(plan.definitions[command.definition].layout)!==JSON.stringify(role.layout)||command.entries.length!==role.entries.length||command.entries.some((e,i)=>e.binding!==role.entries[i].binding||e.offset!==role.entries[i].offset||e.size!==role.entries[i].size))throw Error('Original identity consumer layout/dispatch drift');
 const entry=command.entries[2],allocation=plan.allocations[entry?.buffer];
 if(!entry||entry.binding!==2||entry.offset!==0||entry.size!==role.size||allocation?.size!==role.size||allocation.external)throw Error('Exact '+role.role+' identity allocation required');
 for(const c of plan.commands){
  if(c.kind==='clear'&&c.buffer===entry.buffer||c.kind==='copy'&&(c.source===entry.buffer||c.target===entry.buffer))throw Error('Identity role cannot be copied or cleared');
  if(c.kind==='dispatch')for(const e of c.entries)if(e.buffer===entry.buffer&&(c!==command||e.binding!==2))throw Error('Identity role cannot be aliased');
 }
 return entry.buffer;
}
function freezeGraphMetadata(value){if(value&&typeof value==='object'&&!ArrayBuffer.isView(value)){for(const child of Object.values(value))freezeGraphMetadata(child);Object.freeze(value);}return value;}
const bytesEqual=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
/** One owned full capture establishes the exact graph; no reported hash is
 * an authorization substitute. Outputs are two tiny owned uploads, not N copies
 * of the graph. This helper does not qualify new batch widths. */
export async function createLiveWorldUploadPreparer({request,binding,batch,profile='mmq1-no-cushion',strikeBackend='staged',expectedPlan}){
 const plan=await captureLiveWorldPlan(binding,batch,{profile,strikeBackend});
 if(expectedPlan!==undefined){assertLiveWorldPlansEqual(plan,expectedPlan);if(plan.allocations.some((a,i)=>!bytesEqual(a.initial,expectedPlan.allocations[i].initial)))throw Error('Expected initial upload mismatch');}
 // Journal sizes are discovered from the original reducer's exact source below;
 // dummy sizes only instantiate its source and do not enter the target graph.
 const probe=await captureIdentityUploads(request,batch,40*4,32),rule=probe.roles[0];
 const consumers=plan.commands.filter(c=>c.kind==='dispatch'&&plan.definitions[c.definition].source===rule.source&&plan.definitions[c.definition].entryPoint===rule.entryPoint);
 if(consumers.length!==1)throw Error('Exactly one original rule consumer required');
 const consumer=consumers[0],journalBytes=consumer.entries[0].size,auxBytes=consumer.entries[4].size;
 const baseline=await captureIdentityUploads(request,batch,journalBytes,auxBytes),roles=baseline.roles.map(role=>({role:role.role,index:findRole(plan,role),source:role.source,entryPoint:role.entryPoint,size:role.size}));
 if(new Set(roles.map(x=>x.index)).size!==2)throw Error('Distinct original identity allocations required');
 for(let i=0;i<roles.length;i++)if(!bytesEqual(plan.allocations[roles[i].index].initial,baseline.roles[i].initial))throw Error('Baseline original identity upload mismatch');
 if(!bytesEqual(plan.allocations[consumer.entries[1].buffer].initial,baseline.ruleConfig))throw Error('Original rule config upload mismatch');
 const frozen=freezeGraphMetadata(plan),prepared=new WeakMap(),rawBinding=batch.binding;
 const get=token=>{const uploads=prepared.get(token);if(!uploads)throw TypeError('Owned prepared upload token required');return uploads;};
 return Object.freeze({roles:Object.freeze(roles.map(({role,index,size})=>Object.freeze({role,index,size}))),productionEnabled:false,sourceQualified:LIVE_WORLD_UPLOAD_SOURCE_SEALED,graphReuseQualified:LIVE_WORLD_UPLOAD_SOURCE_SEALED,buildRevision:LIVE_WORLD_UPLOAD_SOURCE_REVISION,
  snapshotUploads(token){return get(token).map((initial,i)=>({index:roles[i].index,initial:initial.slice()}));},
  runtimePlan(token){const copy={...frozen,allocations:frozen.allocations.map(a=>({...a,initial:a.initial.slice()}))};get(token).forEach((initial,i)=>{copy.allocations[roles[i].index].initial=initial.slice();});return copy;},
  diagnosticPlan(token){const copy=structuredClone(frozen);get(token).forEach((initial,i)=>{copy.allocations[roles[i].index].initial=initial.slice();});return copy;},
  async prepare(nextBatch){
   if(nextBatch?.binding!==rawBinding)throw Error('Exact original raw binding required');
   const uploads=await captureIdentityUploads(request,nextBatch,journalBytes,auxBytes);
   if(uploads.signature!==baseline.signature)throw Error('Original tiny factory graph/nonidentity upload drift');
   for(let i=0;i<roles.length;i++){const expected=roles[i],actual=uploads.roles[i];if(actual.source!==expected.source||actual.entryPoint!==expected.entryPoint||actual.size!==expected.size)throw Error('Original identity packer source drift');}
   const token=Object.freeze({kind:'experimental-live-upload-token-v1',candidateKey:nextBatch.candidateKeys[0]});prepared.set(token,uploads.roles.map(x=>x.initial));return token;
  }
 });
}
