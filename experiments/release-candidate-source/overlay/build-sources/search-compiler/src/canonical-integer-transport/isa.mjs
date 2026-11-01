import {MICROCODE_ISA} from '../resident-candidate/microcode-isa.mjs';

/** Canonical integer transport extension. Legacy opcode numbers and validation
 * remain unchanged. These instructions require genuine GPU storage atomics;
 * interpreting them as ordinary LOAD/STORE is not an admitted transport. */
const canonicalNames=Object.freeze([...MICROCODE_ISA.names,'ATOMIC_LOAD_U32','ATOMIC_OR_U32','WIDE_U32','DIVIDE_WIDE_U32']);
export const CANONICAL_MICROCODE_ISA=Object.freeze({
 kind:'canonical-wgsl-microcode-isa',version:3,instructionWords:8,
 names:canonicalNames,opcodes:Object.freeze(Object.fromEntries(canonicalNames.map((name,id)=>[name,id]))),
 atomicOperands:Object.freeze({ATOMIC_LOAD_U32:Object.freeze({used:[1,2,3],registers:[1,3]}),ATOMIC_OR_U32:Object.freeze({used:[1,2,3,4],registers:[1,3,4]})}),
});
