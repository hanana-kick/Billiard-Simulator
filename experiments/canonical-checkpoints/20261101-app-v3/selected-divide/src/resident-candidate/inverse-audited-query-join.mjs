// Optional terminal kernel SOURCE only. No scheduling, state upload, replay,
// route-policy upgrade, or evidence that a GPU terminal accumulator has run.
import {createHash} from './source-sha256.mjs';
import {assertInverseAuditObservationComposition,mapInverseLogicalViewSource,restoreInverseLogicalViewSource} from './inverse-observation-storage.mjs';
import {generateInverseWorldQueryJoinWGSL} from './inverse-world-query-join.mjs';
const need=(v,m)=>{if(!v)throw new RangeError('Inverse audited query join: '+m);};
export const INVERSE_AUDITED_QUERY_JOIN_PROFILE='source-four-ball-inverse-audited-query-join-v1';
export const INVERSE_AUDITED_QUERY_JOIN_CAPABILITY=Object.freeze({sourceOnly:true,legacyQueryOnly:true,separateTerminalKernel:true,originalPhysicalViewsUnchanged:true,fullAuditViewPreserved:true,sourceScalarsUnchanged:true,nativeQualified:false,rawToTerminalQualified:false,fullRestQualified:false,finalGameplayQualified:false,solverAdapterImplemented:false,defaultEnabled:false});
/** Generate the ORIGINAL admitted scalar join, then apply only the proven
 * checked final-address view mapping. The full audit/checkpoint prefix is not a
 * join input, and no original state/input length or arithmetic is rewritten.
 * The caller must eventually dispatch this separate kernel on the SAME resident
 * buffers after the original world boundary; this module does not schedule it.
 */
export function generateInverseAuditedQueryJoinWGSL({composition,join}={}){
 const originalCode=generateInverseWorldQueryJoinWGSL(join),c=assertInverseAuditObservationComposition(composition,{observer:join.observer}),l=c.layout;
 need(l.count===join.count&&l.observerStride===join.observer.observerWords&&c.sourceIdentity===join.observer.sourceIdentity,'same immutable candidate count, observer stride and source identity');
 const mapped=mapInverseLogicalViewSource({code:originalCode,view:{name:'observer',offset:l.observerBase,words:l.observerWords,totalWords:l.totalWords}});
 need(restoreInverseLogicalViewSource(mapped.code,mapped.edits)===originalCode,'exact original scalar source recovery');
 // Keep even the attribution and original function order intact. WGSL permits
 // this pure address helper to follow its callers; no linker rewriting needed.
 const code=mapped.code+'\n'+mapped.helperCode;
 return Object.freeze({kind:INVERSE_AUDITED_QUERY_JOIN_PROFILE,code,sourceSha256:createHash('sha256').update(code).digest('hex'),entry:'main',originalCode,mapped,layout:l,context:join.context,sourceIdentity:c.sourceIdentity,recordWords:64,outputOffset:l.observerBase+join.outputOffset,outputStride:l.observerStride,capability:INVERSE_AUDITED_QUERY_JOIN_CAPABILITY});
}
