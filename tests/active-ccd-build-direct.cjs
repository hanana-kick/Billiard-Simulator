'use strict';
// SPDX-License-Identifier: Apache-2.0
// Preserve prior decoder and inactive-CCD probe while building a distinct target.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),root=path.resolve(__dirname,'..');
const required=k=>{if(!process.env[k])throw Error('Explicit '+k+' required');return path.resolve(process.env[k]);},hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const source=JSON.parse(execFileSync(process.execPath,[path.join(root,'tools/rapier-snapshot-decoder/build-native.cjs'),'--check-source'],{env:process.env,encoding:'utf8'}));
const cargoHome=required('CARGO_HOME'),rustupHome=required('RUSTUP_HOME'),target=required('CARGO_TARGET_DIR'),rapier=required('RAPIER_SOURCE_ROOT'),parry=required('PARRY_SOURCE_ROOT');
const old=['rapier-snapshot-decoder','rapier-ccd-probe'].map(name=>path.join(target,'debug',name)).filter(p=>fs.existsSync(p)),before=old.map(p=>hash(fs.readFileSync(p)));
const env={...process.env,CARGO_HOME:cargoHome,RUSTUP_HOME:rustupHome,CARGO_TARGET_DIR:target,CARGO_BUILD_JOBS:'1',PATH:path.join(cargoHome,'bin')+path.delimiter+process.env.PATH};
execFileSync(path.join(cargoHome,'bin/cargo'),['build','--offline','--locked','--bin','rapier-active-ccd-probe','--manifest-path',path.join(root,'tools/rapier-snapshot-exporter/Cargo.toml'),'--config','patch.crates-io.rapier3d.path='+JSON.stringify(path.join(rapier,'crates/rapier3d')),'--config','patch.crates-io.parry3d.path='+JSON.stringify(parry)],{env,cwd:root,stdio:'inherit'});
old.forEach((p,i)=>{if(hash(fs.readFileSync(p))!==before[i])throw Error('Existing native oracle changed: '+p);});const binary=path.join(target,'debug/rapier-active-ccd-probe');
const provenance={schema:'active-ccd-direct-probe-build-v1',source,binary,binarySha256:hash(fs.readFileSync(binary)),hostSourceSha256:hash(fs.readFileSync(path.join(root,'tools/rapier-snapshot-exporter/src/bin/rapier-active-ccd-probe.rs'))),parryVersion:'0.31.1',proxyDistanceSourceSha256:hash(fs.readFileSync(path.join(parry,'src/query/sweep_toi/proxy_distance.rs'))),originalOracleBinariesUnchanged:true};console.log(JSON.stringify(provenance,null,2));
