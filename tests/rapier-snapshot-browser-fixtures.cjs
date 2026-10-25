'use strict';
// Read-only extraction of already captured native snapshots. These immutable
// artifact hashes are not regenerated to accommodate candidate source changes.
const fs=require('node:fs'),v8=require('node:v8'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const PINNED={
 real3:{sha256:'d7e975fac9b6c9de487c5104ad987c5e7431c3d4e7ef5b29c3b120f6bd5e9ea8',boundaries:['before','created']},
 fresh4:{sha256:'b5f71e27d9dad8aec70ccc3cb17a8001ac199540de8f6f44a802943377926187',boundaries:['modeCreated','strikeCreated']},
 settled4:{sha256:'270000ebe58d2e51f83484917425cb2999425e39a215c2c11620d56d743d591c',boundaries:['firstShot.physicalRest','secondStrikeCreated']},
 moved4:{sha256:'f20c802c0d6ef4f91263dd607c1b6317d0ec07c4fad3eb63cb67a4c21f5baf98',boundaries:['beforeStrike','goalStrikeCreated']},
};
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function fixtures(){
 assert.ok(process.env.RAPIER_BROWSER_SOURCE_INDEX,'Explicit RAPIER_BROWSER_SOURCE_INDEX JSON required');
 const files=JSON.parse(fs.readFileSync(process.env.RAPIER_BROWSER_SOURCE_INDEX,'utf8')),result=[];
 for(const [kind,pin]of Object.entries(PINNED)){
   assert.equal(typeof files[kind],'string',kind+' original source path required');
   const file=files[kind],bytes=fs.readFileSync(file),sourceSha256=hash(bytes);
   assert.equal(sourceSha256,pin.sha256,'Original artifact bytes unchanged: '+kind);
   const source=v8.deserialize(bytes),manifestPath=file+'.json';let manifest=null;
   if(kind!=='real3'){
     manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
     assert.equal(manifest.sha256,sourceSha256,'Original artifact manifest matches bytes');assert.equal(manifest.bytes,bytes.length);
   }
   for(const name of pin.boundaries){
     const row=kind==='real3'?source[name]:source.boundaries[name];
     assert.ok(row.snapshot instanceof Uint8Array,'Genuine captured snapshot exists');
     assert.equal(row.sourceRevision,'b716d375efc0201003f0cd9ef7168eee0b62c177');
     assert.equal(row.engineSha256,'fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4');
     assert.equal(hash(row.snapshot),row.snapshotSha256);
     if(manifest?.boundarySnapshots)assert.equal(manifest.boundarySnapshots[name],row.snapshotSha256);
     result.push({label:kind+'.'+name,bytes:new Uint8Array(row.snapshot),snapshotSha256:row.snapshotSha256,source:{path:file,sha256:sourceSha256,manifestPath:manifest?manifestPath:null,manifestSha256:manifest?hash(fs.readFileSync(manifestPath)):null,archivedIdentity:manifest?.identity??source.sourceHashes},expectedState:row.typedState??null});
   }
 }
 return result;
}
module.exports={fixtures,hash,PINNED,ORIGINAL_BINARY_SHA256:'0bbebced302953113abd7c428d7b66a7a8a9b7d293fe4108c8d67dc06a824d82'};
