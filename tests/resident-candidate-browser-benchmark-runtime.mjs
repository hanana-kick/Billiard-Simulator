// TEST ONLY, browser-pure transport. No source generation, CPU simulation,
// expected snapshots, adapter selection, publication, or numeric acceptance.
import {assertDecodedPortableRuntime} from './resident-candidate-portable-payload.mjs';

const CHUNK = 1024;
const BUFFER = {MAP_READ:1, COPY_SRC:4, COPY_DST:8, STORAGE:128, QUERY_RESOLVE:512};
const now = () => performance.now();
const requireValue = (ok, message) => { if (!ok) throw new Error(message); };
const positive = (n, label) => requireValue(Number.isSafeInteger(n) && n > 0, `${label}: positive safe integer required`);
const delta = (a, b) => Object.fromEntries(Object.keys(a).map(k => [k, a[k] - (b[k] ?? 0)]));
const descriptor = (p, bindingTypes = p.bindingTypes) => {
  requireValue(typeof p.code === 'string' && p.code.length > 0, 'Nonempty unchanged WGSL required');
  requireValue(Array.isArray(bindingTypes) && bindingTypes.length > 0 && bindingTypes.every(t => ['storage','read-only-storage','uniform'].includes(t)), 'Explicit buffer binding types required');
  const entryPoint = p.entryPoint ?? 'main';
  requireValue(/^[A-Za-z_]\w*$/.test(entryPoint), 'Explicit valid entry point required');
  return {name:p.name ?? 'resident stage', code:p.code, bindingTypes:[...bindingTypes], entryPoint, key:JSON.stringify([p.code,bindingTypes,entryPoint])};
};

function pipelineCache(device, trace) {
  const modules = new Map(), pipelines = new Map();
  const stats = {preflightRequests:0,preflightCold:0,preflightWarm:0,preflightWallMs:0,compileRequests:0,coldCompiles:0,warmHits:0,compileWallMs:0};
  return {
    stats:() => ({...stats}),
    async preflightAll(descriptors) {
      // The whole descriptor batch is validated before creating any module.
      const checked = descriptors.map(d => descriptor(d));
      for (const d of checked) {
        stats.preflightRequests++;
        if (modules.has(d.key) || pipelines.has(d.key)) { stats.preflightWarm++; continue; }
        stats.preflightCold++;
        const at = now();
        trace({stage:'shader-preflight-start',name:d.name,bytes:d.code.length});
        const module = device.createShaderModule({code:d.code,label:d.name});
        const info = await module.getCompilationInfo();
        stats.preflightWallMs += now() - at;
        const errors = info.messages.filter(m => m.type === 'error');
        requireValue(errors.length === 0, `${d.name} WGSL: ${errors.map(m => `${m.lineNum}:${m.linePos} ${m.message}`).join('; ')}`);
        modules.set(d.key, module);
      }
      trace({stage:'shader-preflight-complete',descriptors:checked.length,newPipelineCompiles:0});
    },
    async compile(d) {
      stats.compileRequests++;
      if (pipelines.has(d.key)) { stats.warmHits++; return pipelines.get(d.key); }
      // No implicit late parsing: ALL modules must have passed preflight first.
      requireValue(modules.has(d.key), 'Pipeline was not included in complete WGSL preflight');
      const at = now();
      const groupLayout = device.createBindGroupLayout({entries:d.bindingTypes.map((type,binding) => ({binding,visibility:4,buffer:{type}}))});
      const layout = device.createPipelineLayout({bindGroupLayouts:[groupLayout]});
      trace({stage:'pipeline-start',name:d.name,bytes:d.code.length});
      const pipeline = await device.createComputePipelineAsync({layout,compute:{module:modules.get(d.key),entryPoint:d.entryPoint}});
      const entry = {pipeline,groupLayout};
      stats.coldCompiles++; stats.compileWallMs += now() - at;
      pipelines.set(d.key,entry); modules.delete(d.key);
      trace({stage:'pipeline-ready',name:d.name});
      return entry;
    },
  };
}

