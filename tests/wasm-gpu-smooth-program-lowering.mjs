import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lowerSmoothCellProgram} from '../src/wasm-gpu/smooth-program-lowering.mjs';
import {SMOOTH_CELLS_WGSL} from '../src/direct-candidate/deterministic-smooth-segment.mjs';
import {SMOOTH_STAGED_WGSL} from '../src/direct-candidate/deterministic-smooth-staged.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
function fixture(){
 const allocations=[1024,1024,1024,2048,32].map(size=>({size,usage:128,external:null,initial:new Uint8Array(size)}));
 const entries=allocations.slice(0,4).map((a,binding)=>({binding,buffer:binding,offset:0,size:a.size}));
 const layout={bindGroupLayouts:[{entries:entries.map(({binding})=>({binding,visibility:4,buffer:{type:binding?'storage':'read-only-storage'}}))}]};
 const definitions=[{source:'owner',entryPoint:'main',layout:'auto',ownership:[]},{source:SMOOTH_CELLS_WGSL,entryPoint:'main',layout,ownership:entries.map(e=>({stride:e.size/4,base:0,length:e.size/4}))}];
 const owner={kind:'dispatch',definition:0,x:1,entries:[]};
 const indirect=ownerCommand=>({buffer:4,offset:8,ownerCommand,maximum:4});
 const commands=[owner,{kind:'dispatch',definition:1,x:1,entries},{...owner},{kind:'dispatch',definition:1,indirect:indirect(2),entries},{kind:'clear',buffer:1,offset:0,size:1024}];
 return {definitions,commands,allocations};
}
test('staged source is exactly the independently GPU-compared kernel; original remains a reference',()=>{
 assert.deepEqual(SMOOTH_STAGED_WGSL.map(sha),['a6dedf3d6673818a7672c6a6587d16f6712cd4ea06140082baf2ce0d70a1b90f','2e4232c469b9d5621979b0ea697e900fd9a7de2b9f13f4e18423f7cc95de9c31','788c64a21e0cffc546fdc178d7afa64d4773df4cc7561ac6c7589e405b50dadc']);
 assert.equal(sha(SMOOTH_CELLS_WGSL),'43a205fc33ec4dd139f2e1e5e7488af406a0dee5fe9817bbcdcfa59f0eb1d4f1');
});
test('pure lowering keeps reference immutable; adjacent triplets preserve views and indirect producers',async()=>{
 const original=fixture(),snapshot=structuredClone(original),d=await lowerSmoothCellProgram(original,{sourceField:'source'});
 assert.deepEqual(original,snapshot);assert.equal(d.originalProgram,original);assert.deepEqual(d.commandOrigins,[0,1,1,1,2,3,3,3,4]);
 assert.equal(d.definitions.length,4);assert.ok(d.definitions.every(x=>x.source!==SMOOTH_CELLS_WGSL));assert.deepEqual(d.commands[0],original.commands[0]);assert.deepEqual(d.commands[4],original.commands[2]);assert.deepEqual(d.commands[8],original.commands[4]);
 for(const [start,index]of [[1,1],[5,3]])for(let stage=0;stage<3;stage++){
  const c=d.commands[start+stage];assert.equal(d.definitions[c.definition].source,SMOOTH_STAGED_WGSL[stage]);assert.deepEqual(c.entries.slice(0,4),original.commands[index].entries);assert.deepEqual(c.entries[4],{binding:4,buffer:5,offset:0,size:2048});
  if(index===3){assert.deepEqual(c.indirect,{...original.commands[index].indirect,ownerCommand:4});assert.deepEqual(d.commands[c.indirect.ownerCommand],original.commands[2]);}else assert.equal(c.x,1);
 }
 assert.equal(d.allocations.length,6);assert.equal(d.allocations[5].size,2048);assert.ok(d.allocations[5].initial.every(x=>x===0));
 for(const def of d.definitions.slice(1)){assert.equal(def.layout.bindGroupLayouts[0].entries.length,5);assert.deepEqual(def.ownership[4],{stride:512,base:0,length:512});}
 assert.equal(d.receipt.derivedCommands,9);assert.equal(d.receipt.expandedCommands,2);
 // Request bytes never enter reference/derived structural provenance.
 original.allocations[0].initial[0]=1;const changed=await lowerSmoothCellProgram(original,{sourceField:'source'});assert.deepEqual(changed.receipt,d.receipt);
});
test('source identity, exact row views and indirect producer ownership fail closed',async()=>{
 for(const mutate of [p=>p.definitions[1].source+=' ',p=>p.definitions[1].entryPoint='other',p=>p.commands[1].entries[2].size=512,p=>p.commands[3].indirect.ownerCommand=999,p=>p.definitions[1].layout.bindGroupLayouts[0].entries.pop()]){
  const p=fixture();mutate(p);await assert.rejects(()=>lowerSmoothCellProgram(p,{sourceField:'source'}));
 }
});
