import{test}from'node:test';import assert from'node:assert/strict';
import{originalRegisteredFixture}from'./resident-candidate-original-fixture.mjs';
import{packCreatedWorldTemplate}from'../src/resident-candidate/world-state.mjs';
import{generateWorldHPlan,worldHCommands}from'../src/resident-candidate/world-h.mjs';
const builtins=new Set('if for while loop switch return select arrayLength min max abs clamp sqrt dot cross length normalize distance countLeadingZeros countTrailingZeros countOneBits extractBits insertBits reverseBits firstLeadingBit firstTrailingBit round trunc floor ceil sign all any workgroupBarrier storageBarrier bitcast f32 i32 u32 bool vec2 vec3 vec4 mat2x2 mat3x3 mat4x4 group binding workgroup_size builtin location align size interpolate invariant'.split(' '));
function closing(s,at){let depth=1;for(let i=at+1;i<s.length;i++){if(s[i]==='(')depth++;if(s[i]===')'&&!--depth)return i;}throw Error('Unbalanced generated call');}
function arity(s,signature=false){if(!s.trim())return 0;let n=1,depth=0;for(const c of s){if((signature?'(<[':'([').includes(c))depth++;if((signature?')>]':')]').includes(c))depth--;if(c===','&&depth===0)n++;}return n;}
function audit(code){
 const text=code.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g,s=>s.replace(/[^\n]/g,' '));
 const functions=new Map(),types=new Set([...text.matchAll(/\b(?:struct|alias)\s+(\w+)/g)].map(m=>m[1]));
 for(const m of text.matchAll(/\bfn\s+(\w+)\s*\(/g)){const open=m.index+m[0].length-1;assert.ok(!functions.has(m[1]),'duplicate function '+m[1]);functions.set(m[1],arity(text.slice(open+1,closing(text,open)),true));}
 for(const m of text.matchAll(/\b(\w+)\s*\(/g)){
  if(/\bfn\s*$/.test(text.slice(Math.max(0,m.index-8),m.index))||builtins.has(m[1])||types.has(m[1]))continue;
  assert.ok(functions.has(m[1]),'undefined helper '+m[1]);const open=m.index+m[0].length-1;assert.equal(arity(text.slice(open+1,closing(text,open))),functions.get(m[1]),'call arity '+m[1]);
 }
 if(functions.has('rc_num_eval')){assert.match(text,/RC_NUMERIC_IMPLEMENTATION_PROFILE:u32=2u/);assert.match(text,/fn rc_num_soft_arithmetic/);}
 assert.doesNotMatch(text,/RC_NUMERIC_IMPLEMENTATION_PROFILE:u32=1u/);
}
let pending;const fixture=()=>pending??=(async()=>{const{seed}=await originalRegisteredFixture();return packCreatedWorldTemplate(seed,{rule:{firstId:3,secondId:4,method:'none',allowKiss:true,maxOuterSteps:12000}});})();
test('actual whole-h generated pipelines resolve helper names/arity and select one preserved VM profile',async()=>{
 const plan=generateWorldHPlan(await fixture(),{count:1});
 for(const pipeline of plan.pipelines)assert.doesNotThrow(()=>audit(pipeline.code),pipeline.name);
 assert.equal(plan.capability.nativeWholeHQualified,false);assert.equal(plan.capability.fullRestQualified,false);
 assert.ok([...worldHCommands(plan)].length>plan.pipelines.length,'immutable capacity schedule, not a numerical parity result');
});
test('whole-h cue call boundaries preserve actual deferred solve and pre/post source checks',async()=>{
 const t=await fixture(),plan=generateWorldHPlan(t,{count:1}),at=name=>plan.pipelines.findIndex(p=>p.name===name),q=t.segments.cue.offset,b=t.segments.bodies.offset,other=t.segments.others.offset,p=t.programOffsets.cue;
 const code=name=>plan.pipelines[at(name)].code;
 assert.ok(at('cue-application-done')<at('scene-after-cue'));
 assert.ok(at('scene-after-cue')<at('cue-pre-ccd-0'));
 assert.ok(at('narrow-commit')<at('cue-joint-begin'));
 assert.ok(at('solver-prepare')<at('cue-joint-begin'));
 assert.ok(at('cue-joint-done')<at('cue-post-ccd-0'));
 assert.ok(at('cue-post-ccd-1')<at('ball-solver-gather'));
 assert.ok(code('cue-application-prepare').includes(`rc_cue_prepare(bank+${q}u,bank+${b}u+${t.selectedIndex*64}u,bank+${other}u,3u,${p}u,scratch)`));
 assert.ok(code('cue-joint-source').includes(`rc_cue_source(bank+${q}u,${p}u)`));
 assert.ok(code('cue-joint-scatter').includes(`rc_cue_scatter(bank+${q}u,bank+${b}u+${t.selectedIndex*64}u,${p}u,scratch)`));
});
