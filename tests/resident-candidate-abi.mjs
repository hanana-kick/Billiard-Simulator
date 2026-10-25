import test from 'node:test';
import assert from 'node:assert/strict';
import {packCandidates, unpackCandidates, initialResults, decodeResults, STATUS, REASON, UNSET, INPUT_WORDS} from '../src/resident-candidate/abi.mjs';
const settings = {angle: 0, elevation: 8, speed: 2, tipX: 0, tipY: 0};
test('five raw binary64 controls survive without f32 conversion, quantization, or wrapping', () => {
  const source = {...settings, angle: 360.00000000000006, speed: 2.0000000000000004, tipX: -0, tipY: Number.MIN_VALUE};
  const rows = [{id: 3, settings: source}], packed = packCandidates(rows, {selectedIndex: 2});
  assert.equal(packed.byteLength, 64); source.speed = 4;
  const out = unpackCandidates(packed)[0]; assert.equal(out.settings.speed, 2.0000000000000004);
  assert.ok(Object.is(out.settings.tipX, -0)); assert.equal(out.settings.angle, 360.00000000000006); assert.equal(out.settings.tipY, Number.MIN_VALUE);
  assert.equal(out.selectedIndex, 2);
});
test('1024 and 4096 arbitrary candidate rows preserve identities and compact result sizes', () => {
  for (const count of [1024,4096]) {
    const input = packCandidates(Array.from({length:count},(_,id)=>({id,settings:{...settings,angle:id/37}})), {selectedIndex:0});
    const result = initialResults(input); assert.equal(input.length,count*INPUT_WORDS); assert.equal(result.byteLength,count*16);
    const pending=decodeResults(result,Array.from({length:count},(_,i)=>i),{allowPending:true}); assert.ok(pending.every(r=>r.pass===null));
    assert.throws(()=>decodeResults(result,pending.map(r=>r.id)), /Incomplete/);
  }
});
test('unsupported, incomplete, rejected, cancelled and failed are never false', () => {
  for(const status of [STATUS.UNSUPPORTED,STATUS.INCOMPLETE,STATUS.REJECTED,STATUS.CANCELLED,STATUS.FAILED]) {
    const row=Uint32Array.of(7,status,UNSET,REASON.PHYSICS_SCOPE);
    assert.equal(decodeResults(row,[7])[0].pass,null); row[2]=0;
    assert.throws(()=>decodeResults(row,[7]),/masquerade/);
  }
  assert.equal(decodeResults(Uint32Array.of(7,STATUS.PASS,1,0),[7])[0].pass,true);
  assert.equal(decodeResults(Uint32Array.of(7,STATUS.MISS,0,0),[7])[0].pass,false);
});
test('numeric rejection is owned by GPU rather than silently changing supplied parameters', () => {
  const input=packCandidates([{id:0,settings:{...settings,speed:Infinity,tipX:NaN}}],{selectedIndex:0});
  const out=unpackCandidates(input)[0]; assert.equal(out.settings.speed,Infinity); assert.ok(Number.isNaN(out.settings.tipX));
});
test('bounded created-cue continuation is an explicit unsupported profile, not a horizon miss',()=>{
  const row=decodeResults(Uint32Array.of(7,STATUS.UNSUPPORTED,UNSET,REASON.CUE_CONTINUATION_PROFILE),[7])[0];
  assert.equal(row.status,'unsupported');assert.equal(row.pass,null);assert.equal(row.reasonCode,12);
  assert.notEqual(REASON.CUE_CONTINUATION_PROFILE,REASON.HORIZON);
});
test('ownership and record guards reject ambiguity', () => {
  assert.throws(()=>packCandidates([{id:0,settings},{id:0,settings}],{selectedIndex:0}),/Distinct/);
  assert.throws(()=>packCandidates([{id:0,settings}],{selectedIndex:4}),/selection/);
  assert.throws(()=>packCandidates([{id:0,settings:{...settings,extra:1}}],{selectedIndex:0}),/exactly/);
  assert.throws(()=>decodeResults(Uint32Array.of(0,STATUS.PASS,1,0),[1]),/identity/);
  const getter={...settings};Object.defineProperty(getter,'angle',{get(){throw Error('getter must not run');},enumerable:true});
  assert.throws(()=>packCandidates([{id:0,settings:getter}],{selectedIndex:0}),/exactly/);
});
