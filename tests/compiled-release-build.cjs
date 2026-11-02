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
 assert.equal(r.runtimeRevision,'d53ccaebe31d3d710226f2f03d23eb95b00db8af0c4ce13c4c8d187ee3f35e26');assert.equal(r.resourceReceiptSHA256,'e82ef4b8c72cfe4a22581f45008ab9f0029b59554fbf777a3af1ccb2fe2d9437');
 assert.equal(r.physicsSourceRevision,'75c09c39e6d97085f4c4bf8045f0f892f121130d00340128101602de7df0e2df');
 assert.equal(sha(read(base+'wasm-gpu-programs/compiled-resource-receipt.json')),r.resourceReceiptSHA256);
 const selected=json(base+'wasm-gpu-programs/compiled-selected-N1.json');assert.equal(sha(read(base+'wasm-gpu-programs/compiled-selected-N1.json')),'d66442e8ade1f7bd242e1b82f217bb8ea487f3f8aabc9b8d41aecd3f16623de3');assert.equal(selected.kind,'experimental-native-selected-manifest-v1');assert.equal(selected.physicsSourceRevision,r.physicsSourceRevision);assert.equal(selected.runtimeRevision,r.runtimeRevision);assert.equal(selected.transformRevision,'f4d43d5163e912d60169c72b9ee3a03bed399f3d716be013a7e1927673dbe0c9');assert.equal(selected.program.selectedArtifactSHA256,'11e20cdbda4bf68e65679c8a3bde9dac91cbb9525ef9f7c1cc7e359b4f3d5862');
 assert.equal(sha(read(base+m.entrypoint)),m.sha256);const w=m.wasmGpuWorkerBootstrap;assert.equal(sha(read(base+w.file)),w.sha256);assert.equal(read(base+w.file).length,w.byteLength);
 for(const[k,pin]of Object.entries({'search-N1':'5173c9b81b22d026351eb73840e2e84a128e7b8659cd272299a70e31163f080b','search-N3':'80c7e07360aefc859997162a3759456176583315aac1bd84857a0ed893fb55f1','selected-N1':'1a25d028c347bce2b081fa717b028ff102f9f2c26f7a24c44918065f7d609bec'}))assert.equal(sha(read(base+'wasm-gpu-programs/compiled-'+k+'.bin')),pin);
 assert.match(read('dist/index.html').toString(),/CANONICAL_GPU_ENTRY_AVAILABLE=true/);
});
