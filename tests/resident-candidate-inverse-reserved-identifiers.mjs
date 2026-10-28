// HOST parser regression for the exact native preflight failure. The custom
// scalar parser is deliberately not treated as a WGSL keyword validator.
import test from 'node:test';import assert from 'node:assert/strict';
import {createInverseObservationLayout} from '../src/resident-candidate/inverse-observation-layout.mjs';
import {generateInverseObservationWGSL} from '../src/resident-candidate/inverse-observation-reducer.mjs';
import {parseMicrocodeWGSL} from '../src/resident-candidate/microcode-parser.mjs';
import {assertNoInverseReservedBindings} from './resident-candidate-inverse-component-alpha-repair.mjs';
test('native-reserved active/target rejected even where scalar HOST parser accepts them',()=>{
 for(const code of ['fn bad(active:u32)->u32{return active;}','fn bad(){var target=0u;}','fn bad(){let active=1u;}']){assert.ok(parseMicrocodeWGSL(code).functions.length);assert.throws(()=>assertNoInverseReservedBindings(code),/reserved/);}
 assert.doesNotThrow(()=>assertNoInverseReservedBindings('// var active=0u;\n/* let target=1u; */ fn good(pairActive:u32)->u32{return pairActive;}'));
});
test('actual observe/project closures contain only scoped replacement identifiers',()=>{
 const layout=createInverseObservationLayout({topology:{events:[{kind:'object',id:3},{kind:'object',id:4}]},objectIds:[2,3,4],rails:['x+','x-','z+','z-']});
 for(const entry of ['observe','project']){const code=generateInverseObservationWGSL(layout,{count:4,entry});assert.doesNotThrow(()=>assertNoInverseReservedBindings(code));if(entry==='observe'){assert.match(code,/\bpairActive\b/);assert.match(code,/\btargetPoint\b/);assert.throws(()=>assertNoInverseReservedBindings(code.replace(/\bpairActive\b/g,'active').replace(/\btargetPoint\b/g,'target')),/reserved/);}}
});
