'use strict';
// Disposal/ownership tests only, using the existing synthetic bounded fixture.
// This neither measures heap bytes/GC nor establishes native/GPU physics parity.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const publicJournal = require('../src/experimental-contact-graph-journal');
const { seed, at } = require('./contact-graph-bounded-fixture.cjs');
const backend = 'cpu-reference';

function observedJournal(disposeError = null) {
  const file = require.resolve('../src/experimental-contact-graph-journal');
  const source = fs.readFileSync(file, 'utf8');
  const anchor = 'return Object.freeze(api);}';
  assert.equal(source.split(anchor).length, 2, 'one private controller return');
  const instances = [], m = new Module(file, module), read = Module.createRequire(file);
  // This callback is injected only into this test's separately compiled module.
  // Production gains no exports, counters, mutation hooks or public authority.
  m.require = name => name === 'test-only:journal-disposal-probe'
    ? (readState, math) => {
      const observed = { readState, disposalCalls: 0 }, dispose = math.dispose.bind(math);
      math.dispose = () => {
        observed.disposalCalls++;
        if (disposeError) throw disposeError;
        return dispose();
      };
      instances.push(observed);
    }
    : read(name);
  const probe = `__journalDisposalProbe(() => ({
    history:history.slice(), head:identity.head, pendingReceipt:pending?.receipt??null,
    pendingPhase:pending?.phase??null, pendingGraph:pending?copy(pending.d):null,
    lease, busy, disposed, identityDisposed:identity.disposed,
    sequence:identity.sequence, current:copy(current)
  }), math);`;
  m._compile("const __journalDisposalProbe=require('test-only:journal-disposal-probe');\n" + source.replace(anchor, probe + anchor), file);
  assert.deepEqual(Object.keys(m.exports), Object.keys(publicJournal), 'no public diagnostic API');
  assert.equal(Object.isFrozen(m.exports), true);
  return { J: m.exports, instances };
}

async function seal(journal, token, poses) {
  const result = await journal.prepare(poses, token);
  journal.narrowTransitions([], token);
  await journal.postSolve(poses, token);
  journal.assertPrepared(token);
  return result.receipt;
}

function assertDisposedAuthority(J, journal, token, projections, receipts) {
  for (const projection of projections) {
    for (const read of [J.projectionSnapshot, J.assertProjectionCurrent, J.assertProjectionHead, J.captureTransaction]) {
      assert.throws(() => read(projection, backend), /origin-bound/);
    }
    assert.throws(() => J.assertTransaction(receipts.at(-1), projection, backend), /origin-bound/);
    if (receipts.length) assert.throws(() => J.projectReceipts(receipts, projection, backend), /origin-bound/);
  }
  assert.throws(() => journal.claim({}), /ownership unavailable/);
  for (const action of [
    () => journal.release(token),
    () => journal.createProjection(token),
    () => journal.receiptsSince(0, token),
    () => journal.narrowTransitions([], token),
    () => journal.assertPrepared(token),
    () => journal.commit(token),
    () => journal.abort(token)
  ]) assert.throws(action, /private scene ownership/);
}

for (const count of [3, 4]) {
  test(`N=${count} disposal releases owned receipt roots without erasing caller inspection or latest snapshot`, async () => {
    const { J, instances } = observedJournal(), s = seed(count), journal = J.createReferenceStage(s), token = {};
    const observed = instances[0];
    journal.claim(token);
    const initial = journal.createProjection(token), committed = [];
    for (let frame = 1; frame <= 12; frame++) {
      committed.push(await seal(journal, token, at(s, { 0: -frame / 4 })));
      journal.commit(token);
      assert.equal(observed.readState().history.length, frame, 'live no-op history is not capped');
    }
    const latest = journal.snapshot(), views = committed.map(receipt => J.viewReceipt(receipt, backend));
    assert.equal(latest.sequence, 12);
    assert.equal(latest.revision, 0, 'proxy-only changes still need every historical receipt');
    assert.deepEqual(journal.receiptsSince(0, token), committed);
    assert.deepEqual(journal.receiptsSince(4, token), committed.slice(4));
    const caughtUp = J.projectReceipts(journal.receiptsSince(0, token), initial, backend);
    assert.deepEqual(caughtUp.state, latest, 'oldest cursor still catches up while live');
    J.assertProjectionCurrent(caughtUp.projection, backend);
    const prior = observed.readState();
    assert.deepEqual(prior.history, committed);
    assert.equal(prior.head, committed.at(-1));
    assert.equal(prior.pendingReceipt, null);
    assert.equal(observed.disposalCalls, 0);

    journal.release(token);
    journal.dispose();
    const disposed = observed.readState();
    assert.deepEqual(disposed.history, [], 'journal no longer roots committed receipt keys');
    assert.equal(disposed.head, null, 'origin identity no longer roots the latest receipt key');
    assert.equal(disposed.pendingReceipt, null);
    assert.equal(disposed.disposed, true);
    assert.equal(disposed.identityDisposed, true);
    assert.equal(disposed.lease, null);
    assert.equal(disposed.busy, false);
    assert.equal(disposed.sequence, 12);
    assert.deepEqual(journal.snapshot(), latest);
    const copy = journal.snapshot();
    copy.proxies[0].min[0] = 12345;
    copy.liveColliders.length = 0;
    assert.deepEqual(journal.snapshot(), latest, 'disposed snapshot remains an isolated copy');
    committed.forEach((receipt, i) => assert.deepEqual(J.viewReceipt(receipt, backend), views[i], 'external committed receipt stays inspectable'));
    assert.throws(() => J.viewReceipt(structuredClone(committed[0]), backend), /source-generated/);
    assertDisposedAuthority(J, journal, token, [initial, caughtUp.projection], committed);
    await assert.rejects(() => journal.prepare(at(s, {}), token), /private scene ownership/);
    await assert.rejects(() => journal.postSolve(at(s, {}), token), /private scene ownership/);
    journal.dispose();
    assert.equal(observed.disposalCalls, 1, 'successful disposal is idempotent');
    assert.deepEqual(observed.readState(), disposed);
  });
}

