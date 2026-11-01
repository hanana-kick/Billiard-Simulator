// Opt-in HOST packing/inspection for the original inverse observation reducer.
// Frames are source observations, not presentation events or physics inputs.
import {isOwnedUint32Array} from './abi.mjs';
export const INVERSE_REDUCER_PROFILE='source-inverse-observation-reducer-v1';
export const INVERSE_REDUCER_NUMBERS='v8-13.6.233-fast-hypot-binary64-v1';
export const INVERSE_REDUCER_CAPABILITY=Object.freeze({profile:INVERSE_REDUCER_PROFILE,numberProfile:INVERSE_REDUCER_NUMBERS,source:'inverse-events.js observation/create/initial/step/projectResult',sourceQueryOnly:true,worldProducerImplemented:false,convexQueryImplemented:false,gpuNumericallyQualified:false,finalGameplayQualified:false,defaultEnabled:false});
export const OBSERVATION_WORDS=Object.freeze({configMagic:0x52494f43,frameMagic:0x52494f46,stateMagic:0x52494f53,version:1,header:64,stage:12,pair:2,event:8,frameHeader:24,target:12});
export const OBSERVATION_STATUS=Object.freeze({READY:1,UNSUPPORTED:2,FAILED:3});
export const OBSERVATION_REASON=Object.freeze({NONE:0,FRAME:1,ORDER:2,CAPACITY:3,NUMERIC:4,MISSING_TARGET:5,MISSING_GEOMETRY:6,STATE:7,ROUND_DOMAIN:8});
export const OBSERVATION_RAILS=Object.freeze(['x+','x-','z+','z-']);
const need=(ok,message)=>{if(!ok)throw new TypeError('Inverse resident observation: '+message);};
const uint=x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff;
const id=x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const vec=v=>v&&['x','y','z'].every(k=>finite(v[k]));
const f64=(w,p,n)=>new DataView(w.buffer,w.byteOffset,w.byteLength).setFloat64(p*4,n,true);
const number=(w,p)=>new DataView(w.buffer,w.byteOffset,w.byteLength).getFloat64(p*4,true);
const xyz=(w,p)=>({x:number(w,p),y:number(w,p+2),z:number(w,p+4)});
const event=(kind,key)=>kind===0?{kind:'object',id:key}:{kind:'cushion',rail:OBSERVATION_RAILS[key]};
/** Capacity is admission, never a claim about qualified candidate throughput. */
export function createInverseObservationLayout({topology,objectIds,rails,eventCapacity=256,numberProfile=INVERSE_REDUCER_NUMBERS}={}){
 need(numberProfile===INVERSE_REDUCER_NUMBERS,'explicit pinned Number profile');
 const events=topology?.events??topology?.topology?.events;
 need(Array.isArray(events)&&events.length>=1&&events.length<=64,'1..64 ordered stages');
 need(Array.isArray(objectIds)&&objectIds.length<=8&&objectIds.every(id)&&new Set(objectIds).size===objectIds.length,'ordered distinct uint32 object roster, at most8');
 need(Array.isArray(rails)&&rails.length<=4&&rails.every(x=>OBSERVATION_RAILS.includes(x))&&new Set(rails).size===rails.length,'ordered distinct original cushion roster');
 need(uint(eventCapacity)&&eventCapacity>=1&&eventCapacity<=4096,'explicit1..4096 event capacity');
 const expected=events.map(e=>{need(e&&((e.kind==='object'&&id(e.id))||(e.kind==='cushion'&&OBSERVATION_RAILS.includes(e.rail))),'original event kind/key');return e.kind==='object'?{kind:'object',id:e.id}:{kind:'cushion',rail:e.rail};});
 const pairs=objectIds.length+rails.length,stageBase=64,pairBase=stageBase+12*expected.length,eventBase=pairBase+2*pairs,stateWords=eventBase+8*eventCapacity,frameWords=24+12*pairs,configWords=12+expected.length*2+pairs;
 const config=new Uint32Array(configWords);config.set([OBSERVATION_WORDS.configMagic,1,expected.length,objectIds.length,rails.length,eventCapacity,stateWords,frameWords,stageBase,pairBase,eventBase,configWords]);let p=12;for(const e of expected){config[p++]=e.kind==='object'?0:1;config[p++]=e.kind==='object'?e.id:OBSERVATION_RAILS.indexOf(e.rail);}config.set(objectIds,p);config.set(rails.map(x=>OBSERVATION_RAILS.indexOf(x)),p+objectIds.length);
 return Object.freeze({kind:INVERSE_REDUCER_PROFILE,numberProfile,expected:Object.freeze(expected.map(Object.freeze)),objectIds:Object.freeze([...objectIds]),rails:Object.freeze([...rails]),eventCapacity,pairs,stageBase,pairBase,eventBase,stateWords,frameWords,configWords,config});
}
export function assertInverseObservationLayout(l){
 need(l?.kind===INVERSE_REDUCER_PROFILE,'known layout');const rebuilt=createInverseObservationLayout({topology:{events:l.expected},objectIds:l.objectIds,rails:l.rails,eventCapacity:l.eventCapacity,numberProfile:l.numberProfile});
 for(const k of ['pairs','stageBase','pairBase','eventBase','stateWords','frameWords','configWords'])need(l[k]===rebuilt[k],'immutable layout '+k);
 need(isOwnedUint32Array(l.config)&&l.config.length===rebuilt.config.length&&l.config.every((x,i)=>x===rebuilt.config[i]),'immutable source config');return l;
}
export function initializeInverseObservationState(layout,start=0){const l=assertInverseObservationLayout(layout);need(finite(start),'finite original start');const w=new Uint32Array(l.stateWords);w.set([OBSERVATION_WORDS.stateMagic,1,1,0]);f64(w,16,start);f64(w,18,start);return w;}
/** Detached exact source post-solver frame. Projection null stays unavailable;
 * a caller cannot substitute an ideal plane or a debounced contact event list. */
