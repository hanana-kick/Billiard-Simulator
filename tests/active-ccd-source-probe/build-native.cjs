'use strict';
// SPDX-License-Identifier: Apache-2.0
// Verify pristine official sources, then instrument only a new isolated copy.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const required=k=>{if(!process.env[k])throw Error('Explicit '+k+' required');return path.resolve(process.env[k]);};
const original=required('RAPIER_SOURCE_ROOT'),source=required('ACTIVE_CCD_SOURCE_COPY'),target=required('CARGO_TARGET_DIR'),host=required('ACTIVE_CCD_PROBE_HOST'),parry=required('PARRY_SOURCE_ROOT'),cargoHome=required('CARGO_HOME'),rustupHome=required('RUSTUP_HOME');
const overlap=(a,b)=>a===b||a.startsWith(b+path.sep)||b.startsWith(a+path.sep);
for(const a of[source,target,host])for(const b of[original,parry,root])if(overlap(a,b))throw Error('Probe paths must be isolated');
for(const[i,a]of[source,target,host].entries())for(const b of[source,target,host].slice(i+1))if(overlap(a,b))throw Error('Probe source, target and host must not overlap');
if(fs.existsSync(host))throw Error('New isolated host path required; preserve previous host source');
const verify=()=>JSON.parse(execFileSync(process.execPath,[path.join(root,'tools/rapier-snapshot-decoder/build-native.cjs'),'--check-source'],{env:process.env,encoding:'utf8'}));
const provenance={schema:'active-ccd-source-probe-build-v1',original:verify(),productionRuntimeChanged:false,patches:[]};
const contents=new Map(),get=file=>contents.get(file)??fs.readFileSync(path.join(original,file),'utf8');
function replace(file,marker,replacement){const text=get(file);if(text.split(marker).length!==2)throw Error('Unique source marker required: '+marker);contents.set(file,text.replace(marker,replacement));provenance.patches.push({file,marker,replacement});}
const mod='src/pipeline/mod.rs',sub='src/pipeline/physics_pipeline/substep.rs',sweep='src/dynamics/ccd/sweeps.rs',solver='src/dynamics/ccd/ccd_solver.rs';
contents.set(mod,get(mod)+'\n// Isolated read-only original CCD diagnostic.\npub mod active_ccd_capture;\n');
const capture=fs.readFileSync(path.join(__dirname,'capture.rs'),'utf8');contents.set('src/pipeline/active_ccd_capture.rs',capture);
const stage=(phase,ref='&integration_parameters')=>'\n            crate::pipeline::active_ccd_capture::stage("'+phase+'", '+ref+', remaining_time, remaining_substeps, bodies, islands, colliders, broad_phase, narrow_phase);\n';
replace(sub,'        while remaining_substeps > 0 {','        while remaining_substeps > 0 {'+stage('before-split'));
replace(sub,'                if let Some(toi) = first_impact {','                crate::pipeline::active_ccd_capture::split(remaining_time, remaining_substeps, first_impact, ccd_active);\n                if let Some(toi) = first_impact {');
replace(sub,'            num_passes += 1;','            num_passes += 1;'+stage('selected-substep'));
replace(sub,'            // If CCD is enabled, execute the CCD motion clamping.',stage('post-solve-pre-clamp')+'            // If CCD is enabled, execute the CCD motion clamping.');
replace(sub,'            self.counters.stages.update_time.resume();',stage('post-clamp-pre-advance')+'            self.counters.stages.update_time.resume();');
replace(sub,'            // Neutralize bodies whose integrated pose went non-finite before the remaining',stage('post-advance')+'            // Neutralize bodies whose integrated pose went non-finite before the remaining');
replace(sub,'        if any_ccd_active {',stage('after-all-passes')+'        if any_ccd_active {');
replace(sub,'                self.clear_modified_colliders(colliders, &mut modified_colliders);','                self.clear_modified_colliders(colliders, &mut modified_colliders);'+stage('post-intermediate-collision-detection'));
const prefix='crate::pipeline::active_ccd_capture::';
replace(sweep,'        let mut handle_candidate = |ch2: ColliderHandle, co2: &Collider| {','        let mut handle_candidate = |ch2: ColliderHandle, co2: &Collider| {\n            '+prefix+'candidate(handle, *ch1, ch2, fraction, "visited");');
for(const [marker,reason]of[
['            if ch2 == *ch1 {','same-collider'],['            if bh2 == Some(handle) {','same-body'],['            if !tier_allows(rb1, rb2, co2) {','tier'],['            if !co1.flags.collision_groups.test(co2.flags.collision_groups) {','collision-groups'],['            if is_pseudo && pseudo_mode == PseudoHitMode::Ignore {','pseudo-ignore']])replace(sweep,marker,marker+'\n                '+prefix+'candidate(handle, *ch1, ch2, fraction, "'+reason+'");');
replace(sweep,'                hooks, bodies, colliders, co1, co2, *ch1, ch2, handle, bh2,\n            ) {','                hooks, bodies, colliders, co1, co2, *ch1, ch2, handle, bh2,\n            ) {\n                '+prefix+'candidate(handle, *ch1, ch2, fraction, "hooks");');
replace(sweep,'            if let Some(hit_fraction) = cast_collider_pair(','            '+prefix+'candidate(handle, *ch1, ch2, fraction, "cast");\n            if let Some(hit_fraction) = cast_collider_pair(');
replace(sweep,'                if is_pseudo {\n                    pseudo_hits.push(PseudoHit {','                '+prefix+'candidate(handle, *ch1, ch2, hit_fraction, "accepted");\n                if is_pseudo {\n                    pseudo_hits.push(PseudoHit {');
replace(sweep,'    if is_pseudo {\n        // Any genuine impact counts',`    match target {
        TargetKind::Proxy(proxy) => ${prefix}query(&output, max_fraction, linear_slop, is_pseudo,
            &sub.sweep, &sub.proxy, Some(&Sweep::constant(target_pose, Vector::ZERO)), Some(proxy)),
        TargetKind::Composite => ${prefix}query(&output, max_fraction, linear_slop, is_pseudo,
            &sub.sweep, &sub.proxy, None, None),
    }
    if is_pseudo {
        // Any genuine impact counts`);
