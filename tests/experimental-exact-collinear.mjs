import test from 'node:test';import assert from 'node:assert/strict';
import {packSmoothSegments} from '../src/direct-candidate/deterministic-smooth-segment.mjs';
import {runExactCollinearCPU} from '../src/direct-candidate/experimental-exact-collinear.mjs';
const row=({state=[0,0,100,0,0,10,0],F=10000,K=1000,S=0,h=65535}={})=>packSmoothSegments([{id:0,state,budgets:Array(7).fill(20000),incomingErrors:Array(7).fill(0),uncertaintyKind:'joint-kinetic-ball',incomingKineticRadius:0,friction:F,rolling:K,normalSpinDrag:S,durationTicks:h,maxAttempts:16}]);
const number=r=>Number(r.numerator)/Number(r.denominator);
test('rational qt/slip/rolling phases preserve fractional crossings and exact endpoint invariants',()=>{
 const source=row(),before=source.slice(),r=runExactCollinearCPU(source);assert.equal(r.accepted,true);assert.deepEqual(source,before);assert.deepEqual(r.events.map(x=>x.kind),['qt-zero','slip-zero']);assert.equal(r.mode,3);assert.equal(r.endpoint[2],-r.endpoint[5]);assert.ok(r.events.some(e=>e.tick.denominator!=='1'));assert.equal(r.phases.length,3);assert.equal(r.durationTicks,65535);for(let i=0;i<7;i++)assert.ok(Math.abs(number(r.exact[i])-r.endpoint[i])<=r.errors[i]);
 const early=runExactCollinearCPU(source,{durationTicks:1});assert.equal(early.accepted,true);assert.equal(early.events.length,0);assert.equal(early.mode,1);
});
test('slip may precede qt; simultaneous zero is exact REST; invalid zero-K ABI is rejected',()=>{
 const slip=runExactCollinearCPU(row({state:[0,0,-99,0,0,100,0]}));assert.equal(slip.accepted,true);assert.equal(slip.events[0].kind,'slip-zero');assert.ok(!slip.events.some(x=>x.kind==='qt-zero'));
 const simultaneous=runExactCollinearCPU(row({state:[0,0,20,0,0,52,0],F:10000,K:1000}));assert.equal(simultaneous.accepted,true);assert.equal(simultaneous.events[0].kind,'simultaneous-motion-stop');assert.equal(simultaneous.mode,0);assert.deepEqual(simultaneous.endpoint.slice(2),[0,0,0,0,0]);
 const zeroK=row();zeroK[5]=0;assert.throws(()=>runExactCollinearCPU(zeroK),/Invalid smooth header/);
 const stopped=runExactCollinearCPU(row({state:[0,0,1,0,0,1,0],K:1000}));assert.equal(stopped.accepted,true);assert.equal(stopped.mode,0);assert.ok(stopped.events.some(x=>x.kind==='rest'));
});
test('strict axis admission, signed x/z symmetry, normal spin and no near-collinear shortcut',()=>{
 const x=runExactCollinearCPU(row()),z=runExactCollinearCPU(row({state:[0,0,0,100,-10,0,0]})),minus=runExactCollinearCPU(row({state:[0,0,-100,0,0,-10,0]}));assert.equal(z.accepted,true);assert.equal(z.endpoint[1],x.endpoint[0]);assert.equal(z.endpoint[3],x.endpoint[2]);assert.equal(z.endpoint[4],-x.endpoint[5]);assert.equal(minus.endpoint[0],-x.endpoint[0]);assert.equal(minus.endpoint[2],-x.endpoint[2]);
 assert.equal(runExactCollinearCPU(row({state:[0,0,100,1,0,10,0]})).reason,'not-exactly-axis-aligned');assert.equal(runExactCollinearCPU(row({state:[0,0,100,0,1,10,0]})).reason,'not-exactly-axis-aligned');
 const zeroQt=runExactCollinearCPU(row({state:[0,0,100,0,0,0,0]}));assert.equal(zeroQt.accepted,true);assert.ok(!zeroQt.events.some(e=>e.kind==='qt-zero'));assert.ok(zeroQt.endpoint[5]<0);assert.equal(runExactCollinearCPU(row({F:10000,K:25000})).reason,'nonsticking-material-domain');
 const uncertain=row();uncertain[24]=1;assert.equal(runExactCollinearCPU(uncertain).reason,'requires-exact-canonical-anchor');
 const spin=runExactCollinearCPU(row({state:[0,0,100,0,0,10,2],S:1000}));assert.equal(spin.accepted,true);assert.equal(spin.endpoint[6],0);assert.ok(spin.events.some(e=>e.kind==='normal-spin-zero'));
 const spinning=runExactCollinearCPU(row({state:[0,0,1,0,0,1,100],S:1}));assert.equal(spinning.mode,0);assert.equal(spinning.nominalRest,false);assert.ok(!spinning.events.some(e=>e.kind==='rest'));
 assert.equal(runExactCollinearCPU(row({state:[0,0,100,0,0,-100,0]})).reason,'initial-slip-zero');
});
test('swept bounds include a within-phase velocity extremum and do not round a tiny regime to zero',()=>{
 const r=runExactCollinearCPU(row({state:[0,0,-5,0,0,100,0],F:10000,K:1000}));assert.equal(r.accepted,true);assert.ok(r.positionBounds[0][0]<0);assert.ok(r.positionBounds[0][0]<=r.endpoint[0]);assert.ok(r.positionBounds[0][1]>=r.endpoint[0]);
 const tiny=runExactCollinearCPU(row({state:[0,0,100,0,0,1,0],F:220000,K:1000,h:1}));assert.equal(tiny.accepted,false);assert.equal(tiny.reason,'rounding-would-change-regime');
});
test('integer horizons straddle exact fractional-policy events without epsilon snapping',()=>{
 const source=row({state:[0,0,100,0,0,12,3],F:2*1048576,K:1048576,S:1048576});
 for(const[h,mode]of[[1,1],[2,1],[3,1],[17,1],[18,3],[19,3],[240,3],[242,0],[243,0]]){
  const r=runExactCollinearCPU(source,{durationTicks:h});assert.equal(r.accepted,true,`h=${h}`);assert.equal(r.mode,mode,`h=${h}`);for(const e of r.events)assert.ok(number(e.tick)<=h);
  if(h>=2)assert.ok(r.events.some(e=>e.kind==='qt-zero'&&number(e.tick)===2));
  if(h>=3)assert.ok(r.events.some(e=>e.kind==='normal-spin-zero'&&number(e.tick)===3));
  if(h>=18)assert.ok(r.events.some(e=>e.kind==='slip-zero'&&number(e.tick)===18));
  if(h>=242)assert.ok(r.events.some(e=>e.kind==='rest'&&number(e.tick)===242));
 }
 const ambiguous=runExactCollinearCPU(source,{durationTicks:241});assert.equal(ambiguous.accepted,false);assert.equal(ambiguous.reason,'rounding-would-change-regime');
});
