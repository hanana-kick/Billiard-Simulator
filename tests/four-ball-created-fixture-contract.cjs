'use strict';
// Light tests: no Rapier initialization, native world, decoder, or GPU execution.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const F = require('./four-ball-created-fixture.cjs');

test('original source capture declares exactly one candidate initial boundary', () => {
  assert.deepEqual(F.BOUNDARIES, ['constructor', 'modeCreated', 'strikeCreated',
    'firstH.preWorld', 'firstH.postWorld', 'firstH.postApplication']);
  assert.deepEqual(F.SETTINGS, {angle: 0, elevation: 8, tipX: 0, tipY: 0, speed: 2});
  const source = fs.readFileSync(require.resolve('./four-ball-created-fixture.cjs'), 'utf8');
  assert.match(source, /c = new LabController\(\); c.lab = new PhysicsLab\(R\);/);
  assert.match(source, /c.state.gameMode = 'four'; c.setupGame\(\);/);
  assert.match(source, /assert.equal\(c.fire\(\), true\)/);
  assert.doesNotMatch(source, /captureOriginalCreation|\.restoreSnapshot\(|preparedNativeMass|\.flatBalls\(/);
  assert.equal(F.SOURCES.includes('src/controller.js'), true);
  assert.equal(F.SOURCES.includes('src/game-rules.js'), true);
});

test('read-only observation preserves exact this, argument references, return, and descriptor', () => {
  const argument = {original: true}, result = {original: true}, observations = [];
  const object = {method(arg) { assert.equal(this, object); assert.equal(arg, argument); return result; }};
  const descriptor = Object.getOwnPropertyDescriptor(object, 'method');
  const restore = F.observeMethod(object, 'method', {
    before(receiver, args) { observations.push(['before', receiver, args[0]]); return 'token'; },
    after(receiver, args, value, token) { observations.push(['after', receiver, args[0], value, token]); }
  });
  assert.equal(object.method(argument), result);
  assert.deepEqual(observations, [['before', object, argument], ['after', object, argument, result, 'token']]);
  restore(); assert.deepEqual(Object.getOwnPropertyDescriptor(object, 'method'), descriptor);
});

test('observer forwards original failures and deletes an inherited-method shadow', () => {
  const failure = new Error('unchanged native error'); let after = false;
  const prototype = {method() { throw failure; }}, object = Object.create(prototype);
  const restore = F.observeMethod(object, 'method', {after() { after = true; }});
  assert.throws(() => object.method(), error => error === failure); assert.equal(after, false);
  restore(); assert.equal(Object.hasOwn(object, 'method'), false); assert.equal(object.method, prototype.method);
});

test('exact source projection preserves float sign bits and handle generations', () => {
  const negativeZero = F.plain({kind: 'float', width: 'f32', bits: '80000000'});
  assert.equal(Object.is(negativeZero, -0), true);
  assert.equal(F.plain({kind: 'integer', width: 'u128', value: '170141183460469231731687303715884105728'}), 1n << 127n);
  assert.equal(F.plain({kind: 'integer', width: 'u32', value: '4294967295'}), 4294967295);
  assert.deepEqual(F.parts(0), {index: 0, generation: 0});
  const bytes = new DataView(new ArrayBuffer(8)); bytes.setUint32(0, 19, true); bytes.setUint32(4, 7, true);
  assert.deepEqual(F.parts(bytes.getFloat64(0, true)), {index: 19, generation: 7});
});

test('loading is explicit and never captures a missing native fixture', () => {
  assert.throws(() => F.loadArtifact(), /Explicit existing absolute oracle path/);
  assert.throws(() => F.loadArtifact('relative.v8'), /Explicit existing absolute oracle path/);
  assert.throws(() => F.loadArtifact('/tmp/billiard-four-ball-deliberately-absent-fixture.v8'), /ENOENT/);
});

test('exact journal content hash is canonical across V8 reload and property layout', () => {
  const v8 = require('node:v8');
  const input = [{method: 'createCollider', label: '적구 2', result: undefined,
    args: [{z: -0, a: 1n << 127n, nan: NaN, infinity: Infinity, array: [false, null, undefined, .64]}]}];
  assert.equal(F.journalDigest(input), F.journalDigest(v8.deserialize(v8.serialize(input))));
  assert.equal(F.journalDigest({a: 1, b: 2}), F.journalDigest({b: 2, a: 1}));
  assert.notEqual(F.journalDigest([-0]), F.journalDigest([0]));
  assert.notEqual(F.journalDigest([undefined]), F.journalDigest([null]));
});

test('journal descriptor type tags and native integer widths survive canonical hashing', () => {
  const v8 = require('node:v8');
  // The capture's argument recorder stores original typed arrays explicitly as
  // {kind: constructor.name, values}, retaining width as well as numeric bits.
  const geometry = {kind: 'Float32Array', values: Array.from(Float32Array.of(.64, -0, Infinity))};
  const nativeInteger = {kind: 'integer', width: 'u128', value: '170141183460469231731687303715884105728'};
  const journal = [{args: [geometry, nativeInteger]}];
  assert.equal(F.journalDigest(journal), F.journalDigest(v8.deserialize(v8.serialize(journal))));
  assert.notEqual(F.journalDigest(geometry), F.journalDigest({...geometry, kind: 'Float64Array'}));
  assert.notEqual(F.journalDigest(nativeInteger), F.journalDigest({...nativeInteger, width: 'i128'}));
  assert.notEqual(F.journalDigest([Infinity]), F.journalDigest([-Infinity]));
  assert.notEqual(F.journalDigest([NaN]), F.journalDigest([Infinity]));
});
