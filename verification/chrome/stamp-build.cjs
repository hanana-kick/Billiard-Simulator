'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(process.argv[2]),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const original=JSON.parse(fs.readFileSync(path.join(root,'verification/chrome/frozen-manifest.json')));
const sourceHashes={};for(const f of Object.keys(original.changedFiles))sourceHashes[f]=sha(fs.readFileSync(path.join(root,f)));
fs.writeFileSync(path.join(root,'precompute-integration-manifest.json'),JSON.stringify({...original,built:true,changedFiles:sourceHashes,compiledIndexSHA256:sha(fs.readFileSync(path.join(root,'dist/index.html'))),verificationRebuiltAt:new Date().toISOString()},null,2));
