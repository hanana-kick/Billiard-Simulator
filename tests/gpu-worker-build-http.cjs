'use strict';
// Real local static-server check; not a browser or GPU execution claim.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
test('opt-in dist serves complete nested worker graph with strict MIME and exact bytes',async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'dist/gpu-worker-assets/gpu-worker-build-manifest.json')));
 const child=spawn(process.execPath,['server.cjs'],{cwd:root,env:{...process.env,HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe']});
 try{
  const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Local server startup timeout')),10000);child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code));});child.stdout.on('data',data=>{const m=String(data).match(/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(timer);resolve(Number(m[1]));}});});
  const origin='http://127.0.0.1:'+port;
  const types={'.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm','.bin':'application/octet-stream','.txt':'text/plain; charset=utf-8'};
  for(const [file,info]of Object.entries(manifest.files)){
   const response=await fetch(origin+'/gpu-worker-assets/'+file);assert.equal(response.status,200,file);assert.equal(response.headers.get('content-type'),types[path.extname(file)],file);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
   const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,info.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),info.sha256);
  }
  const index=await(await fetch(origin+'/')).text();assert.ok(!index.includes('gpu-worker-assets/'),'Packaging does not activate/load worker assets in public page');
  assert.equal((await fetch(origin+'/gpu-worker-assets/not-present.mjs')).status,404);
 }finally{child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});}
});
