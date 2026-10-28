import test from 'node:test';import assert from 'node:assert/strict';
import '../src/inverse-events.js';
import {createInverseObservationLayout,packInverseObservationFrame,initializeInverseObservationState,decodeInverseObservationState,INVERSE_REDUCER_CAPABILITY} from '../src/resident-candidate/inverse-observation-layout.mjs';
import {createInverseReducerTestDriver} from './resident-candidate-inverse-reducer-support.mjs';
import {generateInverseObservationWGSL} from '../src/resident-candidate/inverse-observation-reducer.mjs';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {createMicrocodeVmReferenceForTest} from '../src/resident-candidate/microcode-vm.mjs';
import {microcodeIntrinsicReference} from './resident-candidate-microcode-intrinsic-reference.mjs';
const O=globalThis.LabInverseEvents.observation;
const obj=id=>({kind:'object',id}),rail=r=>({kind:'cushion',rail:r});
function frame({x=-.06,y=.03,z=0,impact=false,time=.01,railImpact=false,sequence=Math.round(time/.01),initial=false,projection={point:{x:1,y:.03,z:0},isInside:false}}={}){return{phase:initial?'initial-before-world-step':O.phase,sequence:initial?0:sequence,time,stepDt:initial?0:.01,cue:{radius:.03,position:{x,y,z}},objects:[{id:2,radius:.03,position:{x:0,y:.03,z:0},impact}],rails:[{rail:'x+',projection,impact:railImpact}]};}
function setup(events,start=0,opts={}){const layout=createInverseObservationLayout({topology:{events},objectIds:[2],rails:['x+'],...opts}),d=createInverseReducerTestDriver(layout,start),e=O.create({events},start);return{layout,d,e,apply(f){const before=structuredClone(f);(f.phase==='initial-before-world-step'?O.initial:O.step)(e,f);const result=d.frame(f);assert.equal(result.status,1);assert.deepEqual(result.observation,e,'every original retained observation field');assert.deepEqual(f,before,'detached input unchanged');return result;}};}
const value=(w,p)=>new DataView(w.buffer,w.byteOffset,w.byteLength).getFloat64(4*p,true);

test('actual generated reducer: initial, closest relative chord, impact, persistent episode and quick leave/re-entry exact',()=>{
 const t=setup([obj(2),obj(2)]);for(const f of[frame({initial:true,time:0,x:-.2}),frame({x:-.06,impact:true}),frame({time:.02,impact:true}),frame({time:.03,x:-.15}),frame({time:.04,x:-.2}),frame({time:.05,x:-.1}),frame({time:.06,impact:true})])t.apply(f);
 assert.equal(t.e.eventPrefix,2);assert.equal(t.e.events.length,2);assert.ok(t.e.returnStages.get(1).returning);
 const p=t.d.project();assert.equal(p[1],1);assert.equal(p[5],19);assert.deepEqual(Array.from(p.slice(8,14)),[0,0,0,0,0,0]);assert.equal(value(p,14),t.e.firstImpact.time);assert.equal(value(p,16),t.e.firstImpact.stepDt);assert.equal(value(p,18),Math.round(t.e.firstImpact.time/t.e.firstImpact.stepDt));
 const chord=setup([obj(2)]);chord.apply(frame({initial:true,time:0,x:-.2,y:.06}));chord.apply(frame({x:.2,y:.06}));assert.ok(Math.hypot(...chord.e.stageResiduals[0])<.001,'closest relative segment not endpoint');
});
test('stable original object-before-cushion group, ambiguity and unexpected contact retain exact mismatch/event cells',()=>{
 const a=setup([obj(2),rail('x+')]);a.apply(frame({initial:true,time:0}));a.apply(frame({impact:true,railImpact:true}));assert.equal(a.e.mismatch.reason,'ambiguous-simultaneous-events');assert.deepEqual(a.e.events.map(e=>e.kind),['object','cushion']);a.apply(frame({time:.02,impact:false}));
 const b=setup([rail('x+'),obj(2)]);b.apply(frame({impact:true}));assert.equal(b.e.mismatch.reason,'unexpected-event');assert.equal(b.e.eventPrefix,0);
 const r=setup([rail('x+')]);r.apply(frame({initial:true,time:0,projection:{point:{x:-.06,y:.03,z:0},isInside:true}}));r.apply(frame({railImpact:true,projection:{point:{x:-.06,y:.03,z:0},isInside:true}}));assert.equal(r.e.eventPrefix,1);assert.equal(r.d.project()[5]&16,0,'rail is never first object impact');
});
test('strict flat phase/roster validation and GPU-word checks reject malformed/stale frames before source mutation',()=>{
 const t=setup([obj(2)]);t.apply(frame({initial:true,time:0}));const before=t.d.state.slice();
 for(const change of[f=>f.objects[0].id=3,f=>f.phase='after-application',f=>f.stepDt=Infinity,f=>f.cue.radius=0,f=>f.rails[0].projection=null,f=>f.objects[0].impact=1]){const f=frame({railImpact:true});change(f);assert.throws(()=>packInverseObservationFrame(t.layout,f));assert.deepEqual(t.d.state,before);}
 t.d.frames.set(packInverseObservationFrame(t.layout,frame({sequence:3})));const rejected=t.d.raw();assert.equal(rejected.status,3);assert.equal(rejected.reason,2);const actual=t.d.state.slice();actual[2]=before[2];actual[3]=before[3];assert.deepEqual(actual,before,'only explicit failed transport header changes');
});
test('missing target/projection and finite-capacity overflow are explicit unsupported, never fake residual/miss',()=>{
 for(const [events,f,reason]of[[[obj(3)],frame({initial:true,time:0}),5],[[rail('x+')],frame({initial:true,time:0,projection:null}),6]]){const l=createInverseObservationLayout({topology:{events},objectIds:[2],rails:['x+']}),d=createInverseReducerTestDriver(l),r=d.frame(f);assert.equal(r.status,2);assert.equal(r.reason,reason);assert.equal(r.observation.stageResiduals[0],null);assert.equal(d.project()[1],2);}
 const t=setup([obj(2),obj(2)],0,{eventCapacity:1});t.apply(frame({impact:true}));t.apply(frame({time:.02,x:-.2}));const r=t.d.frame(frame({time:.03,impact:true}));assert.equal(r.status,2);assert.equal(r.reason,3);assert.equal(r.observation.eventPrefix,1);assert.equal(r.observation.events.length,1);
 assert.equal(INVERSE_REDUCER_CAPABILITY.worldProducerImplemented,false);assert.equal(INVERSE_REDUCER_CAPABILITY.gpuNumericallyQualified,false);assert.equal(INVERSE_REDUCER_CAPABILITY.finalGameplayQualified,false);
});
test('contact-cell rounding retains ties/adjacent values and fails closed outside finite safe quotient domain',()=>{
 const t=setup([obj(2)]);t.apply(frame({impact:true}));const event=t.layout.eventBase;
 const put=(p,v)=>new DataView(t.d.state.buffer).setFloat64(p*4,v,true);
 for(const q of[-0,0,.49999999999999994,.5,.5000000000000001,1.5,2**20+.5,2**51+.5,Number.MAX_SAFE_INTEGER]){put(event+2,q);put(event+4,1);const out=t.d.project();assert.equal(out[1],1);assert.ok(Object.is(value(out,18),Math.round(q)),String(q));}
 for(const q of[-1,Infinity,NaN,2**53]){put(event+2,q);put(event+4,1);const out=t.d.project();assert.equal(out[1],2);assert.equal(out[2],8);assert.ok(out.slice(3).every(x=>x===0),'unsupported projection has no scalar authority');}
});

