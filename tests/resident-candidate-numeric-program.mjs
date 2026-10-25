import {test} from 'node:test';
import assert from 'node:assert/strict';
import Graph from '../src/experimental-arithmetic-graph.js';
import Cue from '../src/experimental-cue-joint-stepper.js';
import Angular from '../src/experimental-angular-patch.js';
import Lateral from '../src/experimental-cue-lateral-compensated.js';
import Tip from '../src/experimental-cue-joint-tip-contact.js';
import Free from '../src/experimental-free-body.js';
import Contact from '../src/experimental-coupled-contact-math.js';
import {compileGraph, compileGraphSlice, executeLowered, generateNumericLibraryWGSL, NUMERIC_ABI, NUMERIC_STATUS}
  from '../src/resident-candidate/numeric-program.mjs';
import {generateProfiledNumericWGSL} from '../src/resident-candidate/numeric-profile.mjs';

// No adapter, GPU module, native physics world or deployment is used here.
// Production arithmetic plans are compared with their existing scalar graph
// interpreter; these are transport tests, NOT independent native-world parity.
const options = Object.freeze({testOnly: true});
const raw = a => new Uint32Array(a.buffer, a.byteOffset, a.length);
function differential(plan, input, label = '') {
  const before = structuredClone(plan), compiled = compileGraph(plan);
  assert.deepEqual(plan, before, 'compiler never mutates original graph');
  const actual = executeLowered(compiled, input, options), expected = Graph.execute(input, plan);
  assert.deepEqual(raw(actual), raw(expected), label + ' raw f32 bits, including signed zero');
  assert.equal(compiled.nodeCount, plan.nodes.length, 'every eager node retained');
  assert.equal(compiled.program.length, NUMERIC_ABI.headerWords + plan.nodes.length * NUMERIC_ABI.instructionWords + plan.outputs.length);
  assert.equal(compiled.scratchWords, compiled.registerCount + 1);
  return compiled;
}
function graph(inputs = 5) {
  const p = {inputFloats: inputs, nodes: [], outputs: []};
  return {p, op(kind, ...args) { p.nodes.push({kind, args}); return inputs + p.nodes.length - 1; }};
}

test('all production opcodes and zero signs retain scalar-graph behavior', () => {
  const {p, op} = graph();
  p.outputs = [
    op('const', -0), op('add', 0, 0), op('sub', 0, 1), op('mul', 0, 2), op('div', 0, 2),
    op('min', 0, 1), op('max', 0, 1), op('sqrt', 0), op('inv', 0), op('cap', 4, 2),
    op('choose', 2, 0, 1), op('lt', 3, 2), op('le', 0, 1), op('gt', 4, 2),
    op('signbitSign', 0), op('negate', 1), op('choose', 0, 1, 0), op('inv', 3),
  ];
  assert.deepEqual(new Set(p.nodes.map(n => n.kind)), new Set(Graph.OPS));
  differential(p, new Float32Array([-0, 0, 1, -1, 4]));
});

test('last-use reuse loads all operands before alias writes; outputs and duplicates stay live', () => {
  const {p, op} = graph(2);
  const a = op('add', 0, 0), b = op('sub', a, 1), c = op('choose', b, a, 1);
  p.outputs = [0, c, a, c];
  const compiled = differential(p, new Float32Array([-0, 2]));
  assert.equal(compiled.outputSlots[1], compiled.outputSlots[3]);
  assert.equal(compiled.outputSlots[0], 0, 'output-valued input remains pinned');
  assert.ok(compiled.registerCount < compiled.originalScratchWords);
  const simple = differential({inputFloats: 2, nodes: [], outputs: [1, 0, 1]}, new Float32Array([-0, 7]));
  assert.equal(simple.registerCount, 2);
});

