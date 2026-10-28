// TEST ONLY. Independently derive the resident cue transport from authentic t0.
// No candidate words, generated WGSL, phase output, or native h1 enters here.
import assert from 'node:assert/strict';
import {CUE_LAYOUT as L} from '../src/resident-candidate/cue.mjs';
import {createCueProgramBundle,executeCueForTest} from '../src/resident-candidate/cue-orchestration.mjs';
import {executeLowered} from '../src/resident-candidate/numeric-program.mjs';
import {executeSourceNumberProgramReference} from '../src/resident-candidate/raw-strike.mjs';
import {numberWords,wordsNumber} from '../src/resident-candidate/source-number.mjs';
// JS-number realization of raw-strike.mjs:493–535 control/storage transitions.
// Arithmetic op semantics are the independent JS reference at461–481; unlike
// its public result, this witness retains register tails and popped stack slots.
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
export function cueTransportOracle(template,absoluteProgramBase){
 const bundle=createCueProgramBundle(),q=template.segments.cue.offset,b=template.segments.bodies.offset,initial=template.initialWords.slice(q,q+bundle.stateWords),transport=initial.slice(),selected=template.seed.sourceOrigin.selectedIndex,sourceJobs=[];
 const graph=(p,input,options)=>{const out=executeLowered(p,input,options);transport.set(new Uint32Array(out.buffer,out.byteOffset,out.length),L.numericalOutput);return out;};
 const source=(p,input)=>{sourceJobs.push(bundle.numbers.indexOf(p));const expected=executeSourceNumberProgramReference(p,input),raw=numberTransport(p,input,transport,L.sourceRegisters,L.sourceRegisters+bundle.sourceRegisterWords);assert.deepEqual(raw,expected.raw,'independent Number register transitions and public JS output');transport.set(raw,L.sourceOutput);return expected;};
 // Instrument the unchanged JS cue oracle at its two existing numerical call
 // boundaries; do not translate or execute the candidate shader/schedule.
 const run=new Function('L','f','wordsNumber','numberWords','executeLowered','executeSourceNumberProgramReference','return ('+executeCueForTest.toString()+');')(L,Math.fround,wordsNumber,numberWords,graph,source);
 const semantic=run(bundle,initial,{mode:0,ball:template.initialWords.slice(b+selected*64,b+(selected+1)*64),others:[0,1,2].filter(i=>i!==selected).map(i=>template.initialWords.slice(b+i*64,b+(i+1)*64)),testOnly:true}).state;
 assert.deepEqual(sourceJobs,[0,1,2]);transport[14]=5;transport[58]=absoluteProgramBase+bundle.program[10];
 return {semantic,transport,parts:Object.freeze([{start:0,end:14,authority:'source-semantic'},{start:14,end:15,authority:'source-transition'},{start:15,end:48,authority:'source-semantic'},{start:48,end:50,authority:'source-transition'},{start:50,end:56,authority:'source-semantic'},{start:56,end:60,authority:'source-transition'},{start:60,end:640,authority:'source-semantic'},{start:640,end:1232,authority:'source-transition'},{start:1232,end:1376,authority:'source-semantic'},{start:1376,end:bundle.stateWords,authority:'source-transition'}])};
}
export function assertCompleteCueArena(actual,sourceSemantic,template,absoluteProgramBase){
 const oracle=cueTransportOracle(template,absoluteProgramBase),want=sourceSemantic.slice();let cursor=0;
 for(const p of oracle.parts){assert.equal(p.start,cursor);cursor=p.end;if(p.authority==='source-transition')want.set(oracle.transport.subarray(p.start,p.end),p.start);}assert.equal(cursor,actual.length);
 assert.notDeepEqual(actual,sourceSemantic,'retained failed witness: legacy semantic oracle omits emitted transport');assert.deepEqual(actual,want,'EVERY cue arena word: original semantic or independent exact source transition');return oracle.parts;
}
