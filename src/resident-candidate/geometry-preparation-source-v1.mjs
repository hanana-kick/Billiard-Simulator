/* SPDX-License-Identifier: Apache-2.0
 * Generated verbatim function closure from authenticated source SHA256
 * 5a18bbbbd646454f2e00f7b1422773b2851b64d5ff165626f2a9f835ff86c0e7.
 * Original generators: geometry-numeric-owner/numeric-request/narrowphase/
 * world-geometry/world-cue-geometry/cue-empty-caches. Count2 fixed-layout pilot.
 * No handwritten physics; regenerate and reapprove for any layout change. */
export const GEOMETRY_PREPARATION_SOURCE_V1 = String.raw`fn rc_geometry_numeric_prepare(bank:u32,scratch:u32,request:u32,originalPC:u32,originalPipeline:u32,kind:u32)->u32{
 if(!rc_gn_address(bank,scratch,request)||kind<1u||kind>6u){return rc_gn_fail(bank,request);}
 if(rc_state[request]==0x5243474eu&&(rc_state[request+3u]==1u||rc_state[request+3u]==2u)){
  if(!rc_gn_identity(bank,scratch,request,originalPC,originalPipeline)||rc_state[request+2u]!=kind){return rc_gn_fail(bank,request);}return rc_state[request+19u];
 }
 if(rc_state[request]==0x5243474eu&&rc_state[request+3u]==4u){return rc_gn_fail(bank,request);}
 for(var i=0u;i<24u;i++){rc_state[request+i]=0u;}
 rc_state[request]=0x5243474eu;rc_state[request+1u]=1u;rc_state[request+2u]=kind;rc_state[request+3u]=3u;rc_state[request+4u]=originalPC;rc_state[request+5u]=originalPipeline;rc_state[request+6u]=rc_state[bank+5u];rc_state[request+7u]=rc_state[bank+62722u];rc_state[request+10u]=scratch;rc_state[request+23u]=2u;
 var result=0u;
 if(kind<=4u){
  let geometryKind=select(select(2u,1u,kind==2u),0u,kind==1u);if(kind==4u){if(!rc_world_geometry_point_ready(bank)){return 0u;}}else{if(!rc_world_geometry_ready(bank,geometryKind)){return 0u;}}
  let base=rc_state[bank+26u];if(base<bank+37504u||base>=bank+46496u){return rc_gn_fail(bank,request);}
  let present=rc_state[bank+27u];let visited=rc_state[bank+28u];rc_state[request+8u]=base;rc_state[request+12u]=present;rc_state[request+13u]=visited;
  switch kind{
   case 1u:{result=rc_gn_prepare_rc_narrow_floor(base,scratch,0u,present,visited,request);}
   case 2u:{result=rc_gn_prepare_rc_narrow_pair(base,scratch,0u,present,visited,request);}
   case 3u:{result=rc_gn_prepare_rc_narrow_convex_prepare(base,scratch,0u,present,visited,request);}
   default:{let projection=bank+55936u;rc_state[request+14u]=projection;result=rc_gn_prepare_rc_narrow_convex_finish(base,scratch,0u,projection,request);}
  }
 }else{
  let g=bank+57856u;rc_state[request+8u]=g;
  if(kind==5u){rc_state[request+20u]=g+3188u;rc_gn_prepare_rc_world_cue_geometry_pose(g,840950u,scratch,request);}
  else{
   if(rc_state[g]!=0u||rc_state[g+11u]!=1u){return 0u;}let cache=rc_wcg_cache(g);let program=840950u+rc_program[840950u+select(2u,3u,rc_state[g+7u]==2u)];
   rc_state[request+12u]=cache;rc_state[request+13u]=g+3202u;rc_state[request+14u]=g+3258u;rc_state[request+15u]=g+3360u;rc_state[request+20u]=g+3258u;
   if(!rc_gn_prepare_rc_empty_cache_numeric(cache,g+3202u,g+3258u,program,scratch,request)){rc_wcg_fail(g,4u);}
  }
 }
 if(rc_state[request+3u]==3u){return rc_gn_source_result(bank,request,result);}return result;
}
fn rc_gn_source_result(bank:u32,request:u32,result:u32)->u32{
 let kind=rc_state[request+2u];rc_state[request+19u]=result;
 if(kind==3u){if(result==2u){rc_world_geometry_fail(bank,2u);}else{rc_state[bank+29u]=result;}}
 else if(kind<=4u&&result!=0u){rc_world_geometry_fail(bank,2u);}
 return result;
}
fn rc_world_geometry_fail(bank:u32,reason:u32){if(rc_state[bank+24u]==0u){rc_state[bank+24u]=reason;}}
fn rc_wcg_fail(g:u32,reason:u32){if(rc_state[g]==0u){rc_state[g]=reason;}}
fn rc_gn_prepare_rc_empty_cache_numeric(c:u32,input:u32,output:u32,program:u32,scratch:u32,request:u32)->bool{
 if(rc_state[c+2u]!=2u){return false;}let n=select(48u,56u,rc_state[c+1u]==2u);let outn=select(20u,34u,rc_state[c+1u]==2u);
 if(rc_program[program+3u]!=n||rc_program[program+4u]!=outn){return rc_empty_fail(c);}
 for(var i=0u;i<n;i++){rc_scratch[scratch+i]=rc_state[input+i];}
 rc_gn_mark(request,program,scratch);return true;}
fn rc_gn_mark(request:u32,program:u32,scratch:u32){
 rc_state[request+9u]=program;rc_state[request+10u]=scratch;rc_state[request+11u]=rc_program[program+3u];rc_state[request+21u]=rc_program[program+4u];rc_state[request+22u]=program+rc_program[program+8u];rc_state[request+3u]=1u;
}
fn rc_empty_fail(c:u32)->bool{rc_state[c+2u]=4u;return false;}
fn rc_wcg_cache(g:u32)->u32{return g+32u+rc_state[g+2u]*56u;}
fn rc_gn_prepare_rc_world_cue_geometry_pose(g:u32,bundle:u32,scratch:u32,request:u32){
 if(rc_state[g]!=0u||rc_state[g+9u]!=1u){return;}let program=bundle+rc_program[bundle+1u];let geometryRoot=rc_geometry[rc_wcg_descriptor(g)+7u];for(var i=0u;i<132u;i++){rc_scratch[scratch+i]=rc_geometry[geometryRoot+i];}
 // Exact original guard orientation: cue FIRST, obstacle SECOND. Only current
 // body poses change; initial positions in immutable packing are never used.
 for(var i=0u;i<7u;i++){rc_scratch[scratch+i]=rc_state[g+3178u+i];rc_scratch[scratch+16u+i]=rc_state[g+3168u+i];}
 rc_gn_mark(request,program,scratch);return;}
fn rc_wcg_descriptor(g:u32)->u32{let geometryRoot=rc_state[g+8u];return rc_geometry[geometryRoot+5u]+rc_state[g+2u]*8u;}
fn rc_gn_prepare_rc_narrow_convex_finish(base:u32,scratch:u32,programOffset:u32,projection:u32,request:u32)->u32{
 if(rc_state[base+387u]!=0u||rc_state[base+392u]!=1u||rc_state[projection]!=0x3f800000u){rc_state[base+387u]=3u;return 3u;}
 for(var i=0u;i<3u;i++){rc_state[base+64u+i]=rc_state[projection+2u+i];}rc_state[base+67u]=rc_state[projection+1u];
 rc_narrow_copy_input(base,scratch,368u);rc_gn_mark(request,programOffset+4877u,scratch);return 0u;}
fn rc_narrow_copy_input(base:u32,scratch:u32,n:u32){for(var i=0u;i<n;i++){rc_scratch[scratch+i]=rc_state[base+i];}}
fn rc_gn_prepare_rc_narrow_convex_prepare(base:u32,scratch:u32,programOffset:u32,present:u32,visited:u32,request:u32)->u32{
 rc_state[base+387u]=0u;rc_state[base+388u]=0u;rc_state[base+392u]=0u;let oldPair=rc_state[base+390u];rc_state[base+391u]=u32((rc_state[base+317u]&0x7fffffffu)!=0u);rc_state[base+389u]=u32((rc_state[base+318u]&0x7fffffffu)!=0u);rc_state[base+390u]=present;
 if(present!=0u&&oldPair==0u){rc_narrow_zero(base,272u,20u);rc_narrow_zero(base,294u,13u);rc_state[base+316u]=0u;rc_state[base+317u]=0u;rc_state[base+318u]=0u;rc_narrow_zero(base,384u,3u);rc_narrow_convex_clear(base);}
 if(present==0u){rc_narrow_zero(base,316u,3u);rc_narrow_convex_clear(base);return 0u;}
 if(visited==0u){return 0u;}
 rc_narrow_copy_input(base,scratch,368u);rc_gn_mark(request,programOffset+4478u,scratch);return 0u;}
fn rc_narrow_convex_clear(base:u32){rc_narrow_zero(base,281u,11u);rc_narrow_zero(base,372u,4u);rc_state[base+386u]=0u;}
fn rc_narrow_zero(base:u32,at:u32,n:u32){for(var i=0u;i<n;i++){rc_state[base+at+i]=0u;}}
fn rc_gn_prepare_rc_narrow_pair(base:u32,scratch:u32,programOffset:u32,present:u32,visited:u32,request:u32)->u32{
 rc_state[base+323u]=0u;rc_state[base+324u]=0u;let oldPair=(rc_state[base+203u]&0x7fffffffu)!=0u;let oldPoint=(rc_state[base+201u]&0x7fffffffu)!=0u;rc_state[base+325u]=u32((rc_state[base+202u]&0x7fffffffu)!=0u);
 if(present!=0u&&!oldPair){rc_narrow_zero(base,148u,56u);for(var q=189u;q<=197u;q+=4u){rc_state[base+q]=0x3f800000u;}rc_narrow_zero(base,216u,3u);rc_narrow_zero(base,320u,3u);}
 rc_state[base+203u]=select(0u,0x3f800000u,present!=0u);
 if(present==0u){rc_narrow_zero(base,200u,3u);rc_narrow_pair_clear(base);return 0u;}
 if(visited==0u){return 0u;}
 rc_narrow_copy_input(base,scratch,320u);rc_state[request+16u]=u32(oldPair);rc_state[request+17u]=u32(oldPoint);rc_gn_mark(request,programOffset+1832u,scratch);return 0u;}
fn rc_narrow_pair_clear(base:u32){rc_narrow_zero(base,157u,13u);rc_narrow_zero(base,217u,2u);rc_state[base+216u]=0u;rc_state[base+322u]=0u;}
fn rc_gn_prepare_rc_narrow_floor(base:u32,scratch:u32,programOffset:u32,present:u32,visited:u32,request:u32)->u32{
 rc_state[base+137u]=0u;rc_state[base+138u]=0u;let oldPair=rc_state[base+128u];let oldPoint=rc_state[base+130u];rc_state[base+139u]=rc_state[base+131u];rc_state[base+128u]=present;
 if(present==0u){rc_narrow_floor_clear_manifold(base);return 0u;}
 if(oldPair==0u){rc_narrow_floor_clear_manifold(base);}
 if(visited==0u){return 0u;}
 rc_state[base+117u]=select(0u,0x3f800000u,rc_state[base+132u]!=0u);
 rc_narrow_copy_input(base,scratch,128u);rc_state[request+16u]=oldPair;rc_state[request+17u]=oldPoint;rc_gn_mark(request,programOffset+0u,scratch);return 0u;}
fn rc_narrow_floor_clear_manifold(base:u32){rc_state[base+129u]=0u;rc_state[base+130u]=0u;rc_state[base+131u]=0u;rc_state[base+132u]=0u;rc_state[base+117u]=0u;rc_narrow_floor_clear_point(base);rc_narrow_zero(base,55u,3u);rc_narrow_zero(base,84u,3u);rc_narrow_zero(base,133u,3u);}
fn rc_narrow_floor_clear_point(base:u32){rc_narrow_zero(base,70u,7u);rc_state[base+114u]=0u;rc_narrow_zero(base,115u,2u);rc_state[base+136u]=0u;}
fn rc_gn_fail(bank:u32,request:u32)->u32{if(rc_gn_span(request)&&bank%62976u==0u&&bank/62976u<2u&&request==127128u+(bank/62976u)*24u){rc_state[request+3u]=4u;rc_state[request+19u]=0xffffffffu;}if(bank+3u<arrayLength(&rc_state)&&rc_state[bank+2u]==1u){rc_state[bank+2u]=4u;rc_state[bank+3u]=6u;}return 0xffffffffu;}
fn rc_gn_span(request:u32)->bool{return request<=arrayLength(&rc_state)&&arrayLength(&rc_state)-request>=24u;}
fn rc_world_geometry_ready(bank:u32,kind:u32)->bool{return rc_state[bank+24u]==0u&&rc_state[bank+25u]<26u&&rc_state[bank+31u]==1u&&rc_geometry[rc_world_geometry_row(bank)]==kind;}
fn rc_world_geometry_row(bank:u32)->u32{return 0u+rc_state[bank+25u]*16u;}
fn rc_world_geometry_point_ready(bank:u32)->bool{return rc_world_geometry_ready(bank,2u)&&rc_state[bank+29u]==1u;}
fn rc_gn_identity(bank:u32,scratch:u32,request:u32,originalPC:u32,originalPipeline:u32)->bool{
 return rc_gn_address(bank,scratch,request)&&rc_state[request]==0x5243474eu&&rc_state[request+1u]==1u&&rc_state[request+4u]==originalPC&&rc_state[request+5u]==originalPipeline&&rc_state[request+6u]==rc_state[bank+5u]&&rc_state[request+7u]==rc_state[bank+62722u]&&rc_state[request+10u]==scratch&&rc_state[request+23u]==2u;
}
fn rc_gn_address(bank:u32,scratch:u32,request:u32)->bool{
 if(bank%62976u!=0u||bank>arrayLength(&rc_state)||arrayLength(&rc_state)-bank<62976u||!rc_gn_span(request)||scratch!=(bank/62976u)*13632u||scratch>arrayLength(&rc_scratch)||arrayLength(&rc_scratch)-scratch<13632u){return false;}
 if(request<bank+62976u&&bank<request+24u){return false;}
 if(bank/62976u>=2u||request!=127128u+(bank/62976u)*24u){return false;}
 return true;
}`;
