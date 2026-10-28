// TEST ONLY: native observations are comparison inputs, never candidate inputs.
// Derives full h2 cue semantic + transport from original t0 and independent
// original native h1/h2 fields, with original JS cue equations and Number VM.
import assert from 'node:assert/strict';
import {CUE_LAYOUT as L} from '../src/resident-candidate/cue.mjs';
import {createCueProgramBundle,executeCueForTest} from '../src/resident-candidate/cue-orchestration.mjs';
import {executeLowered} from '../src/resident-candidate/numeric-program.mjs';
import {executeSourceNumberProgramReference} from '../src/resident-candidate/raw-strike.mjs';
import {numberWords,wordsNumber} from '../src/resident-candidate/source-number.mjs';
import {cueTransportOracle} from './resident-three-ball-cue-transport-oracle.mjs';
const key=h=>h.index+':'+h.generation;
function numberTransport(p,inputs,bank,regsAt,controlAt){
 const w=p.words,r=new Float64Array(p.registerCount);bank.fill(0,controlAt,controlAt+p.controlWords);
 for(let i=0;i<w[6];i++){const at=w[7]+i*3;r[w[at]]=wordsNumber(w.subarray(at+1,at+3));}inputs.forEach((v,i)=>r[w[w[11]+i]]=v);
 let pc=0,steps=0,sp=0,done=false;
 while(!done&&steps++<p.maximumInstructions){assert.ok(pc<w[4]);const at=w[5]+pc*4,[code,d,a,z]=w.subarray(at,at+4),x=r[a],y=r[z];pc++;
  switch(code){
   case 0:r[d]=x;break;case 1:r[d]=x+y;break;case 2:r[d]=x-y;break;case 3:r[d]=x*y;break;case 4:r[d]=x/y;break;
   case 5:r[d]=Math.sqrt(x);break;case 6:r[d]=-x;break;case 7:r[d]=Math.abs(x);break;case 8:r[d]=+(x<y);break;case 9:r[d]=+(x<=y);break;case 10:r[d]=+(x===y);break;case 11:r[d]=+Number.isFinite(x);break;case 12:r[d]=+(x===0);break;
   case 13:r[d]=numberWords(x)[1];break;case 14:r[d]=(x&y)>>>0;break;case 15:r[d]=(x|y)>>>0;break;case 16:r[d]=(x<<y)>>>0;break;case 17:r[d]=x>>>y;break;case 18:r[d]=Math.trunc(x);break;case 19:r[d]=x*2**y;break;case 20:r[d]=wordsNumber(Uint32Array.of(numberWords(x)[0],y>>>0));break;
   case 21:r[d]=r[a+Math.trunc(y)];break;case 22:r[d+Math.trunc(x)]=y;break;case 23:pc=d;break;case 24:if(!x)pc=d;break;
   case 25:assert.ok(sp<p.controlWords-4);bank[controlAt+4+sp++]=pc;pc=d;break;case 26:assert.ok(sp>0);pc=bank[controlAt+4+--sp];break;case 27:done=true;break;case 28:r[d]=Math.fround(x);break;default:throw Error('Unexpected source opcode');
  }
 }
 assert.equal(done,true);bank.set([pc,1,steps,sp],controlAt);r.forEach((v,i)=>bank.set(numberWords(v),regsAt+i*2));
 const raw=new Uint32Array(p.outputWords);for(let i=0;i<w[8];i++){const at=w[9]+i*3,[dest,reg,integer]=w.subarray(at,at+3);if(integer===1)raw[dest]=r[reg]>>>0;else if(integer===2)raw[dest]=new Uint32Array(Float32Array.of(r[reg]).buffer)[0];else raw.set(numberWords(r[reg]),dest);}return raw;
}

