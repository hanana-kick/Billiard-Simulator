'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const R=require('../tools/run-original-world-regressions.cjs');
function fixture(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'original-world-runner-')),env={};
  for(const k of R.required){env[k]=path.join(dir,k);fs.writeFileSync(env[k],'fixture');}
  for(const k of R.manifested)fs.writeFileSync(env[k]+'.json','{}');
  for(const t of R.tests){const p=path.join(dir,t);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'fixture');}
  return{dir,env,close:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test('world runner requires all three exact whole-shot suites and actual WGSL serially',()=>{
  const f=fixture();try{
    const p=R.plan({...f.env,REQUIRE_WEBGPU:'0'},f.dir);
    assert.deepEqual(p.args,['--test','--test-concurrency=1',...R.tests]);
    assert.equal(R.tests.length,3);assert.equal(p.options.env.REQUIRE_WEBGPU,'1');
    for(const key of R.required)assert.equal(p.options.env[key],f.env[key]);
  }finally{f.close();}
});
test('missing inputs, manifests or suite cannot silently reduce the regression scope',()=>{
  const f=fixture();try{
    for(const key of R.required){const env={...f.env};delete env[key];assert.throws(()=>R.plan(env,f.dir),new RegExp(key));}
    for(const key of R.manifested){const p=f.env[key]+'.json';fs.unlinkSync(p);assert.throws(()=>R.plan(f.env,f.dir),/manifest/);fs.writeFileSync(p,'{}');}
    fs.unlinkSync(path.join(f.dir,R.tests[2]));let launched=false;
    assert.equal(R.run(f.env,()=>{launched=true;return{status:0};},{log(){},error(){}},f.dir),2);assert.equal(launched,false);
  }finally{f.close();}
});
test('runner preserves failing, signalled and failed-launch outcomes',()=>{
  const f=fixture(),log={log(){},error(){}};try{
    assert.equal(R.run(f.env,()=>({status:7}),log,f.dir),7);
    assert.equal(R.run(f.env,()=>({status:null,signal:'SIGTERM'}),log,f.dir),1);
    assert.equal(R.run(f.env,()=>({error:new Error('launch failed')}),log,f.dir),1);
  }finally{f.close();}
});
