'use strict';
// Representation/ownership tests only. Synthetic disconnected registries do not
// assert native or GPU physics parity. Freezing happens only inside this probe.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Authority = require('../src/experimental-ccd-pass-authority');
const { seed, at, copy, pair } = require('./contact-graph-bounded-fixture.cjs');
const { observedJournal, deepFreeze } = require('./contact-graph-journal-sharing-probe.cjs');
const backend = 'cpu-reference';
const timing = { dt: .125, minCcdDt: 0, maxCcdSubsteps: 4 };
const first = { firstImpact: 0, selection: { dt: .03125, remainingTime: .09375, remainingSubsteps: 3 } };
const last = { firstImpact: null, selection: { dt: .09375, remainingTime: 0, remainingSubsteps: 0 } };
async function seal(j, t, poses, transitions = []) {
  const { receipt } = await j.prepare(poses, t);
  j.narrowTransitions(transitions, t);
  await j.postSolve(poses, t);
  j.assertPrepared(t);
  return receipt;
}
function checkCursors(j, t, expected, currentSequence) {
  for (let cursor = 0; cursor <= currentSequence; cursor++) {
    const actual = j.receiptsSince(cursor, t), suffix = expected.slice(cursor);
    assert.deepEqual(actual, suffix, `ordered suffix at ${cursor}`);
    actual.forEach((receipt, i) => assert.equal(receipt, suffix[i], 'original receipt identity'));
    actual.length = 0;
    assert.deepEqual(j.receiptsSince(cursor, t), suffix, 'result array is caller-owned');
  }
  assert.deepEqual(j.receiptsSince(-0, t), expected);
  for (const cursor of [-1, .5, NaN, Infinity, -Infinity, '0', null, undefined, {}, 0n, Number.MAX_SAFE_INTEGER + 1, currentSequence + 1]) {
    assert.throws(() => j.receiptsSince(cursor, t), /Invalid graph transaction cursor/);
  }
  assert.throws(() => j.receiptsSince(0, {}), /private scene ownership/);
}

for (const count of [3, 4]) test(`N=${count} completed versions share identity without leaking mutable state`, async () => {
  const { J, instances } = observedJournal(), s = seed(count), j = J.createReferenceStage(s), t = {};
  const probe = instances[0], initial = deepFreeze(probe.state().current), initialValue = copy(initial);
  j.claim(t);
  try {
    const initialProjection = j.createProjection(t), near = at(s, { 1: .15 }), e = pair(s, 0, 1);
    s.adjacency[0].collider.index = 999;
    assert.deepEqual(j.snapshot(), initialValue, 'constructor isolates the input registry');
    const prepared = await j.prepare(near, t), r = probe.receipt(prepared.receipt);
    assert.equal(r.before, initial);
    assert.notEqual(r.after, probe.state().pending.d, 'broad publication is an isolated version');
    const broad = deepFreeze(r.after), broadValue = copy(broad);
    prepared.graph.edges[0].active = true;
    prepared.graph.adjacency.length = 0;
    prepared.graph.proxies[0].min[0] = 999;
    prepared.broadPhaseEvents[0].collider1.index = 999;
    const broadView = J.viewReceipt(prepared.receipt);
    broadView.before.liveColliders.length = 0;
    broadView.after.edges[0].collider1.index = 999;
    broadView.changes.length = 0;
    assert.deepEqual(r.after, broadValue, 'returned prepare and receipt views cannot alter private versions');
    j.narrowTransitions([{ ...e, active: true }], t);
    assert.deepEqual(broad, broadValue, 'narrow changes do not edit the published broad version');
    const narrow = deepFreeze(r.after), narrowValue = copy(narrow);
    const solved = await j.postSolve(near, t);
    assert.deepEqual(narrow, narrowValue, 'post-solve does not edit the published narrow version');
    solved.edges.length = 0;
    const completed = deepFreeze(r.after), completedValue = copy(completed), mutableDraft = probe.state().pending.d;
    assert.notEqual(completed, mutableDraft);
    j.commit(t);
    assert.equal(probe.state().current, completed, 'commit adopts the sealed after, not its mutable draft');
    const committedView = J.viewReceipt(prepared.receipt), projected = J.projectReceipts([prepared.receipt], initialProjection, backend);
    projected.state.edges.length = 0;
    const snapshot = j.snapshot(), working = j.workingSnapshot(t), projectionView = J.projectionSnapshot(projected.projection);
    for (const view of [snapshot, working, projectionView]) { view.edges.length = 0; view.proxies[0].min[0] = 999; }
    assert.deepEqual(j.snapshot(), completedValue);
    const removed = await j.prepare(at(seed(count), {}), t), removedRecord = probe.receipt(removed.receipt);
    assert.equal(removedRecord.before, completed, 'next receipt reuses the completed predecessor');
    assert.equal(removed.broadPhaseEvents[0].kind, 'DeletePair');
    assert.deepEqual(J.viewReceipt(prepared.receipt), committedView, 'later dense removal preserves the earlier receipt');
    j.narrowTransitions([], t);
    await j.postSolve(at(seed(count), {}), t);
    j.abort(t);
    assert.equal(probe.state().current, completed, 'ordinary abort keeps the same committed version');
    assert.throws(() => J.viewReceipt(removed.receipt), /source-generated/);
    const retry = await seal(j, t, at(seed(count), {}));
    assert.notEqual(retry, removed.receipt);
    assert.equal(probe.receipt(retry).before, completed);
    deepFreeze(probe.receipt(retry).after);
    j.commit(t);
    assert.deepEqual(J.viewReceipt(prepared.receipt), committedView);
    checkCursors(j, t, [prepared.receipt, retry], 2);
    assert.deepEqual(J.projectReceipts(j.receiptsSince(0, t), initialProjection, backend).state, j.snapshot());
  } finally { j.abort(t); j.release(t); j.dispose(); }
});

