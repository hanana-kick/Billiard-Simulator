const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const hashes=JSON.parse(fs.readFileSync(path.join(__dirname,'experiment-source-hashes.json')));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const [name,h] of Object.entries(hashes)){assert.equal(sha(path.join(__dirname,'pressure-baseline',name)),h.baseline);assert.equal(sha(path.join(__dirname,'../../src',name)),h.candidate);}
console.log('All baseline/candidate pressure source hashes verified');
