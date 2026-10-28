import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {divideWide,packPairClothContacts,runPairClothCPU,createPairClothGPU,createContactArithmeticGPU} from '../src/direct-candidate/deterministic-contact.mjs';
import {packSourceAxialCandidates,runAxialIntegerCPU} from '../src/direct-candidate/deterministic-axial.mjs';
const Q=2**24,R=1/32;
const sphere=(x,vx,c,y=R)=>({x,y,vx,vy:0,omegaX:0,omegaY:0,omegaZ:-c/R,radius:R,mass:.21});
const fixture=(id,ca=.2,cb=.1,extra={})=>({id,bodies:[sphere(0,1,ca),sphere(2*R,0,cb)],restitution:.8,pairFriction:.2,clothFriction:.2,overlapBudget:2e-5,maxIterations:64,residualBudgetQuanta:16,provenance:'prepared-isolated-pair-and-cloth',...extra});
const cases=[fixture(1,.2,.1,{restitution:1,pairFriction:0,clothFriction:0}),fixture(2),fixture(3,-.2,-.1),fixture(4,2,1,{pairFriction:.01}),fixture(5,0,0),
 fixture(6,.2,.1,{bodies:[sphere(0,1,.2,R-2/Q),sphere(2*R-3/Q,0,.1,R-2/Q)]}),
 fixture(7,.5,-.1,{bodies:[sphere(0,1,.5,R-1e-5),sphere(2*R-1e-5,0,-.1,R-1e-5)]}),fixture(8,.2,.1,{maxIterations:1}),
 fixture(9,.2,.1,{bodies:[sphere(0,-1,.2),sphere(2*R,0,.1)]})];