test('long chain uses bounded registers without eliminating unobserved eager operations', () => {
  const {p, op} = graph(2); let value = 0;
  for (let i = 0; i < 20000; i++) value = op(i % 2 ? 'sub' : 'add', value, 1);
  p.outputs = [value];
  const c = differential(p, new Float32Array([.25, .125]));
  assert.equal(c.registerCount, 2);
  const unused = {inputFloats: 2, nodes: [{kind: 'div', args: [0, 1]}], outputs: [0]};
  assert.throws(() => executeLowered(compileGraph(unused), new Float32Array([1, 0]), options), e => e.numericStatus === NUMERIC_STATUS.DOMAIN);
  assert.throws(() => Graph.execute(new Float32Array([1, 0]), unused), /Non-finite/);
});

test('subnormals, f32 cast boundaries and epsilon neighbors are not rewritten by lowering', () => {
  const input = new Float32Array(new Uint32Array([1, 0x80000001, 0x1e3ce508, 0x1e3ce509, 0x3f800000]).buffer);
  const {p, op} = graph();
  p.outputs = [op('add', 0, 1), op('mul', 1, 0), op('div', 1, 4), op('inv', 2), op('inv', 3), op('negate', 1)];
  differential(p, input);
  const round = graph(3), a = round.op('add', 0, 1);
  round.p.outputs = [round.op('sub', a, 0)];
  assert.equal(executeLowered(compileGraph(round.p), new Float32Array([16777216, 1, 0]), options)[0], 0);
});

test('deterministic random finite DAGs agree bitwise and compilation is deterministic', () => {
  let seed = 0x12345678;
  const random = n => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) % n; };
  const kinds = ['add', 'sub', 'min', 'max', 'choose', 'lt', 'le', 'gt', 'negate', 'signbitSign'];
  for (let trial = 0; trial < 40; trial++) {
    const {p, op} = graph(8), input = Float32Array.from({length: 8}, (_, i) => i === 0 ? -0 : (random(200) - 100) / 64);
    for (let i = 0; i < 250; i++) {
      const kind = kinds[random(kinds.length)], count = Graph.OPERATIONS[Graph.OPS.indexOf(kind)].arity;
      op(kind, ...Array.from({length: count}, () => random(8 + i)));
    }
    p.outputs = Array.from({length: 12}, () => random(8 + p.nodes.length));
    const c = differential(p, input, 'random trial ' + trial);
    assert.deepEqual(c.program, compileGraph(p).program);
  }
});

function cueInput(plan, variant = 0) {
  const x = new Float32Array(plan.inputFloats);
  for (const base of [0, 48]) {
    x.set([.2 + variant * .01, -.01, .03], base);
    x.set([.1, .2, -.1], base + 3); x[base + 7] = .03; x[base + 12] = 1;
    x.set([2, 2, 2], base + 16); x.set([100, 0, 0, 100, 0, 100], base + 19);
    x[base + 28] = 1; x.set([100, 100, 100], base + 29); x[base + 40] = 1;
  }
  x[102] = 1;
  for (const i of [109, 116, 123, 130]) x[i] = 1;
  x.set([1 / 61440, 1, 400, 10, 100, 1, 100, 1, -.08, .13], 131);
  return x;
}

test('actual full 12/4/1 cue-joint graph lowers to hundreds, not tens of thousands, of registers', t => {
  const plan = Cue.buildPlan();
  assert.ok(plan.nodes.length >= 70000, 'real production cue graph, not a toy reduced schedule');
  let c;
  for (let variant = 0; variant < 3; variant++) c = differential(plan, cueInput(plan, variant), 'cue variant ' + variant);
  assert.ok(c.registerCount < 1024);
  assert.ok(c.registerCount * 50 < c.originalScratchWords);
  t.diagnostic(JSON.stringify({nodes: c.nodeCount, inputCount: c.inputCount, outputCount: c.outputCount,
    registerCount: c.registerCount, scratchBytesPerCandidate: c.scratchWords * 4,
    scratchBytes4096: c.scratchWords * 4 * 4096, programBytesShared: c.program.byteLength}));
});

