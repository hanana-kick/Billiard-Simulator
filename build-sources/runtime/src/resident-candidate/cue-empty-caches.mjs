/* SPDX-License-Identifier: Apache-2.0
 * Resident storage adapters of the original empty cue-pair cache recurrence.
 * Source arithmetic and persistent-normal query are not rewritten. No graph
 * edge is created here, no contact is solved, and no separation is assumed.
 */
import * as importedPair from '../experimental-cue-empty-pair-cache.js';
const Pair=importedPair.default??globalThis.LabCueEmptyPairCacheExperimental;
import * as importedConvex from '../experimental-cue-empty-convex-cache.js';
const Convex=importedConvex.default??globalThis.LabCueEmptyConvexCacheExperimental;
import {compileGraph,executeLowered} from './numeric-program.mjs';
export const EMPTY_CUE_CACHE_LAYOUT=Object.freeze({words:48,headerWords:16,recurrence:16,recurrenceWords:20,normal:36,normalWords:10,inputWords:56,numericOutputWords:34,queryInputWords:28,queryOutputWords:8,queryScratchWords:116,queryLoopScratchWords:117,queryChunkScratchWords:118,gjkIterations:256,
 header:Object.freeze({magic:0,kind:1,status:2,valid:3,epoch:4,pendingEpoch:5,pair:6,hull:7,sphereRadius:8,cylinderRadius:9,cylinderHalfHeight:10,queryNeeded:11}),
 capability:Object.freeze({persistentEmptyCache:true,currentSeparationRequired:true,originalSourceOrder:true,graphOwnership:false,activeRigidContacts:false,fullWorld:false})});
