'use strict';
// SPDX-License-Identifier: Apache-2.0
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const REVISION = 'b716d375efc0201003f0cd9ef7168eee0b62c177';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function runOracle(input, options = {}) {
  const binary = options.binary || process.env.CUE_JOINT_ORACLE_BIN;
  const provenancePath = options.provenancePath || process.env.CUE_JOINT_ORACLE_PROVENANCE;
  if (!binary || !provenancePath) throw Error('An explicitly built pinned Rust oracle binary and provenance file are required');
  const proof = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));
  if (proof.sourceRevision !== REVISION || proof.originalWasmOracle !== false || proof.oracleKind !== 'instrumented-pinned-rust-scalar-joint') {
    throw Error('Unsupported cue-joint oracle provenance');
  }
  if (proof.instrumentationSha256 !== sha(fs.readFileSync(path.join(__dirname, 'instrumentation/cue_joint_diagnostic.rs'))) ||
      proof.hostSha256 !== sha(fs.readFileSync(path.join(__dirname, 'src/main.rs'))) ||
      proof.binarySha256 !== sha(fs.readFileSync(binary))) {
    throw Error('Cue-joint oracle source/binary differs from its build proof');
  }
  const output = JSON.parse(execFileSync(binary, [], {
    input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
    timeout: options.timeoutMs || 30000,
  }));
  if (output.metadata.sourceRevision !== REVISION || output.metadata.originalWasmOracle !== false || output.metadata.observationOnlyPatchSha256 !== proof.observationOnlyPatchSha256) throw Error('Unexpected oracle output provenance');
  return output;
}
function f32Bits(value) {
  const buffer = new ArrayBuffer(4), view = new DataView(buffer);
  view.setFloat32(0, value, true);
  return { bits: view.getUint32(0, true) };
}
function floatValue(value) {
  if (!value || !Number.isInteger(value.bits)) throw Error('Expected an authoritative f32 bit DTO');
  const buffer = new ArrayBuffer(4), view = new DataView(buffer);
  view.setUint32(0, value.bits, true);
  return view.getFloat32(0, true);
}
module.exports = { runOracle, f32Bits, floatValue, sourceRevision: REVISION };
