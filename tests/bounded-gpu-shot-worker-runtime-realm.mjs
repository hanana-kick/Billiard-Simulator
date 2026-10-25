// Browser-like module loading in a real worker realm, without CommonJS, DOM,
// network, decoder execution, native engine initialization, or a GPU device.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parentPort, workerData} from 'node:worker_threads';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const scripts = new Set();
function visit(name) {
  const file = 'src/' + name + '.js';
  if (scripts.has(file)) return;
  scripts.add(file);
  for (const match of read(file).matchAll(/(?:require\('\.\/|load\(')([\w-]+)(?:\.js)?'/g)) visit(match[1]);
}
visit('experimental-four-ball-world');
const allowed = new Set([...scripts,
  ...['src/browser-initial-import', 'src/bounded-gpu-shot'].flatMap(dir =>
    fs.readdirSync(path.join(ROOT, dir)).filter(name => name.endsWith('.mjs')).map(name => dir + '/' + name)),
  'tools/rapier-snapshot-decoder/browser.mjs', 'tools/rapier-snapshot-decoder/codec.js']);
const names = new Set([...scripts].flatMap(file =>
  [...read(file).matchAll(/(?:G|globalThis)\.([A-Z]\w*)/g)].map(match => match[1])));
const values = new Map(), reads = new Map(), writes = new Map(), uninitializedReads = [];
const sandbox = {structuredClone, TextEncoder, TextDecoder};
for (const name of names) Object.defineProperty(sandbox, name, {
  get() {
    // Record outside the assertion: contextified-global accessors may swallow
    // thrown host exceptions. Check after each real module evaluation instead.
    if (!values.has(name)) uninitializedReads.push(name);
    reads.set(name, (reads.get(name) ?? 0) + 1);
    return values.get(name);
  },
  set(value) {
    assert.ok(value !== undefined && value !== null, 'Module exported empty global: ' + name);
    values.set(name, value);
    writes.set(name, (writes.get(name) ?? 0) + 1);
  }
});
const context = vm.createContext(sandbox), modules = new Map();
const runtimeFile = 'src/bounded-gpu-shot/four-ball-worker-runtime.mjs';
function resolve(specifier, referrer) {
  assert.match(specifier, /^\.{1,2}\//, 'Only bundled relative imports are permitted');
  const url = new URL(specifier, referrer);
  assert.equal(url.protocol, 'file:');
  assert.equal(url.search + url.hash, '', 'One module identity per trusted file');
  const file = path.relative(ROOT, fileURLToPath(url));
  assert.ok(allowed.has(file), 'Unexpected worker import: ' + file);
  return url.href;
}
function getModule(url) {
  if (modules.has(url)) return modules.get(url);
  const file = path.relative(ROOT, fileURLToPath(url));
  assert.ok(allowed.has(file), 'Unexpected worker module: ' + file);
  let source = read(file);
  // Negative controls mutate only a test copy of the production import list.
  // No source/physics module is replaced or stubbed.
  if (file === runtimeFile && workerData?.mutation) {
    const omission = {
      'omit-coupled-owner': 'experimental-coupled-contact-owner',
      'omit-lazy-coupled-hints': 'experimental-coupled-contact-hints'
    }[workerData.mutation];
    if (omission) {
      const line = '  "../' + omission + '.js",\n';
      assert.ok(source.includes(line));
      source = source.replace(line, '');
    } else {
      assert.equal(workerData.mutation, 'reverse-bvh-dependency');
      const before = '  "../experimental-ccd-bvh-state.js",\n  "../experimental-ccd-bvh-world-bridge.js",';
      assert.ok(source.includes(before));
      source = source.replace(before,
        '  "../experimental-ccd-bvh-world-bridge.js",\n  "../experimental-ccd-bvh-state.js",');
    }
  }
  const module = new vm.SourceTextModule(source, {
    context, identifier: url,
    initializeImportMeta(meta) { meta.url = url; },
    importModuleDynamically(specifier, referrer) { return evaluate(resolve(specifier, referrer.identifier)); }
  });
  modules.set(url, module);
  return module;
}
async function evaluate(url) {
  const module = getModule(url);
  if (module.status === 'unlinked') await module.link((specifier, referrer) => getModule(resolve(specifier, referrer.identifier)));
  if (module.status === 'linked') {
    try { await module.evaluate(); }
    finally {
      assert.equal(uninitializedReads.length, 0, 'Module captured uninitialized global: ' + uninitializedReads[0]);
    }
  }
  assert.equal(module.status, 'evaluated');
  return module;
}

assert.equal(vm.runInContext('typeof module + ":" + typeof require + ":" + typeof window', context),
  'undefined:undefined:undefined', 'Exercise browser module branches, never Node require');
const entry = await evaluate(pathToFileURL(path.join(ROOT, runtimeFile)).href);
const pending = entry.namespace.loadWorkerRuntime();
assert.equal(entry.namespace.loadWorkerRuntime(), pending, 'Concurrent callers must share one load');
const runtime = await pending;
assert.equal(await entry.namespace.loadWorkerRuntime(), runtime, 'Repeated loads must retain one authority');
for (const name of names) assert.ok(values.has(name), 'Missing bundled runtime global: ' + name);
for (const count of writes.values()) assert.equal(count, 1, 'Every runtime global has exactly one module authority');
assert.equal(typeof runtime.createBoundedFourBallShotService, 'function');
assert.equal(typeof values.get('LabFourBallWorldExperimental').createGpuStepper, 'function');
assert.equal(typeof values.get('FourBallGame'), 'function');
assert.equal(writes.get('LabCueConvexTopologyExperimental'), 1, 'Importer and world retain the same private hull authority');
const loadedScripts = [...modules.keys()].map(url => path.relative(ROOT, fileURLToPath(url))).filter(file => scripts.has(file));
assert.deepEqual(loadedScripts.slice().sort(), [...scripts].sort(), 'All trusted static dependencies must actually evaluate');
parentPort.postMessage({
  scriptCount: loadedScripts.length, globalCount: values.size,
  initializationReads: Object.fromEntries(reads), capability: runtime.BOUNDED_FOUR_BALL_CAPABILITY,
  topologyWrites: writes.get('LabCueConvexTopologyExperimental'),
  browserBranches: true, physicsExecuted: false
});
