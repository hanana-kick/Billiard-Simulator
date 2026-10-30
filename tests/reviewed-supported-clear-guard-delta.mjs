import test from 'node:test';import assert from 'node:assert/strict';
import {restoreSupportedClearGuardDelta,restoreSupportedClearGuardWorldPlan} from './helpers/reviewed-supported-clear-guard-delta.mjs';
import {WORLD_SUPPORTED_CLEAR_V2_WGSL as original,WORLD_SUPPORTED_CLEAR_V2_GUARD_WGSL as guard} from '../src/direct-candidate/deterministic-world-mixed-v2-gpu.mjs';
const fixture=()=>({definitions:[{code:guard,label:'guard'},{code:original,label:'unchanged'}],pipelines:[{module:0,entryPoint:'main',constants:{},layout:{bindGroupLayouts:[{entries:[{binding:0,visibility:4,buffer:{type:'storage'}}]}]}},{module:1,entryPoint:'main',constants:{},layout:'auto'}],buffers:[{size:1024,usage:140,bytes:new Uint8Array(1024)}],commands:[{kind:'dispatch',pipeline:0,x:1,entries:[{binding:0,buffer:0,offset:0,size:1024}]},{kind:'dispatch',pipeline:1,x:1,entries:[{binding:0,buffer:0,offset:0,size:1024}]}],expectedDispatches:1});
test('reviewed guard inverse removes only exact adjacent preguard and remaps later IDs without mutating source',()=>{
 const input=fixture(),before=structuredClone(input),r=restoreSupportedClearGuardDelta(input);assert.deepEqual(input,before);assert.deepEqual(r.definitions,[before.definitions[1]]);assert.deepEqual(r.pipelines,[{...before.pipelines[1],module:0}]);assert.deepEqual(r.commands,[{...before.commands[1],pipeline:0}]);assert.deepEqual(r.buffers,before.buffers);
});
test('guard inverse refuses changed source, binding, invocation, layout, adjacency, or count',()=>{
 for(const mutate of [x=>x.definitions[0].code+=' ',x=>x.definitions[1].code+=' ',x=>x.commands[0].entries[0].buffer=1,x=>x.commands[0].x=0,x=>x.commands[0].indirect={buffer:0,offset:8},x=>x.pipelines[0].layout='auto',x=>x.commands.splice(1,0,{kind:'clear',buffer:0,offset:0,size:4}),x=>x.expectedDispatches=2]){const f=fixture();mutate(f);assert.throws(()=>restoreSupportedClearGuardDelta(f));}
});

const worldFixture=()=>{const f=fixture();return {kind:'test-world',definitions:f.definitions.map((d,i)=>({source:d.code,ownership:[{stride:256,base:0,length:256}],entryPoint:'main',label:d.label,layout:f.pipelines[i].layout})),allocations:f.buffers.map(({bytes,...b})=>({...b,initial:bytes})),commands:[...f.commands,...structuredClone(f.commands)].map(c=>Object.fromEntries(Object.entries(c).map(([k,v])=>[k==='pipeline'?'definition':k,v]))),readback:0};};
test('flat world guard inverse reuses strict checks and preserves every other field and command key order',()=>{
 const f=worldFixture(),before=structuredClone(f),r=restoreSupportedClearGuardWorldPlan(f,{expectedDispatches:2});assert.deepEqual(f,before);
 const expected={...before,definitions:[before.definitions[1]],commands:[before.commands[1],before.commands[3]].map(c=>({...c,definition:0}))};
 assert.equal(JSON.stringify(r),JSON.stringify(expected));
});
test('flat world inverse rejects guard mutation, reordered commands, different state views and ownership',()=>{
 for(const mutate of [x=>x.definitions[0].source+=' ',x=>x.commands.reverse(),x=>x.commands[0].entries[0].buffer=1,x=>x.definitions[0].ownership[0].stride=512,x=>x.definitions[1].ownership[0].base=1,x=>x.commands[0].x=2,x=>x.definitions[0].layout='auto',x=>x.commands.splice(0,2)]){const f=worldFixture();mutate(f);assert.throws(()=>restoreSupportedClearGuardWorldPlan(f,{expectedDispatches:2}));}
});

test('flat world inverse remaps only surviving indirect owner command indices and rejects invalid owners',()=>{
 const f=worldFixture();f.commands.push({kind:'dispatch',definition:1,indirect:{buffer:0,offset:8,ownerCommand:3},entries:[{binding:0,buffer:0,offset:0,size:1024}]});
 const r=restoreSupportedClearGuardWorldPlan(f,{expectedDispatches:2});assert.equal(r.commands[2].indirect.ownerCommand,1);assert.equal(f.commands[4].indirect.ownerCommand,3);
 for(const owner of [0,2,-1,1.5,5,NaN]){const bad=structuredClone(f);bad.commands[4].indirect.ownerCommand=owner;assert.throws(()=>restoreSupportedClearGuardWorldPlan(bad,{expectedDispatches:2}));}
});
