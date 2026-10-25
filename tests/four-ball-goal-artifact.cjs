'use strict';
// SPDX-License-Identifier: Apache-2.0
// Read-only loader for frozen original evidence. Keep recorder bytes frozen.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const v8 = require('node:v8');
const F = require('./four-ball-goal-fixture.cjs');
const C = require('./four-ball-created-fixture.cjs');
function summaryJsonFields(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {assert.ok(Number.isFinite(value), 'Summary metadata numbers must be finite'); return value;}
  if (Array.isArray(value)) return value.map(item => {assert.notEqual(item, undefined, 'Undefined array element is not normalized'); return summaryJsonFields(item);});
  assert.equal(typeof value, 'object', 'Only JSON summary fields are normalized');
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)
    .map(([key, item]) => [key, summaryJsonFields(item)]));
}
function loadArtifact(file, {requireOutcome = true} = {}) {
  assert.ok(file && path.isAbsolute(file));
  const bytes = fs.readFileSync(file), manifest = JSON.parse(fs.readFileSync(file + '.json', 'utf8'));
  assert.deepEqual(manifest.identity, F.identity(), 'Frozen original source bytes remain exact');
  assert.equal(C.hash(bytes), manifest.sha256); assert.equal(bytes.length, manifest.bytes);
  const record = v8.deserialize(bytes); assert.equal(record.schema, F.SCHEMA);
  assert.equal(C.journalDigest(record.apiJournal), manifest.apiJournalSha256);
  // Native compliant-tip events have no a/b descriptors. The summary JSON drops
  // undefined object fields; compare its JSON representation, not invented nulls.
  // This only checks manifest metadata: raw V8 state and journal stay untouched.
  const summary = summaryJsonFields(F.summary(record));
  assert.deepEqual(summary, Object.fromEntries(Object.keys(summary).map(key => [key, manifest[key]])));
  if (!manifest.probe && record.control.fireAccepted)
    F.verifyRecord(record, {requireOutcome, decoded: manifest.decoded});
  else if (requireOutcome) {
    assert.equal(record.status, 'native-rest-complete'); assert.equal(record.requiredOutcomeObserved, true);
  }
  return {record, manifest};
}
function placementProvenance(record) {
  assert.equal(record.schema, F.SCHEMA); assert.equal(record.selectedId, 1);
  assert.ok(record.placements.every(p => p.method === 'LabController.move' && p.accepted));
  const journal = record.apiJournal.filter(row => row.phase === 'placement');
  const translations = journal.filter(row => row.method === 'setTranslation');
  assert.equal(translations.length, record.placements.length, 'Actual placement mutation journal is required, not probe inputs');
  for (let i = 0; i < translations.length; i++) {
    const row = translations[i], placement = record.placements[i];
    const object = record.boundaries.placementComplete.application.registry.objects.find(o => o.id === placement.id);
    assert.deepEqual(row.target, {kind: 'RigidBody', handle: object.body});
    assert.deepEqual(row.args, [{kind: 'descriptor', className: 'Object', fields: placement.position}, true]);
    assert.equal(row.nativeStepsBefore, 72); assert.equal(row.nativeStepsAfter, 72);
  }
  return {kind: 'original-controller-move-placement-provenance',
    placements: structuredClone(record.placements), placementApiJournalSha256: C.journalDigest(journal)};
}
module.exports = {summaryJsonFields, loadArtifact, placementProvenance};
