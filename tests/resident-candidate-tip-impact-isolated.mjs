// TEST ONLY: original raw rows -> retained audited source -> independent gates.
// GPU execution never imports original CPU physics or opens expected files.
// This coordinator has NO default work budget and never launches another gate.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync} from 'node:fs';
import {serialize, deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join, relative, resolve} from 'node:path';
import {processInvocationIdentity, assertSeparateTestProcesses} from './resident-candidate-invocation-identity.mjs';
import {MICROCODE_ISA as VM} from '../src/resident-candidate/microcode-isa.mjs';
import {WORLD_DEVICE_PC as PC} from '../src/resident-candidate/world-device-pc.mjs';
import {STATUS, REASON} from '../src/resident-candidate/abi.mjs';
import {SOURCE_EVENT_HISTORY_PROFILE} from '../src/source-event-history.mjs';
import {PILOT_FILES, validatePilotOptions, assertFreshPilotFiles, createPilotTimingCollector, makePilotCost, writePilotJsonOnce, waitForPilotDecision, readPilotCost, validatePilotDecision} from './resident-candidate-tip-impact-pilot-barrier.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const log = row => console.log(JSON.stringify(row));
const read = (dir, name) => readFileSync(join(dir, name));
const json = (dir, name) => JSON.parse(read(dir, name));
const save = (dir, name, value) => {
  const bytes = serialize(value);
  writeFileSync(join(dir, name), bytes, {flag: 'wx'});
  return sha(bytes);
};
const writeJson = (dir, name, value) => writeFileSync(join(dir, name), JSON.stringify(value, null, 2), {flag: 'wx'});
const KIND = 'resident-tip-impact-isolated-gate-v1';
const RUNTIME_KIND = 'resident-raw-tip-impact-microcode-runtime-v1';
const MACROS = ['rc_cue_flat_advance', 'rc_num_eval', 'rc_world_broad_commit_collision'];

/** Identity metadata is value data, not V8's internal object/array encoding.
 * V8 serialized bytes need not survive deserialize/serialize unchanged. Actual
 * runtime/expected/code files still use SHA256 of their complete stored bytes. */
export function tipImpactIdentitySha256(value) {
  const active = new Set();
  const encode = x => {
    if (x === null || typeof x === 'boolean' || typeof x === 'string') return JSON.stringify(x);
    if (typeof x === 'number') {
      assert.ok(Number.isFinite(x), 'finite identity metadata');
      return Object.is(x, -0) ? '-0' : JSON.stringify(x);
    }
    assert.ok(x && typeof x === 'object', 'plain identity values only');
    assert.equal(active.has(x), false, 'acyclic identity metadata');
    assert.equal(Object.getOwnPropertySymbols(x).length, 0, 'no hidden symbol metadata');
    active.add(x);
    let result;
    if (Array.isArray(x)) {
      assert.equal(Object.keys(x).length, x.length, 'dense plain metadata arrays');
      result = '[' + Array.from({length: x.length}, (_, i) => {
        assert.ok(Object.hasOwn(x, i), 'no missing identity array element');
        return encode(x[i]);
      }).join(',') + ']';
    } else {
      assert.equal(Object.getPrototypeOf(x), Object.prototype, 'plain identity objects only');
      const keys = Object.keys(x).sort();
      assert.equal(Object.getOwnPropertyNames(x).length, keys.length, 'no hidden object metadata');
      result = '{' + keys.map(key => {
        assert.ok(Object.hasOwn(Object.getOwnPropertyDescriptor(x, key), 'value'), 'no identity accessors');
        return JSON.stringify(key) + ':' + encode(x[key]);
      }).join(',') + '}';
    }
    active.delete(x);
    return result;
  };
  return sha(encode(value));
}

/** Fixed physical input/cutoff; only the separately measured transport work is
 * supplied. Exhausting it is INCOMPLETE, never a physical failure result. */
export function validateTipImpactWork(work) {
  assert.ok(Array.isArray(work) && work.length > 0 && work.length <= 64, 'explicit bounded work blocks required');
  assert.ok(work.every(n => Number.isSafeInteger(n) && n > 0 && n <= 65536), 'positive fixed pump blocks');
  const cycles = work.reduce((a, b) => a + b, 0);
  assert.ok(cycles <= 65536, 'immutable total transport cap');
  return Object.freeze({frames: 192, count: 2, work: Object.freeze([...work]), cycles});
}

/** New source macro profile is explicit; baseline serialized shape stays intact.
 * Cue-only original JS authority must be selected, never silently substituted. */
export function validateTipImpactOptions(options={}) {
  assert.ok(options && typeof options==='object' && !Array.isArray(options));
  assert.ok(Object.keys(options).every(k=>['work','macroProfile','cueNumberProfile'].includes(k)), 'known impact preparation options only');
  const p=validateTipImpactWork(options.work), macroProfile=options.macroProfile, cueNumberProfile=options.cueNumberProfile;
  assert.ok(!Object.hasOwn(options,'macroProfile') || macroProfile==='source-coupled-macro-v1', 'explicit known optional coupled macro profile');
  assert.ok(!Object.hasOwn(options,'cueNumberProfile') || cueNumberProfile==='original-js-number-v1', 'explicit known cue-only Number authority');
  if(macroProfile!==undefined)assert.equal(cueNumberProfile,'original-js-number-v1','coupled impact gate requires original cue Number authority');
  return {...p, macroProfile, cueNumberProfile, macros: macroProfile ? [...MACROS,'rc_coupled_transport_advance'] : [...MACROS]};
}

