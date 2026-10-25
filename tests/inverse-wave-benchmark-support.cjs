'use strict';
const assert=require('node:assert/strict');
function repetitions(value='1'){const n=Number(value);if(!Number.isSafeInteger(n)||n<0||n>3)throw RangeError('BENCH_WARM_REPETITIONS must be 0..3');return n;}
function compare(actual,expected){let maximumAbsoluteError=0;function visit(a,b,at='result'){if(typeof b==='number'){if(!Number.isFinite(b)){assert.equal(a,b,at);return;}maximumAbsoluteError=Math.max(maximumAbsoluteError,Math.abs(a-b));const exact=/\.(?:time|stepDt|stepIndex|steps|seconds|firstImpactTime|observedSubsteps)$/.test(at);assert.ok(exact?a===b:Math.abs(a-b)<=1e-6,at+': '+a+' != '+b);}else if(b===null||typeof b!=='object')assert.equal(a,b,at);else{assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),at);for(const k of Object.keys(b))visit(a[k],b[k],at+'.'+k);}}visit(actual,expected);return maximumAbsoluteError;}
module.exports={repetitions,compare};
