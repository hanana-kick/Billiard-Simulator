/* SPDX-License-Identifier: Apache-2.0
 * Experimental source-WGSL scalar microcode ABI. This is execution transport,
 * not a second physics implementation or a numerical qualification.
 * Scalar values are exact u32 words; i32/f32 operations interpret those bits.
 */
const names = [
  'HALT','SET','MOV','LOAD','STORE','LENGTH','LOCAL_LOAD','LOCAL_STORE',
  'JUMP','BRANCH','CALL','RET','SELECT',
  'UADD','USUB','UMUL','UDIV','UREM','IADD','ISUB','IMUL','IDIV','IREM',
  'FADD','FSUB','FMUL','FDIV','AND','OR','XOR','SHL','USHR','ISHR',
  'EQ','NE','ULT','ULE','UGT','UGE','ILT','ILE','IGT','IGE',
  'FEQ','FNE','FLT','FLE','FGT','FGE','NOT','LNOT','INEG','FNEG',
  'UCLZ','UCTZ','POPCOUNT','FABS','FSQRT','FMIN','FMAX','FLOOR','CEIL',
  'TRUNC','ROUND','UTOF','ITOF','FTOU','FTOI','GUARD',
  'F64_ADD','F64_SUB','F64_MUL','F64_DIV','F64_SQRT','F64_FROM_U32',
  'F64_FROM_F32','F64_TO_F32','F64_EQ','F64_LT','F64_LE','F64_FINITE',
  'NUM_EVAL','NUM_SOFT_ARITH','NUM_WIDEN',
  'NUM_CONT_INSTRUCTION','SOURCE_PROGRAM_INSTRUCTION','EXTERNAL_CALL','GEOMETRY_NUMERIC_PREPARE'
];
export const MICROCODE_ISA = Object.freeze({
  kind: 'resident-wgsl-microcode-isa', version: 1, instructionWords: 8,
  opcodes: Object.freeze(Object.fromEntries(names.map((name, id) => [name, id]))),
  names: Object.freeze(names),
  bindings: Object.freeze({rc_state:0, rc_program:1, rc_geometry:2, rc_scratch:3, rc_inputs:4}),
  writableBindings: Object.freeze([0, 3]),
  optionalBindings: Object.freeze({eventAudit:Object.freeze({sourceName:'rc_event_audit',sourceId:5,gpuBinding:7,writable:true})}),
  gpuBindings: Object.freeze({sourceState:0, sourceProgram:1, sourceGeometry:2, sourceScratch:3, sourceInputs:4, microcode:5, vmState:6}),
  control: Object.freeze({words:16, magic:0x52434d56, version:1, magicWord:0, versionWord:1, status:2, error:3, pc:4, sp:5, stepsLow:6, stepsHigh:7, yields:8, lastOpcode:9, entryPc:10, pendingMacro:11, reservedStart:12}),
  status: Object.freeze({uninitialized:0, ready:1, complete:2, invalid:3, unsupported:4, waiting:5}),
  error: Object.freeze({none:0, malformedControl:1, instructionRange:2, unknownOpcode:3, localRange:4, storageRange:5, readonlyStorage:6, callCapacity:7, sourceDomain:8, unsupportedPrimitive:9, invalidBranch:10, counterOverflow:11, externalProtocol:12}),
  capability: Object.freeze({optIn:true, defaultBackend:false, nativeQualified:false, fullRestQualified:false, hardwarePerformance:false})
});

// Lightweight ABI metadata for lean submission. This describes names, not
// numerical admission: body/closure validation stays in the host compiler.
const intrinsicRootOverrides=Object.freeze({F64_FROM_F32:'rc_f64_from_f32_bits',F64_TO_F32:'rc_f64_to_f32_bits',NUM_SOFT_ARITH:'rc_num_soft_arithmetic'});
export const MICROCODE_INTRINSIC_ROOTS=Object.freeze(Object.fromEntries([...names.slice(names.indexOf('F64_ADD'),names.indexOf('EXTERNAL_CALL')),'GEOMETRY_NUMERIC_PREPARE'].map(name=>[names.indexOf(name),intrinsicRootOverrides[name]??'rc_'+name.toLowerCase()])));
export function microcodeUsedIntrinsicFunctions(code){
 if(!(code instanceof Uint32Array)||code.length%MICROCODE_ISA.instructionWords)throw new TypeError('Whole immutable microcode instructions required');
 const result=new Set();for(let i=0;i<code.length;i+=MICROCODE_ISA.instructionWords){if(code[i]>=names.length)throw new RangeError('Unknown immutable microcode opcode');const name=MICROCODE_INTRINSIC_ROOTS[code[i]];if(name)result.add(name);}
 return Object.freeze([...result]);
}

/** [op,dst,a,b,c,d,e,f]. Unused words are zero. dst and referenced values are
 * absolute scalar local slots. Exception operands:
 * SET a=immediate word; LOAD a=literal binding,b=address slot;
 * STORE a=literal binding,b=address slot,c=value slot; LENGTH a=binding;
 * LOCAL_LOAD a=index slot; LOCAL_STORE a=index slot,b=value slot;
 * JUMP a=absolute instruction PC; BRANCH a=condition slot,b=truePC,c=falsePC;
 * CALL a=entry PC (push next PC); RET pops, or completes at depth zero.
 * Static nonrecursive function slots keep caller locals live across CALL.
 * Arguments/returns are explicit MOV instructions, never implicit host state.
 * SELECT chooses b when c!=0, a otherwise. HALT explicitly completes.
 * GUARD a=condition slot: false yields UNSUPPORTED/sourceDomain before the
 * guarded source memory operation. Object bounds must be checked BEFORE
 * address arithmetic, not merely against the full candidate-local slab.
 * F64 and NUM opcodes are opt-in exact-source intrinsics: dst/a/b/c are local base
 * slots with widths from microcode-source-intrinsics.mjs. No name-only
 * replacement is admitted; source signature/body/dependencies must match.
 * EXTERNAL_CALL a=immediate source macro ID, all other fields zero. Normal
 * CALL has entered its hash-approved callee stub. Pending protocol holds PC
 * on this opcode and stack intact; a separate device handler writes the
 * return slot and advances to the ordinary RET, never host physics/state.
 * Per-dispatch exhaustion retains READY/PC/locals/stack; it is not a MISS.
 */
export function microcodeInstruction(name, dst=0, a=0, b=0, c=0, d=0, e=0, f=0) {
  const op = MICROCODE_ISA.opcodes[name];
  if (op === undefined) throw new RangeError('Unknown scalar microcode opcode '+name);
  const words=[op,dst,a,b,c,d,e,f];
  if (!words.every(x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff)) throw new RangeError('Microcode words must be explicit u32 values');
  return Uint32Array.from(words);
}