function sourceHashes() {
  const paths = [];
  const walk = dir => {
    for (const d of readdirSync(dir, {withFileTypes: true})) {
      const p = join(dir, d.name);
      if (d.isDirectory()) walk(p);
      else if (/\.(?:m?js|cjs)$/.test(p)) paths.push(p);
    }
  };
  walk(join(ROOT, 'src'));
  paths.push(join(ROOT, 'vendor/rapier.cjs'));
  for (const name of readdirSync(join(ROOT, 'tests')))
    if (/^resident-candidate-.*\.(?:mjs|cjs)$/.test(name)) paths.push(join(ROOT, 'tests', name));
  return Object.fromEntries(paths.sort().map(p => [relative(ROOT, p), sha(readFileSync(p))]));
}

/** Reads INITIAL-ONLY inputs and their hashes, never expected.v8. */
async function checkedRuntime(dir) {
  const manifest = json(dir, 'manifest.json');
  assert.equal(manifest.kind, KIND);
  const profile = validateTipImpactOptions({work:manifest.work,...(Object.hasOwn(manifest,'macroProfile')?{macroProfile:manifest.macroProfile}:{}),...(Object.hasOwn(manifest,'cueNumberProfile')?{cueNumberProfile:manifest.cueNumberProfile}:{})});
  assert.equal(manifest.count, 2);
  assert.equal(manifest.frames, 192);
  assert.deepEqual(manifest.rows, [219, 522]);
  const bytes = read(dir, 'runtime.v8');
  assert.equal(sha(bytes), manifest.runtimeSha256);
  const runtime = deserialize(bytes);
  const {assertMicrocodeTipImpactRuntime} = await import('./resident-candidate-microcode-world-runtime.mjs');
  assertMicrocodeTipImpactRuntime(runtime);
  const {original: p, vm} = runtime;
  assert.equal(runtime.kind, RUNTIME_KIND);
  assert.equal(p.identity.sourceHead, manifest.sourceHead);
  assert.deepEqual(p.identity.sourceHashes, manifest.sourceHashes);
  assert.equal(p.identity.rawInputSha256, sha(p.input));
  assert.equal(p.identity.programSha256, sha(p.program));
  assert.equal(p.identity.sharedGeometrySha256, sha(p.sharedGeometry));
  const {generationIdentity, ...identity} = p.identity;
  assert.equal(generationIdentity, tipImpactIdentitySha256(identity), 'complete canonical initial identity');
  assert.equal(generationIdentity, manifest.originalGeneration);
  assert.equal(p.identity.pipelineIdentity.begin, sha(p.pc.begin.code));
  assert.equal(p.identity.pipelineIdentity.bytecodeSha256, sha(p.pc.bytecode));
  assert.deepEqual(p.identity.pipelineIdentity.initializer, Object.fromEntries(Object.entries(p.init.stages).map(([k, v]) => [k, sha(v.code)])));
  assert.deepEqual(p.identity.pipelineIdentity.owners, p.pc.pipelines.map(x => ({name: x.name, sha256: sha(x.code)})));
  assert.equal(runtime.identity.sourceSha256, manifest.sourceSha256);
  assert.equal(runtime.identity.bytecodeSha256, sha(vm.code));
  assert.equal(runtime.identity.bytecodeSha256, manifest.bytecodeSha256);
  assert.equal(runtime.identity.vmShaderSha256, sha(vm.shader));
  assert.equal(runtime.identity.vmShaderSha256, manifest.vmShaderSha256);
  assert.deepEqual(vm.handlers.map(x => ({id: x.id, name: x.name, sha256: sha(x.code)})), manifest.handlers);
  assert.equal(vm.dispatchChunks, profile.cycles);
  assert.equal(vm.instructionBudget, 65536);
  assert.equal(vm.workgroupSize, 64);
  assert.equal(vm.controlMode, 'invocation-cache-v1');
  assert.equal(vm.vmStateDisjoint, true);
  assert.equal(vm.intrinsics, 'none');
  assert.deepEqual(vm.intrinsicFunctions, []);
  assert.deepEqual(vm.handlers.map(x => [x.id, x.name, x.workgroupSize]), profile.macros.map((name, id) => [id, name, 1]));
  assert.equal(vm.macroProfile,profile.macroProfile);
  if(profile.macroProfile){assert.equal(p.identity.options.initialHistoryProfile,SOURCE_EVENT_HISTORY_PROFILE);assert.equal(manifest.initialHistoryProfile,SOURCE_EVENT_HISTORY_PROFILE);}
  assert.deepEqual(runtime.audit, manifest.audit);
  return {manifest, runtime, profile};
}

