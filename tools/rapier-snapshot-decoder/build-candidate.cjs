'use strict';
// SPDX-License-Identifier: Apache-2.0
// Separate candidate only. Does not rebuild/overwrite the frozen native binary.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),required=k=>{if(!process.env[k])throw Error('Explicit '+k+' required');return path.resolve(process.env[k]);};
const source=JSON.parse(execFileSync(process.execPath,[path.join(__dirname,'build-native.cjs'),'--check-source'],{encoding:'utf8',env:process.env}));
if(process.argv.includes('--check-source')){console.log(JSON.stringify(source,null,2));process.exit(0);}
const cargoHome=required('CARGO_HOME'),rustupHome=required('RUSTUP_HOME'),target=required('CARGO_TARGET_DIR'),rapier=required('RAPIER_SOURCE_ROOT'),parry=required('PARRY_SOURCE_ROOT'),cargo=process.env.RAPIER_CARGO??path.join(cargoHome,'bin/cargo'),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const env={...process.env,CARGO_HOME:cargoHome,RUSTUP_HOME:rustupHome,CARGO_TARGET_DIR:target,CARGO_BUILD_JOBS:'1',CARGO_INCREMENTAL:'0',PATH:path.join(cargoHome,'bin')+path.delimiter+process.env.PATH};
execFileSync(cargo,['build','--locked','--bin','rapier-snapshot-browser-decoder','--manifest-path',path.join(root,'tools/rapier-snapshot-browser-exporter/Cargo.toml'),'--config','patch.crates-io.rapier3d.path='+JSON.stringify(path.join(rapier,'crates/rapier3d')),'--config','patch.crates-io.parry3d.path='+JSON.stringify(parry)],{env,cwd:root,stdio:'inherit'});
const binary=path.join(target,'debug/rapier-snapshot-browser-decoder');
const files=['tools/rapier-snapshot-exporter/src/main.rs',...['main.rs','lib.rs','shared.rs','bounded.rs'].map(file=>'tools/rapier-snapshot-browser-exporter/src/'+file),...['Cargo.toml','Cargo.lock'].map(file=>'tools/rapier-snapshot-browser-exporter/'+file),'tools/rapier-snapshot-decoder/candidate.cjs','tools/rapier-snapshot-decoder/codec.js','tools/rapier-snapshot-decoder/build-candidate.cjs'];
const provenance={schema:'rapier-readonly-native-candidate-provenance-v1',source,binary,binarySha256:hash(binary),exporter:JSON.parse(execFileSync(binary,['--version'],{encoding:'utf8'})),build:{rustc:execFileSync(path.join(cargoHome,'bin/rustc'),['-Vv'],{env,encoding:'utf8'}).trim(),sources:Object.fromEntries(files.map(file=>[file,hash(path.join(root,file))]))}};
fs.writeFileSync(path.join(target,'snapshot-native-candidate-provenance.json'),JSON.stringify(provenance,null,2)+'\n');console.log(JSON.stringify(provenance,null,2));
