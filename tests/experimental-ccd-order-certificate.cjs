'use strict';
// Protocol tests only: these mock numerical cast outputs to prove traversal
// coverage/fail-closed behavior. They are not native or GPU physics evidence.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module');
function harness(cast){const filename=require.resolve('../src/experimental-ccd-order-certificate'),m=new Module(filename,module);m.filename=filename;m.paths=module.paths;const calls=[];m.require=n=>{if(n==='./experimental-ccd-bvh-state')return Module.createRequire(filename)(n);assert.equal(n,'./experimental-ccd-sweep-toi');return{validate:q=>structuredClone(q),reference:q=>{calls.push({id:q.caseId,bound:q.maxFraction});return cast(q.caseId,q.maxFraction);}};};m._compile(fs.readFileSync(filename,'utf8'),filename);return{api:m.exports,calls};}
const inputs=ids=>ids.map(id=>({id,query:{caseId:id,maxFraction:1}}));
test('complete three-target proof evaluates every sequential order at current source bounds',async()=>{
 const {api,calls}=harness((id,bound)=>({fraction:Math.min({a:.6,b:.4,c:1}[id],bound),status:'Hit'}));const out=await api.reference(inputs(['a','b','c']));
 assert.equal(out.admitted,true);assert.equal(out.fraction,.4);assert.equal(out.ordersVerified,6);assert.equal(out.completeCandidates,3);
 assert.ok(calls.some(x=>x.id==='c'&&x.bound===.6));assert.ok(calls.some(x=>x.id==='c'&&x.bound===.4),'initial non-hit must be rechecked at tighter bounds');
});
test('initial non-hit becoming a reduced-bound hit can invalidate order independence',async()=>{
 const {api}=harness((id,bound)=>({fraction:id==='c'?(bound===1?1:bound===.6?.2:bound===.4?.1:bound):Math.min({a:.6,b:.4}[id],bound),status:'Failed'}));
 const out=await api.reference(inputs(['a','b','c']));assert.equal(out.admitted,false);assert.equal(out.status,'unsupported-order-sensitive-multiple-hits');assert.equal(out.terminalFractions.length,2);assert.equal(out.fraction,null);
});
test('equal final fractions with different winning colliders never invent one source winner',async()=>{
 const {api}=harness((id,bound)=>({fraction:Math.min(id==='c'?1:.4,bound),status:'Hit'}));const out=await api.reference(inputs(['a','b','c']));assert.equal(out.admitted,true);assert.equal(out.collider,null);assert.deepEqual(out.winningColliders.sort(),['a','b']);assert.equal(out.ordersVerified,6);
});
test('complete four-target proof covers all24 permutations; larger sets are not truncated',async()=>{
 const {api,calls}=harness((id,bound)=>({fraction:Math.min(id==='a'?.6:id==='b'?.4:1,bound),status:'Hit'}));const out=await api.reference(inputs(['a','b','c','d']));assert.equal(out.admitted,true);assert.equal(out.ordersVerified,24);const old=calls.length;const tooLarge=await api.reference(inputs(['a','b','c','d','e']));assert.equal(tooLarge.admitted,false);assert.equal(tooLarge.status,'unsupported-complete-order-proof-domain');assert.equal(calls.length-old,5,'every initial candidate is retained, no subset proof');
});
test('single-hit and empty certified domains preserve prior behavior',async()=>{
 const {api}=harness((id,bound)=>({fraction:Math.min(id==='a'?.4:1,bound)}));assert.equal((await api.reference(inputs(['a','c']))).status,'certified-single-positive-impact');assert.equal((await api.reference([])).fraction,1);
});
