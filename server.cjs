'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'dist'),port=Number(process.env.PORT||8787),host=process.env.HOST||'0.0.0.0';
const types={'.html':'text/html; charset=utf-8','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{
 let file;try{const url=new URL(req.url,'http://localhost');const pathname=decodeURIComponent(url.pathname);file=path.resolve(root,'.'+pathname);if(file===root||pathname.endsWith('/'))file=path.join(file,'index.html');}catch{res.writeHead(400).end('Bad request');return;}
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end('Forbidden');return;}
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end('Not found');return;}
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-cache');
 fs.createReadStream(file).pipe(res);
});
server.listen(port,host,()=>console.log(`Cue Lab listening on ${host}:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
