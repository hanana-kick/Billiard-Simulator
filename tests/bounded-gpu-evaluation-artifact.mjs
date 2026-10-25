// Test evidence only. V8 may expose views into the serialized input Buffer.
// Pin source digests BEFORE any deliberate caller-mutation ownership check.
import fs from 'node:fs';
import v8 from 'node:v8';
import crypto from 'node:crypto';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export function readRawEvaluationArtifact(file) {
  const bytes = fs.readFileSync(file), inputArtifactSha256 = hash(bytes);
  const raw = v8.deserialize(bytes);
  return {raw, inputArtifactSha256, snapshotSha256: hash(raw.snapshot),
    preStrikeSha256: raw.preStrikeSnapshot ? hash(raw.preStrikeSnapshot) : null};
}