test('indexed cursors preserve all boundaries, staged CCD rollback, retry, and old history', async () => {
  const { J, instances } = observedJournal(), s = seed(), j = J.createReferenceStage(s), a = Authority.createAuthority(backend), t = {};
  const probe = instances[0], committed = [];
  j.claim(t); a.claim(t);
  try {
    const initial = j.createProjection(t);
    checkCursors(j, t, committed, 0);
    for (let i = 1; i <= 10; i++) {
      const r = await seal(j, t, at(s, { 0: -i }));
      deepFreeze(probe.receipt(r).after);
      j.commit(t); committed.push(r);
    }
    const before = probe.state().current, oldViews = committed.map(r => J.viewReceipt(r));
    const cap = a.beginOuter(timing, t); j.beginOuter(cap, t);
    assert.equal(probe.state().outer.before, before, 'outer rollback holds the immutable version, not a duplicate');
    const one = await j.prepare(at(s, { 0: -11 }), t);
    assert.equal(probe.receipt(one.receipt).before, before);
    assert.throws(() => j.receiptsSince(0, t), /Only sealed/);
    assert.throws(() => j.receiptsSince(11, t), /Invalid graph transaction cursor/, 'cursor validation precedes pending phase rejection');
    j.narrowTransitions([], t);
    assert.throws(() => j.receiptsSince(10, t), /Only sealed/);
    await j.postSolve(at(s, { 0: -11 }), t);
    checkCursors(j, t, [...committed, one.receipt], 10);
    const projectedOne = J.projectReceipts(j.receiptsSince(0, t), initial, backend).projection;
    const pass = a.selectPass(first, t), sealedOne = deepFreeze(probe.receipt(one.receipt).after);
    j.advanceInternalPass(pass, t); a.advanceInternalPass(pass, t);
    assert.equal(probe.state().current, sealedOne, 'internal CCD advance adopts the sealed version');
    checkCursors(j, t, [...committed, one.receipt], 11);
    assert.deepEqual(j.snapshot(), before, 'staged graph is not publicly committed');
    const two = await seal(j, t, at(s, { 0: -12 }));
    assert.equal(probe.receipt(two).before, sealedOne);
    const projectedTwo = J.projectReceipts([two], projectedOne, backend).projection;
    checkCursors(j, t, [...committed, one.receipt, two], 11);
    a.selectPass(last, t);
    j.abort(t); a.abort(t);
    assert.equal(probe.state().current, before, 'outer abort restores the exact immutable version');
    checkCursors(j, t, committed, 10);
    for (const r of [one.receipt, two]) assert.throws(() => J.viewReceipt(r), /source-generated/);
    for (const p of [projectedOne, projectedTwo]) assert.throws(() => J.projectionSnapshot(p), /origin-bound/);
    committed.forEach((r, i) => assert.deepEqual(J.viewReceipt(r), oldViews[i]));
    const retryCap = a.beginOuter(timing, t); j.beginOuter(retryCap, t);
    const retryOne = await seal(j, t, at(s, { 0: -11 }));
    assert.notEqual(retryOne, one.receipt);
    assert.equal(probe.receipt(retryOne).before, before);
    const retryPass = a.selectPass(first, t);
    deepFreeze(probe.receipt(retryOne).after);
    j.advanceInternalPass(retryPass, t); a.advanceInternalPass(retryPass, t);
    const retryTwo = await seal(j, t, at(s, { 0: -12 })), retryFinal = a.selectPass(last, t);
    const finalVersion = deepFreeze(probe.receipt(retryTwo).after);
    j.commitOuter(retryFinal, t); a.commit(retryFinal, t);
    assert.equal(probe.state().current, finalVersion, 'outer commit adopts the final sealed version');
    committed.push(retryOne, retryTwo);
    checkCursors(j, t, committed, 12);
    assert.deepEqual(J.projectReceipts(j.receiptsSince(0, t), initial, backend).state, j.snapshot());
    const fresh = await seal(j, t, at(s, { 0: -13 }));
    assert.equal(probe.receipt(fresh).before, finalVersion);
    j.commit(t); committed.push(fresh);
    checkCursors(j, t, committed, 13);
    const finalSnapshot = j.snapshot(), views = committed.map(r => J.viewReceipt(r));
    j.release(t); j.dispose();
    assert.equal(probe.state().history.length, 0, 'disposal releases every owned receipt root');
    assert.equal(probe.state().identity.head, null);
    assert.deepEqual(j.snapshot(), finalSnapshot);
    committed.forEach((r, i) => assert.deepEqual(J.viewReceipt(r), views[i], 'external old receipts stay inspectable after disposal'));
    assert.throws(() => j.receiptsSince(0, t), /private scene ownership/);
    assert.throws(() => J.projectionSnapshot(initial), /origin-bound/);
    j.dispose();
  } finally {
    if (probe.state().identity.disposed !== true) { j.abort(t); j.release(t); j.dispose(); }
    a.abort(t); a.release(t); a.dispose();
  }
});