export function expectedNativeCueFields(bank,exported){
 const put=(at,v)=>bank.set(new Uint32Array(Float32Array.from(v).buffer),at);
 for(const [i,body]of [exported.joints[0].body1,exported.joints[0].body2].entries()){
  const at=L.joint+i*48;for(const [offset,value]of [[0,body.linear],[3,body.angular],[6,body.pose.translation],[9,body.pose.rotation],[13,body.localCom],[16,body.invMass],[19,body.invInertia],[25,body.principalFrame],[29,body.invPrincipalInertia],[32,body.userForce],[35,body.userTorque]])put(at+offset,value);put(L.worldCom+i*3,body.worldCom);
 }
 const [flex,guide]=exported.joints;put(L.jointImpulses,[...flex.impulses.slice(3,6),flex.impulses[0],...guide.impulses.slice(3,6),guide.impulses[1],guide.impulses[2],guide.limitImpulses[0]]);bank[12]=0;
 return bank;
}
export function currentCueTransportOracle(template,absoluteProgramBase,nativeH1,jointsH1,jointsH2){
 const first=firstNativeCueTransportOracle(template,absoluteProgramBase,jointsH1);
 return advanceNativeCueTransportOracle(template,absoluteProgramBase,first,nativeH1,jointsH2);
}
// Test-only retained expected owner: no candidate words are inputs. The first
// state comes from original creation/equations; every advance consumes only its
// independently derived previous state and ORIGINAL native observations.
export function firstNativeCueTransportOracle(template,absoluteProgramBase,jointsH1){
 const first=cueTransportOracle(template,absoluteProgramBase),words=first.semantic.slice();for(const p of first.parts)if(p.authority==='source-transition')words.set(first.transport.subarray(p.start,p.end),p.start);expectedNativeCueFields(words,jointsH1);return{words,parts:first.parts};
}
export function advanceNativeCueTransportOracle(template,absoluteProgramBase,first,nativePrevious,jointsCurrent){
 const bundle=createCueProgramBundle(),previous=first.words.slice();
 const bodies=nativePrevious.bodies.bodies.items.flatMap((x,index)=>x?.value?[{handle:{index,generation:x.generation},...x.value}]:[]),b=template.segments.bodies.offset,balls=template.seed.balls.map((ball,i)=>{const words=template.initialWords.slice(b+i*64,b+(i+1)*64),state=bodies.find(x=>key(x.handle)===key(ball.body)),f=new Float32Array(words.buffer),I=state.mprops.effective_world_inv_inertia;for(const[at,v]of [[0,state.vels.linvel],[3,state.vels.angvel],[6,state.pos.position.translation],[9,state.pos.position.rotation],[13,state.mprops.effective_inv_mass],[16,[I.m11,I.m12,I.m13,I.m12,I.m22,I.m23,I.m13,I.m23,I.m33]],[47,state.forces.force],[56,state.mprops.local_mprops.local_com],[59,state.mprops.world_com]])f.set(v,at);return words;}),transport=previous.slice(),jobs=[],helperTorque=new Uint32Array(12);
 const graph=(p,input,options)=>{const out=executeLowered(p,input,options);transport.set(new Uint32Array(out.buffer,out.byteOffset,out.length),L.numericalOutput);return out;};
 const source=(p,input)=>{const index=bundle.numbers.indexOf(p);jobs.push(index);const expected=executeSourceNumberProgramReference(p,input),raw=numberTransport(p,input,transport,L.sourceRegisters,L.sourceRegisters+bundle.sourceRegisterWords);assert.deepEqual(raw,expected.raw,'all independent current Number outputs');transport.set(raw,L.sourceOutput);if(index===0)helperTorque.set(raw.subarray(36,42));return expected;};
 const run=new Function('L','f','wordsNumber','numberWords','executeLowered','executeSourceNumberProgramReference','return ('+executeCueForTest.toString()+');')(L,Math.fround,wordsNumber,numberWords,graph,source),selected=template.seed.sourceOrigin.selectedIndex,semantic=run(bundle,previous,{mode:0,ball:balls[selected],others:balls.filter((_,i)=>i!==selected),testOnly:true}).state;assert.deepEqual(jobs,[0,1,2]);transport[14]=5;transport[58]=absoluteProgramBase+bundle.program[10];expectedNativeCueFields(semantic,jointsCurrent);
 const words=semantic.slice();let cursor=0;for(const part of first.parts){assert.equal(part.start,cursor);cursor=part.end;if(part.authority==='source-transition')words.set(transport.subarray(part.start,part.end),part.start);}assert.equal(cursor,words.length);return{words,semantic,transport,parts:first.parts,helperTorque};
}
