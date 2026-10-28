import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=resolve(process.argv[2]??'/tmp/billiard-hardware-benchmark');
const {createCPU}=await import(pathToFileURL(resolve(dir,'cpu-check.mjs')));
const fixture=JSON.parse(readFileSync(resolve(dir,'fixture.json'))),bytes=readFileSync(resolve(dir,'reference.bin')),reference=new Uint32Array(bytes.buffer,bytes.byteOffset,bytes.length/4),cpu=createCPU(fixture);
for(const n of [1,3,32]){const t=performance.now(),r=cpu(n);assert.deepEqual(r.words,reference.slice(0,n*2916));assert.deepEqual(cpu(n,false).compact,r.compact);console.log(JSON.stringify({n,comparedWords:r.words.length,exact:true,testWallMs:performance.now()-t,hardwareClaim:false}));}
