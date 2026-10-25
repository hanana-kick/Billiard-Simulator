import test from 'node:test';
import assert from 'node:assert/strict';
import {packCreatedWorldTemplate} from '../src/resident-candidate/world-state.mjs';
import {generateWorldHPlan,worldHCommands} from '../src/resident-candidate/world-h.mjs';
import {compileWorldDevicePc} from '../src/resident-candidate/world-device-pc.mjs';
import {compileWorldSourceOwners,SOURCE_OWNER_ORDER} from '../src/resident-candidate/world-owners.mjs';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {DEFAULT_WHOLE_H_RULE} from './resident-candidate-whole-h-fixture.mjs';
function auditHelpers(code){const text=code.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g,' '),functions=new Set([...text.matchAll(/\bfn\s+(\w+)\s*\(/g)].map(m=>m[1])),types=new Set([...text.matchAll(/\b(?:struct|alias)\s+(\w+)/g)].map(m=>m[1])),builtins=new Set('if for while loop switch return select arrayLength min max abs clamp sqrt dot cross length normalize distance countLeadingZeros countTrailingZeros countOneBits extractBits insertBits reverseBits firstLeadingBit firstTrailingBit round trunc floor ceil sign all any workgroupBarrier storageBarrier bitcast f32 i32 u32 bool vec2 vec3 vec4 mat2x2 mat3x3 mat4x4 group binding workgroup_size builtin location align size interpolate invariant'.split(' '));for(const m of text.matchAll(/\b(\w+)\s*\(/g))assert.ok(functions.has(m[1])||types.has(m[1])||builtins.has(m[1]),'undefined composed helper '+m[1]);}
let pending;const fixture=()=>pending??=(async()=>{const f=await originalRegisteredFixture();return packCreatedWorldTemplate(f.seed,{rule:DEFAULT_WHOLE_H_RULE});})();
test('ten explicit owners cover every original phase with unchanged bytecode and disjoint requests',async()=>{
 const t=await fixture(),source=generateWorldHPlan(t,{count:2,cueTransport:'flat',coupledTransport:'micro'}),pc=compileWorldDevicePc(source,{programBase:t.program.length,controlTailBase:2*t.state.length+t.fixedCcd.length,maxH:2}),o=compileWorldSourceOwners(t,source,pc);
 assert.equal(source.numericProfile,'source-f32-preserved-v1');assert.throws(()=>compileWorldSourceOwners(t,source,pc,{numericProfile:'source-f32-integer-v1'}),/profile must match/);assert.equal(source.pipelines.filter(p=>p.sourceNoOp).length,8);assert.equal(pc.sourceNoOpProofs.filter(Boolean).length,8);
 assert.equal(o.pipelines.length,10);assert.deepEqual(o.sourceOwnerOrder,SOURCE_OWNER_ORDER);assert.equal(o.phasePipelineCount,85);assert.deepEqual(o.bytecode,pc.bytecode);assert.equal(o.begin,pc.begin);assert.equal(o.controlWords,80);assert.equal(o.requestWordsPerCandidate,24);assert.equal(o.requestTailBase,pc.totalStateWords);assert.equal(o.totalStateWords,pc.totalStateWords+48);assert.equal(o.worstCaseSweeps,null);assert.equal(o.sourceCapability.nativeWholeHQualified,false);
 const ids=o.owners.flatMap(x=>x.pipelineIds).sort((a,b)=>a-b);assert.deepEqual(ids,source.pipelines.map((_,i)=>i));
 for(const owner of o.owners)for(const i of owner.pipelineIds)assert.equal(source.pipelines[i].owner,owner.name);
 const graph=o.pipelines.find(p=>p.name==='device-owner-shared-graph');assert.equal((graph.code.match(/\brc_num_eval\s*\(/g)??[]).length,2,'definition + single evaluator call');
 for(const p of o.pipelines){auditHelpers(p.code);assert.match(p.code,/@compute/);assert.doesNotMatch(p.code,/undefinedu|NaNu|mapAsync|hostForward/);}
 assert.equal([...worldHCommands(source)].length,221116,'phase oracle source capacity unchanged');
 console.log(JSON.stringify({scope:'ten-source-owners-host-only',sourcePhases:source.pipelines.length,owners:o.pipelines.map(p=>({name:p.name,bytes:p.code.length,sourcePhases:p.pipelineIds.length})),stateWords:o.totalStateWords,requestWords:48,sourceCallsPerH:o.sourceCallsPerH,sourceCapsUnchanged:true,native:false}));
});
test('owner composition rejects a transport not covered by its explicit first-gate source families',async()=>{
 const t=await fixture(),s=generateWorldHPlan(t,{count:1}),pc=compileWorldDevicePc(s,{programBase:t.program.length,controlTailBase:t.state.length+t.fixedCcd.length});assert.throws(()=>compileWorldSourceOwners(t,s,pc),/Owner first gate requires/);
});
