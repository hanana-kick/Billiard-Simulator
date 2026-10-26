// HOST per-handoff source contract, not a resident whole-world/GPU gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCueProgramBundle,packCueInitialState} from '../src/resident-candidate/cue-orchestration.mjs';
import {generateCueFlatWGSL,executeCueFlatForTest} from '../src/resident-candidate/cue-flat.mjs';
import {COUPLED_BODY_OFFSETS as O} from '../src/resident-candidate/coupled-solver.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {allocateMicrocodeLocals} from '../src/resident-candidate/microcode-allocation.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {microcodeExternalReference} from './resident-candidate-microcode-external-reference.mjs';
const prefix='@group(0) @binding(0) var<storage,read_write> rc_state:array<u32>;@group(0) @binding(1) var<storage,read> rc_program:array<u32>;@group(0) @binding(3) var<storage,read_write> rc_scratch:array<u32>;',source=prefix+generateCueFlatWGSL();
const bodyWords=s=>{const w=new Uint32Array(64),f=new Float32Array(w.buffer);for(const[k,i]of Object.entries(O))if(s[k]!==undefined)f.set(Array.isArray(s[k])?s[k]:[+s[k]],i);return w;};
function vmFor(p,args,bindings){const root=p.functions.find(f=>f.name===p.entryFunction),vm=createMicrocodeVmReferenceForTest({testOnly:true,code:p.instructions,localWords:p.localWords,stackCapacity:p.callDepth,entryPc:p.entryPc,externalFunctions:p.externalFunctions,bindings,initialSlots:args.map((value,i)=>({slot:root.params[i].slot,value}))});vm.begin();return{vm,root};}
async function fixture(){
 const B=createCueProgramBundle(),{seed}=await originalRegisteredFixture(),cue=packCueInitialState(seed.cueInitial,B,{sceneSlots:[6,5,7,0]}),bodies=seed.balls.map(({state})=>bodyWords(state)),cueBase=1,bodyBase=cueBase+B.stateWords,ballBase=bodyBase+seed.selectedIndex*64,othersBase=bodyBase+256,controlBase=othersBase+3,initial=new Uint32Array(controlBase+9);initial[0]=initial[initial.length-1]=0xfacefeed;initial.set(cue,cueBase);bodies.forEach((w,i)=>initial.set(w,bodyBase+i*64));initial.set(bodies.map((_,i)=>i).filter(i=>i!==seed.selectedIndex).map(i=>bodyBase+i*64),othersBase);
 const bindings=[initial.slice(),B.program,new Uint32Array(1),new Uint32Array(B.scratchWords),new Uint32Array(1)],begin=compileMicrocodeWGSL(source,{entry:'rc_cue_flat_begin'}),macro=allocateMicrocodeLocals(compileMicrocodeWGSL(source,{entry:'rc_cue_flat_advance',externalFunctions:['rc_cue_flat_advance'],allocationMetadata:true}),{mode:'call-frames-v1'}),args=[cueBase,ballBase,othersBase,3,0,0,controlBase,32768];return{B,seed,cue,bodies,cueBase,bodyBase,ballBase,othersBase,controlBase,initial,bindings,begin,macro,args};
}
test('genuine cue application and32768-op joint macro handoffs preserve every current state/scratch word',async t=>{
 const{B,cueBase,ballBase,othersBase,controlBase,initial,bindings,begin,macro,args}=await fixture();let expected=null,calls=0;
 for(const mode of[0,1]){const b=vmFor(begin,[cueBase,0,mode,controlBase],bindings);while(b.vm.advance(0,65536)===1){}assert.equal(b.vm.state[2],2);assert.equal(b.vm.local(0,b.root.returnSlot),0);let status=0,first=true;
  while(status===0){assert.ok(calls<8,'genuine bounded source handoff fixture');expected=executeCueFlatForTest(B,initial,{testOnly:true,cueBase,ballBase,othersBase,controlBase,mode,instructionBudget:32768,dispatches:1,begin:first,retained:expected??undefined});first=false;const h=vmFor(macro,args,bindings);assert.equal(h.vm.advance(0,65536),5);assert.equal(h.vm.serviceExternal(0,0,microcodeExternalReference),1);assert.equal(h.vm.advance(0,65536),2);status=h.vm.local(0,h.root.returnSlot);assert.equal(status,expected.status);assert.deepEqual(bindings[0],expected.state,'whole source state at handoff '+calls);assert.deepEqual(bindings[3],expected.scratch,'whole dirty scratch at handoff '+calls);calls++;}
  assert.equal(status,1);
 }
 t.diagnostic(JSON.stringify({handoffs:calls,instructionBudget:32768,exactSourceStateAndScratch:true,gpuExecuted:false,fullRest:false}));
});

test('cue TEST begin preserves dirty uninitialized numeric registers exactly like original source',async t=>{
 const{B,cueBase,ballBase,othersBase,controlBase,bindings,begin,macro,args}=await fixture(),dirty=0xdeadbeef;
 const appBegin=vmFor(begin,[cueBase,0,0,controlBase],bindings);while(appBegin.vm.advance(0,65536)===1){}const app=vmFor(macro,args,bindings);assert.equal(app.vm.advance(0,65536),5);assert.equal(app.vm.serviceExternal(0,0,microcodeExternalReference),1);assert.equal(app.vm.advance(0,65536),2);assert.equal(app.vm.local(0,app.root.returnSlot),1);
 const initial=bindings[0].slice();bindings[3].fill(dirty);const b=vmFor(begin,[cueBase,0,1,controlBase],bindings);while(b.vm.advance(0,65536)===1){}assert.equal(b.vm.state[2],2);
 const expected=executeCueFlatForTest(B,initial,{testOnly:true,cueBase,ballBase,othersBase,controlBase,mode:1,instructionBudget:1,dispatches:1,retained:{state:initial.slice(),scratch:new Uint32Array(B.scratchWords).fill(dirty),continuations:new Map()}}),one=args.slice();one[7]=1;
 const h=vmFor(macro,one,bindings);assert.equal(h.vm.advance(0,65536),5);assert.equal(h.vm.serviceExternal(0,0,microcodeExternalReference),1);assert.equal(h.vm.advance(0,65536),2);assert.equal(h.vm.local(0,h.root.returnSlot),0);
 const pb=bindings[0][controlBase+1],sb=bindings[0][controlBase+2],initialized=bindings[0][controlBase+4],registers=B.program[pb+5];assert.ok(initialized<registers,'fixture has genuinely unassigned live numeric registers');for(let i=initialized;i<registers;i++)assert.equal(bindings[3][sb+i],dirty,'original source preserves unused register '+i);
 const first=expected.scratch.findIndex((word,i)=>word!==bindings[3][i]);if(first>=0)t.diagnostic(JSON.stringify({firstDifference:first,oldTestWord:expected.scratch[first],sourceWord:bindings[3][first],initialized,registers,programBase:pb,scratchBase:sb}));
 assert.deepEqual(expected.state,bindings[0]);assert.deepEqual(expected.scratch,bindings[3],'TEST model cannot zero source-unwritten dirty registers');
});
