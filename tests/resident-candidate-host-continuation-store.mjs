// HOST evidence transport only. No VM, source-state, physics or expected-state
// mutation is performed here. Hash-addressed files are never overwritten.
import assert from 'node:assert/strict';
import {existsSync,lstatSync,mkdirSync,readdirSync,readFileSync,writeFileSync,renameSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),digest=/^[0-9a-f]{64}$/;
export function saveHostContinuation({dir,bytes,expectedPreviousSha256=null,capacity=8}){
 assert.equal(typeof dir,'string');assert.ok(bytes instanceof Uint8Array&&bytes.byteLength>0,'serialized owned HOST continuation bytes');assert.ok(Number.isInteger(capacity)&&capacity>=1&&capacity<=64,'explicit bounded diagnostic retention');assert.ok(expectedPreviousSha256===null||digest.test(expectedPreviousSha256),'explicit predecessor receipt hash');
 const pointer=join(dir,'continuation.v8'),archiveDir=join(dir,'host-continuations'),nextHash=sha(bytes);let previous=null,previousHash=null;
 if(existsSync(pointer)){assert.ok(lstatSync(pointer).isFile()&&!lstatSync(pointer).isSymbolicLink(),'owned regular HOST pointer required');previous=readFileSync(pointer);previousHash=sha(previous);assert.equal(previousHash,expectedPreviousSha256,'exact predecessor receipt required before any overwrite');}else assert.equal(expectedPreviousSha256,null,'missing predecessor cannot be fabricated');
 if(existsSync(archiveDir))assert.ok(lstatSync(archiveDir).isDirectory()&&!lstatSync(archiveDir).isSymbolicLink(),'owned archive directory required');
 const files=existsSync(archiveDir)?readdirSync(archiveDir):[];for(const name of files){assert.match(name,/^[0-9a-f]{64}\.v8$/,'only hash-addressed owned continuations in retention directory');assert.ok(lstatSync(join(archiveDir,name)).isFile()&&!lstatSync(join(archiveDir,name)).isSymbolicLink(),'owned regular archive file required');}
 const wanted=new Map([[nextHash,bytes]]);if(previous)wanted.set(previousHash,previous);const fresh=[...wanted.keys()].filter(hash=>!files.includes(hash+'.v8'));assert.ok(files.length+fresh.length<=capacity,'HOST continuation retention capacity exhausted; pointer is untouched and nothing is silently deleted');
 // Existing archives are immutable even when the new checkpoint is identical.
 for(const[hash,content]of wanted){const path=join(archiveDir,hash+'.v8');if(existsSync(path)){const saved=readFileSync(path);assert.equal(sha(saved),hash,'immutable predecessor archive hash mismatch');assert.deepEqual(saved,Buffer.from(content),'immutable archived bytes');}}
 mkdirSync(archiveDir,{recursive:true});for(const hash of fresh)writeFileSync(join(archiveDir,hash+'.v8'),wanted.get(hash),{flag:'wx'});
 // Both predecessor and successor now survive a failed pointer replacement.
 const temporary=join(dir,'.continuation-next-'+randomUUID());try{writeFileSync(temporary,bytes,{flag:'wx'});assert.equal(sha(readFileSync(temporary)),nextHash);renameSync(temporary,pointer);}finally{if(existsSync(temporary))unlinkSync(temporary);}
 return{kind:'bounded-immutable-host-continuation-retention-v1',sha256:nextHash,previousSha256:previousHash,archivePath:join(archiveDir,nextHash+'.v8'),previousArchivePath:previousHash?join(archiveDir,previousHash+'.v8'):null,retainedCount:files.length+fresh.length,capacity,sourceEvolution:false};
}
