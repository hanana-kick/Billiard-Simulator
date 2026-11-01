/* SPDX-License-Identifier: Apache-2.0
 * Opt-in integer-backed implementation of the unchanged source f32 graph ABI.
 * No hardware f32 arithmetic or comparison participates in this implementation.
 * This is an implementation selection, NOT qualification of any device, the
 * non-VM geometry kernels, or a complete physical shot.
 */
import {generateNumericLibraryWGSL} from './numeric-program.mjs';

export const INTEGER_F32_CAPABILITY=Object.freeze({
 implementation:'source-f32-integer-v1',rounding:'nearest-ties-even',
 hardwareFloatArithmetic:false,sourceOrdered:true,nativeQualified:false,
 nonVmGeometryQualified:false,
});

function balancedEnd(code,start){
 if(code[start]!=='{')throw new Error('Expected original numeric source block');
 let depth=0;for(let i=start;i<code.length;i++){
  if(code[i]==='{')depth++;else if(code[i]==='}'&&!--depth)return i+1;
 }throw new Error('Unclosed original numeric source block');
}

/** Reuse the original compiler/header/liveness/error transport verbatim; change
 * only the opcode implementation. Every arithmetic result is an integer word
 * from software binary64 followed by exact RN-even f32 conversion. In
 * particular, never first evaluate a hardware operation and repair its output.
 *
 * Bounded operand argument (not a generic f64->f32 double-rounding claim):
 * Every source graph operand is a finite binary32. Products have <=48 bits.
 * Source add/sub are JS binary64 operations followed by Math.fround, which this
 * path implements directly, including cancellation and signed zero. For div,
 * normalized significands give a/b or 2a/b with b<2^24. A binary32 midpoint has
 * denominator <=2^24, so a nonzero midpoint separation is >2^-49, larger than
 * binary64 rounding error <=2^-53. Exact midpoint quotients are exactly dyadic.
 * Subnormal target precision can only enlarge this separation. For sqrt,
 * scale x to [1,4): a nonzero x-m^2 for a binary32 midpoint is >=2^-48; hence
 * |sqrt(x)-m|>2^-50. An exact midpoint square needs >=49 significant bits,
 * impossible for x with <=24 bits. sqrt(nonzero binary32) is normal binary32.
 * Finite binary32 operand products/quotients cannot overflow/underflow f64.
 * Thus the correctly rounded integer binary64 div/sqrt and exact conversion
 * implement the required f32 results for this bounded input domain. Independent
 * rational/square-root tests and native tests remain mandatory implementation
 * checks; this reasoning does not qualify unrelated numerical kernels.
 */
export function generateIntegerF32WGSL({includeSourceNumberLibrary=true}={}){
 let code=generateNumericLibraryWGSL({preserveSubnormals:true,includeSourceNumberLibrary});
 const declaration='    let a=bitcast<f32>(aw); let b=bitcast<f32>(bw);\n    var result=0.0; var word=0u; var wordResult=false;';
 if(!code.includes(declaration))throw new Error('Original numeric operand transport changed');
 code=code.replace(declaration,'    var word=0u;');
 const evalStart=code.indexOf('fn rc_num_eval('),start=code.indexOf('    switch opcode {',evalStart);
 const oldSwitchEnd=balancedEnd(code,code.indexOf('{',start));
 const repairStart=code.indexOf('    if (!wordResult) {',oldSwitchEnd);
 if(start<0||repairStart<0)throw new Error('Original numeric opcode seam changed');
 const repairEnd=balancedEnd(code,code.indexOf('{',repairStart));
 const opcodes=`    switch opcode {
      case 0u: { word=aa; }
      case 1u,2u,3u: { word=rc_num_soft_arithmetic(opcode,aw,bw); }
      case 4u: { if (rc_num_zero(bw)) { return rc_num_fail(scratchBase,registers,4u); } word=rc_num_soft_arithmetic(opcode,aw,bw); }
      case 5u: { word=select(bw,aw,rc_num_lt_bits(aw,bw)); if (rc_num_eq_bits(aw,bw)) { word=aw|bw; } }
      case 6u: { word=select(bw,aw,rc_num_lt_bits(bw,aw)); if (rc_num_eq_bits(aw,bw)) { word=aw&bw; } }
      case 7u: { if ((aw&0x80000000u)!=0u && !rc_num_zero(aw)) { return rc_num_fail(scratchBase,registers,4u); } word=rc_num_soft_arithmetic(opcode,aw,bw); }
      case 8u: { let epsilon=507307272u; if (!(rc_num_lt_bits(epsilon|0x80000000u,aw) && rc_num_lt_bits(aw,epsilon))) { word=rc_num_soft_arithmetic(opcode,aw,bw); } }
      case 9u: { word=0x3f800000u; if (rc_num_lt_bits(bw,aw)) { word=rc_num_soft_arithmetic(opcode,aw,bw); } }
      case 10u: { word=select(cw,bw,!rc_num_zero(aw)); }
      case 11u: { word=select(0u,0x3f800000u,rc_num_lt_bits(aw,bw)); }
      case 12u: { word=select(0u,0x3f800000u,rc_num_lt_bits(aw,bw)||rc_num_eq_bits(aw,bw)); }
      case 13u: { word=select(0u,0x3f800000u,rc_num_lt_bits(bw,aw)); }
      case 14u: { word=0x3f800000u|(aw&0x80000000u); }
      case 15u: { word=aw^0x80000000u; }
      default: { return rc_num_fail(scratchBase,registers,2u); }
    }`;
 code=code.slice(0,start)+opcodes+code.slice(repairEnd);
 // Fail at construction if a future baseline change silently adds a floating
 // operation/type, rather than admitting a mixed implementation as integer.
 const executable=code.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 if(/\bf32\b|\bf16\b|\d+\.\d+/.test(executable))throw new Error('Integer f32 profile contains a hardware floating expression');
 return code;
}