test('all four CCD pass positions and pending phases restore immutable committed authority on abort', async () => {
  for (let staged = 0; staged < 4; staged++) for (const phase of ['none', 'broad', 'narrow', 'complete']) {
    const { J, instances } = observedJournal(), s = seed(), j = J.createReferenceStage(s), a = Authority.createAuthority(backend), t = {};
    const probe = instances[0], stagedReceipts = [], projections = [];
    j.claim(t); a.claim(t);
    try {
      const committed = await seal(j, t, at(s, { 0: -1 })); j.commit(t);
      const before = deepFreeze(probe.state().current), oldView = J.viewReceipt(committed);
      let projection = j.createProjection(t);
      const cap = a.beginOuter(timing, t); j.beginOuter(cap, t);
      for (let i = 0; i < staged; i++) {
        const receipt = await seal(j, t, at(s, { 0: -2 - i }));
        stagedReceipts.push(receipt);
        projection = J.projectReceipts([receipt], projection, backend).projection; projections.push(projection);
        const pass = a.selectPass({ firstImpact: 0, selection: { dt: .03125, remainingTime: .125 - .03125 * (i + 1), remainingSubsteps: 3 - i } }, t);
        deepFreeze(probe.receipt(receipt).after);
        j.advanceInternalPass(pass, t); a.advanceInternalPass(pass, t);
      }
      if (phase !== 'none') {
        const poses = at(s, { 0: -2 - staged }), { receipt } = await j.prepare(poses, t);
        stagedReceipts.push(receipt);
        if (phase !== 'broad') j.narrowTransitions([], t);
        if (phase === 'complete') {
          await j.postSolve(poses, t);
          projection = J.projectReceipts([receipt], projection, backend).projection; projections.push(projection);
          a.selectPass({ firstImpact: null, selection: { dt: .125 - .03125 * staged, remainingTime: 0, remainingSubsteps: 0 } }, t);
        } else assert.throws(() => j.receiptsSince(0, t), /Only sealed/);
      }
      assert.deepEqual(j.snapshot(), before);
      j.abort(t); a.abort(t);
      assert.equal(probe.state().current, before, `restore pass ${staged}, phase ${phase}`);
      assert.equal(probe.state().identity.head, committed);
      assert.deepEqual(J.viewReceipt(committed), oldView);
      assert.deepEqual(j.receiptsSince(0, t), [committed]);
      assert.deepEqual(j.receiptsSince(1, t), []);
      assert.throws(() => j.receiptsSince(2, t), /Invalid graph transaction cursor/);
      for (const receipt of stagedReceipts) assert.throws(() => J.viewReceipt(receipt), /source-generated/);
      for (const p of projections) assert.throws(() => J.projectionSnapshot(p), /origin-bound/);
      const retry = await seal(j, t, at(s, { 0: -2 }));
      assert.equal(probe.receipt(retry).before, before);
      assert.equal(J.viewReceipt(retry).fromSequence, 1);
      j.commit(t);
      assert.deepEqual(j.receiptsSince(0, t), [committed, retry]);
    } finally { j.abort(t); a.abort(t); j.release(t); a.release(t); j.dispose(); a.dispose(); }
  }
});

