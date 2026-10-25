'use strict';
// SPDX-License-Identifier: Apache-2.0
// Builds an isolated source-instrumented diagnostic. Never patches the original
// source tree and never silently substitutes the crates.io engine implementation.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const REVISION = 'b716d375efc0201003f0cd9ef7168eee0b62c177';
const HERE = __dirname;
const required = name => {
  if (!process.env[name]) throw Error('Set ' + name + ' to the prepared source/build path');
  return path.resolve(process.env[name]);
};
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const rapier = required('RAPIER_SOURCE_ROOT');
const rapierArchive = required('RAPIER_SOURCE_ARCHIVE');
const parry = required('PARRY_SOURCE_ROOT');
const parryArchive = required('PARRY_SOURCE_ARCHIVE');
const check = String.raw`import hashlib,json,pathlib,sys,tarfile
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
  if not local.is_file() or local.read_bytes()!=original: raise SystemExit('Source differs from official archive: '+str(local))
  manifest.append((str(relative),hashlib.sha256(original).hexdigest()))
if not manifest: raise SystemExit('No source files verified')
manifest.sort(); proof=hashlib.sha256(json.dumps(manifest,separators=(',',':')).encode()).hexdigest()
print(json.dumps({'archiveSha256':digest,'verifiedSourceFiles':len(manifest),'sourceManifestSha256':proof}))`;
function verify(archive, source, expected) {
  return JSON.parse(execFileSync('python3', ['-c', check, archive, source, expected], { encoding: 'utf8', maxBuffer: 1024 * 1024 }));
}
const RAP_SHA = '67825e5487ff84582777132f1ede42e8b865984246825ba9de6ff07ed2a8fdb1';
const PAR_SHA = '7b626edc0b497dba4bdf6e1e0797895294ed9f61dac2bd28cb5d34d37ad2ca7e';
const instrumentation = fs.readFileSync(path.join(HERE, 'instrumentation/cue_joint_diagnostic.rs'));
const changes = [
  ['src/dynamics/solver/joint_constraint/mod.rs', '\n// Read-only scalar cue-joint diagnostic instrumentation.\n#[cfg(all(feature = "dim3", feature = "f32", feature = "std", feature = "serde-serialize"))]\npub mod cue_joint_diagnostic;\n'],
  ['src/dynamics/mod.rs', '\n// Read-only scalar cue-joint diagnostic re-export.\n#[cfg(all(feature = "dim3", feature = "f32", feature = "std", feature = "serde-serialize"))]\npub use self::solver::cue_joint_diagnostic;\n'],
];
const provenance = {
  schemaVersion: 1,
  oracleKind: 'instrumented-pinned-rust-scalar-joint',
  sourceRevision: REVISION,
  originalWasmOracle: false,
  rapier: verify(rapierArchive, rapier, RAP_SHA),
  parry: verify(parryArchive, parry, PAR_SHA),
  instrumentationSha256: sha(instrumentation),
  hostSha256: sha(fs.readFileSync(path.join(HERE, 'src/main.rs'))),
  observationOnlyPatchSha256: sha(JSON.stringify(changes) + '\n' + instrumentation.toString('utf8')),
  features: ['serde-serialize', 'enhanced-determinism', 'debug-render', 'profiler', 'fem'],
  unchangedPhysicsFiles: [
    'src/dynamics/solver/joint_constraint/joint_constraint_helper.rs',
    'src/dynamics/solver/joint_constraint/joint_velocity_constraint.rs',
    'src/dynamics/solver/joint_constraint/joint_constraint_builder.rs',
    'src/utils/rotation_ops.rs',
    'src/dynamics/integration_parameters.rs',
  ].map(relative => ({ path: relative, sha256: sha(fs.readFileSync(path.join(rapier, relative))) })),
};
provenance.diagnosticRevision = 'cue-joint-observation-v1+' + provenance.observationOnlyPatchSha256.slice(0, 16);
if (process.argv.includes('--check-source')) {
  console.log(JSON.stringify(provenance, null, 2));
  process.exit(0);
}
const copy = required('CUE_JOINT_SOURCE_COPY');
const overlapping = (a, b) => a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep);
if (overlapping(copy, rapier) || overlapping(copy, parry) || overlapping(copy, HERE)) {
  throw Error('CUE_JOINT_SOURCE_COPY must be a separate, non-overlapping directory');
}
const marker = path.join(copy, '.cue-joint-diagnostic-copy.json');
if (!fs.existsSync(copy)) {
  fs.cpSync(rapier, copy, { recursive: true, dereference: true, filter: file => !['.git', 'target'].includes(path.basename(file)) });
  for (const [relative, appended] of changes) {
    fs.appendFileSync(path.join(copy, relative), appended);
  }
  fs.writeFileSync(path.join(copy, 'src/dynamics/solver/joint_constraint/cue_joint_diagnostic.rs'), instrumentation);
  fs.writeFileSync(marker, JSON.stringify({ sourceRevision: REVISION, instrumentationSha256: provenance.instrumentationSha256 }, null, 2) + '\n');
} else {
  if (!fs.existsSync(marker)) throw Error('Refusing to overwrite an existing directory that is not this diagnostic copy');
  const recorded = JSON.parse(fs.readFileSync(marker, 'utf8'));
  if (recorded.sourceRevision !== REVISION || recorded.instrumentationSha256 !== provenance.instrumentationSha256) {
    throw Error('Diagnostic source copy is for a different revision/instrumentation; choose a new empty destination');
  }
}
const auditCopy = String.raw`import hashlib,json,pathlib,sys
original,copy,overlay=map(pathlib.Path,sys.argv[1:])
expected=json.loads((copy/'.cue-joint-diagnostic-copy.json').read_text())
changes=json.loads(sys.stdin.read())
changed={name:append.encode() for name,append in changes}
manifest=[]
for source in sorted(original.rglob('*')):
 if not source.is_file() or not (source.suffix=='.rs' or source.name in ('Cargo.toml','LICENSE','LICENSE-APACHE')): continue
 relative=source.relative_to(original); target=copy/relative; data=source.read_bytes()+changed.get(str(relative),b'')
 if not target.is_file() or target.read_bytes()!=data: raise SystemExit('Unexpected copied-source mutation: '+str(relative))
 manifest.append([str(relative),hashlib.sha256(data).hexdigest()])
added=copy/'src/dynamics/solver/joint_constraint/cue_joint_diagnostic.rs'
if added.read_bytes()!=overlay.read_bytes(): raise SystemExit('Diagnostic overlay content differs')
manifest.append([str(added.relative_to(copy)),hashlib.sha256(added.read_bytes()).hexdigest()])
manifest.sort()
print(json.dumps({'verifiedFiles':len(manifest),'instrumentedManifestSha256':hashlib.sha256(json.dumps(manifest,separators=(',',':')).encode()).hexdigest(),'modifiedExistingFiles':list(changed),'addedFiles':[str(added.relative_to(copy))]}))`;
provenance.sourceCopy = JSON.parse(execFileSync('python3', ['-c', auditCopy, rapier, copy, path.join(HERE, 'instrumentation/cue_joint_diagnostic.rs')], { input: JSON.stringify(changes), encoding: 'utf8', maxBuffer: 1024 * 1024 }));
if (process.argv.includes('--prepare-only')) {
  console.log(JSON.stringify(provenance, null, 2));
  process.exit(0);
}
const cargoHome = required('CARGO_HOME');
const rustupHome = required('RUSTUP_HOME');
const target = required('CARGO_TARGET_DIR');
const cargo = process.env.RAPIER_CARGO ?? path.join(cargoHome, 'bin/cargo');
const env = { ...process.env, CARGO_HOME: cargoHome, RUSTUP_HOME: rustupHome, CARGO_TARGET_DIR: target,
  CARGO_BUILD_JOBS: '1', CUE_JOINT_PATCH_SHA256: provenance.observationOnlyPatchSha256, PATH: path.join(cargoHome, 'bin') + path.delimiter + process.env.PATH };
