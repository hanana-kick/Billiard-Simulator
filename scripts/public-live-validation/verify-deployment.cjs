'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const pins=require('./deployed-pins.json');
const out=path.resolve(process.env.RUN_OUT||'public-cpu-event-window-evidence');fs.mkdirSync(out,{recursive:true});
assert.equal(pins.publicURL,'https://dangoo.hananakick.cc/');assert.equal(pins.deployedCommit,'1efe0dbcc7e6db743b5ea83fc394e6bad97495b4');assert.match(String(pins.deploymentRunId||''),/^[1-9][0-9]+$/,'Pin the completed new main Pages deployment run before publishing validation branch');assert.match(pins.htmlSha256,/^[a-f0-9]{64}$/);assert.equal(Object.keys(pins.inlineScripts).length,38);assert.equal(pins.inlineScripts['source-canonical-entry-availability'],crypto.createHash('sha256').update('\nglobalThis.CANONICAL_GPU_ENTRY_AVAILABLE=true;\n').digest('hex'));
// The branch contains the exact candidate plus test-only files. Pin every
// relevant source independently of the public HTML response.
for(const [file,expected]of Object.entries(pins.sourceFiles)){const actual=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');assert.equal(actual,expected,file);}
async function read(url){const response=await fetch(url,{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});assert.equal(response.status,200,url);return response.json();}
(async()=>{
 const run=await read('https://api.github.com/repos/hanana-kick/Billiard-Simulator/actions/runs/'+pins.deploymentRunId);fs.writeFileSync(path.join(out,'deployment-run.json'),JSON.stringify(run,null,2));
 assert.equal(run.head_sha,pins.deployedCommit);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');assert.equal(run.head_branch,'main');assert.equal(run.path,'.github/workflows/pages.yml');assert.notEqual(run.event,'pull_request');
 const jobs=await read(run.jobs_url);fs.writeFileSync(path.join(out,'deployment-jobs.json'),JSON.stringify(jobs,null,2));assert.ok(jobs.jobs.some(job=>job.name==='deploy'&&job.status==='completed'&&job.conclusion==='success'),'A successful deploy job is required, not just a branch build');
 const main=await read('https://api.github.com/repos/hanana-kick/Billiard-Simulator/branches/main');fs.writeFileSync(path.join(out,'main-branch.json'),JSON.stringify(main,null,2));assert.equal(main.commit.sha,pins.deployedCommit,'Main changed; do not silently claim this candidate is current');
 fs.copyFileSync(path.join(__dirname,'deployed-pins.json'),path.join(out,'verified-pins.json'));
 console.log(JSON.stringify({verified:true,deployedCommit:pins.deployedCommit,deploymentRunId:pins.deploymentRunId,htmlSha256:pins.htmlSha256,publicURL:pins.publicURL}));
})().catch(error=>{fs.writeFileSync(path.join(out,'deployment-verification-failure.txt'),String(error.stack||error));console.error(error);process.exitCode=1;});
