// HOST control-contract tests only. Synthetic markers below are not physics.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serialize, deserialize} from 'node:v8';
import {validateTipImpactWork, validateTipImpactOptions, tipImpactIdentitySha256, assertTipImpactTransport, executeTipImpact} from './resident-candidate-tip-impact-isolated.mjs';
import {MICROCODE_ISA as VM} from '../src/resident-candidate/microcode-isa.mjs';
import {WORLD_DEVICE_PC as PC} from '../src/resident-candidate/world-device-pc.mjs';
import {STATUS, REASON} from '../src/resident-candidate/abi.mjs';

function synthetic() {
  const work = [2, 3];
  const pc = {stateWords: 64, controlTailBase: 128, controlWords: 80, totalStateWords: 336, maxH: 192, instructions: 9};
  const vm = {dispatchChunks: 5, totalWords: 64, stride: 32, entryPc: 0, instructionCount: 2,
    code: Uint32Array.from([VM.opcodes.SET, 0, 0, 0, 0, 0, 0, 0, VM.opcodes.HALT, 0, 0, 0, 0, 0, 0, 0])};
  const runtime = {original: {pc, count: 2}, vm, audit: {totalWords: 32}};
  const checkpoint = (cycles, complete) => {
    const words = new Uint32Array(pc.totalStateWords), vmWords = new Uint32Array(vm.totalWords);
    for (let lane = 0; lane < 2; lane++) {
      const b = lane * pc.stateWords, cb = pc.controlTailBase + lane * pc.controlWords, v = lane * vm.stride;
      words.set([0x52435753, 1, lane ? STATUS.REJECTED : STATUS.RUNNING,
        lane ? REASON.SOURCE_INPUT_RANGE : REASON.NONE, lane ? 522 : 219, lane ? 0 : complete ? 192 : 80], b);
      words[cb + PC.header.magic] = PC.magic;
      words[cb + PC.header.version] = PC.version;
      words[cb + PC.header.requestedH] = 192;
      words[cb + PC.header.status] = lane ? PC.status.worldTerminal : complete ? PC.status.complete : PC.status.ready;
      if (!lane) {
        words[cb + PC.header.pc] = complete ? pc.instructions - 1 : 2;
        words[cb + PC.header.completedH] = complete ? 192 : 79;
      }
      vmWords[v + VM.control.magicWord] = VM.control.magic;
      vmWords[v + VM.control.versionWord] = VM.version;
      vmWords[v + VM.control.status] = lane || complete ? VM.status.complete : VM.status.waiting;
      vmWords[v + VM.control.stepsLow] = cycles * 100;
      vmWords[v + VM.control.entryPc] = vm.entryPc;
      vmWords[v + VM.control.pc] = lane || complete ? 2 : 1;
      vmWords[v + VM.control.lastOpcode] = lane || complete ? VM.opcodes.HALT : VM.opcodes.EXTERNAL_CALL;
    }
    return {name: 'fixed-cycles-' + cycles, pumpCycles: cycles, words, vmWords,
      auditWords: new Uint32Array(32), controls: Array.from({length: 2}, (_, lane) => Array.from(vmWords.slice(lane * vm.stride, lane * vm.stride + VM.control.words)))};
  };
  const result = {checkpoints: [checkpoint(2, false), checkpoint(5, true)], stats: {
    mappings: 1, copies: 6, initialWrites: 8, pumpCycles: 5,
    executionGroups: [{name: 'initialize'}, {name: 'pump'}, {name: 'pump'}], cache: {coldCompiles: 0}
  }};
  return {runtime, result, work};
}

test('work is explicit, copied, bounded transport, not a physical horizon override', () => {
  const work = [512, 1536], p = validateTipImpactWork(work);
  work[0] = 1;
  assert.deepEqual(p, {frames: 192, count: 2, work: [512, 1536], cycles: 2048});
  assert.ok(Object.isFrozen(p) && Object.isFrozen(p.work));
  for (const bad of [undefined, null, [], [0], [-1], [1.5], [NaN], [Infinity], [65537], [65536, 1], Array(65).fill(1)])
    assert.throws(() => validateTipImpactWork(bad));
});

test('coupled macro profile requires explicit original-JS cue authority without changing baseline selection',()=>{
  const old=validateTipImpactOptions({work:[128]});assert.equal(old.macroProfile,undefined);assert.equal(old.cueNumberProfile,undefined);assert.equal(old.macros.length,3);
  const p=validateTipImpactOptions({work:[128],macroProfile:'source-coupled-macro-v1',cueNumberProfile:'original-js-number-v1'});
  assert.equal(p.frames,192);assert.equal(p.cycles,128);assert.deepEqual(p.macros,[...old.macros,'rc_coupled_transport_advance']);
  for(const options of [null,{work:[1],macroProfile:undefined},{work:[1],cueNumberProfile:undefined},{work:[1],macroProfile:'unknown'},{work:[1],macroProfile:'source-coupled-macro-v1'},{work:[1],cueNumberProfile:'legacy-double-single-v1'},{work:[1],finalState:[]},{work:[1],frames:8}])assert.throws(()=>validateTipImpactOptions(options));
});

