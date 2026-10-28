/** Reproduce frozen physics with ONLY two checked host-domain guard extensions.
 * Requires explicit output path; never refreshes shader pins or runtime defaults.
 */
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const output=process.argv[2];if(!output)throw Error('Explicit output path required');
const root=process.cwd(),temp=await mkdtemp(join(tmpdir(),'raw-world-host128-'));
try{
 execFileSync('tar',['-x','-C',temp],{input:execFileSync('git',['archive','0850a4d','src/direct-candidate'],{maxBuffer:32*1024*1024})});
 const patch=[];
 for(const [name,old,replacement,expected]of [['canonical-world-continuation.mjs','maxWorldSteps>66','maxWorldSteps>128','ec61db35667008c9942d95524892609867eac87e743a9420ebce9402b55d0abc'],['deterministic-recurring-world.mjs','options.maxWorldSteps>66','options.maxWorldSteps>128','fd1af44ac621cc61620d2468480f2d3b76fd464a0ea8aa556c2c53bb8b19fb66']]){
  const path=join(temp,'src/direct-candidate',name),source=await readFile(path,'utf8'),sha=s=>createHash('sha256').update(s).digest('hex');
  if(sha(source)!==expected||source.split(old).length!==2)throw Error('Host extension source drift');
  const changed=source.replace(old,replacement);patch.push({path:name,beforeSHA256:sha(source),afterSHA256:sha(changed),exactReplacement:[old,replacement]});await writeFile(path,changed);
 }
 let fixture=await readFile('tests/experimental-raw-world-batch-goal.mjs','utf8');fixture=fixture.slice(0,fixture.indexOf('const shot='));
 fixture=fixture.replace("new URL('../artifacts/raw-world-batch/host128-goal-cpu-reference.json',import.meta.url)",JSON.stringify(join(root,'artifacts/raw-world-batch/host128-goal-cpu-reference.json'))).replaceAll('../src/direct-candidate/',join(temp,'src/direct-candidate/')).replaceAll(join(temp,'src/direct-candidate/experimental-'),join(root,'src/direct-candidate/experimental-')).replaceAll('../vendor/',join(root,'vendor/')).replaceAll('../src/math.js',join(root,'src/math.js')).replaceAll('../src/physics.js',join(root,'src/physics.js'));
 fixture+=`\nimport {writeFileSync} from 'node:fs';
import {preparedWorldWords} from ${JSON.stringify(join(temp,'src/direct-candidate/deterministic-prepared-world-gpu.mjs'))};
import {prepareCanonicalWorldContinuation,runCanonicalRawWorldContinuationCPU} from ${JSON.stringify(join(temp,'src/direct-candidate/canonical-world-continuation.mjs'))};
const binding=prepareCanonicalWorldContinuation(request,rawBinding.shotClock,{sceneKey:11,requestKey:23,...batchBinding.localOptions});
const shot=createCanonicalCandidate(request,100,goalCPU.shot),rawBatch=prepareRawWorldBatch(rawBinding,[shot],{maximumSteps:2048}),rawFixture=snapshotRawWorldBatch(rawBatch),result=runCanonicalRawWorldContinuationCPU(binding,rawBatch),c=result.continuation;
const sha=w=>createHash('sha256').update(new Uint8Array(w.buffer,w.byteOffset,w.byteLength)).digest('hex');
const reference={sourceCommit:'0850a4d',pipelineRevision:'0850a4d+host128-v1',hostAdmissionPatch:${JSON.stringify(patch)},positions:goalCPU.positions,shot:goalCPU.shot,rawSceneSHA256:sha(rawFixture.rawScene),worldTemplateSHA256:sha(rawFixture.template),words:Array.from([...preparedWorldWords(c),...c.journalWords,...c.journalAuxWords,...c.ruleState,...c.compactResult,...result.rawHandoffStatus]),compact:Array.from(c.compactResult),state:Array.from(c.state.slice(0,8)),ruleOrigin:c.ruleTimeOrigin};
writeFileSync(${JSON.stringify(resolve(output))},JSON.stringify(reference,null,2)+'\\n');
`;
 const path=join(temp,'capture.mjs');await writeFile(path,fixture);execFileSync(process.execPath,[path],{stdio:'inherit'});console.log(JSON.stringify({pipelineRevision:'0850a4d+host128-v1',output:resolve(output)}));
}finally{await rm(temp,{recursive:true,force:true});}
