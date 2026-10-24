'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
require('../src/inverse-solver.js');const S=globalThis.LabInverseSolver;
const seed={angle:4,elevation:12,speed:2,tipX:.1,tipY:-.1};
const problem=(extra={})=>({id:'toy',seed:{...seed},topology:{events:['first','second']},...extra});
function run(s,fn,reverse=false){let calls=0;while(s.status==='running'&&calls++<2000){const batch=S.next(s);if(!batch.length)break;const outcomes=batch.map(p=>({id:p.id,...fn(p.settings,p)}));S.accept(s,reverse?outcomes.reverse():outcomes);}assert.ok(calls<2000);return S.result(s);}
const target={angle:20,elevation:25,speed:3,tipX:.2,tipY:.3};
const linear=(x,p)=>({residuals:Object.keys(target).map(k=>(x[k]-target[k])/(k==='angle'?30:k==='elevation'?20:1)),verified:p.purpose==='verify'});
test('a single deterministic normalized root reaches known five-input solution and requires replay',()=>{const s=S.create(problem());const r=run(s,linear);assert.equal(r.status,'verified');for(const k in target)assert.ok(Math.abs(r.settings[k]-target[k])<.001,k);assert.ok(s.evaluations>1);});
test('bounded nonlinear solve and inequality residuals',()=>{const s=S.create(problem({bounds:{angle:[0,30]}}));const r=run(s,(x,p)=>({residuals:[(x.angle*x.angle-100)/100,x.speed-2],inequalities:[x.tipX-.05],verified:p.purpose==='verify'}));assert.equal(r.status,'verified');assert.ok(Math.abs(r.settings.angle-10)<.001);assert.ok(r.settings.tipX<=.05001);});
test('box plus radial projection never issues infeasible tip settings',()=>{const s=S.create(problem({seed:{...seed,tipX:.8,tipY:.8},bounds:{tipX:[.5,.8],tipY:[.2,.8]},tipRadius:.85}));const batch=S.next(s);assert.ok(Math.hypot(batch[0].settings.tipX,batch[0].settings.tipY)<=.85000000001);assert.ok(batch[0].settings.tipX>=.5&&batch[0].settings.tipY>=.2);});
test('proof-only infeasibility and stationary infeasible target are distinct',()=>{assert.equal(S.create(problem({bounds:{tipX:[.8,.9],tipY:[.8,.9]},tipRadius:.85})).status,'infeasible');const r=run(S.create(problem({bounds:{angle:[0,10]}})),x=>({residuals:[x.angle-20]}));assert.equal(r.status,'unconverged');assert.equal(r.settings.angle,10);});
test('singular constant residual is not mislabeled impossible',()=>{const r=run(S.create(problem()),()=>({residuals:[1,1]}));assert.equal(r.status,'unconverged');assert.match(r.reason,/Stationary/);});
test('residual convergence alone cannot bypass full-shot physical validation',()=>{const r=run(S.create(problem()),(x,p)=>({residuals:[0],verified:false,reason:p.purpose==='verify'?'Opponent contacted after goal':undefined}));assert.equal(r.status,'unconverged');assert.match(r.reason,/Opponent/);});
test('physical goal requests independent replay despite nonzero geometric residual',()=>{const purposes=[];const r=run(S.create(problem()),(x,p)=>{purposes.push(p.purpose);return {residuals:[1],goalVerified:true,verified:p.purpose==='verify'};});assert.equal(r.status,'verified');assert.deepEqual(purposes,['residual','verify']);});
test('serialized continuation and reversed/partial wave completion are deterministic',()=>{const a=S.create(problem()),b=S.create(problem());const ra=run(a,linear);S.accept(b,S.next(b).map(p=>({id:p.id,...linear(p.settings,p)})));const wave=S.next(b);assert.deepEqual(S.next(b),wave);S.accept(b,[{id:wave[2].id,...linear(wave[2].settings,wave[2])}]);const c=JSON.parse(JSON.stringify(b));const rb=run(c,linear,true);assert.deepEqual(rb,ra);});
test('cancel and deadline return resumable controls, never physical failure',()=>{const s=S.create(problem());S.next(s);S.cancel(s);assert.equal(S.result(s).status,'cancelled');assert.equal(run(S.resume(s),linear).status,'verified');const t=S.create(problem(),{deadline:Date.now()-1});assert.deepEqual(S.next(t),[]);assert.equal(t.status,'time-limit');assert.equal(run(S.resume(t),linear).status,'verified');});
test('iteration exhaustion remains unconverged and can continue exact iterate',()=>{const s=S.create(problem(),{maxIterations:1});assert.equal(run(s,linear).status,'unconverged');assert.equal(run(S.resume(s,{maxIterations:60}),linear).status,'verified');});
test('finite noisy residual and invalid derivatives terminate without false proof',()=>{const r=run(S.create(problem(),{maxIterations:4,residualTolerance:1e-12}),x=>({residuals:[x.angle-10+1e-3*Math.sin(x.angle*1e4)]}));assert.ok(['unconverged','verified'].includes(r.status));const invalid=run(S.create(problem()),(x,p)=>({residuals:p.purpose==='jacobian'?[NaN]:[1]}));assert.equal(invalid.status,'unconverged');});
test('higher-prefix derivative is adopted as stage continuation, never differenced',()=>{const s=S.create(problem({seed:{...seed,angle:0},bounds:{angle:[0,1],elevation:[12,12],speed:[2,2],tipX:[.1,.1],tipY:[-.1,-.1]}}));const r=run(s,(x,p)=>({residuals:x.angle>0?[x.angle-.5]:[10],eventPrefix:x.angle>0?1:0,residualStage:x.angle>0?1:0,goalVerified:Math.abs(x.angle-.5)<1e-5,verified:p.purpose==='verify'}));assert.equal(r.status,'verified');assert.ok(Math.abs(r.settings.angle-.5)<1e-4);});
test('incompatible lower-stage probes never make a cross-stage Jacobian',()=>{const s=S.create(problem({bounds:{elevation:[12,12],speed:[2,2],tipX:[.1,.1],tipY:[-.1,-.1]}}));const r=run(s,(x,p)=>({residuals:[1],eventPrefix:p.purpose==='jacobian'?0:1,residualStage:p.purpose==='jacobian'?0:1}));assert.equal(r.status,'unconverged');assert.match(r.reason,/stage.*boundary/);});
test('malformed inputs and explicit unsupported evaluator stay separate',()=>{assert.equal(S.create(problem({seed:{angle:1}})).status,'unsupported');const r=run(S.create(problem()),()=>({unsupported:true,reason:'moving target mode'}));assert.equal(r.status,'unsupported');});

