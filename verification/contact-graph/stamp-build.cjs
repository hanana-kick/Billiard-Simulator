'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(process.argv[2]),arm=process.argv[3];assert(['baseline','candidate'].includes(arm));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const provenance=JSON.parse(fs.readFileSync(path.join(root,'verification/contact-graph/provenance.json')));
const sourceHashes=Object.fromEntries(Object.keys(provenance.baselineSourceHashes).map(f=>[f,sha(path.join(root,'src',f))]));
fs.writeFileSync(path.join(root,'precompute-integration-manifest.json'),JSON.stringify({experiment:'contact-graph',arm,base:provenance.base,built:true,sourceHashes,recipeSHA256:provenance.recipeSHA256,compiledIndexSHA256:sha(path.join(root,'dist/index.html')),verificationRebuiltAt:new Date().toISOString()},null,2)+'\n');