provenance.rustc = execFileSync(path.join(cargoHome, 'bin/rustc'), ['-Vv'], { env, encoding: 'utf8' }).trim();
execFileSync(cargo, ['build', '--offline', '--locked', '--manifest-path', path.join(HERE, 'Cargo.toml'),
  '--config', 'patch.crates-io.rapier3d.path=' + JSON.stringify(path.join(copy, 'crates/rapier3d')),
  '--config', 'patch.crates-io.parry3d.path=' + JSON.stringify(parry)], { env, cwd: HERE, stdio: 'inherit' });
const binary = path.join(target, 'debug/experimental-cue-joint-oracle');
provenance.binarySha256 = sha(fs.readFileSync(binary));
provenance.binaryVersion = JSON.parse(execFileSync(binary, ['--version'], { encoding: 'utf8' }));
// The source verifier runs again after compilation to catch accidental mutation.
if (JSON.stringify(verify(rapierArchive, rapier, RAP_SHA)) !== JSON.stringify(provenance.rapier)) throw Error('Original Rapier source changed during build');
if (JSON.stringify(verify(parryArchive, parry, PAR_SHA)) !== JSON.stringify(provenance.parry)) throw Error('Original Parry source changed during build');
const proof = path.join(target, 'cue-joint-oracle-provenance.json');
fs.writeFileSync(proof, JSON.stringify(provenance, null, 2) + '\n');
console.log(JSON.stringify({ binary, provenance: proof, verification: provenance }, null, 2));
