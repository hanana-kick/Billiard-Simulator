'use strict';
// Orchestration-only host doubles. These tests execute the actual coordinator
// body, but do NOT claim any physics, native GPU, or multi-owner dispatch proof.
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(process.env.BATCH_RUNTIME_ROOT ?? path.join(__dirname, '..'));
function coordinator(faults = {}) {
  const source = fs.readFileSync(path.join(ROOT, 'src/experimental-four-ball-batch-world.mjs'), 'utf8');
  const body = source.replace(/^import [^\n]+;\n/gm, '').replace(/export const CAPABILITY/, 'const CAPABILITY').replace(/export async function createGpuBatchStepper/, 'async function createGpuBatchStepper');
  const calls = {created: 0, worldOptions: [], stepped: [], disposed: [], scopeDisposed: 0, resourcesDisposed: 0, cancelled: [], rounds: []}, cancelled = new Set();
  let releaseStep = null;
  const World = {
    validate(seed) {if (seed.unsupported) throw Error('Unsupported source fixture'); return seed;},
    async createGpuStepper(device, seed, options) {
      calls.worldOptions.push(structuredClone(options));
      calls.created++; let state = {frame: 0, time: 0, source: seed.source, rows: structuredClone(seed.rows ?? []), shotComplete: false};
      if(options.observeInverse)state.inverseObservation={sequence:0,cue:{position:{x:seed.source}}};
      return {
        snapshot() {return structuredClone(state);},
        async step() {
          if (seed.hold) await new Promise(resolve => {releaseStep = resolve;});
          if (cancelled.has(device.id)) {const error = Error('Cancelled owner'); error.name = 'AbortError'; throw error;}
          if (seed.failAt === state.frame + 1) throw Error('Injected host owner failure');
          state = {...state, frame: state.frame + 1, time: state.time + .25}; calls.stepped.push([device.id, state.frame]);
          if(options.observeInverse)state.inverseObservation={sequence:state.frame,cue:{position:{x:seed.source}}};
          if (state.frame === seed.completeAt) {state.shotComplete = true; state.scoreResult = {delta: 0};}
          return structuredClone(state);
        },
        dispose() {calls.disposed.push(device.id); if (faults.disposeOnce === device.id) {faults.disposeOnce = null; throw Error('Injected one-shot world disposal failure');}},
      };
    },
  };
  const Runtime = {createPlanBatchScope() {return {
    createDevice(id) {return {id};}, snapshot() {return {hostDouble: true};},
    async cancelOwner(id) {cancelled.add(id); calls.cancelled.push(id);},
    beginRound(ids) {if (faults.roundStartLoss) throw Error('Arithmetic GPU device lost: host verified loss'); assert.ok(!calls.rounds.length || calls.rounds.at(-1).finished, 'Prior round is closed'); assert.equal(new Set(ids).size, ids.length); calls.rounds.push({ids: ids.slice(), ended: new Set(), finished: false}); return calls.rounds.length;},
    endRoundOwner(id) {const round = calls.rounds.at(-1); assert.ok(round && round.ids.includes(id)); round.ended.add(id);},
    async finishRound() {const round = calls.rounds.at(-1); assert.equal(round.ended.size, round.ids.length); round.finished = true;},
    async cancel() {}, async flush() {}, dispose() {assert.ok(calls.rounds.every(round => round.finished), 'All round lifecycles are balanced before disposal'); calls.scopeDisposed++;},
  };}};
  const sandbox = {LabFourBallWorldExperimental: World, LabStageRuntimeExperimental: Runtime, LabCueConvexTopologyExperimental: {assertNativeHull() {throw Error('No branded hull is accepted by this host double');}}};
  const resources = device => ({device, snapshot() {return {hostDouble: true};}, dispose() {calls.resourcesDisposed++;}});
  const factory = new Function('globalThis', 'createGpuResourceScope', 'importedTopology', body + '\nreturn {createGpuBatchStepper,CAPABILITY};')(sandbox, resources, {default: sandbox.LabCueConvexTopologyExperimental});
  return {...factory, calls, release() {assert.ok(releaseStep); releaseStep();}, device: {createBuffer() {}, queue: {}}};
}