test('actual compensated angular law, including dynamic eligibility, keeps raw f32 results', () => {
  const base = {kind: 'ordered-single-manifold-angular-patch', phase: 'post-world-step-pre-angular-patch',
    bodyType: 'dynamic', sleeping: false, isSphere: true, materialKind: 'cloth', normal: [0, 1, 0],
    angular: [10, 20, -30], linear: [0, 0, 0], invInertia: [12590, 0, 0, 12590, 0, 12590],
    impulses: [Math.fround(.01)], mass: .210, radius: .03075, gravity: 9.81, h: 1 / 960,
    rollingLength: .00045, spinLength: .00035};
  const plan = Angular.buildPrecisePlan();
  for (const patch of [{}, {h: 1 / 61440}, {sleeping: true}, {impulses: []},
    {angular: [0, -0, 0]}, {linear: [0, Math.fround(.05), 0]}, {normal: [0, Math.fround(.95), 0]}]) {
    differential(plan, Angular.packPrecise({...base, ...patch}));
  }
});

test('actual lateral and tip compliance graphs retain compensated arithmetic and tangent outputs', () => {
  const lateral = {kind: 'actual-cue-lateral-prefix', phase: 'pre-world-step-pre-tip-contact', dynamicAwake: true,
    headPosition: [0, Math.fround(.04), 0], shaftPosition: [0, Math.fround(.04), 0],
    headCom: [0, Math.fround(.04), 0], shaftCom: [0, Math.fround(-.5), 0],
    headLinear: [2, 0, 0], shaftLinear: [2, 0, 0], headAngular: [0, 0, 0], shaftAngular: [0, 0, 0],
    headInvMass: [80, 80, 80], shaftInvMass: [2, 2, 2], shaftInvInertia: [100, 0, 0, 100, 0, 100],
    axis: [1, 0, 0], h: 1 / 61440, stiffness: 1200, damping: 1};
  differential(Lateral.buildPlan(), Lateral.pack(lateral));
  const body = position => ({position, worldCom: position.slice(), linear: [0, 0, 0], angular: [0, 0, 0],
    invMass: [4, 4, 4], invInertia: [100, 0, 0, 100, 0, 100]});
  const tip = {kind: 'actual-cue-single-sphere-tip', phase: 'post-lateral-prefix-pre-world-step',
    head: body([0, 0, 0]), ball: body([Math.fround(.0367), 0, 0]), radius: .03075, tipRadius: .006,
    h: 1 / 61440, normalStiffness: 1e6, normalDamping: 110, tangentStiffness: 4e5,
    tangentDamping: 10, friction: .7, tangent: [1e-6, 0, 0], active: true, contacted: true};
  differential(Tip.buildPlan(), Tip.pack(tip));
  differential(Tip.buildPlan(), Tip.pack({...tip, ball: body([Math.fround(.04), 0, 0])}));
});

test('actual free-body graph and ordered coupled dynamic/cloth solver retain source operation order', () => {
  const q = [0, 0, 0, 1], inertia = [100, 0, 0, 0, 100, 0, 0, 0, 100];
  const body = {linear: [.2, 0, .1], angular: [.2, -.3, .1], translation: [0, .03075, 0], rotation: q,
    localCom: [0, 0, 0], invMass: [4, 4, 4], invInertia: inertia, principalFrame: q,
    principalInertia: [.01, .01, .01], invPrincipalInertia: [100, 100, 100]};
  const parameters = {userForce: [0, 0, 0], userTorque: [0, 0, 0], gravity: [0, -9.81, 0], gravityScale: 1,
    linearDamping: 0, angularDamping: 0, dt: 1 / 960, lengthUnit: 1, normalizedMaxLinearVelocity: 400,
    allowFastRotation: false, gyroscopic: true};
  differential(Free.buildPlan(12), Free.pack({body, parameters}));
  const config = {bodyCount: 2, substeps: 12, pgsIterations: 4, stabilizationIterations: 1,
    contacts: [{kind: 'dynamic-sphere', body1: 0, body2: 1}, {kind: 'cloth', body1: null, body2: 0},
      {kind: 'cloth', body1: null, body2: 1}], contactOrder: [0, 2, 1]};
  const plan = Contact.buildPlan(config), physical = {...body, userForce: [0, 0, 0], userTorque: [0, 0, 0],
    gravityScale: 1, linearDamping: 0, angularDamping: 0, gyroscopic: true, allowFastRotation: false, radius: .03075};
  const cloth = {normal: [0, 1, 0], anchor1: [0, 0, 0], anchor2: [0, -.03075, 0],
    dp1: [0, 0, 0], dp2: [0, -.03075, 0], warmWorld: [0, 0, 0], warmImpulse: 0,
    impulse: .01, friction: .2, restitution: 0};
  const pair = {...cloth, normal: [1, 0, 0], anchor1: [.03075, 0, 0], anchor2: [-.03075, 0, 0],
    dp1: [.03075, 0, 0], dp2: [-.03075, 0, 0], restitution: .9};
  const prepared = {dt: 1 / 960, lengthUnit: 1, normalizedMaxLinearVelocity: 400, dynamicFrequency: 30,
    dynamicDamping: 1, staticFrequency: 30, staticDamping: 1, warmstartCoefficient: .8,
    normalizedMaxCorrectiveVelocity: 10, frictionInBiasPass: false, gravity: [0, -9.81, 0],
    bodies: [physical, {...physical, translation: [.0615, .03075, 0]}], contacts: [pair, cloth, cloth]};
  differential(plan, Contact.pack(prepared, plan));
});

