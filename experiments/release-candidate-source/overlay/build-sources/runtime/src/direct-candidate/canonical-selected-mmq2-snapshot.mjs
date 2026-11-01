/** Versioned MMQ2 snapshot decoder, not a GPU producer or a complete trace.
 * Reuses the bounded 4096-word layout, retaining every original descriptor word.
 * The producer must append each accepted cushion impact/departure separately. */
import {SELECTED_WORLD_TRACE_LAYOUT} from './canonical-selected-world-trace-gpu.mjs';
import {selectedMMQ2PhaseRecords} from './canonical-selected-mmq2-source.mjs';
export const SELECTED_MMQ2_SNAPSHOT_VERSION=0x53574702;
export const SELECTED_MMQ2_SNAPSHOT_PHASE=Object.freeze({CLEAR:6,PAIR:7,STOP:8,CUSHION_IMPACT:9,CUSHION_DEPARTURE:10});
export const SELECTED_MMQ2_SNAPSHOT_LAYOUT=SELECTED_WORLD_TRACE_LAYOUT;
const V=SELECTED_MMQ2_SNAPSHOT_VERSION,P=SELECTED_MMQ2_SNAPSHOT_PHASE,L=SELECTED_MMQ2_SNAPSHOT_LAYOUT;
function cut(r,name){const[at,n]=L[name];return r.slice(at,at+n);}
export function selectedMMQ2SnapshotRecords(r){
 if(!(r instanceof Uint32Array)||Object.prototype.toString.call(r.buffer)==='[object SharedArrayBuffer]'||r.length!==4096||r[0]!==V||r[13]!==0x4d4d5102||![3,4].includes(r[4])||!Object.values(P).includes(r[1]))throw RangeError('Explicit owned MMQ2 snapshot phase');
 const beforeState=cut(r,'beforeState'),afterState=cut(r,'afterState'),n=r[4];
 if([beforeState,afterState].some(s=>s[0]!==r[10]||s[41]!==r[11]||s[42]!==r[12]||s[3]!==n)||beforeState[5]!==r[2]||afterState[5]!==r[3])throw RangeError('MMQ2 snapshot header identity/clock');
 const descriptors=cut(r,'descriptors').slice(0,n*80),entry=cut(r,'entry');
 const kinds={[P.CLEAR]:'mixed-clear-prefix-v2',[P.PAIR]:'mixed-pair-v2',[P.STOP]:'rolling-stop-v2',[P.CUSHION_IMPACT]:'finite-cushion-v2',[P.CUSHION_DEPARTURE]:'cushion-departure-v2'};
 return selectedMMQ2PhaseRecords({kind:kinds[r[1]],beforeState,afterState,descriptors,entry,...(r[1]===P.CUSHION_IMPACT?{impactState:afterState}:{} )});
}
