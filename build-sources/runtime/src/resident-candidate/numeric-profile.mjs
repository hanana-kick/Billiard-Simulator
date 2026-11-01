/* SPDX-License-Identifier: Apache-2.0
 * Explicit numerical implementation selection and fail-closed publication.
 * A profile is not a proof for every IEEE input or every GPU. The executor
 * supplies only capabilities established for its pinned device/source path;
 * neither a raw angle nor a passing component fixture qualifies a whole shot.
 */
import {generateNumericLibraryWGSL} from './numeric-program.mjs';
import {generateIntegerF32WGSL} from './integer-f32.mjs';
import {STATUS,REASON,UNSET} from './abi.mjs';

export const NUMERIC_PROFILE=Object.freeze({DEVICE_F32:'device-f32-v1',PRESERVED_F32:'source-f32-preserved-v1',INTEGER_F32:'source-f32-integer-v1'});
export const NUMERIC_DEPENDENCY=Object.freeze({F32_VM:1,SOURCE_NUMBER:2,CONVEX_POINT:4,
 BVH:8,NARROW_SCALARS:16,CCD_SCALARS:32,RAW_CLEARANCE:64,CUE_QUERY:128,APPLICATION_SCALARS:256});
export const NUMERIC_DEPENDENCY_MASK=Object.values(NUMERIC_DEPENDENCY).reduce((a,b)=>a|b,0);
export const NUMERIC_VM_OWNERS=Object.freeze({
 'numeric-request.mjs':'single shared source graph request evaluator; original owner prefixes/suffixes retain publication authority',
 'geometry-numeric-owner.mjs':'six source geometry graph-call boundaries, lowered to a shared evaluator without changing source arithmetic',
 'remaining-numeric-owner.mjs':'source broad/scene/cloth/CCD graph-call boundaries; shared numeric-request worker owns evaluation',
 'coupled-solver.mjs':'ordered contact preparation/force/gyro/PGS/integration/relax/bounce/cache',
 'cue-orchestration.mjs':'separation/COM/created mass/isolated or cloth joint',
 'cue-bridge.mjs':'shaft/head pre/post inactive CCD',
 'scene-world.mjs':'scene force and energy/sleep graphs',
 'world-creation.mjs':'raw-pose created mass before first lateral',
 'world-geometry.mjs':'floor/pair/convex cache graphs',
 'world-cue-geometry.mjs':'rigid exclusion/current pose and empty cache graphs',
 'world-h.mjs':'whole-h composition supplies the explicitly selected profile to every external VM owner',
 'integer-f32.mjs':'explicit integer-backed opcode implementation; retains original VM transport without hardware f32 arithmetic',
 'numeric-continuation.mjs':'opt-in source-generated single-instruction VM continuation; no complete nested graph loop',
 'narrowphase.mjs':'external profiled VM supplied by world-geometry',
 'ccd.mjs':'external profiled VM: pre/post/schedule/sweep/simplex reducers',
 'world-broad.mjs':'external profiled VM: original bounds/skin',
 'application.mjs':'external profiled VM: native angular impulse API boundary',
 'cue-empty-caches.mjs':'external profiled VM: source empty cache lifecycle',
 'cue-cloth-cache.mjs':'external profiled VM: original live cloth geometry/cache',
});
export const NON_VM_NUMERIC_DEPENDENCIES=Object.freeze([
 Object.freeze({bit:4,files:['convex-point.mjs'],operations:'Original point GJK/EPA vector/scalar arithmetic, support ordering and predicates; storage round trips do not prevent FTZ/DAZ.'}),
 Object.freeze({bit:8,files:['bvh.mjs'],operations:'Float AABB min/max/overlap, volume/score add/sub/mul/div, rebuild bins/heap comparisons; order changes affect contact order.'}),
 Object.freeze({bit:16,files:['narrowphase.mjs','cue-cloth-cache.mjs'],operations:'Outside-graph recycle-distance products/min remain device f32. Floor/pair/convex/cloth contact-ID zero predicates and cloth normal/nonnegative-impulse guards use exact integer words.'}),
 Object.freeze({bit:32,files:['ccd.mjs'],operations:'Original proxy-distance/GJK support, distance/root/controller scalar predicates; reducer graphs alone do not cover them.'}),
 Object.freeze({bit:64,files:['raw-strike.mjs'],operations:'Raw contact/cast GJK/EPA/native support math and f32 casts. Binary64 pose/trig/clearance reduction is a separate SOURCE_NUMBER dependency.'}),
 Object.freeze({bit:128,files:['cue-empty-caches.mjs','world-cue-geometry.mjs'],operations:'Original convex query/support math and non-VM separation/cache predicates.'}),
 Object.freeze({bit:256,files:['application.mjs','scene-activation.mjs'],requiresDeviceFloatGate:false,operations:'Native contact impulse positivity/finite predicates and scene sleep/split timer ordering/equality use exact integer bits, including signed zero, infinities and unordered NaNs; these helpers need no device-float gate. This does not qualify other geometry.'}),
]);
export function numericProfileCode(profile=NUMERIC_PROFILE.DEVICE_F32){
 if(profile===NUMERIC_PROFILE.DEVICE_F32)return 1;
 if(profile===NUMERIC_PROFILE.PRESERVED_F32)return 2;
 if(profile===NUMERIC_PROFILE.INTEGER_F32)return 3;
 throw new RangeError('Explicit known numeric implementation profile required');
}
/** One immutable marker per linked pipeline. linkResidentWGSL rejects mixed
 * profile declarations, even if the duplicate numeric functions are pruned.
 * Defaults retain existing component backend behavior, not world admission. */
