import{test}from'node:test';import assert from'node:assert/strict';
import{generateApplicationWGSL}from'../src/resident-candidate/application.mjs';
import{generateNarrowphaseWGSL}from'../src/resident-candidate/narrowphase.mjs';
import{generateSceneActivationWGSL}from'../src/resident-candidate/scene-activation.mjs';
import{generateCueClothCacheWGSL}from'../src/resident-candidate/cue-cloth-cache.mjs';
const words=new Uint32Array(1),floats=new Float32Array(words.buffer),number=w=>(words[0]=w,floats[0]);
function functionText(code,name){const begin=code.indexOf('fn '+name+'('),open=code.indexOf('{',begin);assert.ok(begin>=0);let depth=1,end=open+1;for(;depth;end++){if(code[end]==='{')depth++;if(code[end]==='}')depth--;}return code.slice(begin,end);}
function dialect(code){return code.replace(/fn (\w+)\(([^)]*)\)(?:->(?:u32|bool))?\s*\{/g,(_,n,args)=>`function ${n}(${args.replace(/:(?:u32|bool)/g,'')}){`).replace(/\b(0x[0-9a-f]+|\d+)u\b/g,'$1').replace(/\bvar\b/g,'let');}
function samples(){const result=[0,0x80000000,1,2,0x7fffff,0x800001,0x80000001,0x807fffff,0x80800000,0x3f800000,0xbf800000,0x7f7fffff,0xff7fffff,0x7f800000,0xff800000,0x7fc00001,0xffc00001];let seed=0x348e1245;for(let i=0;i<50000;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;result.push(seed>>>0);}return result;}
test('actual application positive-impulse helper preserves signed subnormals and rejects nonfinite before positivity',()=>{
 const source=functionText(generateApplicationWGSL(),'rc_app_impact'),state=new Uint32Array(32);state[8]=1;state[9]=16;state[10]=1;
 assert.doesNotMatch(source,/bitcast<f32>/);
 const run=new Function('rc_state','rc_jr','rc_jc','rc_jfind','rc_app_view','rc_app_fail',dialect(source)+';return rc_app_impact;')(state,(_,x)=>x,x=>x,()=>0,()=>4,(a,s)=>state[a]=s);
 for(const word of samples()){state[0]=0;state[16]=word;const value=number(word),finite=Number.isFinite(value);assert.equal(run(0,0,0,1,2),finite&&value>0,'source impulse predicate '+word.toString(16));assert.equal(state[0],finite?0:4,'source nonfinite failure');}
});
test('actual floor/pair/convex contact-ID zero predicates match source Number equality for every tested bit pattern',()=>{
 const code=generateNarrowphaseWGSL();assert.doesNotMatch(code,/bitcast<f32>\(rc_state\[base\+(?:70|167|291)u\]\)==0\.0/);
 for(const[destination,input]of[[136,70],[322,167],[386,291]]){
  const pattern=new RegExp('rc_state\\[base\\+'+destination+'u\\]=select\\([^;]+;'),statement=code.match(pattern)?.[0];assert.ok(statement);
  const run=new Function('rc_state','base','select',dialect(statement)),state=new Uint32Array(400);
  for(const word of samples()){state[input]=word;run(state,0,(a,b,p)=>p?b:a);assert.equal(state[destination],number(word)===0?0x80000000:0,'contact ID '+destination+' '+word.toString(16));}
 }
});
test('actual cloth binding and nonnegative cache guards reject subnormal violations and preserve negative zero',()=>{
 const code=generateCueClothCacheWGSL(),state=new Uint32Array(1024),cue=500;
 const kernel=name=>new Function('rc_state','rc_cloth_fail','select',dialect(functionText(code,name))+';return '+name+';')(state,(b,reason)=>state[b]=reason,(a,b,p)=>p?b:a);
 const bind=kernel('rc_cloth_bind_cue'),complete=kernel('rc_cloth_complete');
 for(const word of samples().slice(0,5017)){
  state.fill(0);state[1]=2;state[159]=1;state[cue+2]=1;state[cue+12]=1;state[96]=word;state[97]=0x3f800000;
  bind(0,cue);assert.equal(state[0],number(word)===0?0:3,'cloth normal must actually be vertical');
  state.fill(0);state[1]=2;state[159]=1;state[cue+2]=1;state[cue+15]=1;state[cue+208+19]=word;
  complete(0,cue);const value=number(word),valid=Number.isFinite(value)&&value>=0;assert.equal(state[0],valid?0:4,'negative subnormal is not nonnegative');if(valid&&value===0)assert.equal(state[148],0,'source cache canonically writes +0');
 }
});

test('actual scene sleep/split timer helpers implement IEEE comparisons without hardware float operands',()=>{
 const code=generateSceneActivationWGSL(),gtSource=functionText(code,'rc_scene_float_gt'),eqSource=functionText(code,'rc_scene_float_eq');assert.doesNotMatch(gtSource+eqSource,/bitcast|\bf32\b/);
 const gt=new Function(dialect(gtSource)+';return rc_scene_float_gt;')(),eq=new Function(dialect(eqSource)+';return rc_scene_float_eq;')(),all=samples();
 const check=(a,b)=>{assert.equal(gt(a,b),number(a)>number(b),'timer greater '+a.toString(16)+' '+b.toString(16));assert.equal(eq(a,b),number(a)===number(b),'timer equal '+a.toString(16)+' '+b.toString(16));};
 for(const a of all.slice(0,17))for(const b of all.slice(0,17))check(a,b);
 for(let i=0;i<all.length;i++){check(all[i],all[(i*67+19)%all.length]);check(all[i],all[i]);check(all[i],(all[i]^0x80000000)>>>0);}
 assert.equal(gt(1,0),true);assert.equal(gt(0,0x80000001),true);assert.equal(eq(0,0x80000000),true);assert.equal(eq(0x7f800000,0x7f800000),true);assert.equal(eq(0x7fc00001,0x7fc00001),false);
});
test('actual cloth contact-ID zero predicate preserves subnormal warm contact identity and signed-zero births',()=>{
 const code=generateCueClothCacheWGSL(),statement=code.match(/rc_state\[b\+161u\]=select\([^;]+;/)?.[0];assert.ok(statement);assert.doesNotMatch(statement,/bitcast|\bf32\b/);const run=new Function('rc_state','b','select',dialect(statement)),state=new Uint32Array(288);
 for(const word of samples()){state[148]=word;run(state,0,(a,b,p)=>p?b:a);assert.equal(state[161],number(word)===0?0x80000000:0,'original c.impulse===0 contact identity '+word.toString(16));assert.equal(state[148],word,'predicate never changes cached impulse');}
});
