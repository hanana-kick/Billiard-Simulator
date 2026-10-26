// HOST transport contract only. It cannot qualify physics or a device.
import assert from 'node:assert/strict';

export const CONTROL_VARIANT_ORDER=Object.freeze([0,1,1,0]);
export const CONTROL_VARIANT_MODES=Object.freeze(['storage-v1','invocation-cache-v1']);

/** Preparation order only, never a change to physics/ABBA dispatch order.
 * Preserve every complete source/binding/entry descriptor exactly once. */
export function controlVariantCompilationOrder(sets){
 assert.equal(sets.length,2);const all=sets.flatMap(set=>set.descriptors);
 const ordered=[...sets.flatMap(set=>set.handlerDescriptors.filter(d=>d.name.includes('rc_world_broad_commit_collision'))),...sets.flatMap(set=>set.descriptors.filter(d=>d.name.startsWith('microcode '))),...sets.flatMap(set=>set.handlerDescriptors.filter(d=>!d.name.includes('rc_world_broad_commit_collision'))),...all];
 const key=d=>JSON.stringify([d.code,d.bindingTypes,d.entryPoint??'main']),seen=new Set(),result=[];
 for(const d of ordered){const identity=key(d);if(seen.has(identity))continue;seen.add(identity);result.push(d);}
 assert.deepEqual([...seen].sort(),[...new Set(all.map(key))].sort(),'all and only original pipeline identities');
 return result;
}

/** Both artifacts are freshly prepared from the SAME frozen sources. Only the
 * core control-storage strategy may differ; every runtime input and source
 * instruction remains identical. This is not an arbitrary benchmark loader. */
export function assertControlCacheVariants(entries){
 assert.equal(entries.length,2,'exactly baseline and cache artifacts required');
 const [a,b]=entries;
 for(const [i,{m,runtime}]of entries.entries()){
  assert.equal(m.count,6);assert.equal(m.frames,2);assert.equal(m.runs,2);
  assert.equal(runtime.vm.controlMode,CONTROL_VARIANT_MODES[i]);
  assert.equal(runtime.vm.vmStateDisjoint,true,'owned disjoint VM allocation contract');
  assert.equal(m.controlMode,runtime.vm.controlMode);assert.equal(m.vmStateDisjoint,true);
  assert.equal(m.processIsolationVersion,2,'fresh process identity contract');
 }
 assert.deepEqual(a.m.sourceHashes,b.m.sourceHashes,'same frozen implementation sources');
 assert.equal(a.m.sourceHead,b.m.sourceHead,'same committed source checkpoint');
 assert.deepEqual(a.runtime.original,b.runtime.original,'entire initial-only source payload unchanged');
 assert.deepEqual(a.runtime.identity.sourceSha256,b.runtime.identity.sourceSha256);
 assert.deepEqual(a.runtime.identity.bytecodeSha256,b.runtime.identity.bytecodeSha256);
 const remainder=vm=>{const{shader,controlMode,...other}=vm;return other;};
 assert.deepEqual(remainder(a.runtime.vm),remainder(b.runtime.vm),'only core shader/control mode may change');
 assert.notEqual(a.runtime.vm.shader,b.runtime.vm.shader,'distinct explicit strategy shaders');
 return true;
}

/** A single caller-owned device/cache; runMicrocodeWorld still owns FRESH
 * buffers on every call. Injection exists only for HOST transport tests. */
export async function runControlVariantSession({entries,owner,cache,preflight,run,trace=()=>{}}){
 assertControlCacheVariants(entries);assert.ok(owner?.device);assert.equal(cache.device,owner.device);
 assert.equal(typeof preflight,'function','preflight BOTH variant shader sets before any execution');
 await preflight();
 const runs=[[],[]];
 for(const index of CONTROL_VARIANT_ORDER){
  const mode=CONTROL_VARIANT_MODES[index],number=runs[index].length+1;
  trace({stage:'control-variant-run-start',mode,run:number});
  const result=await run({owner,cache,plan:entries[index].runtime,trace});
  runs[index].push(result);
  trace({stage:'control-variant-run-done',mode,run:number,stats:result.stats,controls:result.controls,parity:'pending'});
 }
 return runs;
}

/** Call only AFTER the unchanged independent original-CPU assertions passed
 * for BOTH artifacts. This additionally checks every scratch/local/control
 * word across strategies, without asserting physical qualification by itself. */
export function compareControlVariantResults(entries,actual){
 assertControlCacheVariants(entries);assert.equal(actual.length,2);
 for(let i=0;i<2;i++){
  assert.equal(actual[i].runtimeSha256,entries[i].m.runtimeSha256);
  assert.equal(actual[i].sourceSha256,entries[i].m.sourceSha256);
  assert.equal(actual[i].runs.length,2);
 }
 assert.deepEqual(actual[0].adapter,actual[1].adapter,'same recorded adapter');
 assert.deepEqual(actual[0].gpuInvocation,actual[1].gpuInvocation,'same retained-device process');
 assert.deepEqual(actual[0].variantSession,actual[1].variantSession,'same fixed ABBA session');
 assert.deepEqual(actual[0].variantSession?.order,CONTROL_VARIANT_ORDER);
 assert.equal(actual[0].variantSession?.deviceOwners,1);assert.equal(actual[0].variantSession?.sharedPipelineCache,true);
 for(let variant=0;variant<2;variant++)for(let run=0;run<2;run++){
  assert.deepEqual(actual[variant].runs[run].words,actual[0].runs[0].words,'entire source bank across strategies/fresh runs');
  assert.deepEqual(actual[variant].runs[run].vmWords,actual[0].runs[0].vmWords,'entire VM bank across strategies/fresh runs');
 }
 return{status:'pass',scope:'same-device raw6 two-h control strategies; independent physics gates required separately',order:CONTROL_VARIANT_ORDER.map(i=>CONTROL_VARIANT_MODES[i]),allSourceAndVmWordsEqual:true,runsPerVariant:2,hardwarePerformance:false,fullRest:false,native1024:false,timings:actual.map((a,i)=>({mode:CONTROL_VARIANT_MODES[i],runs:a.runs.map(r=>({pumpHostWallMs:r.stats.executionGroups.find(g=>g.name==='pump').wallMs,steadyEndToEndHostWallMs:r.stats.steadyEndToEndWallMs,coldCompileHostWallMs:r.stats.cache.compileWallMs,coldCompiles:r.stats.cache.coldCompiles,warmHits:r.stats.cache.warmHits}))})),timingInterpretation:'host wall, not GPU timestamps; one warm sample per strategy; no hardware calibration ratio'};
}
