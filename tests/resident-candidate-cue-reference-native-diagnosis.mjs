// Independent, exact HOST-only regression for the actual first tip episode.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import Tip from '../src/experimental-cue-joint-tip-contact.js';
import {numberWords,wordsNumber} from '../src/resident-candidate/source-number.mjs';
import {compileCueTipProgram,executeCueNumberForTest} from '../src/resident-candidate/cue.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/resident-cue-native-tip-number-diagnosis.json',import.meta.url),'utf8'));
const hash=x=>createHash('sha256').update(x).digest('hex'),bits=a=>a.flatMap(x=>Array.from(numberWords(x)));
const inputs=s=>[...['head','ball'].flatMap(k=>['position','worldCom','linear','angular','invMass','invInertia'].flatMap(q=>s[k][q])),...['radius','tipRadius','h','normalStiffness','normalDamping','tangentStiffness','tangentDamping','friction'].map(k=>s[k]),...s.tangent,+s.active,+s.contacted];
function verify(c){
 const p=compileCueTipProgram();let tangent=[0,0,0];const different=[];
 assert.deepEqual(c.records.map(r=>r.h),Array.from({length:28},(_,i)=>165+i));
 for(const row of c.records){
  const original=structuredClone(row.input),source=Tip.sourceReference(row.input),compensated=Tip.compensatedReference(row.input),raw=executeCueNumberForTest(p,inputs(row.input),{testOnly:true});
  assert.deepEqual(row.input,original,'input is observation only');assert.equal(raw[94],1);
  assert.deepEqual(Array.from(raw.subarray(0,4)),[+source.touching,+source.birth,+source.removeCue,+source.sliding]);
  for(const [at,values]of [[4,source.tangent],[10,[source.normalForce]],[12,[source.compression]],[14,source.impulse],[20,source.point],[26,source.head.linear],[32,source.head.angular],[38,source.ball.linear],[44,source.ball.angular],[50,source.impulseF32],[56,source.pointF32]]){
   const actual=Array.from({length:values.length},(_,i)=>wordsNumber(raw.subarray(at+i*2,at+i*2+2)));
   assert.deepEqual(bits(actual),bits(values),`h${row.h} exact source field${at}`);
  }
  assert.deepEqual(bits(source.tangent),bits(row.native.tangent),`h${row.h} unchanged PhysicsLab tangent`);
  assert.deepEqual(bits(source.point),bits(row.pointArgument),`h${row.h} original point before native f32 cast`);
  for(const role of ['head','ball'])for(const field of ['linear','angular'])assert.deepEqual(bits(source[role][field]),bits(row.native[role][field]),`h${row.h} native ${role}.${field}`);
  if(JSON.stringify(bits(compensated.tangent))!==JSON.stringify(bits(source.tangent)))different.push(row.h);
  // Causal oracle-only replay. Every body/coefficient value remains the actual
  // native observation; ONLY the deliberately approximate tangent recurs.
  tangent=Tip.compensatedReference({...row.input,tangent}).tangent;
 }
 assert.deepEqual(different,Array.from({length:28},(_,i)=>165+i));
 assert.deepEqual(bits(tangent),[3610802880,3208481677,2545628320,1060557805,3902929632,3209759694],'exact frozen legacy source-owner h192 tangent');
 assert.deepEqual(bits(c.records.at(-1).native.tangent),[3610802870,3208481677,2545628303,1060557805,3902929616,3209759694]);
 return true;
}
test('all28 genuine tip calls agree native/source/resident; DS tangent recurrence exactly explains legacy192 mismatch',()=>{
 assert.equal(hash(readFileSync(new URL('../src/physics.js',import.meta.url))),fixture.provenance.physicsSha256);
 assert.equal(fixture.provenance.createdSnapshotSha256,'feb6b6eea9a0d29236df73680e79d3cbedf84dee702f3dae0c1e80a33ef9c2ef');
 assert.equal(fixture.coverage.runtimeFutureInputs,false);assert.equal(verify(fixture),true);
});
test('fresh unchanged original native three-outer capture reproduces committed oracle-only inputs',
 {skip:process.env.RUN_RESIDENT_CUE_NUMBER_NATIVE_CAPTURE!=='1'},async()=>{
  const {captureOriginalTipInputs}=await import('./resident-candidate-cue-reference-native-capture.mjs');
  const fresh=await captureOriginalTipInputs();assert.deepEqual(fresh.provenance,fixture.provenance);assert.deepEqual(fresh.records,fixture.records);assert.equal(verify(fresh),true);
 });
