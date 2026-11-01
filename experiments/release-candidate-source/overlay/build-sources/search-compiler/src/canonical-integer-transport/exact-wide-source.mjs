/** Closed pure source helper: literal original declaration, low word then high word.
 * No host runtime arithmetic or source storage dependencies. */
export const EXACT_WIDE_SOURCE = 'fn wide(a:u32,b:u32)->vec2<u32>{let a0=a&65535u;let a1=a>>16u;let b0=b&65535u;let b1=b>>16u;let w0=a0*b0;let t=a1*b0+(w0>>16u);let w1=a0*b1+(t&65535u);return vec2<u32>((w1<<16u)+(w0&65535u),a1*b1+(t>>16u)+(w1>>16u));}';
export const EXACT_WIDE_GPU_SOURCE = EXACT_WIDE_SOURCE.replace('fn wide(', 'fn canonicalExactWide(');
