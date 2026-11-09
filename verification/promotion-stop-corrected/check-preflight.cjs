'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),M=require('./measurement.cjs');
const MEASUREMENT_SHA256='fb377eac4bdf5c0410d520f4842eb7ecec69228bb31cc4da4645c5f8434ef251';
function requireQualified(s,{commit,runId,runAttempt}={}){
 const need=(ok,why)=>{if(!ok)throw Error('CPU capability gate closed: '+why);};
 need(s?.schema==='promotion-cpu-capability-v1','wrong schema');
 need(s.pass===true&&s.phase==='capability-qualified'&&s.failure===null,'preflight failed or incomplete');
 need(s.criterionMs===250&&s.limits?.criterionMs===250,'criterion changed');
 need(s.actualComparisonsStarted===0&&s.actualAppQualified===false,'incorrect scope');
 need(s.shutdown?.detached===true&&s.shutdown?.closed===true,'cleanup incomplete');
 const integer=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
 need(s.recording?.complete===true&&s.recording.failures===0&&integer(s.recording.bytes,1048576)&&s.recording.bytes>0&&integer(s.recording.records,128)&&s.recording.records===s.sampleCount+1,'raw records incomplete or oversized');
 need(s.window?.qualified===true&&s.clockEnvelope?.qualified===true,'window unqualified');
 const bounded=x=>Number.isFinite(x)&&x>=0&&x<=250;
 need(bounded(s.window.maxAcquisitionMs)&&bounded(s.window.maxGapMs)&&bounded(s.clockEnvelope.width),'timing evidence exceeds criterion');
 need(Array.isArray(s.window.bracketWidthsMs)&&s.window.bracketWidthsMs.length===2&&s.window.bracketWidthsMs.every(bounded),'missing or wide brackets');
 need(s.acquisitionPendingAtFailure===false&&s.window.incompleteAcquisition===false,'unfinished acquisition');
 need(Number.isInteger(s.sampleCount)&&s.sampleCount>=13&&s.sampleCount<=110,'invalid sample count');
 need(Number.isFinite(s.wallMs)&&s.wallMs>=0&&s.wallMs<=30000,'work budget exceeded');
 need(s.source?.measurementSHA256===MEASUREMENT_SHA256,'measurement source mismatch');
 need(typeof s.rawSHA256==='string'&&/^[a-f0-9]{64}$/.test(s.rawSHA256),'missing raw digest');
 for(const p of [s.window.inner,s.window.outer])need(p&&Number.isFinite(p.cpuSecondsLowerBound)&&p.cpuSecondsLowerBound>=0&&integer(p.intervals,110)&&p.intervals>=1&&Number.isFinite(p.observedSpanMs)&&p.observedSpanMs>0,'missing lower-bound evidence');
 need(s.load&&Number.isFinite(s.load.startEpoch)&&Number.isFinite(s.load.endEpoch)&&s.load.endEpoch-s.load.startEpoch>=8000&&s.load.endEpoch-s.load.startEpoch<=8250&&s.load.workersRemaining===0&&integer(s.load.workers,4)&&s.load.workers>=1,'invalid load evidence');
 if(commit)need(s.source.gitCommit===commit,'commit mismatch');
 if(runId)need(s.source.runId===runId,'run mismatch');
 if(runAttempt)need(s.source.runAttempt===runAttempt,'attempt mismatch');
 return{capabilityQualified:true,actualAppQualified:false,actualComparisonsStarted:0};
}
function readSummary(file){const stat=fs.statSync(file);if(!stat.isFile()||stat.size>65537)throw Error('Summary missing or exceeds 64 KiB cap');return JSON.parse(fs.readFileSync(file,'utf8'));}
function validateRaw(s,buffer){
 const need=(ok,why)=>{if(!ok)throw Error('CPU raw evidence rejected: '+why);};
 need(Buffer.isBuffer(buffer)&&buffer.length<=1048576&&buffer.length===s.recording.bytes,'size mismatch');
 need(crypto.createHash('sha256').update(buffer).digest('hex')===s.rawSHA256,'digest mismatch');
 const lines=buffer.toString('utf8').split('\n');need(lines.pop()==='','missing final newline');need(lines.length===s.recording.records&&lines.length<=128,'record count mismatch');
 const rows=lines.map(line=>{need(Buffer.byteLength(line)+1<=32768,'oversized record');return JSON.parse(line);});need(rows[0]?.type==='metadata','missing metadata');
 const samples=rows.slice(1);need(samples.length===s.sampleCount,'sample count mismatch');
 let phase=0;const phases=['idle','load','post'],counts=[0,0,0];
 for(let i=0;i<samples.length;i++){const x=samples[i],p=phases.indexOf(x.phase);need(Object.keys(x).sort().join(',')==='end,phase,processes,start,type','unknown sample field or incomplete/error marker');need(x.type==='sample'&&p>=phase&&p<=phase+1,'sample phase order');phase=p;counts[p]++;need(Number.isFinite(x.start)&&Number.isFinite(x.end)&&x.end>=x.start&&x.end-x.start<=250,'invalid acquisition bracket');if(i)need(x.start>=samples[i-1].end&&x.start-samples[i-1].end<=250,'overlapping CPU requests or sampling gap');require('./cpu-preflight.cjs').processRows(x.processes);}
 need(counts[0]===10&&counts[1]>=2&&counts[2]===3,'incomplete phases');
 function calibration(c){need(c&&Array.isArray(c.rounds)&&c.rounds.length===5,'missing calibration rounds');for(const r of c.rounds){need(['start','end','pageEpoch','low','high','width'].every(k=>Number.isFinite(r[k]))&&r.end>=r.start&&r.width===r.end-r.start&&r.low===r.pageEpoch-r.end&&r.high===r.pageEpoch-r.start,'invalid calibration');}const best=c.rounds.reduce((a,b)=>!a||b.width<a.width?b:a,null);need(JSON.stringify(best)===JSON.stringify(c.best),'calibration best mismatch');return{rounds:c.rounds,best};}
 const clock=M.clockEnvelope(calibration(s.clockBefore),calibration(s.clockAfter));const w=M.windowEvidence(samples,s.load.startEpoch,s.load.endEpoch,clock);
 need(w.qualified===true,'recomputed window does not qualify');
 const compact=require('./cpu-preflight.cjs').compactWindow(w);need(JSON.stringify(compact)===JSON.stringify(s.window),'window summary mismatch');
 need(clock.low===s.clockEnvelope.low&&clock.high===s.clockEnvelope.high&&clock.width===s.clockEnvelope.width,'clock summary mismatch');
 return true;
}
module.exports={MEASUREMENT_SHA256,requireQualified,readSummary,validateRaw};
if(require.main===module){try{if(!process.env.GITHUB_SHA||!process.env.GITHUB_RUN_ID||!process.env.GITHUB_RUN_ATTEMPT)throw Error('Missing CI run binding');const s=readSummary(process.argv[2]),result=requireQualified(s,{commit:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT});const file=process.argv[3],stat=fs.statSync(file);if(!stat.isFile()||stat.size>1048576)throw Error('Raw file exceeds cap');validateRaw(s,fs.readFileSync(file));console.log(JSON.stringify(result));}catch(e){console.error(String(e.message).slice(0,800));process.exitCode=1;}}
