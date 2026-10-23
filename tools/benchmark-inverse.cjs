'use strict';
// Reproducible read-only comparison: fixed current physics, old/new search code.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),names=['math','physics','route-rules','route-sampler','optimizer-core','optimizer'];
if(process.argv[2]!=='--worker'){
 const strategy=process.argv[3]||'hybrid';if(!['hybrid','analytic'].includes(strategy))throw Error('Invalid input strategy');const revision=process.argv[2]||'86cf061';if(!/^[a-f0-9]{7,40}$/.test(revision))throw Error('Supply a commit hash.');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'billiard-inverse-'));
 try{
  for(const mode of ['before','after']){fs.mkdirSync(path.join(directory,mode));for(const name of names){let source;
   if(mode==='before'&&['route-sampler','optimizer-core','optimizer'].includes(name)){const r=spawnSync('git',['show',revision+':src/'+name+'.js'],{cwd:root,encoding:'utf8'});if(r.status)throw Error(r.stderr);source=r.stdout;}else source=fs.readFileSync(path.join(root,'src',name+'.js'));
   fs.writeFileSync(path.join(directory,mode,name+'.js'),source);
  }}
  const results={baseline:revision,inputStrategy:strategy,budgets:[48],physics:'same frozen current source for both',rows:{}};
  for(const mode of ['before','after']){const r=spawnSync(process.execPath,[__filename,'--worker',mode,directory,strategy],{cwd:root,encoding:'utf8',maxBuffer:4e6});if(r.status!==0||r.signal||r.error)throw Error(JSON.stringify({mode,status:r.status,signal:r.signal,error:String(r.error||''),stderr:r.stderr}));results.rows[mode]=JSON.parse(r.stdout);}
  process.stdout.write(JSON.stringify(results,null,2)+'\n');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}else{
 const mode=process.argv[3],directory=process.argv[4],R=require(path.join(root,'vendor/rapier.cjs'));
 for(const name of names)vm.runInThisContext(fs.readFileSync(path.join(directory,mode,name+'.js'),'utf8'));
 (async()=>{await R.init();const rows=[];
 for(const fixture of ['default','shifted','corner']){
  const lab=new PhysicsLab(R);if(fixture==='shifted'){const b=lab.get(2);b.body.setTranslation({x:.17,y:b.radius+.00005,z:.16},true);lab.world.propagateModifiedBodyPositionsToColliders();}
  if(fixture==='corner'){const cue=lab.get(1);cue.body.setTranslation({x:-1.37,y:cue.radius+.00005,z:-.66},true);lab.get(2).body.setTranslation({x:-.7,y:cue.radius+.00005,z:.01},true);lab.world.propagateModifiedBodyPositionsToColliders();}
  const req={snapshot:lab.snapshot({trails:false}),selectedId:1,settings:{angle:0,elevation:8,speed:2,tipX:0,tipY:0},options:{mode:'three',methods:['any'],order:'either',targetId:2,secondId:3,budget:48,horizon:16,spin:true,objective:'shortest',allowKiss:true,inputStrategy:process.argv[5]||'hybrid'}};
  if(fixture==='corner'){req.settings={angle:45,elevation:0,speed:2,tipX:0,tipY:0};req.options={...req.options,mode:'target',methods:undefined,horizon:8,elevationMode:'search',minElevation:0,maxElevation:60};}
  const start=performance.now(),cpu=process.cpuUsage(),s=LabOptimizer.createSearch(R,req);let first=null;
  try{while(!LabOptimizer.advanceSearch(s,960)){const p=LabOptimizer.progress(s);if(first===null&&p.found)first=p.tested;}
   const r=LabOptimizer.finishSearch(s),used=process.cpuUsage(cpu);rows.push({fixture,budget:48,tested:r.tested,successes:r.results.length,firstSuccessCandidate:first,elapsedMs:Math.round(performance.now()-start),cpuMs:Math.round((used.user+used.system)/1000),closestFailedGapM:Math.min(...(s.groups||[s]).map(g=>g.bestMiss?.clearance??Infinity)),solver:(s.groups||[s]).map(g=>g.solverStats||null),seedMaxOrder:r.seedMaxOrder??null,analytic:r.analyticStats??null,feasibility:r.feasibilityStats??null});
  }finally{LabOptimizer.disposeSearch(s);lab.dispose();}
 }
 process.stdout.write(JSON.stringify(rows));})().catch(e=>{console.error(e);process.exitCode=1;});
}
