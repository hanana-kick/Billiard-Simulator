'use strict';
// Mock-only stepping with the actual original finish/project/dispose functions.
// No physics runtime, native replay, worker, or latency benchmark is loaded.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const originalSource=fs.readFileSync(path.join(__dirname,'../src/inverse-events.js'),'utf8');
const wrapperSource=fs.readFileSync(path.join(__dirname,'../src/inverse-events-window.js'),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x)),purposes=new Set(['residual','jacobian','trial']);
function harness(config={}){
 const calls={begin:[],advance:[],finishTrial:0,physicalResult:0,dispose:0,restoreMapping:0,restoreOwner:0};
 const originalStep=function originalWorldStep(){},observedStep=function observedWorldStep(){};
 const physical=()=>({success:config.success===true,settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0},failureReason:config.success===true?null:'mock-physical-miss'});
 const context={ShotSearchCore:{finishTrial(_search,t){calls.finishTrial++;t.lab.dispose();return physical();},physicalResult(){calls.physicalResult++;return physical();}},LabSourceGameplayFinalizationOwner:{result:()=>({status:'mock-complete',gameplayVerified:false}),restore(){calls.restoreOwner++;}}};
 vm.createContext(context);vm.runInContext(originalSource,context);const real=context.LabInverseEvents;
 const make=(req,topology,settings,options)=>{
  const expected=plain(topology.events),lab={time:0,world:{step:observedStep},dispose(){calls.dispose++;assert.equal(calls.dispose,1,'world disposed more than once');}};
  return{req,topologyId:topology.id,settings:plain(settings),purpose:options.purpose||'evaluate',eventPrefixOnly:options.eventPrefixOnly===true,expected,eventPrefix:0,stageResiduals:expected.map(()=>[1,.1,0]),inequalities:[-.001,-1],clearance:.001,events:[],mismatch:null,observedSubsteps:0,done:false,disposed:false,tick:0,search:{req},trial:{lab,steps:0,success:config.success===true},originalWorldStep:originalStep,restoreRigidOnlyMapping(){calls.restoreMapping++;},...(config.owner?{finalizationOwner:{mock:true}}:{})};
 };
 const mismatchAt=config.mismatchAt??2,firstImpactAt=config.firstImpactAt??5,naturalEnd=config.naturalEnd??8;
 const base={...real,begin(R,req,topology,settings,options={}){calls.begin.push({R,req,topology,settings,options});return make(req,topology,settings,options);},advance(e,batch=240){
  calls.advance.push(batch);if(e.done)return true;if(!Number.isInteger(batch)||batch<1)throw Error('Positive step batch required');
  for(let i=0;i<batch&&!e.done;i++){
   e.tick++;e.trial.steps++;e.observedSubsteps+=3;e.trial.lab.time=e.tick/100;
   if(config.throwAt===e.tick){real.dispose(e);throw Error('mock step failure');}
   if(e.tick===mismatchAt){const actual={kind:'cushion',rail:'x+',time:e.tick/100,stepDt:.001};e.events.push(actual);e.mismatch={stage:0,reason:config.ambiguous?'ambiguous-simultaneous-events':'unexpected-event',expected:e.expected[0],actual:config.ambiguous?[actual,{kind:'cushion',rail:'z+',time:actual.time}]:actual};}
   if(e.tick===firstImpactAt){const impact={kind:'object',id:3,time:e.tick/100+.0002,stepDt:.001};e.firstImpact=impact;e.events.push(impact);}
   if(e.tick===config.completeAt){e.eventPrefix=e.expected.length;e.stageResiduals=e.expected.map(()=>[0,0,0]);e.events.push(...e.expected.map(x=>({...x,time:e.tick/100})));}
   if(e.tick===naturalEnd||e.tick===config.nativeDoneAt)e.done=true;
   // The current original evaluator's exact outer-step prefix-stop rule.
   if(e.eventPrefixOnly&&!e.done&&((e.mismatch&&e.firstImpact)||e.eventPrefix===e.expected.length)&&purposes.has(e.purpose)&&!e.finalizationOwner){e.prefixOnly=true;e.done=true;}
  }
  return e.done;
 }};
 context.LabInverseEvents=base;vm.runInContext(wrapperSource,context);const api=context.LabInverseEventsWindow;
 const req={selectedId:1,options:{mode:'three'}},topology={id:'mock-topology',events:[{kind:'object',id:2},{kind:'object',id:3}]},settings={angle:0,elevation:8,speed:2,tipX:0,tipY:0};
 const begin=(options={},A=api)=>A.begin(null,req,topology,settings,{purpose:'jacobian',eventPrefixOnly:true,...options});
 return{api,base,real,context,calls,begin,req,topology,settings,originalStep};
}
function complete(h,options={},A=h.api,batch=20){const e=h.begin(options,A);while(!A.advance(e,batch));return{e,out:A.finish(e)};}

