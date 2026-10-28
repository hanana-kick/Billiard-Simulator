// ASSERTION ONLY. Never imported by lean GPU execution or an initial uploader.
// Bank/physics gates do not replace the runner's retained PC/VM transport gate.
import assert from 'node:assert/strict';
import {STATUS,REASON} from '../src/resident-candidate/abi.mjs';
import {compareWorldBank,projectWorldComparison,firstWorldMismatch,assertWholeHCommitted,assertWorldEquivalent} from './resident-candidate-whole-h-fixture.mjs';
import {compareNativeStrikeCheckpoint,compareNativeStrikeEmissionAudit,projectNativeStrikeCheckpoint} from './resident-candidate-strike-continuation-bank.mjs';
import {WORLD_APPLICATION_LAYOUT as W} from '../src/resident-candidate/world-application.mjs';
const KIND='resident-small-strike-assertions-only-v1';
const nativeNames=Object.freeze({64:'first-outer',128:'before-tip',192:'after-tip'});
function admittedExpected(e){assert.equal(e?.kind,KIND);assert.equal(e.count,2);assert.deepEqual(e.rows.map(r=>r.id),[219,522]);assert.equal(e.coverage.cpuFuturesRuntimeInputs,false);assert.equal(e.identity.rule.maxOuterSteps,15360);assert.equal(e.seed.initialSnapshotSha256,e.identity.createdIdentity);assert.deepEqual(e.seed.sourceOrigin.settings,e.rows[0].settings);assert.equal(e.seed.sourceOrigin.preStrikeSnapshotSha256,e.identity.preStrikeIdentity);assert.deepEqual(e.rejection&&[e.rejection.id,e.rejection.status,e.rejection.reason,e.rejection.h],[522,STATUS.REJECTED,REASON.SOURCE_INPUT_RANGE,0]);assert.equal(e.rejection.native.code,'ORIGINAL_STRIKE_REJECTED');assert.equal(e.rejection.native.pass,null);}
/** Pure exact bank-header/rejection checks. This does not certify VM completion
 * and cannot on its own pass a physical-state comparison. */