export function generateProfiledNumericWGSL(profile=NUMERIC_PROFILE.DEVICE_F32,{includeSourceNumberLibrary=true}={}){
 const id=numericProfileCode(profile);
 return `const RC_NUMERIC_IMPLEMENTATION_PROFILE:u32=${id}u;\n`+
  (id===3?generateIntegerF32WGSL({includeSourceNumberLibrary}):generateNumericLibraryWGSL({preserveSubnormals:id===2,includeSourceNumberLibrary}));
}
function mask(x,label){if(!Number.isInteger(x)||x<0||x>NUMERIC_DEPENDENCY_MASK||(x&~NUMERIC_DEPENDENCY_MASK)!==0)throw new RangeError('Known '+label+' numeric dependency mask required');return x;}
/** Qualification is deliberately explicit and device/path-specific. This
 * validates transport, not evidence: only the executor's validated profile
 * owner may supply qualifiedMask, and must clear it after device/source change.
 * Candidate code accumulates actual dependencies, never just raw-input ranges.
 * F32_VM is mandatory even if a malformed caller supplies an empty path mask.
 */
export function numericAdmission({numericProfile=NUMERIC_PROFILE.DEVICE_F32,qualifiedMask=0,requiredMask=NUMERIC_DEPENDENCY.F32_VM}={}){
 const profile=numericProfileCode(numericProfile);mask(qualifiedMask,'qualified');mask(requiredMask,'required');
 requiredMask|=NUMERIC_DEPENDENCY.F32_VM;
 return Object.freeze({profile,qualifiedMask,requiredMask,allowed:(profile===2||profile===3)&&(qualifiedMask&requiredMask)===requiredMask});
}
/** Guard ABI terminal publication, not internal rule state. Missing support is
 * UNSUPPORTED/NUMERIC with unset pass, never a scored miss or successful ID.
 * Existing incomplete/cancelled/error records retain their original reason.
 */
export function guardNumericResult(result,options={}){
 if(!(result instanceof Uint32Array)||result.length!==4)throw new TypeError('One ABI result row required');
 const out=result.slice(),admission=numericAdmission(options);
 if((out[1]===STATUS.PASS||out[1]===STATUS.MISS)&&!admission.allowed)out.set([STATUS.UNSUPPORTED,UNSET,REASON.NUMERIC],1);
 return out;
}
export function generateNumericAdmissionWGSL({numericProfile=NUMERIC_PROFILE.DEVICE_F32,qualifiedMask=0}={}){
 const a=numericAdmission({numericProfile,qualifiedMask});
 return `const RC_NUMERIC_IMPLEMENTATION_PROFILE:u32=${a.profile}u;
const RC_NUMERIC_ADMISSION_PROFILE:u32=${a.profile}u;
const RC_NUMERIC_QUALIFIED_MASK:u32=${a.qualifiedMask}u;
fn rc_numeric_path_supported(required:u32)->bool{
 let needed=required|1u;return (RC_NUMERIC_ADMISSION_PROFILE==2u || RC_NUMERIC_ADMISSION_PROFILE==3u) && (needed&~${NUMERIC_DEPENDENCY_MASK}u)==0u && (needed&RC_NUMERIC_QUALIFIED_MASK)==needed;
}
fn rc_numeric_guard_result(result:vec4<u32>,required:u32)->vec4<u32>{
 if((result.y==${STATUS.PASS}u||result.y==${STATUS.MISS}u)&&!rc_numeric_path_supported(required)){return vec4<u32>(result.x,${STATUS.UNSUPPORTED}u,0xffffffffu,${REASON.NUMERIC}u);}return result;
}
`;
}