test('first-cloth commit removes the pending marker before adopting its completed version', async () => {
  // Isolate commit bookkeeping via the private probe, not the public birth
  // admission contract. Genuine branded cloth geometry remains covered by the
  // existing original-artifact cloth-binding integration test.
  const s = seed(), e = { ...pair(s, 0, 1), active: true };
  s.edges = [e];
  s.adjacency.find(a => a.collider.index === e.collider1.index).outgoing = [0];
  s.adjacency.find(a => a.collider.index === e.collider2.index).incoming = [0];
  const birthView = { initialSnapshotSha256: null, body: e.body2, primary: e.collider2, clothCollider: e.collider1,
    graph: { edgeId: 0, lifetime: 1 }, state: { topology: { active: true } } };
  const { J, instances } = observedJournal(undefined, {
    require: name => name === './experimental-four-ball-cloth-birth'
      ? { assertBoundGeometryReceipt: () => copy(birthView) } : undefined
  });
  const j = J.createReferenceStage(s), t = {}, probe = instances[0]; j.claim(t);
  try {
    const initial = probe.state().current;
    initial.pendingCollisionBirth = { ...copy(birthView), scope: 'test-only-commit-bookkeeping' };
    probe.state().identity.pendingFourthClothBirth = copy(initial.pendingCollisionBirth);
    deepFreeze(initial);
    const firstReceipt = await seal(j, t, at(s, { 1: .15 })), firstRecord = probe.receipt(firstReceipt);
    firstRecord.clothBirthReceipt = Object.freeze({ kind: 'test-only-geometry' });
    const publishedBeforeCommit = deepFreeze(firstRecord.after);
    assert.ok(publishedBeforeCommit.pendingCollisionBirth);
    j.abort(t);
    assert.equal(probe.state().current, initial);
    assert.ok(probe.state().identity.pendingFourthClothBirth, 'abort does not claim a cloth birth');
    assert.throws(() => J.viewReceipt(firstReceipt), /source-generated/);
    const retry = await seal(j, t, at(s, { 1: .15 })), r = probe.receipt(retry);
    r.clothBirthReceipt = Object.freeze({ kind: 'test-only-geometry-retry' });
    const sealedWithMarker = deepFreeze(r.after);
    j.commit(t);
    assert.equal(probe.state().current, r.after);
    assert.notEqual(r.after, sealedWithMarker, 'commit publishes the marker removal before sharing');
    assert.equal(Object.hasOwn(r.after, 'pendingCollisionBirth'), false);
    assert.equal(probe.state().identity.pendingFourthClothBirth, null);
    assert.ok(sealedWithMarker.pendingCollisionBirth, 'previously published sealed graph remains untouched');
    assert.ok(r.before.pendingCollisionBirth, 'the immutable original before remains untouched');
    assert.equal(r.before, initial);
    const committed = deepFreeze(r.after), next = await seal(j, t, at(s, { 1: .15 }));
    assert.equal(probe.receipt(next).before, committed);
    assert.equal(Object.hasOwn(probe.receipt(next).before, 'pendingCollisionBirth'), false);
    j.commit(t);
  } finally { j.abort(t); j.release(t); j.dispose(); }
});