test('the wrapper captures but never replaces the original API or disposal/interrupt functions',()=>{
 const h=harness();assert.equal(h.context.LabInverseEvents,h.base);assert.equal(h.api.dispose,h.real.dispose);assert.equal(h.api.interrupt,h.real.interrupt);assert.equal(h.api.projectResult,h.real.projectResult);assert.equal(h.api.observation,h.real.observation);
 h.context.LabInverseEvents={begin(){throw Error('wrong global');}};const e=h.begin({prefixMismatchWindow:true});assert.equal(h.api.advance(e,20),true);assert.equal(e.tick,2);
});
test('disabled and omitted options preserve original calls and full result values',()=>{
 for(const prefixMismatchWindow of [undefined,false]){
  const a=harness(),b=harness(),original=complete(a,{},a.base),wrapped=complete(b,{prefixMismatchWindow});
  assert.deepEqual(plain(wrapped.out),plain(original.out));assert.deepEqual(b.calls.advance,a.calls.advance);assert.equal(wrapped.e.tick,original.e.tick);assert.equal(b.calls.finishTrial,a.calls.finishTrial);assert.equal(b.calls.dispose,a.calls.dispose);
  const repeated=b.api.finish(wrapped.e);assert.equal(repeated,wrapped.out);assert.ok(!Object.hasOwn(wrapped.out,'observationPolicy'));
 }
});
test('begin forwards exact original arguments and only records the separately validated switch',()=>{
 const h=harness(),R={},opts={purpose:'residual',eventPrefixOnly:true,prefixMismatchWindow:true};const e=h.api.begin(R,h.req,h.topology,h.settings,opts),call=h.calls.begin[0];
 assert.equal(call.R,R);assert.equal(call.req,h.req);assert.equal(call.topology,h.topology);assert.equal(call.settings,h.settings);assert.equal(call.options,opts);assert.equal(e.prefixMismatchWindow,true);
});
test('first mismatch stops after its outer tick without waiting for a future firstImpact',()=>{
 const h=harness(),{e,out}=complete(h,{prefixMismatchWindow:true});assert.equal(e.tick,2);assert.deepEqual(h.calls.advance,[1,1]);assert.equal(e.firstImpact,undefined);assert.equal(out.firstImpactTime,null);assert.equal(out.firstImpactCell,null);assert.equal(out.contactCell,null);assert.equal(out.steps,2);assert.equal(out.observedSubsteps,6);assert.equal(out.events.length,1);assert.equal(out.mismatch.reason,'unexpected-event');
 assert.equal(out.observationPolicy,'first-mismatch-outer-step-v1');assert.equal(out.contactCellScope,'observed-probe-window');assert.equal(out.freshReplay,false);assert.equal(out.freshWorld,true);
 const baseline=harness(),original=complete(baseline,{},baseline.base);assert.equal(original.e.tick,5);assert.notEqual(original.out.contactCell,null);
 for(const key of ['residuals','inequalities','eventPrefix','residualStage','residualAvailable','clearance','mismatch','stageResiduals'])assert.deepEqual(plain(out[key]),plain(original.out[key]),key);
});
test('all substeps actually observed within the mismatch outer tick remain in the cell scope',()=>{
 const h=harness({firstImpactAt:2}),{e,out}=complete(h,{prefixMismatchWindow:true});assert.equal(e.tick,2);assert.equal(out.events.length,2);assert.equal(out.firstImpactTime,.0202);assert.equal(out.contactCell,JSON.stringify([3,.001,20]));assert.equal(out.contactCellScope,'observed-probe-window');
});
test('first impact before mismatch and ambiguous mismatch metadata are preserved as observed',()=>{
 const h=harness({firstImpactAt:1,ambiguous:true}),{out}=complete(h,{prefixMismatchWindow:true});assert.notEqual(out.contactCell,null);assert.equal(out.mismatch.reason,'ambiguous-simultaneous-events');assert.equal(out.mismatch.actual.length,2);assert.equal(out.verified,false);
});
test('the wrapper only opts in residual, jacobian and trial prefix probes',()=>{
 for(const purpose of ['residual','jacobian','trial']){const h=harness(),r=complete(h,{prefixMismatchWindow:true,purpose});assert.equal(r.e.tick,2);assert.equal(r.out.prefixOnly,true);}
 for(const options of [{eventPrefixOnly:false},{purpose:'verify'},{purpose:'evaluate'},{purpose:'clearance'},{purpose:'other'}]){
  const a=harness(),b=harness(),old=complete(a,options,a.base),now=complete(b,{...options,prefixMismatchWindow:true});
  assert.deepEqual(plain(now.out),plain(old.out));assert.deepEqual(b.calls.advance,[20]);assert.equal(now.e.tick,8);assert.ok(!Object.hasOwn(now.out,'observationPolicy'));
 }
});
test('an explicit finalization owner remains inert and uses the original finish/disposal path',()=>{
 const a=harness({owner:true}),b=harness({owner:true}),old=complete(a,{},a.base),now=complete(b,{prefixMismatchWindow:true});
 assert.deepEqual(plain(now.out),plain(old.out));assert.deepEqual(b.calls.advance,[20]);assert.equal(now.e.tick,8);assert.equal(b.calls.physicalResult,1);assert.equal(b.calls.restoreOwner,1);assert.equal(b.calls.dispose,1);assert.ok(!Object.hasOwn(now.out,'observationPolicy'));
});
test('explicit source-route-query finalization delegates unchanged even without an owner',()=>{
 const a=harness(),b=harness(),finalization={kind:'source-finalization-request-v1',policy:'source-route-query-v1'};
 a.req.finalization={...finalization};b.req.finalization={...finalization};
 const old=complete(a,{},a.base),now=complete(b,{prefixMismatchWindow:true});
 assert.equal(now.e.finalizationOwner,undefined);assert.deepEqual(plain(now.out),plain(old.out));assert.deepEqual(b.calls.advance,[20]);assert.equal(now.e.tick,5);assert.ok(!Object.hasOwn(now.out,'observationPolicy'));assert.equal(now.out.freshReplay,true);
});
test('original finish keeps mismatched partial probes non-certifying even if the trial claims success',()=>{
 const h=harness({success:true}),{e,out}=complete(h,{prefixMismatchWindow:true});
 assert.equal(h.calls.finishTrial,0);assert.equal(out.prefixOnly,true);assert.equal(out.completePhysicalReplay,false);assert.equal(out.physicalResult,null);assert.equal(out.goalVerified,false);assert.equal(out.verified,false);assert.equal(out.physicalGoal,false);assert.equal(out.topologyMatched,false);assert.equal(out.terminationReason,'irreversible-ordered-topology-mismatch');
 const repeated=h.api.finish(e);assert.deepEqual(plain(repeated),plain(out));assert.equal(h.calls.dispose,1);
});
test('ordered-prefix completion is still only a candidate and original fresh verification is unchanged',()=>{
 const prefix=harness({mismatchAt:Infinity,firstImpactAt:1,completeAt:2,success:true}),candidate=complete(prefix,{prefixMismatchWindow:true});assert.equal(candidate.out.physicalGoal,true);assert.equal(candidate.out.verified,false);assert.equal(candidate.out.goalVerified,false);assert.equal(candidate.out.physicalResult,null);assert.equal(candidate.out.freshReplay,false);
 const a=harness({mismatchAt:Infinity,firstImpactAt:1,completeAt:2,success:true}),b=harness({mismatchAt:Infinity,firstImpactAt:1,completeAt:2,success:true});const old=complete(a,{purpose:'verify'},a.base),now=complete(b,{purpose:'verify',prefixMismatchWindow:true});
 assert.deepEqual(plain(now.out),plain(old.out));assert.equal(now.out.verified,true);assert.equal(now.out.freshReplay,true);assert.equal(now.out.physicalResult.success,true);assert.ok(!Object.hasOwn(now.out,'freshWorld'));assert.ok(!Object.hasOwn(now.out,'observationPolicy'));assert.equal(b.calls.finishTrial,1);assert.deepEqual(b.calls.advance,[20]);
});
test('native terminal outcome on the mismatch tick is not relabeled as a partial prefix',()=>{
 const a=harness({nativeDoneAt:2}),b=harness({nativeDoneAt:2}),old=complete(a,{},a.base),now=complete(b,{prefixMismatchWindow:true});assert.deepEqual(plain(now.out),plain(old.out));assert.equal(now.e.tick,2);assert.notEqual(now.out.prefixOnly,true);assert.equal(now.out.freshReplay,true);assert.ok(!Object.hasOwn(now.out,'observationPolicy'));assert.equal(b.calls.finishTrial,1);
});
test('small batch continuation and already-completed calls do not execute extra outer steps',()=>{
 const h=harness(),e=h.begin({prefixMismatchWindow:true});assert.equal(h.api.advance(e,1),false);assert.equal(e.tick,1);assert.throws(()=>h.api.finish(e),/still running/);assert.equal(h.api.advance(e,1),true);const before=h.calls.advance.length;assert.equal(h.api.advance(e,0),true);assert.equal(h.calls.advance.length,before);assert.equal(e.tick,2);
});
test('invalid switches reject before original begin, and invalid active batches reject without stepping',()=>{
 for(const bad of [null,0,1,'true',{},[]]){const h=harness();assert.throws(()=>h.begin({prefixMismatchWindow:bad}),/Boolean/);assert.equal(h.calls.begin.length,0);}
 for(const bad of [0,-1,1.5,NaN,Infinity,'2',null]){const h=harness(),e=h.begin({prefixMismatchWindow:true});assert.throws(()=>h.api.advance(e,bad),/Positive step batch/);assert.equal(e.tick,0);assert.deepEqual(h.calls.advance,[]);const inert=harness(),off=inert.begin({prefixMismatchWindow:false});assert.throws(()=>inert.api.advance(off,bad),/Positive step batch/);assert.equal(off.tick,0);assert.equal(inert.calls.advance.length,1);}
});
test('original finish restores observation hooks, disposes once and stays safe under explicit disposal',()=>{
 const h=harness(),{e}=complete(h,{prefixMismatchWindow:true});assert.equal(e.trial.lab.world.step,h.originalStep);assert.equal(h.calls.restoreMapping,1);assert.equal(h.calls.dispose,1);h.api.dispose(e);assert.equal(h.calls.dispose,1);
 const incomplete=harness(),active=incomplete.begin({prefixMismatchWindow:true});incomplete.api.advance(active,1);incomplete.api.dispose(active);assert.equal(active.done,true);assert.equal(active.disposed,true);assert.equal(active.trial.lab.world.step,incomplete.originalStep);assert.equal(incomplete.calls.restoreMapping,1);assert.equal(incomplete.calls.dispose,1);assert.throws(()=>incomplete.api.finish(active),/disposed without completion/);
});
test('errors raised by the original step retain its disposal and error outcome',()=>{
 const h=harness({throwAt:1}),e=h.begin({prefixMismatchWindow:true});assert.throws(()=>h.api.advance(e,20),/mock step failure/);assert.equal(e.disposed,true);assert.equal(h.calls.dispose,1);assert.equal(e.trial.lab.world.step,h.originalStep);h.api.dispose(e);assert.equal(h.calls.dispose,1);
});
