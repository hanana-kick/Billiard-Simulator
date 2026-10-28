// SPDX-License-Identifier: Apache-2.0
// Lossless INITIAL-only tape serialization. No event/rule evaluator lives here.
import {assertThreeBallCreatedOwnerTemplate} from './three-ball-created-owner.mjs';
import {numberWords,wordsNumber} from './source-number.mjs';
const owned=new WeakMap(),MAGIC=0x52335450;
const need=(p,m)=>{if(!p)throw Object.assign(new RangeError('Three-ball retained tape: '+m),{code:'three-ball-retained-tape-unsupported'});};
// Preserve JS UTF-16 code units, including a lone surrogate (UTF-8 would
// silently replace it). No label text is normalized.
const encodeString=(value,out)=>{out.push(value.length);for(let i=0;i<value.length;i+=2)out.push((value.charCodeAt(i)|((i+1<value.length?value.charCodeAt(i+1):0)<<16))>>>0);};
function encode(value,out,seen){
 if(value===null){out.push(0);return;}if(value===false||value===true){out.push(value?2:1);return;}if(value===undefined){out.push(7);return;}
 if(typeof value==='number'){need(Number.isFinite(value),'finite original Number only');out.push(3,...numberWords(value));return;}if(typeof value==='string'){out.push(4);encodeString(value,out);return;}
 need(value&&typeof value==='object'&&!ArrayBuffer.isView(value)&&!seen.has(value),'acyclic original plain data only');seen.add(value);
 if(Array.isArray(value)){need(Object.keys(value).length===value.length,'dense original arrays');out.push(5,value.length);for(const x of value)encode(x,out,seen);}
 else{need(Object.getPrototypeOf(value)===Object.prototype,'plain original record');const entries=Object.entries(value);out.push(6,entries.length);for(const[k,v]of entries){encodeString(k,out);encode(v,out,seen);}}seen.delete(value);
}
function decode(words){let cursor=4;const take=()=>{need(cursor<words.length,'complete tagged payload');return words[cursor++];},string=()=>{const count=take();need(count<0x1000000&&cursor+Math.ceil(count/2)<=words.length,'bounded string');const chars=[];for(let i=0;i<count;i++)chars.push(String.fromCharCode((words[cursor+(i>>>1)]>>>((i&1)*16))&65535));cursor+=Math.ceil(count/2);return chars.join('');},read=()=>{switch(take()){case 0:return null;case 1:return false;case 2:return true;case 3:{const a=take(),b=take();return wordsNumber(Uint32Array.of(a,b));}case 4:return string();case 5:{const count=take();need(count<0x100000,'bounded array');return Array.from({length:count},read);}case 6:{const count=take();need(count<0x100000,'bounded object');const out={};for(let i=0;i<count;i++){const key=string();need(!Object.hasOwn(out,key),'unique source key');Object.defineProperty(out,key,{value:read(),enumerable:true,writable:true,configurable:true});}return out;}case 7:return undefined;default:throw new RangeError('Unknown original tape tag');}};need(words[0]===MAGIC&&words[1]===1&&words[2]===words.length&&words[3]===1,'exact tape header');const out=read();need(cursor===words.length,'no trailing projected data');return out;}
export function createThreeBallRetainedTapePlan(template){
 need(arguments.length===1,'one authentic initial template');assertThreeBallCreatedOwnerTemplate(template);const o=template.seed.sourceOrigin;
 // Original capture forks through PhysicsLab.restore, which constructs a NEW
 // EventQueue(true). Its authenticated API journal admits zero native steps.
 // This is constructor provenance, not an invented snapshot queue projection.
 need(o.nativeRestoreUsed===true&&o.preStrikeClock.nativeFrameIndex===o.createdClock.nativeFrameIndex&&o.preStrikeClock.steps===o.createdClock.steps&&Object.is(o.preStrikeClock.time,o.createdClock.time),'original fresh fork queue and zero-step cue creation');
 const value={history:template.seed.history,game:template.seed.game,events:template.seed.application.events},raw=[MAGIC,1,0,1];encode(value,raw,new Set());raw[2]=raw.length;
 const initialWords=Uint32Array.from(raw),plan=Object.freeze({kind:'resident-three-ball-initial-retained-tape-v1',template,sourceIdentity:template.sourceIdentity,initialWords,stateWords:initialWords.length,initialQueueAuthority:'original-PhysicsLab.restore-new-EventQueue-zero-native-steps',capability:Object.freeze({initialOnly:true,losslessNumbers:true,noEmissionRetentionOnly:true,generalRuleEvaluation:false,wholeH:false,runtimeIntegrated:false})});Object.preventExtensions(initialWords);owned.set(plan,initialWords.slice());return plan;
}
export function assertThreeBallRetainedTapePlan(plan){const seal=owned.get(plan);need(seal,'locally branded initial tape');assertThreeBallCreatedOwnerTemplate(plan.template);need(plan.initialWords.length===seal.length&&plan.initialWords.every((x,i)=>x===seal[i]),'initial tape mutated/detached');return plan;}
export function decodeThreeBallRetainedTapeForTest(plan,words,{testOnly=false}={}){need(testOnly===true,'explicit diagnostic only');assertThreeBallRetainedTapePlan(plan);need(words instanceof Uint32Array&&words.length===plan.stateWords,'exact tape extent');return decode(words);}
export function generateThreeBallRetainedTapeWGSL(plan,{stateBase,geometryBase}={}){assertThreeBallRetainedTapePlan(plan);need([stateBase,geometryBase].every(x=>Number.isSafeInteger(x)&&x>=0&&x<0x10000000),'bounded exact bases');return `
fn rc_three_tape_preserved()->bool{
 if(rc_state[${stateBase}u]!=0x52335450u||rc_state[${stateBase+1}u]!=1u||rc_state[${stateBase+2}u]!=${plan.stateWords}u||rc_state[${stateBase+3}u]!=1u){return false;}
 for(var n=0u;n<${plan.stateWords}u;n++){if(rc_state[${stateBase}u+n]!=rc_geometry[${geometryBase}u+n]){return false;}}return true;
}
`;}

/** Codec component witness only. This creates neither a branded plan nor an
 * admissible history/owner boundary; arbitrary values cannot enter execution. */
export function roundTripThreeBallTapeValueForTest(value,{testOnly=false}={}){need(testOnly===true,'explicit codec component test only');const raw=[MAGIC,1,0,1];encode(value,raw,new Set());raw[2]=raw.length;const words=Uint32Array.from(raw);return{words,value:decode(words)};}
