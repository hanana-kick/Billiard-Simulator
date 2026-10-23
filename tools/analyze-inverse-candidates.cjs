'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),revision=process.argv[2]||'current';if(revision!=='current'&&!/^[a-f0-9]{7,40}$/.test(revision))throw Error('Invalid revision');
const R=require('../vendor/rapier.cjs');globalThis.__trialRows=[];
for(const n of ['math','physics','route-rules','route-sampler','optimizer-core','optimizer']){
 let source=revision!=='current'&&['route-sampler','optimizer-core','optimizer'].includes(n)?cp.execFileSync('git',['show',`${revision}:src/${n}.js`],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,'src',n+'.js'),'utf8');
 if(n==='optimizer-core'){
  source=source.replace('t.lab.step();t.steps++;',`if(!t.firstHit){const ball=t.lab.get(req.selectedId);t.beforeFirstState={position:{...ball.body.translation()},velocity:{...ball.body.linvel()},spin:{...ball.body.angvel()}};}t.lab.step();t.steps++;`);
  source=source.replace('search.pool=search.pool.slice(0,18);',`search.pool=search.pool.slice(0,18);globalThis.__trialRows.push({...result,cpuAtFinishMs:(process.cpuUsage(globalThis.__traceCpu).user+process.cpuUsage(globalThis.__traceCpu).system)/1000,elapsedAtFinishMs:performance.now()-globalThis.__traceStart,physicsSteps:t.steps,globalIndex:globalThis.__trialRows.length+1,localIndex:search.count,firstTarget:search.req.options.targetId,firstState:t.beforeFirstState,invalid:t.invalid,cueObstructed:!!t.cueObstructed});`);
 }
 vm.runInThisContext(source);
}
(async()=>{await R.init();const lab=new PhysicsLab(R),req={snapshot:lab.snapshot({trails:false}),selectedId:1,settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0},options:{mode:'three',methods:['any'],order:'either',targetId:2,secondId:3,budget:48,horizon:16,spin:true,objective:'shortest',allowKiss:true}};
 req.options.inputStrategy=process.argv[3]||'hybrid';globalThis.__traceStart=performance.now();globalThis.__traceCpu=process.cpuUsage();const start=performance.now(),cpu=process.cpuUsage(),search=LabOptimizer.createSearch(R,req);try{while(!LabOptimizer.advanceSearch(search,960));const result=LabOptimizer.finishSearch(search),used=process.cpuUsage(cpu);process.stdout.write(JSON.stringify({revision,elapsedMs:performance.now()-start,cpuMs:(used.user+used.system)/1000,summary:{tested:result.tested,successes:result.results.length,firstSuccess:globalThis.__trialRows.find(r=>r.success)?.globalIndex??null},analyticSeeds:search.groups.map(g=>({firstId:g.req.options.targetId,seeds:g.analyticSeeds||[]})),rows:globalThis.__trialRows},null,2));}finally{LabOptimizer.disposeSearch(search);lab.dispose();}})().catch(e=>{console.error(e);process.exitCode=1;});