test('complete metadata hash survives V8 round trips without depending on property order or shared-reference encoding', () => {
  const row = Object.freeze({id: 219, settings: Object.freeze({speed: 4.5, tipX: .2, tipY: -.1, angle: 310, elevation: 85})});
  const x = Object.freeze({rows: Object.freeze([row]), repeated: row, flags: {ready: true, empty: null}, value: -0});
  const y = deserialize(serialize(x));
  assert.equal(tipImpactIdentitySha256(x), tipImpactIdentitySha256(y));
  assert.equal(tipImpactIdentitySha256(x), tipImpactIdentitySha256({value: -0, flags: {empty: null, ready: true}, repeated: structuredClone(row), rows: [structuredClone(row)]}));
  assert.notEqual(tipImpactIdentitySha256(x), tipImpactIdentitySha256({...y, value: 0}));
  assert.notEqual(tipImpactIdentitySha256(x), tipImpactIdentitySha256({...y, rows: [{...row, id: 220}]}));
  const cycle = {}; cycle.self = cycle;
  for (const bad of [undefined, NaN, Infinity, new Uint32Array(1), new Date(), [undefined], Array(1), cycle])
    assert.throws(() => tipImpactIdentitySha256(bad));
});

test('final transport requires retained source/VM and actual audit bank without claiming numerical parity', () => {
  const {runtime, result, work} = synthetic(), r = assertTipImpactTransport(runtime, result, work);
  assert.equal(r.hostStateReadbacksDuringContinuation, 0);
  assert.equal(r.realAuditBinding, true);
  assert.match(r.sourceParity, /still required/);
  assert.equal(Object.hasOwn(r, 'rawToStrike'), false);
});

test('incomplete, unsupported, reset, missing audit, altered request and hidden uploads fail closed', () => {
  const defects = [
    ({result}) => { result.checkpoints[1].vmWords[VM.control.status] = VM.status.ready; },
    ({result}) => { result.checkpoints[1].vmWords[VM.control.status] = VM.status.unsupported; },
    ({result}) => { result.checkpoints[1].vmWords[VM.control.stepsLow] = 1; },
    ({result}) => { result.checkpoints[1].vmWords[VM.control.pc] = 1; },
    ({result}) => { delete result.checkpoints[1].auditWords; },
    ({result}) => { result.checkpoints[1].auditWords = new Uint32Array(1); },
    ({runtime, result}) => { result.checkpoints[1].words[runtime.original.pc.controlTailBase + PC.header.requestedH] = 193; },
    ({runtime, result}) => { result.checkpoints[1].words[runtime.original.pc.stateWords + 5] = 1; },
    ({result}) => { result.checkpoints[1].words[5] = 191; },
    ({result}) => { result.stats.initialWrites = 9; },
    ({result}) => { result.stats.mappings = 2; },
    ({result}) => { result.stats.copies = 4; },
    ({result}) => { result.stats.cache.coldCompiles = 1; },
  ];
  for (const mutate of defects) {
    const f = synthetic(); mutate(f);
    for (const c of f.result.checkpoints) c.controls = Array.from({length: 2}, (_, lane) => Array.from(c.vmWords.slice(lane * f.runtime.vm.stride, lane * f.runtime.vm.stride + VM.control.words)));
    assert.throws(() => assertTipImpactTransport(f.runtime, f.result, f.work));
  }
});

test('unused fixed work cannot modify a completed source, VM or audit bank', () => {
  for (const key of ['words', 'vmWords', 'auditWords']) {
    const f = synthetic(), done = structuredClone(f.result.checkpoints[1]);
    f.result.checkpoints[0] = structuredClone(done);
    f.result.checkpoints[0].name = 'fixed-cycles-2'; f.result.checkpoints[0].pumpCycles = 2;
    const at = key === 'words' ? 40 : key === 'vmWords' ? 20 : 5;
    done[key][at] ^= 1; f.result.checkpoints[1] = done;
    assert.throws(() => assertTipImpactTransport(f.runtime, f.result, f.work));
  }
});

test('native execution is explicit and its lean role never opens expected artifacts or imports the CPU compiler', async () => {
  const prior = process.env.RUN_RESIDENT_TIP_IMPACT_GPU;
  delete process.env.RUN_RESIDENT_TIP_IMPACT_GPU;
  try { await assert.rejects(executeTipImpact('/not-opened'), /explicit coordinator numerical slot required/); }
  finally { if (prior !== undefined) process.env.RUN_RESIDENT_TIP_IMPACT_GPU = prior; }
  const source = readFileSync(new URL('./resident-candidate-tip-impact-isolated.mjs', import.meta.url), 'utf8');
  const native = source.slice(source.indexOf('export async function executeTipImpact'), source.indexOf('export async function assertTipImpact'));
  assert.doesNotMatch(native, /read\([^\n]*expected|json\([^\n]*expected|import\([^\n]*(?:fixture|compiler|physics)/);
  assert.match(native, /cache\.validateAll[\s\S]*cache\.compile[\s\S]*createMicrocodeWorldSession/);
  assert.match(native, /await runTipImpactFixedWork[\s\S]*await session\.finish/);
  const fixedWork=source.slice(source.indexOf('export async function runTipImpactFixedWork'),source.indexOf('export async function executeTipImpact'));
  assert.match(fixedWork,/await session\.pump\(cycles\)[\s\S]*await session\.capture/);
  assert.doesNotMatch(fixedWork,/session\.(?:finish|initialize)|mapAsync/);
});
