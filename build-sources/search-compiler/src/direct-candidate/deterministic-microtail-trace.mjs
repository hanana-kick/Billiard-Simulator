/** Optional microtail SOURCE recipe evaluation, not final-state trajectory fitting.
 * Original quantized recurrence is preserved. The source defines bounce endpoints
 * and a residual-fraction endpoint, not an intra-flight interpolation law.
 */
import {runClothMicrotailsCPU,CLOTH_MICROTAIL_VERSION} from './deterministic-cloth-microtail.mjs';
import {advanceMicrotailFractionCPU} from './deterministic-microtail-fraction.mjs';
import {createContactMath} from './deterministic-checked-contact-math.mjs';
import {multiplyWide} from './deterministic-axial.mjs';
import {divideWide} from './deterministic-contact.mjs';
const Q=2**24,T=2**20,V=0x4d545201,HEADER=12,INPUT=12,CLOTH=44,CONTEXT=60,MICRO=220,FRACTION=316,EVENTS=412,STRIDE=12;
export const MICROTAIL_TRACE_VERSION=V;
export const MICROTAIL_TRACE_LAYOUT=Object.freeze({header:HEADER,input:INPUT,cloth:CLOTH,context:CONTEXT,micro:MICRO,fraction:FRACTION,events:EVENTS,eventStride:STRIDE,maximumWords:1936,maximumBounces:127});
const u32=x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff;
function own(x,n){if(!(x instanceof Uint32Array)||Object.prototype.toString.call(x.buffer)==='[object SharedArrayBuffer]'||x.length!==n)throw TypeError('Owned exact-length source packet required');return x.slice();}
function signed(x){return new Int32Array(x.buffer,x.byteOffset,x.length);}
function equal(a,b){return a.length===b.length&&a.every((x,i)=>x===b[i]);}
/** The producer must supply the ORIGINAL input, cloth, and accepted outputs.
 * Re-evaluation is original recipe sampling with exact endpoint equality, never
 * a new physical model or an alternative acceptance decision.
 */
export function packMicrotailTraceSource({input,cloth,context,acceptedMicro,acceptedFraction,stableId,startTick}){
 input=own(input,32);cloth=own(cloth,16);context=own(context,160);acceptedMicro=own(acceptedMicro,96);acceptedFraction=own(acceptedFraction,96);
 if(!u32(stableId)||!u32(startTick)||startTick>0x7fffffff)throw RangeError('Stable ID and original signed-range source clock required');
 const checked=runClothMicrotailsCPU(input,cloth).output;
 if(checked[1]!==1||checked[4]>127||!equal(checked,acceptedMicro))throw RangeError('Accepted microtail must match original source recipe exactly');
 const fraction=advanceMicrotailFractionCPU(checked,context);
 if(fraction[1]!==1||!equal(fraction,acceptedFraction)||startTick+checked[6]>0x7fffffff)throw RangeError('Accepted original residual fraction required');
 const out=new Uint32Array(EVENTS+STRIDE*checked[4]),o=signed(out),s=signed(input),sc=signed(cloth),m=createContactMath();
 out.set([V,stableId,startTick,startTick+checked[6],checked[4],1,checked[21],CLOTH_MICROTAIL_VERSION,0,0,0,0]);out.set(input,INPUT);out.set(cloth,CLOTH);out.set(context,CONTEXT);out.set(checked,MICRO);out.set(fraction,FRACTION);
 let v=Array.from(s.slice(7,10)),q=Array.from(s.slice(10,13)),p=Array.from(s.slice(4,7)),sum=0;const error=[0,0,0],impulse=[0,0,0];
 for(let i=0;i<checked[4];i++){
  const speed=v[1];sum+=speed;
  for(const d of [0,2]){const w=multiplyWide(Math.abs(v[d]),2*speed),r=divideWide(w[0],w[1],sc[7]);if(!r.valid)throw RangeError('Original microtail arithmetic');p[d]+=(v[d]<0?-1:1)*r.quotient;error[d]+=Number(r.remainder!==0);}
  const bounce=m.cone(sc[8],speed),normal=speed+bounce,u=[v[0]+q[2],v[2]-q[0]],j=m.disk(u.map(x=>m.div(-x,7*Q/2,true)),m.cone(sc[9],normal));
  v=[v[0]+j[0],bounce,v[2]+j[1]];q=[q[0]-m.mul(5*Q/2,j[1]),q[1],q[2]+m.mul(5*Q/2,j[0])];
  impulse[0]+=normal;impulse[1]+=j[0];impulse[2]+=j[1];const at=EVENTS+i*STRIDE;out[at]=2*sum;o.set([...p,...v,...q,j[0],j[1]],at+1);
 }
 const c=signed(checked);if(m.bad||v[1]!==0||!equal([...p,...v,...q],Array.from(c.slice(8,17)))||!equal(error,Array.from(c.slice(17,20)))||!equal(impulse,Array.from(c.slice(22,25)))||2*sum!==checked[20])throw RangeError('Microtail recurrence differs from accepted producer');
 return out;
}
/** Validation is structural. Only packMicrotailTraceSource establishes matching
 * source/accepted outputs; transport consumers should re-pack to revalidate. */
