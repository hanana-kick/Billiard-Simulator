'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../src/experimental-ccd-substep'),f=Math.fround;
const state=(toi,n=4,time=f(1/960),min=f(f(1/60)/100))=>({remainingTime:time,remainingSubsteps:n,minCcdDt:min,firstImpact:toi});
// Literal source branch order; this is a component expectation, not native-world evidence.
function source(s){let r=s.remainingTime,n=s.remainingSubsteps,dt=r;if(n>1){if(s.firstImpact!==null){let t=f(r/n);dt=s.firstImpact<t?t:f(s.firstImpact+f(f(r-s.firstImpact)/n));n--;}else n=0;r=f(r-dt);if(r<=s.minCcdDt){dt=f(dt+r);n=0;}}else{r=0;n=0;}return{dt,remainingTime:r,remainingSubsteps:n,collisionRefreshRequired:n>0};}
test('source timestep branch order preserves overshoot and tiny residual absorption',()=>{for(const n of [1,2,3,4])for(const frac of [null,0,.01,.25,.5,.9,.999]){if(n===1&&frac!==null)continue;const s=state(frac===null?null:f(f(1/960)*frac),n);assert.deepEqual(C.reference(s),source(s));}const x=C.reference(state(f(.0005)));assert.ok(x.dt>f(.0005),'source slice deliberately extends beyond TOI');});
test('source tiny residual remains recorded even when no further pass is scheduled',()=>{const x=C.reference(state(f(.001)));assert.equal(x.remainingSubsteps,0);assert.ok(x.remainingTime>0);assert.equal(x.dt,f(1/960));});
test('the last pass consumes remaining time without querying TOI',()=>{assert.deepEqual(C.reference(state(null,1)),{dt:f(1/960),remainingTime:0,remainingSubsteps:0,collisionRefreshRequired:false});assert.throws(()=>C.reference(state(0,1)),/must not query/);});
test('invalid time, future TOI and unsupported schedule reject before compute',()=>{for(const bad of [{remainingTime:0},{remainingTime:NaN},{remainingTime:1/960},{remainingSubsteps:5},{remainingSubsteps:0},{minCcdDt:-1},{firstImpact:f(1/960)},{firstImpact:-1},{other:1}])assert.throws(()=>C.reference({...state(null),...bad}));});
module.exports={source,state};
