'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function harness(script=[],config={}){
 let worlds=0,disposed=0;
 const ball=(id,x=0,y=.03,z=0)=>({id,collider:{id},radius:.03,shape:'sphere',body:{translation:()=>({x,y,z})}});
 const context={performance,PhysicsLab:{fromSnapshot(){worlds++;return{get:id=>ball(id),cueClearance(){if(config.clearanceThrows)throw new Error('clearance query failed');return{distance:config.clearanceDistance??.02,clear:(config.clearanceDistance??.02)>=0};},dispose(){disposed++;}};}},LabRouteRules:{railId:o=>o.rail},ShotSearchCore:{
  validate(){},
  beginTrial(search,settings){if(config.forbidStrike)throw new Error('Static clearance may not begin a stroke');worlds++;assert.equal(search.req.options.elevationMode,'fixed');assert.equal(search.req.settings.elevation,settings.elevation);
   if(config.blocked){search.feasibility={distance:config.blocked};return null;}
   const objects=[ball(1,-.2),ball(2,0),ball(3,.5)];
   const lab={time:0,objects,statics:['x+','x-','z+','z-'].map(rail=>({kind:'cushion',rail,collider:{rail,projectPoint:p=>({point:{...p,x:rail==='x+'?1:rail==='x-'?-1:p.x,z:rail==='z+'?1:rail==='z-'?-1:p.z}})}})),get:id=>objects.find(o=>o.id===id),cueClearance:()=>({distance:.02,clear:true}),dispose(){disposed++;},onEvent(){},impacts:[],world:{integrationParameters:{dt:.01},step(){},contactPair(a,b,fn){if(lab.impacts.some(e=>b.rail?e.kind==='cushion'&&e.rail===b.rail:e.kind==='object'&&e.id===b.id))fn({numContacts:()=>1,contactImpulse:()=>1});}}};
   return{lab,steps:0,start:0,settings};
  },
  stepTrial(search,t,batch){assert.equal(batch,1);const outer=script[t.steps++]||{};
   for(const step of outer.substeps||[outer]){
    t.lab.impacts=step.impacts||step.events||[];
    for(const [id,pos] of Object.entries(step.positions||{}))t.lab.get(+id).body.translation=()=>({...pos});
    t.lab.world.step();t.lab.time+=t.lab.world.integrationParameters.dt;
    for(const event of step.events||[])t.lab.onEvent({kind:'contact',time:t.lab.time,a:{id:1},b:event.kind==='object'?{id:event.id,kind:'ball'}:{kind:'cushion',rail:event.rail}});
   }
   return t.steps>=script.length;
  },
  finishTrial(search,t){t.lab.dispose();return{success:config.success??true,failureReason:config.failureReason,settings:t.settings};}
 }};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/inverse-events.js'),'utf8'),context);
 const settings={angle:0,elevation:8,speed:2,tipX:0,tipY:0};
 const req={settings,selectedId:1,options:{elevationMode:'search',spin:true}};
 return{api:context.LabInverseEvents,req,settings,worlds:()=>worlds,disposed:()=>disposed};
}
const object=id=>({kind:'object',id}),rail=rail=>({kind:'cushion',rail});
function run(h,events,options){const e=h.api.begin(null,h.req,{id:'branch',events},h.settings,options);while(!h.api.advance(e,2));return h.api.finish(e);}
test('only a separate verification-purpose fresh replay certifies a solution',()=>{
 const h=harness([{events:[object(2)]},{events:[object(3)]}]);
 const a=run(h,[object(2),object(3)]),b=run(h,[object(2),object(3)],{purpose:'verify'});
 assert.equal(a.goalVerified,true);assert.equal(a.verified,false);assert.equal(b.verified,true);assert.equal(h.worlds(),2);assert.equal(h.disposed(),2);assert.equal(b.eventPrefix,2);
});
test('first target misses expose signed 3D residual and unreachable later stages',()=>{
 const h=harness([{positions:{1:{x:0,y:.15,z:.08}}}],{success:false});
 const r=run(h,[object(2),object(3)]);assert.equal(r.eventPrefix,0);assert.equal(r.residualStage,0);assert.ok(r.residuals[1]>0);assert.ok(r.residuals[2]>0);assert.equal(r.stageResiduals[1],null);assert.equal(r.status,'missing-event');
});
test('residual side changes continuously without losing vertical miss',()=>{
 const h=harness();const target={radius:.03,body:{translation:()=>({x:0,y:.03,z:0})}};
 const a=h.api.sphereResidual({radius:.03,body:{translation:()=>({x:0,y:.1,z:.08})}},target);
 const b=h.api.sphereResidual({radius:.03,body:{translation:()=>({x:0,y:.1,z:-.08})}},target);
 assert.ok(a[1]>0&&b[1]>0);assert.equal(a[2],-b[2]);
});
test('illegal early second-target near pass cannot become final-stage residual',()=>{
 const h=harness([{events:[object(2)],positions:{1:{x:.49,y:.03,z:0}}},{events:[rail('x+')]},{events:[rail('z+')]},{events:[rail('x-')],positions:{1:{x:-.7,y:.03,z:0}}}],{success:false});
 const r=run(h,[object(2),rail('x+'),rail('z+'),rail('x-'),object(3)]);
 assert.equal(r.eventPrefix,4);assert.equal(r.residualStage,4);assert.ok(Math.hypot(...r.residuals)>1);assert.equal(r.stageResiduals[4][0],r.residuals[0]);
});
test('wrong intermediate wall freezes prefix and prevents physical false-positive',()=>{
 const h=harness([{events:[object(2)]},{events:[rail('z+')]},{events:[object(3)]}]);
 const r=run(h,[object(2),rail('x+'),object(3)]);assert.equal(r.topologyMatched,false);assert.equal(r.goalVerified,false);assert.equal(r.eventPrefix,1);assert.equal(r.status,'topology-mismatch');assert.equal(r.stageResiduals[2],null);
});
test('simultaneous distinct events are ambiguous rather than ordered by callback',()=>{
 const h=harness([{events:[object(2),rail('x+')]},{events:[object(3)]}]);const r=run(h,[object(2),rail('x+'),object(3)]);assert.equal(r.eventPrefix,0);assert.equal(r.mismatch.reason,'ambiguous-simultaneous-events');
});
test('actual signed clearance is an inequality, not a binary search penalty',()=>{
 const h=harness([],{blocked:-.012});const r=run(h,[object(2)]);assert.equal(r.inequalities[0],.012);assert.equal(r.clearance,-.012);assert.equal(r.residualStage,'clearance');assert.equal(r.goalVerified,false);assert.equal(r.steps,0);
});
test('full-shot and cue-tail physical failures cannot be overridden by matched topology',()=>{
 for(const failureReason of ['four-ball-opponent-or-off-table','four-ball-shot-incomplete','cue-tail-incomplete','cue-obstruction','invalid-contact-or-table-state']){
  const h=harness([{events:[object(2)]},{events:[object(3)]},{events:[object(4)]}],{success:false,failureReason});const r=run(h,[object(2),object(3)],{purpose:'verify'});
  assert.equal(r.topologyMatched,true);assert.equal(r.verified,false);assert.equal(r.status,failureReason);assert.equal(r.steps,3);
 }
});
test('strict input settings never silently restore elevation or ignore spin bounds',()=>{
 const h=harness([{events:[object(2)]}]);h.req.options.spin=false;h.settings.tipX=.1;const r=run(h,[object(2)]);assert.ok(r.inequalities.at(-1)>0);assert.equal(r.verified,false);assert.equal(r.settings.tipX,.1);
});
test('finish requires completion, is idempotent, and disposal releases the world',()=>{
 const h=harness([{},{}]);const e=h.api.begin(null,h.req,{events:[object(2)]},h.settings);assert.throws(()=>h.api.finish(e),/still running/);h.api.advance(e,2);const r=h.api.finish(e);assert.equal(h.api.finish(e),r);assert.equal(h.disposed(),1);
 const other=h.api.begin(null,h.req,{events:[object(2)]},h.settings);h.api.dispose(other);h.api.dispose(other);assert.equal(h.disposed(),2);
});
test('actual PhysicsLab target solution replays independently; wrong rail cannot certify it',{skip:process.env.INVERSE_EVENTS_PHYSICS!=='1'},async()=>{
 const R=require('@dimforge/rapier3d-compat');await R.init();for(const name of ['math','physics','route-rules','optimizer-core','inverse-events'])require('../src/'+name+'.js');
 const lab=new PhysicsLab(R);
 try{
  const cue=lab.get(1).body.translation(),target=lab.get(2).body.translation();
  const settings={angle:Math.atan2(target.z-cue.z,target.x-cue.x)*180/Math.PI,elevation:8,speed:2,tipX:0,tipY:0};
  const req={snapshot:lab.snapshot({trails:false}),selectedId:1,settings,options:{mode:'target',targetId:2,secondId:3,budget:48,horizon:8,spin:false,objective:'shortest',elevationMode:'search',allowKiss:true}};
  const replay=(topology,extra={})=>{const e=LabInverseEvents.begin(R,req,topology,settings,extra);while(!LabInverseEvents.advance(e,240));return LabInverseEvents.finish(e);};
  const a=replay({events:[object(2)]}),b=replay({events:[object(2)]},{purpose:'verify'});
  assert.equal(a.goalVerified,true,JSON.stringify(a));assert.equal(a.verified,false);assert.equal(b.verified,true,JSON.stringify(b));assert.deepEqual(b.settings,settings);assert.deepEqual(b.events,a.events);assert.equal(b.steps,a.steps);
  const miss=replay({events:[rail('z+'),object(2)]});assert.equal(miss.goalVerified,false);assert.equal(miss.eventPrefix,0);assert.equal(miss.status,'topology-mismatch');assert.ok(miss.residuals.every(Number.isFinite));assert.equal(miss.stageResiduals[1],null);
 }finally{lab.dispose();}
});
test('actual reversed UI order and method use the branch goal, not the UI default',{skip:process.env.INVERSE_EVENTS_PHYSICS!=='1'},async()=>{
 const R=require('@dimforge/rapier3d-compat');await R.init();for(const name of ['math','physics','route-rules','optimizer-core','inverse-events'])require('../src/'+name+'.js');
 const lab=new PhysicsLab(R);try{
  const settings={angle:-1.09069,elevation:8,speed:4.5,tipX:0,tipY:.15};
  const req={snapshot:lab.snapshot({trails:false}),selectedId:1,settings,options:{mode:'three',targetId:3,secondId:2,methodId:'direct',methods:['direct','any'],horizon:16,spin:true,objective:'shortest',elevationMode:'search',allowKiss:true}};
  const branch={firstId:2,secondId:3,method:'any',events:[object(2),object(3)]};
  const run=branch=>{const e=LabInverseEvents.begin(R,req,branch,settings,{purpose:'verify'});while(!LabInverseEvents.advance(e,240));return LabInverseEvents.finish(e);};
  const observation=run(branch);assert.equal(observation.physicalResult.success,true,JSON.stringify(observation));assert.equal(observation.verified,false);
  const exact={...branch,events:observation.physicalResult.contacts.map(e=>e.kind==='object'?object(e.id):rail(e.rail))};
  const replay=run(exact);assert.equal(replay.verified,true,JSON.stringify(replay));assert.equal(replay.physicalResult.firstId,2);assert.equal(replay.physicalResult.secondId,3);assert.equal(replay.physicalResult.method,'any');assert.equal(req.options.targetId,3);assert.equal(req.options.methodId,'direct');
 }finally{lab.dispose();}
});
test('actual blocked cue clearance retains a continuous elevation gradient with no pose restoration',{skip:process.env.INVERSE_EVENTS_PHYSICS!=='1'},async()=>{
 const R=require('@dimforge/rapier3d-compat');await R.init();for(const name of ['math','physics','route-rules','optimizer-core','inverse-events'])require('../src/'+name+'.js');
 const lab=new PhysicsLab(R);try{
  const settings={angle:0,elevation:0,speed:2,tipX:0,tipY:0};
  const req={snapshot:lab.snapshot({trails:false}),selectedId:1,settings,options:{mode:'target',targetId:2,secondId:3,horizon:8,spin:false,objective:'shortest',elevationMode:'search',minElevation:0,maxElevation:85}};
  const values=[0,1,2].map(elevation=>{const e=LabInverseEvents.begin(R,req,{events:[object(2)]},{...settings,elevation});assert.equal(e.done,true);const r=LabInverseEvents.finish(e);assert.equal(r.status,'cue-clearance');assert.equal(r.settings.elevation,elevation);assert.equal(r.settings.tipX,0);assert.equal(r.settings.tipY,0);assert.equal(r.steps,0);assert.equal(r.inequalities[0],-r.clearance);return r.inequalities[0];});
  assert.ok(values[0]>values[1]&&values[1]>values[2]&&values[2]>0,JSON.stringify(values));
 }finally{lab.dispose();}
});
test('impulse episodes expose quick sphere recontact suppressed by presentation debounce',()=>{
 const h=harness([{positions:{1:{x:-.06,y:.03,z:0}},events:[object(2)]},{positions:{1:{x:-.08,y:.03,z:0}}},{positions:{1:{x:-.06,y:.03,z:0}},events:[],impacts:[object(2)]},{events:[object(3)]}]);
 const r=run(h,[object(2),object(3)]);assert.equal(r.status,'topology-mismatch');assert.equal(r.mismatch.actual.id,2);assert.equal(r.eventPrefix,1);assert.equal(r.events.filter(e=>e.id===2).length,2);assert.equal(r.goalVerified,false);assert.equal(r.eventResolution,'solver-substep');assert.equal(r.substepOrderResolved,true);
});
test('persistent impulses are one episode, but separated cushion recontacts are distinct',()=>{
 const h=harness([{positions:{1:{x:.97,y:.03,z:0}},events:[rail('x+')]},{impacts:[rail('x+')]},{positions:{1:{x:.9,y:.03,z:0}}},{positions:{1:{x:.97,y:.03,z:0}},impacts:[rail('x+')]}]);
 const r=run(h,[rail('x+'),object(2)]);assert.equal(r.events.length,2);assert.equal(r.mismatch.actual.rail,'x+');assert.equal(r.eventPrefix,1);
});
test('distinct impulse episodes in one solver substep are ambiguous even without visible events',()=>{
 const h=harness([{events:[],impacts:[object(2),rail('x+')]}]);const r=run(h,[object(2),rail('x+')]);assert.equal(r.mismatch.reason,'ambiguous-simultaneous-events');assert.equal(r.eventPrefix,0);assert.equal(r.goalVerified,false);
});
test('a required repeat has no zero residual during persistent contact or departure',()=>{
 for(const steps of [[{positions:{1:{x:-.06,y:.03,z:0}},events:[object(2)]},{impacts:[object(2)]}],[{positions:{1:{x:-.06,y:.03,z:0}},events:[object(2)]},{positions:{1:{x:-.08,y:.03,z:0}}},{positions:{1:{x:-.1,y:.03,z:0}}}]]){
  const h=harness(steps,{success:false}),r=run(h,[object(2),object(2),object(3)]);assert.equal(r.eventPrefix,1);assert.equal(r.residualAvailable,false);assert.equal(r.stageResiduals[1],null);assert.equal(r.verified,false);
 }
 const h=harness([{positions:{1:{x:-.06,y:.03,z:0}},events:[object(2)]},{positions:{1:{x:-.1,y:.03,z:0}}},{positions:{1:{x:-.08,y:.03,z:0}}}],{success:false});
 const r=run(h,[object(2),object(2)]);assert.equal(r.residualAvailable,true);assert.ok(Math.hypot(...r.residuals)>0);assert.equal(r.eventPrefix,1);
});
test('actual quick sphere recontact survives presentation debounce',{skip:process.env.INVERSE_EVENTS_PHYSICS!=='1'},async()=>{
 const R=require('@dimforge/rapier3d-compat');await R.init();for(const name of ['math','physics','route-rules','optimizer-core','inverse-events'])require('../src/'+name+'.js');
 const lab=new PhysicsLab(R);try{
  // Fixture placement only. Cue strike and all moving-body velocities remain
  // exclusively authoritative PhysicsLab dynamics.
  for(const [id,x,z] of [[1,.9,0],[2,1.25,0],[3,-.4,.4]])lab.get(id).body.setTranslation({x,y:.03075,z},true);
  lab.world.propagateModifiedBodyPositionsToColliders();
  const settings={angle:0,elevation:8,speed:4.5,tipX:0,tipY:0};
  const req={snapshot:lab.snapshot({trails:false}),selectedId:1,settings,options:{mode:'carom',targetId:2,secondId:3,horizon:8,spin:false,objective:'shortest',elevationMode:'fixed',allowKiss:true}};
  const e=LabInverseEvents.begin(R,req,{firstId:2,secondId:3,method:'carom',events:[object(2),object(3)]},settings);while(!LabInverseEvents.advance(e,240));const r=LabInverseEvents.finish(e);
  const contacts=r.events.filter(e=>e.kind==='object'&&e.id===2),visible=r.physicalResult.contacts.filter(e=>e.kind==='object'&&e.id===2);
  assert.ok(contacts.length>=2);assert.ok(contacts[1].time-contacts[0].time<.12);assert.ok(!visible.some(e=>Math.abs(e.time-contacts[1].time)<.01));assert.equal(r.mismatch.actual.id,2);assert.equal(r.verified,false);assert.equal(r.eventPrefix,1);
 }finally{lab.dispose();}
});
test('transient impulses inside one outer step are observed and substep order is retained',()=>{
 const h=harness([{substeps:[{positions:{1:{x:-.06,y:.03,z:0}},impacts:[object(2)]},{positions:{1:{x:-.08,y:.03,z:0}}},{positions:{1:{x:-.06,y:.03,z:0}},impacts:[object(2)]},{}]}]);
 const r=run(h,[object(2),object(3)]);assert.equal(r.steps,1);assert.equal(r.observedSubsteps,4);assert.equal(r.events.length,2);assert.equal(r.events[0].time,.01);assert.equal(r.events[1].time,.03);assert.equal(r.mismatch.actual.id,2);
 const ordered=harness([{substeps:[{impacts:[object(2)]},{impacts:[object(3)]},{}]}]);const valid=run(ordered,[object(2),object(3)]);assert.equal(valid.goalVerified,true);assert.equal(valid.events.length,2);assert.ok(valid.events[0].time<valid.events[1].time);
});
test('actual early-cue substep observation preserves uninstrumented replay state exactly',{skip:process.env.INVERSE_EVENTS_PHYSICS!=='1'},async(t)=>{
 const R=require('@dimforge/rapier3d-compat');await R.init();for(const name of ['math','physics','route-rules','optimizer-core','inverse-events'])require('../src/'+name+'.js');
 const lab=new PhysicsLab(R);try{
  const p=lab.get(1).body.translation();lab.get(2).body.setTranslation({x:p.x+.09,y:p.y,z:p.z},true);lab.world.propagateModifiedBodyPositionsToColliders();
  const settings={angle:0,elevation:8,speed:2,tipX:0,tipY:0};
  const req={snapshot:lab.snapshot({trails:false}),selectedId:1,settings,options:{mode:'target',targetId:2,secondId:3,horizon:8,spin:false,objective:'shortest',elevationMode:'fixed',allowKiss:true}};
  const state=t=>t.lab.objects.map(o=>({id:o.id,pos:o.body.translation(),v:o.body.linvel(),w:o.body.angvel(),rot:o.body.rotation()}));
  const e=LabInverseEvents.begin(R,req,{events:[object(2)]},settings,{purpose:'verify'}),original=e.originalWorldStep;
  assert.notEqual(e.trial.lab.world.step,original);
  const instrumentedStart=performance.now();while(!LabInverseEvents.advance(e,240));const instrumentedMs=performance.now()-instrumentedStart,observed=state(e.trial),elapsed=e.trial.lab.time;
  const result=LabInverseEvents.finish(e);assert.equal(result.verified,true,JSON.stringify(result));assert.ok(result.events[0].time<.22);assert.ok(Math.abs(result.events[0].time-result.physicalResult.contacts[0].time)<1e-9,JSON.stringify({raw:result.events[0].time,visible:result.physicalResult.contacts[0].time,dt:req.snapshot.dt}));assert.ok(result.observedSubsteps>result.steps);assert.equal(e.trial.lab.world.step,original);
  const search={R,req:{...req,testBudget:true,options:{...req.options,budget:1}},count:1,pool:[],successes:[],evaluated:0,rejected:0,successCount:0,started:performance.now()};
  const replay=ShotSearchCore.beginTrial(search,settings);assert.equal(replay.lab.world.step,original);const plainStart=performance.now();while(!ShotSearchCore.stepTrial(search,replay,240));const plainMs=performance.now()-plainStart;
  t.diagnostic(JSON.stringify({fixture:"early-cue",instrumentedMs,plainMs,steps:result.steps,solverSubsteps:result.observedSubsteps}));
  assert.deepEqual(state(replay),observed);assert.equal(replay.lab.time,elapsed);assert.equal(replay.steps,result.steps);const plain=ShotSearchCore.finishTrial(search,replay);assert.deepEqual(plain.settings,result.settings);assert.deepEqual(plain.contacts,result.physicalResult.contacts);assert.equal(plain.success,true);
 }finally{lab.dispose();}
});
test('relative-segment residual removes nearest-sample phase jitter analytically',()=>{
 const h=harness(),target={x:0,y:0,z:0};
 for(const phase of [-.001,-.0005,0,.0005,.001]){
  const r=h.api.relativeSegmentResidual({x:-.0025+phase,y:.1,z:0},target,{x:.0025+phase,y:.1,z:0},target,.06);
  assert.ok(Math.abs(r[0])<1e-14);assert.ok(Math.abs(r[1]-.04)<1e-14);assert.equal(r[2],0);
 }
});
test('relative-segment residual uses target motion, not a frozen target center',()=>{
 const h=harness(),cue={x:0,y:.1,z:0},t0={x:-.02,y:0,z:0},t1={x:.02,y:0,z:0};
 const moving=h.api.relativeSegmentResidual(cue,t0,cue,t1,.06),frozen=h.api.relativeSegmentResidual(cue,t0,cue,t0,.06);
 assert.ok(Math.abs(moving[0])<1e-14);assert.ok(Math.abs(moving[1]-.04)<1e-14);assert.ok(frozen[0]>0);assert.ok(Math.hypot(...frozen)>Math.hypot(...moving));
 // Equal translation of both bodies must not create artificial relative motion.
 const parallel=h.api.relativeSegmentResidual({x:0,y:.1,z:0},{x:0,y:0,z:0},{x:.2,y:.1,z:0},{x:.2,y:0,z:0},.06);
 assert.ok(Math.abs(parallel[1]-.04)<1e-14);assert.equal(parallel[0],0);
});
test('an interpolated sphere crossing without raw impulse never advances or verifies',()=>{
 const h=harness([{positions:{1:{x:.2,y:.03,z:0}},impacts:[]}]);const r=run(h,[object(2)],{purpose:'verify'});
 assert.equal(Math.hypot(...r.residuals),0);assert.equal(r.residualAvailable,true);assert.equal(r.eventPrefix,0);assert.equal(r.events.length,0);assert.equal(r.status,'missing-event');assert.equal(r.topologyMatched,false);assert.equal(r.goalVerified,false);assert.equal(r.verified,false);
});
test('object measurement never interpolates across an unexpected contact boundary',()=>{
 const h=harness([{positions:{1:{x:.2,y:.03,z:0}},impacts:[rail('x+')]}]);const r=run(h,[object(2)]);
 assert.equal(r.status,'topology-mismatch');assert.ok(Math.hypot(...r.residuals)>.1);assert.equal(r.eventPrefix,0);
});
test('first-impact cell is raw solver-time metadata and ignores later rail timing',()=>{
 const a=run(harness([{impacts:[object(2)]},{impacts:[rail('x+')]},{impacts:[object(3)]}]),[object(2),rail('x+'),object(3)]);
 const b=run(harness([{impacts:[object(2)]},{},{impacts:[rail('x+')]},{impacts:[object(3)]}]),[object(2),rail('x+'),object(3)]);
 const shifted=run(harness([{}, {impacts:[object(2)]},{impacts:[rail('x+')]},{impacts:[object(3)]}]),[object(2),rail('x+'),object(3)]);
 assert.equal(a.firstImpactCell,JSON.stringify([2,.01,1]));assert.equal(a.firstImpactCell,b.firstImpactCell);assert.notEqual(a.firstImpactCell,shifted.firstImpactCell);assert.equal(a.contactCell,a.firstImpactCell);assert.equal(a.firstImpactTime,.01);assert.equal(shifted.firstImpactTime,.02);
 assert.equal(a.events[0].stepDt,.01);assert.equal(a.events[0].stepIndex,1);
 const none=run(harness([{}],{success:false}),[object(2)]);assert.equal(none.firstImpactCell,null);assert.equal(none.firstImpactTime,null);
 const substep=run(harness([{substeps:[{}, {impacts:[object(2)]},{}]}]),[object(2)]);assert.equal(substep.firstImpactCell,JSON.stringify([2,.01,2]));assert.equal(substep.events[0].stepIndex,2);assert.equal(substep.steps,1);
});
test('clearance-only queries dispose fresh worlds without strike or physical certification',()=>{
 for(const distance of [-.012,.025]){
  const h=harness([],{forbidStrike:true,clearanceDistance:distance});h.req.options.maxElevation=5;h.settings.elevation=8;
  const r=run(h,[object(2)],{purpose:'clearance'});assert.equal(r.clearance,distance);assert.equal(r.inequalities[0],-distance);assert.ok(r.inequalities.some(x=>x===3));assert.equal(r.steps,0);assert.equal(r.observedSubsteps,0);assert.equal(r.events.length,0);assert.equal(r.residualStage,'clearance');assert.equal(r.residualAvailable,false);assert.equal(r.goalVerified,false);assert.equal(r.verified,false);assert.equal(r.physicalResult,null);assert.equal(h.worlds(),1);assert.equal(h.disposed(),1);assert.equal(r.status,distance>=0?'clearance-feasible':'cue-clearance');
 }
 const h=harness([],{forbidStrike:true,clearanceThrows:true});assert.throws(()=>run(h,[object(2)],{purpose:'clearance'}),/clearance query failed/);assert.equal(h.disposed(),1);
});
test('actual static clearance query preserves source snapshot and bounds without any stroke',{skip:process.env.INVERSE_EVENTS_PHYSICS!=='1'},async()=>{
 const R=require('@dimforge/rapier3d-compat');await R.init();for(const name of ['math','physics','route-rules','optimizer-core','inverse-events'])require('../src/'+name+'.js');
 const lab=new PhysicsLab(R);try{
  const cue=lab.get(1);cue.body.setTranslation({x:-1.37,y:cue.radius+.00005,z:-.66},true);lab.world.propagateModifiedBodyPositionsToColliders();
  const settings={angle:45,elevation:0,speed:2,tipX:0,tipY:0},snapshot=lab.snapshot({trails:false}),bytes=Buffer.from(lab.world.takeSnapshot());
  const req={snapshot,selectedId:1,settings,options:{mode:'target',targetId:2,secondId:3,horizon:8,spin:true,objective:'shortest',elevationMode:'search',minElevation:0,maxElevation:60}};
  for(const elevation of [0,60,70]){
   const candidate={...settings,elevation},expected=lab.cueClearance(cue,candidate),e=LabInverseEvents.begin(R,req,{events:[object(2)]},candidate,{purpose:'clearance'});
   assert.equal(e.done,true);assert.equal(e.trial,undefined);const r=LabInverseEvents.finish(e);assert.equal(r.clearance,expected.distance);assert.equal(r.steps,0);assert.equal(r.verified,false);assert.equal(r.goalVerified,false);assert.equal(r.physicalResult,null);if(elevation>60)assert.ok(r.inequalities.includes(elevation-60));
  }
  assert.equal(lab.shots,0);assert.deepEqual(Buffer.from(lab.world.takeSnapshot()),bytes);
 }finally{lab.dispose();}
});