const MAGIC=0x52434543;
export function createEmptyCueCachePrograms(){const pair=compileGraph(Pair.buildPlan()),convex=compileGraph(Convex.buildPlan()),words=new Uint32Array(pair.program.length+convex.program.length);words.set(pair.program);words.set(convex.program,pair.program.length);return Object.freeze({words,pair,convex,pairOffset:0,convexOffset:pair.program.length,scratchWords:Math.max(pair.scratchWords,convex.scratchWords,Convex.STATE_FLOATS)});}
/** Only immutable shape identity and empty allocation; no source future cache. */
export function initializeEmptyCueCache({kind,pairId,hullOffset=0,sphereRadius=0,cylinderRadius,cylinderHalfHeight}){if(!['sphere-cylinder','convex-cylinder'].includes(kind)||![pairId,hullOffset].every(x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff)||![sphereRadius,cylinderRadius,cylinderHalfHeight].every(x=>Number.isFinite(x)&&x===Math.fround(x))||cylinderRadius<=0||cylinderHalfHeight<=0||kind==='sphere-cylinder'&&sphereRadius<=0)throw new TypeError('Immutable original empty-pair identity required');const a=new Uint32Array(48),f=new Float32Array(a.buffer);a.set([MAGIC,kind==='sphere-cylinder'?1:2,1,0,0,0,pairId,hullOffset]);f.set([sphereRadius,cylinderRadius,cylinderHalfHeight],8);return a;}
function functions(code){const result=new Map(),re=/\bfn\s+(\w+)\s*\(/g;let m;while((m=re.exec(code))){const open=code.indexOf('{',re.lastIndex);let depth=1,end=open+1;for(;depth&&end<code.length;end++){if(code[end]==='{')depth++;if(code[end]==='}')depth--;}if(depth)throw Error('Unbalanced original empty-cache source');result.set(m[1],code.slice(m.index,end));re.lastIndex=end;}return result;}
/** Exact source hull-first GJK with only address adapters and alpha-renaming. */
export function generateEmptyConvexQueryWGSL(stage,{storageLoop=false,queryChunk=1}={}){if(!['init','gjk','finish'].includes(stage))throw new RangeError('Original empty convex query stage required');if(typeof storageLoop!=='boolean'||![1,2,4,8].includes(queryChunk)||storageLoop&&queryChunk!==1)throw new TypeError('Explicit query loop transport required');const chunked=queryChunk!==1;const f=functions(Convex.generateWGSL(stage));f.delete('main');f.set('sget','fn sget(i:i32)->f32{return bitcast<f32>(rc_scratch[rc_empty_query_scratch+u32(i)]);}');f.set('sset','fn sset(i:i32,x:f32){rc_scratch[rc_empty_query_scratch+u32(i)]=bitcast<u32>(x);}');f.set('iget','fn iget(i:i32)->f32{return bitcast<f32>(rc_state[rc_empty_query_input+u32(i)]);}');f.set('oset','fn oset(i:i32,x:f32){rc_state[rc_empty_query_output+u32(i)]=bitcast<u32>(x);}');f.set('hget','fn hget(i:i32)->f32{return bitcast<f32>(rc_geometry[rc_empty_query_hull+u32(i)]);}');const names=new Set([...f.keys(),'V','Cso','Projection']),rename=s=>s.replace(/\b[A-Za-z_]\w*\b/g,x=>names.has(x)?'rc_empty_query_'+x:x);return `
var<private> rc_empty_query_scratch:u32;var<private> rc_empty_query_input:u32;var<private> rc_empty_query_output:u32;var<private> rc_empty_query_hull:u32;
${rename('alias V=vec3<f32>;struct Cso{orig1:V,orig2:V,point:V};struct Projection{point:V,kind:i32,index:i32,weights:V};')}
${[...f.values()].map(rename).join('\n')}
fn rc_empty_convex_query_stage(cache:u32,scratch:u32,input:u32,output:u32){
 if(rc_state[cache+2u]!=2u||rc_state[cache+11u]!=1u){return;}
${storageLoop||chunked?' if(scratch>=arrayLength(&rc_scratch)||arrayLength(&rc_scratch)-scratch<'+(chunked?118:117)+'u){rc_state[cache+2u]=4u;return;}\n':''} rc_empty_query_scratch=scratch;rc_empty_query_input=input;rc_empty_query_output=output;rc_empty_query_hull=rc_state[cache+7u];
 ${stage==='init'?'for(var i=0u;i<116u;i++){rc_scratch[scratch+i]=0u;}for(var i=0u;i<8u;i++){rc_state[output+i]=0u;}rc_empty_query_init();'+(storageLoop?'rc_scratch[scratch+116u]=256u;':chunked?'rc_scratch[scratch+116u]=256u;rc_scratch[scratch+117u]=0u;':''):stage==='gjk'?(storageLoop?'let bound=rc_scratch[scratch+116u];if(bound==0u||bound>256u){rc_state[cache+2u]=4u;return;}for(var i=0u;i<bound;i++){if(rc_scratch[scratch]!=0u){break;}rc_empty_query_gjk_step();}if(bound!=256u){rc_state[cache+2u]=4u;return;}rc_scratch[scratch+116u]=0u;':chunked?`if(rc_scratch[scratch+116u]!=256u||rc_scratch[scratch+117u]>256u||rc_scratch[scratch+117u]%${queryChunk}u!=0u){rc_state[cache+2u]=4u;return;}if(rc_scratch[scratch+117u]==256u){return;}${Array.from({length:queryChunk},()=>`rc_empty_query_gjk_step();rc_scratch[scratch+117u]++;`).join('')}`:'rc_empty_query_gjk_step();'):(chunked?'if(rc_scratch[scratch+116u]!=256u||rc_scratch[scratch+117u]!=256u){rc_state[cache+2u]=4u;return;}rc_scratch[scratch+116u]=0u;rc_scratch[scratch+117u]=0u;':'')+'rc_empty_query_finish();'}
}`;}
export function generateEmptyCueCacheWGSL(){return /* wgsl */ `
fn rc_empty_finite(x:u32)->bool{return (x&0x7f800000u)!=0x7f800000u;}
fn rc_empty_fail(c:u32)->bool{rc_state[c+2u]=4u;return false;}
// Call immediately after the ORIGINAL current-pose contact dispatcher, not an
// AABB proxy, old clearance, or a CPU flag. Receipt identity is checked below.
fn rc_empty_separation_receipt(queryInput:u32,output:u32,epoch:u32,pair:u32,proof:u32){
 let prediction=rc_state[queryInput+22u];
 rc_state[proof]=3u;rc_state[proof+1u]=epoch;rc_state[proof+2u]=pair;rc_state[proof+3u]=prediction;
 if(!rc_empty_finite(prediction)){return;}
 let status=bitcast<f32>(rc_state[output]);
 if(status==0.0){rc_state[proof]=1u;return;}
 if(status==1.0&&rc_empty_finite(rc_state[output+1u])&&bitcast<f32>(rc_state[output+1u])>bitcast<f32>(prediction)){rc_state[proof]=1u;return;}
 // Contact or unresolved is unsupported by this EMPTY-cache owner, not a miss.
}
fn rc_empty_cache_begin(c:u32,input:u32,proof:u32,epoch:u32)->bool{
 if(rc_state[c]!=0x52434543u||rc_state[c+2u]!=1u||rc_state[c+1u]<1u||rc_state[c+1u]>2u||rc_state[proof]!=1u||rc_state[proof+1u]!=epoch||rc_state[proof+2u]!=rc_state[c+6u]||rc_state[proof+3u]!=rc_state[input+24u]||(rc_state[c+3u]!=0u&&epoch<=rc_state[c+4u])){return rc_empty_fail(c);}
 if(rc_state[input+21u]!=rc_state[c+9u]||rc_state[input+22u]!=rc_state[c+10u]||(rc_state[c+1u]==1u&&rc_state[input+10u]!=rc_state[c+8u])){return rc_empty_fail(c);}
 for(var i=0u;i<17u;i++){rc_state[input+25u+i]=0u;}
 if(rc_state[c+3u]!=0u){for(var i=0u;i<17u;i++){rc_state[input+25u+i]=rc_state[c+16u+i];}}
 else{rc_state[input+31u]=0x3f800000u;rc_state[input+35u]=0x3f800000u;rc_state[input+39u]=0x3f800000u;}
 rc_state[input+42u]=select(0u,0x3f800000u,rc_state[c+3u]!=0u);rc_state[c+5u]=epoch;rc_state[c+2u]=2u;rc_state[c+11u]=0u;return true;
}
// Source-ordered lowered recurrence. scratch is reused after this dispatch.
fn rc_empty_cache_numeric(c:u32,input:u32,output:u32,program:u32,scratch:u32)->bool{
 if(rc_state[c+2u]!=2u){return false;}let n=select(48u,56u,rc_state[c+1u]==2u);let outn=select(20u,34u,rc_state[c+1u]==2u);
 if(rc_program[program+3u]!=n||rc_program[program+4u]!=outn){return rc_empty_fail(c);}
 for(var i=0u;i<n;i++){rc_scratch[scratch+i]=rc_state[input+i];}
 if(rc_num_eval(program,scratch)!=1u){return rc_empty_fail(c);}let indices=program+rc_program[program+8u];
 for(var i=0u;i<outn;i++){rc_state[output+i]=rc_scratch[scratch+rc_program[indices+i]];}
 if(rc_state[output+17u]!=0u&&rc_state[output+17u]!=0x3f800000u){return rc_empty_fail(c);}
 rc_state[c+11u]=select(0u,1u,rc_state[c+1u]==2u&&rc_state[output+17u]==0u);return true;
}
fn rc_empty_cache_query_input(c:u32,input:u32,numeric:u32,query:u32){
 if(rc_state[c+2u]!=2u||rc_state[c+11u]!=1u){return;}
 for(var i=0u;i<28u;i++){rc_state[query+i]=0u;}
 for(var i=0u;i<7u;i++){rc_state[query+i]=rc_state[numeric+20u+i];rc_state[query+10u+i]=rc_state[numeric+27u+i];}
 rc_state[query+17u]=rc_state[input+22u];rc_state[query+18u]=rc_state[input+21u];rc_state[query+22u]=rc_state[input+24u];
 if(rc_state[c+3u]!=0u){for(var i=0u;i<3u;i++){rc_state[query+24u+i]=rc_state[c+36u+i];}}
}
fn rc_empty_cache_commit(c:u32,input:u32,numeric:u32,queryOutput:u32)->bool{
 if(rc_state[c+2u]!=2u){return false;}
 if(rc_state[c+11u]!=0u){
  for(var i=0u;i<8u;i++){if(!rc_empty_finite(rc_state[queryOutput+i])){return rc_empty_fail(c);}}
  if(rc_state[queryOutput]!=0x3f800000u||bitcast<f32>(rc_state[queryOutput+7u])<=bitcast<f32>(rc_state[input+24u])){return rc_empty_fail(c);}
  for(var i=0u;i<3u;i++){rc_state[c+36u+i]=rc_state[queryOutput+1u+i];rc_state[c+39u+i]=0u;rc_state[c+42u+i]=rc_state[queryOutput+4u+i];}rc_state[c+45u]=rc_state[queryOutput+7u];
 }
 // Recycled convex normals are intentionally NOT rotated or refreshed.
 for(var i=0u;i<20u;i++){rc_state[c+16u+i]=rc_state[numeric+i];}
 rc_state[c+3u]=1u;rc_state[c+4u]=rc_state[c+5u];rc_state[c+11u]=0u;rc_state[c+2u]=1u;return true;
}
`;}
/** Test-only source transport oracle; never a production candidate fallback. */
export function executeEmptyCacheForTest({programs,cache,input,hull,epoch,separated,testOnly=false}){
 if(testOnly!==true)throw new TypeError('Empty cache host execution is TEST-ONLY');if(separated!==true)throw new RangeError('Independently proven CURRENT separation required');
 const kind=cache[1],source=kind===1?Pair:Convex,binding=kind===2?Convex.hullBinding({hull}):null,state=cache.slice();if(state[0]!==MAGIC||state[2]!==1||state[3]&&epoch<=state[4])throw new RangeError('Fresh matching cache epoch required');source.validate(input);
 const packed=source.pack({...input,previous:null},binding),p=new Uint32Array(packed.buffer);if(p[21]!==state[9]||p[22]!==state[10]||kind===1&&p[10]!==state[8])throw new RangeError('Immutable dimensions required');if(state[3]){p.set(state.subarray(16,33),25);packed[42]=1;}
 const plan=kind===1?Pair.buildPlan():Convex.buildPlan(),compiled=kind===1?programs.pair:programs.convex,numeric=executeLowered(compiled,packed,{testOnly:true}),out={};for(const[k,{offset,length}]of Object.entries(plan.layout))out[k]=length===1?numeric[offset]:Array.from(numeric.slice(offset,offset+length));out.recycled=!!out.recycled;
 if(kind===2&&!out.recycled){const previous=state[3]?{localNormal1:readFloats(state,36,3)}:null,normal=Convex.queryReference({...input,previous},out,binding);new Float32Array(state.buffer).set([...normal.localNormal1,...normal.localNormal2,...normal.worldNormal,normal.lowerBound],36);}
 state.set(new Uint32Array(numeric.buffer,numeric.byteOffset,20),16);state[3]=1;state[4]=state[5]=epoch;return{state,numeric};
}
function readFloats(a,at,n){return Array.from(new Float32Array(a.buffer,a.byteOffset,a.length).slice(at,at+n));}
