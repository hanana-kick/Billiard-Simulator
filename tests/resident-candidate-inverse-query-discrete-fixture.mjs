// TEST-ONLY discrete terminal component witnesses. NOT reached physical banks,
// raw execution evidence, or authority for a runtime/planner verdict.
import assert from 'node:assert/strict';
import {createInverseReducerTestDriver} from './resident-candidate-inverse-reducer-support.mjs';
import {RULE_LAYOUT as L,RULE_EVENT,consumeRuleEvent,finishOuter,binary64Words} from '../src/resident-candidate/physical-rules.mjs';
import {WORLD_APPLICATION_LAYOUT as WA} from '../src/resident-candidate/world-application.mjs';
import {numberWords} from '../src/resident-candidate/source-number.mjs';
import {selectSourceInverseTerminalObservation} from '../src/resident-candidate/inverse-terminal-observation.mjs';
import {topology} from './resident-candidate-inverse-query-initial-fixture.mjs';
const E=globalThis.LabInverseEvents,Core=globalThis.ShotSearchCore;
// Deliberate discrete frames, independent of actual world evolution. Both the
// original JS reducer and generated source reducer consume exactly these words.
export function discreteInverseObservation(f,kind,cell={}){const l=f.observer.layout,start=f.request.snapshot.time,d=createInverseReducerTestDriver(l,start),e=E.observation.create(topology,start);
 const frame=(sequence,impact)=>({phase:sequence?E.observation.phase:'initial-before-world-step',sequence,time:start+sequence/100,stepDt:sequence?1/100:0,cue:{position:{x:0,y:.03075,z:0},radius:.03075},objects:l.objectIds.map((id,i)=>({id,position:{x:.2+.2*i,y:.03075,z:0},radius:.03075,impact:id===impact})),rails:l.rails.map(rail=>({rail,impact:false,projection:{isInside:false,point:{x:1,y:.03075,z:0}}}))});
 for(const [sequence,impact]of [[0,null],[1,kind==='missing'?null:3],[2,kind==='missing'?null:4]]){const value=frame(sequence,impact);(sequence?E.observation.step:E.observation.initial)(e,value);assert.deepEqual(d.frame(value).observation,e);}
 if(Object.hasOwn(cell,'firstImpactTime')&&e.firstImpact){e.firstImpact.time=cell.firstImpactTime;new DataView(d.state.buffer).setFloat64((l.eventBase+8*(d.state[13]-1)+2)*4,cell.firstImpactTime,true);}
 return{state:d.state.slice(),projection:d.project(),e};}
export function discreteInversePhysicalDecision(f,settings,kind){const start=f.request.snapshot.time,t=Core.createPhysicalAccumulator(settings,undefined,start,{x:0,y:.03075,z:0}),r=f.initialization.template.state.slice(f.initialization.template.segments.rules.offset,f.initialization.template.segments.rules.offset+128),req=f.request;
 for(const [id,dt]of kind==='missing'?[]:[[3,.01],[4,.02],...(kind==='late-foul'?[[req.options.opponentId,.03]]:[])]){Core.observePhysicalEvent(req,t,{kind:'contact',time:start+dt,a:{id:req.selectedId,kind:'ball'},b:{id,kind:'ball'}});consumeRuleEvent(r,{kind:RULE_EVENT.ball,id,time:binary64Words((start+dt)-start),sameGroup:false});}
 const input={time:start+.04,dt:1/960,cuePresent:()=>false,allSleeping:()=>kind!=='late-foul',positiveImpulse:()=>false,sphereIds:()=>[1,2,3,4],radius:()=>.03075,position:id=>({x:id===req.selectedId?0:.2*id,y:.03075,z:0})};
 const stop=Core.observePhysicalStep(req,t,input),status=finishOuter(r,{cuePresent:false,allSleeping:kind!=='late-foul',opponentImpulse:false,offTable:false,finitePosition:true,firstKissBeforeGoal:false});assert.equal(stop,true);assert.equal(status,t.success&&!t.invalid?2:3);return{r,t,result:Core.physicalResult(req.options,t,input.time)};}
export function createInverseDiscreteQueryComponent(f,kinds=['positive','missing','late-foul','positive'],cell={}){const p=f.plan,q=f.observer,world=new Uint32Array(q.stateWords*p.count),observer=new Uint32Array(q.observerWords*p.count),expected=[];
 for(let lane=0;lane<p.count;lane++){
  const row=f.rows[lane],base=lane*q.stateWords,ob=lane*q.observerWords,b=f.initialization.template.state.slice(),o=q.sourceOffsets,obs=discreteInverseObservation(f,kinds[lane],cell),phys=discreteInversePhysicalDecision(f,row.settings,kinds[lane]);b[2]=phys.r[L.status];b[4]=row.id;b[5]=2;b[8]=p.selectedIndex;b.set(phys.r,o.rules);b[o.worldApplication+WA.header.phase]=7;b[o.worldApplication+WA.header.terminalPublished]=1;b[o.worldApplication+WA.header.outer]=phys.t.steps;
  // A discrete protocol witness, NOT device-authored initialization evidence.
  b.set([0,3,0,1,1,3],o.rawCreation);b[o.rawPose]=1;b.set([1,p.obstacles*3,0,p.selectedObstacle],o.rawClearance);b.set(numberWords(f.clearances[lane]),o.rawClearance+4);b[o.rawClearance+9]=0xffffffff;b[o.rawClearance+10]=(p.obstacles*3-1)*3;b[o.rawClearance+11]=p.obstacles*3-1;world.set(b,base);
  observer.set([0x52494f57,1,2,0,2,1,0,1],ob+q.segments.inverseControl.offset);observer.set(obs.state,ob+q.segments.inverseObservation.offset);observer.set(obs.projection,ob+q.segments.inverseProjection.offset);
  const original=E.projectResult({...obs.e,req:f.request,settings:row.settings,topologyId:topology.id,purpose:p.purpose,clearance:f.clearances[lane],inequalities:[-f.clearances[lane],...E.inputInequalities(f.request,row.settings)]},phys.result,phys.t.steps);
  expected.push({id:row.id,status:'evaluated',reason:'none',boundary:phys.r[L.flags]&1024?'full-rest':'physical-stop',observation:selectSourceInverseTerminalObservation(original)});
 }
 return{world,observer,expected};}

