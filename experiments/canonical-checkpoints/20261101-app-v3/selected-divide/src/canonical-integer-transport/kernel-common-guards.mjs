/** Compiler-owned development wrapper. Not imported by runtime artifacts. */
import{assertCanonicalIntegerCompilation}from'../resident-candidate/microcode-compiler.mjs';
import{validateIntegerProgram}from'./integer-core.mjs';
export{INTEGER_OPERATIONS,integerKernelWGSL,initialIntegerState}from'./integer-core.mjs';
export function admitIntegerProgram(c){assertCanonicalIntegerCompilation(c);return validateIntegerProgram(c);}
