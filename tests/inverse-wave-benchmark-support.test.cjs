'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{repetitions,compare}=require('./inverse-wave-benchmark-support.cjs');
test('bounded repetitions',()=>{assert.equal(repetitions(),1);assert.equal(repetitions('0'),0);for(const x of ['4','-1','NaN','1.5'])assert.throws(()=>repetitions(x));});
test('accepted result gates unchanged',()=>{assert.equal(compare({time:1,x:1},{time:1,x:1}),0);assert.ok(compare({x:1+5e-7},{x:1})>0);assert.throws(()=>compare({time:1+1e-9},{time:1}));assert.throws(()=>compare({x:1+2e-6},{x:1}));assert.throws(()=>compare({x:1,extra:0},{x:1}));assert.throws(()=>compare({x:NaN},{x:1}));});
