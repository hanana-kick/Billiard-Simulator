import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
const root=process.cwd(),out=join(tmpdir(),'billiard-diagnostic-ui-'+createHash('sha256').update(root).digest('hex').slice(0,12));
await mkdir(out,{recursive:true});
await build({entryPoints:[resolve(root,'tests/fixtures/diagnostic-ui/entry.tsx')],outfile:join(out,'fixture.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',tsconfig:resolve(root,'tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'},logLevel:'warning'});
await writeFile(join(out,'index.html'),'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic diagnostic UI only</title><link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"><style>body{font-family:"Pretendard Variable",sans-serif;margin:24px;max-width:1000px}button{padding:8px;margin:8px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}h1{font-size:18px}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>');
console.log(JSON.stringify({kind:'synthetic-diagnostic-ui-fixture',out,component:'src/components/canonical-practice-entry.tsx',gpuValidation:false}));
if(process.argv.includes('--serve')){
 const files=new Map([['/', ['index.html','text/html; charset=utf-8']],['/fixture.js',['fixture.js','text/javascript; charset=utf-8']]]);
 const server=createServer(async(req,res)=>{const file=files.get(new URL(req.url,'http://localhost').pathname);if(!file){res.writeHead(404);res.end();return;}try{const bytes=await readFile(join(out,file[0]));res.writeHead(200,{'content-type':file[1],'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(bytes);}catch{res.writeHead(500);res.end();}});
 server.listen(8792,'127.0.0.1',()=>console.log('Diagnostic UI fixture http://127.0.0.1:8792'));
 for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>server.close(()=>process.exit(0)));
}
