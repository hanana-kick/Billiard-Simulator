import test from 'node:test';
import assert from 'node:assert/strict';
import {mmq2RawFixture} from './fixtures/canonical-selected-mmq2-raw.mjs';
import {captureLiveWorldPlan} from '../src/direct-candidate/experimental-live-world-capture.mjs';
import {lowerLiveWorldPlans} from '../src/direct-candidate/experimental-live-world-batch.mjs';
import {liftGuardedCandidatePhase,coalesceGuardedInvocationFault} from '../src/direct-candidate/experimental-guarded-storage-lift.mjs';
import {guardLiveCushionIndirect} from '../src/direct-candidate/experimental-live-indirect.mjs';
import {linkResidentWGSL} from '../src/resident-candidate/wgsl-linker.mjs';

// Independent inventory of already comment-free generated functions. Compare
// entire declarations, not numerical outputs or a second arithmetic evaluator.
function functions(code){
 const result=new Map();for(const match of code.matchAll(/\bfn\s+(\w+)\s*\(/g)){
  const brace=code.indexOf('{',match.index);let end=brace+1,depth=1;
  while(depth&&end<code.length){const ch=code[end++];if(ch==='{')depth++;if(ch==='}')depth--;}
  assert.equal(depth,0);assert.ok(!result.has(match[1]));result.set(match[1],code.slice(match.index,end));
 }return result;
}
function verifyClosure(before,after){
 const original=functions(before),retained=functions(after),reachable=new Set(),pending=['main'];
 while(pending.length){const name=pending.pop();if(reachable.has(name))continue;reachable.add(name);
  for(const m of original.get(name).matchAll(/\b(\w+)\s*\(/g))if(original.has(m[1])&&!reachable.has(m[1]))pending.push(m[1]);
 }
 assert.deepEqual([...retained.keys()].sort(),[...reachable].sort());
 for(const [name,body] of retained)assert.equal(body,original.get(name),name+' body must be byte-identical');
 const globals=(code,inventory)=>{for(const body of inventory.values())code=code.replace(body,'');return code.replace(/\/\/[^\n]*/g,'').replace(/@compute\s+@workgroup_size\([^)]*\)/g,'');};
 const oldGlobals=globals(before,original),newGlobals=globals(after,retained);
 assert.equal(newGlobals.replace(/\s+/g,''),oldGlobals.replace(/\s+/g,''),'all global declarations remain identical');
 for(const m of oldGlobals.matchAll(/\b(\w+)\s*\(/g))assert.ok(!original.has(m[1]),'no user function referenced outside function closure');
 const declarations=code=>[...code.matchAll(/@group\(0\)\s*@binding\(\d+\)\s*var<storage,[^;]+;/g)].map(m=>m[0]);
 assert.deepEqual(declarations(after),declarations(before));
 assert.deepEqual([...after.matchAll(/@compute\s+@workgroup_size\([^)]*\)/g)].map(m=>m[0]),[...before.matchAll(/@compute\s+@workgroup_size\([^)]*\)/g)].map(m=>m[0]));
 return original.size-retained.size;
}
const f=mmq2RawFixture(),plan=await captureLiveWorldPlan(f.binding,f.batch,{profile:'mmq2-cushion'});
for(const faultPolicy of ['atomic-per-access','private-per-invocation'])test('MMQ2 '+faultPolicy+' removes only unreachable functions before interning, N1/N3',async()=>{
 for(const width of [1,3]){
  const lower=await lowerLiveWorldPlans(Array(width).fill(plan),{faultPolicy}),seen=new Set();let removed=0,saved=0;
  assert.equal(lower.definitions.length,104);assert.equal(lower.commands.length,plan.commands.length);
  for(const [i,c] of plan.commands.entries()){
   if(c.kind!=='dispatch')continue;const target=lower.commands[i],d=lower.definitions[target.definition];if(seen.has(target.definition))continue;seen.add(target.definition);
   const ownership=c.entries.map(e=>lower.shared[e.buffer]?null:{stride:plan.allocations[e.buffer].size/4,base:e.offset/4,length:e.size/4});
   let original=liftGuardedCandidatePhase(plan.definitions[c.definition].source,ownership,c.entries.map(e=>e.size/4));
   if(faultPolicy==='private-per-invocation')original=coalesceGuardedInvocationFault(original);
   if(c.indirect)original=guardLiveCushionIndirect(original,{stride:plan.allocations[c.indirect.buffer].size/4,...c.indirect});
   assert.equal(d.code,linkResidentWGSL([original.code]).code);assert.equal(d.faultBinding,original.faultBinding);
   removed+=verifyClosure(original.code,d.code);saved+=original.code.length-d.code.length;
   assert.equal(target.x,c.indirect?.bound??c.x);
  }
  assert.ok(removed>=600);assert.ok(saved>190000);
  for(const d of lower.definitions)assert.equal(linkResidentWGSL([d.code]).code,d.code,'all emitted kernels are linked idempotently');
 }
});