export function validateMicrotailTraceSource(source){if(!(source instanceof Uint32Array)||Object.prototype.toString.call(source.buffer)==='[object SharedArrayBuffer]'||source.length<EVENTS||source[0]!==V||source[4]<1||source[4]>127||source.length!==EVENTS+source[4]*STRIDE||source[5]!==1||source[6]<1||source[7]!==CLOTH_MICROTAIL_VERSION||source.slice(8,12).some(Boolean))throw RangeError('Original bounded microtail trace source required');return source;}
export function revalidateMicrotailTraceSource(source){validateMicrotailTraceSource(source);const expected=packMicrotailTraceSource({input:source.slice(INPUT,INPUT+32),cloth:source.slice(CLOTH,CLOTH+16),context:source.slice(CONTEXT,CONTEXT+160),acceptedMicro:source.slice(MICRO,MICRO+96),acceptedFraction:source.slice(FRACTION,FRACTION+96),stableId:source[1],startTick:source[2]});if(!equal(source,expected))throw RangeError('Microtail trace source/clock/recurrence mismatch');return expected;}
/** Exact rational seconds relative to original start. No rounded bounce clocks.
 * An integer Q20 caller passes numerator=tick-startTick, denominator=2**20.
 */
export function sampleMicrotailTraceSource(source,{numerator,denominator,side='after'}){
 validateMicrotailTraceSource(source);if(!Number.isSafeInteger(numerator)||numerator<0||!Number.isSafeInteger(denominator)||denominator<1||!['before','after'].includes(side))throw RangeError('Nonnegative exact rational source time required');
 const n=BigInt(numerator),d=BigInt(denominator),base={stableId:source[1],startTick:source[2],time:{numerator,denominator},interpolation:false};
 if(n===0n)return {...base,status:'exact-source-boundary',state:source.slice(INPUT+4,INPUT+13),boundary:'START'};
 const microEnd=BigInt(source[MICRO+20]),g=BigInt(source[6]),h=BigInt(source[3]-source[2]);
 if(n*BigInt(T)>h*d)return {...base,status:'unavailable',reason:'OUTSIDE_SOURCE'};
 if(n*BigInt(T)===h*d&&side==='after')return {...base,status:'exact-source-boundary',state:source.slice(FRACTION+8,FRACTION+17),boundary:'COMMON_TICK_ENDPOINT'};
 for(let i=0;i<source[4];i++){const at=EVENTS+i*STRIDE;if(n*g===BigInt(source[at])*d){if(side==='before')return {...base,status:'unsupported',reason:'PRE_IMPACT_SAMPLE_NOT_CAPTURED'};return {...base,status:'exact-source-boundary',state:source.slice(at+1,at+10),boundary:'CLOTH_IMPACT',impactIndex:i,clock:{secondsNumerator:source[at],secondsDenominator:source[6]}};}}
 const inFlight=n*g<microEnd*d,at=inFlight?MICRO+32:FRACTION+40;return {...base,status:'bounded-source-interval',canonicalState:false,pointSampling:'unsupported',reason:inFlight?'INTRA_FLIGHT_SOURCE_SAMPLE_UNDEFINED':'INTRA_FRACTION_SOURCE_SAMPLE_UNDEFINED',positionBounds:signed(source).slice(at,at+6),positionBoundsOrder:'loXYZ-hiXYZ',boundsScope:inFlight?'original-whole-microtail-swept-box':'original-microtail-plus-fraction-swept-box'};
}