replace(sweep,'    BodyContinuousResult {\n        handle,','    '+prefix+'body("sweep-minimum", handle, fraction, rb1);\n    BodyContinuousResult {\n        handle,');
replace(solver,'                rb.pos.next_position = sweep.transform_at(result.fraction);','                '+prefix+'body("before-clamp", result.handle, result.fraction, rb);\n                rb.pos.next_position = sweep.transform_at(result.fraction);\n                '+prefix+'body("after-clamp", result.handle, result.fraction, rb);');
provenance.changes=[...contents].map(([file,data])=>({file,originalSha256:fs.existsSync(path.join(original,file))?sha(fs.readFileSync(path.join(original,file))):null,instrumentedSha256:sha(data)}));
const main=fs.readFileSync(path.join(__dirname,'main.rs'),'utf8'),decoder=fs.readFileSync(path.join(root,'tools/rapier-snapshot-exporter/src/main.rs'),'utf8');
provenance.captureSha256=sha(capture);provenance.hostSha256=sha(main);provenance.typedDecoderSha256=sha(decoder);
const newSource=!fs.existsSync(source);
if(newSource) fs.cpSync(original,source,{recursive:true,dereference:true,filter:p=>!['.git','target'].includes(path.basename(p))});
if(newSource)for(const[file,data]of contents)fs.writeFileSync(path.join(source,file),data);
function audit(dir,relative=''){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','target'].includes(entry.name))continue;const file=path.join(relative,entry.name),full=path.join(dir,entry.name);if(entry.isDirectory())audit(full,file);else if(file.endsWith('.rs')||['Cargo.toml','LICENSE','LICENSE-APACHE'].includes(entry.name)){const expected=contents.get(file)??fs.readFileSync(full);if(!Buffer.from(expected).equals(fs.readFileSync(path.join(source,file))))throw Error('Unexpected copied-source change: '+file);}}}audit(original);
if(!fs.readFileSync(path.join(source,'src/pipeline/active_ccd_capture.rs')).equals(Buffer.from(capture)))throw Error('Read-only capture module changed');
fs.mkdirSync(path.join(host,'src'),{recursive:true});const marker='fn main(){if let Err(e)=run(){eprintln!("native snapshot decoder: {e}");std::process::exit(1);}}';if(decoder.split(marker).length!==2)throw Error('Original typed decoder main mismatch');
fs.writeFileSync(path.join(host,'src/main.rs'),decoder.replace(marker,'')+'\n'+main);
fs.writeFileSync(path.join(host,'Cargo.toml'),fs.readFileSync(path.join(root,'tools/rapier-snapshot-exporter/Cargo.toml'),'utf8').replace('[package]','[package]\nautobins = false')+'\n[[bin]]\nname = "active-ccd-source-probe"\npath = "src/main.rs"\n');
fs.copyFileSync(path.join(root,'tools/rapier-snapshot-exporter/Cargo.lock'),path.join(host,'Cargo.lock'));
if(newSource)fs.writeFileSync(path.join(source,'.active-ccd-provenance.json'),JSON.stringify(provenance,null,2)+'\n');
if(process.argv.includes('--prepare-only')){console.log(JSON.stringify(provenance,null,2));process.exit(0);}
const env={...process.env,CARGO_HOME:cargoHome,RUSTUP_HOME:rustupHome,CARGO_TARGET_DIR:target,CARGO_BUILD_JOBS:'1',PATH:path.join(cargoHome,'bin')+path.delimiter+process.env.PATH};
execFileSync(path.join(cargoHome,'bin/cargo'),['build','--offline','--locked','--manifest-path',path.join(host,'Cargo.toml'),'--config','patch.crates-io.rapier3d.path='+JSON.stringify(path.join(source,'crates/rapier3d')),'--config','patch.crates-io.parry3d.path='+JSON.stringify(parry)],{env,stdio:'inherit'});
if(JSON.stringify(verify())!==JSON.stringify(provenance.original))throw Error('Pinned source changed during build');audit(original);
provenance.binary=path.join(target,'debug/active-ccd-source-probe');provenance.binarySha256=sha(fs.readFileSync(provenance.binary));
fs.writeFileSync(path.join(target,'active-ccd-probe-provenance.json'),JSON.stringify(provenance,null,2)+'\n');console.log(JSON.stringify(provenance,null,2));
