/** Source-to-record adapter only. No evolution, contact solve, or GPU claim.
 * The world owner captures original descriptors before overwriting them. */
import {validateMixedMotionV2} from './deterministic-mixed-motion-v2.mjs';
import {validateMixedMotionDescriptors} from './deterministic-mixed-motion-query.mjs';
import {selectedTraceWorldBoundary} from './canonical-selected-trace.mjs';
const V1=0x4d4d5101,V2=0x4d4d5102;
const plainKinds=new Set(['mixed-clear-prefix-v2','finite-cushion-clear-v2','rolling-stop-v2','cushion-departure-v2']);
function own(x,n){if(!(x instanceof Uint32Array)||Object.prototype.toString.call(x.buffer)==='[object SharedArrayBuffer]'||x.length!==n)throw RangeError('Owned complete MMQ2 source words required');return x.slice();}
function identity(a,b){if(![3,4].includes(a[3])||[0,3,41,42].some(k=>a[k]!==b[k])||a[5]>b[5]||b[5]>0x7fffffff)throw RangeError('MMQ2 accepted source identity/clock');for(let i=0;i<a[3];i++){const p=64+48*i;for(const k of[0,22,23])if(a[p+k]!==b[p+k])throw RangeError('MMQ2 accepted roster identity');}}
function record(rows,before,after,event=null,{departure=false}={}){
 identity(before,after);rows=own(rows,before[3]*80);const version=rows[0];if(version!==V2&&!(departure&&version===V1))throw RangeError('Original MMQ2 source or explicit original departure required');(version===V2?validateMixedMotionV2:validateMixedMotionDescriptors)(rows);
 for(let i=0;i<before[3];i++){const d=80*i,b=64+48*i;if(rows[d+6]!==before[5]||rows[d+3]!==before[b]||rows[d+4]!==before[b+22]||rows[d+17]!==before[b+23]||rows[d+1]!==before[b+40]||rows[d+2]<after[5]-before[5]||Array.from(rows.slice(d+8,d+17)).some((v,k)=>v!==before[b+24+k]))throw RangeError('Original MMQ2 source anchor/horizon mismatch');}
 return {startTick:before[5],endTick:after[5],sourceKind:version===V2?2:1,sourceWords:rows,startState:selectedTraceWorldBoundary(before),endState:selectedTraceWorldBoundary(after),event};
}
function bracket(entry,before,after,kind){entry=own(entry,128);const h=after[5]-before[5];if(entry[1]!==1||entry[4]>entry[5]||entry[5]!==h)throw RangeError('Accepted original event bracket');return {kind,lo:before[5]+entry[4],hi:after[5],resolved:true};}
/** Outputs at most two independent captureAccepted arguments, with owned words.
 * A rejected departure retains the real impact but invents no following motion. */
export function selectedMMQ2PhaseRecords({kind,beforeState,afterState,descriptors,entry,impactState,departureDescriptors}){
 const before=own(beforeState,256),after=own(afterState,256);identity(before,after);
 if(plainKinds.has(kind)){if([21,45,61].some(k=>before[k]!==after[k])||after[5]<=before[5])throw RangeError('Accepted non-impulse MMQ2 progress required');return [record(descriptors,before,after)];}
 if(kind==='mixed-pair-v2'){if(after[45]!==before[45]+1||after[21]!==before[21]||after[61]!==before[61])throw RangeError('One actual MMQ2 pair required');return [record(descriptors,before,after,bracket(entry,before,after,1))];}
 if(kind!=='finite-cushion-v2')throw RangeError('Explicit accepted MMQ2 phase required');
 const impact=own(impactState,256);identity(before,impact);identity(impact,after);if(impact[61]!==before[61]+1||after[61]!==impact[61]||[21,45].some(k=>before[k]!==impact[k]||impact[k]!==after[k]))throw RangeError('One actual finite cushion required');
 const out=[record(descriptors,before,impact,bracket(entry,before,impact,2))];
 if(after[5]>impact[5])out.push(record(departureDescriptors,impact,after,null,{departure:true}));
 else if(selectedTraceWorldBoundary(impact).some((v,i)=>v!==selectedTraceWorldBoundary(after)[i]))throw RangeError('Unadvanced departure changed accepted physical state');
 return out;
}