test('clearance-to-event transition advances at the same event prefix',()=>{
 const s=S.create(problem({seed:{...seed,angle:0},bounds:{angle:[0,1],elevation:[12,12],speed:[2,2],tipX:[.1,.1],tipY:[-.1,-.1]}}));
 const stages=[];const r=run(s,(x,p)=>{const blocked=x.angle===0;stages.push(blocked?'clearance':0);return {residuals:blocked?[0]:[x.angle-.5],inequalities:[blocked?.01:-.01],residualStage:blocked?'clearance':0,eventPrefix:0,residualAvailable:!blocked,goalVerified:Math.abs(x.angle-.5)<1e-5,verified:p.purpose==='verify'};});
 assert.equal(r.status,'verified');assert.ok(stages.includes('clearance')&&stages.includes(0));assert.ok(Math.abs(r.settings.angle-.5)<1e-4);
});
test('unavailable missing-event zero placeholder is not sent for certification',()=>{
 const purposes=[];const r=run(S.create(problem()),(x,p)=>{purposes.push(p.purpose);return {residuals:[0,0,0],inequalities:[0],residualAvailable:false,residualStage:0,eventPrefix:0,goalVerified:false,verified:true};});
 assert.equal(r.status,'unconverged');assert.match(r.reason,/unavailable/);assert.deepEqual(purposes,['residual']);
});
test('near-zero geometric contact without expected physical event is unresolved',()=>{
 const purposes=[];const r=run(S.create(problem()),(x,p)=>{purposes.push(p.purpose);return {residuals:[1e-9,0,0],residualAvailable:true,residualStage:1,eventPrefix:1,goalVerified:false};});
 assert.equal(r.status,'unconverged');assert.match(r.reason,/physical event is missing/);assert.deepEqual(purposes,['residual']);
});

