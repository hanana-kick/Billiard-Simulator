/** Test-only static delivery. No production build, source pin, or artifact rebuild. */
import fs from 'node:fs/promises';import{createHash}from'node:crypto';
import{FIXTURE_SHA256,validateSupportedClearFixture}from'../tests/fixtures/supported-clear-diagnostic-worker.mjs';
const root=new URL('../',import.meta.url),output=new URL('dist/__supported-clear/',root),sha=b=>createHash('sha256').update(b).digest('hex');
const fixture=await fs.readFile(new URL('tests/fixtures/supported-clear-diagnostic-fixture.json',root)),worker=await fs.readFile(new URL('tests/fixtures/supported-clear-diagnostic-worker.mjs',root));
if(sha(fixture)!==FIXTURE_SHA256)throw Error('Captured fixture digest mismatch');await validateSupportedClearFixture(JSON.parse(fixture));
await fs.mkdir(output,{recursive:true});await fs.writeFile(new URL('fixture.json',output),fixture);await fs.writeFile(new URL('worker.mjs',output),worker);await fs.writeFile(new URL('index.html',output),'<!doctype html><title>Isolated supported-clear diagnostic</title>');
await fs.writeFile(new URL('manifest.json',output),JSON.stringify({kind:'test-only-isolated-supported-clear-v1',productionBuild:false,fixtureSHA256:sha(fixture),workerSHA256:sha(worker)},null,2));console.log('Isolated diagnostic files copied; no production build or GPU execution.');
