// Independent ORIGINAL no-step admission, not a GPU producer or future state.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
const require=createRequire(import.meta.url),R=require('../vendor/rapier.cjs');
for(const name of['math','render-cadence','physics','game-rules','controller'])require('../src/'+name+'.js');
const sha=b=>createHash('sha256').update(b).digest('hex'),rosterUrl=new URL('./fixtures/resident-macro-scale-roster-v1.json',import.meta.url);
export const SCALE_ROSTER_SHA256=sha(readFileSync(rosterUrl));
export function scaleRoster(count){const r=JSON.parse(readFileSync(rosterUrl));assert.equal(r.kind,'resident-macro-scale-fixed-raw-roster-v1');assert.ok(r.stagedCounts.includes(count));assert.equal(r.rows.length,9);assert.equal(new Set(r.rows.map(x=>x.id)).size,9);assert.deepEqual(r.rows.slice(0,6).map(x=>x.id),r.preservedPrefixIds);return{...r,count,rows:r.rows.slice(0,count),rosterSha256:SCALE_ROSTER_SHA256};}
function nativeHandle(h){const d=new DataView(new ArrayBuffer(8));d.setUint32(0,h.index,true);d.setUint32(4,h.generation,true);return d.getFloat64(0,true);}
export function restoreScaleOriginalController(raw){
 const a=raw.capture.preStrikeApplication,bind=o=>({...o,bodyHandle:nativeHandle(o.body),colliderHandle:nativeHandle(o.collider),pairColliderHandle:o.pairCollider?nativeHandle(o.pairCollider):undefined,pos:{x:0,y:0,z:0},trail:[]}),c=new globalThis.LabController();
 c.lab=globalThis.PhysicsLab.fromSnapshot(R,{...a,world:raw.preStrikeSnapshot,objects:a.registry.objects.map(bind),statics:a.registry.statics.map(bind)});
 Object.assign(c.state,{gameMode:a.controller.gameMode,selectedId:a.controller.selectedId,paused:a.controller.paused,settings:structuredClone(a.controller.settings)});c.state.routeOptions.fourBallThreeCushion=a.game.threeCushion;c.game=new globalThis.FourBallGame();c.game.restore(structuredClone(a.game));c.lab.onEvent=e=>c.game.contact(e);
 assert.deepEqual(c.undoStack,[]);assert.deepEqual(c.lab.world.takeSnapshot(),raw.preStrikeSnapshot);c.lab.step=()=>{throw Error('Common source may not advance');};return c;
}
export async function probeScaleOriginalAdmissions(directory){
 const roster=scaleRoster(9);await R.init();const source=await originalRegisteredFixture();assert.equal(source.artifactSha256,roster.sourceArtifactSha256);const c=restoreScaleOriginalController(source.raw),before=c.lab.snapshot({trails:false}),rows=[];
 try{for(const row of roster.rows){const lab=c.lab.fork();try{let steps=0;lab.world.step=()=>{steps++;throw Error('Original admission must not step');};lab.step=()=>{throw Error('Original admission must not step');};const result=lab.strike(c.state.selectedId,row.settings,{saveSnapshot:false});assert.equal(steps,0);assert.equal(!!lab.cue,result.ok);rows.push({row,result:structuredClone(result),nativeSteps:steps,createdCue:!!lab.cue});}finally{lab.dispose();}assert.deepEqual(c.lab.snapshot({trails:false}),before,'fresh fork never changes common source');}}
 finally{clearTimeout(c.noticeTimer);clearTimeout(c.predictionTimer);c.lab.dispose();}
 const sourceFiles={};for(const file of ['src/physics.js','src/controller.js','src/browser-initial-import/prepare-live-candidate.mjs','tests/resident-candidate-macro-scale-admission.mjs','tests/fixtures/resident-macro-scale-roster-v1.json','vendor/rapier.cjs'])sourceFiles[file]=sha(readFileSync(new URL('../'+file,import.meta.url)));
 const receipt={kind:'resident-macro-scale-original-no-step-admission-v1',sourceHead:execFileSync('git',['rev-parse','HEAD'],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8'}).trim(),rosterSha256:roster.rosterSha256,sourceArtifactSha256:source.artifactSha256,preStrikeIdentity:source.seed.sourceOrigin.preStrikeSnapshotSha256,rows,allNewRowsAccepted:rows.slice(6).every(x=>x.result.ok),nativeSteps:0,forwardOracleRun:false,numericalGpuExecuted:false,sourceFiles};
 mkdirSync(directory,{recursive:false});const data=JSON.stringify(receipt,null,2)+'\n';writeFileSync(join(directory,'admission-receipt.json'),data,{flag:'wx'});console.log(JSON.stringify({stage:'original-no-step-admission-terminal',receiptSha256:sha(data),directory,rows:rows.map(r=>({id:r.row.id,...r.result})),allNewRowsAccepted:receipt.allNewRowsAccepted}));return receipt;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){assert.equal(process.argv.length,3,'explicit fresh local output directory');await probeScaleOriginalAdmissions(resolve(process.argv[2]));}
