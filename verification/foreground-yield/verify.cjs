'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),h=require('./browser-foreground-yield.cjs');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const hashes=require('./experiment-source-hashes.json');
for(const [file,v]of Object.entries(hashes)){assert.equal(sha(path.join(__dirname,'baseline',file)),v.baseline);assert.equal(sha(path.join(__dirname,'../../src',file)),v.candidate);}
assert.deepEqual(Object.keys(hashes),['optimizer-service.js']);assert.equal(h.order.length,32);assert.deepEqual(h.order,require('./frozen-order.json'));
for(const c of h.cells){const r=h.order.filter(x=>x.recipe.name===c.recipe.name&&x.dwellMs===c.dwellMs&&x.changingAim===c.changingAim);assert.equal(r.length,4);assert.equal(r.filter(x=>x.arm==='baseline').length,2);}
console.log('32 frozen foreground task-yield attempts and source hashes verified');
