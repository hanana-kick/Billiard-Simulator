/** Source-owned three-dispatch decomposition of SMOOTH_CELLS_WGSL.
 * Integer expressions and final cells layout are unchanged. The extra scratch
 * contains only f(mid), two independent normal derivatives and monotonic bad bits.
 * Original combined kernel remains the independent GPU comparison reference. */
import {SMOOTH_ARITHMETIC_WGSL} from './deterministic-smooth-segment.mjs';
import {linkResidentWGSL} from '../resident-candidate/wgsl-linker.mjs';
const common=SMOOTH_ARITHMETIC_WGSL+`
@group(0) @binding(2) var<storage,read_write> scratch:array<i32>;
@group(0) @binding(3) var<storage,read_write> cells:array<i32>;
@group(0) @binding(4) var<storage,read_write> staged:array<i32>;
`;
const header=`let row=id.x/8u;let lane=id.x%8u;let b=row*64u;let s=row*64u;let at=id.x*16u;let temp=row*128u+(lane/2u)*32u;if(b>=arrayLength(&input)||scratch[s+2u]==0){return;}bad=false;var x:array<i32,6>;var d:array<i32,6>;var c:array<i32,6>;for(var i=0u;i<6u;i++){x[i]=input[b+8u+i];d[i]=scratch[s+8u+i];c[i]=scratch[s+16u+i];}let lo=i32(lane/2u)*8192;let hi=lo+8192;`;
const storeCells=`cells[at]=select(0,1,r.valid);cells[at+1u]=r.u;cells[at+2u]=r.q;cells[at+3u]=select(0,1,bad);for(var i=0u;i<6u;i++){cells[at+4u+2u*i]=r.f[i].x;cells[at+5u+2u*i]=r.f[i].y;}`;
const rhs=common+`
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){${header}
// Preserve the original pre-branch denseBox evaluation, including bad effects.
var box=denseBox(x,d,c,lo,hi);
if((lane&1u)==0u){for(var i=0u;i<6u;i++){box[i]=vec2<i32>(safeAdd(box[i].x,-input[b+16u+i]),safeAdd(box[i].y,input[b+16u+i]));}}
else{let mid=(lo+hi)/2;box=denseBox(x,d,c,mid,mid);}
let r=rhsBox(box,input[b+4u],input[b+5u]);
if((lane&1u)==0u){${storeCells}}else{staged[temp]=select(0,1,r.valid);staged[temp+1u]=r.u;staged[temp+2u]=r.q;staged[temp+3u]=select(0,1,bad);for(var i=0u;i<6u;i++){staged[temp+4u+2u*i]=r.f[i].x;staged[temp+5u+2u*i]=r.f[i].y;}}
}`;
const derivative=common+`
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){${header}
var v0:vec2<i32>;var v1:vec2<i32>;var v2:vec2<i32>;
if((lane&1u)==0u){v0=scalarU(x);v1=scalarU(d);v2=scalarU(c);}else{v0=scalarQ(x);v1=scalarQ(d);v2=scalarQ(c);}
let n=normalDerivative(v0,v1,v2,lo,hi);let outputOffset=temp+16u+(lane&1u)*6u;
staged[outputOffset]=select(0,1,n.valid);staged[outputOffset+1u]=select(0,1,bad);staged[outputOffset+2u]=n.axes[0].x;staged[outputOffset+3u]=n.axes[0].y;staged[outputOffset+4u]=n.axes[1].x;staged[outputOffset+5u]=n.axes[1].y;
}`;
const combine=common+`
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) id:vec3<u32>){${header}if((lane&1u)==0u){return;}
bad=staged[temp+3u]!=0||staged[temp+17u]!=0||staged[temp+23u]!=0;
var r:RHSBox;
if(staged[temp]!=0&&staged[temp+16u]!=0&&staged[temp+22u]!=0){
let mid=(lo+hi)/2;let h=scratch[s+1u];let F=input[b+4u];let K=input[b+5u];
let du0=vec2<i32>(staged[temp+18u],staged[temp+19u]);let du1=vec2<i32>(staged[temp+20u],staged[temp+21u]);
let dq0=vec2<i32>(staged[temp+24u],staged[temp+25u]);let dq1=vec2<i32>(staged[temp+26u],staged[temp+27u]);
let fx=scaleI(du0,F,Q);let fz=scaleI(du1,F,Q);let df=array<vec2<i32>,4>(negI(fx),negI(fz),addI(scaleI(fz,5,2),negI(scaleI(dq0,K,Q))),addI(negI(scaleI(fx,5,2)),negI(scaleI(dq1,K,Q))));
r.valid=true;
for(var i=0u;i<6u;i++){if(i<2u){r.f[i]=positionResidual(x,d,c,i,h,lo,hi);}else{let f=vec2<i32>(staged[temp+4u+2u*i],staged[temp+5u+2u*i]);let rmid=addI(addI(vec2<i32>(d[i]),scaleI(vec2<i32>(mid),2*c[i],32768)),negI(scaleI(f,h,1048576)));let dr=addI(vec2<i32>(2*c[i]),negI(scaleI(df[i-2u],h,1048576)));let radius=ratio(magnitude(dr),(hi-lo)/2,32768,true);r.f[i]=addI(rmid,vec2<i32>(-radius,radius));}}
}${storeCells}
}`;

export const SMOOTH_STAGED_TEMP_WORDS_PER_ROW=128;
export const SMOOTH_STAGED_WGSL=Object.freeze([rhs,derivative,combine].map(code=>linkResidentWGSL([code]).code));