export async function prepareTipImpact(dir, optionsInput = {}) {
  const profile = validateTipImpactOptions(optionsInput);
  assert.equal(existsSync(join(dir, 'manifest.json')), false, 'fresh local artifact directory');
  assert.equal(existsSync(join(dir, 'runtime.v8')), false, 'never overwrite prepared source');
  mkdirSync(dir, {recursive: true});
  const before = sourceHashes();
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: ROOT, encoding: 'utf8'}).trim();
  const [fixtureApi, sourceApi, {WORLD_H_BOUNDS}, {NUMERIC_PROFILE}, {RAW_PC_SAFE_TRANSPORTS}, serializers,
    {compileMicrocodeWGSL}, {allocateMicrocodeLocals}, vmApi, validators] = await Promise.all([
    import('./resident-candidate-tip-impact-fixture.mjs'), import('./resident-candidate-tip-impact-source-plan.mjs'),
    import('../src/resident-candidate/world-h.mjs'), import('../src/resident-candidate/numeric-profile.mjs'),
    import('./resident-candidate-raw-world-pc-runner.mjs'), import('./resident-candidate-isolated-runtime.mjs'),
    import('../src/resident-candidate/microcode-compiler.mjs'), import('../src/resident-candidate/microcode-allocation.mjs'),
    import('../src/resident-candidate/microcode-vm.mjs'), import('./resident-candidate-microcode-world-runtime.mjs')
  ]);
  const f = await fixtureApi.createTipImpactFixture({trace: log});
  const {assertRawTipImpactHistory,tipImpactExpectationsWithCueProfile}=await import('./resident-candidate-tip-impact-reference-profile.mjs');
  if(profile.macroProfile)assertRawTipImpactHistory(f);
  const fixtureExpected=await tipImpactExpectationsWithCueProfile(f,profile.cueNumberProfile,{trace:log});
  const g = sourceApi.createTipImpactSourcePlan({initializationPlan: f.initializationPlan, rows: f.rows, sweeps: profile.cycles});
  const options = {sweeps: profile.cycles, numericProfile: NUMERIC_PROFILE.PRESERVED_F32, sourceMode: 'owners',
    controlVisitPolicy: 'single-call', controlPartition: 'source-closures-v1', ...RAW_PC_SAFE_TRANSPORTS, ...(profile.macroProfile?{initialHistoryProfile:SOURCE_EVENT_HISTORY_PROFILE}:{})};
  const identity = {sourceHead: head, sourceHashes: before, sourceArtifactSha256: f.source.artifactSha256,
    preStrikeIdentity: f.initializationPlan.preStrikeIdentity, sourceIdentity: g.template.sourceIdentity,
    rawRows: f.rows, rawInputSha256: sha(g.input), programSha256: sha(g.program), sharedGeometrySha256: sha(g.template.sharedGeometry),
    rule: f.identity.rule, frames: 192, count: 2, options, sourceCaps: WORLD_H_BOUNDS,
    pipelineIdentity: {initializer: Object.fromEntries(Object.entries(g.init.stages).map(([k, v]) => [k, sha(v.code)])),
      begin: sha(g.pc.begin.code), owners: g.pc.pipelines.map(x => ({name: x.name, sha256: sha(x.code)})),
      bytecodeSha256: sha(g.pc.bytecode), originalPhasePipelines: g.source.pipelines.length,
      sourceInstructions: g.pc.instructions, sweep: g.pc.sweep}};
  identity.generationIdentity = tipImpactIdentitySha256(identity);
  const original = serializers.serializeRawTipImpactPcRuntime(g, identity);
  // These are conservative PLANNED sizes; the runtime also checks actual device
  // limits before compilation/allocation. They are not hardware measurements.
  const source = sourceApi.composeTipImpactSourcePlan(g, {limits: {maxStorageBufferBindingSize: 128 * 1024 * 1024, maxBufferSize: 256 * 1024 * 1024}});
  const compiled = allocateMicrocodeLocals(compileMicrocodeWGSL(source.code, {
    entry: source.entry, storageBindings: {...VM.bindings, rc_event_audit: 5}, intrinsics: 'none',
    externalFunctions: profile.macros, allocationMetadata: true
  }), {mode: 'call-frames-v1'});
  const entry = compiled.functions.find(x => x.name === source.entry);
  assert.equal(entry.params.length, 1);
  assert.equal(entry.params[0].words, 3);
  const entrySlots = [{slot: entry.params[0].slot, candidateStride: 1, value: 0}, {slot: entry.params[0].slot + 1, value: 0}, {slot: entry.params[0].slot + 2, value: 0}];
  const stackCapacity = Math.max(1, compiled.callDepth);
  const layout = vmApi.microcodeVmLayout({count: 2, localWords: compiled.localWords, stackCapacity});
  const config = {count: 2, localWords: compiled.localWords, stackCapacity, instructionCount: compiled.instructions.length / 8,
    entryPc: compiled.entryPc, instructionBudget: 65536, initialSlots: entrySlots, workgroupSize: 64, intrinsics: 'none',
    controlMode: 'invocation-cache-v1', vmStateDisjoint: true, intrinsicFunctions: [], externalFunctions: compiled.externalFunctions, eventAudit: true};
  const shader = vmApi.generateMicrocodeVmWGSL(config);
  const handlers = [...compiled.externalFunctions].sort((a, b) => a.id - b.id).map(x => ({id: x.id, name: x.name,
    code: vmApi.generateMicrocodeExternalWGSL({...config, workgroupSize: 1, macroId: x.id}), workgroupSize: 1}));
  const vm = {version: compiled.version, code: compiled.instructions, shader, instructionCount: config.instructionCount,
    instructionBudget: 65536, dispatchChunks: profile.cycles, localWords: compiled.localWords, stackCapacity,
    entryPc: compiled.entryPc, entrySlots, stride: layout.stride, totalWords: layout.totalWords, workgroupSize: 64,
    intrinsics: 'none', controlMode: 'invocation-cache-v1', vmStateDisjoint: true, intrinsicFunctions: [],
    externalFunctions: compiled.externalFunctions, handlers, eventAudit: true,...(profile.macroProfile?{macroProfile:profile.macroProfile}:{})};
  const runtime = {kind: RUNTIME_KIND, original, vm, audit: source.checkpointLayout,
    identity: {originalGeneration: identity.generationIdentity, sourceSha256: compiled.sourceSha256,
      bytecodeSha256: sha(compiled.instructions), vmShaderSha256: sha(shader)}};
  validators.assertMicrocodeTipImpactRuntime(runtime);
  const t = g.template;
  const template = {state: {length: t.state.length}, segments: t.segments, sharedGeometry: t.sharedGeometry,
    geometryOffsets: t.geometryOffsets, sceneTemplate: t.sceneTemplate, fixedCcd: t.fixedCcd, sourceIdentity: t.sourceIdentity};
  const expected = {kind: 'resident-tip-impact-isolated-assertions-v1', generationIdentity: identity.generationIdentity,
    template, fixtureExpected};
  assert.deepEqual(sourceHashes(), before, 'source frozen through independent original preparation and compilation');
  const runtimeSha256 = save(dir, 'runtime.v8', runtime);
  const expectedSha256 = save(dir, 'expected.v8', expected);
  writeJson(dir, 'expected-manifest.json', {kind: 'resident-tip-impact-expected-manifest-v1', expectedSha256,
    originalGeneration: identity.generationIdentity, runtimeSha256});
  const manifest = {kind: KIND, sourceHead: head, sourceHashes: before, preparationInvocation: processInvocationIdentity(),
    count: 2, frames: 192, rows: [219, 522], work: profile.work, runtimeSha256, originalGeneration: identity.generationIdentity,
    ...runtime.identity, handlers: handlers.map(x => ({id: x.id, name: x.name, sha256: sha(x.code)})), audit: runtime.audit,
    expectedFilesRuntimeAuthority: false, physicalQueryHorizonUnchanged: true, fullRest: false, rawToStrike: false,
    native1024: false, hardwarePerformance: false,
    ...(profile.macroProfile?{macroProfile:profile.macroProfile,initialHistoryProfile:SOURCE_EVENT_HISTORY_PROFILE}:{}),
    ...(profile.cueNumberProfile?{cueNumberProfile:profile.cueNumberProfile}:{})};
  writeJson(dir, 'manifest.json', manifest);
  await checkedRuntime(dir);
  log({stage: 'tip-impact-initial-only-prepared', sourceHead: head, runtimeSha256, expectedSha256,
    frames: 192, work: profile.work, auditBytes: runtime.audit.bytes, nativeExecuted: false});
  return manifest;
}