test('leased, busy and pending disposal rejections preserve all journal state and live retry behavior', async () => {
  const { J, instances } = observedJournal(), s = seed(3), journal = J.createReferenceStage(s), token = {};
  const observed = instances[0];
  journal.claim(token);
  const initial = journal.createProjection(token), committed = await seal(journal, token, at(s, { 0: -1 }));
  journal.commit(token);
  const committedView = J.viewReceipt(committed, backend);
  const rejectUnchanged = () => {
    const before = observed.readState();
    assert.throws(() => journal.dispose(), /Release graph owner/);
    assert.deepEqual(observed.readState(), before);
    assert.deepEqual(J.viewReceipt(committed, backend), committedView);
    assert.equal(observed.disposalCalls, 0);
    assert.deepEqual(journal.receiptsSince(0, token).slice(0, 1), [committed]);
  };
  rejectUnchanged();
  const preparing = journal.prepare(at(s, { 0: -2 }), token);
  assert.equal(observed.readState().busy, true, 'async preparation has not returned');
  rejectUnchanged();
  const abandoned = (await preparing).receipt;
  const broadBefore = observed.readState();
  assert.throws(() => journal.dispose(), /Release graph owner/);
  assert.deepEqual(observed.readState(), broadBefore);
  assert.equal(J.viewReceipt(abandoned).phase, 'broad');
  assert.throws(() => journal.release(token), /Pending graph transaction/);
  journal.narrowTransitions([], token);
  await journal.postSolve(at(s, { 0: -2 }), token);
  const projected = J.projectReceipts(journal.receiptsSince(0, token), initial, backend).projection;
  rejectUnchanged();
  journal.abort(token);
  assert.throws(() => J.viewReceipt(abandoned), /source-generated/);
  assert.throws(() => J.projectionSnapshot(projected), /origin-bound/);
  assert.equal(observed.readState().head, committed, 'abort restores the previous committed head');
  assert.deepEqual(journal.receiptsSince(0, token), [committed]);
  const retry = await seal(journal, token, at(s, { 0: -2 }));
  assert.notEqual(retry, abandoned);
  journal.commit(token);
  const catchup = J.projectReceipts(journal.receiptsSince(0, token), initial, backend);
  assert.deepEqual(catchup.state, journal.snapshot(), 'rejected disposal never damages a later catch-up');
  journal.release(token);
  journal.dispose();
  assert.deepEqual(observed.readState().history, []);
  assert.equal(observed.readState().head, null);
  assert.equal(observed.disposalCalls, 1);
});

test('backend disposal failure preserves existing terminal/no-retry semantics and releases owned roots', async () => {
  const failure = new Error('test-only backend disposal failure');
  const { J, instances } = observedJournal(failure), s = seed(3), journal = J.createReferenceStage(s), token = {};
  const observed = instances[0];
  journal.claim(token);
  const initial = journal.createProjection(token), receipt = await seal(journal, token, at(s, { 0: -1 }));
  journal.commit(token);
  const latest = journal.snapshot(), view = J.viewReceipt(receipt);
  journal.release(token);
  assert.throws(() => journal.dispose(), error => error === failure);
  const disposed = observed.readState();
  assert.equal(disposed.disposed, true, 'as before, backend failure happens after the disposed flag');
  assert.equal(disposed.identityDisposed, true);
  assert.equal(disposed.pendingReceipt, null);
  assert.deepEqual(disposed.history, []);
  assert.equal(disposed.head, null);
  assert.deepEqual(journal.snapshot(), latest);
  assert.deepEqual(J.viewReceipt(receipt), view);
  assertDisposedAuthority(J, journal, token, [initial], [receipt]);
  journal.dispose();
  assert.equal(observed.disposalCalls, 1, 'as before, disposal is not retried after a backend throw');
  assert.deepEqual(observed.readState(), disposed);
});

test('never-used journal disposal preserves the initial snapshot and invalidates an empty projection', () => {
  const { J, instances } = observedJournal(), journal = J.createReferenceStage(seed(4)), token = {};
  const observed = instances[0], initial = journal.snapshot();
  journal.claim(token);
  const projection = journal.createProjection(token);
  journal.release(token);
  journal.dispose();
  journal.dispose();
  assert.deepEqual(observed.readState().history, []);
  assert.equal(observed.readState().head, null);
  assert.equal(observed.readState().pendingReceipt, null);
  assert.equal(observed.disposalCalls, 1);
  assert.deepEqual(journal.snapshot(), initial);
  assertDisposedAuthority(J, journal, token, [projection], []);
});
