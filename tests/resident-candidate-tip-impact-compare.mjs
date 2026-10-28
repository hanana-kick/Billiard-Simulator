// ASSERTION ONLY. Source all11 and independent actual native observables/event
// tape are both mandatory. No expected bank or repair is a runtime input.
import assert from 'node:assert/strict';
import {decodeTipImpactMicrocodeCheckpoints} from '../src/resident-candidate/tip-impact-microcode-checkpoints.mjs';
import {decodeWorldEmissionAudit} from './resident-candidate-event-audit.mjs';
import {compareWorldBank,projectWorldComparison,firstWorldMismatch} from './resident-candidate-whole-h-fixture.mjs';
import {compareNativeStrikeCheckpoint,compareNativeStrikeEmissionAudit} from './resident-candidate-strike-continuation-bank.mjs';
const KIND='resident-tip-impact-assertions-only-v1';
function expectedProfile(e,t){assert.equal(e?.kind,KIND);assert.equal(e.count,2);assert.deepEqual(e.rows.map(x=>x.id),[219,522]);assert.equal(e.coverage.cpuFuturesRuntimeInputs,false);assert.equal(e.coverage.mandatoryActualEmissionTape,true);assert.equal(e.identity.rule.maxOuterSteps,15360);assert.equal(e.identity.requestedH,192);assert.equal(e.seed.initialSnapshotSha256,e.identity.createdIdentity);assert.equal(e.nativeEvidence.sourceIdentity,e.identity.createdIdentity);assert.equal(e.seed.sourceOrigin.preStrikeSnapshotSha256,e.identity.preStrikeIdentity);assert.deepEqual(e.seed.sourceOrigin.settings,e.rows[0].settings);assert.equal(t.sourceIdentity,e.identity.commonTemplateIdentity);assert.deepEqual(e.rejection&&[e.rejection.id,e.rejection.status,e.rejection.reason,e.rejection.h],[522,8,2,0]);assert.equal(e.rejection.native.code,'ORIGINAL_STRIKE_REJECTED');assert.equal(e.rejection.native.pass,null);}
export function assertTipImpactFinalHeaders({expected:e,words,template:t}){
 expectedProfile(e,t);const n=t.state?.length??t.stateWords;assert.ok(Number.isSafeInteger(n)&&n>0);assert.ok(words instanceof Uint32Array&&words.length>=2*n);for(let lane=0;lane<2;lane++){const b=lane*n;assert.equal(words[b],0x52435753);assert.equal(words[b+1],1);assert.equal(words[b+4],lane?522:219);assert.equal(words[b+2],lane?8:1,'incomplete/unsupported is never physical MISS');assert.equal(words[b+3],lane?2:0);assert.equal(words[b+5],lane?0:192);assert.equal(words[b+t.segments.rawCreation.offset+4],lane?0:1);}return{transportValidated:false,rejectedAtH0:1};
}
function compareSourceBank({expected:e,words,template,frames,trace}){
 const original=e.sourceExpectations[frames];assert.ok(original?.snapshot&&original.scoring);assert.equal(original.snapshot.frame,frames);assert.equal(original.scoring.status,'running');assert.equal(original.scoring.accumulator.steps,frames/64);const args={words,base:0,template,seed:e.seed,expected:original.snapshot,scoring:original.scoring};
 try{compareWorldBank(args);assert.equal(Object.keys(projectWorldComparison(args).expected).length,11,'all11 source groups mandatory');}catch(error){let differences;try{const p=projectWorldComparison(args);differences=Object.keys(p.expected).map(owner=>({owner,mismatch:firstWorldMismatch(p.actual[owner],p.expected[owner],'$.'+owner)}));}catch(projection){differences=[{projectionError:projection.message}];}const diagnostic={gate:'tip-impact-all11',candidate:219,frames,validationPhase:'physics',differences,error:error.message};trace(diagnostic);error.tipImpactDiagnostic=diagnostic;throw error;}
}
/** Final world plus actual eighth-binding diagnostic storage. The rejected
 * lane must remain h0, its entire audit/tail must stay zero. Snapshot tail alone
 * cannot pass: final192 bank equality + all11 at BOTH128/192 + native events
 * and complete latched outers are mandatory, without intermediate readback. */
export function compareTipImpactCheckpoints({expected:e,words,auditWords,layout,template,trace=()=>{}}={}){
 assertTipImpactFinalHeaders({expected:e,words,template});assert.equal(layout.stateWords,template.state?.length??template.stateWords);assert.equal(layout.sourceStateWords,words.length,'complete unchanged final source view');
 const decoded=decodeTipImpactMicrocodeCheckpoints(auditWords,layout),rows=decodeWorldEmissionAudit(decoded.auditPrefix,{count:2,audit:{words:layout.auditWords,strideWords:layout.auditStride,capacityPerCandidate:64}},{candidate:0});
 // Compare the ENTIRE actual tape first. Prefix-only checks could conceal an
 // unexpected later event and must never qualify this physical-impact gate.
 const receipt=compareNativeStrikeEmissionAudit(rows,e.nativeEvidence,'after-tip');assert.equal(receipt.events,1,'the actual h165 tip emission is mandatory');const coverage=[];
 for(const capture of decoded.snapshots){const frames=capture.header[5];assert.equal(capture.header[4],219);assert.ok(frames===128||frames===192);compareSourceBank({expected:e,words:capture.words,template,frames,trace});const prefix=rows.filter(row=>row.outerOrdinal<=capture.header[6]);coverage.push(compareNativeStrikeCheckpoint({words:capture.words,base:0,template,evidence:e.nativeEvidence,name:capture.name,emissionAudit:prefix}));}
 const final=decoded.snapshots.at(-1).words;assert.deepEqual(words.slice(0,layout.stateWords),final,'captured192 world equals retained final source bank');
 return{kind:'resident-tip-impact-all11-native-comparison-v1',candidate:219,rejected:522,frames:192,checkpoints:[128,192],all11SourceGroups:true,sourceComparisons:2,nativePhysicsLabOuter:true,fullAcceptedEmissionTapeQualified:true,events:receipt.events,physicalImpactCompared:true,coverage,transportValidated:false,rawToStrikeQualified:false,fullRest:false,native1024:false,hardwarePerformance:false};
}