/** Transport assertions do NOT substitute for the source/native comparison. */
export function assertTipImpactTransport(runtime, result, work) {
  const profile = validateTipImpactWork(work), {pc, count} = runtime.original, {vm, audit} = runtime;
  assert.equal(count, 2);
  assert.equal(pc.maxH, 192);
  assert.equal(vm.dispatchChunks, profile.cycles);
  const cs = result.checkpoints;
  assert.equal(cs.length, work.length);
  let cumulative = 0;
  for (let k = 0; k < cs.length; k++) {
    const c = cs[k]; cumulative += work[k];
    assert.equal(c.name, 'fixed-cycles-' + cumulative);
    assert.equal(c.pumpCycles, cumulative);
    assert.ok(c.words instanceof Uint32Array && c.words.length === pc.totalStateWords);
    assert.ok(c.vmWords instanceof Uint32Array && c.vmWords.length === vm.totalWords);
    assert.ok(c.auditWords instanceof Uint32Array && c.auditWords.length === audit.totalWords, 'real complete eighth-binding storage');
    assert.equal(c.controls.length, 2);
    for (let lane = 0; lane < 2; lane++) {
      const b = lane * pc.stateWords, cb = pc.controlTailBase + lane * pc.controlWords, v = lane * vm.stride;
      assert.equal(c.words[b], 0x52435753); assert.equal(c.words[b + 1], 1);
      assert.equal(c.words[b + 4], [219, 522][lane]);
      assert.equal(c.words[b + 2], lane ? STATUS.REJECTED : STATUS.RUNNING);
      assert.equal(c.words[b + 3], lane ? REASON.SOURCE_INPUT_RANGE : REASON.NONE);
      assert.ok(c.words[b + 5] <= 192);
      assert.equal(c.words[cb + PC.header.magic], PC.magic);
      assert.equal(c.words[cb + PC.header.version], PC.version);
      assert.equal(c.words[cb + PC.header.initialH], 0);
      assert.equal(c.words[cb + PC.header.requestedH], 192, 'immutable born request');
      assert.equal(c.words[cb + PC.header.error], 0);
      assert.ok([PC.status.ready, PC.status.complete, PC.status.worldTerminal].includes(c.words[cb + PC.header.status]));
      assert.equal(c.vmWords[v + VM.control.magicWord], VM.control.magic);
      assert.equal(c.vmWords[v + VM.control.versionWord], VM.version);
      assert.equal(c.vmWords[v + VM.control.error], 0);
      assert.ok([VM.status.ready, VM.status.waiting, VM.status.complete].includes(c.vmWords[v + VM.control.status]), 'unsupported VM must not become MISS');
      assert.deepEqual(c.controls[lane], Array.from(c.vmWords.slice(v, v + VM.control.words)));
      if (lane) {
        assert.equal(c.words[b + 5], 0);
        assert.equal(c.words[cb + PC.header.status], PC.status.worldTerminal);
        for (const field of ['pc', 'completedH', 'calls', 'dispatchVisits']) assert.equal(c.words[cb + PC.header[field]], 0);
      }
      if (k) {
        const prior = cs[k - 1], steps = x => (BigInt(x.vmWords[v + VM.control.stepsHigh]) << 32n) + BigInt(x.vmWords[v + VM.control.stepsLow]);
        assert.ok(c.words[b + 5] >= prior.words[b + 5]);
        assert.ok(c.words[cb + PC.header.completedH] >= prior.words[cb + PC.header.completedH]);
        assert.ok(steps(c) >= steps(prior), 'retained VM counter never resets');
      }
      if (k === cs.length - 1) {
        assert.equal(c.vmWords[v + VM.control.status], VM.status.complete, 'transport budget exhausted is INCOMPLETE, never physical MISS');
        assert.equal(c.vmWords[v + VM.control.sp], 0);
        assert.equal(c.vmWords[v + VM.control.pendingMacro], 0);
        assert.equal(c.vmWords[v + VM.control.entryPc], vm.entryPc);
        assert.equal(c.vmWords[v + VM.control.lastOpcode], VM.opcodes.HALT);
        const finalPc = c.vmWords[v + VM.control.pc];
        assert.ok(finalPc > 0 && finalPc <= vm.instructionCount, 'committed final VM PC');
        assert.equal(vm.code[(finalPc - 1) * VM.instructionWords], VM.opcodes.HALT, 'final PC follows immutable HALT, including cached-control flush');
        assert.deepEqual(Array.from(c.vmWords.slice(v + VM.control.reservedStart, v + VM.control.words)), [0, 0, 0, 0]);
        assert.equal(c.words[cb + PC.header.depth], 0);
        if (!lane) {
          assert.equal(c.words[b + 5], 192);
          assert.equal(c.words[cb + PC.header.status], PC.status.complete);
          assert.equal(c.words[cb + PC.header.pc], pc.instructions - 1);
          assert.equal(c.words[cb + PC.header.completedH], 192);
        }
      }
    }
    if (k && cs[k - 1].controls.every(x => x[VM.control.status] === VM.status.complete)) {
      for (const key of ['words', 'vmWords', 'auditWords']) assert.deepEqual(c[key], cs[k - 1][key], 'completed source/VM/audit must remain unchanged');
    }
  }
  assert.equal(result.stats.mappings, 1);
  assert.equal(result.stats.copies, 3 * cs.length);
  assert.equal(result.stats.initialWrites, 8, 'no uploaded event tape or later state repair');
  assert.equal(result.stats.pumpCycles, profile.cycles);
  assert.equal(result.stats.executionGroups.filter(x => x.name === 'initialize').length, 1);
  assert.equal(result.stats.executionGroups.filter(x => x.name === 'pump').length, work.length);
  assert.equal(result.stats.cache.coldCompiles, 0, 'precompiled before source allocation');
  return {frames: 192, initializations: 1, hostStateReadbacksDuringContinuation: 0, transportSnapshots: cs.length,
    realAuditBinding: true, sourceParity: 'independent all11/native/tape comparison still required'};
}

