// Lean TEST transport profile contract. No source compiler, CPU physics, or
// expected states are imported by GPU submission through this module.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MICROCODE_ISA as I} from '../src/resident-candidate/microcode-isa.mjs';
export const THREE_MACRO_PROFILE='source-three-macros-v1';
export const COUPLED_MACRO_PROFILE='source-coupled-macro-v1';
export const SOURCE_MACRO_NAMES=Object.freeze(['rc_cue_flat_advance','rc_num_eval','rc_world_broad_commit_collision','rc_coupled_transport_advance']);
export function selectedSourceMacroNames(profile=THREE_MACRO_PROFILE){
 assert.ok(profile===THREE_MACRO_PROFILE||profile===COUPLED_MACRO_PROFILE,'known explicit source macro profile');
 return SOURCE_MACRO_NAMES.slice(0,profile===COUPLED_MACRO_PROFILE?4:3);
}
/** Serialized legacy artifacts have NO marker. A present marker cannot be
 * undefined, null, unknown, or a relabeled legacy profile. */
export function serializedMacroProfile(object){
 if(!Object.hasOwn(object,'macroProfile'))return THREE_MACRO_PROFILE;
 assert.equal(object.macroProfile,COUPLED_MACRO_PROFILE,'only explicit coupled macro profile marker');
 return object.macroProfile;
}
export function assertMatchingMacroProfiles(...objects){
 const profiles=objects.map(serializedMacroProfile);for(const p of profiles)assert.equal(p,profiles[0],'matching source macro profile markers');return profiles[0];
}
export function assertCreatedMacroSelection(initial){
 const profile=serializedMacroProfile(initial),names=selectedSourceMacroNames(profile);
 assert.deepEqual(initial.compiled.externalFunctions.map(x=>x.name).sort(),[...names].sort(),'exact selected created HOST macro set');
 assert.deepEqual(initial.configuration.externalFunctions,initial.compiled.externalFunctions,'created HOST descriptor authority');
 if(profile===COUPLED_MACRO_PROFILE)assertCoupledMacroBudget(initial.compiled.instructions,initial.compiled.externalFunctions);
 return profile;
}
// Fixed audited count2/h192 source-only compilation proof. The sixth argument
// is a source-bank read AFTER the original !=32768 guard; it is not a literal
// call argument. Pinning the complete immutable code/descriptor authority is
// deliberately narrower than an unproven partial dataflow analysis.
export const COUPLED_PROFILE_CODE_SHA256='d0241fb5daa61ea4923cde61881beb799f3407d2c686f3661a22dea36c79cde5';
export const COUPLED_PROFILE_DESCRIPTORS_SHA256='abc724d27c7f2d1ccb7dc8699779188fb93878c1325d19914759859e7bb017a6';
const sha=x=>createHash('sha256').update(x).digest('hex');
export function assertCoupledMacroBudget(code,descriptors){
 assert.ok(code instanceof Uint32Array&&code.length%I.instructionWords===0,'immutable complete microcode words');
 const d=descriptors.find(x=>x.id===3);assert.ok(d&&d.name===SOURCE_MACRO_NAMES[3]&&d.params.length===6,'coupled six-word descriptor');
 assert.equal(sha(code),COUPLED_PROFILE_CODE_SHA256,'fixed coupled source budget/read/branch/CALL bytecode proof');
 assert.equal(sha(JSON.stringify(descriptors)),COUPLED_PROFILE_DESCRIPTORS_SHA256,'fixed coupled macro slots/declarations/profile proof');
 return Object.freeze({sourceInstructionBudget:32768,guardedSourceBankRead:true,literalCallArgument:false,sourceOnlyProof:true});
}