// Finite source inputs can still produce nonfinite intermediates. They must
// never be reinterpreted as a zero-gap success by a convenient comparison.
test('derived overflow preserves nonfinite rejection, not NaN-to-zero gap coercion',()=>{
 const t=setup([obj(2)]),f=frame({initial:true,time:0,x:Number.MAX_VALUE});f.cue.radius=Number.MAX_VALUE;f.objects[0].radius=Number.MAX_VALUE;f.objects[0].position.x=-Number.MAX_VALUE;
 assert.throws(()=>O.initial(t.e,f),/Nonfinite/);const r=t.d.frame(f);assert.equal(r.status,2);assert.equal(r.reason,4);assert.equal(r.observation.stageResiduals[0],null);assert.ok(t.d.project().slice(3).every(x=>x===0));
});

test('bounded interleaved candidate lanes retain independent complete state; padded invocation is inert',()=>{
 const layout=createInverseObservationLayout({topology:{events:[obj(2)]},objectIds:[2],rails:['x+']}),source=generateInverseObservationWGSL(layout,{count:2,workgroupSize:64}),c=compileMicrocodeWGSL(source,{intrinsics:'source-f64-v1'}),p=c.functions.find(f=>f.name==='main').params[0];
 const state=new Uint32Array(layout.stateWords*2+16).fill(0x12345678),frames=new Uint32Array(layout.frameWords*2),expected=[];
 for(let i=0;i<2;i++){state.set(initializeInverseObservationState(layout),i*layout.stateWords);const f=frame({impact:i===0,x:i===0?-.06:-.4});frames.set(packInverseObservationFrame(layout,f),i*layout.frameWords);const e=O.create({events:[obj(2)]});O.step(e,f);expected.push(e);}
 const beforeFrames=frames.slice(),beforeConfig=layout.config.slice(),vm=createMicrocodeVmReferenceForTest({testOnly:true,count:3,code:c.instructions,localWords:c.localWords,stackCapacity:c.callDepth,entryPc:c.entryPc,bindings:[state,layout.config,new Uint32Array(1),new Uint32Array(1),frames],intrinsics:'source-f64-v1',intrinsicHandler:microcodeIntrinsicReference,initialSlots:[{slot:p.slot,value:0,candidateStride:1},{slot:p.slot+1,value:0},{slot:p.slot+2,value:0}]});
 const status=[1,1,1];for(let i=0;i<3;i++)vm.begin(i);let sweeps=0;while(status.some(x=>x===1)){assert.ok(++sweeps<1000);for(let i=2;i>=0;i--)if(status[i]===1)status[i]=vm.advance(i,37);}
 assert.deepEqual(status,[2,2,2]);for(let i=0;i<2;i++)assert.deepEqual(decodeInverseObservationState(layout,state.slice(i*layout.stateWords,(i+1)*layout.stateWords)).observation,expected[i]);assert.ok(state.slice(layout.stateWords*2).every(x=>x===0x12345678));assert.deepEqual(frames,beforeFrames);assert.deepEqual(layout.config,beforeConfig);
});
