'use strict';
// A new host/binary only. Existing instrumented source and verified binaries are read-only.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),hash=p=>sha(fs.readFileSync(p));
const need=k=>{assert.ok(process.env[k],`Explicit ${k} required`);return path.resolve(process.env[k]);};
function manifest(dir){const out=[];function walk(at,rel=''){for(const e of fs.readdirSync(at,{withFileTypes:true})){if(['.git','target'].includes(e.name))continue;const r=path.join(rel,e.name),p=path.join(at,e.name);if(e.isDirectory())walk(p,r);else if(e.name.endsWith('.rs')||['Cargo.toml','LICENSE','LICENSE-APACHE'].includes(e.name))out.push([r,hash(p)]);}}walk(dir);return out.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);}
function main(){
 const referenceFile=need('LIVE_CUE_UI_BUILD_REFERENCE'),original=need('RAPIER_SOURCE_ROOT'),source=need('LIVE_CUE_UI_SOURCE_COPY'),parry=need('PARRY_SOURCE_ROOT'),host=need('LIVE_CUE_UI_PROBE_HOST'),target=need('CARGO_TARGET_DIR');
 const reference=JSON.parse(fs.readFileSync(referenceFile)),prior=reference.sourceBuild,oldBinary=prior.binary;
 assert.equal(hash(oldBinary),prior.binarySha256);assert.equal(prior.captureSha256,hash(path.join(root,'tests/active-ccd-source-probe/capture.rs')));assert.equal(prior.typedDecoderSha256,hash(path.join(root,'tools/rapier-snapshot-exporter/src/main.rs')));
 const originalManifest=manifest(original),parryManifest=manifest(parry);assert.equal(originalManifest.length,prior.original.rapier.verifiedSourceFiles);assert.equal(sha(JSON.stringify(originalManifest)),prior.original.rapier.sourceManifestSha256);assert.equal(parryManifest.length,prior.original.parry.verifiedSourceFiles);assert.equal(sha(JSON.stringify(parryManifest)),prior.original.parry.sourceManifestSha256);
 const expected=new Map(originalManifest);for(const c of prior.changes){assert.equal(expected.get(c.file)??null,c.originalSha256);expected.set(c.file,c.instrumentedSha256);}
 const expectedManifest=[...expected].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0),audit=()=>assert.deepEqual(manifest(source),expectedManifest,'Existing source copy must exactly match verified observation overlay');audit();
 for(const p of [original,source,parry,target,root])assert.ok(host!==p&&!host.startsWith(p+path.sep)&&!p.startsWith(host+path.sep),'New host must be isolated from all engine/source/target paths');
 const decoder=fs.readFileSync(path.join(root,'tools/rapier-snapshot-exporter/src/main.rs'),'utf8'),marker='fn main(){if let Err(e)=run(){eprintln!("native snapshot decoder: {e}");std::process::exit(1);}}';assert.equal(decoder.split(marker).length,2);
 const extension=fs.readFileSync(path.join(root,'tests/live-cue-ui-domain-source-probe-main.rs'),'utf8'),main=decoder.replace(marker,'')+'\n'+extension;
 const cargo=fs.readFileSync(path.join(root,'tools/rapier-snapshot-exporter/Cargo.toml'),'utf8').replace('[package]','[package]\nautobins = false')+'\n[[bin]]\nname = "live-cue-ui-domain-source-probe"\npath = "src/main.rs"\n';
 const lock=fs.readFileSync(path.join(root,'tools/rapier-snapshot-exporter/Cargo.lock'));
 if(!fs.existsSync(host)){fs.mkdirSync(path.join(host,'src'),{recursive:true});fs.writeFileSync(path.join(host,'src/main.rs'),main,{flag:'wx'});fs.writeFileSync(path.join(host,'Cargo.toml'),cargo,{flag:'wx'});fs.writeFileSync(path.join(host,'Cargo.lock'),lock,{flag:'wx'});}
 else {assert.equal(fs.readFileSync(path.join(host,'src/main.rs'),'utf8'),main);assert.equal(fs.readFileSync(path.join(host,'Cargo.toml'),'utf8'),cargo);assert.deepEqual(fs.readFileSync(path.join(host,'Cargo.lock')),lock);}
 const binary=path.join(target,'debug/live-cue-ui-domain-source-probe');assert.notEqual(binary,oldBinary);
 const proof={schema:'live-cue-ui-domain-source-build-v1',sourceRevision:prior.original.sourceRevision,referenceFile,referenceSha256:hash(referenceFile),priorSourceBuildSha256:sha(JSON.stringify(prior)),sourceCopy:source,originalSource:original,parrySource:parry,sourceManifestSha256:sha(JSON.stringify(expectedManifest)),sourceFilesUnchanged:true,originalSourceFilesUnchanged:true,oldBinary,oldBinarySha256:prior.binarySha256,host,hostSha256:sha(main),hostExtensionSha256:sha(extension),captureSha256:prior.captureSha256,typedDecoderSha256:prior.typedDecoderSha256,binary,buildScriptSha256:hash(__filename)};
 if(process.argv.includes('--prepare-only')){console.log(JSON.stringify({...proof,compiled:false},null,2));return;}
 assert.ok(!fs.existsSync(binary),'A new named binary is required; do not overwrite or retry implicitly');
 const cargoHome=need('CARGO_HOME'),rustupHome=need('RUSTUP_HOME'),cargoBin=process.env.RAPIER_CARGO??path.join(cargoHome,'bin/cargo'),env={...process.env,CARGO_HOME:cargoHome,RUSTUP_HOME:rustupHome,CARGO_TARGET_DIR:target,CARGO_BUILD_JOBS:'1',PATH:path.join(cargoHome,'bin')+path.delimiter+process.env.PATH};
 execFileSync(cargoBin,['build','--offline','--locked','--bin','live-cue-ui-domain-source-probe','--manifest-path',path.join(host,'Cargo.toml'),'--config','patch.crates-io.rapier3d.path='+JSON.stringify(path.join(source,'crates/rapier3d')),'--config','patch.crates-io.parry3d.path='+JSON.stringify(parry)],{env,stdio:'inherit'});
 audit();assert.deepEqual(manifest(original),originalManifest);assert.deepEqual(manifest(parry),parryManifest);assert.equal(hash(oldBinary),prior.binarySha256);assert.equal(hash(path.join(host,'src/main.rs')),proof.hostSha256);
 proof.binarySha256=hash(binary);proof.compiled=true;fs.writeFileSync(path.join(host,'build-provenance.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(proof,null,2));
}
if(require.main===module)main();
module.exports={manifest};
