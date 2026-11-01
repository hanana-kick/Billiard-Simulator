/** Literal original pure source; only function identifier renamed for GPU namespace. */
export const EXACT_DIVIDE_SOURCE='fn divideWide(lo:u32,hi:u32,d:u32)->vec3<u32>{\n if(d==0u||hi>=d){return vec3<u32>(0u);}var rem=hi;var quotient=0u;\n for(var bit=31i;bit>=0;bit--){let carry=rem>>31u;rem=(rem<<1u)|((lo>>u32(bit))&1u);if(carry!=0u||rem>=d){rem-=d;quotient|=1u<<u32(bit);}}\n return vec3<u32>(quotient,rem,1u);\n}';
export const EXACT_DIVIDE_GPU_SOURCE=EXACT_DIVIDE_SOURCE.replace('fn divideWide(', 'fn canonicalExactDivideWide(');
