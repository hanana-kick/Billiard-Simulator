/* SPDX-License-Identifier: Apache-2.0
 * HOST-only deterministic same-input diagnosis. This is not a captured h192
 * input, a native execution, or a full-world recurrence/parity qualification.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import Tip from '../src/experimental-cue-joint-tip-contact.js';
import Lateral from '../src/experimental-cue-lateral-compensated.js';
import {numberWords,wordsNumber} from '../src/resident-candidate/source-number.mjs';
import {compileCueLateralProgram,compileCueTipProgram,executeCueNumberForTest} from '../src/resident-candidate/cue.mjs';

const f=Math.fround,vec=a=>a.map(f),bits=a=>a.flatMap(x=>Array.from(numberWords(x)));
const numbers=(raw,at,n)=>Array.from({length:n},(_,i)=>wordsNumber(raw.subarray(at+i*2,at+i*2+2)));

// Existing admitted component fixture, not a manufactured successful shot.
function tipInput(){return {kind:'actual-cue-single-sphere-tip',phase:'post-lateral-prefix-pre-world-step',
  head:{position:vec([-.036,.03075,0]),worldCom:vec([-.036,.03075,0]),linear:vec([2,-.1,.3]),angular:vec([0,.01,.02]),invMass:Array(3).fill(f(1/.012)),invInertia:vec([1000,0,0,1000,0,1000])},
  ball:{position:vec([0,.03075,0]),worldCom:vec([0,.03075,0]),linear:vec([.1,.01,.02]),angular:vec([.03,.04,.05]),invMass:Array(3).fill(f(1/.21)),invInertia:vec([12590,0,0,12590,0,12590])},
  radius:.03075,tipRadius:.006,h:1/61440,normalStiffness:1e6,normalDamping:110,tangentStiffness:4e5,tangentDamping:10,friction:.7,tangent:[0,0,0],active:false,contacted:false};}
function tipNumbers(s){return [...['head','ball'].flatMap(k=>['position','worldCom','linear','angular','invMass','invInertia'].flatMap(q=>s[k][q])),...['radius','tipRadius','h','normalStiffness','normalDamping','tangentStiffness','tangentDamping','friction'].map(k=>s[k]),...s.tangent,+s.active,+s.contacted];}

test('double-single oracle already loses original input bits before any hypot/sqrt',()=>{
  const s=tipInput(),p=Tip.pack(s);
  for(const [name,i,sourceLow,packedLow] of [['tipRadius',1,3161095930,3161095928],['h',2,286331153,286331152],['friction',7,1717986918,1717986920]]){
    const original=numberWords(s[name]),reconstructed=numberWords(p[42+i]+p[60+i]);
    assert.equal(original[0],sourceLow,name+' original low word');
    assert.equal(reconstructed[0],packedLow,name+' compensated low word');
    assert.equal(original[1],reconstructed[1],name+' high word');
    assert.notDeepEqual(original,reconstructed,name+' is not binary64-preserving');
  }
});

test('identical tip input: original JS Number and resident binary64 agree; compensated oracle differs',()=>{
  const s=tipInput(),frozen=structuredClone(s),source=Tip.sourceReference(s),compensated=Tip.compensatedReference(s);
  const raw=executeCueNumberForTest(compileCueTipProgram(),tipNumbers(s),{testOnly:true});
  assert.deepEqual(s,frozen,'none of the three paths changes its input');
  assert.equal(raw[94],1,'source-number completion');
  assert.deepEqual(Array.from(raw.subarray(0,4)),[+source.touching,+source.birth,+source.removeCue,+source.sliding]);
  for(const [at,values]of [[4,source.tangent],[10,[source.normalForce]],[12,[source.compression]],[14,source.impulse],[20,source.point],[26,source.head.linear],[32,source.head.angular],[38,source.ball.linear],[44,source.ball.angular],[50,source.impulseF32],[56,source.pointF32]])
    assert.deepEqual(bits(numbers(raw,at,values.length)),bits(values),'exact original source output at '+at);
  assert.deepEqual(bits(source.tangent),[0,0,1789569707,1052612486,1861152495,3201500963]);
  assert.deepEqual(bits(compensated.tangent),[0,0,1789569696,1052612486,1861152512,3201500963]);
  assert.notDeepEqual(bits(compensated.tangent),bits(source.tangent));
  for(const k of ['touching','birth','removeCue','sliding'])assert.equal(compensated[k],source[k],k);
});

test('explicit lateral original reference is available and agrees with resident source-number output',()=>{
  const s={kind:'actual-cue-lateral-prefix',phase:'pre-world-step-pre-tip-contact',dynamicAwake:true,
    headPosition:vec([-.04,.04,.001]),shaftPosition:vec([-.04,.04,.001]),headCom:vec([-.04,.04,.001]),shaftCom:vec([-.7,.14,.002]),
    headLinear:vec([2,-.2,.02]),shaftLinear:vec([1.9,-.21,.01]),headAngular:vec([.2,-.1,.3]),shaftAngular:vec([.3,-.2,.1]),
    headInvMass:Array(3).fill(f(1/.012)),shaftInvMass:Array(3).fill(f(1/.528)),shaftInvInertia:vec([1,0,0,1000,0,1]),axis:[Math.cos(.15),-Math.sin(.15),0],h:1/61440,stiffness:1200,damping:1};
  const input=[...['headPosition','shaftPosition','headCom','shaftCom','headLinear','shaftLinear','headAngular','shaftAngular','headInvMass','shaftInvMass','shaftInvInertia','axis'].flatMap(k=>s[k]),s.h,s.stiffness,s.damping];
  const source=Lateral.sourceReference(s),raw=executeCueNumberForTest(compileCueLateralProgram(),input,{testOnly:true});
  assert.equal(raw[94],1);
  for(const [at,values]of [[0,source.head.linear],[6,source.head.angular],[12,source.shaft.linear],[18,source.shaft.angular],[24,source.impulse],[30,source.impulseF32],[36,source.shaft.torque],[42,source.headPointVelocity],[48,source.shaftPointVelocity],[54,source.lateral],[60,source.relativeLateral]])
    assert.deepEqual(bits(numbers(raw,at,values.length)),bits(values),'exact lateral output at '+at);
});