/** Exact fixed schedule; callback sees no bank or VM state. A refused pilot
 * returns before any remaining work and before finish/map. No schedule edits. */
export async function runTipImpactFixedWork(session, work, {afterFirstCapture, trace=log}={}) {
  const profile=validateTipImpactWork(work);
  if(afterFirstCapture!==undefined){assert.equal(typeof afterFirstCapture,'function');assert.ok(profile.work.length>=2,'pilot needs remaining fixed work');}
  let cumulative=0;
  for(let index=0;index<profile.work.length;index++){
    const cycles=profile.work[index];
    await session.pump(cycles);cumulative+=cycles;
    const at=performance.now();
    await session.capture('fixed-cycles-'+cumulative);
    const captureWallMs=performance.now()-at;
    trace({stage:'tip-impact-fixed-work-copied',cumulativeCycles:cumulative,mapped:false,physicalBoundaryUnknown:true});
    if(index===0&&afterFirstCapture){
      const decision=await afterFirstCapture({captureWallMs});
      assert.ok(decision&&['continue','abort','incomplete'].includes(decision.decision),'explicit pilot decision');
      if(decision.decision!=='continue')return {...decision,completed:false,cumulativeCycles:cumulative};
    }
  }
  return {completed:true,cumulativeCycles:cumulative};
}