test('raw inactive inequality gradients preserve a narrow feasible corridor',()=>{
 const s=S.create(problem({seed:{angle:0,elevation:.0001,speed:2,tipX:0,tipY:0},bounds:{angle:[0,1],elevation:[0,1],speed:[2,2],tipX:[0,0],tipY:[0,0]}}));
 const trials=[];const r=run(s,(x,p)=>{const inequalities=[x.angle-x.elevation,x.elevation-x.angle-.0002];if(p.purpose==='trial')trials.push(inequalities);return {residuals:[x.angle-.8],inequalities,verified:p.purpose==='verify'};});
 assert.equal(r.status,'verified');assert.ok(Math.abs(r.settings.angle-.8)<1e-5);assert.ok(trials.length);for(const g of trials)assert.ok(g.every(v=>v<=1e-10),JSON.stringify(g));
});
test('active local inequality and box boundary allow other inputs to converge',()=>{
 const s=S.create(problem({seed:{angle:0,elevation:0,speed:2,tipX:0,tipY:0},bounds:{angle:[0,1],elevation:[0,1],speed:[2,2],tipX:[0,0],tipY:[0,0]}}));
 const r=run(s,(x,p)=>({residuals:[x.angle-1,x.elevation-1],inequalities:[x.angle-x.elevation],verified:p.purpose==='verify'}));assert.equal(r.status,'verified');assert.ok(r.settings.angle>.99999&&r.settings.elevation>.99999);
});
test('unavailable repeat-event residual never becomes a derivative with violated constraints',()=>{
 const purposes=[];const r=run(S.create(problem()),(x,p)=>{purposes.push(p.purpose);return {residuals:[0,0,0],inequalities:[1],residualAvailable:false,residualStage:1,eventPrefix:1};});assert.equal(r.status,'unconverged');assert.deepEqual(purposes,['residual']);
});
test('two-scale differences expose noise and adjust derivative scale without new seeds',()=>{
 const s=S.create(problem(),{maxIterations:1});run(s,x=>({residuals:[x.angle-10+.05*Math.sin(300*x.angle)]}));
 assert.ok(s.derivativeDiagnostics.some(d=>d.relativeDisagreement>.35));assert.ok(s.axisDifferenceScale.some(v=>v>1));
});
test('compatible accepted secants reduce derivative replays without changing root',()=>{
 const a=S.create(problem(),{secantReuse:3}),b=S.create(problem(),{secantReuse:0});const ra=run(a,linear),rb=run(b,linear);assert.equal(ra.status,'verified');assert.equal(rb.status,'verified');assert.ok(ra.evaluations<rb.evaluations);for(const k in target)assert.ok(Math.abs(ra.settings[k]-rb.settings[k])<1e-3);
});
test('first-impact cell crossing selects an opposite one-sided derivative',()=>{
 const s=S.create(problem({seed:{angle:.5,elevation:1,speed:2,tipX:0,tipY:0},bounds:{angle:[0,1],elevation:[1,1],speed:[2,2],tipX:[0,0],tipY:[0,0]}}));const derivatives=[];
 const r=run(s,(x,p)=>{if(p.purpose==='jacobian')derivatives.push(p.delta);return {residuals:[x.angle-.2+(x.angle>.5?10:0)],contactCell:x.angle>.5?'impact:11':'impact:10',verified:p.purpose==='verify'};});
 assert.equal(r.status,'verified');assert.ok(derivatives.some(d=>d>0)&&derivatives.some(d=>d<0));assert.ok(Math.abs(r.settings.angle-.2)<1e-5);
});
test('an improving actual trial may cross impact cells but must refresh its Jacobian',()=>{
 const s=S.create(problem({seed:{angle:.4,elevation:1,speed:2,tipX:0,tipY:0},bounds:{angle:[0,1],elevation:[1,1],speed:[2,2],tipX:[0,0],tipY:[0,0]}}));let crossed=false;
 for(let i=0;i<10&&!crossed;i++){const wave=S.next(s),outcomes=wave.map(p=>({id:p.id,residuals:[p.settings.angle-.8],contactCell:p.settings.angle>.5?'B':'A'}));crossed=wave[0].purpose==='trial'&&wave[0].settings.angle>.5;S.accept(s,outcomes);}
 assert.ok(crossed);assert.equal(s.base.cell,'B');assert.equal(s.phase,'jacobian');assert.equal(s.secantUpdates,0);
});
test('a worse cross-cell physical trial is rejected without changing the iterate',()=>{
 const s=S.create(problem({seed:{angle:.4,elevation:1,speed:2,tipX:0,tipY:0},bounds:{angle:[0,1],elevation:[1,1],speed:[2,2],tipX:[0,0],tipY:[0,0]}}));let crossed=false;
 for(let i=0;i<10&&!crossed;i++){const wave=S.next(s),outcomes=wave.map(p=>({id:p.id,residuals:[p.settings.angle-.8+(p.settings.angle>.5?10:0)],contactCell:p.settings.angle>.5?'B':'A'}));crossed=wave[0].purpose==='trial'&&wave[0].settings.angle>.5;S.accept(s,outcomes);}
 assert.ok(crossed);assert.equal(s.base.cell,'A');assert.ok(Math.abs(S.result(s).settings.angle-.4)<1e-12);
});

