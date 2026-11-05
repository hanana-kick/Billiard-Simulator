'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const hashes=require('./experiment-source-hashes.json');
for(const [name,h]of Object.entries(hashes)){assert.equal(sha(path.join(__dirname,'baseline',name)),h.baseline);assert.equal(sha(path.join(__dirname,'../../src',name)),h.candidate);}
const h=require('./browser-prestrike-comparison.cjs');assert.equal(h.order.length,112);assert.deepEqual(h.order,require('./frozen-order.json'));
for(const cell of h.cells){const rows=h.order.filter(x=>x.recipe.name===cell.recipe.name&&x.dwellMs===cell.dwellMs&&x.changingAim===cell.changingAim);assert.equal(rows.length,8);assert.equal(rows.filter(x=>x.arm==='baseline').length,4);}
console.log('Both source arms and all112 frozen attempts verified');
