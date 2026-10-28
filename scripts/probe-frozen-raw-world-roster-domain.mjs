/** Reproduce the old CPU roster-ID domain without importing evolving physics. */
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const output=process.argv[2];if(!output)throw Error('Explicit output path required');
const root=process.cwd(),temp=await mkdtemp(join(tmpdir(),'raw-world-roster-0850a4d-'));
try{
 execFileSync('tar',['-x','-C',temp],{input:execFileSync('git',['archive','0850a4d','src/direct-candidate'],{maxBuffer:32*1024*1024})});
 let fixture=await readFile('tests/experimental-raw-world-batch-native.mjs','utf8');fixture=fixture.slice(0,fixture.indexOf("test('full raw"));
 fixture=fixture.split('\n').filter(l=>!l.startsWith('const frozenCPU=')&&!l.includes('experimental-raw-world-batch-binding.mjs')&&!l.includes('experimental-raw-world-batch-gpu.mjs')&&!l.startsWith('const batchBinding=')).join('\n');
 fixture=fixture.replaceAll('../src/direct-candidate/',join(temp,'src/direct-candidate/')).replaceAll('../vendor/',join(root,'vendor/')).replaceAll('../src/math.js',join(root,'src/math.js')).replaceAll('../src/physics.js',join(root,'src/physics.js'));
 const cases=[];
 for(const stableRosterId of [8,0x7fffffff,0x80000000,0xffffffff]){
  const text=fixture.replace('tipX:.2,tipY:0','tipX:0,tipY:.2').replace('{id:8,p:','{id:'+stableRosterId+',p:').replace('firstId:8','firstId:'+stableRosterId)+`\ntry{const r=cpu(candidate(4294967294,.5,0));console.log(JSON.stringify({stableRosterId:${stableRosterId},candidateId:4294967294,outcome:'returned',rawStatus:Array.from(r.out.rawHandoffStatus),state:Array.from(r.out.continuation.state.slice(0,8)),compact:Array.from(r.out.continuation.compactResult)}));}catch(error){console.log(JSON.stringify({stableRosterId:${stableRosterId},candidateId:4294967294,outcome:'threw',name:error.name,message:error.message,stack:error.stack.split('\\n').slice(0,8).map(line=>line.replaceAll(${JSON.stringify(temp)},'<frozen0850a4d>'))}));}`;
  const file=join(temp,'probe-'+stableRosterId+'.mjs');await writeFile(file,text);const stdout=execFileSync(process.execPath,[file],{encoding:'utf8'});cases.push(JSON.parse(stdout.trim().split('\n').at(-1)));
 }
 const source=await readFile(join(temp,'src/direct-candidate/deterministic-recurring-world.mjs'));
 const result={sourceCommit:'0850a4d',sourceSHA256:createHash('sha256').update(source).digest('hex'),fixture:'actual raw angle0/elevation25/speed.5/tipX0/tipY.2 hit in same four-ball scene, changed first red stable ID only; candidate ID remains4294967294',cases};
 await writeFile(resolve(output),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await rm(temp,{recursive:true,force:true});}