export async function executeTipImpact(dir, options={}) {
  assert.equal(process.env.RUN_RESIDENT_TIP_IMPACT_GPU, '1', 'explicit coordinator numerical slot required');
  assert.equal(process.env.REQUIRE_WEBGPU, '1');
  assert.ok(options&&Object.getPrototypeOf(options)===Object.prototype&&Object.keys(options).every(k=>k==='pilot'),'known explicit execution options only');
  const pilot=Object.hasOwn(options,'pilot')?validatePilotOptions(options.pilot):undefined;
  const {manifest, runtime, profile} = await checkedRuntime(dir);
  assert.deepEqual(sourceHashes(), manifest.sourceHashes, 'frozen source before native execution');
  const manifestSha256=sha(read(dir,'manifest.json'));
  if(pilot){assert.ok(profile.work.length>=2,'pilot needs remaining fixed work');assertFreshPilotFiles(dir);}
  else for(const file of Object.values(PILOT_FILES))assert.equal(existsSync(join(dir,file)),false,'a prior pilot cannot be reopened through default mode');
  assert.equal(existsSync(join(dir, 'actual.v8')), false, 'never overwrite prior diagnostics');
  for (const name of ['PhysicsLab', 'LabController', 'ShotSearchCore', 'LabFourBallWorldExperimental'])
    assert.equal(globalThis[name], undefined, 'lean GPU role excludes original CPU world');
  assert.notEqual(processInvocationIdentity().id, manifest.preparationInvocation.id);
  const [{createNativeOwner}, {createRetainedNativePipelineCache}, api] = await Promise.all([
    import('./resident-candidate-gpu-support.mjs'), import('./resident-candidate-native-session.mjs'),
    import('./resident-candidate-microcode-world-runtime.mjs')
  ]);
  const gpuInvocation=processInvocationIdentity();
  const timing=pilot?createPilotTimingCollector({gpuInvocation,firstCycles:profile.work[0],handlerCount:runtime.vm.handlers.length}):undefined;
  const sessionTrace=pilot?event=>{timing.trace(event);log(event);}:log;
  const owner = await createNativeOwner('fixed raw219 audited first-impact diagnostic');
  const cache = createRetainedNativePipelineCache(owner, {trace: log});
  let session;
  try {
    assert.ok(owner.device.limits.maxStorageBuffersPerShaderStage >= 8, 'actual eighth storage binding required');
    const at = performance.now(), descriptors = api.microcodeWorldPipelineDescriptors(runtime);
    await cache.validateAll(descriptors.descriptors);
    const broad = descriptors.handlerDescriptors.find(x => x.name.includes('rc_world_broad_commit_collision'));
    assert.ok(broad);
    const order = [broad, ...descriptors.descriptors.filter(x => x !== broad)];
    for (const descriptor of order) await cache.compile(descriptor);
    const precompile = {wallMs: performance.now() - at, cache: cache.stats(), order: order.map(x => x.name), beforeAnySourceAllocation: true};
    log({stage: 'tip-impact-all-pipelines-ready', ...precompile});
    session = await api.createMicrocodeWorldSession({owner, cache, plan: runtime, maxCaptures: profile.work.length, trace: sessionTrace});
    await session.initialize();
    let pilotContinuation;
    const afterFirstCapture=pilot?async({captureWallMs})=>{
      const cost=makePilotCost({manifest,manifestSha256,gpuInvocation,waitTimeoutMs:pilot.waitTimeoutMs,adapter:owner.adapterInfo,precompile,timing:timing.seal(captureWallMs)});
      const costSha256=writePilotJsonOnce(dir,PILOT_FILES.cost,cost);
      log({stage:'tip-impact-pilot-waiting',costSha256,gpuInvocationId:gpuInvocation.id,manifestSha256,runtimeSha256:manifest.runtimeSha256,waitTimeoutMs:pilot.waitTimeoutMs,mapped:false});
      let decision=await waitForPilotDecision(dir,{cost,costSha256});
      if(decision.decision==='continue'){
        try {
          assert.equal(sha(read(dir,'manifest.json')),manifestSha256,'immutable manifest through retained wait');
          assert.equal(sha(read(dir,'runtime.v8')),manifest.runtimeSha256,'immutable initial-only runtime through retained wait');
          assert.deepEqual(sourceHashes(),manifest.sourceHashes,'immutable source through retained wait');
        }catch(error){decision={decision:'incomplete',reason:'refused-frozen-identity',diagnostic:String(error.message),waitWallMs:decision.waitWallMs};}
      }
      pilotContinuation={costSha256,manifestSha256,gpuInvocationId:gpuInvocation.id,...decision};
      return decision;
    }:undefined;
    const schedule=await runTipImpactFixedWork(session,profile.work,{afterFirstCapture});
    if(!schedule.completed){
      // dispose preserves the session's existing validation/error handling;
      // no finish/map, no actual artifact, no physical result or pass is emitted.
      await session.dispose();session=undefined;
      const incomplete={kind:'resident-tip-impact-pilot-incomplete-v1',status:'incomplete',runtimeSha256:manifest.runtimeSha256,gpuInvocation,
        reason:schedule.reason??'coordinator-abort',cumulativeCycles:schedule.cumulativeCycles,originalWork:[...profile.work],frames:192,
        pilot:pilotContinuation,mapped:false,physicalResult:null,passingActualWritten:false};
      writePilotJsonOnce(dir,PILOT_FILES.incomplete,incomplete);log(incomplete);return incomplete;
    }
    const result = await session.finish();
    const actual = {kind: 'resident-tip-impact-isolated-mapped-v1', runtimeSha256: manifest.runtimeSha256,
      gpuInvocation: processInvocationIdentity(), adapter: owner.adapterInfo, precompile, result, ...(pilot?{pilot:pilotContinuation}: {})};
    const actualSha256 = save(dir, 'actual.v8', actual);
    writeJson(dir, 'actual-manifest.json', {actualSha256, runtimeSha256: manifest.runtimeSha256});
    log({stage: 'tip-impact-native-mapped-parity-pending', actualSha256, stats: result.stats, expectedFileOpened: false});
    return actual;
  } finally {
    if (session) await session.dispose();
    owner.release();
  }
}