test('malformed programs, domain errors and nonfinite intermediates cannot report completion', () => {
  const p = {inputFloats: 2, nodes: [{kind: 'add', args: [0, 1]}], outputs: [2]}, c = compileGraph(p);
  const bad = (mutate, expected = NUMERIC_STATUS.MALFORMED, input = new Float32Array([1, 2])) => {
    const program = c.program.slice(); mutate(program);
    assert.throws(() => executeLowered(program, input, options), e => e.numericStatus === expected);
  };
  bad(p => p[0] = 0); bad(p => p[1]++); bad(p => p[2]++); bad(p => p[6]++);
  bad(p => p[10]++); bad(p => p[11] = 1); bad(p => p[12] = 16);
  bad(p => p[13] = c.registerCount); bad(p => p[14] = c.registerCount);
  bad(p => p[c.outputOffset] = c.registerCount);
  bad(() => {}, NUMERIC_STATUS.NONFINITE, new Float32Array([Infinity, 0]));
  bad(() => {}, NUMERIC_STATUS.NONFINITE, new Float32Array([3.4028234663852886e38, 3.4028234663852886e38]));
  assert.throws(() => executeLowered(c.program.subarray(0, -1), new Float32Array([1, 2]), options), e => e.numericStatus === NUMERIC_STATUS.MALFORMED);
  for (const [kind, args, input] of [['div', [0, 1], [1, -0]], ['sqrt', [0], [-1, 0]]]) {
    const x = compileGraph({inputFloats: 2, nodes: [{kind, args}], outputs: [2]});
    assert.throws(() => executeLowered(x, new Float32Array(input), options), e => e.numericStatus === NUMERIC_STATUS.DOMAIN);
  }
  assert.throws(() => compileGraph({inputFloats: 1, nodes: [{kind: 'const', args: [NaN]}], outputs: [1]}));
  assert.throws(() => compileGraph({inputFloats: 1, nodes: [{kind: 'add', args: [1, 0]}], outputs: [1]}));
  assert.throws(() => executeLowered(c, new Float32Array([1, 2])), /TEST-ONLY/);
});

