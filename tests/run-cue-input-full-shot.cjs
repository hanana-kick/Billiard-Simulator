'use strict';
// Fresh-process, source-preserving test supervisor. This never supplies native
// state to the world and never modifies the test's numeric/event/cache gates.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
function completionEvidence({backend,code,signal,spawnError,intentionalInterrupt,resultRows,sourceHashRows}) {
  const expected=backend==='cpu'?'cpu-reference':backend==='gpu'?'actual-webgpu':null;
  const reasons=[];
  if(!expected)reasons.push('Explicit cpu/gpu backend required');
  if(code!==0||signal!==null||spawnError||intentionalInterrupt)reasons.push('Child process did not finish normally with exit 0');
  if(resultRows.length!==1||resultRows[0]?.backend!==expected||resultRows[0]?.status!=='rest-complete'||resultRows[0]?.fullShot!==true)
    reasons.push('Exactly one selected-backend rest-complete/fullShot result required');
  const hashes=sourceHashRows[0]?.sourceHashes;
  if(sourceHashRows.length!==1||sourceHashRows[0]?.sourceHashCheckCompleted!==true||!hashes||!Object.keys(hashes).length||Object.values(hashes).some(h=>typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h)))
    reasons.push('Exactly one completed nonempty source hash check required');
  return {passed:reasons.length===0,reasons};
}
// Only JSON emitted as TAP console diagnostics is a typed run record.
// Assertion error bodies may repeat that same JSON and are not another run.
function parseTestJsonLine(line) {
  if(!line.startsWith('# {'))return null;
  try{return JSON.parse(line.slice(2));}catch{return null;}
}
function main() {
  const log=process.argv[2],backend=process.env.CUE_INPUT_BACKEND;
  if(!log||!path.isAbsolute(log)||!['cpu','gpu'].includes(backend))throw Error('Absolute new log and explicit cpu/gpu backend required');
  const summary=log+'.process.json';if(fs.existsSync(log)||fs.existsSync(summary))throw Error('Preserve previous log/evidence; choose a new path');
  const stream=fs.createWriteStream(log,{flags:'wx'}),start=new Date().toISOString(),script=path.resolve(__dirname,'experimental-cue-source-input-full-shot.cjs'),args=['--test','--test-reporter=tap',script];
  const child=spawn(process.execPath,args,{cwd:path.resolve(__dirname,'..'),env:process.env,stdio:['ignore','pipe','pipe']});
  let spawnError=null,exit=null,lastProgress=null,resultRows=[],sourceHashRows=[],carry='',intentionalInterrupt=false;
  process.on('SIGINT',()=>{intentionalInterrupt=true;child.kill('SIGINT');});
  const inspect=chunk=>{carry+=chunk.toString();const lines=carry.split('\n');carry=lines.pop();for(const line of lines){const value=parseTestJsonLine(line);if(!value)continue;if(value.progress)lastProgress=value;if(value.status)resultRows.push(value);if(value.sourceHashes)sourceHashRows.push(value);}};
  for(const source of[child.stdout,child.stderr])source.on('data',chunk=>{stream.write(chunk);process.stdout.write(chunk);if(source===child.stdout)inspect(chunk);});
  child.on('error',error=>{spawnError={name:error.name,message:error.message,code:error.code??null};});
  child.on('exit',(code,signal)=>{exit={code,signal};});
  child.on('close',(code,signal)=>{inspect('\n');stream.end(()=>{
    const completion=completionEvidence({backend,code,signal,spawnError,intentionalInterrupt,resultRows,sourceHashRows});
    const bytes=fs.readFileSync(log),record={schema:'cue-input-gate-process-v1',startedAt:start,endedAt:new Date().toISOString(),backend,runnerPid:process.pid,childPid:child.pid??null,command:[process.execPath,...args],fixture:process.env.CUE_INPUT_REPLAY,fullFixture:process.env.CUE_INPUT_FULL_REPLAY,spawnError,intentionalInterrupt,exit,close:{code,signal},completion,causeEvidence:'Preserved TAP includes test-worker cause/signal when reported; runner exit alone does not identify a cause.',lastProgress,results:resultRows,sourceHashChecks:sourceHashRows,logSha256:crypto.createHash('sha256').update(bytes).digest('hex'),logBytes:bytes.length};
    fs.writeFileSync(summary,JSON.stringify(record,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({processSummary:summary,exit,close:record.close,completion,lastProgress})+'\n');process.exitCode=intentionalInterrupt?130:completion.passed?0:1;
  });});
}
module.exports={completionEvidence,parseTestJsonLine};
if(require.main===module)main();
