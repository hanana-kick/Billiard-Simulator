// TEST-only historical allocation/ABI profile. No physics runtime or brand.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {packCandidates,STATUS as S,REASON as R,UNSET} from '../src/resident-candidate/abi.mjs';
import {generateNumericAdmissionWGSL,guardNumericResult,NUMERIC_PROFILE,NUMERIC_DEPENDENCY_MASK} from '../src/resident-candidate/numeric-profile.mjs';
import {snapshotMicrocodeDeviceLimits} from '../src/resident-candidate/microcode-resources.mjs';
export const hash=x=>createHash('sha256').update(x).digest('hex');
export const ROOT=new URL('../',import.meta.url);
export const DIAGNOSTIC_PROFILE_LABEL='historical-four-macro-512-h2-resources/current-mask0-compact-ABI';
export const PROPOSAL='docs/evidence/resident-1024-allocation-diagnostic-proposal-v1.json';
export const SOURCE_FILES=Object.freeze(['tests/resident-candidate-1024-allocation-plan.mjs','tests/resident-candidate-1024-allocation-owner.mjs','tests/resident-candidate-1024-allocation-native.mjs']);
const clone=structuredClone,freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
export function currentSourceHashes(){const p=JSON.parse(readFileSync(new URL(PROPOSAL,ROOT)));return Object.fromEntries([...Object.keys(p.currentContractSha256),...SOURCE_FILES,PROPOSAL].map(f=>[f,hash(readFileSync(new URL(f,ROOT)))]));}
export function diagnosticShader(){return `@group(0) @binding(0) var<storage,read> rc_diag_input:array<u32>;
@group(0) @binding(1) var<storage,read_write> rc_diag_compact:array<u32>;
${generateNumericAdmissionWGSL({numericProfile:NUMERIC_PROFILE.PRESERVED_F32,qualifiedMask:0})}
@compute @workgroup_size(32) fn main(@builtin(global_invocation_id) gid:vec3<u32>){
 let row=gid.x;if(row>=512u||arrayLength(&rc_diag_input)!=8192u||arrayLength(&rc_diag_compact)!=2048u){return;}
 let p=row*4u;let r=vec4<u32>(rc_diag_compact[p],rc_diag_compact[p+1u],rc_diag_compact[p+2u],rc_diag_compact[p+3u]);
 // Keep a wrong ID visible to the atomic journal; never repair its authority.
 if(r.x!=rc_diag_input[row*16u]){return;}
 let guarded=rc_numeric_guard_result(r,${NUMERIC_DEPENDENCY_MASK}u);
 rc_diag_compact[p]=guarded.x;rc_diag_compact[p+1u]=guarded.y;rc_diag_compact[p+2u]=guarded.z;rc_diag_compact[p+3u]=guarded.w;
}`;}
export function createDiagnosticPayload({decisionTimeoutMs}={}){
 assert.ok(Number.isInteger(decisionTimeoutMs)&&decisionTimeoutMs>=1&&decisionTimeoutMs<=900000,'explicit decision retention milliseconds1..900000');
 const proposalBytes=readFileSync(new URL(PROPOSAL,ROOT)),p=JSON.parse(proposalBytes),oldBytes=readFileSync(new URL(p.layoutOrigin.path,ROOT)),old=JSON.parse(oldBytes).sourceOnly1024;
 assert.equal(hash(oldBytes),p.layoutOrigin.fileSha256);assert.equal(old.planSha256,p.layoutOrigin.planSha256);assert.deepEqual(p.allocations,old.allocations);
 for(const[f,h]of Object.entries(p.currentContractSha256))assert.equal(hash(readFileSync(new URL(f,ROOT))),h,'current contract '+f);
 const ids=Array.from({length:1024},(_,i)=>i<512?1000+(i*73)%512:2000+((i-512)*151)%512);
 const input=packCandidates(ids.map(id=>({id,settings:{angle:310,elevation:85,speed:4.5,tipX:.2,tipY:-.1}})),{selectedIndex:1});
 const cases=[[S.PASS,1,R.NONE],[S.MISS,0,R.NONE],[S.UNSUPPORTED,UNSET,R.NUMERIC],[S.INCOMPLETE,UNSET,R.HORIZON],[S.CANCELLED,UNSET,R.CANCELLED],[S.FAILED,UNSET,R.STALE_SOURCE],[S.FAILED,UNSET,R.DEVICE_LOST],[S.REJECTED,UNSET,R.SOURCE_INPUT_RANGE]];
 const seeds=Uint32Array.from(ids.flatMap((id,i)=>[id,...cases[i%8]])),shader=diagnosticShader(),sourceHashes=currentSourceHashes();
 const payload={kind:'resident-1024-allocation-abi-input-v1',profileLabel:DIAGNOSTIC_PROFILE_LABEL,profile:p.layoutOrigin,proposalSha256:hash(proposalBytes),sourceHashes,count:1024,banks:[{first:0,count:512},{first:512,count:512}],ids,input:Array.from(input),seeds:Array.from(seeds),shader,shaderSha256:hash(shader),allocations:clone(p.allocations),peakBytes:370787688,maxLiveBytes:370787688,decisionTimeoutMs,waves:['complete','cancel-after-clear','stale-after-bank0'],identity:{sourceIdentity:'diagnostic-kernel:'+hash(shader),preStrikeIdentity:'none:synthetic-transport-not-physics',generationIdentity:hash(JSON.stringify({profile:p.layoutOrigin,sourceHashes,ids,input:Array.from(input),seeds:Array.from(seeds)}))},capability:{physicsRuntime:false,productionClassifier:false,qualifiedMask:0,sourceRowsAdmitted:false,physicalResidencyProven:false,releaseQualified:false}};
 return freeze(payload);
}
export function assertDiagnosticPayload(value,{verifySource=true}={}){
 const expected=createDiagnosticPayload({decisionTimeoutMs:value?.decisionTimeoutMs});assert.deepEqual(value,expected,'exact historical profile, roster, source and fixed schedule; no overrides');
 if(verifySource)assert.deepEqual(value.sourceHashes,currentSourceHashes());return freeze(clone(value));
}
export function diagnosticExpected(payload){assertDiagnosticPayload(payload);const words=new Uint32Array(4096);for(let i=0;i<1024;i++)words.set(guardNumericResult(Uint32Array.from(payload.seeds.slice(i*4,i*4+4)),{numericProfile:NUMERIC_PROFILE.PRESERVED_F32,qualifiedMask:0,requiredMask:NUMERIC_DEPENDENCY_MASK}),i*4);return {kind:'resident-1024-allocation-abi-expected-v1',payloadSha256:hash(JSON.stringify(payload)),words:Array.from(words),statusCounts:{unsupported:384,incomplete:128,cancelled:128,failed:256,rejected:128},physicsExpected:false};}
export function assertDiagnosticLimits(device,payload){
 const limits=snapshotMicrocodeDeviceLimits(device);for(const[k,n]of Object.entries({maxStorageBuffersPerShaderStage:7,maxBindingsPerBindGroup:7,maxBindGroups:1,maxComputeInvocationsPerWorkgroup:64,maxComputeWorkgroupSizeX:64,maxComputeWorkgroupsPerDimension:512}))assert.ok(limits[k]>=n,'insufficient intended layout '+k);
 assert.equal(payload.allocations.length,25);assert.equal(payload.count,1024);assert.equal(payload.peakBytes,payload.allocations.reduce((n,a)=>n+a.bytes,0));assert.ok(payload.maxLiveBytes>=payload.peakBytes,'complete budget, never shrink');
 for(const a of payload.allocations){assert.equal(a.bytes,a.words*4);assert.ok(a.bytes<=limits.maxBufferSize,'buffer limit '+a.name);if(a.bank!==null)assert.ok(a.bytes<=Math.min(limits.maxStorageBufferBindingSize,134217728),'storage binding limit '+a.name);}return limits;
}
export function validateGo(decision,receipt,{now=Date.now()}={}){
 assert.equal(receipt.kind,'resident-1024-allocation-abi-compile-ready-v1');assert.equal(receipt.pipelines,1);assert.equal(receipt.buffers,0);assert.equal(receipt.dispatches,0);assert.ok(now<=receipt.expiresAt,'decision expired');assert.deepEqual(Object.keys(decision).sort(),['action','challenge','compileReceiptSha256','payloadSha256'].sort());assert.equal(decision.challenge,receipt.challenge);assert.equal(decision.payloadSha256,receipt.payloadSha256);assert.equal(decision.compileReceiptSha256,hash(JSON.stringify(receipt)));assert.ok(['stop','run-fixed-three-waves'].includes(decision.action),'fixed GO or stop only');return decision.action;
}
