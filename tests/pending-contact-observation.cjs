'use strict';
// Isolated exact-method protocol tests, not a native numerical parity claim.
// Native phase recurrence tests separately invoke the real stage instances.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const copy=structuredClone,h=index=>({index,generation:0});
function harness(kind,{ccd=false,graphOnly=false,solved=true,geometryComplete=false}={}){
 const text=fs.readFileSync(require.resolve('../src/experimental-'+kind+'-contact-stage'),'utf8');
 const method=text.match(/pendingContactSnapshot\(token,pass\)\{[\s\S]*?\n\},/)[0].slice(0,-1);
 const freeze=text.match(/function freezeContactObservation\(value\)\{[^\n]+/)[0];
 const token={},pass={},cache={pairPresent:1,pointPresent:1,active:1,impulse:7,warmWorld:[1,2,3]},old={...copy(cache),impulse:1};
 const pending={solved,geometryComplete,graphOnly,pass:ccd?pass:undefined,s:{...copy(cache),cushions:[copy(cache)]},d:{pair:copy(cache),cushions:[copy(cache)]}};
 const env={busy:false,disposed:false,pending,outer:ccd?{cap:{},passIndex:2}:null,backend:'cpu-reference',
  seed:{bodies:[{pairCollider:h(10)},{pairCollider:h(11)}],ballCollider:h(10),cushions:[{colliderHandle:h(4)}]},
  current:{pair:old,cushions:[old]},copy,pairState:s=>copy(Object.fromEntries(Object.keys(cache).map(k=>[k,s[k]]))),
  access(t){assert.equal(t,token,'private source owner');},selected:{final:true,passIndex:2},ccdAuthority(){return{assertPass(p,b,c){assert.equal(p,pass,'source pass identity');assert.equal(b,env.backend);assert.equal(c,env.outer.cap);return env.selected;}}}};
 const reader=new Function('env',`with(env){${freeze};return ({${method}}).pendingContactSnapshot;}`)(env);
 return{env,token,pass,read:()=>reader(token,ccd?pass:undefined),reader,cache,pending};
}
for(const kind of ['pair','cushion']){
 test(kind+' pending reader returns owned frozen solved caches, not stale current caches',()=>{
  const x=harness(kind),before=copy(x.env.pending),out=x.read();assert.equal(out.contacts[0].cache.impulse,7);assert.equal(out.publication,'owner-only-uncommitted');assert.equal(out.ccdPassIndex,null);assert.deepEqual(x.env.pending,before);
  assert.throws(()=>{out.contacts[0].cache.warmWorld[0]=99;},TypeError);assert.deepEqual(x.env.pending,before);
  x.env.pending.s.impulse=9;x.env.pending.s.cushions[0].impulse=9;assert.equal(out.contacts[0].cache.impulse,7,'no source alias');
  x.env.pending=null;assert.throws(x.read,/pending/);assert.equal(out.contacts[0].cache.impulse,7,'detached data lifetime is independent, never auto-published');
  assert.throws(()=>x.reader({}),/private source owner/);
 });
 test(kind+' pending reader rejects unsealed, busy, aborted and disposed state without mutation or callbacks',()=>{
  for(const mutate of [e=>e.pending.solved=false,e=>e.busy=true,e=>e.pending=null,e=>e.disposed=true]){
   const x=harness(kind);mutate(x.env);const before=copy(x.env.pending);assert.throws(x.read,/pending/);assert.deepEqual(x.env.pending,before);
  }
  const x=harness(kind);assert.throws(()=>x.reader(x.token,{}),/owned outer/);
 });
 test(kind+' CCD reader requires matching final pending pass, not earlier current/intermediate pass',()=>{
  const x=harness(kind,{ccd:true}),out=x.read();assert.equal(out.ccdPassIndex,2);assert.equal(out.contacts[0].cache.impulse,7);
  for(const mutate of [e=>e.selected.final=false,e=>e.selected.passIndex=1,e=>e.pending.pass={}]){
   const y=harness(kind,{ccd:true});mutate(y.env);const before=copy(y.env.pending);assert.throws(y.read,/final pending/);assert.deepEqual(y.env.pending,before);
  }
  assert.throws(()=>x.reader(x.token,{}),/pass identity/);
 });
 test(kind+' graph-only retained cache is detached and explicitly uncommitted',()=>{
  const x=harness(kind,{graphOnly:true,solved:false});assert.equal(x.read().contacts[0].cache.impulse,7);
 });
}
test('inactive geometry-complete pair cache is readable without pretending it was numerically solved',()=>{
 const x=harness('pair',{solved:false,geometryComplete:true});x.env.pending.s.active=0;
 assert.equal(x.read().contacts[0].cache.active,0);assert.equal(x.read().contacts[0].cache.impulse,7,'raw retained positive impulse is not erased based on solver activity');
});
for(const kind of ['pair','cushion'])test(kind+' reader observes authenticated coupled adoption rather than pre-solve/current caches',async()=>{
 const x=harness(kind,{solved:false}),source=fs.readFileSync(require.resolve('../src/experimental-'+kind+'-contact-stage'),'utf8');
 const method=source.match(/async acceptCoupledSolve\(receipt,token,pass\)\{[\s\S]*?\},bindGraph/)[0].replace(/,bindGraph$/,'');
 const BODY=new Function('return '+source.match(/const BODY=(\[[^\n]+?\]);/)[1])(),list=kind==='pair'?'FLOOR':'CACHE';
 const fields=new Function('return '+source.match(new RegExp('const '+list+'=(\\[[^\\n]+?\\]);'))[1])();
 const state=Object.fromEntries(BODY.map(k=>[k,0]));Object.assign(state,{translation:[1,2,3],linear:[4,5,6],impulse:55,force:[0,0,0]});
 const receipt={},transaction={},owner={},out=kind==='pair'?{states:[copy(state),copy(state)],pair:{...copy(x.cache),impulse:23}}:{state,cushions:[{...copy(x.cache),impulse:23}]};
 Object.assign(x.env,{BODY,[list]:fields,coupledOwner:owner,coupledApi(){return{readResult(r,o,api,b,t,p){assert.equal(r,receipt);assert.equal(o,owner);assert.equal(t,transaction);assert.equal(p,undefined);return copy(out);}};},api:{},stages:{fat:{async step(){return{fatMin1:[0,0,0],fatMax1:[1,1,1],fatMin2:[0,0,0],fatMax2:[1,1,1],ballMin:[0,0,0],ballMax:[1,1,1]};}}},queryState:()=>({})});
 Object.assign(x.env.pending,{geometryMode:true,graphTransaction:transaction});Object.assign(x.env.pending.s,{bodies:[{},{}],floorContacts:[{},{}],body:{},floor:{},topology:{}});
 const accept=new Function('env',`with(env){return ({${method}}).acceptCoupledSolve;}`)(x.env);
 assert.throws(x.read,/pending/);await accept(receipt,x.token);const observed=x.read();assert.equal(observed.contacts[0].cache.impulse,23);assert.equal(x.env.current.pair.impulse,1);assert.equal(observed.publication,'owner-only-uncommitted');
});
