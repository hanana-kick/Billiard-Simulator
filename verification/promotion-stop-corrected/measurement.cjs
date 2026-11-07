'use strict';
const defaultNow=()=>Number(process.hrtime.bigint())/1e6;
const defaultSleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function startProcessSampler({cdp,now=defaultNow,sleep=defaultSleep,intervalMs=100}){
 const samples=[];let running=true,pending=null;
 const done=(async()=>{while(running){const start=now();pending={start};let processes,error;try{processes=(await cdp.send('SystemInfo.getProcessInfo')).processInfo;}catch(e){error=String(e);}const end=now();samples.push({start,end,processes,error});pending=null;if(running)await sleep(Math.max(0,intervalMs-(end-start)));}})();
 return {samples,stop:async({timeoutMs=5000}={})=>{running=false;let timer;const settled=await Promise.race([done.then(()=>true),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),timeoutMs);})]);clearTimeout(timer);if(!settled)samples.push({start:pending?.start??now(),end:now(),incomplete:true,error:'Sampler stop deadline while CDP acquisition pending; no replacement poll issued'});return [...samples];}};
}
async function calibrate({readPageEpoch,now=defaultNow,rounds=5}){
 const roundsObserved=[];for(let i=0;i<rounds;i++){const start=now(),pageEpoch=await readPageEpoch(),end=now();roundsObserved.push({start,end,pageEpoch,low:pageEpoch-end,high:pageEpoch-start,width:end-start});}
 const best=roundsObserved.reduce((a,b)=>!a||b.width<a.width?b:a,null);return {rounds:roundsObserved,best};
}
function clockEnvelope(before,after){
 if(!before?.best||!after?.best)return {qualified:false,reason:'Missing before/after calibration'};
 const a=before.best,b=after.best,low=Math.min(a.low,b.low),high=Math.max(a.high,b.high);
 return {low,high,width:high-low,before:a,after:b,driftIntervalMs:[b.low-a.high,b.high-a.low],midpointDriftMs:(b.low+b.high-a.low-a.high)/2,qualified:high-low<=250,assumption:'Offset throughout case bounded by observed endpoint envelope; intra-case clock movement cannot be excluded'};
}
function processDelta(a,b){
 const pa=new Map((a.processes||[]).map(p=>[String(p.id),p])),pb=new Map((b.processes||[]).map(p=>[String(p.id),p]));let sum=0,n=0;const exits=[],newIds=[],resets=[],invalidCounters=[];
 for(const[id,p]of pa){const q=pb.get(id);if(!q){exits.push(id);continue;}if(!Number.isFinite(p.cpuTime)||!Number.isFinite(q.cpuTime)){invalidCounters.push(id);continue;}if(q.cpuTime<p.cpuTime||p.type!==q.type){resets.push(id);continue;}sum+=q.cpuTime-p.cpuTime;n++;}for(const id of pb.keys())if(!pa.has(id))newIds.push(id);
 return {cpuSeconds:n?sum:null,commonProcesses:n,exits,newIds,resets,invalidCounters};
}
function windowEvidence(samples,pageStart,pageEnd,clock){
 if(!Number.isFinite(pageStart)||!Number.isFinite(pageEnd)||!Number.isFinite(clock?.low)||!Number.isFinite(clock?.high))return {qualified:false,reason:'Missing endpoint or calibration',inner:null,outer:null};
 const start=[pageStart-clock.high,pageStart-clock.low],end=[pageEnd-clock.high,pageEnd-clock.low],valid=samples.filter(s=>Array.isArray(s.processes)).sort((a,b)=>a.start-b.start),contained=valid.filter(s=>s.start>=start[1]&&s.end<=end[0]);
 const summarize=rows=>{let cpu=0,n=0;const exits=[],resets=[];for(let i=1;i<rows.length;i++){const d=processDelta(rows[i-1],rows[i]);if(d.cpuSeconds!==null){cpu+=d.cpuSeconds;n++;}exits.push(...d.exits);resets.push(...d.resets);}return {cpuSecondsLowerBound:n?cpu:null,intervals:n,observedSpanMs:rows.length>1?rows.at(-1).end-rows[0].end:null,first:rows[0]||null,last:rows.at(-1)||null,exitedProcessIds:[...new Set(exits)],resetProcessIds:[...new Set(resets)]};};
 const before=valid.filter(s=>s.end<=start[0]).at(-1),after=valid.find(s=>s.start>=end[1]);const outer=before&&after?summarize(valid.filter(s=>s.start>=before.start&&s.end<=after.end)):null;
 const near=valid.filter(s=>s.end>=start[0]&&s.start<=end[1]);const gaps=near.slice(1).map((s,i)=>s.start-near[i].end),widths=near.map(s=>s.end-s.start);const maxGapMs=gaps.length?Math.max(...gaps):null,maxAcquisitionMs=widths.length?Math.max(...widths):null;
 const bracketWidths=before&&after&&contained.length?[contained[0].end-before.start,after.end-contained.at(-1).start]:null;
 const inner=summarize(contained),incomplete=samples.some(s=>s.incomplete&&s.start<=end[1]&&s.end>=start[0]);const qualified=!incomplete&&Number.isFinite(inner.cpuSecondsLowerBound)&&inner.intervals>=1&&!!clock.qualified&&!!bracketWidths&&bracketWidths.every(x=>x<=250)&&maxGapMs!==null&&maxGapMs<=250&&maxAcquisitionMs<=250;
 return {qualified,startHostInterval:start,endHostInterval:end,clock,maxGapMs,maxAcquisitionMs,bracketWidthsMs:bracketWidths,incompleteAcquisition:incomplete,inner,outer,limitation:'No interpolation. Outer observed cost is not a total CPU upper bound; exited-process final increments and unobserved PID reuse remain unknown. Shared-process CPU, not per-worker.'};
}
async function stopIfSearching(page){
 const snapshot=()=>page.evaluate(()=>{const c=cueLab,o=c.optimizer;return {at:performance.timeOrigin+performance.now(),status:c.state.routeStatus,workerId:o?.worker?.__promotionId??null,version:o?.version??null,termination:c.state.routeResult?.terminationReason??null,results:(globalThis.__promotionAudit?.events||[]).filter(e=>e.type==='worker-receive'&&e.messageType==='result').map(e=>({at:e.at,workerId:e.workerId,requestId:e.requestId,termination:e.termination}))};});
 const before=await snapshot();if(before.status!=='searching')return {clicked:false,before,reason:'Not searching at current guard observation; cause not inferred'};
 try{await page.locator('#cancelRoute').click();const after=await snapshot();if(after.status==='searching')throw Error('Stop click returned but search remains active');return {clicked:true,before,after};}
 catch(error){const after=await snapshot(),result=after.results.find(e=>e.at>=before.at&&e.at<=after.at&&e.workerId===before.workerId&&e.requestId===before.version);if(error?.name==='TimeoutError'&&after.status==='done'&&before.workerId&&result&&await page.locator('#cancelRoute').count()===0)return {clicked:false,before,after,result,reason:'Matching genuine current-epoch result completed search and removed Stop during click wait',naturalCompletionProven:true,timeoutObserved:true};throw error;}
}

module.exports={startProcessSampler,calibrate,clockEnvelope,processDelta,windowEvidence,stopIfSearching};
