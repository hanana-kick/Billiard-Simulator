/** TEST-ONLY observer for the frozen 90ad graph. Never used by production builds.
 * Copies add pass boundaries. Full world/trace baseline parity is REQUIRED before
 * interpreting snapshots; a changed result is only observer-effect evidence.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {selectedArtifactJSON} from '../src/wasm-gpu/selected-artifact.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=x=>createHash('sha256').update(x).digest('hex');
export const DIAGNOSTIC_BASE_BRIDGE_SHA256='388f4fe1299d03f3a451ad707265e7af653f4913fc63850e888a91e32c48d5c2';
export const DIAGNOSTIC_BASE_ARTIFACT_SHA256='e699ec35ef1f899ff6f6bafbb0eb7ec6372b7fc610c20afeec10370cb8c31a18';
export function buildSelectedSnapshotPlan(artifact){
 if(hash(selectedArtifactJSON(artifact.payload))!==artifact.sha256||artifact.sha256!==DIAGNOSTIC_BASE_ARTIFACT_SHA256||artifact.payload.sourceRevision!=='90ad6636d8768b56cb4e93153d1762d3594c6652ad4ae12da283d1249dd1d16f')throw Error('Frozen selected artifact required');
 const p=artifact.payload,w=p.commands,commands=w.indices.map(i=>w.dictionary[i]);
 const stages=[[85,'micro-merge',8361],[20,'supported-choose',8609],[22,'supported-assemble',8621],[69,'supported-clear',8622],[53,'descriptor-produce',8623],[57,'mixed-resolve',8630],[113,'cushion-owner',8653],[121,'cushion-restore',8699],[68,'cushion-route',8728]],rows=[];let destinationOffset=0;
 for(let iteration=0;iteration<16;iteration++)for(const[definition,stage,base]of stages){
  const commandIndex=base+452*iteration,c=commands[commandIndex];if(c?.kind!=='dispatch'||c.definition!==definition)throw Error('Frozen command position mismatch');
  const names=new Map([...p.definitions[definition].code.matchAll(/@binding\((\d+)\)\s*var<[^>]+>\s*(\w+)/g)].map(m=>[Number(m[1]),m[2]]));
  for(const when of ['before','after'])for(const entry of w.bindings[c.entries]){
   const name=names.get(entry.binding);if(!name)throw Error('Audited binding name required');if(when==='after'&&!['state','dense','descriptors','config'].includes(name))continue;
   const a=p.allocations[entry.buffer];if(!(a.usage&4)||entry.offset+entry.size>a.size)throw Error('Existing COPY_SRC view required; usage alterations prohibited');
   rows.push({iteration,stage,commandIndex,definition,when,name,...entry,destinationOffset});destinationOffset+=entry.size;
  }
 }
 // Accepted trace count is not a loop counter. Cheap headers cover every loop,
 // so a failure outside the detailed first16 window is reported, never guessed.
 for(let iteration=0;iteration<128;iteration++){
  const commandIndex=8770+452*iteration,c=commands[commandIndex];if(c?.kind!=='dispatch'||c.definition!==60)throw Error('Iteration-end command position mismatch');
  const entry=w.bindings[c.entries][0],a=p.allocations[entry.buffer];if(!(a.usage&4)||entry.size!==1024)throw Error('Iteration-end state view mismatch');
  rows.push({iteration,stage:'iteration-end',commandIndex,definition:60,when:'after',name:'state',...entry,size:256,destinationOffset});destinationOffset+=256;
 }
 const baselineOwnedBytes=p.allocations.reduce((n,a)=>n+a.size,0),maximumOwnedBytes=12*1024*1024,totalEncodedCommands=commands.length+rows.length;
 if(baselineOwnedBytes+destinationOffset>maximumOwnedBytes||totalEncodedCommands>131072)throw Error('Existing resource/command budget exceeded');
 return {schema:'selected-diagnostic-copy-plan-v1',sourceRevision:p.sourceRevision,artifactSHA256:artifact.sha256,baselineOwnedBytes,diagnosticBytes:destinationOffset,totalOwnedBytes:baselineOwnedBytes+destinationOffset,maximumOwnedBytes,baselineCommandCount:commands.length,diagnosticCopyCount:rows.length,totalEncodedCommands,firstIterations:16,iterationHeaderCount:128,rows};
}
function once(source,needle,replacement){if(source.split(needle).length!==2)throw Error('Unique diagnostic anchor missing: '+needle.slice(0,70));return source.replace(needle,replacement);}
export function instrumentSelectedBridgeSource(source,helperSource,plan){
 if(hash(source)!==DIAGNOSTIC_BASE_BRIDGE_SHA256)throw Error('Unreviewed selected bridge source');
 if(plan.artifactSHA256!==DIAGNOSTIC_BASE_ARTIFACT_SHA256)throw Error('Frozen diagnostic plan required');
 let out=source;
 out=once(out,'let disposed=false,lost=null,active=null,lastGeneration=0,busy=false;','let disposed=false,lost=null,active=null,lastGeneration=0,busy=false,diagnostic=null;');
 out=once(out,'lastGeneration=generation;active={generation,cursor:0,cancelled:false};',`if(typeof globalThis.__captureSelectedDiagnostic!=='function')throw Error('Test-only diagnostic receiver required');diagnostic?.destroy();diagnostic=createSelectedDiagnosticCopies(device,__diagnosticPlan,{artifactSHA256:__diagnosticPlan.artifactSHA256,baselineOwnedBytes:requirements.totalOwnedBytes,maximumOwnedBytes});lastGeneration=generation;active={generation,cursor:0,cancelled:false};`);
 out=once(out,"const c=commands[h-1];if(c.kind==='copy')", "const c=commands[h-1];diagnostic.snapshot(e,h-1,'before',buffers,closePass);if(c.kind==='copy')");
 out=once(out,'else pass.dispatchWorkgroups(c.x,c.y??1,c.z??1);}closePass();',"else pass.dispatchWorkgroups(c.x,c.y??1,c.z??1);diagnostic.snapshot(e,h-1,'after',buffers,closePass);}closePass();");
 out=once(out,'if(mapped)b.unmap();}}return result;',`if(mapped)b.unmap();}}const diagnosticWords=await diagnostic.finish();guard(generation);const received=globalThis.__captureSelectedDiagnostic({plan:__diagnosticPlan,words:diagnosticWords});if(received&&typeof received.then==='function')throw Error('Synchronous diagnostic receiver required');diagnostic.destroy();diagnostic=null;return result;`);
 // Dispose is the owner of exceptional/cancelled diagnostic runs too.
 out=once(out,'disposed=true;active=null;groups.dispose();','disposed=true;active=null;diagnostic?.destroy();diagnostic=null;groups.dispose();');
 out=once(out,'}catch(error){unsubscribeLoss();groups.dispose();','}catch(error){diagnostic?.destroy();unsubscribeLoss();groups.dispose();');
 const helper=once(helperSource,'export function createSelectedDiagnosticCopies','function createSelectedDiagnosticCopies');
 return `// TEST-ONLY SNAPSHOT BUILD; NOT PRODUCTION. Observer effect possible.\nconst __diagnosticPlan=${JSON.stringify(plan)};\n${helper}\n${out}`;
}
export function createSelectedDiagnosticBridgePlugin({plan,expectedBridgeSHA256=DIAGNOSTIC_BASE_BRIDGE_SHA256}={}){
 if(expectedBridgeSHA256!==DIAGNOSTIC_BASE_BRIDGE_SHA256||!plan)throw Error('Reviewed baseline/plan required');
 return {name:'test-only-selected-snapshots',setup(build){build.onLoad({filter:/[\\/]src[\\/]wasm-gpu[\\/]selected-webgpu-bridge\.mjs$/},async args=>{
  if(path.resolve(args.path)!==path.join(root,'src/wasm-gpu/selected-webgpu-bridge.mjs'))throw Error('Exact repository bridge path required');
  const source=await fs.readFile(args.path,'utf8'),helper=await fs.readFile(path.join(root,'tests/fixtures/selected-diagnostic-copies.mjs'),'utf8');
  return {contents:instrumentSelectedBridgeSource(source,helper,plan),loader:'js',resolveDir:path.dirname(args.path)};
 });}};
}