test('resuming exhausted convergence controls retains the exact iterate and counters',()=>{
 const s=S.create(problem());run(s,()=>({residuals:[1]}));s.lambda=1e9;s.trust=1e-12;s.differenceScale=1e-8;s.axisDifferenceScale=[16,16,16,16,16];const before=S.result(s),r=S.resume(s,{maxIterations:100});
 assert.deepEqual(S.result(r).settings,before.settings);assert.deepEqual(r.topology,s.topology);assert.equal(r.iterations,s.iterations);assert.equal(r.evaluations,s.evaluations);assert.equal(r.lambda,.001);assert.equal(r.trust,.2);assert.equal(r.differenceScale,1);assert.deepEqual(r.axisDifferenceScale,[1,1,1,1,1]);assert.equal(r.jacobian,undefined);assert.equal(S.next(r)[0].purpose,'residual');
});
test('time-limit resume preserves a partially accepted dependency wave',()=>{
 const s=S.create(problem());S.accept(s,S.next(s).map(p=>({id:p.id,...linear(p.settings,p)})));const wave=S.next(s);S.accept(s,[{id:wave[0].id,...linear(wave[0].settings,wave[0])}]);s.deadline=Date.now()-1;assert.deepEqual(S.next(s),[]);assert.equal(s.status,'time-limit');const r=S.resume(s);assert.deepEqual(S.next(r),wave.slice(1));assert.equal(r.lambda,s.lambda);assert.equal(r.trust,s.trust);assert.equal(run(r,linear).status,'verified');
});
test('explicit model reset works on an active state without replacing its seed iterate',()=>{
 const s=S.create(problem());S.next(s);s.trust=.0001;s.lambda=200;const r=S.resume(s,{resetModel:true});assert.deepEqual(r.x,s.x);assert.equal(r.phase,'base');assert.deepEqual(r.pending,[]);assert.equal(r.trust,.2);assert.equal(r.lambda,.001);
});
test('flat blocked clearance is restored by a bounded elevation scalar bracket',()=>{
 const initial={angle:45,elevation:0,speed:2,tipX:0,tipY:0},s=S.create(problem({seed:initial,bounds:{elevation:[0,60]}}));const poses=[];
 const r=run(s,(x,p)=>{const clearance=Math.max(-.011,(x.elevation-20)*.001),clearOnly=p.purpose==='clearance';poses.push({purpose:p.purpose,settings:{...x}});return {clearance,residuals:[0,0,0],inequalities:[-clearance],residualStage:clearance<0||clearOnly?'clearance':2,eventPrefix:clearance<0||clearOnly?0:2,residualAvailable:clearance>=0&&!clearOnly,goalVerified:clearance>=0&&!clearOnly,verified:p.purpose==='verify'&&clearance>=0};});
 assert.equal(r.status,'verified');assert.equal(r.clearanceRestoration.status,'bracketed');assert.ok(r.settings.elevation>=20&&r.settings.elevation<20.001);const clearancePoses=poses.filter(p=>p.purpose==='clearance');assert.equal(clearancePoses[0].settings.elevation,60);assert.ok(clearancePoses.length<25);for(const p of poses.filter(p=>p.purpose==='clearance'))for(const key of ['angle','speed','tipX','tipY'])assert.equal(p.settings[key],initial[key]);assert.equal(poses.at(-2).purpose,'residual');assert.equal(poses.at(-1).purpose,'verify');
});
test('blocked elevation upper endpoint falls back locally without infeasibility proof',()=>{
 const s=S.create(problem({bounds:{elevation:[0,5]},seed:{...seed,elevation:0}})),purposes=[];
 const r=run(s,(x,p)=>{purposes.push(p.purpose);return {clearance:-.011,residuals:[0,0,0],inequalities:[.011],residualStage:'clearance',eventPrefix:0,residualAvailable:false};});assert.equal(r.status,'unconverged');assert.equal(r.clearanceRestoration.status,'unbracketed');assert.equal(purposes.filter(p=>p==='clearance').length,1);assert.ok(purposes.includes('jacobian'));assert.equal(r.settings.elevation,0);
});
test('fixed elevation is never widened for clearance restoration',()=>{
 const s=S.create(problem({bounds:{elevation:[0,0]},seed:{...seed,elevation:0}})),purposes=[];run(s,(x,p)=>{purposes.push(p.purpose);return {clearance:-.011,residuals:[0],inequalities:[.011],residualStage:'clearance',eventPrefix:0,residualAvailable:false};});assert.ok(!purposes.includes('clearance'));
});
test('clearance root continuation preserves its pending bracket pose',()=>{
 const s=S.create(problem({seed:{...seed,elevation:0},bounds:{elevation:[0,60]}}));S.accept(s,S.next(s).map(p=>({id:p.id,residuals:[0],inequalities:[.01],residualStage:'clearance',residualAvailable:false})));S.accept(s,S.next(s).map(p=>({id:p.id,residuals:[0],inequalities:[.01],residualStage:'clearance',residualAvailable:false})));const wave=S.next(s);assert.equal(wave[0].purpose,'clearance');s.deadline=Date.now()-1;S.next(s);const r=S.resume(s);assert.deepEqual(S.next(r),wave);assert.deepEqual(r.clearanceBracket,s.clearanceBracket);
});

