/* SPDX-License-Identifier: Apache-2.0
 * Resident binding of the existing Parry 0.31.1 native-topology projection.
 * Original equations, GJK iteration cap and EPA continuation are unchanged.
 * Source: experimental-convex-point.js / experimental-cue-epa-core.js;
 * upstream provenance and notices remain in those modules and vendor licenses.
 */
import * as importedPoint from '../experimental-convex-point.js';
const Point=importedPoint.default??globalThis.LabConvexPointExperimental;
export const CONVEX_POINT_LAYOUT=Object.freeze({scratchWords:Point.STATE_FLOATS,outputWords:Point.OUTPUT_FLOATS,hullWords:Point.HULL_FLOATS,gjkIterations:Point.GJK_DISPATCHES});
export function packSharedConvexHull(hull){const a=Point.packQuery({hull,point:[0,0,0]}).hulls;return new Uint32Array(a.buffer,a.byteOffset,a.length).slice();}
function functions(source){const result=new Map(),re=/\bfn\s+(\w+)\s*\(/g;let m;while((m=re.exec(source))){const open=source.indexOf('{',re.lastIndex);let depth=1,end=open+1;for(;depth&&end<source.length;end++){if(source[end]==='{')depth++;if(source[end]==='}')depth--;}if(depth)throw Error('Original query function is unbalanced');result.set(m[1],source.slice(m.index,end));re.lastIndex=end;}return result;}
export function generateConvexPointWGSL(stage='finish',{queryTransport='staged',queryChunk=8}={}){
 if(!['init','gjk','gjk-loop','epa','finish'].includes(stage))throw new RangeError('Exact source projection stage required');
 if(!['staged','chunked'].includes(queryTransport)||![2,4,8].includes(queryChunk)||stage==='gjk-loop'&&queryTransport==='chunked')throw new RangeError('Explicit source point query transport required');
 const chunked=queryTransport==='chunked';
 const original=new Map();for(const[name,body]of functions(Point.generateWGSL(stage==='gjk-loop'?'gjk':stage)))if(name!=='main'){if(original.has(name)&&original.get(name)!==body)throw Error('Original query phase definitions disagree: '+name);original.set(name,body);}
 // Replace address adapters only. All arithmetic/geometry function text below
 // comes verbatim from the production source generator, then alpha-renamed.
 original.set('sget','fn sget(i:i32)->f32{return bitcast<f32>(rc_scratch[rc_point_scratch+u32(i)]);}');
 original.set('sset','fn sset(i:i32,x:f32){rc_scratch[rc_point_scratch+u32(i)]=bitcast<u32>(x);}');
 original.set('iget',`fn iget(i:i32)->f32{switch i{case 6,16:{return 1.0;}case 10:{return rc_point_position.x;}case 11:{return rc_point_position.y;}case 12:{return rc_point_position.z;}case 20:{return 2.0;}case 22:{return bitcast<f32>(0x7f7fffffu);}case 23:{return f32(rc_point_solid);}default:{return 0.0;}}}`);
 original.set('oset','fn oset(i:i32,x:f32){rc_state[rc_point_output+u32(i)]=bitcast<u32>(x);}');
 original.set('hget','fn hget(i:i32)->f32{return bitcast<f32>(rc_geometry[rc_point_hull+u32(i)]);}');
 const names=new Set([...original.keys(),'V','Cso','Projection']);
 const rename=source=>source.replace(/\b[A-Za-z_]\w*\b/g,name=>names.has(name)?'rc_point_'+name:name);
 const declarations=`alias V=vec3<f32>;struct Cso{orig1:V,orig2:V,point:V};struct Projection{point:V,kind:i32,index:i32,weights:V};`;
 return `
var<private> rc_point_scratch:u32;var<private> rc_point_output:u32;var<private> rc_point_hull:u32;var<private> rc_point_position:vec3<f32>;var<private> rc_point_solid:u32;
${rename(declarations)}\n${[...original.values()].map(rename).join('\n')}
fn rc_project_convex_stage(scratch:u32,output:u32,hull:u32,position:vec3<f32>,solid:u32)->u32{
 rc_point_scratch=scratch;rc_point_output=output;rc_point_hull=hull;rc_point_position=position;rc_point_solid=solid;
 ${stage==='init'?`for(var i=0u;i<${Point.STATE_FLOATS}u;i++){rc_scratch[scratch+i]=0u;}for(var i=0u;i<${Point.OUTPUT_FLOATS}u;i++){rc_state[output+i]=0u;}rc_point_init();${chunked?'rc_state[output+14u]=0u;rc_state[output+15u]=256u;':''}return 0u;`:stage==='gjk'?(chunked?`if(rc_state[output+15u]!=256u||rc_state[output+14u]>256u||rc_state[output+14u]%${queryChunk}u!=0u){return 3u;}if(rc_state[output+14u]==256u){return 0u;}${Array.from({length:queryChunk},()=>`rc_point_gjk_step();rc_state[output+14u]++;`).join('')}return 0u;`:`rc_point_gjk_step();return 0u;`):stage==='gjk-loop'?`let steps=rc_state[output+15u];if(steps==0u||steps>${Point.GJK_DISPATCHES}u){return 3u;}for(var i=0u;i<steps;i++){if(rc_scratch[scratch]!=0u){break;}rc_point_gjk_step();}if(steps!=${Point.GJK_DISPATCHES}u){return 3u;}rc_state[output+15u]=0u;return 0u;`:stage==='epa'?`${chunked?'if(rc_state[output+14u]!=256u||rc_state[output+15u]!=256u){return 3u;}rc_state[output+14u]=0u;rc_state[output+15u]=0u;':''}rc_point_point_epa();return 0u;`:`${chunked?'if(rc_state[output+14u]!=0u||rc_state[output+15u]!=0u){return 3u;}':''}rc_point_finish();
 for(var i=0u;i<${Point.STATE_FLOATS}u;i++){if((rc_scratch[scratch+i]&0x7f800000u)==0x7f800000u){return 2u;}}
 for(var i=0u;i<${Point.OUTPUT_FLOATS}u;i++){if((rc_state[output+i]&0x7f800000u)==0x7f800000u){return 2u;}}
 if(rc_state[output]!=0x3f800000u){return 1u;}return 0u;`}

}
`;
}
