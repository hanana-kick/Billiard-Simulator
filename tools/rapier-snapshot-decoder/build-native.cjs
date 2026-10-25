'use strict';
// SPDX-License-Identifier: Apache-2.0
// Explicit, reproducible native exporter build. Never silently substitutes a
// registry Rapier release for the source revision used by the JS/WASM engine.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),revision='b716d375efc0201003f0cd9ef7168eee0b62c177';
const required=name=>{const value=process.env[name];if(!value)throw Error('Set '+name+' to your prepared source/build path');return path.resolve(value);};
const rapier=required('RAPIER_SOURCE_ROOT'),rapierArchive=required('RAPIER_SOURCE_ARCHIVE'),parry=required('PARRY_SOURCE_ROOT'),parryArchive=required('PARRY_SOURCE_ARCHIVE');
const check=String.raw`import hashlib,json,pathlib,sys,tarfile
archive,source,expected=sys.argv[1:]
archive=pathlib.Path(archive); source=pathlib.Path(source)
digest=hashlib.sha256(archive.read_bytes()).hexdigest()
if digest != expected: raise SystemExit('Official source archive SHA256 mismatch: '+str(archive))
manifest=[]
with tarfile.open(archive,'r:gz') as tf:
 for member in tf:
  if not member.isfile(): continue
  name=pathlib.PurePosixPath(member.name)
  if name.suffix!='.rs' and name.name not in ('Cargo.toml','LICENSE','LICENSE-APACHE'): continue
  relative=pathlib.Path(*name.parts[1:]); original=tf.extractfile(member).read(); local=source/relative
  if not local.is_file() or local.read_bytes()!=original: raise SystemExit('Source contents differ from official archive: '+str(local))
  manifest.append((str(relative),hashlib.sha256(original).hexdigest()))
if not manifest: raise SystemExit('No source files verified')
manifest.sort(); proof=hashlib.sha256(json.dumps(manifest,separators=(',',':')).encode()).hexdigest()
print(json.dumps({'archiveSha256':digest,'verifiedSourceFiles':len(manifest),'sourceManifestSha256':proof}))`;
function verify(archive,source,sha){return JSON.parse(execFileSync('python3',['-c',check,archive,source,sha],{encoding:'utf8',maxBuffer:1024*1024}));}
const provenance={sourceRevision:revision,rapier:verify(rapierArchive,rapier,'67825e5487ff84582777132f1ede42e8b865984246825ba9de6ff07ed2a8fdb1'),parry:verify(parryArchive,parry,'7b626edc0b497dba4bdf6e1e0797895294ed9f61dac2bd28cb5d34d37ad2ca7e'),features:['serde-serialize','enhanced-determinism','debug-render','profiler','fem']};
if(process.argv.includes('--check-source')){console.log(JSON.stringify(provenance,null,2));process.exit(0);}
const cargoHome=required('CARGO_HOME'),rustupHome=required('RUSTUP_HOME'),target=required('CARGO_TARGET_DIR'),cargo=process.env.RAPIER_CARGO??path.join(cargoHome,'bin/cargo'),env={...process.env,CARGO_HOME:cargoHome,RUSTUP_HOME:rustupHome,CARGO_TARGET_DIR:target,CARGO_BUILD_JOBS:'1',PATH:path.join(cargoHome,'bin')+path.delimiter+process.env.PATH};
provenance.rustc=execFileSync(path.join(cargoHome,'bin/rustc'),['-Vv'],{env,encoding:'utf8'}).trim();
execFileSync(cargo,['build','--locked','--manifest-path',path.join(root,'tools/rapier-snapshot-exporter/Cargo.toml'),'--config','patch.crates-io.rapier3d.path='+JSON.stringify(path.join(rapier,'crates/rapier3d')),'--config','patch.crates-io.parry3d.path='+JSON.stringify(parry)],{env,cwd:root,stdio:'inherit'});
const binary=path.join(target,'debug/rapier-snapshot-decoder');provenance.binary=binary;provenance.exporter=JSON.parse(execFileSync(binary,['--version'],{encoding:'utf8'}));fs.writeFileSync(path.join(target,'snapshot-decoder-provenance.json'),JSON.stringify(provenance,null,2)+'\n');console.log(JSON.stringify(provenance,null,2));