test('relocatable programs and byte-offset inputs preserve bits; WGSL library owns no bindings', () => {
  const c = compileGraph({inputFloats: 2, nodes: [{kind: 'min', args: [0, 1]}], outputs: [2, 0]});
  const program = new Uint32Array(c.program.length + 19); program.set(c.program, 13);
  const larger = new Float32Array([9, -0, 0, 9]), input = larger.subarray(1, 3);
  assert.deepEqual(raw(executeLowered(program, input, {...options, programBase: 13})), new Uint32Array([0x80000000, 0x80000000]));
  const wgsl = generateNumericLibraryWGSL();
  assert.match(wgsl, /fn rc_num_eval\(programBase:u32, scratchBase:u32\)->u32/);
  assert.doesNotMatch(wgsl, /@binding|@group|@compute|workgroupBarrier|storageBarrier|\bfma\(/);
  assert.match(wgsl, /rc_scratch\[scratchBase\+registers\]=0u/);
  assert.match(wgsl, /rc_scratch\[scratchBase\+registers\]=1u/);
  assert.match(wgsl, /word=aw\|bw/); assert.match(wgsl, /word=aw&bw/);
});

test('optional boundary maps expose only live SSA values at exact source boundaries', () => {
  const {p, op} = graph(3), a = op('add', 0, 1), b = op('mul', a, 2), c = op('sub', b, 2);
  p.outputs = [c, 0];
  const compiled = compileGraph(p, {boundaries: [3, 0, 1, 2, 2]});
  assert.deepEqual(compiled.boundaries.map(b => b.nodeIndex), [0, 1, 2, 3]);
  assert.deepEqual(compiled.boundaries.map(b => [...b.liveValueIds]), [[0, 1, 2], [0, 2, a], [0, 2, b], [0, c]]);
  for (const boundary of compiled.boundaries) {
    assert.equal(boundary.liveValueIds.length, boundary.slots.length);
    assert.equal(new Set(boundary.slots).size, boundary.slots.length);
    assert.ok(boundary.slots.every(slot => slot < compiled.registerCount));
  }
  assert.throws(() => compileGraph(p, {boundaries: [-1]}), /Boundary/);
  assert.throws(() => compileGraph(p, {boundaries: [4]}), /Boundary/);
});

function executeSlices(plan, input, boundaries) {
  // SSA storage is test-only assembly of isolated stage transport; production
  // owners instead bind these maps to their persistent state and scratch.
  const values = new Float32Array(plan.inputFloats + plan.nodes.length); values.set(input);
  let previous = 0;
  for (const end of boundaries) {
    const slice = compileGraphSlice(plan, {start: previous, end});
    const packed = Float32Array.from(slice.inputValueIds, id => id === 0xffffffff ? 0 : values[id]);
    const out = executeLowered(slice, packed, options);
    slice.outputValueIds.forEach((id, i) => values[id] = out[i]);
    assert.equal(slice.nodeCount, end - previous, 'slice retains every contiguous source node');
    previous = end;
  }
  return Float32Array.from(plan.outputs, id => values[id]);
}

test('contiguous slices preserve whole actual cue graph output bits across live-state boundaries', () => {
  const plan = Cue.buildPlan(), input = cueInput(plan);
  const cuts = [19, 333, 10000, 40001, 60000, plan.nodes.length];
  assert.deepEqual(raw(executeSlices(plan, input, cuts)), raw(Graph.execute(input, plan)));
  const {p, op} = graph(2), a = op('const', -0), b = op('add', a, 1); p.outputs = [a, b, 0];
  assert.deepEqual(raw(executeSlices(p, new Float32Array([-0, 3]), [1, 2])), raw(Graph.execute(new Float32Array([-0, 3]), p)));
  const constant = compileGraphSlice(p, {start: 0, end: 1, outputs: [a]});
  assert.equal(constant.paddingInputCount, 1);
  assert.deepEqual([...constant.inputValueIds], [0xffffffff]);
  assert.deepEqual(raw(executeLowered(constant, new Float32Array([0]), options)), new Uint32Array([0x80000000]));
  const passThrough = compileGraphSlice(p, {start: 1, end: 1, outputs: [a, 0, a]});
  assert.equal(passThrough.nodeCount, 0);
  assert.deepEqual([...passThrough.outputValueIds], [a, 0, a]);
  assert.throws(() => compileGraphSlice(p, {start: -1}), /range/);
  assert.throws(() => compileGraphSlice(p, {end: 1, outputs: [b]}), /end boundary/);
  assert.throws(() => compileGraphSlice(p, {end: 1, outputs: []}), /no live outputs/);
});

test('actual native lowered source graphs preserve output bits and isolate malformed/nonfinite candidate lanes',
  {skip: process.env.REQUIRE_WEBGPU !== '1'}, async t => {
  // Only the parent-assigned serial GPU slot may enable this test. No adapter is
  // acquired at module load and there is no CPU-labelled GPU fallback.
  const {createNativeOwner, dispatchWords} = await import('./resident-candidate-gpu-support.mjs');
  const owner = await createNativeOwner('resident-numeric-program');
  try {
    const cue = Cue.buildPlan(), angular = Angular.buildPrecisePlan(), free = Free.buildPlan(12);
    const angularInput = Angular.packPrecise({kind: 'ordered-single-manifold-angular-patch',
      phase: 'post-world-step-pre-angular-patch', bodyType: 'dynamic', sleeping: false, isSphere: true,
      materialKind: 'cloth', normal: [0, 1, 0], angular: [10, 20, -30], linear: [0, 0, 0],
      invInertia: [12590, 0, 0, 12590, 0, 12590], impulses: [Math.fround(.01)],
      mass: .210, radius: .03075, gravity: 9.81, h: 1 / 960, rollingLength: .00045, spinLength: .00035});
    const q = [0, 0, 0, 1], freeInput = Free.pack({body: {linear: [.2, 0, .1], angular: [.2, -.3, .1],
      translation: [0, .03075, 0], rotation: q, localCom: [0, 0, 0], invMass: [4, 4, 4],
      invInertia: [100, 0, 0, 0, 100, 0, 0, 0, 100], principalFrame: q,
      principalInertia: [.01, .01, .01], invPrincipalInertia: [100, 100, 100]},
      parameters: {userForce: [0, 0, 0], userTorque: [0, 0, 0], gravity: [0, -9.81, 0], gravityScale: 1,
        linearDamping: 0, angularDamping: 0, dt: 1 / 960, lengthUnit: 1, normalizedMaxLinearVelocity: 400,
        allowFastRotation: false, gyroscopic: true}});
    const all = graph();
    all.p.outputs = [all.op('const', -0), all.op('add', 0, 0), all.op('sub', 0, 1), all.op('mul', 0, 2),
      all.op('div', 0, 2), all.op('min', 0, 1), all.op('max', 0, 1), all.op('sqrt', 0), all.op('inv', 0),
      all.op('cap', 4, 2), all.op('choose', 2, 0, 1), all.op('lt', 3, 2), all.op('le', 0, 1),
      all.op('gt', 4, 2), all.op('signbitSign', 0), all.op('negate', 1)];
    const unary = {inputFloats: 1, nodes: [{kind: 'sqrt', args: [0]}], outputs: [1]};
    const compiled = new Map(), programChunks = []; let programWords = 0;
    function register(plan, corrupt = false) {
      if (!corrupt && compiled.has(plan)) return compiled.get(plan);
      const c = compileGraph(plan), program = c.program.slice();
      if (corrupt) program[NUMERIC_ABI.headerWords] = 99;
      const entry = {c, base: programWords}; programChunks.push(program); programWords += program.length;
      if (!corrupt) compiled.set(plan, entry);
      return entry;
    }
    const invalidCue = cueInput(cue); invalidCue[0] = Infinity;
    const rows = [
      {name: 'cue-0', plan: cue, input: cueInput(cue, 0)},
      {name: 'nonfinite-between-cues', plan: cue, input: invalidCue, status: NUMERIC_STATUS.NONFINITE},
      {name: 'cue-1', plan: cue, input: cueInput(cue, 1)},
      {name: 'angular', plan: angular, input: angularInput},
      {name: 'malformed', plan: unary, input: new Float32Array([4]), corrupt: true, status: NUMERIC_STATUS.MALFORMED},
      {name: 'free-body', plan: free, input: freeInput},
      {name: 'all-opcode-zero-signs', plan: all.p, input: new Float32Array([-0, 0, 1, -1, 4])},
      {name: 'domain', plan: unary, input: new Float32Array([-1]), status: NUMERIC_STATUS.DOMAIN},
      {name: 'after-invalid', plan: unary, input: new Float32Array([4])},
    ];
    const GUARD = 0xd15ea5ed, UNWRITTEN = 0xcafef00d;
    let scratchWords = 0, resultWords = 0;
    for (const row of rows) {
      Object.assign(row, register(row.plan, row.corrupt));
      row.scratchBase = scratchWords + 1; scratchWords += row.c.scratchWords + 2;
      row.resultBase = resultWords; resultWords += row.c.outputCount + 1;
      row.status ??= NUMERIC_STATUS.COMPLETE;
      if (row.status === NUMERIC_STATUS.COMPLETE) row.expected = raw(Graph.execute(row.input, row.plan)).slice();
    }
    const program = new Uint32Array(programWords); let at = 0;
    for (const chunk of programChunks) { program.set(chunk, at); at += chunk.length; }
    const scratch = new Uint32Array(scratchWords).fill(0x7fc00001), results = new Uint32Array(resultWords).fill(UNWRITTEN);
    const jobs = Uint32Array.from(rows.flatMap(row => [row.base, row.scratchBase, row.resultBase, row.c.outputCount]));
    for (const row of rows) {
      scratch[row.scratchBase - 1] = GUARD; scratch[row.scratchBase + row.c.scratchWords] = GUARD;
      scratch.set(raw(row.input), row.scratchBase); scratch[row.scratchBase + row.c.statusSlot] = UNWRITTEN;
    }
    const code = `
@group(0) @binding(0) var<storage,read> rc_program:array<u32>;
@group(0) @binding(1) var<storage,read_write> rc_scratch:array<u32>;
@group(0) @binding(2) var<storage,read> rc_jobs:array<u32>;
@group(0) @binding(3) var<storage,read_write> rc_results:array<u32>;
${generateProfiledNumericWGSL(process.env.RESIDENT_NUMERIC_PROFILE)}
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let row=gid.x; if (row>=arrayLength(&rc_jobs)/4u) { return; }
  let p=rc_jobs[row*4u]; let s=rc_jobs[row*4u+1u]; let r=rc_jobs[row*4u+2u];
  let status=rc_num_eval(p,s); rc_results[r]=status;
  if (status!=1u) { return; }
  let offset=rc_program[p+8u];
  for(var i=0u;i<rc_jobs[row*4u+3u];i++) { rc_results[r+1u+i]=rc_scratch[s+rc_program[p+offset+i]]; }
}`;
    const [, actualScratch, , actualResults] = await dispatchWords(owner, {code,
      buffers: [{input: program}, {input: scratch, readback: true}, {input: jobs}, {input: results, readback: true}],
      workgroups: Math.ceil(rows.length / 32), label: 'source-graph-liveness-actual-native'});
    for (const row of rows) {
      assert.equal(actualResults[row.resultBase], row.status, row.name + ' returned status');
      assert.equal(actualScratch[row.scratchBase + row.c.statusSlot], row.status, row.name + ' committed status');
      assert.equal(actualScratch[row.scratchBase - 1], GUARD, row.name + ' leading guard');
      assert.equal(actualScratch[row.scratchBase + row.c.scratchWords], GUARD, row.name + ' trailing guard');
      const output = actualResults.subarray(row.resultBase + 1, row.resultBase + 1 + row.c.outputCount);
      if (row.status === NUMERIC_STATUS.COMPLETE) assert.deepEqual(output, row.expected, row.name + ' exact original scalar graph bits');
      else assert.ok(output.every(word => word === UNWRITTEN), row.name + ' failure cannot publish stale outputs');
    }
    t.diagnostic(JSON.stringify({gate: 'actual-native-numeric-program', rows: rows.length,
      sourceGraphs: ['cue-joint-72546-nodes', 'precise-angular', 'free-body-12-substeps'],
      adapterInfo: owner.adapterInfo, bitwise: true, fullWorldParity: false, hardwarePerformance: false}));
  } finally { owner.release(); }
});