export async function assertTipImpact(dir) {
  const {manifest, runtime, profile} = await checkedRuntime(dir);
  assert.deepEqual(sourceHashes(), manifest.sourceHashes, 'frozen source at independent assertion');
  const am = json(dir, 'actual-manifest.json'), actualBytes = read(dir, 'actual.v8');
  assert.equal(sha(actualBytes), am.actualSha256);
  assert.equal(am.runtimeSha256, manifest.runtimeSha256);
  const actual = deserialize(actualBytes);
  assert.equal(actual.kind, 'resident-tip-impact-isolated-mapped-v1');
  assert.equal(actual.runtimeSha256, manifest.runtimeSha256);
  assert.equal(Object.hasOwn(actual,'pilot'),existsSync(join(dir,PILOT_FILES.cost)),'pilot provenance cannot be omitted from mapped actual');
  if(Object.hasOwn(actual,'pilot')){
    const bound=readPilotCost(dir), decisionBytes=read(dir,PILOT_FILES.decision), decision=validatePilotDecision(JSON.parse(decisionBytes),bound);
    assert.equal(decision.decision,'continue');assert.equal(actual.pilot.decision,'continue');
    assert.equal(actual.pilot.costSha256,bound.costSha256);assert.equal(actual.pilot.decisionSha256,sha(decisionBytes));
    assert.equal(actual.pilot.manifestSha256,sha(read(dir,'manifest.json')));assert.equal(bound.cost.manifestSha256,actual.pilot.manifestSha256);
    assert.equal(bound.cost.runtimeSha256,manifest.runtimeSha256);assert.equal(bound.cost.gpuInvocation.id,actual.gpuInvocation.id);assert.equal(actual.pilot.gpuInvocationId,actual.gpuInvocation.id);
    assert.deepEqual(bound.cost.work,profile.work);assert.deepEqual(actual.pilot.coordinatorInvocation,decision.coordinatorInvocation);
    for(const key of ['sourceSha256','bytecodeSha256','vmShaderSha256','originalGeneration'])assert.equal(bound.cost[key],manifest[key]);
    assert.equal(bound.cost.sourceHashesSha256,sha(JSON.stringify(manifest.sourceHashes)));
    assert.deepEqual(bound.cost.adapter,actual.adapter);assert.deepEqual(bound.cost.precompile,actual.precompile);
    for(const [index,name] of ['initialization','pump'].entries())assert.deepEqual(bound.cost.timing[name],{stage:'execution-group-ready',...actual.result.stats.executionGroups[index],timingKind:'host-wall-not-gpu-timestamp'});
    assert.ok(Number.isFinite(actual.pilot.waitWallMs)&&actual.pilot.waitWallMs>=0&&actual.pilot.waitWallMs<bound.cost.waitTimeoutMs);
    assert.equal(existsSync(join(dir,PILOT_FILES.incomplete)),false,'aborted pilot cannot become a passing actual');
  }
  assertSeparateTestProcesses({gpu: actual.gpuInvocation, prepared: manifest.preparationInvocation});
  const em = json(dir, 'expected-manifest.json'), expectedBytes = read(dir, 'expected.v8');
  assert.equal(em.kind, 'resident-tip-impact-expected-manifest-v1');
  assert.equal(em.runtimeSha256, manifest.runtimeSha256);
  assert.equal(em.originalGeneration, manifest.originalGeneration);
  assert.equal(sha(expectedBytes), em.expectedSha256);
  const expected = deserialize(expectedBytes), p = runtime.original;
  assert.equal(expected.kind, 'resident-tip-impact-isolated-assertions-v1');
  assert.equal(expected.generationIdentity, manifest.originalGeneration);
  assert.equal(expected.template.state.length, p.pc.stateWords);
  assert.equal(expected.template.sourceIdentity, p.identity.sourceIdentity);
  assert.deepEqual(expected.template.sharedGeometry, p.sharedGeometry);
  assert.deepEqual(expected.template.fixedCcd, p.init.initialUploads[0].data);
  assert.deepEqual(expected.fixtureExpected.rows, p.identity.rawRows);
  assert.equal(expected.fixtureExpected.identity.preStrikeIdentity, p.identity.preStrikeIdentity);
  if(profile.cueNumberProfile)assert.equal(expected.fixtureExpected.referenceAuthority,profile.cueNumberProfile,'independent expected cue Number authority');
  if(profile.macroProfile){assert.equal(expected.fixtureExpected.seed.initialEventHistoryProfile,SOURCE_EVENT_HISTORY_PROFILE);assert.deepEqual(expected.fixtureExpected.seed.initialEventHistory,expected.fixtureExpected.nativeEvidence.initial.events);}
  const transport = assertTipImpactTransport(runtime, actual.result, profile.work);
  const final = actual.result.checkpoints.at(-1);
  assert.deepEqual(final.words.slice(2 * p.pc.stateWords, p.pc.controlTailBase), expected.template.fixedCcd, 'shared immutable tail');
  let rejectedHistory;
  if(profile.macroProfile){const {assertSmallStrikeRejectedHistory}=await import('./resident-candidate-small-strike-isolated.mjs');rejectedHistory=assertSmallStrikeRejectedHistory(runtime,final.words,expected.template);}
  const {compareTipImpactCheckpoints} = await import('./resident-candidate-tip-impact-compare.mjs');
  const physics = compareTipImpactCheckpoints({expected: expected.fixtureExpected, words: final.words,
    auditWords: final.auditWords, layout: runtime.audit, template: expected.template, trace: log});
  assert.equal(physics.all11SourceGroups, true);
  assert.equal(physics.nativePhysicsLabOuter, true);
  assert.equal(physics.fullAcceptedEmissionTapeQualified, true);
  const evidence = {kind: 'resident-tip-impact-isolated-assertion-v1', status: 'pass', count: 2, frames: 192,
    checkpoints: [128, 192], runtimeSha256: manifest.runtimeSha256, actualSha256: am.actualSha256,
    expectedSha256: em.expectedSha256, transport, physics, ...(profile.macroProfile?{macroProfile:profile.macroProfile,rejectedHistory}:{}), ...(profile.cueNumberProfile?{cueNumberProfile:profile.cueNumberProfile}:{}), rawToStrike: true,
    fullRest: false, queryTerminal: false, native1024: false, hardwarePerformance: false};
  writeJson(dir, 'assertion.json', evidence);
  log({stage: 'tip-impact-all-gates-pass', ...evidence});
  return evidence;
}

