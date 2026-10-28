// LOCAL HOST INITIAL-only fixture. Requires original capture/decoder documented
// by originalRegisteredFixture; no future assertions or forward replay loaded.
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {originalRegisteredFixture} from './resident-candidate-original-fixture.mjs';
import {createWorldInitializationPlan} from '../src/resident-candidate/world-initialization.mjs';
import {DEFAULT_WHOLE_H_RULE} from './resident-candidate-whole-h-fixture.mjs';
import {compileInverseTipImpactRuntimeCandidate} from './resident-candidate-inverse-observed-prepare.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export async function freshInverseObservedInitialCandidate({sweeps=3}={}){const f=await originalRegisteredFixture(),initializationPlan=await createWorldInitializationPlan({decoder:f.decoder,input:f.raw,rule:DEFAULT_WHOLE_H_RULE}),rows=[{id:219,settings:{angle:310,elevation:85,speed:4.5,tipX:.2,tipY:-.1}},{id:522,settings:{angle:9,elevation:8,speed:0,tipX:0,tipY:0}}],sourceHashes=Object.fromEntries(['src/physics.js','src/inverse-events.js','src/resident-candidate/inverse-world-observation.mjs','src/resident-candidate/inverse-observation-storage.mjs'].map(name=>[name,sha(readFileSync(new URL('../'+name,import.meta.url)))])),provenance={sourceHead:execFileSync('git',['rev-parse','HEAD'],{cwd:new URL('../',import.meta.url),encoding:'utf8'}).trim(),sourceHashes,sourceArtifactSha256:f.artifactSha256};return compileInverseTipImpactRuntimeCandidate({initializationPlan,sourceSeed:f.seed,rows,sweeps,provenance});}
