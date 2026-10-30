/** Test-only inverse of one reviewed structural optimization. Never used by the
 * engine. Immutable whole-graph goldens remain the final authority. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const delta=JSON.parse(readFileSync(new URL('../fixtures/all-body-endpoint-cache-reviewed-delta.json',import.meta.url),'utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex');
assert.equal(delta.kind,'reviewed-all-body-endpoint-cache-delta-v1');
assert.equal(delta.reviewStatus,'reviewed','Independent endpoint-cache delta review required');
assert.equal(delta.baselineCommit,'715b503f57f6962d99c7a85a787995284960ee8b');
assert.deepEqual(delta.cache,{oldBytes:1024,newBytes:4096,usage:140,cacheBinding:4,entryBinding:7,oldIndirectOffset:8,newIndirectOffset:20});
for(const module of delta.modules)assert.equal(sha(module.baselineCode),module.baselineSHA256);
export function restoreEndpointCacheDelta({definitions,commands,buffers,pipelineModules,sourceKey='code'}){
 const result=structuredClone({definitions,commands,buffers});
 const indices=delta.modules.map(module=>{
  const found=result.definitions.flatMap((d,i)=>sha(d[sourceKey])===module.currentSHA256?[i]:[]);
  assert.equal(found.length,1,'Exactly one reviewed '+module.name);return found[0];
 });
 const [entryIndex,cacheIndex]=indices,cacheIds=new Set();let cacheCommands=0,entryCommands=0;
 for(const command of result.commands){
  if(command.kind!=='dispatch')continue;
  const definition=pipelineModules?pipelineModules[command.pipeline]:command.definition??command.pipeline;
  if(definition!==entryIndex&&definition!==cacheIndex)continue;
  const isCache=definition===cacheIndex,binding=isCache?4:7,view=command.entries[binding];
  assert.equal(view.binding,binding);assert.equal(view.offset,0);assert.equal(view.size,4096);cacheIds.add(view.buffer);view.size=1024;
  if(isCache){cacheCommands++;assert.ok(command.indirect,'Original resident cache uses bounded indirect body count');assert.equal(command.indirect.offset,20);command.indirect.offset=8;if(sourceKey==='source'){const n=command.entries[0].size/320;assert.ok([3,4].includes(n));assert.equal(command.indirect.bound,n);command.indirect.bound=1;}}
  else entryCommands++;
 }
 assert.ok(cacheCommands>0);assert.equal(cacheCommands,entryCommands);
 for(const id of cacheIds){
  const buffer=result.buffers[id];assert.equal(buffer.size,4096);assert.equal(buffer.usage,140);
  const bytesKey=Object.hasOwn(buffer,'initial')?'initial':'bytes',bytes=buffer[bytesKey];
  assert.ok(bytes instanceof Uint8Array);assert.equal(bytes.byteLength,4096);assert.equal(bytes.some(x=>x!==0),false,'Only zero scratch may resize');
  buffer.size=1024;buffer[bytesKey]=bytes.slice(0,1024);
 }
 for(const command of result.commands){
  if(command.kind==='dispatch'){
   const definition=pipelineModules?pipelineModules[command.pipeline]:command.definition??command.pipeline;
   for(const view of command.entries)if(cacheIds.has(view.buffer)){
    assert.ok((definition===cacheIndex&&view.binding===4)||(definition===entryIndex&&view.binding===7),'No unreviewed cache consumer');
    assert.equal(view.size,1024);
   }
  }else if(command.kind==='clear'&&cacheIds.has(command.buffer)){
   assert.equal(command.offset,0);assert.equal(command.size,4096);command.size=1024;
  }else if(command.kind==='copy')assert.ok(!cacheIds.has(command.source)&&!cacheIds.has(command.target),'No cache readback ABI changes');
 }
 for(const [i,index]of indices.entries()){
  const definition=result.definitions[index],binding=index===cacheIndex?4:7;
  if(definition.ownership){assert.deepEqual(definition.ownership[binding],{stride:1024,base:0,length:1024});definition.ownership[binding]={stride:256,base:0,length:256};}
  definition[sourceKey]=delta.modules[i].baselineCode;
 }
 return result;
}

// The selected graph has two independent resident resolver caches. Preserve its
// immutable pre-extension aggregate and add only the reviewed scratch increase.
export const REVIEWED_TWO_CACHE_BYTE_INCREASE = 2 * (delta.cache.newBytes - delta.cache.oldBytes);
export const REVIEWED_SELECTED_OWNED_BYTES = 8772676 + REVIEWED_TWO_CACHE_BYTE_INCREASE;