test('one/two-h caps preserve incomplete states without manufacturing full-rest scores', async () => {
  for (const limit of [1, 2]) {
    const host = coordinator(), batch = await host.createGpuBatchStepper(host.device, [{source: 'one'}, {source: 'two'}], {maxStepsPerShot: limit});
    for (let h = 1; h <= limit; h++) {const out = await batch.step(); out.slots.forEach(slot => assert.equal(slot.state.frame, h));}
    const limited = await batch.step(); limited.slots.forEach(slot => {assert.equal(slot.status, 'limit-reached'); assert.equal(slot.state.frame, limit); assert.equal(slot.state.shotComplete, false); assert.equal(slot.state.scoreResult, undefined);});
    assert.deepEqual((await batch.step()).slots, limited.slots); assert.equal(host.calls.stepped.length, limit * 2);
    await batch.dispose(); assert.equal(host.calls.disposed.length, 2); assert.equal(host.calls.scopeDisposed, 1); assert.equal(host.calls.resourcesDisposed, 1);
  }
});

test('natural completion at the cap is complete, unsupported slots stay explicit, and caps cannot be enlarged', async () => {
  const host = coordinator();
  for (const maxStepsPerShot of [0, -1, 1.5, 65537, Infinity]) await assert.rejects(host.createGpuBatchStepper(host.device, [{}, {}], {maxStepsPerShot}), /limit/);
  const batch = await host.createGpuBatchStepper(host.device, [{source: 'rest', completeAt: 1}, {source: 'bad', unsupported: true}], {maxStepsPerShot: 1});
  assert.equal(batch.snapshot().slots[1].status, 'unsupported'); assert.equal(batch.snapshot().slots[1].state, null);
  const out = await batch.step(); assert.equal(out.slots[0].status, 'complete'); assert.equal(out.slots[0].state.shotComplete, true); assert.deepEqual(out.slots[0].state.scoreResult, {delta: 0});
  assert.deepEqual((await batch.step()).slots, out.slots); await batch.dispose();
});

test('seeds and outputs are owned, unexpected per-step input rejects, and device lease releases after disposal', async () => {
  const host = coordinator(), seeds = [{source: 'one', rows: [{x: 2}]}, {source: 'two', rows: [{x: 3}]}], ids = ['a', 'b'];
  const pending = host.createGpuBatchStepper(host.device, seeds, {ids}); seeds[0].rows[0].x = 999; ids.reverse(); const batch = await pending;
  let out = batch.snapshot(); assert.deepEqual(out.slots.map(slot => slot.id), ['a', 'b']); assert.equal(out.slots[0].state.rows[0].x, 2); out.slots[0].state.rows[0].x = 123;
  assert.equal(batch.snapshot().slots[0].state.rows[0].x, 2);
  await assert.rejects(batch.step({externalState: {frame: 99}}), /external|signal/); assert.equal(batch.snapshot().slots[0].state.frame, 0);
  await assert.rejects(host.createGpuBatchStepper(host.device, [{}, {}]), /already owns/);
  await batch.dispose(); await batch.dispose(); await assert.rejects(batch.step(), /disposed/);
  const reused = await host.createGpuBatchStepper(host.device, [{}, {}]); await reused.dispose();
});

test('one owner rejects its h while another commits, and terminal failure cannot be retried', async () => {
  const host = coordinator(), batch = await host.createGpuBatchStepper(host.device, [{source: 'failed', failAt: 1}, {source: 'survivor'}]);
  const out = await batch.step(); assert.equal(out.slots[0].status, 'failed'); assert.equal(out.slots[0].state.frame, 0); assert.equal(out.slots[1].state.frame, 1);
  const next = await batch.step(); assert.deepEqual(next.slots[0], out.slots[0]); assert.equal(next.slots[1].state.frame, 2);
  assert.deepEqual(host.calls.cancelled, ['shot-0']); await batch.dispose();
});

test('one-shot world disposal failure cannot skip scheduler/resource cleanup or strand the device lease', async () => {
  const host = coordinator({disposeOnce: 'shot-0'}), batch = await host.createGpuBatchStepper(host.device, [{source: 'one'}, {source: 'two'}]);
  await assert.rejects(batch.dispose(), /Injected one-shot world disposal failure/);
  assert.equal(host.calls.scopeDisposed, 1, 'Scheduler cleanup still runs'); assert.equal(host.calls.resourcesDisposed, 1, 'Native resource cleanup still runs');
  await assert.rejects(host.createGpuBatchStepper(host.device, [{}, {}]), /already owns/);
  await batch.dispose();
  const reused = await host.createGpuBatchStepper(host.device, [{}, {}]); await reused.dispose();
});

