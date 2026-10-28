/** Explicit CPU reference reproduction from 0850a4d, not a golden-refresh test.
 * Usage: node scripts/capture-frozen-raw-world-batch-reference.mjs /tmp/reference.json
 * Fixture scene is repacked and recorded with raw-scene/template SHA256.
 */
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const output=process.argv[2];if(!output)throw Error('Explicit output path required');
const stressCount=Number(process.argv[3]??33);if(![33,1024].includes(stressCount))throw RangeError('Reviewed stress widths: 33 or 1024');
const root=process.cwd(),temp=await mkdtemp(join(tmpdir(),'raw-world-cpu-0850a4d-'));
try{
 execFileSync('tar',['-x','-C',temp],{input:execFileSync('git',['archive','0850a4d','src/direct-candidate'],{maxBuffer:32*1024*1024})});
 let fixture=await readFile('tests/experimental-raw-world-batch-native.mjs','utf8');fixture=fixture.slice(0,fixture.indexOf("test('full raw"));
 fixture=fixture.replace(/^const frozenCPU=.*\n/m,'').replaceAll('../src/direct-candidate/',join(temp,'src/direct-candidate/')).replaceAll(join(temp,'src/direct-candidate/experimental-'),join(root,'src/direct-candidate/experimental-')).replaceAll('../vendor/',join(root,'vendor/')).replaceAll('../src/math.js',join(root,'src/math.js')).replaceAll('../src/physics.js',join(root,'src/physics.js'));
 fixture+=`\nimport {writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
const rawFixture=snapshotRawWorldBatch(batch([candidate(100,.5,0)]));
const sha=w=>createHash('sha256').update(new Uint8Array(w.buffer,w.byteOffset,w.byteLength)).digest('hex');
const cases=[candidate(100,.5,0),candidate(4294967294,.5,90),candidate(300,.5,330)].map(c=>{const x=cpu(c);return {id:c.candidateId,settings:c.settings,words:Array.from(x.words??[]),rawStatus:Array.from(x.out.rawHandoffStatus),compact:x.out.continuation?Array.from(x.out.continuation.compactResult):null,pairCount:x.out.continuation?.state[45],rest:x.out.continuation?.nominalRest}});
const stressCandidates=Array.from({length:${stressCount}},(_,i)=>candidate(1000+i,.5,[0,90,330][i%3]));
const stressWords=Uint32Array.from(stressCandidates.flatMap(c=>Array.from(cpu(c).words)));
const stress={wordStride:2916,candidates:stressCandidates.map(c=>({id:c.candidateId,settings:c.settings})),encoding:'gzip-native-little-endian-u32-base64',words:gzipSync(new Uint8Array(stressWords.buffer)).toString('base64')};
writeFileSync(${JSON.stringify(resolve(output))},JSON.stringify({sourceCommit:'0850a4d',fixture:'tests/experimental-raw-world-batch-native.mjs',sceneIdentity:request.sceneId,requestIdentity:request.requestKey,rawSceneSHA256:sha(rawFixture.rawScene),worldTemplateSHA256:sha(rawFixture.template),scope:'literal CPU words from recovered commit source, not current evolving CPU',cases,stress},null,2)+'\\n');
`;
 const file=join(temp,'capture.mjs');await writeFile(file,fixture);execFileSync(process.execPath,[file],{stdio:'inherit'});
 console.log(JSON.stringify({sourceCommit:'0850a4d',output:resolve(output)}));
}finally{await rm(temp,{recursive:true,force:true});}