const varied=Array.from({length:64},(_,i)=>fixture(100+i,(i-32)/32,((i*7)%31-15)/32,{restitution:(i%5)/4,pairFriction:(i%4)/10,clothFriction:(i%3)/10,bodies:[sphere(0,1,(i-32)/32,R-(i%3)/Q),sphere(2*R-(i%5)/Q,0,((i*7)%31-15)/32,R-(i%3)/Q)]}));
// Integration regression only: evaluate the encoded event's UPPER tick without
// projecting positions, then feed that prepared state to the contact component.
const handoffs=[];
for(const [index,x] of [.09,.0916,.09161,.095,.1].entries()){
 const body=(p,v,c)=>({id:1,position:[p,R,0],velocity:[v,0,0],angular:[0,0,-c/R],radius:R,mass:.21,provenance:'prepared-flat-constant-load'});
 const {rows}=packSourceAxialCandidates([{id:index,bodies:[body(0,1,.2),body(x,0,0),body(1,0,0)],material:{gravity:10,clothFriction:.2,rollingLength:.00045,spinLength:.00035},duration:.04,geometryHorizon:.04,geometryProvenance:'prepared-no-static-contact-interval'}]);
 const event=runAxialIntegerCPU(rows);if(event[1]!==1)continue;
 const state=new Int32Array(rows.buffer),tick=BigInt(event[4]),scale=1n<<20n;
 const floor=(a,b)=>a>=0n?a/b:-((-a+b-1n)/b);
 const bodies=[0,1].map(i=>{const at=8+i*10,p=BigInt(state[at])+floor(BigInt(state[at+1])*tick,scale)+floor(BigInt(state[at+2])*tick*tick,scale*scale),v=BigInt(state[at+1])+floor(2n*BigInt(state[at+2])*tick,scale),w=BigInt(state[at+5])+floor(BigInt(state[at+8])*tick,scale);return {...sphere(Number(p)/Q,Number(v)/Q,0),omegaZ:Number(w)/2**20};});
 const upperTime=event[4]/2**20,relativeSpeedBound=1+2*upperTime,overlapBudget=relativeSpeedBound/2**20+4/Q;
 handoffs.push(fixture(2000+index,0,0,{bodies,timeBracket:[event[3],event[4]],overlapBudget}));
}
const allCases=[...cases,...varied,...handoffs];
function reference(row){
 const f=Array.from(new Int32Array(row.buffer,row.byteOffset,row.length),x=>x/Q),r=f[4],xA=f[5],xB=f[6],y=f[7],cx=f[8],cy=f[9],inv=[1,1,2.5/(r*r),1,1,2.5/(r*r)];
 const v=[f[16],f[17],-f[18]/r,f[19],f[20],-f[21]/r],p=Array(6).fill(0),J=[[-1,0,0,1,0,0],[0,-1,-(cx-xA),0,1,-(xB-cx)],[0,1,0,0,0,0],[1,0,y-cy,0,0,0],[0,0,0,0,1,0],[0,0,0,1,0,y-cy]];
 const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),K=J.map(j=>j.reduce((s,x,i)=>s+x*x*inv[i],0)),bounce=-f[10]*Math.min(v[3]-v[0],0);
 for(let it=0;it<512;it++){
  let change=0;for(let j=0;j<6;j++){
   const target=j===0?bounce:0,trial=p[j]+(target-dot(J[j],v))/K[j],normal=j%2===0,limit=j===1?f[11]*p[0]:j===3?f[12]*p[2]:f[12]*p[4];
   const next=normal?Math.max(0,trial):Math.max(-limit,Math.min(limit,trial)),delta=next-p[j];p[j]=next;change=Math.max(change,Math.abs(delta));
   for(let i=0;i<6;i++)v[i]+=inv[i]*J[j][i]*delta;
  }if(change<1e-14)break;
 }
 return {state:[v[0],v[1],-r*v[2],v[3],v[4],-r*v[5]],impulses:p};
}
test('u64/u32 division exactly matches integer oracle, rejects zero and quotient overflow',()=>{
 let seed=1729;const random=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
 for(let i=0;i<1004;i++){
  const d=i<4?[1,0xffffffff,0x80000000,65537][i]:(random()||1),hi=random()%d,lo=random(),expected=(BigInt(hi)<<32n)+BigInt(lo),actual=divideWide(lo,hi,d);
  assert.equal(actual.valid,true);assert.equal(BigInt(actual.quotient),expected/BigInt(d));assert.equal(BigInt(actual.remainder),expected%BigInt(d));
 }
 assert.equal(divideWide(0,0,0).valid,false);assert.equal(divideWide(0,1,1).valid,false);
});
test('real-arm contact solves friction/support jointly and satisfies independent physical checks',()=>{
 const {rows}=packPairClothContacts(allCases),out=runPairClothCPU(rows),s=new Int32Array(out.buffer),initial=new Int32Array(rows.buffer);
 assert.equal(out[1],1);assert.equal(s[16],0);assert.equal(s[19],Q);assert.equal(s[18],initial[18]);assert.equal(s[21],initial[21]);
 assert.equal(s[35],7*Q);assert.ok(s[5*64+35]<7*Q,'finite-overlap arm must not use Kt=7');
 assert.equal(out[7*64+1],5);assert.equal(out[7*64+23],0xffffffff);
 let maxReferenceError=0,maxMomentumError=0,maxAngularError=0;
 for(let k=0;k<allCases.length;k++){
  const b=k*64;if(out[b+1]!==1)continue;
  const v=Array.from(s.slice(b+16,b+22),x=>x/Q),before=Array.from(initial.slice(b+16,b+22),x=>x/Q),p=Array.from(s.slice(b+25,b+31),x=>x/Q),r=s[b+4]/Q,xa=s[b+5]/Q,xb=s[b+6]/Q,y=s[b+7]/Q,cy=s[b+9]/Q;
  const ref=reference(rows.subarray(b,b+64));for(let i=0;i<6;i++){const err=Math.abs(v[i]-ref.state[i]);maxReferenceError=Math.max(maxReferenceError,err);assert.ok(err<=4e-6,`${k}/${i}: ${err}`);}
  const momentum=Math.max(Math.abs(v[0]+v[3]-before[0]-before[3]-p[3]-p[5]),Math.abs(v[1]+v[4]-before[1]-before[4]-p[2]-p[4]));maxMomentumError=Math.max(maxMomentumError,momentum);assert.ok(momentum<=1e-6);
  const L=a=>xa*a[1]+xb*a[4]-y*(a[0]+a[3])-.4*r*(a[2]+a[5]),external=xa*p[2]+xb*p[4]-cy*(p[3]+p[5]);const angular=Math.abs(L(v)-L(before)-external);maxAngularError=Math.max(maxAngularError,angular);assert.ok(angular<=1e-7,`angular ${k}: ${angular}`);
  const energy=a=>.5*(a[0]**2+a[1]**2+a[3]**2+a[4]**2)+.2*(a[2]**2+a[5]**2);assert.ok(energy(v)<=energy(before)+1e-6);
  for(const [normal,tangent,mu] of [[25,26,11],[27,28,12],[29,30,12]]){assert.ok(s[b+normal]>=0);assert.ok(BigInt(Math.abs(s[b+tangent]))*BigInt(Q)<=BigInt(s[b+mu])*BigInt(s[b+normal]));}
  assert.ok(out[b+24]<=rows[b+2]);
 }
 assert.ok(out[64+31]&1,'pair friction genuinely lifts A');assert.ok(out[2*64+31]&2,'opposite spin genuinely lifts B');
 assert.deepEqual(out.slice(8*64+16,8*64+22),rows.slice(8*64+16,8*64+22),'separating contact receives no invented impulse');
 console.log(JSON.stringify({maxReferenceError,maxMomentumError,maxAngularError}));
});
test('actual encoded event-upper states reach contact without position projection',()=>{
 assert.ok(handoffs.length>=1);assert.ok(handoffs.some(c=>2*R-(c.bodies[1].x-c.bodies[0].x)>0));
 const {rows}=packPairClothContacts(handoffs),out=runPairClothCPU(rows);for(let b=0;b<rows.length;b+=64){assert.equal(out[b+1],1);assert.deepEqual(out.slice(b+4,b+10),rows.slice(b+4,b+10));}
});

