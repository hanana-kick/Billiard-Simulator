'use strict';
// Synchronous build.cjs entry; child composes verified immutable source snapshots.
const path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
function buildCanonicalControllerAssets({root=path.resolve(__dirname,'..'),out}={}){
 assert.ok(out&&path.isAbsolute(out),'Explicit absolute output directory');
 const result=spawnSync(process.execPath,[path.join(__dirname,'build-canonical-controller-assets-verified.mjs'),root,out],{encoding:'utf8',maxBuffer:4*1024*1024});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error('Canonical verified asset build failed: '+(result.stderr||result.stdout||result.signal));
 return JSON.parse(result.stdout);
}
module.exports={buildCanonicalControllerAssets};
if(require.main===module){assert.equal(process.argv.length,3,'Usage: node tools/build-canonical-controller-assets.cjs /absolute/output');const m=buildCanonicalControllerAssets({out:process.argv[2]});console.log(JSON.stringify({bytes:m.bytes,sha256:m.sha256,activation:false,searchSourceRevision:m.searchSourceRevision}));}
