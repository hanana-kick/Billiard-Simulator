'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>fs.readFileSync(path.join(root,p)),git=(...args)=>execFileSync('git',args,{cwd:root});
const p=JSON.parse(read('verification/contact-graph/provenance.json')),expected=JSON.parse(read('verification/contact-graph/experiment-source-hashes.json'));
assert.equal(git('rev-parse','HEAD^').toString().trim(),p.base,'Verification commit must be direct child of frozen baseline');
assert.equal(sha(read('verification/contact-graph/algorithm-browser-recipes.json')),p.recipeSHA256);
assert.equal(p.recipeSHA256,'9d20db87a3996e6938fbc8be0ee97b32cbfcd3206d92923ed627d7712973195d');
assert.equal(sha(read('verification/contact-graph/baseline-inverse-events.js')),expected['inverse-events.js'].baseline);
assert.deepEqual(read('verification/contact-graph/baseline-inverse-events.js'),git('show',p.base+':src/inverse-events.js'));
const files=[];function scan(d=''){for(const n of fs.readdirSync(path.join(root,'src',d))){const f=path.posix.join(d,n);if(fs.statSync(path.join(root,'src',f)).isDirectory())scan(f);else files.push(f);}}scan();
assert.deepEqual(files.sort(),Object.keys(p.baselineSourceHashes).sort());
for(const f of files){assert.equal(sha(git('show',p.base+':src/'+f)),p.baselineSourceHashes[f]);assert.equal(sha(read('src/'+f)),expected[f]?.candidate??p.baselineSourceHashes[f],f);}
assert.equal(sha(read('src/inverse-events.js')),'a645a2c42c5dc4efecec8c4c7c5673f980c70890a7965af8a4fd51ee21d8ddae');
const allowed=JSON.parse(read('verification/contact-graph/planned-paths.json'));
assert.deepEqual(git('diff','--name-only',p.base,'HEAD').toString().trim().split('\n').sort(),allowed.sort());
assert.equal(git('status','--porcelain','--untracked-files=no').toString().trim(),'');
console.log('Frozen baseline, exact source delta, recipes and verification-only commit scope verified');