/** Runs the EXACT accepted six-row/two-h initial-only payload. Pipeline caching
 * is device-local to this call; every repeat gets fresh GPU-zeroed buffers and
 * only original initial uploads. Results are diagnostic words, NOT a parity
 * pass: the separate strict original-source comparator must accept every run.
 *
 * All wall times use performance.now(). Queue drain measures HOST WAIT, not GPU
 * execution time. Optional WebGPU timestamps cover each unchanged compute pass
 * (at most 1024 original dispatches), not compile/upload/readback or queue gaps.
 * Requiring timestamps without an enabled feature throws an explicit unsupported
 * error before shader creation; it never substitutes zero or silently disables.
 */
export async function runResidentBrowserBenchmark({device,runtime,repeats=3,timestampMode='off',trace=()=>{}}) {
  positive(repeats,'repeats');
  requireValue(repeats>=3,'At least three repeats are required: one cold and two warm');
  requireValue(timestampMode === 'off' || timestampMode === 'required','timestampMode must be off or required');
  requireValue(device && device.queue && typeof device.createComputePipelineAsync === 'function','A caller-owned WebGPU device is required');
  if (timestampMode === 'required' && !device.features?.has('timestamp-query')) {
    trace({stage:'timestamps-unsupported',status:'unsupported',reason:'timestamp-query is not enabled on this device'});
    const error = new Error('Required timestamp-query feature is not enabled');
    error.code = 'RESIDENT_TIMESTAMP_UNSUPPORTED'; error.timestampStatus = 'unsupported'; throw error;
  }
  // Capture before the first await: caller mutation cannot replace initial-only
  // arrays, source WGSL, commands, or guards midway through a measured repeat.
  const p = structuredClone(runtime);
  assertDecodedPortableRuntime(p);
  requireValue(p.count === 6 && p.frames === 2 && p.sweeps === 2048 && p.pc.pipelines.length === 16,'Only the accepted six-row/two-h/16-owner/2048-sweep benchmark is admitted');
  requireValue(p.init.dispatches === 68313 && p.dispatches === 101082,'Accepted original dispatch capacity must remain unchanged');
  const {init,pc} = p, worldNames = ['worldState','worldProgram','worldGeometry','scratch','inputs'];
  const begin = descriptor(pc.begin,pc.bindingTypes), owners = pc.pipelines.map(x => descriptor(x,pc.bindingTypes));
  const initials = Object.fromEntries(Object.entries(init.stages).map(([name,x]) => [name,descriptor({...x,name:'initialize '+name})]));
  const all = [begin,...owners,...Object.values(initials)];
  const workgroups = n => { positive(n,'dispatch workgroups'); requireValue(n<=device.limits.maxComputeWorkgroupsPerDimension,'Dispatch exceeds device limit'); };
  workgroups(p.count);
  for (const [name,stage] of Object.entries(init.stages)) {
    workgroups(stage.workgroups);
    requireValue(stage.resources.length===initials[name].bindingTypes.length,'Initializer resource/binding arity changed');
  }
  for (const command of init.commands) {
    requireValue(Object.hasOwn(initials,command.stage),'Unknown original initializer command');
    positive(command.repeat,'initializer repeat');
  }
  const requiredBytes = [];
  const capacity = (words,label,storage=true) => {
    positive(words,label+' words'); const bytes = words*4;
    requireValue(Number.isSafeInteger(bytes) && bytes <= device.limits.maxBufferSize,label+' exceeds maxBufferSize');
    if (storage) requireValue(bytes <= device.limits.maxStorageBufferBindingSize,label+' exceeds maxStorageBufferBindingSize');
    return bytes;
  };
  requiredBytes.push(capacity(init.scratchAlias.words,'scratch'));
  for (const [name,initial] of Object.entries(init.resources)) {
    if (name === 'rawScratch' || name === 'numericScratch') continue;
    const value = name === 'worldState' ? pc.totalStateWords : name === 'worldProgram' ? p.program : initial;
    requiredBytes.push(capacity(typeof value === 'number' ? value : value.length,name));
  }
  requiredBytes.push(capacity(p.sharedGeometry.length,'worldGeometry'));
  const readbackBytes = capacity(pc.totalStateWords,'final state readback',false);
  const timestamped = timestampMode === 'required';
  const chunkCounts = {initialize:Math.ceil((init.dispatches+1)/CHUNK),pump:Math.ceil((pc.sweep.length*p.sweeps)/CHUNK)};
  const timestampCount = 2*(chunkCounts.initialize+chunkCounts.pump);
  const timestampBytes = timestampCount*8, resolveBytes = Math.ceil(timestampBytes/256)*256;
  if (timestamped) { capacity(resolveBytes/4,'timestamp resolve',false); capacity(timestampBytes/4,'timestamp readback',false); }
  const cache = pipelineCache(device,trace), runs = [];
  const setupAt = now(); await device.queue.onSubmittedWorkDone(); const setupQueueDrainWallMs = now()-setupAt;
  for (let run = 1; run <= repeats; run++) {
    const cacheBefore = cache.stats(), owned = [], resources = new Map(), timestampRows = [];
    const timings = {allocationWallMs:0,uploadWallMs:0,uploadDrainWallMs:0,bindGroupWallMs:0};
    const counters = {dispatches:0,submissions:0,initialWrites:0,stateCopies:0,stateMappings:0,timestampMappings:0};
    let scoped = false, submitted = false, querySet = null, queryResolve = null, queryRead = null, queryIndex = 0;
    const allocate = (words,usage,label,storage=true) => {
      const size = capacity(words,label,storage), at = now();
      const buffer = device.createBuffer({size,usage,label}); owned.push(buffer); timings.allocationWallMs += now()-at; return buffer;
    };
    const write = (name,offsetWords,words) => {
      const resource = resources.get(name);
      requireValue(resource && words instanceof Uint32Array && Number.isSafeInteger(offsetWords) && offsetWords>=0 && offsetWords+words.length<=resource.words,'Only bounded initial Uint32Array uploads are admitted');
      const at = now(); device.queue.writeBuffer(resource.buffer,offsetWords*4,words); timings.uploadWallMs += now()-at; counters.initialWrites++;
    };
    const submit = async (command, metrics) => {
      let at = now(); device.queue.submit([command]); submitted = true; counters.submissions++; metrics.submissions++; metrics.submitWallMs += now()-at;
      at = now(); await device.queue.onSubmittedWorkDone(); metrics.queueDrainWallMs += now()-at;
    };
    const metric = () => ({wallMs:0,encodeWallMs:0,submitWallMs:0,queueDrainWallMs:0,submissions:0,dispatches:0});
    try {
      device.pushErrorScope('validation'); scoped = true;
      await cache.preflightAll(all);
      // Owners-first compile surfaces new compilation boundaries early, while
      // physical execution below remains initializer-first, exactly as native.
      const compiledBegin = await cache.compile(begin), compiledOwners = [];
      for (const d of owners) compiledOwners.push(await cache.compile(d));
      const compiledInitial = {};
      for (const [name,d] of Object.entries(initials)) compiledInitial[name] = await cache.compile(d);
      const executionAt = now(); // Actual wall interval, never a sum of components.
      resources.set('scratch',{buffer:allocate(init.scratchAlias.words,BUFFER.STORAGE|BUFFER.COPY_SRC|BUFFER.COPY_DST,'scratch'),words:init.scratchAlias.words});
      for (const [name,initial] of Object.entries(init.resources)) {
        if (name === 'rawScratch' || name === 'numericScratch') { resources.set(name,resources.get('scratch')); continue; }
        const value = name === 'worldState' ? pc.totalStateWords : name === 'worldProgram' ? p.program : initial;
        const words = typeof value === 'number' ? value : value.length;
        resources.set(name,{buffer:allocate(words,BUFFER.STORAGE|BUFFER.COPY_SRC|BUFFER.COPY_DST,name),words});
        if (value instanceof Uint32Array) write(name,0,value);
      }
      resources.set('worldGeometry',{buffer:allocate(p.sharedGeometry.length,BUFFER.STORAGE|BUFFER.COPY_SRC|BUFFER.COPY_DST,'worldGeometry'),words:p.sharedGeometry.length});
      write('worldGeometry',0,p.sharedGeometry); write('inputs',0,p.input);
      for (const u of init.initialUploads) write(u.resource,u.offsetWords,u.data);
      const stateRead = allocate(pc.totalStateWords,BUFFER.MAP_READ|BUFFER.COPY_DST,'final state readback',false);
      if (timestamped) {
        const at = now(); querySet = device.createQuerySet({type:'timestamp',count:timestampCount}); timings.allocationWallMs += now()-at;
        queryResolve = allocate(resolveBytes/4,BUFFER.QUERY_RESOLVE|BUFFER.COPY_SRC,'timestamp resolve',false);
        queryRead = allocate(timestampBytes/4,BUFFER.MAP_READ|BUFFER.COPY_DST,'timestamp readback',false);
      }
      const uploadAt = now(); await device.queue.onSubmittedWorkDone(); timings.uploadDrainWallMs = now()-uploadAt;
      const bind = (compiled,names,workgroups) => {
        positive(workgroups,'dispatch workgroups');
        const at = now(), group = device.createBindGroup({layout:compiled.groupLayout,entries:names.map((name,binding) => {
          const r = resources.get(name); requireValue(!!r,'Unknown initial binding '+name); return {binding,resource:{buffer:r.buffer}};
        })}); timings.bindGroupWallMs += now()-at; return {pipeline:compiled.pipeline,group,workgroups};
      };
      const readyBegin = bind(compiledBegin,worldNames,p.count), readyOwners = compiledOwners.map(c => bind(c,worldNames,p.count)), readyInitial = {};
      for (const [name,c] of Object.entries(compiledInitial)) readyInitial[name] = bind(c,init.stages[name].resources,init.stages[name].workgroups);
      // No writeBuffer calls after this point. Every state mutation is original
      // source GPU work; no branch uses CPU futures or intermediate readbacks.
      const execute = async (name,stages) => {
        const m = metric(), groupAt = now(), iterator = stages[Symbol.iterator](); let current = iterator.next();
        while (!current.done) {
          const at = now(), encoder = device.createCommandEncoder({label:name});
          const firstQuery = queryIndex;
          const pass = encoder.beginComputePass(timestamped ? {timestampWrites:{querySet,beginningOfPassWriteIndex:queryIndex++,endOfPassWriteIndex:queryIndex++}} : {});
          let n = 0;
          while (!current.done && n<CHUNK) {
            const stage = current.value; pass.setPipeline(stage.pipeline); pass.setBindGroup(0,stage.group); pass.dispatchWorkgroups(stage.workgroups);
            n++; m.dispatches++; counters.dispatches++; current = iterator.next();
          }
          pass.end(); const command = encoder.finish(); m.encodeWallMs += now()-at;
          if (timestamped) timestampRows.push({group:name,begin:firstQuery,end:firstQuery+1,dispatches:n});
          await submit(command,m);
        }
        m.wallMs = now()-groupAt; trace({stage:'execution-group-ready',run,name,...m,timingKind:'host-wall-not-gpu-timestamp'}); return m;
      };
      timings.initialize = await execute('initialize',(function*(){for(const c of init.commands)for(let i=0;i<c.repeat;i++)yield readyInitial[c.stage];yield readyBegin;})());
      timings.pump = await execute('pump',(function*(){for(let i=0;i<p.sweeps;i++)for(const id of pc.sweep)yield readyOwners[id];})());
      requireValue(counters.dispatches === p.dispatches,'Original immutable dispatch count changed');
      if (timestamped) requireValue(queryIndex === timestampCount,'Timestamp count must match fixed original compute-pass count');
      const readback = metric(), readbackAt = now(), encodeAt = now(), encoder = device.createCommandEncoder({label:'final-only diagnostic readback'});
      encoder.copyBufferToBuffer(resources.get('worldState').buffer,0,stateRead,0,readbackBytes); counters.stateCopies++;
      if (timestamped) { encoder.resolveQuerySet(querySet,0,timestampCount,queryResolve,0); encoder.copyBufferToBuffer(queryResolve,0,queryRead,0,timestampBytes); }
      const command = encoder.finish(); readback.encodeWallMs = now()-encodeAt; readback.copyEncodeWallMs = readback.encodeWallMs; readback.bytes = readbackBytes; await submit(command,readback);
      // BOTH mappings are after ALL physics. Neither data influences scheduling.
      let at = now(); await stateRead.mapAsync(1); readback.mapWallMs = now()-at; counters.stateMappings++;
      at = now(); const words = new Uint32Array(stateRead.getMappedRange().slice(0)); stateRead.unmap(); readback.cpuCopyWallMs = now()-at;
      let gpuTimestamps = {status:'disabled',mode:timestampMode};
      if (timestamped) {
        at = now(); await queryRead.mapAsync(1); readback.timestampMapWallMs = now()-at; counters.timestampMappings++;
        at = now(); const stamps = new BigUint64Array(queryRead.getMappedRange().slice(0)); queryRead.unmap(); readback.timestampCpuCopyWallMs = now()-at;
        const sums = {initialize:0n,pump:0n};
        const chunks = timestampRows.map(row => { const start = stamps[row.begin], end = stamps[row.end]; requireValue(end>=start,'Nonmonotonic GPU timestamps cannot be reported as elapsed time'); const elapsed=end-start; sums[row.group]+=elapsed; return {...row,startNs:String(start),endNs:String(end),durationNs:String(elapsed)}; });
        timings.initialize.gpuTimestampMs = Number(sums.initialize)/1e6; timings.pump.gpuTimestampMs = Number(sums.pump)/1e6;
        gpuTimestamps = {status:'available',mode:timestampMode,unit:'nanoseconds',scope:'compute-pass only; excludes queue gaps, upload, compilation and readback',precision:'implementation-dependent quantization',initializeNs:String(sums.initialize),pumpNs:String(sums.pump),chunks};
      }
      readback.wallMs = now()-readbackAt; timings.readback = readback;
      const validationAt = now(), validation = await device.popErrorScope(); scoped = false;
      timings.validationWallMs = now()-validationAt;
      requireValue(validation === null,'WebGPU validation failed: '+(validation?.message ?? validation));
      timings.endToEndWallMs = now()-executionAt;
      timings.endToEndScope = 'after preflight/compile, before fresh allocations, through final state/timestamp mapping, CPU copy and validation';
      const result = {run,words,metrics:{...timings,...counters},cache:delta(cache.stats(),cacheBefore),gpuTimestamps};
      runs.push(result); trace({stage:'run-complete',run,counters,cache:result.cache,parity:'not-checked-by-transport'});
    } finally {
      if (scoped) await device.popErrorScope();
      if (submitted) { try { await device.queue.onSubmittedWorkDone(); } catch {} }
      for (const buffer of owned) { try { buffer.unmap(); } catch {} buffer.destroy(); }
      querySet?.destroy();
    }
  }
  return {kind:'resident-browser-matched-benchmark-v1',generationIdentity:p.identity.generationIdentity,count:p.count,frames:p.frames,sweeps:p.sweeps,repeats,dispatchesPerRun:p.dispatches,timestampMode,chunkSize:CHUNK,setupQueueDrainWallMs,compilation:{preflightWallMs:cache.stats().preflightWallMs,pipelineWallMs:cache.stats().compileWallMs,count:cache.stats().coldCompiles,warmHits:cache.stats().warmHits},cache:cache.stats(),allocationBytes:{storage:requiredBytes.reduce((a,b)=>a+b,0),stateReadback:readbackBytes,timestamps:timestamped?resolveBytes+timestampBytes:0},timingKind:'host wall unless explicitly gpuTimestamps',parity:'requires-independent-strict-comparator',hardwareClassification:'caller-owned adapter proof required',runs};
}