test('successful local clearance GN retains its trajectory without eager bracketing',()=>{
 const s=S.create(problem({seed:{...seed,elevation:1},bounds:{elevation:[0,60]}})),purposes=[];const r=run(s,(x,p)=>{purposes.push(p.purpose);const clearance=x.elevation*x.elevation-4,blocked=clearance<0;return {residuals:[0],inequalities:[-clearance],clearance,residualStage:blocked?'clearance':2,eventPrefix:blocked?0:2,residualAvailable:!blocked,goalVerified:!blocked,verified:p.purpose==='verify'&&!blocked};});
 assert.equal(r.status,'verified');assert.ok(!purposes.includes('clearance'));assert.equal(r.clearanceRestoration,null);assert.ok(r.settings.elevation>2.1,'retain successful local Newton overshoot rather than replace with minimum feasible angle');
});
test('goal-stage stationary failure and iteration limits never trigger clearance bracketing',()=>{
 for(const [stage,maxIterations] of [[1,60],['clearance',0]]){const s=S.create(problem(),{maxIterations}),purposes=[];const r=run(s,(x,p)=>{purposes.push(p.purpose);return {residuals:[1],inequalities:[.01],residualStage:stage,eventPrefix:0};});assert.equal(r.status,'unconverged');assert.ok(!purposes.includes('clearance'));}
});
