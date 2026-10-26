// PREPARATION/ASSERTION ONLY. Eight unchanged original h from each independent
// raw-row creation. No created row or future snapshot is runtime input.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {serialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,relative} from 'node:path';
import {createRawFirstHFixture,RAW_FIRST_H_CASES} from './resident-candidate-raw-whole-h-fixture.mjs';
import {createRawWorldPcPlan,RAW_PC_SAFE_TRANSPORTS} from './resident-candidate-raw-world-pc-runner.mjs';
import {compileWorldSourceOwners} from '../src/resident-candidate/world-owners.mjs';
import {NUMERIC_PROFILE} from '../src/resident-candidate/numeric-profile.mjs';
import {WORLD_H_BOUNDS} from '../src/resident-candidate/world-h.mjs';
import {STATUS,REASON} from '../src/resident-candidate/abi.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url)),sha=x=>createHash('sha256').update(x).digest('hex');
export const RAW_EIGHT_H=Object.freeze({frames:8,count:6,sweeps:2048});
export const RAW_EIGHT_H_EXPECTED_KIND='resident-raw-eight-h-assertion-only-v1';
function localSourceHashes(){const files=[];const walk=dir=>{for(const d of readdirSync(dir,{withFileTypes:true})){const p=join(dir,d.name);if(d.isDirectory())walk(p);else if(/\.(?:m?js|cjs)$/.test(p))files.push(p);}};walk(join(ROOT,'src'));files.push(join(ROOT,'vendor/rapier.cjs'));for(const name of['resident-candidate-raw-whole-h-fixture.mjs','resident-candidate-whole-h-fixture.mjs','resident-candidate-world-comparison.mjs','resident-candidate-original-fixture.mjs','resident-candidate-raw-world-pc-runner.mjs','resident-candidate-microcode-recurrence-fixture.mjs','resident-candidate-microcode-recurrence-compare.mjs'])files.push(join(ROOT,'tests',name));return Object.fromEntries(files.sort().map(p=>[relative(ROOT,p),sha(readFileSync(p))]));}
export async function createRawEightHFixture({sourceHead,sourceHashes}={}){
 const ownHashes=sourceHashes===undefined,before=ownHashes?localSourceHashes():structuredClone(sourceHashes),head=sourceHead??execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
 assert.equal(typeof head,'string');assert.match(head,/^[a-f0-9]{40}$/);assert.ok(before&&Object.getPrototypeOf(before)===Object.prototype&&Object.keys(before).length);for(const digest of Object.values(before))assert.match(digest,/^[a-f0-9]{64}$/);
 const f=await createRawFirstHFixture({frames:8});assert.equal(f.frames,8);assert.equal(f.results.length,6);assert.deepEqual(f.rows,RAW_FIRST_H_CASES.map(({id,settings})=>({id,settings})));
 const accepted=f.results.filter(r=>r.kind==='clear'),rejected=f.results.filter(r=>r.status===STATUS.REJECTED);assert.equal(accepted.length,4);assert.equal(rejected.length,2);
 for(const r of accepted){assert.equal(r.status,STATUS.RUNNING);assert.equal(r.reason,REASON.NONE);assert.equal(r.initial.frame,0);assert.equal(r.steps.length,8);assert.deepEqual(r.steps.map(x=>x.snapshot.frame),[1,2,3,4,5,6,7,8]);assert.equal(r.final,r.steps[7]);assert.equal(r.final.scoring.status,'running');assert.equal(r.seed.sourceOrigin.preStrikeSnapshotSha256,f.plan.preStrikeIdentity);assert.deepEqual(r.seed.sourceOrigin.settings,r.row.settings);}
 assert.deepEqual(rejected.map(r=>[r.row.id,r.reason]),[[421,REASON.CUE_BLOCKED],[522,REASON.SOURCE_INPUT_RANGE]]);
 const options={sweeps:2048,numericProfile:NUMERIC_PROFILE.PRESERVED_F32,sourceMode:'owners',controlVisitPolicy:'single-call',controlPartition:'source-closures-v1',...RAW_PC_SAFE_TRANSPORTS};
 const g=createRawWorldPcPlan({initializationPlan:f.plan,rows:f.rows,frames:8,sweeps:2048,numericProfile:options.numericProfile,...RAW_PC_SAFE_TRANSPORTS,sourceMode:{name:'owners',compile:(pc,source)=>compileWorldSourceOwners(f.plan.template,source,pc,{controlVisitPolicy:options.controlVisitPolicy,controlPartition:options.controlPartition})}});
 const identity={sourceHead:head,sourceHashes:before,sourceArtifactSha256:f.source.artifactSha256,preStrikeIdentity:f.plan.preStrikeIdentity,sourceIdentity:g.template.sourceIdentity,rawRows:f.rows,rawInputSha256:sha(g.input),programSha256:sha(g.program),sharedGeometrySha256:sha(g.template.sharedGeometry),rule:f.rule,frames:8,count:6,options,sourceCaps:WORLD_H_BOUNDS,pipelineIdentity:{initializer:Object.fromEntries(Object.entries(g.init.stages).map(([k,v])=>[k,sha(v.code)])),begin:sha(g.pc.begin.code),owners:g.pc.pipelines.map(p=>({name:p.name,sha256:sha(p.code)})),bytecodeSha256:sha(g.pc.bytecode),originalPhasePipelines:g.source.pipelines.length,sourceInstructions:g.pc.instructions,sweep:g.pc.sweep}};
 identity.generationIdentity=sha(serialize(identity));
 const template={state:{length:g.template.state.length},segments:g.template.segments,sharedGeometry:g.template.sharedGeometry,geometryOffsets:g.template.geometryOffsets,sceneTemplate:g.template.sceneTemplate,fixedCcd:g.template.fixedCcd,sourceIdentity:g.template.sourceIdentity};
 const planMetadata={generationIdentity:identity.generationIdentity,preStrikeIdentity:identity.preStrikeIdentity,sourceIdentity:identity.sourceIdentity,count:6,frames:8,sweeps:2048,sourceMode:'microcode-recurrence',stateWords:g.template.state.length,totalStateWords:g.pc.totalStateWords,controlTailBase:g.pc.controlTailBase,controlWords:g.pc.controlWords,ownerPipelines:g.pc.pipelines.length,maxH:8,sourceInstructions:g.pc.instructions};
 const expected={kind:RAW_EIGHT_H_EXPECTED_KIND,generationIdentity:identity.generationIdentity,frames:8,count:6,template,transport:g.source.transport,sweeps:2048,planMetadata,results:f.results.map(r=>({row:r.row,status:r.status,reason:r.reason,kind:r.kind,...(r.final?{seed:r.seed,initial:r.initial,steps:r.steps,final:r.final}:{})})),pc:{controlTailBase:g.pc.controlTailBase,controlWords:g.pc.controlWords,pipelines:g.pc.pipelines.length,maxH:8,instructions:g.pc.instructions,totalStateWords:g.pc.totalStateWords},expectedGeneration:{source:'unchanged original independent creation + World.createReferenceStepper + original scoring observer',frames:8,perHAssertionsOnly:true,createdSnapshots:accepted.map(r=>({id:r.row.id,createdSha256:r.seed.initialSnapshotSha256,perHSha256:r.steps.map(x=>sha(serialize(x))),finalSha256:sha(serialize(r.final))})),futureStatesUploaded:false}};
 if(ownHashes)assert.deepEqual(localSourceHashes(),before,'source files unchanged during eight-h preparation');
 return {fixture:f,plan:g,identity,expected};
}
