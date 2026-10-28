/** Explicit snapshot maintenance tool, NOT part of app build/runtime.
 * Usage: node scripts/capture-raw-world-batch-sources.mjs /tmp/captured.mjs
 * Always captures the reviewed 0850a4d tree, never HEAD or working sources.
 * Does not refresh audit pins: source changes require independent review.
 */
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const output=process.argv[2];if(!output)throw Error('Explicit output path required');
const temp=await mkdtemp(join(tmpdir(),'raw-world-0850a4d-'));
try{
 const archive=execFileSync('git',['archive','0850a4d','src/direct-candidate'],{maxBuffer:32*1024*1024});
 execFileSync('tar',['-x','-C',temp],{input:archive});
 const dir=join(temp,'src/direct-candidate'),world=await readFile(join(dir,'deterministic-prepared-world-gpu.mjs'),'utf8');
 const begin=world.indexOf('const codes=['),end=world.indexOf(',pipelines=[],start=performance.now()',begin),updates=world.slice(world.indexOf('codes[14]='),world.indexOf('device.pushErrorScope'));
 await writeFile(join(dir,'extract.mjs'),world.slice(0,world.indexOf('const Q='))+'\nexport function codes(){'+world.slice(begin,end)+';'+updates+'return codes;}\n');
 const microPath=join(dir,'deterministic-microtail-world-gpu.mjs'),micro=await readFile(microPath,'utf8'),mb=micro.indexOf('const codes=['),me=micro.indexOf(',pipelines=[]',mb);
 await writeFile(microPath,micro+'\nexport function extractMicroCodes(){'+micro.slice(mb,me)+';return codes;}\n');
 for(const name of ['canonical-journal-rules.mjs','canonical-raw-journal-prefix.mjs']){const path=join(dir,name);await writeFile(path,await readFile(path,'utf8')+'\nexport {WGSL as extractWGSL};\n');}
 const get=name=>import(pathToFileURL(join(dir,name)).href);
 const [{codes},{extractMicroCodes},{WORLD_JOURNAL_WGSL},{extractWGSL:rules},{extractWGSL:prefix}]=await Promise.all(['extract.mjs','deterministic-microtail-world-gpu.mjs','canonical-world-journal.mjs','canonical-journal-rules.mjs','canonical-raw-journal-prefix.mjs'].map(get));
 const list=[...codes().map((source,index)=>({family:'world',index,source})),...extractMicroCodes().map((source,index)=>({family:'micro',index,source})),{family:'journal',index:0,source:WORLD_JOURNAL_WGSL},{family:'prefix',index:0,source:prefix},{family:'rules',index:0,source:rules}].map(s=>({...s,sha256:createHash('sha256').update(s.source).digest('hex')}));
 await writeFile(resolve(output),'/** Immutable generated WGSL snapshot from 0850a4d. No defaults changed.\n * Source provenance and ownership review: experimental-raw-world-batch-audit.mjs.\n * Do not refresh implicitly from moving single-world modules. */\nexport const RAW_WORLD_BATCH_SOURCE_COMMIT="0850a4d";\nexport const RAW_WORLD_BATCH_SOURCES=Object.freeze('+JSON.stringify(list)+'.map(Object.freeze));\n');
 console.log(JSON.stringify({sourceCommit:'0850a4d',modules:list.length,sourceCharacters:list.reduce((sum,s)=>sum+s.source.length,0),output:resolve(output)}));
}finally{await rm(temp,{recursive:true,force:true});}
