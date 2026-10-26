import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {deserialize} from 'node:v8';
import {MICROCODE_SOURCE_MACROS,sourceMacroNativeWGSL,approveSourceMacros} from '../src/resident-candidate/microcode-source-macros.mjs';
import {composeWorldMicrocodeSource} from '../src/resident-candidate/world-microcode-source.mjs';
import {parseMicrocodeWGSL} from '../src/resident-candidate/microcode-parser.mjs';
const bindings='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;';
test('selected macro signatures and entire source closures remain exact, without private globals',()=>{
 assert.deepEqual(MICROCODE_SOURCE_MACROS.map(x=>[x.id,x.name,x.parameterWords.length,x.resultWords]),[[0,'rc_cue_flat_advance',8,1],[1,'rc_num_eval',2,1],[2,'rc_world_broad_commit_collision',3,0]]);
 for(const spec of MICROCODE_SOURCE_MACROS){const native=sourceMacroNativeWGSL(spec.name),a=approveSourceMacros(bindings+native,{functionNames:[spec.name]}).entries[0];assert.equal(a.name,spec.name);assert.equal(a.id,spec.id);assert.ok(Object.keys(a.dependencies).length>=30);assert.match(a.closureSha256,/^[a-f0-9]{64}$/);assert.ok(!parseMicrocodeWGSL(native).globals.some(g=>g.storage==='private'));
  const changed=spec.resultWords===0?native.replace('rc_journal_prepare_bvh(j,v);','rc_journal_prepare_bvh(v,j);'):native.replace('let s=a[i]+b[i];','let s=a[i]-b[i];');assert.notEqual(changed,native);assert.throws(()=>approveSourceMacros(bindings+changed,{functionNames:[spec.name]}),/mismatch/);
 }
});
test('macro admission rejects source caps, scalar signatures, logical bindings and profile changes',()=>{
 const native=sourceMacroNativeWGSL('rc_cue_flat_advance'),code=bindings+native,names=['rc_cue_flat_advance'];
 for(const changed of[code.replace('instructionBudget>1000000u','instructionBudget>1000001u'),code.replace('otherCount:u32','otherCount:i32'),code.replace('RC_NUMERIC_IMPLEMENTATION_PROFILE:u32=2u','RC_NUMERIC_IMPLEMENTATION_PROFILE:u32=1u'),code.replace('var<storage,read_write> rc_state','var<storage,read> rc_state')]){assert.notEqual(changed,code);assert.throws(()=>approveSourceMacros(changed,{functionNames:names}));}
 assert.throws(()=>approveSourceMacros(code,{functionNames:names,storageBindings:{rc_state:3,rc_program:1,rc_scratch:0}}));
 for(const functionNames of[['unknown'],[...names,...names],null])assert.throws(()=>approveSourceMacros(code,{functionNames}));
 assert.throws(()=>approveSourceMacros(bindings,{functionNames:names}),/absent/);assert.deepEqual(approveSourceMacros(code).entries,[]);
});
test('authentic frozen raw6 two-h world contains the same approved macro source, not recreated physics',()=>{
 const p=deserialize(readFileSync('/tmp/resident-raw-pc-isolated-native-v2/runtime.v8')),source=composeWorldMicrocodeSource(p.pc),names=MICROCODE_SOURCE_MACROS.map(x=>x.name),a=approveSourceMacros(source.code,{functionNames:names});assert.equal(a.entries.length,3);
 for(const entry of a.entries){const canonical=approveSourceMacros(bindings+sourceMacroNativeWGSL(entry.name),{functionNames:[entry.name]}).entries[0];assert.deepEqual(entry,canonical);}
});
test('broad commit keeps exact void signature, signed-zero BVH helpers and lifecycle caps',()=>{
 const name='rc_world_broad_commit_collision',native=sourceMacroNativeWGSL(name),code=bindings+native;
 const approved=approveSourceMacros(code,{functionNames:[name]}).entries[0];
 assert.equal(approved.resultWords,0);assert.equal(Object.keys(approved.dependencies).length,64);
 assert.doesNotMatch(native,/fn rc_f64_|fn rc_num_eval|var\s*<\s*private\s*>/);
 for(const changed of[code.replace('j:u32){if(!rc_wb_ready(b,4u))','j:u32)->u32{if(!rc_wb_ready(b,4u))'),code.replace('bitcast<u32>(a)|bitcast<u32>(c)','bitcast<u32>(a)&bitcast<u32>(c)'),code.replace('var<storage,read_write> rc_state','var<storage,read> rc_state')]){
  assert.notEqual(changed,code);assert.throws(()=>approveSourceMacros(changed,{functionNames:[name]}));
 }
});
