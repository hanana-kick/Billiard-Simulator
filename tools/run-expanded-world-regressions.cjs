'use strict';
// Serial acceptance for six bounded original scenarios, never a general-engine claim.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const Base=require('./run-original-world-regressions.cjs');
const root=path.resolve(__dirname,'..');
const additions=Object.freeze([
  {key:'FOUR_BALL_SETTLED_TURN_REPLAY',test:'tests/experimental-settled-four-world.cjs',status:'native-second-rest-complete',extent:'second-full-rest'},
  {key:'FOUR_BALL_POSITIVE_GOAL_V8',test:'tests/experimental-goal-four-world.cjs',status:'native-rest-complete',outcome:'positive'},
  {key:'FOUR_BALL_LATE_OPPONENT_V8',test:'tests/experimental-goal-four-world.cjs',status:'native-rest-complete',outcome:'late-opponent-foul'},
]);
function plan(env=process.env,cwd=root){
  for(const key of ['SETTLED_MAX_H','GOAL_MAX_H','SETTLED_BACKEND','GOAL_BACKEND'])
    if(env[key]!==undefined)throw Error(`${key} is forbidden in full two-backend acceptance; use the individual diagnostic test instead.`);
  const base=Base.plan(env,cwd),runs=[{label:'original-three-fixed-shots',...base}];
  for(const c of additions){
    const file=env[c.key];
    if(!file||!path.isAbsolute(file)||!fs.statSync(file,{throwIfNoEntry:false})?.isFile())throw Error(c.key+' must be an existing absolute artifact');
    const m=JSON.parse(fs.readFileSync(file+'.json','utf8'));
    if(m.status!==c.status||c.extent&&m.captureExtent!==c.extent||c.outcome&&(m.probe!==false||m.decoded!==true||m.requiredOutcomeObserved!==true||m.input?.requiredOutcome!==c.outcome))throw Error(c.key+' is not a complete original-rest artifact for this scenario');
    if(!fs.statSync(path.join(cwd,c.test),{throwIfNoEntry:false})?.isFile())throw Error('Required suite missing: '+c.test);
    const caseEnv={...base.options.env};
    if(c.outcome)caseEnv.FOUR_BALL_GOAL_REPLAY=file;
    runs.push({label:c.outcome??'settled-next-turn',command:process.execPath,args:['--test','--test-concurrency=1',c.test],options:{cwd,env:caseEnv,stdio:'inherit'}});
  }
  return runs;
}
function run(env=process.env,launch=spawnSync,log=console,cwd=root){
  let runs;try{runs=plan(env,cwd);}catch(error){log.error(error.message);return 2;}
  for(const r of runs){log.log('Bounded CPU/native + actual WGSL world acceptance: '+r.label);const result=launch(r.command,r.args,r.options);if(result.error){log.error(result.error.message);return 1;}if(result.status!==0)return Number.isInteger(result.status)?result.status:1;}
  return 0;
}
if(require.main===module)process.exitCode=run();
module.exports={additions,plan,run};
