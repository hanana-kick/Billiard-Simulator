const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),sha=b=>createHash('sha256').update(b).digest('hex'),read=p=>fs.readFileSync(path.join(root,p)),json=p=>JSON.parse(read(p));
test('normal release wrapper selects compiled source builder without failure fallback',()=>{
 const s=read('tools/build-canonical-controller-assets.cjs').toString();assert.match(s,/build-release-assets\.mjs/);assert.match(s,/result.status!==0/);assert.doesNotMatch(s,/catch\s*\([^)]*\)\s*\{[^}]*verified/s);
 assert.equal(json('package.json').scripts.build,'node build.cjs');assert.equal(json('package.json').scripts['build:release'],'node build.cjs --canonical-controller-assets');
});
test('all original reviewed physical source and build inputs remain byte-exact',()=>{
 const p=json('tests/fixtures/live-world-upload-host-source-pin.json');for(const[n,s]of Object.entries(p.files))assert.equal(read(n).toString(),s,n);for(const[n,s]of Object.entries(p.buildInputs))assert.equal(sha(read(n)),s,n);
 assert.equal(sha(JSON.stringify({files:p.files,buildInputs:p.buildInputs})),'75c09c39e6d97085f4c4bf8045f0f892f121130d00340128101602de7df0e2df');
});
test('normal build serves exact compiled profiles, sealed controller and Worker',()=>{
 const base='dist/canonical-controller-assets/',m=json(base+'manifest.json'),r=json(base+'build-receipt.json');assert.equal(m.schema,'canonical-controller-assets-compiled-candidate-v1');assert.equal(m.activation,false);assert.equal(m.automaticDeviceRequest,false);assert.equal(m.defaultBackendUnchanged,true);
 assert.equal(r.runtimeRevision,'c30036bdf9efa60080e621a317ec07ceb60a9c8dd053b6bf57c6c9ddff4b5142');assert.equal(r.resourceReceiptSHA256,'6ec66cc647a7a6a7946e68434adfac6864447f045a534e3c68377e1502cfad96');
 assert.equal(sha(read(base+m.entrypoint)),m.sha256);const w=m.wasmGpuWorkerBootstrap;assert.equal(sha(read(base+w.file)),w.sha256);assert.equal(read(base+w.file).length,w.byteLength);
 for(const[k,pin]of Object.entries({'search-N1':'5173c9b81b22d026351eb73840e2e84a128e7b8659cd272299a70e31163f080b','search-N3':'80c7e07360aefc859997162a3759456176583315aac1bd84857a0ed893fb55f1','selected-N1':'226b524d67368b15795a11ccc071351a86d6ffa19315da3c3149348a4a922d31'}))assert.equal(sha(read(base+'wasm-gpu-programs/compiled-'+k+'.bin')),pin);
 assert.match(read('dist/index.html').toString(),/CANONICAL_GPU_ENTRY_AVAILABLE=true/);
});
