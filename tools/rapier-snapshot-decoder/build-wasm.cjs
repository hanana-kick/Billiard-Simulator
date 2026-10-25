'use strict';
// SPDX-License-Identifier: Apache-2.0
// Explicit official-source build. Does not download sources/toolchains, publish
// artifacts, alter the original native binary, or enable the product GPU path.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),required=k=>{if(!process.env[k])throw Error('Explicit '+k+' required');return path.resolve(process.env[k]);};
const source=JSON.parse(execFileSync(process.execPath,[path.join(__dirname,'build-native.cjs'),'--check-source'],{encoding:'utf8',env:process.env}));
if(process.argv.includes('--check-source')){console.log(JSON.stringify(source,null,2));process.exit(0);}
const cargoHome=required('CARGO_HOME'),rustupHome=required('RUSTUP_HOME'),target=required('CARGO_TARGET_DIR'),rapier=required('RAPIER_SOURCE_ROOT'),parry=required('PARRY_SOURCE_ROOT'),cargo=process.env.RAPIER_CARGO??path.join(cargoHome,'bin/cargo');
const env={...process.env,CARGO_HOME:cargoHome,RUSTUP_HOME:rustupHome,CARGO_TARGET_DIR:target,CARGO_BUILD_JOBS:'1',CARGO_INCREMENTAL:'0',RUSTFLAGS:'-C link-arg=--max-memory=1073741824 -C link-arg=--initial-memory=16777216 -C link-arg=-z -C link-arg=stack-size=8388608',PATH:path.join(cargoHome,'bin')+path.delimiter+process.env.PATH};
execFileSync(cargo,['build','--locked','--release','--lib','--target','wasm32-unknown-unknown','--manifest-path',path.join(root,'tools/rapier-snapshot-browser-exporter/Cargo.toml'),'--config','patch.crates-io.rapier3d.path='+JSON.stringify(path.join(rapier,'crates/rapier3d')),'--config','patch.crates-io.parry3d.path='+JSON.stringify(parry)],{env,cwd:root,stdio:'inherit'});
// Link the static archive with only our raw ABI as roots. A cdylib also exports
// unrelated wasm-bindgen descriptors pulled by the unchanged profiler feature.
// Static linking avoids those roots without changing source types/features,
// running a post-link optimizer, or providing fake host imports.
const rustc=path.join(cargoHome,'bin/rustc'),rustcVersion=execFileSync(rustc,['-Vv'],{env,encoding:'utf8'}).trim(),sysroot=execFileSync(rustc,['--print','sysroot'],{env,encoding:'utf8'}).trim(),host=/^host: (.+)$/m.exec(rustcVersion)?.[1];
if(!host)throw Error('Rust toolchain host unavailable');
const linker=path.join(sysroot,'lib/rustlib',host,'bin/rust-lld'),archive=path.join(target,'wasm32-unknown-unknown/release/librapier_snapshot_browser_decoder.a'),wasmPath=path.join(target,'wasm32-unknown-unknown/release/rapier_snapshot_browser_decoder.wasm');
const abi=['snapshot_decoder_abi','snapshot_decoder_decode','snapshot_decoder_max_depth','snapshot_decoder_max_input','snapshot_decoder_max_nodes','snapshot_decoder_max_output','snapshot_decoder_output_len','snapshot_decoder_output_ptr','snapshot_decoder_prepare','snapshot_decoder_release'];
const linkArgs=['-flavor','wasm','--no-entry','--gc-sections','--stack-first','--max-memory=1073741824','--initial-memory=16777216','-z','stack-size=8388608','--export-memory',...abi.map(name=>'--export='+name),archive,'-o',wasmPath];
execFileSync(linker,linkArgs,{env,stdio:'inherit'});
const wasm=fs.readFileSync(wasmPath),module_=new WebAssembly.Module(wasm);
if(JSON.stringify(WebAssembly.Module.exports(module_).map(x=>x.name).sort())!==JSON.stringify(['memory',...abi].sort()))throw Error('Unexpected exported decoder ABI');
if(WebAssembly.Module.imports(module_).length)throw Error('Read-only module unexpectedly imports host APIs');
const x=new WebAssembly.Instance(module_,{}).exports;
for(const [method,value]of Object.entries({snapshot_decoder_abi:1,snapshot_decoder_max_input:33554432,snapshot_decoder_max_output:268435456,snapshot_decoder_max_depth:128,snapshot_decoder_max_nodes:2000000}))if(x[method]?.()!==value)throw Error('Invalid ABI: '+method);
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
// Retain unmodified license texts for every resolved dependency, including
// target-specific crates. The notices accompany (not replace) source provenance.
const metadata=JSON.parse(execFileSync(cargo,['metadata','--locked','--offline','--format-version','1','--filter-platform','wasm32-unknown-unknown','--manifest-path',path.join(root,'tools/rapier-snapshot-browser-exporter/Cargo.toml'),'--config','patch.crates-io.rapier3d.path='+JSON.stringify(path.join(rapier,'crates/rapier3d')),'--config','patch.crates-io.parry3d.path='+JSON.stringify(parry)],{env,cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}));
const resolved=new Set(metadata.resolve.nodes.map(n=>n.id));
const notices=[];
for(const pkg of metadata.packages.filter(p=>resolved.has(p.id)).sort((a,b)=>a.name.localeCompare(b.name))){
 const dir=path.dirname(pkg.manifest_path),licenseDirs=pkg.name==='rapier3d'?[rapier]:pkg.name==='rapier-snapshot-browser-decoder'?[path.join(root,'vendor')]:[dir];
 const licenseFiles=licenseDirs.flatMap(dir=>fs.readdirSync(dir).filter(name=>pkg.name==='rapier-snapshot-browser-decoder'?name==='RAPIER-LICENSE.txt':/^(licen[sc]e|copying|notice)([._-]|$)/i.test(name)).map(name=>path.join(dir,name))).filter(file=>fs.statSync(file).isFile());
 let licenseNote='';
 if(!licenseFiles.length){
  if(!['parry3d','profiling','profiling-procmacros','rstar'].includes(pkg.name)||!['Apache-2.0','MIT OR Apache-2.0'].includes(pkg.license))throw Error('Dependency license text missing: '+pkg.name+' '+pkg.version);
  // These official crate archives omit their linked license files. Their Cargo
  // manifests explicitly permit Apache-2.0; retain authors and the full standard
  // Apache text, and disclose that this is not a packaged upstream license file.
  licenseNote='\nThis archive declares Apache-2.0 but does not package the linked license text. Apache-2.0 is selected; the unchanged standard full text follows.\n';
  licenseFiles.push(path.join(root,'vendor/RAPIER-LICENSE.txt'));
 }
 notices.push(pkg.name+' '+pkg.version+'\nLicense: '+pkg.license+'\nAuthors: '+pkg.authors.join(', ')+'\nSource: '+(pkg.repository??pkg.source??'local bridge')+licenseNote+'\n'+licenseFiles.map(file=>'\n--- '+path.basename(file)+' ---\n'+fs.readFileSync(file,'utf8')).join('\n'));
}
const noticesPath=path.join(target,'snapshot-wasm-decoder-NOTICES.txt');fs.writeFileSync(noticesPath,notices.join('\n\n'));
const files=['tools/rapier-snapshot-exporter/src/main.rs','tools/rapier-snapshot-browser-exporter/src/lib.rs','tools/rapier-snapshot-browser-exporter/src/shared.rs','tools/rapier-snapshot-browser-exporter/src/bounded.rs','tools/rapier-snapshot-browser-exporter/Cargo.toml','tools/rapier-snapshot-browser-exporter/Cargo.lock','tools/rapier-snapshot-decoder/build-native.cjs','tools/rapier-snapshot-decoder/build-wasm.cjs','tools/rapier-snapshot-decoder/browser.mjs','tools/rapier-snapshot-decoder/codec.js'];
const provenance={schema:'rapier-readonly-wasm-decoder-provenance-v1',abi:1,sourceRevision:source.sourceRevision,engineVersion:'0.21.0',engineSha256:'fca22b2f33d4e88d2992215f42df6312093476db7fea4197816fb8e4ce17cba4',parryVersion:'0.31.1',target:'wasm32-unknown-unknown',limits:{input:33554432,output:268435456,depth:128,nodes:2000000,memory:1073741824},source,wasmPath,wasmSha256:hash(wasmPath),wasmBytes:wasm.length,link:{method:'official-rust-lld-staticlib-explicit-ABI-roots',archiveSha256:hash(archive),linkerSha256:hash(linker),version:execFileSync(linker,['-flavor','wasm','--version'],{encoding:'utf8'}).trim(),arguments:linkArgs,imports:[],exports:['memory',...abi]},notices:{path:noticesPath,sha256:hash(noticesPath),packages:resolved.size},build:{rustc:rustcVersion,profile:'release',rustflags:env.RUSTFLAGS,incremental:false,jobs:1,sources:Object.fromEntries(files.map(file=>[file,hash(path.join(root,file))]))}};
fs.writeFileSync(path.join(target,'snapshot-wasm-decoder-provenance.json'),JSON.stringify(provenance,null,2)+'\n');console.log(JSON.stringify(provenance,null,2));