if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  const [mode, path, ...flags] = process.argv.slice(2);
  try {
    assert.ok(path, 'explicit fresh local artifact directory');
    if (mode === 'prepare') {
      assert.ok(flags.length>=1&&flags.length<=3,'prepare requires explicit --work plus optional named profiles');
      assert.match(flags[0], /^--work=\d+(?:,\d+)*$/);
      assert.ok(new Set(flags).size===flags.length&&flags.slice(1).every(f=>['--coupled-macro','--cue-original-number'].includes(f)),'known unique optional flags');
      await prepareTipImpact(resolve(path), {work: flags[0].slice(7).split(',').map(Number),...(flags.includes('--coupled-macro')?{macroProfile:'source-coupled-macro-v1'}:{}),...(flags.includes('--cue-original-number')?{cueNumberProfile:'original-js-number-v1'}:{})});
    } else if(mode==='gpu-pilot') {
      assert.equal(flags.length,1,'explicit operational wait timeout required');assert.match(flags[0],/^--wait-ms=\d+$/);
      const result=await executeTipImpact(resolve(path),{pilot:{waitTimeoutMs:Number(flags[0].slice(10))}});
      if(result.status==='incomplete')process.exitCode=2;
    } else {
      assert.equal(flags.length, 0);
      if (mode === 'gpu') await executeTipImpact(resolve(path));
      else if (mode === 'assert') await assertTipImpact(resolve(path));
      else throw Error('prepare --work=blocks | gpu | gpu-pilot --wait-ms=N | assert');
    }
  } catch (error) { console.error(error); process.exitCode = 1; }
}