test('unsupported geometry, initial downward motion, fake midpoint and invalid bracket reject',()=>{
 assert.throws(()=>packPairClothContacts([fixture(1,0,0,{bodies:[{...sphere(0,1,0),vy:-.1},sphere(2*R,0,0)]})]),/mode/);
 for(const timeBracket of [[NaN,0],[-1,0],[.1,1],[0,2**32],[0,2]])assert.throws(()=>packPairClothContacts([fixture(1,0,0,{timeBracket})]),/tick/);
 const {rows}=packPairClothContacts([cases[0]]);rows[8]++;assert.equal(runPairClothCPU(rows)[1],4);
 rows[8]--;rows[16]=0x80000000;assert.equal(runPairClothCPU(rows)[1],4);
});
test('native contact response and work/residual words exactly match CPU',{skip:process.env.REQUIRE_WEBGPU!=='1',timeout:30000},async t=>{
 const {create,globals}=await import(pathToFileURL(process.env.GPU_NATIVE_MODULE).href);Object.assign(globalThis,globals);const gpu=create(['backend=vulkan']),adapter=await gpu.requestAdapter();assert.ok(adapter);const device=await adapter.requestDevice();
 try{
  let seed=1949;const random=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const vectors=Array.from({length:1004},(_,i)=>{const den=i<4?[1,0xffffffff,0x80000000,65537][i]:(random()||1);return [random(),random()%den,den];});vectors.push([0,0,0],[0,1,1]);
  const arithmeticRows=new Uint32Array(vectors.length*64),arithmeticExpected=new Uint32Array(arithmeticRows.length);
  vectors.forEach(([lo,hi,d],i)=>{arithmeticRows.set([lo,hi,d],i*64);const value=divideWide(lo,hi,d);arithmeticExpected.set([value.quotient,value.remainder,+value.valid],i*64);});
  const arithmetic=await createContactArithmeticGPU(device),arithmeticGPU=await arithmetic.run(arithmeticRows);assert.deepEqual(arithmeticGPU.result,arithmeticExpected);
  const prepared=packPairClothContacts(allCases).rows,rows=new Uint32Array(prepared.length+3*64);rows.set(prepared);
  for(let i=0;i<3;i++)rows.set(prepared.subarray(0,64),prepared.length+i*64);
  rows[prepared.length+8]++;rows[prepared.length+64+15]=2;rows[prepared.length+128+16]=0x80000000;
  const cpu=runPairClothCPU(rows),engine=await createPairClothGPU(device);const padded=new Uint32Array(rows.length+8);padded.set(rows,4);const actual=await engine.run(padded.subarray(4,4+rows.length));assert.deepEqual(actual.result,cpu);
  const receipt={eventUpperHandoffs:handoffs.length,arithmeticCases:vectors.length,arithmeticComparedWords:arithmeticRows.length,profile:'prepared-real-arm-pair-cloth-integer-v1',cases:rows.length/64,comparedWords:rows.length,exactWords:true,compileMs:engine.compileMs,shaderBytes:engine.shaderBytes,metrics:actual.metrics,statuses:Object.fromEntries([1,4,5].map(status=>[status,Array.from({length:rows.length/64},(_,i)=>cpu[i*64+1]).filter(x=>x===status).length])),iterations:Array.from({length:rows.length/64},(_,i)=>cpu[i*64+3]).reduce((a,b)=>a+b,0),physicalAcceptance:false};t.diagnostic(JSON.stringify(receipt));
  if(process.env.DETERMINISTIC_CONTACT_RECEIPT){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.DETERMINISTIC_CONTACT_RECEIPT,JSON.stringify(receipt,null,2)+'\n');}
 }finally{device.destroy();}
});
