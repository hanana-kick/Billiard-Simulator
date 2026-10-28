import test from 'node:test';import assert from 'node:assert/strict';
import {compileInlineGraphSource,runInlineGraphPilot,INLINE_GRAPH_PINS} from './resident-candidate-inline-graph-pilot.mjs';
import {generateProfiledNumericWGSL,NUMERIC_PROFILE} from '../src/resident-candidate/numeric-profile.mjs';
import {sourceMacroNativeWGSL} from '../src/resident-candidate/microcode-source-macros.mjs';
const prefix='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;',source=prefix+generateProfiledNumericWGSL(NUMERIC_PROFILE.PRESERVED_F32)+sourceMacroNativeWGSL('rc_world_broad_commit_collision');
test('bounded diagnostic caps reject before reading any bank',()=>{for(const o of[{maxPumps:0},{maxPumps:2049},{maxWallMs:0},{maxWallMs:180001}])assert.throws(()=>runInlineGraphPilot('/absent',o),assert.AssertionError);});
test('immutable prior diagnostic pins are explicit and complete',()=>{assert.deepEqual(Object.keys(INLINE_GRAPH_PINS),['initial','sourceFile','source','baselineResult','baselineFinal']);for(const h of Object.values(INLINE_GRAPH_PINS))assert.match(h,/^[a-f0-9]{64}$/);});
test('missing exact source macro closure rejects rather than guessing native function identity',()=>assert.throws(()=>compileInlineGraphSource(prefix+'fn rc_num_eval(a:u32,b:u32)->u32{return a+b;} fn main(){rc_num_eval(0u,0u);}','main'),/signature\/body mismatch|declaration mismatch/));
test('changed source numeric profile rejects before lowering',()=>assert.throws(()=>compileInlineGraphSource(source.replace('RC_NUMERIC_IMPLEMENTATION_PROFILE:u32=2u','RC_NUMERIC_IMPLEMENTATION_PROFILE:u32=1u')+'fn main(){rc_num_eval(0u,0u);}','main'),/declaration mismatch/));