export function assertSmallStrikeBankHeaders({expected:e,words,template,frames}){
 admittedExpected(e);assert.ok([8,64,128,192].includes(frames),'explicit small-roster boundary');const n=template?.state?.length??template?.stateWords;assert.ok(Number.isSafeInteger(n)&&n>0);assert.ok(words instanceof Uint32Array&&words.length>=2*n);assert.equal(template.sourceIdentity,e.identity.commonTemplateIdentity,'original common initialization template, not variant/future replacement');
 for(const [lane,row]of e.rows.entries()){const b=lane*n;assert.equal(words[b],0x52435753);assert.equal(words[b+1],1);assert.equal(words[b+4],row.id,'unchanged original candidate ID');assert.equal(words[b+2],lane?STATUS.REJECTED:STATUS.RUNNING,'unsupported/incomplete is never physical MISS');assert.equal(words[b+3],lane?REASON.SOURCE_INPUT_RANGE:REASON.NONE,'exact source rejection reason');assert.equal(words[b+5],lane?0:frames,'invalid522 never advances h');assert.equal(words[b+template.segments.rawCreation.offset+4],lane?0:1,'invalid522 never creates a world');}
 return {count:2,acceptedId:219,rejectedId:522,rejectedAtH:0,transportValidated:false};
}
export function compareSmallStrikeSource({expected:e,words,template,frames,trace=()=>{}}){
 assert.ok(frames===8||frames===64,'new all11 gate admits exactly h8/h64; old gates unchanged');assertSmallStrikeBankHeaders({expected:e,words,template,frames});const original=e.sourceExpectations[frames];assert.ok(original?.snapshot&&original.scoring);assert.equal(original.snapshot.frame,frames);assert.equal(original.scoring.status,'running');assert.equal(original.scoring.accumulator.steps,frames===64?1:0);const args={words,base:0,template,seed:e.seed,expected:original.snapshot,scoring:original.scoring};
 try{compareWorldBank(args);assert.equal(Object.keys(projectWorldComparison(args).expected).length,11,'all original represented groups required');}
 catch(error){let differences;try{const p=projectWorldComparison(args);differences=Object.keys(p.expected).map(owner=>({owner,mismatch:firstWorldMismatch(p.actual[owner],p.expected[owner],'$.'+owner)}));}catch(projection){differences=[{projectionError:projection.message}];}const diagnostic={gate:'small-strike-source',candidate:219,frames,validationPhase:'physics',differences,error:error.message};trace(diagnostic);error.smallStrikeDiagnostic=diagnostic;throw error;}
 return {kind:'resident-small-strike-source-comparison-v1',count:2,frames,strictOriginalComparisons:1,all11SourceGroups:true,rejectedAtH0:1,nativeOuterCompared:false,transportValidated:false,fullRest:false,rawToStrike:false,native1024:false};
}
export function compareSmallStrikeNativeOuter({expected:e,words,template,frames,emissionAudit}){
 assert.ok(Object.hasOwn(nativeNames,frames),'complete original native outer64/128/192 only');assertSmallStrikeBankHeaders({expected:e,words,template,frames});assert.ok(Array.isArray(emissionAudit),'mandatory actual final decoded emission tape; empty is explicit');const name=nativeNames[frames];assert.equal(e.nativeEvidence.sourceIdentity,e.identity.createdIdentity);assert.deepEqual(e.nativeEvidence.seed,e.seed,'same independently admitted variant source');
 // Mandatory even before bank projection: never treat absent audit as [] or
 // compare only a filtered tape that could conceal later unexpected emissions.
 const receipt=compareNativeStrikeEmissionAudit(emissionAudit,e.nativeEvidence,name),coverage=compareNativeStrikeCheckpoint({words,base:0,template,evidence:e.nativeEvidence,name,emissionAudit});
 return {kind:'resident-small-strike-native-outer-comparison-v1',candidate:219,frames,outer:frames/64,events:receipt.events,nativePhysicsLabOuter:true,coverage,all11SourceGroups:false,physicalImpactCompared:frames===192,transportValidated:false,fullRest:false,rawToStrikeQualified:false,native1024:false,hardwarePerformance:false};
}
/** Explicit FIRST-OUTER OBSERVABLES profile for the existing seven-binding
 * runner, which does not record an emission tape. It never invents [], never
 * claims full accepted-emission equality, and cannot admit a post-impact h.
 * Caller must ALSO pass all11 source-owner and retained PC/VM transport gates. */
export function compareSmallStrikeNativeFirstOuterProjection({expected:e,words,template}){
 const frames=64;assertSmallStrikeBankHeaders({expected:e,words,template,frames});assert.equal(e.nativeEvidence.sourceIdentity,e.identity.createdIdentity);const s=e.nativeEvidence.checkpoints.find(x=>x.name==='first-outer')?.state;assert.ok(s);assert.equal(s.nativeSteps,64);assert.equal(s.outerSteps,1);assert.equal(s.boundary.subdivisions,64);assert.equal(s.cue.contacted,false,'this profile is strictly before physical impact');
 assertWholeHCommitted({words,base:0,template,frame:64});const wa=template.segments.worldApplication.offset;assert.equal(words[wa+W.header.phase],W.phases.idle,'complete source-latched first outer');assert.equal(words[wa+W.header.terminalPublished],0,'diagnostic cutoff, not physical query terminal');
 const projection=projectNativeStrikeCheckpoint({words,base:0,template,evidence:e.nativeEvidence,name:'first-outer'});assertWorldEquivalent(projection.actual,projection.expected,'native first-outer64 represented observables');
 return {kind:'resident-small-strike-native-first-outer-observables-v1',candidate:219,frames:64,outer:1,nativePhysicsLabOuter:true,representedGroups:Object.keys(projection.expected),fullAcceptedEmissionTapeQualified:false,emissionTapeAvailable:false,all11SourceGroups:false,transportValidated:false,physicalImpactCompared:false,fullRest:false,rawToStrikeQualified:false,native1024:false,hardwarePerformance:false};
}
