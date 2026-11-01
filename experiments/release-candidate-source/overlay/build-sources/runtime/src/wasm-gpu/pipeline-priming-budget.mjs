import {LIVE_WORLD_PIPELINE_CACHE_LIMITS} from '../direct-candidate/experimental-live-world-pipeline-cache.mjs';
/** Preparation-only policy. Does not compile, mutate definitions or grant trust. */
export const MAX_SELECTED_PIPELINE_PRIMING = 16;
const key=({code,layout='auto',preflight=true,entryPoint='main'})=>JSON.stringify([code,layout,preflight,entryPoint]);
export function selectBoundedPipelinePriming(primary,selected,limits=LIVE_WORLD_PIPELINE_CACHE_LIMITS){
 if(!Array.isArray(primary)||!Array.isArray(selected)||[...primary,...selected].some(d=>typeof d?.code!=='string'))throw TypeError('Exact primary and selected pipeline definitions required');
 const {maximumCompleted,maximumKeyBytes}=limits??{};
 if(!Number.isSafeInteger(maximumCompleted)||maximumCompleted<1||!Number.isSafeInteger(maximumKeyBytes)||maximumKeyBytes<1)throw RangeError('Positive exact cache limits required');
 const known=new Set(primary.map(key));let bytes=[...known].reduce((sum,k)=>sum+k.length*2,0),count=known.size;
 if(count>=maximumCompleted||bytes>=maximumKeyBytes)return Object.freeze([]);
 const encoder=new TextEncoder(),candidates=[];
 for(const [index,definition]of selected.entries()){const identity=key(definition);if(known.has(identity))continue;known.add(identity);candidates.push({index,definition,keyBytes:identity.length*2,shaderBytes:encoder.encode(definition.code).byteLength});}
 candidates.sort((a,b)=>b.shaderBytes-a.shaderBytes||a.index-b.index);
 const chosen=[];
 for(const candidate of candidates){
  // A bounded largest-first PREFIX: never skip a costly member to pick smaller ones.
  if(chosen.length===MAX_SELECTED_PIPELINE_PRIMING||count+1>maximumCompleted||bytes+candidate.keyBytes>maximumKeyBytes)break;
  chosen.push(Object.freeze(candidate));count++;bytes+=candidate.keyBytes;
 }
 return Object.freeze(chosen);
}
