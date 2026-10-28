// Bounded HOST replay/admission only: never generates expected states or dispatches.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {deserialize} from 'node:v8';import {join} from 'node:path';
import {assertScaleComparisonInput} from './resident-candidate-scale-world-comparison.mjs';
import {STATUS} from '../src/resident-candidate/abi.mjs';
import {scaleContract} from './resident-candidate-scale-native-contract.mjs';
const root=process.env.RESIDENT_SCALE_ARTIFACT_ROOT;assert.ok(root,'explicit frozen local artifacts required');
const sha=x=>createHash('sha256').update(x).digest('hex'),load=(path,expected)=>{const b=readFileSync(path);assert.equal(sha(b),expected);return deserialize(b);};
const pair=count=>{const c=scaleContract(count);return{runtime:load(join(root,'macro-scale-source-v1','count'+count,'runtime.v8'),c.runtimeSha256),expected:load(join(root,'macro-scale-original-expectations-v1','assertions-count'+count+'.v8'),c.expectedSha256)};};
const manifest=JSON.parse(readFileSync(join(root,'macro-scale-held-native-v1/count8-wgs1/actual-manifest.json'))),actual=load(join(root,'macro-scale-held-native-v1/count8-wgs1/actual.v8'),manifest.actualSha256),eight=pair(8),nine=pair(9),words=actual.captures[1].worldState;
test('historical strict-six gate remains pinned; all comparison body assertions unchanged',()=>{
 const old=readFileSync(new URL('./resident-candidate-raw-world-comparison.mjs',import.meta.url),'utf8'),current=readFileSync(new URL('./resident-candidate-scale-world-comparison.mjs',import.meta.url),'utf8');
 assert.match(old,/assert\.equal\(count,6,'same strict six raw rows'\)/);
 const body=s=>s.slice(s.indexOf('  const controls=[];'),s.indexOf('\n return{controls,')+s.slice(s.indexOf('\n return{controls,')).indexOf('\n}'));
 assert.equal(body(current),body(old),'identical per-row/control/all11/mismatch/tail checks; no tolerance changes');
});
test('exact frozen8 source/reference/entire actual row roster admitted; no parity claim from admission',()=>{
 const a=assertScaleComparisonInput({...eight,words});assert.equal(a.plan.count,8);assert.equal(a.fixture.results.length,8);assert.deepEqual(a.fixture.results.map(x=>x.row.id),scaleContract(8).orderedIds);
});
test('wrong count, cross-count reference, duplicate and missing expected rows fail closed',()=>{
 const check=(runtime,expected,w=words)=>assertScaleComparisonInput({runtime,expected,words:w});
 assert.throws(()=>check({...eight.runtime,original:{...eight.runtime.original,count:6}},eight.expected),/closed exact8\/9/);
 assert.throws(()=>check(eight.runtime,nine.expected));assert.throws(()=>check(nine.runtime,eight.expected));
 for(const x of[eight,nine]){assert.throws(()=>check(x.runtime,{...x.expected,results:x.expected.results.slice(0,-1)}),/missing\/extra expected/);const duplicate=[...x.expected.results];duplicate[duplicate.length-1]=duplicate[0];assert.throws(()=>check(x.runtime,{...x.expected,results:duplicate}),/every expected row/);}
 assert.throws(()=>check(eight.runtime,eight.expected,words.subarray(0,words.length-1)),/missing\/extra diagnostic/);
 const reclassified=eight.expected.results.map((x,i)=>i===6?{...x,status:STATUS.REJECTED}:x);assert.throws(()=>check(eight.runtime,{...eight.expected,results:reclassified}));
 assert.throws(()=>check({...eight.runtime,identity:{...eight.runtime.identity,sourceSha256:scaleContract(9).sourceSha256}},eight.expected),/count-specialized source/);
});
