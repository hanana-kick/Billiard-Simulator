/** Source-owned ordered query search/sample split. Integer operations unchanged. */
import{MIXED_V2_HULL_QUERY_WGSL as original}from'./deterministic-mixed-cushion-v2-gpu.mjs';
import{linkResidentWGSL}from'../resident-candidate/wgsl-linker.mjs';
const marker='@compute @workgroup_size(1) fn main(',start=original.indexOf(marker),tail=original.indexOf('let sampled=hs(body,hi);',start);if(start<0||tail<0||original.indexOf('let sampled=hs(body,hi);',tail+1)>=0)throw Error('Exact hull-query source boundary required');
const helper=`
@group(0) @binding(4) var<storage,read> queryView:array<u32>;
// Returning the full local arena length intentionally reaches the existing
// guarded lowering's fault sink. It must not wrap into a neighboring rail.
fn queryOutputAddress(index:u32)->u32{
 let full=arrayLength(&output);let local=(arrayLength(&rows)/80u)*64u;
 if(arrayLength(&queryView)!=4u||arrayLength(&rows)%80u!=0u||local<192u||local>256u){return full;}
 let base=queryView[1];
 if(queryView[0]!=0x48515631u||queryView[2]!=local||queryView[3]!=full||full!=4u*local||base%local!=0u||base>full-local||index>=local){return full;}
 return base+index;
}
`;
const prefix=original.slice(0,start)+helper;
const search=prefix+original.slice(start,tail)+'}\n';
const sample=prefix+`@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){let body=gid.x;let n=arrayLength(&rows)/80u;if(body>=n){return;}let b=body*80u;let z=body*64u;let hi=output[z+5u];`+original.slice(tail);
const access=`
fn queryOutputStore(index:u32,value:u32){let address=queryOutputAddress(index);output[address]=value;}
fn queryOutputLoad(index:u32)->u32{let address=queryOutputAddress(index);return output[address];}
`;
const map=code=>{const mapped=code.replace(/output\[([^\]]+)\]=([^;]+);/g,'queryOutputStore($1,$2);').replace(/output\[([^\]]+)\]/g,'queryOutputLoad($1)');return linkResidentWGSL([mapped.replace('@compute',access+'\n@compute')]).code;};

export const QUERY_STAGED_WGSL=Object.freeze([map(search),map(sample)]);
