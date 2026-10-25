'use strict';
// Assertion/artifact verification only. Never loads or steps either engine.
const fs=require('node:fs'),path=require('node:path'),v8=require('node:v8'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const dir=path.resolve(process.argv[2]??path.join(__dirname,'../artifacts/retained-flight-full'));
const read=n=>fs.readFileSync(path.join(dir,n)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const cpu=JSON.parse(read('cpu.json')),gpu=JSON.parse(read('gpu.json')),a=v8.deserialize(read('cpu.json.final.v8')),b=v8.deserialize(read('gpu.json.final.v8'));
for(const r of[cpu,gpu]){assert.equal(r.h,7228);assert.equal(r.fullRest,true);assert.equal(r.rollbacks,4);assert.equal(r.siblingIsolation,true);assert.equal(r.checkpointStats.checkpoints.length,13);assert.ok(r.checkpointStats.checkpoints.every(c=>c.omittedUnrepresentedFields.length===0&&c.fullSourceRoster));assert.equal(r.tolerance,1e-6);}
assert.deepEqual(cpu.sourceHashes,gpu.sourceHashes);assert.equal(cpu.runtimeSha256,gpu.runtimeSha256);assert.deepEqual(cpu.checkpointSourceHashes,gpu.checkpointSourceHashes);
assert.deepEqual(a.balls,b.balls,'Final physical bodies exactly match');assert.deepEqual(a.game,b.game,'Final scoring/game exactly matches');assert.equal(a.shotComplete,true);assert.equal(b.shotComplete,true);
const numericDifferences=[],diagnostics=[];
function compare(x,y,p=''){if(Object.is(x,y))return;if(x&&y&&typeof x==='object'&&typeof y==='object'){assert.deepEqual(Object.keys(x),Object.keys(y),p);for(const k of Object.keys(x))compare(x[k],y[k],p+'.'+k);return;}
 if(/\.(backend|energyBackend)$/.test(p)){assert.equal(x,'cpu-reference');assert.equal(y,'webgpu');diagnostics.push(p);return;}
 assert.match(p,/^\.contactEvents\.\d+\.position\.[xyz]$/,'No unaccounted final state divergence');assert.ok(Number.isFinite(x)&&Number.isFinite(y));const absolute=Math.abs(x-y);assert.ok(absolute<=1e-6,'Unchanged original event-position tolerance');numericDifferences.push({path:p,cpu:x,gpu:y,absolute});}
compare(a,b);
const files=['original-checkpoints.v8','original-checkpoints.log','cpu.json','gpu.json','cpu.json.final.v8','gpu.json.final.v8','cpu.log','gpu.log'];
const peak=n=>Math.max(...read(n).toString().split('\n').flatMap(line=>{try{const x=JSON.parse(line);return x.memory?[x.memory.rss]:[];}catch{return[];}}));
const proof={schema:'retained-flight-full-acceptance-v1',scope:'isolated original settled four-ball speed4.5 contact/flight/return/rest',backend:'native WebGPU Vulkan SwiftShader; not hardware performance',h:7228,bodyNumericComparisonsPerBackend:7228*4*22,fullCheckpointsPerBackend:13,rollbackChecksPerBackend:4,siblingIsolation:'independent live world snapshot unchanged across failed commits',cpuMaxBodyError:cpu.maxima.other,gpuMaxBodyError:gpu.maxima.other,maxOriginalCheckpointError:Math.max(cpu.checkpointStats.maxAbsolute,gpu.checkpointStats.maxAbsolute),finalBodiesExact:true,finalGameExact:true,wholeTrajectoryBitwiseEqual:false,finalWholeStateBitwiseEqual:false,finalNumericDifferences:numericDifferences,backendDiagnosticDifferences:diagnostics,peakLoggedRssBytes:{cpu:peak('cpu.log'),gpu:peak('gpu.log')},runtimeSha256:cpu.runtimeSha256,originalSourceHashes:cpu.sourceHashes,checkpointSourceHashes:cpu.checkpointSourceHashes,artifacts:Object.fromEntries(files.map(f=>[f,{bytes:read(f).length,sha256:hash(read(f))}]))};
fs.writeFileSync(path.join(dir,'proof.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof,null,2));
