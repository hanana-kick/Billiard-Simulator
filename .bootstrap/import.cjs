'use strict';
const fs=require('node:fs'), path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const root=process.cwd();
const text=Array.from({length:10},(_,i)=>fs.readFileSync(path.join(__dirname,`part-${String(i).padStart(2,'0')}.b64`),'utf8')).join('');
const bytes=Buffer.from(text,'base64');
if(crypto.createHash('sha256').update(bytes).digest('hex')!=='f88f4693921a3b33feee23bff2f4732cebc6420ee60dd58ddf62448878e2e432')throw Error('Source transfer integrity failure');
const files=JSON.parse(zlib.brotliDecompressSync(bytes));
if(Object.keys(files).length!==83)throw Error('Unexpected file count');
for(const [name,content] of Object.entries(files)){
 if(typeof content!=='string'||name.includes('..')||name.startsWith('/')||name.startsWith('.git/')||name.startsWith('.github/'))throw Error('Invalid source path');
 const file=path.resolve(root,name);if(!file.startsWith(root+path.sep))throw Error('Path escaped root');
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);
}
console.log('Imported and SHA-256 verified 83 source files.');