export function packInverseObservationFrame(layout,frame){
 const l=assertInverseObservationLayout(layout),initial=frame?.phase==='initial-before-world-step';
 need(frame&&(initial||frame.phase==='after-world-step-before-application')&&uint(frame.sequence)&&finite(frame.time)&&(initial?frame.stepDt===0:finite(frame.stepDt)&&frame.stepDt>0)&&vec(frame.cue?.position)&&finite(frame.cue.radius)&&frame.cue.radius>0,'exact source phase/clock/cue');
 need(Array.isArray(frame.objects)&&Array.isArray(frame.rails)&&frame.objects.length===l.objectIds.length&&frame.rails.length===l.rails.length,'fixed source roster');
 const w=new Uint32Array(l.frameWords);w.set([OBSERVATION_WORDS.frameMagic,1,initial?0:1,frame.sequence]);f64(w,4,frame.time);f64(w,6,frame.stepDt);['x','y','z'].forEach((k,i)=>f64(w,8+2*i,frame.cue.position[k]));f64(w,14,frame.cue.radius);w[16]=l.objectIds.length;w[17]=l.rails.length;
 frame.objects.forEach((o,i)=>{need(o?.id===l.objectIds[i]&&vec(o.position)&&finite(o.radius)&&o.radius>0&&typeof o.impact==='boolean','ordered original sphere');const b=24+12*i;w[b]=o.id;w[b+1]=+o.impact;['x','y','z'].forEach((k,j)=>f64(w,b+2+2*j,o.position[k]));f64(w,b+8,o.radius);});
 frame.rails.forEach((r,i)=>{need(r?.rail===l.rails[i]&&typeof r.impact==='boolean','ordered original cushion');const p=r.projection;need(p===null||vec(p?.point)&&typeof p.isInside==='boolean','actual nullable convex projection');need(!r.impact||p!==null,'impacted cushion projection required');const b=24+12*(l.objectIds.length+i);w[b]=OBSERVATION_RAILS.indexOf(r.rail);w[b+1]=+r.impact;w[b+2]=+(p!==null);if(p){w[b+3]=+p.isInside;['x','y','z'].forEach((k,j)=>f64(w,b+4+2*j,p.point[k]));}});return w;
}
/** TEST/diagnostic decoding only. Production consumes resident words. */
export function decodeInverseObservationState(layout,w){
 const l=assertInverseObservationLayout(layout);need(isOwnedUint32Array(w)&&w.length===l.stateWords&&w[0]===OBSERVATION_WORDS.stateMagic&&w[1]===1,'complete owned state');need(w[6]<=l.expected.length&&w[12]<=l.eventCapacity&&w[13]<=w[12]&&w[7]<=2&&w[14]<=2,'bounded source state');
 const events=Array.from({length:w[12]},(_,i)=>{const p=l.eventBase+8*i;return{...event(w[p],w[p+1]),time:number(w,p+2),stepDt:number(w,p+4),stepIndex:w[p+6]};});
 const e={expected:structuredClone(l.expected),observationStart:number(w,16),eventPrefix:w[6],stageResiduals:[],events,pending:[],pairs:new Map(),returnStages:new Map(),mismatch:null,observedSubsteps:w[4],lastObservationTime:number(w,18),initialObserved:!!w[5]};
 l.expected.forEach((_,i)=>{const p=l.stageBase+12*i;e.stageResiduals.push(w[p]?Array.from({length:3},(_,j)=>number(w,p+1+2*j)):null);if(w[p+7])e.returnStages.set(i,{gap:number(w,p+8),returning:!!w[p+10]});});
 for(let i=0;i<l.pairs;i++)if(w[l.pairBase+2*i])e.pairs.set(i<l.objectIds.length?'object:'+l.objectIds[i]:'cushion:'+l.rails[i-l.objectIds.length],{active:!!w[l.pairBase+2*i+1]});
 if(w[7]){const actual=events.slice(w[9],w[9]+w[10]);e.mismatch=w[7]===2?{stage:w[8],reason:'ambiguous-simultaneous-events',actual}:{stage:w[8],reason:'unexpected-event',expected:e.expected[w[8]],actual:actual[0]};}
 if(w[11])e.unavailable=w[11]===1?'missing-target':'missing-cushion-geometry';if(w[13])e.firstImpact=events[w[13]-1];
 if(w[14]===1)e.previousMeasurement=null;else if(w[14]===2)e.previousMeasurement={stage:w[15],cue:xyz(w,20),target:xyz(w,26),radius:number(w,32)};
 return{status:w[2],reason:w[3],observation:e};
}
