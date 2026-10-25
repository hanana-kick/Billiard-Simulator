// Host-only composition gates. These are not microcode execution/parity gates.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {composeWorldMicrocodeSource} from '../src/resident-candidate/world-microcode-source.mjs';
const archived=()=>{const bytes=readFileSync('/tmp/resident-raw-pc-isolated-native-v2/runtime.v8');assert.equal(createHash('sha256').update(bytes).digest('hex'),'4f2db833f116034d5ffe979b0d748418b4022f26c8906e0ed5cb13cf15b878dc');return deserialize(bytes).pc;};
const signature='@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>)';
const originalBody=code=>{const start=code.indexOf(signature)+signature.length,open=code.indexOf('{',start);let end=open+1,depth=1;for(;depth;end++){if(code[end]==='{')depth++;else if(code[end]==='}')depth--;}return code.slice(start,end);};
test('all authentic owner source closures compose as data with current-PC routing and fresh private invocation state',()=>{
  const pc=archived(),before=pc.pipelines.map(p=>p.code),m=composeWorldMicrocodeSource(pc);
  assert.equal(m.entries.length,16);assert.equal(m.sourceBytecode,pc.bytecode);assert.deepEqual(pc.pipelines.map(p=>p.code),before);
  assert.equal(m.privateGlobals.length,21);assert.match(m.code,/fn rc_micro_reset_private\(\)/);assert.match(m.code,/rc_ccd_pd_result=rc_ccd_pd_DistanceResult\(\);/);
  for(const row of m.entries){assert.equal(row.sourceCode,pc.pipelines[row.index].code);const old=originalBody(row.sourceCode);assert.ok(m.code.includes('fn '+row.entry+'(gid:vec3<u32>)'+old),'entire unchanged original owner body');for(const id of row.pipelineIds)assert.equal(m.route[id],row.index);}
  assert.ok(m.functions>800);assert.match(m.code,/switch originalPipeline/);assert.doesNotMatch(m.code,/@compute/);assert.equal(m.capability.nativeQualified,false);assert.equal(m.capability.sourceCapsUnchanged,true);
});
test('missing or duplicate explicit owner routes and changed entry ABI fail closed',()=>{
  const pc=archived();assert.throws(()=>composeWorldMicrocodeSource({...pc,pipelines:pc.pipelines.slice(1)}),/no declared owner/);
  const duplicate=structuredClone(pc);duplicate.pipelines[1].pipelineIds.push(duplicate.pipelines[0].pipelineIds[0]);assert.throws(()=>composeWorldMicrocodeSource(duplicate),/exactly one/);
  const changed=structuredClone(pc);changed.pipelines[0].code=changed.pipelines[0].code.replace('@workgroup_size(1)','@workgroup_size(2)');assert.throws(()=>composeWorldMicrocodeSource(changed),/single-gid/);
});
