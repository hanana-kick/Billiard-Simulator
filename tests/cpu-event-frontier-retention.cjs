'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture(options={}){
 const branches=Array.from({length:12},(_,i)=>({id:'b'+String(i).padStart(2,'0'),status:'supported',firstId:2,secondId:3,settings:{angle:i,elevation:5,speed:2,tipX:0,tipY:0},events:[{kind:'object',id:2},{kind:'cushion',rail:'z+'},{kind:'cushion',rail:'x+'},{kind:'cushion',rail:'z-'},{kind:'object',id:3}],prefixRails:[],method:'any'}));
 const ctx={structuredClone,performance,LabInversePlanner:{validate:()=>({})},LabInverseGeometry:{enumerate:()=>branches[Symbol.iterator]()}};
 vm.createContext(ctx);for(const n of ['inverse-solver','inverse-event-window-search'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/'+n+'.js'),'utf8'),ctx);
 const req={snapshot:{objects:[{id:1,radius:.03},{id:2,radius:.03},{id:3,radius:.03}]},selectedId:1,settings:{angle:0,elevation:5,speed:2,tipX:0,tipY:0},options:{mode:'three',spin:true,elevationMode:'fixed',minSpeed:.5,maxSpeed:4.5,solveTimeMs:20000}};
 const api=ctx.LabEventInverseSearchWindow,s=api.create(null,req,{frontier:2,lookahead:4,frontierStepBudget:10,restoreClearance:false,...options});
 function outcome(j,extra={}){return{id:j.topology.id,purpose:j.purpose,settings:plain(j.settings),steps:5,eventPrefix:1,residualStage:1,residuals:[.3,0,0],residualAvailable:true,inequalities:[-1],verified:false,physicalGoal:false,physicalResult:null,prefixOnly:true,...extra};}
 function initialize({near=true}={}){const a=api.next(s);api.accept(s,a.id,outcome(a,{eventPrefix:near?4:3,residualStage:near?4:3,residuals:[.12,0,0]}));const b=api.next(s);api.accept(s,b.id,outcome(b));return s.roots[0];}
 return{api,s,req,outcome,initialize};
}
test('retention keeps best exact continuation and admits a fresh root',()=>{
 const h=fixture({carryBest:true}),best=h.initialize(),other=h.s.roots[1];const j=h.api.next(h.s);
 assert.equal(h.s.epoch,1);assert.equal(h.s.roots[0],best);assert.ok(h.s.dormant.includes(other));assert.equal(h.s.roots.length,2);assert.equal(j.purpose,'residual');assert.notEqual(j.topology.id,best.branch.id);
 h.api.accept(h.s,j.id,h.outcome(j));const derivative=h.api.next(h.s);assert.equal(derivative.purpose,'jacobian');assert.equal(h.s.selected,best);
 h.api.accept(h.s,derivative.id,h.outcome(derivative,{eventPrefix:4,residualStage:4,residuals:[.13,0,0]}));
 const jobs=plain(best.jobs),outcomes=plain(best.outcomes);h.api.next(h.s);assert.equal(h.s.epoch,2);assert.equal(h.s.roots[0],best);assert.deepEqual(plain(best.jobs),jobs);assert.deepEqual(plain(best.outcomes),outcomes);
 assert.equal(new Set([...h.s.roots,...h.s.dormant]).size,h.s.roots.length+h.s.dormant.length);assert.equal(h.s.results.length,0);
});
test('default and false policy preserve original complete frontier rotation',()=>{
 for(const options of [{},{carryBest:false}]){const h=fixture(options);h.initialize();const old=h.s.roots.slice();h.api.next(h.s);assert.equal(h.s.epoch,1);assert.ok(old.every(e=>h.s.dormant.includes(e)));assert.ok(old.every(e=>!h.s.roots.includes(e)));}
});
test('newly stronger observation replaces previous retained root',()=>{
 const h=fixture({carryBest:true}),old=h.initialize(),j=h.api.next(h.s);h.api.accept(h.s,j.id,h.outcome(j,{steps:10,eventPrefix:4,residualStage:4,residuals:[.01,0,0]}));const stronger=h.s.roots.find(e=>e!==old);h.api.next(h.s);assert.equal(h.s.roots[0],stronger);assert.ok(h.s.dormant.includes(old));
});
test('verification takes priority and requires fresh full replay',()=>{
 const h=fixture({carryBest:true}),e=h.initialize();e.state.phase='verify';h.s.physicsSteps=1000;const j=h.api.next(h.s);assert.equal(j.purpose,'verify');assert.equal(h.s.epoch,0);assert.throws(()=>h.api.accept(h.s,j.id,h.outcome(j,{verified:true})),/probe cannot certify/);assert.equal(h.s.results.length,0);
});
test('pause and resume preserve exact outstanding input and partial wave',()=>{
 const h=fixture({carryBest:true});h.initialize();const j=h.api.next(h.s);h.s.paused=true;assert.equal(h.api.next(h.s),null);assert.equal(h.api.resume(h.s),true);assert.deepEqual(plain(h.api.next(h.s)),plain(j));h.api.cancel(h.s);assert.equal(h.api.next(h.s),null);
});
test('retention requires a literal boolean',()=>{assert.throws(()=>fixture({carryBest:'true'}),/Boolean carry/);});
test('bounded carry sends the previous winner dormant with its exact partial wave',()=>{
 const h=fixture({carryBest:true,maxConsecutiveRetentions:1}),best=h.initialize();
 let j=h.api.next(h.s);assert.equal(best.consecutiveRetentions,1);h.api.accept(h.s,j.id,h.outcome(j));
 j=h.api.next(h.s);assert.equal(j.purpose,'jacobian');assert.equal(h.s.selected,best);
 h.api.accept(h.s,j.id,h.outcome(j,{eventPrefix:4,residualStage:4,residuals:[.13,0,0]}));
 const state=best.state,jobs=plain(best.jobs),outcomes=plain(best.outcomes),expected=best.jobs[best.outcomes.length];
 const next=h.api.next(h.s);assert.equal(h.s.epoch,2);assert.ok(h.s.dormant.includes(best));assert.ok(!h.s.roots.includes(best));
 assert.equal(best.consecutiveRetentions,0);assert.equal(best.state,state);assert.deepEqual(plain(best.jobs),jobs);assert.deepEqual(plain(best.outcomes),outcomes);
 // Isolate the dormant-resume path without fabricating solver work: move
 // other admitted roots to dormancy and close the geometry source.
 h.api.accept(h.s,next.id,h.outcome(next));h.s.selected=null;
 h.s.dormant.push(...h.s.roots);h.s.roots=[];h.s.queue=[];h.s.exhausted=true;
 h.s.dormant=h.s.dormant.filter(e=>e!==best);h.s.dormant.unshift(best);
 const resumed=h.api.next(h.s);assert.equal(resumed.topology.id,best.branch.id);assert.equal(resumed.solverId,expected.id);
 assert.equal(best.state,state);assert.deepEqual(plain(best.jobs),jobs);assert.deepEqual(plain(best.outcomes),outcomes);
 h.s.paused=true;assert.equal(h.api.next(h.s),null);h.api.resume(h.s);assert.deepEqual(plain(h.api.next(h.s)),plain(resumed));
});
test('bounded policy limits repeated retention and keeps every admitted root once',()=>{
 for(const limit of [1,2]){
  const h=fixture({carryBest:true,maxConsecutiveRetentions:limit});h.initialize();let epoch=h.s.epoch,previous=null,streak=0,rotations=0;
  for(let i=0;i<80;i++){
   const j=h.api.next(h.s);if(!j)continue;
   if(h.s.epoch!==epoch){
    epoch=h.s.epoch;rotations++;const carried=h.s.roots.find(e=>e.consecutiveRetentions>0);
    if(carried){streak=carried===previous?streak+1:1;assert.ok(streak<=limit);assert.ok(carried.consecutiveRetentions<=limit);}else streak=0;
    previous=carried;
   }
   const all=[...h.s.roots,...h.s.dormant];assert.equal(new Set(all).size,all.length);assert.equal(new Set(all.map(e=>e.branch.id)).size,all.length);assert.equal(all.length,h.s.admitted);
   h.api.accept(h.s,j.id,h.outcome(j,{steps:10,eventPrefix:4,residualStage:4,residuals:[.12,0,0]}));
  }
  assert.ok(rotations>=6);assert.equal(h.s.admitted,12);assert.equal(h.s.results.length,0);
 }
});
test('single-slot frontier cannot exclude fresh admission indefinitely',()=>{
 const h=fixture({frontier:1,carryBest:true,maxConsecutiveRetentions:1});
 let j=h.api.next(h.s);const first=h.s.roots[0];h.api.accept(h.s,j.id,h.outcome(j,{steps:10}));
 j=h.api.next(h.s);assert.equal(h.s.epoch,1);assert.equal(h.s.roots[0],first);assert.equal(first.consecutiveRetentions,1);
 h.api.accept(h.s,j.id,h.outcome(j,{steps:10}));j=h.api.next(h.s);
 assert.equal(h.s.epoch,2);assert.notEqual(j.topology.id,first.branch.id);assert.ok(h.s.dormant.includes(first));assert.equal(h.s.admitted,2);
});
test('bounded carry does not change default or explicit carryBest false traces',()=>{
 function sequence(options){const h=fixture(options);for(let i=0;i<30;i++){const j=h.api.next(h.s);if(j)h.api.accept(h.s,j.id,h.outcome(j));}return plain(h.s.trace);}
 assert.deepEqual(sequence({}),sequence({maxConsecutiveRetentions:1}));
 assert.deepEqual(sequence({carryBest:false}),sequence({carryBest:false,maxConsecutiveRetentions:1}));
});
test('an ineligible retained root still gets independent verification priority',()=>{
 const h=fixture({carryBest:true,maxConsecutiveRetentions:1}),best=h.initialize();
 const fresh=h.api.next(h.s);h.api.accept(h.s,fresh.id,h.outcome(fresh,{steps:10}));
 assert.equal(best.consecutiveRetentions,1);best.state.phase='verify';const epoch=h.s.epoch,j=h.api.next(h.s);
 assert.equal(j.purpose,'verify');assert.equal(j.topology.id,best.branch.id);assert.equal(h.s.epoch,epoch);
 assert.throws(()=>h.api.accept(h.s,j.id,h.outcome(j,{verified:true})),/probe cannot certify/);assert.equal(h.s.results.length,0);
});
test('consecutive retention bound accepts only positive safe integers',()=>{
 for(const maxConsecutiveRetentions of [0,-1,1.5,Infinity,NaN,'1',null,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>fixture({maxConsecutiveRetentions}),/Positive integer consecutive retention/);
 for(const maxConsecutiveRetentions of [1,2,Number.MAX_SAFE_INTEGER])assert.doesNotThrow(()=>fixture({maxConsecutiveRetentions}));
});

test('bounded CPU wrapper defaults to one carry and preserves explicit overrides',()=>{
 const ctx={LabDimensions:{width:2,depth:4},LabEventTailSearchWindow:{create:(R,req,options)=>({options}),result:s=>s}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/inverse-event-window-adaptive-search.js'),'utf8'),ctx);
 const api=ctx.LabCPUEventSearchWindow,req={snapshot:{objects:[{id:1,radius:.03,pos:{x:0,z:0}}]},selectedId:1};
 const defaults=api.create(null,req).options;assert.equal(defaults.maxConsecutiveRetentions,1);assert.equal(defaults.carryBest,true);assert.equal(defaults.preserveFreshFrontier,true);assert.equal(defaults.frontierStepBudget,49152);assert.equal(defaults.lookahead,64);
 assert.equal(api.create(null,req,{maxConsecutiveRetentions:2}).options.maxConsecutiveRetentions,2);
 assert.equal(api.create(null,req,{carryBest:false}).options.carryBest,false);
 assert.equal(api.create(null,req,{preserveFreshFrontier:false}).options.preserveFreshFrontier,false);
 assert.equal(api.create(null,req,{maxConsecutiveRetentions:undefined}).options.maxConsecutiveRetentions,undefined);
});
test('every solver dormancy path resets retention and allows retention after recovery',()=>{
 for(const path of ['empty-jobs','failed-verification']){
  const h=fixture({carryBest:true,maxConsecutiveRetentions:1}),best=h.initialize();
  const fresh=h.api.next(h.s);h.api.accept(h.s,fresh.id,h.outcome(fresh));assert.equal(best.consecutiveRetentions,1);
  if(path==='empty-jobs'){
   // Actual native solver iteration exhaustion, before a Jacobian is issued.
   best.state.options.maxIterations=0;assert.equal(h.api.next(h.s),null);assert.equal(best.state.status,'unconverged');
  }else{
   // Promote through the coordinator's normal physical-goal path, then let
   // the real solver reject a failed independent replay.
   const probe=h.api.next(h.s);assert.equal(h.s.selected,best);
   h.api.accept(h.s,probe.id,h.outcome(probe,{physicalGoal:true,eventPrefix:5,topologyMatched:true}));
   const verify=h.api.next(h.s);assert.equal(verify.purpose,'verify');
   h.api.accept(h.s,verify.id,h.outcome(verify));assert.equal(best.state.status,'unconverged');
  }
  assert.ok(h.s.dormant.includes(best));assert.equal(best.consecutiveRetentions,0);
  // Isolate native dormant recovery; do not change the solver continuation.
  h.s.dormant.push(...h.s.roots);h.s.roots=[];h.s.queue=[];h.s.exhausted=true;h.s.frontier=1;
  h.s.dormant=h.s.dormant.filter(e=>e!==best);h.s.dormant.unshift(best);
  const resumed=h.api.next(h.s);assert.equal(h.s.selected,best);assert.equal(resumed.purpose,'residual');
  h.api.accept(h.s,resumed.id,h.outcome(resumed,{steps:10,eventPrefix:4,residualStage:4,residuals:[.12,0,0]}));
  const epoch=h.s.epoch;h.api.next(h.s);assert.equal(h.s.epoch,epoch+1);assert.equal(h.s.roots[0],best);assert.equal(best.consecutiveRetentions,1);
 }
});
test('extra carry slot preserves baseline fresh width and exact partial state',()=>{
 const h=fixture({carryBest:true,maxConsecutiveRetentions:1,preserveFreshFrontier:true,frontierStepBudget:20});
 let j=h.api.next(h.s);assert.equal(h.s.roots.length,2);const best=h.s.selected;
 h.api.accept(h.s,j.id,h.outcome(j,{steps:10,eventPrefix:4,residualStage:4,residuals:[.12,0,0]}));
 j=h.api.next(h.s);h.api.accept(h.s,j.id,h.outcome(j,{steps:10}));
 const before=h.s.admitted;j=h.api.next(h.s);assert.equal(h.s.epoch,1);assert.equal(h.s.admitted-before,2);assert.equal(h.s.roots.length,3);assert.ok(h.s.roots.includes(best));
 h.api.accept(h.s,j.id,h.outcome(j));j=h.api.next(h.s);h.api.accept(h.s,j.id,h.outcome(j));
 for(let i=0;i<2;i++){j=h.api.next(h.s);assert.equal(h.s.selected,best);assert.equal(j.purpose,'jacobian');h.api.accept(h.s,j.id,h.outcome(j,{eventPrefix:4,residualStage:4,residuals:[.13,0,0]}));}
 const state=best.state,jobs=plain(best.jobs),outcomes=plain(best.outcomes),admitted=h.s.admitted;
 h.api.next(h.s);assert.equal(h.s.epoch,2);assert.equal(h.s.admitted-admitted,2);assert.equal(h.s.roots.length,3);assert.ok(h.s.dormant.includes(best));assert.equal(best.state,state);
 assert.deepEqual(plain(best.jobs),jobs);assert.deepEqual(plain(best.outcomes),outcomes);
 const all=[...h.s.roots,...h.s.dormant];assert.equal(new Set(all).size,all.length);assert.equal(all.length,h.s.admitted);
});
test('extra-slot policy keeps active roots bounded and never loses admitted roots',()=>{
 for(const frontier of [1,2,4]){
  const h=fixture({frontier,lookahead:12,carryBest:true,maxConsecutiveRetentions:1,preserveFreshFrontier:true});
  for(let i=0;i<80;i++){
   const j=h.api.next(h.s);assert.ok(h.s.roots.length<=frontier+1);if(h.s.epoch===0)assert.ok(h.s.roots.length<=frontier);
   const all=[...h.s.roots,...h.s.dormant];assert.equal(new Set(all).size,all.length);assert.equal(new Set(all.map(e=>e.branch.id)).size,all.length);assert.equal(all.length,h.s.admitted);
   if(j)h.api.accept(h.s,j.id,h.outcome(j,{steps:10,eventPrefix:4,residualStage:4,residuals:[.12,0,0]}));
  }
  assert.equal(h.s.admitted,12);assert.equal(h.s.results.length,0);
 }
});
test('extra-slot option false or no carry preserves the original admission traces',()=>{
 function sequence(options){const h=fixture(options);for(let i=0;i<30;i++){const j=h.api.next(h.s);if(j)h.api.accept(h.s,j.id,h.outcome(j));}return plain(h.s.trace);}
 for(const options of [{},{carryBest:false},{carryBest:true},{carryBest:true,maxConsecutiveRetentions:1}])assert.deepEqual(sequence(options),sequence({...options,preserveFreshFrontier:false}));
 assert.deepEqual(sequence({}),sequence({preserveFreshFrontier:true}));
 assert.deepEqual(sequence({carryBest:false}),sequence({carryBest:false,preserveFreshFrontier:true}));
 for(const preserveFreshFrontier of ['true',1,null])assert.throws(()=>fixture({preserveFreshFrontier}),/Boolean fresh frontier/);
});