test('device loss before the first round becomes terminal for every admitted owner without advancing state', async () => {
  const host = coordinator({roundStartLoss: true}), batch = await host.createGpuBatchStepper(host.device, [{source: 'one'}, {source: 'two'}]);
  const before = batch.snapshot(), after = await batch.step();
  after.slots.forEach((slot, index) => {assert.equal(slot.status, 'failed'); assert.match(slot.reason, /device lost/); assert.deepEqual(slot.state, before.slots[index].state);});
  assert.equal(host.calls.stepped.length, 0); assert.deepEqual(new Set(host.calls.cancelled), new Set(['shot-0', 'shot-1']));
  assert.deepEqual((await batch.step()).slots, after.slots); await batch.dispose(); assert.equal(host.calls.resourcesDisposed, 1);
});


test('uniform inverse opt-in is owned before async construction; receipts are detached and immutable', async()=>{
 const host=coordinator();for(const observeInverse of [null,0,1,'true',{}])await assert.rejects(host.createGpuBatchStepper(host.device,[{},{}],{observeInverse}),/Boolean observeInverse/);assert.equal(host.calls.created,0);
 const options={observeInverse:true},pending=host.createGpuBatchStepper(host.device,[{source:1},{source:2,failAt:1}],options);options.observeInverse=false;const batch=await pending;
 assert.deepEqual(host.calls.worldOptions,[{observeInverse:true},{observeInverse:true}]);const initial=batch.snapshot();assert.notEqual(initial.slots[0].state.inverseObservation,initial.slots[1].state.inverseObservation);assert.throws(()=>{initial.slots[0].state.inverseObservation.cue.position.x=99;},TypeError);
 const out=await batch.step();assert.equal(out.slots[0].state.inverseObservation.sequence,1);assert.equal(out.slots[1].status,'failed');assert.deepEqual(out.slots[1].state.inverseObservation,initial.slots[1].state.inverseObservation);assert.equal(initial.slots[0].state.inverseObservation.sequence,0);
 const cancelled=await batch.cancel();assert.equal(cancelled.slots[0].state.inverseObservation.sequence,1);await batch.dispose();
 const off=await host.createGpuBatchStepper(host.device,[{},{}],{observeInverse:false});assert.ok(off.snapshot().slots.every(s=>!Object.hasOwn(s.state,'inverseObservation')));await off.dispose();
});

test('in-flight cancellation preserves only committed observation receipts',async()=>{
 const host=coordinator(),batch=await host.createGpuBatchStepper(host.device,[{source:1,hold:true},{source:2}],{observeInverse:true});const before=batch.snapshot(),pending=batch.step(),cancellation=batch.cancel();host.release();const out=await pending;await cancellation;
 for(const slot of out.slots){assert.equal(slot.state.inverseObservation.sequence,slot.state.frame);assert.ok(slot.state.frame===0||slot.state.frame===1);assert.ok(Object.isFrozen(slot.state.inverseObservation));}assert.deepEqual(out.slots[0].state,before.slots[0].state);await batch.dispose();
});

test('per-owner scoring stop requires committed idle boundary, preserves incomplete state and sibling progress',async()=>{
 const host=coordinator(),batch=await host.createGpuBatchStepper(host.device,[{source:1,hold:true},{source:2}],{observeInverse:true});
 const pending=batch.step();assert.throws(()=>batch.stopOwner('shot-0'),/idle boundary/);host.release();const first=await pending;
 assert.throws(()=>batch.stopOwner('missing'),/Unknown/);const stopped=batch.stopOwner('shot-0','scorer done');assert.equal(stopped.slots[0].status,'stopped');assert.equal(stopped.slots[0].state.shotComplete,false);assert.deepEqual(stopped.slots[0].state,first.slots[0].state);
 const next=await batch.step();assert.deepEqual(next.slots[0],stopped.slots[0]);assert.equal(next.slots[1].state.frame,2);assert.deepEqual(batch.stopOwner('shot-0').slots,next.slots);await batch.dispose();assert.throws(()=>batch.stopOwner('shot-1'),/idle boundary/);assert.equal(host.calls.disposed.filter(id=>id==='shot-0').length,1);
});
