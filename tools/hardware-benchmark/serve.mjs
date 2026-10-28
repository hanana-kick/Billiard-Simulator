import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(process.argv[2]??'/tmp/billiard-hardware-benchmark'),port=Number(process.env.PORT??4179);
const files=new Map([['/','index.html'],['/index.html','index.html'],['/worker.js','worker.js'],['/fixture.json','fixture.json'],['/manifest.json','manifest.json'],['/reference.bin','reference.bin']]);
createServer(async(req,res)=>{const file=files.get(new URL(req.url,'http://localhost').pathname);if(req.method!=='GET'||!file){res.writeHead(404);res.end();return;}try{const bytes=await readFile(resolve(root,file));res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'application/octet-stream','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'"});res.end(bytes);}catch{res.writeHead(404);res.end();}}).listen(port,'127.0.0.1',()=>console.log(`Local only: http://127.0.0.1:${port}`));
