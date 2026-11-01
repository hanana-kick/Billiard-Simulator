/** Runtime-only authority; deliberately no compiler/parser/physics import. */
import{assertArtifactIntegerCompilation}from'./program-artifact.mjs';
import{validateIntegerProgram}from'./integer-core.mjs';
export function admitIntegerProgram(c){assertArtifactIntegerCompilation(c);return validateIntegerProgram(c);}
