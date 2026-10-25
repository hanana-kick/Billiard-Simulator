'use strict';
// SPDX-License-Identifier: Apache-2.0
// Isolated diagnostic fork, exact original-source verification, explicit diff.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..'), sha = data => crypto.createHash('sha256').update(data).digest('hex');
const required = key => { if (!process.env[key]) throw Error('Explicit ' + key + ' required'); return path.resolve(process.env[key]); };
const original = required('RAPIER_SOURCE_ROOT'), source = required('SCENE_SOURCE_COPY'), target = required('CARGO_TARGET_DIR'), host = required('SCENE_PROBE_HOST');
const cargoHome = required('CARGO_HOME'), rustupHome = required('RUSTUP_HOME'), parry = required('PARRY_SOURCE_ROOT');
const overlaps = (a, b) => a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep);
for (const a of [source, target, host]) for (const b of [original, parry, root]) if (overlaps(a, b)) throw Error('Probe paths must be isolated from original sources and repository');
for (const [i, a] of [source, target, host].entries()) for (const b of [source, target, host].slice(i + 1)) if (overlaps(a, b)) throw Error('Probe source, host and target must not overlap');
const verify = () => JSON.parse(execFileSync(process.execPath, [path.join(root, 'tools/rapier-snapshot-decoder/build-native.cjs'), '--check-source'], {env: process.env, encoding: 'utf8'}));
const provenance = {schema: 'four-ball-scene-probe-build-v1', original: verify(), productionRuntimeChanged: false};
const originalDecoder = fs.readFileSync(path.join(root, 'tools/rapier-snapshot-exporter/src/main.rs'), 'utf8');
const capture = fs.readFileSync(path.join(__dirname, 'capture.rs'), 'utf8'), hostMain = fs.readFileSync(path.join(__dirname, 'main.rs'), 'utf8');
const restoration = fs.readFileSync(path.join(__dirname, 'restore-journal.rs'), 'utf8');
const files = ['src/pipeline/mod.rs', 'src/pipeline/physics_pipeline/solve.rs', 'src/dynamics/joint/impulse_joint/impulse_joint_set.rs'];
const moduleAppend = '\n// Test-only read-only source phase capture.\npub mod scene_phase_capture;\n';
const call = phase => '\n        crate::pipeline::scene_phase_capture::capture("' + phase + '", gravity, integration_parameters, islands, bodies, colliders, narrow_phase, impulse_joints);\n';
const replacements = [
    ['        islands.persistent.run_pending_split(bodies);', 'pre-energy'],
    ['        // Substep solve-groups: partition the awake body list by effective', 'post-activation']
];
const contents = new Map(files.map(file => [file, fs.readFileSync(path.join(original, file), 'utf8')]));
contents.set(files[0], contents.get(files[0]) + moduleAppend);
contents.set(files[2], contents.get(files[2]) + '\n' + restoration);
let solve = contents.get(files[1]);
for (const [marker, phase] of replacements) {
    if (solve.split(marker).length !== 2) throw Error('Exact unique source boundary required: ' + phase);
    solve = phase === 'pre-energy' ? solve.replace(marker, marker + call(phase)) : solve.replace(marker, call(phase) + '\n' + marker);
}
contents.set(files[1], solve); contents.set('src/pipeline/scene_phase_capture.rs', capture);
provenance.changes = [...contents].map(([file, data]) => ({file, originalSha256: fs.existsSync(path.join(original, file)) ? sha(fs.readFileSync(path.join(original, file))) : null, instrumentedSha256: sha(data)}));
provenance.instrumentation = {moduleAppend, replacements: replacements.map(([marker, phase]) => ({marker, inserted: call(phase), position: phase === 'pre-energy' ? 'after' : 'before'})), captureSha256: sha(capture), restorationSha256: sha(restoration), restorationAppend: restoration, hostSha256: sha(hostMain), typedDecoderSha256: sha(originalDecoder)};
const identity = JSON.stringify(provenance);
const sourceProof = p => JSON.stringify({original: p.original, changes: p.changes, captureSha256: p.instrumentation.captureSha256});
if (!fs.existsSync(source)) {
    fs.cpSync(original, source, {recursive: true, dereference: true, filter: file => !['.git', 'target'].includes(path.basename(file))});
    for (const [file, data] of contents) fs.writeFileSync(path.join(source, file), data);
    fs.writeFileSync(path.join(source, '.scene-probe-identity.json'), identity);
} else if (sourceProof(JSON.parse(fs.readFileSync(path.join(source, '.scene-probe-identity.json'), 'utf8'))) !== sourceProof(provenance)) throw Error('Existing probe copy differs; use a new path');
function audit(dir, relative = '') {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        if (['.git', 'target'].includes(entry.name)) continue;
        const file = path.join(relative, entry.name), full = path.join(dir, entry.name);
        if (entry.isDirectory()) audit(full, file);
        else if (file.endsWith('.rs') || ['Cargo.toml', 'LICENSE', 'LICENSE-APACHE'].includes(entry.name)) {
            const expected = contents.get(file) ?? fs.readFileSync(full);
            if (!Buffer.from(expected).equals(fs.readFileSync(path.join(source, file)))) throw Error('Unexpected copied-source change: ' + file);
        }
    }
}
audit(original);
if (!fs.readFileSync(path.join(source, 'src/pipeline/scene_phase_capture.rs')).equals(Buffer.from(capture))) throw Error('Capture module differs');
fs.mkdirSync(path.join(host, 'src'), {recursive: true});
const mainMarker = 'fn main(){if let Err(e)=run(){eprintln!("native snapshot decoder: {e}");std::process::exit(1);}}';
if (originalDecoder.split(mainMarker).length !== 2) throw Error('Exact existing typed decoder main required');
fs.writeFileSync(path.join(host, 'src/main.rs'), originalDecoder.replace(mainMarker, '') + '\n' + hostMain);
const manifest = fs.readFileSync(path.join(root, 'tools/rapier-snapshot-exporter/Cargo.toml'), 'utf8');
fs.writeFileSync(path.join(host, 'Cargo.toml'), manifest.replace('[package]', '[package]\nautobins = false') + '\n[[bin]]\nname = "four-ball-scene-probe"\npath = "src/main.rs"\n');
fs.copyFileSync(path.join(root, 'tools/rapier-snapshot-exporter/Cargo.lock'), path.join(host, 'Cargo.lock'));
if (process.argv.includes('--prepare-only')) { console.log(JSON.stringify(provenance, null, 2)); process.exit(0); }
const env = {...process.env, CARGO_HOME: cargoHome, RUSTUP_HOME: rustupHome, CARGO_TARGET_DIR: target, CARGO_BUILD_JOBS: '1', PATH: path.join(cargoHome, 'bin') + path.delimiter + process.env.PATH};
execFileSync(path.join(cargoHome, 'bin/cargo'), ['build', '--offline', '--locked', '--manifest-path', path.join(host, 'Cargo.toml'), '--config', 'patch.crates-io.rapier3d.path=' + JSON.stringify(path.join(source, 'crates/rapier3d')), '--config', 'patch.crates-io.parry3d.path=' + JSON.stringify(parry)], {env, stdio: 'inherit'});
if (JSON.stringify(verify()) !== JSON.stringify(provenance.original)) throw Error('Pinned source changed during build');
audit(original); provenance.binary = path.join(target, 'debug/four-ball-scene-probe'); provenance.binarySha256 = sha(fs.readFileSync(provenance.binary));
fs.writeFileSync(path.join(target, 'scene-probe-provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
console.log(JSON.stringify(provenance, null, 2));
