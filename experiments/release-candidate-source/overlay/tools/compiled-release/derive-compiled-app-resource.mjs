/** Build-only fresh-process owned admission. No GPU, physics or fixture execution. */
import fs from 'node:fs/promises';import path from 'node:path';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function deriveCompiledAppResource(c){
 if(!['search','selected'].includes(c.kind)||![1,3].includes(c.count)||c.kind==='selected'&&c.count!==1)throw Error('Closed compiled app profile required');
 for(const k of['artifactSHA256','compilerRevision','physicsSourceRevision'])if(!/^[a-f0-9]{64}$/.test(c[k]??''))throw Error('Independent expected '+k+' required');
 const base=path.resolve(c.runtimeRoot,'src/canonical-integer-transport'),bytes=new Uint8Array(await fs.readFile(c.artifactFile));if(sha(bytes)!==c.artifactSHA256)throw Error('External artifact pin mismatch');
 const expected={expectedSHA256:c.artifactSHA256,expectedCompilerRevision:c.compilerRevision,expectedSourceRevision:c.physicsSourceRevision,expectedCount:c.count};let pack,plan;
 if(c.kind==='search'){const a=await import(pathToFileURL(path.join(base,'program-artifact.mjs'))),p=await import(pathToFileURL(path.join(base,'resident-scheduler-plan.mjs')));pack=a.loadCanonicalProgramArtifact(bytes,expected);plan=p.createResidentSchedulerPlan(pack);a.assertCanonicalRuntimePack(pack);p.assertResidentSchedulerPlan(plan);}
 else{const a=await import(pathToFileURL(path.join(base,'selected-artifact.mjs'))),p=await import(pathToFileURL(path.join(base,'selected-scheduler-plan.mjs')));pack=a.loadSelectedArtifact(bytes,expected);plan=p.createSelectedSchedulerPlan(pack);a.assertSelectedRuntimePack(pack);p.assertSelectedSchedulerPlan(plan);}
 const bufferBytes=Array.from(plan.bufferBytes),readbackBytes=plan.readbackBytes,totalOwnedBytes=plan.totalOwnedBytes;
 if(bufferBytes.length!==10||bufferBytes.some(n=>!Number.isSafeInteger(n)||n<4||n%4)||!Number.isSafeInteger(readbackBytes)||bufferBytes.reduce((a,b)=>a+b,readbackBytes)!==totalOwnedBytes)throw Error('Exact owned fixed pool required');
 const ceiling=(c.kind==='selected'?24:c.count===3?16:8)*1024*1024;if(totalOwnedBytes>ceiling)throw Error('Fixed profile ceiling exceeded');
 return{kind:c.kind,count:c.count,compiledArtifactSHA256:c.artifactSHA256,compilerRevision:c.compilerRevision,sourceArtifacts:c.kind==='search'?{world:pack.worldArtifactSHA256,raw:pack.rawArtifactSHA256}:{selected:pack.selectedArtifactSHA256},bufferBytes,readbackBytes,totalOwnedBytes};
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){const c=JSON.parse(await fs.readFile(process.argv[2]));console.log(JSON.stringify(await deriveCompiledAppResource(c)));}
