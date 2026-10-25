/* SPDX-License-Identifier: Apache-2.0
 * Resident continuation of the original Rapier/Parry four-pass CCD controller.
 * Source numerical builders and the original proxy-distance WGSL are reused;
 * no CPU numerical continuation and no independent substitute collision model.
 */
import Checker from '../experimental-ccd-inactive.js';
import Schedule from '../experimental-ccd-substep.js';
import MathStage from '../experimental-ccd-sweep-math.js';
import Fixed from '../experimental-ccd-fixed-sphere.js';
import Proxy from '../experimental-ccd-proxy-distance-kernel.js';
import Reducers from '../experimental-ccd-proxy-distance-reducers.js';
import {compileGraph} from './numeric-program.mjs';

export const CCD_LAYOUT=Object.freeze({words:1280,gjk:1024,gjkWords:152,continuation:896,continuationWords:64,bodyContinuation:976,bodyContinuationWords:48,header:0,body:32,bodyWords:80,result:352,resultWords:24,work:448,workWords:256,out:704,query:768});
export const CCD_STATUS=Object.freeze({OK:0,NUMERIC:1,UNSUPPORTED:2,INVALID:3,PHASE:4,CAPACITY:5});
export const CCD_PHASE=Object.freeze({IDLE:0,COLLISION:1,SOLVE:2,COMPLETE:3});
export const CCD_HEADER=Object.freeze({error:0,phase:1,pass:2,steps:3,remaining:4,collisionDt:5,solveDt:6,minDt:7,outerDt:8,firstImpact:9,hasImpact:10,afterTime:11,afterSteps:12,postPrepared:13,controllerPhase:14,bodyCursor:15,activeOrder:16,activeCount:17,fixedSeed:18,bvhBase:19,currentBody:20});
export const CCD_BODY_OFFSETS=Object.freeze({linear:0,angular:3,translation:6,rotation:9,force:13,torque:16,invMass:19,invInertia:22,localCom:31,maxExtent:34,thickness:35,dt:36,nextTranslation:37,nextRotation:40,principalFrame:64,invPrincipalInertia:68,sleeping:71});
export const CCD_RESULT_OFFSETS=Object.freeze({fraction:0,active:1,clamped:2,translation:4,rotation:7,invInertia:11,distanceQueries:20,rootIterations:21,pushBacks:22,winningLeaf:23});
export const CCD_CAPABILITY=Object.freeze({sourceSchedule:true,sourceSweep:true,sourceProxyDistance:true,sourceBvhOrder:true,postCueOnly:true,maxBodies:4,maxPasses:4,hostForwardFallback:false,numericalParity:'independent-native-gate-required',postAngleDomain:Checker.CAPABILITY.atanDomain});
const bits=x=>new Uint32Array(Float32Array.of(x).buffer)[0];
const words=x=>new Uint32Array(Float32Array.from(x).buffer);
const key=h=>h.index+':'+h.generation;

/** Immutable seed packing only. The original validator remains the authority. */
export function packFixedCcdSeed(input){
 const s=Fixed.validate(input);if(s.movingColliders.length!==8)throw RangeError('Resident CCD requires the real four-ball roster');
 const groups=(a,b)=>{if(a.test_mode!=='And'||b.test_mode!=='And')throw RangeError('Original AND collision groups required');return(a.memberships&b.filter)!==0&&(b.memberships&a.filter)!==0;};
 for(const moving of s.movingColliders)for(const target of s.statics)if(groups(moving.flags.collision_groups,target.collider.flags.collision_groups)&&!groups(moving.flags.solver_groups,target.collider.flags.solver_groups))throw RangeError('Pseudo CCD events unsupported');
 const bodies=[];for(const c of s.movingColliders){const k=key(c.parent.handle);if(!bodies.includes(k))bodies.push(k);}
 const out=Array(16+16*24+8*8).fill(0);out[0]=0x52434344;out[1]=1;out[2]=16;out[3]=8;out[4]=bits(s.lengthUnit);out[5]=bits(s.normalizedAllowedLinearError);
 s.statics.forEach((r,i)=>{const c=r.collider,a=16+i*24,p=out.length;out.push(...r.pointsA.flatMap(x=>Array.from(words(x))));out.splice(a,24,c.handle.index,c.handle.generation,r.pointsA.length,p,c.flags.collision_groups.memberships,c.flags.collision_groups.filter,c.flags.solver_groups.memberships,c.flags.solver_groups.filter,...Array.from(words([...c.pos.translation,...c.pos.rotation,...r.initialFatProxy.min,...r.initialFatProxy.max])),0,0,0);});
 s.movingColliders.forEach((c,i)=>out.splice(400+i*8,8,c.handle.index,bodies.indexOf(key(c.parent.handle)),c.flags.collision_groups.memberships,c.flags.collision_groups.filter,c.flags.solver_groups.memberships,c.flags.solver_groups.filter,bits(c.shape.value.radius),c.handle.generation));
 return Object.freeze({words:Uint32Array.from(out),bodyKeys:Object.freeze(bodies),pointCounts:Object.freeze([...new Set(s.statics.map(r=>r.pointsA.length))].sort((a,b)=>a-b)),source:s});
}
/** Same immutable roster assembly as experimental-four-ball-world.create. */
export function packRegisteredCcdSeed(seed){
 if(seed?.kind!=='original-live-registered-four-ball-created-world')throw RangeError('Original registered four-ball source seed required');
 const raw=seed.cueInitial.sourceCreation.created,same=(a,b)=>key(a)===key(b),copy=x=>structuredClone(x),ip=raw.integration;
 return packFixedCcdSeed({kind:'original-created-fixed-sphere-ccd',initialSnapshotSha256:raw.snapshotSha256,
  statics:seed.sceneRegistry.statics.map(r=>({bodyType:'Fixed',bodyHandle:r.body,collider:copy(raw.colliders.find(c=>same(c.handle,r.collider.handle))),initialFatProxy:copy(seed.staticProxies.find(p=>same(p.colliderHandle,r.collider.handle)))})),
  movingColliders:seed.balls.flatMap(b=>[b.collider,b.pairCollider].map(h=>copy(raw.colliders.find(c=>same(c.handle,h))))),lengthUnit:ip.length_unit,normalizedAllowedLinearError:ip.normalized_allowed_linear_error});
}
/** Authoritative current/next state import for tests or initial world assembly. */
export function packCcdBody(input,{principalFrame,invPrincipalInertia,sleeping=false}={}){
 Checker.validate(input,!!input.nextTranslation);if(!Array.isArray(principalFrame)||principalFrame.length!==4||!Array.isArray(invPrincipalInertia)||invPrincipalInertia.length!==3||invPrincipalInertia.some(x=>!Number.isFinite(x)||x!==Math.fround(x)||x<=0))throw RangeError('Original positive sphere inertia required');
 const out=new Uint32Array(80);out.set(new Uint32Array(Checker.pack(input).buffer));out.set(words(principalFrame),64);out.set(words(invPrincipalInertia),68);out[71]=Number(sleeping);return out;
}
export function packWorldCcdBody(s,next){return packCcdBody({kind:'dynamic-body-ccd-check',bodyType:'dynamic',sleeping:false,softFrame:false,...s.ccdBody,dt:s.dt,linear:s.linear,angular:s.angular,translation:s.translation,rotation:s.rotation,invMass:s.invMass,invInertia:s.invInertia,localCom:[0,0,0],force:s.force,...(next?{nextTranslation:next.translation,nextRotation:next.rotation}:{})},{principalFrame:s.principalFrame,invPrincipalInertia:s.invPrincipalInertia,sleeping:s.sleeping});}

export function createCcdPrograms({pointCounts=[8]}={}){
 if(!Array.isArray(pointCounts)||!pointCounts.length||pointCounts.some(n=>!Number.isInteger(n)||n<1||n>64)||new Set(pointCounts).size!==pointCounts.length)throw RangeError('Bounded immutable CCD point-count roster');
 const r=MathStage.sourceInput,v=(i,n=3)=>Array.from({length:n},(_,j)=>r(i+j));
 const a={localCenter:v(0),c1:v(3),c2:v(6),q1:v(9,4),q2:v(13,4)},b={localCenter:v(17),c1:v(20),c2:v(23),q1:v(26,4),q2:v(30,4)},common={a,b,t:r(34)};
 const checkerPlans=Checker.sourcePlans();
 const plans={pre:checkerPlans.pre,post:checkerPlans.post,schedule:{...Schedule.sourcePlan(),layout:{dt:{offset:0,length:1},remainingTime:{offset:1,length:1},remainingSubsteps:{offset:2,length:1}}}};
 const add=(name,kind,input,n=64)=>plans[name]=MathStage.buildSourcePlan(kind,input,{inputFloats:n});
 add('shift','shift',{a,b});add('target','target',{radiusA:r(35),radiusB:r(36),slop:r(37)});add('relative','relative',common);
 add('worldDistance','worldDistance',{...common,normal:v(38),pointA:v(41),pointB:v(44),radiusA:r(35),radiusB:r(36),origin:v(59)});
 add('face','face',{...common,points:[v(53),v(56),v(59)]});
 const sep={...common,witness1:v(47),witness2:v(50)};
 add('findFace','find',{...sep,type:'FaceA'});add('evaluateFace','evaluate',{...sep,type:'FaceA'});
 add('evaluateVertex','evaluate',{...sep,type:'Vertices',pointsA:[v(53)],indexA:0});
 for(const n of pointCounts)add('findVertices'+n,'find',{...sep,type:'Vertices',pointsA:Array.from({length:n},(_,i)=>v(64+i*3))},64+n*3);
 for(const method of ['bisect','false-position'])add(method==='bisect'?'rootBisect':'rootFalse','root',{method,a1:r(53),a2:r(54),s1:r(55),s2:r(56),target:r(57)});
 add('difference','difference',{a:r(53),b:r(54)});add('multiply','multiply',{a:r(53),b:r(54)});
 add('sphereBounds','sphereBounds',{c1:v(20),c2:v(23),radius:r(36)});
 add('predict','predictSphereCenter',{dt:r(36),localCenter:[0,0,0],translation:v(6),linear:v(0),force:v(13),invMass:v(19)});
 add('transform','transform',{sweep:b,t:r(34)});
 add('inertia','worldInvInertia',{rotation:v(0,4),principalFrame:v(4,4),invPrincipalInertia:v(8)});
 for(let i=0;i<3;i++)plans['reducer'+(i+2)]=Reducers.PLANS[i];
 let length=0,scratchWords=0;const entries={};Object.entries(plans).forEach(([name,plan],id)=>{const compiled=compileGraph(plan);entries[name]={id,base:length,plan,compiled};length+=compiled.program.length;scratchWords=Math.max(scratchWords,compiled.scratchWords);});
 const program=new Uint32Array(length+1);for(const e of Object.values(entries))program.set(e.compiled.program,e.base);program[length]=32;
 return Object.freeze({program,proxyIterationLimitOffset:length,entries,scratchWords:scratchWords+1,roundSlot:scratchWords,pointCounts:Object.freeze(pointCounts.slice())});
}

/** Remove unreachable function declarations only; no arithmetic/control
 * transformation. WGSL has no first-class function values in these libraries.
 * Explicitly pruning before native pipeline creation keeps unused world stages
 * out of backends which process more than the selected entry point's call tree.
 */
export function pruneCcdWGSL(code,entry='main'){
 if(typeof code!=='string'||!/^\w+$/.test(entry))throw TypeError('WGSL entry required');
 const masked=code.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g,s=>s.replace(/[^\n]/g,' ')),functions=new Map();
 for(const m of masked.matchAll(/\bfn\s+(\w+)\s*\(/g)){
  const begin=m.index,brace=masked.indexOf('{',begin);if(brace<0)throw RangeError('Incomplete WGSL function');let depth=1,end=brace+1;
  for(;depth&&end<masked.length;end++){if(masked[end]==='{')depth++;else if(masked[end]==='}')depth--;}
  if(depth||functions.has(m[1]))throw RangeError('Malformed or duplicate WGSL function');functions.set(m[1],{begin,end,body:masked.slice(brace,end)});
 }
 if(!functions.has(entry))throw RangeError('Missing WGSL entry');const keep=new Set(),todo=[entry];while(todo.length){const name=todo.pop();if(keep.has(name))continue;keep.add(name);for(const m of functions.get(name).body.matchAll(/\b(\w+)\s*\(/g))if(functions.has(m[1])&&!keep.has(m[1]))todo.push(m[1]);}
 let output=code;for(const [name,r]of [...functions].sort((a,b)=>b[1].begin-a[1].begin))if(!keep.has(name))output=output.slice(0,r.begin)+output.slice(r.end);return output;
}

export function generateCcdWGSL(programs=createCcdPrograms()){
 const E=programs.entries,id=n=>E[n].id,layout=(n,k)=>E[n].plan.layout[k].offset;
 const programSwitch=Object.values(E).map(e=>`case ${e.id}u:{program=programBase+${e.base}u;inputs=${e.compiled.inputCount}u;outputs=${e.compiled.outputCount}u;}`).join('\n');
 const findSwitch=programs.pointCounts.map(n=>`case ${n}u:{which=${id('findVertices'+n)}u;}`).join('');
 // Reuse original proxyDistance control and exact source reducers. The only
 // changes are namespacing, candidate-local numeric storage, and point lookup.
 const reducers=`fn solve(s:ptr<function,Simplex>){
 if((*s).count==1u){(*s).solved=true;(*s).v[0]=weighted((*s).v[0],1.0);return;}
 var program=rc_ccd_pd_program+${E.reducer2.base}u;switch (*s).count{case 2u:{}case 3u:{program=rc_ccd_pd_program+${E.reducer3.base}u;}case 4u:{program=rc_ccd_pd_program+${E.reducer4.base}u;}default:{rc_ccd_pd_error=3u;return;}}
 for(var i=0u;i<4u;i++){for(var j=0u;j<3u;j++){rc_scratch[rc_ccd_pd_scratch+i*3u+j]=bitcast<u32>((*s).v[i].w[j]);}rc_scratch[rc_ccd_pd_scratch+12u+i]=bitcast<u32>((*s).v[i].a);}
 if(rc_num_eval(program,rc_ccd_pd_scratch)!=1u){rc_ccd_pd_error=1u;return;}
 let old=(*s).v;let output=program+rc_program[program+8u];(*s).count=u32(bitcast<f32>(rc_scratch[rc_ccd_pd_scratch+rc_program[output]]));(*s).solved=bitcast<f32>(rc_scratch[rc_ccd_pd_scratch+rc_program[output+1u]])!=0.0;
 for(var i=0u;i<4u;i++){let index=u32(bitcast<f32>(rc_scratch[rc_ccd_pd_scratch+rc_program[output+2u+i]]));let weight=bitcast<f32>(rc_scratch[rc_ccd_pd_scratch+rc_program[output+6u+i]]);if(index>=4u){rc_ccd_pd_error=3u;return;}(*s).v[i]=weighted(old[index],weight);}
 }`;
 let proxy=Proxy.TYPES+Proxy.PRIMITIVES+Proxy.wgslKernel(reducers).replace('while (iteration < 32u)', 'while (iteration < rc_ccd_pd_limit)');
 for(const [name,expression]of [['fadd','a+b'],['fsub','a-b'],['fmul','a*b'],['fdiv','a/b']])proxy=proxy.replace(new RegExp(`fn ${name}\\([^}]+\\}`),`fn ${name}(a:f32,b:f32)->f32{rc_scratch[rc_ccd_pd_scratch+${programs.roundSlot}u]=bitcast<u32>(${expression});return bitcast<f32>(rc_scratch[rc_ccd_pd_scratch+${programs.roundSlot}u]);}`);
 proxy=proxy.replace(/fn fsqrt\([^}]+\}/,`fn fsqrt(a:f32)->f32{rc_scratch[rc_ccd_pd_scratch+${programs.roundSlot}u]=bitcast<u32>(sqrt(a));return bitcast<f32>(rc_scratch[rc_ccd_pd_scratch+${programs.roundSlot}u]);}`);
 const names=[...proxy.matchAll(/\b(?:fn|struct|alias)\s+(\w+)|\bvar<private>\s+(\w+)/g)].map(m=>m[1]??m[2]);names.push('pointA','pointCount');
 for(const name of [...new Set(names)].sort((a,b)=>b.length-a.length))proxy=proxy.replace(new RegExp('\\b'+name+'\\b','g'),'rc_ccd_pd_'+name);
 // Struct members also receive the mechanically uniform name transformation;
 // e.g. DistanceResult.pointA is rc_ccd_pd_pointA in the reused code.
 return `
var<private> rc_ccd_pd_limit:u32;var<private> rc_ccd_pd_scratch:u32;var<private> rc_ccd_pd_program:u32;var<private> rc_ccd_pd_error:u32;var<private> rc_ccd_pd_points:u32;var<private> rc_ccd_pd_count:u32;
${proxy}
fn rc_ccd_pd_pointA(i:u32)->vec3<f32>{let p=rc_ccd_pd_points+i*3u;return vec3<f32>(bitcast<f32>(rc_state[p]),bitcast<f32>(rc_state[p+1u]),bitcast<f32>(rc_state[p+2u]));}
fn rc_ccd_pd_pointCount()->u32{return rc_ccd_pd_count;}
fn rc_ccd_fail(b:u32,error:u32)->u32{if(rc_state[b]==0u){rc_state[b]=error;}return error;}
fn rc_ccd_f(p:u32)->f32{return bitcast<f32>(rc_state[p]);}
fn rc_ccd_put(p:u32,x:f32){rc_state[p]=bitcast<u32>(x);}
fn rc_ccd_v(p:u32)->vec3<f32>{return vec3<f32>(rc_ccd_f(p),rc_ccd_f(p+1u),rc_ccd_f(p+2u));}
fn rc_ccd_vec(p:u32,v:vec3<f32>){for(var i=0u;i<3u;i++){rc_ccd_put(p+i,v[i]);}}
fn rc_ccd_copy(dst:u32,src:u32,n:u32){for(var i=0u;i<n;i++){rc_state[dst+i]=rc_state[src+i];}}
fn rc_ccd_eval(b:u32,input:u32,which:u32,scratch:u32,programBase:u32)->bool{
 var program=0u;var inputs=0u;var outputs=0u;switch which{${programSwitch}default:{rc_ccd_fail(b,3u);return false;}}
 for(var i=0u;i<inputs;i++){rc_scratch[scratch+i]=rc_state[input+i];}if(rc_num_eval(program,scratch)!=1u){rc_ccd_fail(b,1u);return false;}
 let indices=program+rc_program[program+8u];for(var i=0u;i<outputs;i++){rc_state[b+704u+i]=rc_scratch[scratch+rc_program[indices+i]];}return true;
}
fn rc_ccd_begin(b:u32,dt:f32,minDt:f32)->u32{
 if(rc_state[b]!=0u){return rc_state[b];}if(rc_state[b+1u]!=0u&&rc_state[b+1u]!=3u){return rc_ccd_fail(b,4u);}
 if(!(dt>0.0&&dt<=1.0&&minDt>=0.0&&minDt<=1.0)){return rc_ccd_fail(b,3u);}for(var i=0u;i<32u;i++){rc_state[b+i]=0u;}rc_state[b+1u]=1u;rc_state[b+3u]=4u;rc_ccd_put(b+4u,dt);rc_ccd_put(b+5u,dt);rc_ccd_put(b+7u,minDt);rc_ccd_put(b+8u,dt);return 0u;
}
fn rc_ccd_select_pass_prepare(b:u32)->u32{
 if(rc_state[b]!=0u){return rc_state[b];}if(rc_state[b+1u]!=1u||rc_state[b+3u]<1u||rc_state[b+3u]>4u){return rc_ccd_fail(b,4u);}let w=b+448u;
 rc_state[w]=rc_state[b+4u];rc_ccd_put(w+1u,f32(rc_state[b+3u]));rc_ccd_put(w+2u,f32(rc_state[b+10u]));rc_state[w+3u]=rc_state[b+9u];rc_state[w+4u]=rc_state[b+7u];
 if(rc_state[b+3u]==1u&&rc_state[b+10u]!=0u){return rc_ccd_fail(b,4u);}if(rc_state[b+10u]!=0u&&!(rc_ccd_f(b+9u)>=0.0&&rc_ccd_f(b+9u)<rc_ccd_f(b+4u))){return rc_ccd_fail(b,3u);}
 return 0u;
}
fn rc_ccd_select_pass_finish(b:u32)->u32{if(rc_state[b]!=0u){return rc_state[b];}if(rc_state[b+1u]!=1u){return rc_ccd_fail(b,4u);}rc_state[b+6u]=rc_state[b+704u];rc_state[b+11u]=rc_state[b+705u];rc_state[b+12u]=u32(rc_ccd_f(b+706u));rc_state[b+1u]=2u;return 0u;}
fn rc_ccd_select_pass(b:u32,scratch:u32,program:u32)->u32{if(rc_ccd_select_pass_prepare(b)!=0u){return rc_state[b];}if(!rc_ccd_eval(b,b+448u,${id('schedule')}u,scratch,program)){return rc_state[b];}return rc_ccd_select_pass_finish(b);
}
fn rc_ccd_advance_pass(b:u32)->u32{
 if(rc_state[b]!=0u){return rc_state[b];}if(rc_state[b+1u]!=2u||rc_state[b+13u]!=1u){return rc_ccd_fail(b,4u);}rc_state[b+13u]=0u;if(rc_state[b+12u]==0u){rc_state[b+1u]=3u;return 0u;}rc_state[b+2u]++;if(rc_state[b+2u]>=4u){return rc_ccd_fail(b,5u);}rc_state[b+5u]=rc_state[b+6u];rc_state[b+4u]=rc_state[b+11u];rc_state[b+3u]=rc_state[b+12u];rc_state[b+1u]=1u;return 0u;
}
struct RcCcdCast{status:u32,fraction:f32,point:vec3<f32>,normal:vec3<f32>,distanceQueries:u32,rootIterations:u32,pushBacks:u32}
fn rc_ccd_find(b:u32,face:bool,pointCount:u32,scratch:u32,program:u32)->bool{var which=${id('findFace')}u;if(!face){switch pointCount{${findSwitch}default:{rc_ccd_fail(b,2u);return false;}}}return rc_ccd_eval(b,b+448u,which,scratch,program);}
fn rc_ccd_evaluate(b:u32,face:bool,index:u32,scratch:u32,program:u32)->bool{if(!face){if(index>=rc_ccd_pd_count){rc_ccd_fail(b,3u);return false;}rc_ccd_vec(b+501u,rc_ccd_pd_pointA(index));}return rc_ccd_eval(b,b+448u,select(${id('evaluateVertex')}u,${id('evaluateFace')}u,face),scratch,program);}
// Exact original proxyDistance continuation. Simplex, backup and result are
// storage-resident so reducer arithmetic can execute in its own device stage.
// Scalar geometry below calls the unchanged source helpers in source order.
fn rc_ccd_gjk_load_simplex(p:u32)->rc_ccd_pd_Simplex{
 var s=rc_ccd_pd_Simplex(rc_ccd_pd_Vertices(rc_ccd_pd_emptyVertex(),rc_ccd_pd_emptyVertex(),rc_ccd_pd_emptyVertex(),rc_ccd_pd_emptyVertex()),rc_state[p+48u],rc_state[p+49u]!=0u);
 for(var i=0u;i<4u;i++){let a=p+i*12u;s.v[i]=rc_ccd_pd_Vertex(rc_ccd_v(a),rc_ccd_v(a+3u),rc_ccd_v(a+6u),rc_ccd_f(a+9u),rc_state[a+10u],rc_state[a+11u]);}return s;
}
fn rc_ccd_gjk_store_simplex(p:u32,s:ptr<function,rc_ccd_pd_Simplex>){for(var i=0u;i<4u;i++){let a=p+i*12u;rc_ccd_vec(a,(*s).v[i].wa);rc_ccd_vec(a+3u,(*s).v[i].wb);rc_ccd_vec(a+6u,(*s).v[i].w);rc_ccd_put(a+9u,(*s).v[i].a);rc_state[a+10u]=(*s).v[i].indexA;rc_state[a+11u]=(*s).v[i].indexB;}rc_state[p+48u]=(*s).count;rc_state[p+49u]=u32((*s).solved);}
fn rc_ccd_gjk_store_result(b:u32){let p=b+1133u;let r=rc_ccd_pd_result;rc_ccd_vec(p,r.rc_ccd_pd_pointA);rc_ccd_vec(p+3u,r.pointB);rc_ccd_vec(p+6u,r.normal);rc_ccd_put(p+9u,r.distance);rc_state[p+10u]=r.iterations;rc_ccd_put(p+11u,r.cache.metric);rc_state[p+12u]=r.cache.count;for(var i=0u;i<3u;i++){rc_state[p+13u+i]=r.cache.indexA[i];rc_state[p+16u+i]=r.cache.indexB[i];}rc_state[p+19u]=u32(r.overlap);rc_state[p+20u]=u32(r.cacheWritten);rc_state[p+21u]=r.termination;rc_state[p+22u]=u32(r.cacheAccepted);rc_state[p+23u]=u32(r.cacheFlushed);rc_state[p+24u]=r.finalCount;}
fn rc_ccd_gjk_load_result(b:u32){let p=b+1133u;let cache=rc_ccd_pd_Cache(rc_ccd_f(p+11u),rc_state[p+12u],rc_ccd_pd_U3(rc_state[p+13u],rc_state[p+14u],rc_state[p+15u]),rc_ccd_pd_U3(rc_state[p+16u],rc_state[p+17u],rc_state[p+18u]));rc_ccd_pd_result=rc_ccd_pd_DistanceResult(rc_ccd_v(p),rc_ccd_v(p+3u),rc_ccd_v(p+6u),rc_ccd_f(p+9u),rc_state[p+10u],cache,rc_state[p+19u]!=0u,rc_state[p+20u]!=0u,rc_state[p+21u],rc_state[p+22u]!=0u,rc_state[p+23u]!=0u,rc_state[p+24u]);}
fn rc_ccd_gjk_done(b:u32){rc_state[b+1158u]=0u;rc_ccd_gjk_store_result(b);}
fn rc_ccd_gjk_finish(b:u32,s:ptr<function,rc_ccd_pd_Simplex>,unnormalized:vec3<f32>,iteration:u32){
 let normal=rc_ccd_pd_normalizedOrZero(unnormalized);rc_ccd_pd_result.iterations=iteration;rc_ccd_pd_result.finalCount=(*s).count;
 if(normal.x==0.0&&normal.y==0.0&&normal.z==0.0){rc_ccd_pd_result.overlap=true;rc_ccd_pd_result.termination=3u;rc_ccd_gjk_done(b);return;}
 let witness=rc_ccd_pd_witness(s);rc_ccd_pd_result.cache.metric=rc_ccd_pd_simplexMetric(s);rc_ccd_pd_result.cache.count=(*s).count;if(rc_ccd_pd_result.cache.count>3u){rc_ccd_pd_result.cache.count=3u;}
 for(var i=0u;i<rc_ccd_pd_result.cache.count;i++){rc_ccd_pd_result.cache.indexA[i]=(*s).v[i].indexA;rc_ccd_pd_result.cache.indexB[i]=(*s).v[i].indexB;}
 rc_ccd_pd_result.rc_ccd_pd_pointA=witness.rc_ccd_pd_pointA;rc_ccd_pd_result.pointB=witness.pointB;rc_ccd_pd_result.distance=rc_ccd_pd_vlength(rc_ccd_pd_vsub(witness.rc_ccd_pd_pointA,witness.pointB));rc_ccd_pd_result.normal=normal;rc_ccd_pd_result.cacheWritten=true;rc_ccd_gjk_done(b);
}
fn rc_ccd_gjk_gather(b:u32,s:ptr<function,rc_ccd_pd_Simplex>){
 let input=b+1160u;for(var i=0u;i<4u;i++){rc_ccd_vec(input+i*3u,(*s).v[i].w);rc_ccd_put(input+12u+i,(*s).v[i].a);}var which=${id('reducer2')}u;
 switch (*s).count{case 2u:{}case 3u:{which=${id('reducer3')}u;}case 4u:{which=${id('reducer4')}u;}default:{rc_ccd_fail(b,3u);return;}}
 rc_state[b+1159u]=which;rc_state[b+1158u]=1u;rc_ccd_gjk_store_simplex(b+1024u,s);rc_ccd_gjk_store_result(b);
}
fn rc_ccd_gjk_resume(b:u32,hasNumeric:bool){
 let g=b+1024u;var simplex=rc_ccd_gjk_load_simplex(g);var backup=rc_ccd_gjk_load_simplex(g+50u);let pointB=rc_ccd_v(g+100u);var normal=rc_ccd_v(g+103u);var distanceSq=rc_ccd_f(g+106u);var iteration=rc_state[g+107u];var backupCount=rc_state[g+108u];rc_ccd_gjk_load_result(b);
 if(hasNumeric){let old=simplex.v;simplex.count=u32(rc_ccd_f(b+704u));simplex.solved=rc_ccd_f(b+705u)!=0.0;for(var i=0u;i<4u;i++){let index=u32(rc_ccd_f(b+706u+i));if(index>=4u){rc_ccd_fail(b,3u);return;}simplex.v[i]=rc_ccd_pd_weighted(old[index],rc_ccd_f(b+710u+i));}}
 else if(simplex.count==1u){simplex.solved=true;simplex.v[0]=rc_ccd_pd_weighted(simplex.v[0],1.0);}else{rc_ccd_gjk_gather(b,&simplex);return;}
 if(!simplex.solved){rc_ccd_pd_result.termination=5u;if(backupCount!=0u){simplex=backup;simplex.count=backupCount;}rc_ccd_gjk_finish(b,&simplex,normal,iteration);return;}
 if(simplex.count==4u){let witness=rc_ccd_pd_witness(&simplex);rc_ccd_pd_result.rc_ccd_pd_pointA=witness.rc_ccd_pd_pointA;rc_ccd_pd_result.pointB=witness.pointB;rc_ccd_pd_result.iterations=iteration;rc_ccd_pd_result.overlap=true;rc_ccd_pd_result.termination=1u;rc_ccd_pd_result.finalCount=simplex.count;rc_ccd_gjk_done(b);return;}
 let oldDistanceSq=distanceSq;let closestPoint=rc_ccd_pd_closest(&simplex);distanceSq=rc_ccd_pd_vdot(closestPoint,closestPoint);
 if(distanceSq>=oldDistanceSq){rc_ccd_pd_result.termination=6u;if(backupCount!=0u){simplex=backup;simplex.count=backupCount;}rc_ccd_gjk_finish(b,&simplex,normal,iteration);return;}
 let searchDirection=rc_ccd_pd_direction(&simplex);
 if(rc_ccd_pd_vdot(searchDirection,searchDirection)<rc_ccd_pd_fmul(1000.0,1.1754943508222875e-38)){let witness=rc_ccd_pd_witness(&simplex);rc_ccd_pd_result.rc_ccd_pd_pointA=witness.rc_ccd_pd_pointA;rc_ccd_pd_result.pointB=witness.pointB;rc_ccd_pd_result.iterations=iteration;rc_ccd_pd_result.overlap=true;rc_ccd_pd_result.termination=2u;rc_ccd_pd_result.finalCount=simplex.count;rc_ccd_gjk_done(b);return;}
 normal=rc_ccd_pd_vneg(searchDirection);let indexA=rc_ccd_pd_support(rc_ccd_pd_vneg(searchDirection));let supportA=rc_ccd_pd_pointA(indexA);backup=simplex;backupCount=simplex.count;var duplicate=false;
 for(var i=0u;i<simplex.count;i++){if(simplex.v[i].indexA==indexA&&simplex.v[i].indexB==0u){duplicate=true;}}
 if(duplicate){rc_ccd_pd_result.termination=4u;rc_ccd_gjk_finish(b,&simplex,normal,iteration);return;}
 if(simplex.count>=4u){rc_ccd_fail(b,3u);return;}simplex.v[simplex.count]=rc_ccd_pd_Vertex(supportA,pointB,rc_ccd_pd_vsub(pointB,supportA),simplex.v[simplex.count].a,indexA,0u);simplex.count++;iteration++;
 if(iteration>=rc_ccd_pd_limit){rc_ccd_gjk_finish(b,&simplex,normal,iteration);return;}
 rc_ccd_gjk_store_simplex(g+50u,&backup);rc_ccd_vec(g+103u,normal);rc_ccd_put(g+106u,distanceSq);rc_state[g+107u]=iteration;rc_state[g+108u]=backupCount;rc_ccd_gjk_gather(b,&simplex);
}
fn rc_ccd_gjk_begin(b:u32,pointB:vec3<f32>,inputCache:rc_ccd_pd_Cache){
 let g=b+1024u;let z=vec3<f32>(0.0);rc_ccd_pd_result=rc_ccd_pd_DistanceResult(z,z,z,0.0,0u,inputCache,false,false,7u,false,false,0u);
 var simplex=rc_ccd_pd_Simplex(rc_ccd_pd_Vertices(rc_ccd_pd_emptyVertex(),rc_ccd_pd_emptyVertex(),rc_ccd_pd_emptyVertex(),rc_ccd_pd_emptyVertex()),0u,true);rc_ccd_pd_result.cacheAccepted=rc_ccd_pd_cacheValid(inputCache);if(rc_ccd_pd_result.cacheAccepted){simplex.count=inputCache.count;}
 for(var i=0u;i<simplex.count;i++){let wa=rc_ccd_pd_pointA(inputCache.indexA[i]);simplex.v[i]=rc_ccd_pd_Vertex(wa,pointB,rc_ccd_pd_vsub(pointB,wa),0.0,inputCache.indexA[i],inputCache.indexB[i]);}
 if(simplex.count>0u){let metric1=inputCache.metric;let metric2=rc_ccd_pd_simplexMetric(&simplex);if(rc_ccd_pd_fmul(2.0,metric1)<metric2||metric2<rc_ccd_pd_fmul(0.5,metric1)||metric2<1.1920928955078125e-7){simplex.count=0u;rc_ccd_pd_result.cacheFlushed=true;}}
 if(simplex.count==0u){let wa=rc_ccd_pd_pointA(0u);simplex.v[0]=rc_ccd_pd_Vertex(wa,pointB,rc_ccd_pd_vsub(pointB,wa),0.0,0u,0u);simplex.count=1u;}
 rc_ccd_gjk_store_simplex(g,&simplex);rc_ccd_gjk_store_simplex(g+50u,&simplex);rc_ccd_vec(g+100u,pointB);rc_ccd_vec(g+103u,z);rc_ccd_put(g+106u,3.402823466e38);rc_state[g+107u]=0u;rc_state[g+108u]=0u;rc_ccd_gjk_store_result(b);rc_ccd_gjk_resume(b,false);
}
fn rc_ccd_sweep_numeric_request(b:u32)->vec2<u32>{if(rc_state[b+896u]==12u){return vec2<u32>(rc_state[b+1159u],b+1160u);}return vec2<u32>(rc_state[b+897u],b+448u);}
fn rc_ccd_sweep_distance_done(b:u32){
 let c=b+896u;let w=b+448u;rc_ccd_gjk_load_result(b);let d=rc_ccd_pd_result;
 if(!rc_ccd_pd_finite(d.distance)||!all(abs(d.normal)<=vec3<f32>(3.402823466e38))||!all(abs(d.rc_ccd_pd_pointA)<=vec3<f32>(3.402823466e38))||!all(abs(d.pointB)<=vec3<f32>(3.402823466e38))||!rc_ccd_pd_finite(d.cache.metric)){rc_ccd_fail(b,1u);return;}
 rc_ccd_put(c+29u,d.cache.metric);rc_state[c+30u]=d.cache.count;for(var i=0u;i<3u;i++){rc_state[c+31u+i]=d.cache.indexA[i];rc_state[c+34u+i]=d.cache.indexB[i];}rc_ccd_put(c+37u,d.distance);rc_state[c+46u]++;
 rc_ccd_vec(w+38u,d.normal);rc_ccd_vec(w+41u,d.rc_ccd_pd_pointA);rc_ccd_vec(w+44u,d.pointB);rc_ccd_copy(w+59u,c+14u,3u);rc_ccd_request(b,${id('worldDistance')}u,4u);
}

// Source async sweep continuation lowered to resident storage. A single numeric
// request/evaluate callsite replaces nested copies of the arithmetic VM. Each
// phase consumes exactly one original math result; no numerical branch moved
// to the host. Offset 896 is transient candidate-local continuation storage.
fn rc_ccd_request(b:u32,which:u32,next:u32){rc_state[b+897u]=which;rc_state[b+896u]=next;}
fn rc_ccd_sweep_finish(b:u32,status:u32,fraction:f32,point:bool){let c=b+896u;rc_state[c]=0u;rc_state[c+6u]=status;rc_ccd_put(c+7u,fraction);if(point){rc_ccd_copy(c+8u,c+41u,3u);rc_ccd_copy(c+11u,c+38u,3u);}}
fn rc_ccd_sweep_relative(b:u32){rc_state[b+482u]=rc_state[b+917u];rc_ccd_request(b,${id('relative')}u,3u);}
fn rc_ccd_sweep_find(b:u32){let c=b+896u;var which=${id('findFace')}u;if(rc_state[c+44u]==0u){switch rc_state[c+4u]{${findSwitch}default:{rc_ccd_fail(b,2u);return;}}}rc_state[b+482u]=rc_state[c+22u];rc_ccd_request(b,which,6u);}
fn rc_ccd_sweep_evaluate(b:u32,time:f32,next:u32){let c=b+896u;var which=${id('evaluateFace')}u;if(rc_state[c+44u]==0u){let index=rc_state[c+45u];if(index>=rc_state[c+4u]){rc_ccd_fail(b,3u);return;}rc_ccd_vec(b+501u,rc_ccd_pd_pointA(index));which=${id('evaluateVertex')}u;}rc_ccd_put(b+482u,time);rc_ccd_request(b,which,next);}
fn rc_ccd_sweep_difference(b:u32,a:f32,c:f32,next:u32){rc_ccd_put(b+501u,a);rc_ccd_put(b+502u,c);rc_ccd_request(b,${id('difference')}u,next);}
fn rc_ccd_sweep_root(b:u32){let c=b+896u;rc_state[b+501u]=rc_state[c+25u];rc_state[b+502u]=rc_state[c+26u];rc_state[b+503u]=rc_state[c+23u];rc_state[b+504u]=rc_state[c+24u];rc_state[b+505u]=rc_state[c+17u];rc_ccd_request(b,select(${id('rootBisect')}u,${id('rootFalse')}u,rc_state[c+27u]%2u==1u),9u);}
fn rc_ccd_sweep_push(b:u32){let c=b+896u;rc_state[c+28u]++;rc_state[c+48u]++;if(rc_state[c+28u]==rc_state[c+4u]+1u){rc_ccd_sweep_relative(b);}else{rc_ccd_sweep_find(b);}}
fn rc_ccd_sweep_begin(b:u32,points:u32,pointCount:u32,maxFraction:f32)->bool{
 let c=b+896u;for(var i=0u;i<64u;i++){rc_state[c+i]=0u;}rc_state[c+3u]=points;rc_state[c+4u]=pointCount;rc_ccd_put(c+5u,maxFraction);rc_ccd_put(c+7u,maxFraction);
 if(rc_state[b]!=0u){return false;}if(pointCount<1u||pointCount>64u||!(maxFraction>0.0&&maxFraction<=1.0)){rc_ccd_fail(b,3u);return false;}
 for(var i=0u;i<pointCount*3u;i++){rc_state[b+512u+i]=rc_state[points+i];}rc_ccd_request(b,${id('shift')}u,1u);return true;
}
fn rc_ccd_sweep_step(b:u32,scratch:u32,program:u32){
 if(rc_state[b]!=0u){return;}let c=b+896u;let w=b+448u;let o=b+704u;let phase=rc_state[c];
 rc_ccd_pd_points=rc_state[c+3u];rc_ccd_pd_count=rc_state[c+4u];rc_ccd_pd_scratch=scratch;rc_ccd_pd_program=program;rc_ccd_pd_error=0u;rc_ccd_pd_limit=rc_program[program+${programs.proxyIterationLimitOffset}u];
 switch phase{
 case 1u:{rc_ccd_copy(c+14u,o,3u);rc_ccd_copy(w+3u,o+3u,6u);rc_ccd_copy(w+20u,o+9u,6u);rc_ccd_request(b,${id('target')}u,2u);}
 case 2u:{rc_ccd_copy(c+17u,o,4u);rc_ccd_sweep_relative(b);}
 case 3u:{
  let cache=rc_ccd_pd_Cache(rc_ccd_f(c+29u),rc_state[c+30u],rc_ccd_pd_U3(rc_state[c+31u],rc_state[c+32u],rc_state[c+33u]),rc_ccd_pd_U3(rc_state[c+34u],rc_state[c+35u],rc_state[c+36u]));
  rc_ccd_gjk_begin(b,rc_ccd_pd_ballPoint(rc_ccd_v(o),rc_ccd_v(o+3u),rc_ccd_f(o+6u)),cache);if(rc_state[b]!=0u){return;}if(rc_state[b+1158u]==0u){rc_ccd_sweep_distance_done(b);}else{rc_state[c]=12u;}
 }
 case 12u:{rc_ccd_gjk_resume(b,true);if(rc_state[b]!=0u){return;}if(rc_state[b+1158u]==0u){rc_ccd_sweep_distance_done(b);}}

 case 4u:{
  rc_ccd_copy(c+38u,o,3u);rc_ccd_copy(c+41u,o+3u,3u);let distance=rc_ccd_f(c+37u);let t1=rc_ccd_f(c+21u);
  if(distance<=0.0){rc_ccd_sweep_finish(b,2u,0.0,false);return;}if(distance<=rc_ccd_f(c+19u)){rc_ccd_sweep_finish(b,1u,t1,true);return;}if(rc_state[c+46u]==25u){rc_ccd_sweep_finish(b,3u,t1,true);return;}
  let count=rc_state[c+30u];if(count<1u||count>3u){rc_ccd_fail(b,3u);return;}for(var i=0u;i<count;i++){if(rc_state[c+34u+i]!=0u||rc_state[c+31u+i]>=rc_state[c+4u]){rc_ccd_fail(b,3u);return;}}
  rc_state[c+44u]=u32(count==3u);rc_ccd_copy(w+47u,c+38u,3u);rc_ccd_vec(w+50u,vec3<f32>(0.0));
  if(count==3u){if(rc_state[c+31u]==rc_state[c+32u]||rc_state[c+31u]==rc_state[c+33u]||rc_state[c+32u]==rc_state[c+33u]){rc_ccd_fail(b,2u);return;}for(var i=0u;i<3u;i++){rc_ccd_vec(w+53u+i*3u,rc_ccd_pd_pointA(rc_state[c+31u+i]));}rc_ccd_request(b,${id('face')}u,5u);}
  else{rc_state[c+22u]=rc_state[c+5u];rc_state[c+28u]=0u;rc_ccd_sweep_find(b);}
 }
 case 5u:{rc_ccd_copy(w+47u,o,6u);rc_state[c+22u]=rc_state[c+5u];rc_state[c+28u]=0u;rc_ccd_sweep_find(b);}
 case 6u:{rc_state[c+24u]=rc_state[o];rc_state[c+45u]=u32(rc_ccd_f(o+1u));rc_ccd_sweep_difference(b,rc_ccd_f(c+24u),rc_ccd_f(c+17u),7u);}
 case 7u:{
  if(rc_ccd_f(o)>rc_ccd_f(c+18u)){rc_ccd_sweep_finish(b,0u,rc_ccd_f(c+5u),false);return;}
  if(rc_ccd_f(c+24u)>=rc_ccd_f(c+20u)){rc_state[c+21u]=rc_state[c+22u];rc_ccd_sweep_relative(b);return;}rc_ccd_sweep_evaluate(b,rc_ccd_f(c+21u),8u);
 }
 case 8u:{
  rc_state[c+23u]=rc_state[o];if(rc_ccd_f(o)<rc_ccd_f(c+20u)){rc_ccd_sweep_finish(b,3u,rc_ccd_f(c+21u),false);return;}if(rc_ccd_f(o)<=rc_ccd_f(c+19u)){rc_ccd_sweep_finish(b,1u,rc_ccd_f(c+21u),true);return;}
  rc_state[c+25u]=rc_state[c+21u];rc_state[c+26u]=rc_state[c+22u];rc_state[c+27u]=0u;rc_ccd_sweep_root(b);
 }
 case 9u:{rc_state[c+49u]=rc_state[o];rc_state[c+27u]++;rc_state[c+47u]++;rc_ccd_sweep_evaluate(b,rc_ccd_f(c+49u),10u);}
 case 10u:{rc_state[c+50u]=rc_state[o];rc_ccd_sweep_difference(b,rc_ccd_f(c+50u),rc_ccd_f(c+17u),11u);}
 case 11u:{
  if(abs(rc_ccd_f(o))<=rc_ccd_f(c+18u)){rc_state[c+22u]=rc_state[c+49u];rc_ccd_sweep_push(b);return;}
  if(rc_ccd_f(c+50u)>rc_ccd_f(c+17u)){rc_state[c+25u]=rc_state[c+49u];rc_state[c+23u]=rc_state[c+50u];}else{rc_state[c+26u]=rc_state[c+49u];rc_state[c+24u]=rc_state[c+50u];}
  if(rc_state[c+27u]==50u){rc_ccd_sweep_push(b);}else{rc_ccd_sweep_root(b);}
 }
 default:{rc_ccd_fail(b,4u);}
 }
}
fn rc_ccd_sweep_result(b:u32)->RcCcdCast{let c=b+896u;return RcCcdCast(rc_state[c+6u],rc_ccd_f(c+7u),rc_ccd_v(c+8u),rc_ccd_v(c+11u),rc_state[c+46u],rc_state[c+47u],rc_state[c+48u]);}
fn rc_ccd_sweep(b:u32,points:u32,pointCount:u32,maxFraction:f32,scratch:u32,program:u32)->RcCcdCast{
 if(!rc_ccd_sweep_begin(b,points,pointCount,maxFraction)){return rc_ccd_sweep_result(b);}
 loop{if(rc_state[b+896u]==0u||rc_state[b]!=0u){break;}let request=rc_ccd_sweep_numeric_request(b);if(!rc_ccd_eval(b,request.y,request.x,scratch,program)){break;}rc_ccd_sweep_step(b,scratch,program);}
 return rc_ccd_sweep_result(b);
}

// Body continuation uses the remaining 48 words; body/checker and sweep math
// share one numeric request callsite while ordered casts remain sequential.
fn rc_ccd_body_request(b:u32,phase:u32,which:u32,input:u32){let c=b+976u;rc_state[c]=phase;rc_state[c+1u]=which;rc_state[c+2u]=input;}
fn rc_ccd_body_bounds(b:u32){let c=b+976u;let w=b+448u;for(var i=0u;i<64u;i++){rc_state[w+i]=0u;}rc_ccd_copy(w+20u,c+9u,6u);rc_state[w+36u]=rc_state[rc_state[c+7u]+35u];rc_ccd_body_request(b,3u,${id('sphereBounds')}u,w);}
fn rc_ccd_body_next_cast(b:u32){
 let c=b+976u;let w=b+448u;let seed=rc_state[c+5u];let input=rc_state[c+7u];let resultBase=rc_state[c+8u];let body=rc_state[c+3u];let bvh=rc_state[c+6u];
 loop{
  if(rc_state[c+23u]>=8u){break;}let m=seed+400u+rc_state[c+23u]*8u;
  if(rc_state[m+1u]!=body){rc_state[c+23u]++;continue;}
  if(rc_state[c+28u]==0u){rc_state[c+25u]++;rc_state[c+28u]=1u;if(rc_state[m+6u]!=rc_state[input+35u]||rc_state[m]>=27u||rc_state[bvh+1787u+rc_state[m]]!=rc_state[m+7u]){rc_ccd_fail(b,3u);return;}}
  if(rc_state[c+24u]>=rc_state[c+22u]){rc_state[c+23u]++;rc_state[c+24u]=0u;rc_state[c+28u]=0u;continue;}
  let leaf=rc_state[b+768u+rc_state[c+24u]];rc_state[c+24u]++;var fixed=0xffffffffu;for(var i=0u;i<16u;i++){let row=seed+16u+i*24u;if(rc_state[row]==leaf){fixed=row;break;}}if(fixed==0xffffffffu){continue;}
  if(leaf>=27u||rc_state[bvh+1787u+leaf]!=rc_state[fixed+1u]){rc_ccd_fail(b,3u);return;}
  if((rc_state[m+2u]&rc_state[fixed+5u])==0u||(rc_state[fixed+4u]&rc_state[m+3u])==0u){continue;}
  if((rc_state[m+4u]&rc_state[fixed+7u])==0u||(rc_state[fixed+6u]&rc_state[m+5u])==0u){rc_ccd_fail(b,2u);return;}
  if(!all(rc_ccd_v(c+15u)<=rc_ccd_v(fixed+18u))||!all(rc_ccd_v(fixed+15u)<=rc_ccd_v(c+18u))){continue;}
  rc_ccd_copy(w+3u,fixed+8u,3u);rc_ccd_copy(w+6u,fixed+8u,3u);rc_ccd_copy(w+9u,fixed+11u,4u);rc_ccd_copy(w+13u,fixed+11u,4u);rc_ccd_copy(w+20u,c+9u,6u);rc_ccd_copy(w+26u,input+9u,4u);rc_ccd_copy(w+30u,input+9u,4u);rc_ccd_put(w+35u,0.0);rc_state[w+36u]=rc_state[input+35u];rc_state[w+37u]=rc_state[c+21u];
  rc_state[c+27u]=leaf;rc_ccd_sweep_begin(b,seed+rc_state[fixed+3u],rc_state[fixed+2u],rc_ccd_f(c+26u));rc_state[c]=5u;return;
 }
 if(rc_state[c+25u]!=2u){rc_ccd_fail(b,3u);return;}rc_state[resultBase]=rc_state[c+26u];
 if(rc_state[c+4u]!=0u&&rc_ccd_f(c+26u)<1.0){rc_ccd_copy(w+20u,input+6u,3u);rc_ccd_copy(w+23u,input+37u,3u);rc_ccd_copy(w+26u,input+9u,4u);rc_ccd_copy(w+30u,input+40u,4u);rc_state[w+34u]=rc_state[c+26u];rc_ccd_body_request(b,6u,${id('transform')}u,w);}
 else{rc_state[c]=0u;}
}
fn rc_ccd_body_begin(b:u32,body:u32,post:bool,seed:u32,bvh:u32)->bool{
 if(rc_state[b]!=0u){return false;}if(body>=4u||rc_state[seed]!=0x52434344u||rc_state[seed+1u]!=1u||rc_state[seed+2u]!=16u||rc_state[seed+3u]!=8u){rc_ccd_fail(b,3u);return false;}
 let c=b+976u;for(var i=0u;i<48u;i++){rc_state[c+i]=0u;}let input=b+32u+body*80u;let resultBase=b+352u+body*24u;for(var i=0u;i<24u;i++){rc_state[resultBase+i]=0u;}rc_ccd_put(resultBase,1.0);rc_state[c+3u]=body;rc_state[c+4u]=u32(post);rc_state[c+5u]=seed;rc_state[c+6u]=bvh;rc_state[c+7u]=input;rc_state[c+8u]=resultBase;rc_ccd_put(c+26u,1.0);
 if(rc_ccd_f(input+31u)!=0.0||rc_ccd_f(input+32u)!=0.0||rc_ccd_f(input+33u)!=0.0){rc_ccd_fail(b,2u);return false;}rc_ccd_body_request(b,1u,select(${id('pre')}u,${id('post')}u,post),input);return true;
}
fn rc_ccd_body_step(b:u32){
 if(rc_state[b]!=0u){return;}let c=b+976u;let w=b+448u;let o=b+704u;let input=rc_state[c+7u];let resultBase=rc_state[c+8u];let seed=rc_state[c+5u];let post=rc_state[c+4u]!=0u;
 switch rc_state[c]{
 case 1u:{
  var isActive=rc_ccd_f(o+${layout('pre','active')}u)!=0.0;var supported=rc_ccd_f(o+${layout('pre','supported')}u)!=0.0;if(post){isActive=rc_ccd_f(o+${layout('post','active')}u)!=0.0;supported=rc_ccd_f(o+${layout('post','supported')}u)!=0.0;}
  if(!supported){rc_ccd_fail(b,2u);return;}rc_state[resultBase+1u]=u32(isActive);if(!isActive){rc_state[c]=0u;return;}
  if(post){rc_ccd_copy(c+9u,input+6u,3u);rc_ccd_copy(c+12u,input+37u,3u);rc_ccd_body_bounds(b);}else{rc_ccd_body_request(b,2u,${id('predict')}u,input);}
 }
 case 2u:{rc_ccd_copy(c+9u,o,6u);rc_ccd_body_bounds(b);}
 case 3u:{rc_ccd_copy(c+15u,o,6u);rc_state[w+53u]=rc_state[seed+4u];rc_state[w+54u]=rc_state[seed+5u];rc_ccd_body_request(b,4u,${id('multiply')}u,w);}
 case 4u:{rc_state[c+21u]=rc_state[o];let count=rc_bvh_query(rc_state[c+6u],rc_ccd_v(c+15u),rc_ccd_v(c+18u),b+768u);if(count==0xffffffffu){rc_ccd_fail(b,2u);return;}rc_state[c+22u]=count;rc_ccd_body_next_cast(b);}
 case 5u:{
  if(rc_state[b+896u]!=0u){rc_ccd_fail(b,4u);return;}let castResult=rc_ccd_sweep_result(b);rc_state[resultBase+20u]+=castResult.distanceQueries;rc_state[resultBase+21u]+=castResult.rootIterations;rc_state[resultBase+22u]+=castResult.pushBacks;
  // Source acceptance deliberately does not reinterpret Failed as an ordinary
  // miss: every positive tighter source fraction is accepted in traversal order.
  if(castResult.fraction>0.0&&castResult.fraction<rc_ccd_f(c+26u)){rc_ccd_put(c+26u,castResult.fraction);rc_state[resultBase+23u]=rc_state[c+27u];}rc_ccd_body_next_cast(b);
 }
 case 6u:{rc_state[resultBase+2u]=1u;rc_ccd_copy(resultBase+4u,o,7u);rc_ccd_copy(w,o+3u,4u);rc_ccd_copy(w+4u,input+64u,4u);rc_ccd_copy(w+8u,input+68u,3u);for(var i=0u;i<3u;i++){if(!(rc_ccd_f(w+8u+i)>0.0)){rc_ccd_fail(b,2u);return;}}rc_ccd_body_request(b,7u,${id('inertia')}u,w);}
 case 7u:{rc_ccd_copy(resultBase+11u,o,9u);rc_state[c]=0u;}
 default:{rc_ccd_fail(b,4u);}
 }
}
fn rc_ccd_body(b:u32,body:u32,post:bool,seed:u32,bvh:u32,scratch:u32,program:u32)->u32{
 if(!rc_ccd_body_begin(b,body,post,seed,bvh)){return rc_state[b];}let c=b+976u;
 loop{
  if(rc_state[b]!=0u||rc_state[c]==0u){break;}let sweep=rc_state[c]==5u;
  if(sweep&&rc_state[b+896u]==0u){rc_ccd_body_step(b);continue;}
  var which=rc_state[c+1u];var input=rc_state[c+2u];if(sweep){let request=rc_ccd_sweep_numeric_request(b);which=request.x;input=request.y;}
  if(!rc_ccd_eval(b,input,which,scratch,program)){break;}if(sweep){rc_ccd_sweep_step(b,scratch,program);}else{rc_ccd_body_step(b);}
 }return rc_state[b];
}


// Device-stage boundaries. Every request is chosen from resident source state;
// the host may submit fixed eval/control waves but never selects a body/TOI.
fn rc_ccd_body_numeric_request(b:u32)->vec2<u32>{let c=b+976u;if(rc_state[c]==5u){return rc_ccd_sweep_numeric_request(b);}return vec2<u32>(rc_state[c+1u],rc_state[c+2u]);}
fn rc_ccd_body_control(b:u32,scratch:u32,program:u32){let c=b+976u;if(rc_state[b]!=0u||rc_state[c]==0u){return;}if(rc_state[c]==5u){if(rc_state[b+896u]!=0u){rc_ccd_sweep_step(b,scratch,program);}if(rc_state[b]==0u&&rc_state[b+896u]==0u){rc_ccd_body_step(b);}}else{rc_ccd_body_step(b);}}
fn rc_ccd_pre_next(b:u32){
 if(rc_state[b]!=0u){return;}if(rc_state[b+3u]==1u||rc_state[b+15u]>=rc_state[b+17u]){if(rc_ccd_select_pass_prepare(b)!=0u){return;}rc_state[b+14u]=3u;return;}
 let body=rc_state[rc_state[b+16u]+rc_state[b+15u]];rc_state[b+20u]=body;rc_state[b+32u+body*80u+36u]=rc_state[b+4u];if(!rc_ccd_body_begin(b,body,false,rc_state[b+18u],rc_state[b+19u])){return;}rc_state[b+14u]=1u;
}
fn rc_ccd_pre_begin(b:u32,seed:u32,bvh:u32,activeOrder:u32,activeCount:u32)->u32{
 if(rc_state[b]!=0u){return rc_state[b];}if(rc_state[b+1u]!=1u||activeCount>4u||rc_state[b+14u]!=0u){return rc_ccd_fail(b,4u);}var seen=0u;
 for(var j=0u;j<activeCount;j++){let body=rc_state[activeOrder+j];if(body>=4u||(seen&(1u<<body))!=0u||rc_state[b+32u+body*80u+71u]!=0u){return rc_ccd_fail(b,3u);}seen|=1u<<body;}
 rc_state[b+9u]=0u;rc_state[b+10u]=0u;rc_state[b+15u]=0u;rc_state[b+16u]=activeOrder;rc_state[b+17u]=activeCount;rc_state[b+18u]=seed;rc_state[b+19u]=bvh;rc_ccd_pre_next(b);return rc_state[b];
}
fn rc_ccd_pre_numeric_request(b:u32)->vec2<u32>{let phase=rc_state[b+14u];if(phase==1u){return rc_ccd_body_numeric_request(b);}if(phase==2u){return vec2<u32>(${id('multiply')}u,b+448u);}return vec2<u32>(${id('schedule')}u,b+448u);}
fn rc_ccd_pre_control(b:u32,scratch:u32,program:u32){
 if(rc_state[b]!=0u){return;}let phase=rc_state[b+14u];
 if(phase==1u){rc_ccd_body_control(b,scratch,program);if(rc_state[b]!=0u||rc_state[b+976u]!=0u){return;}let fraction=rc_ccd_f(b+352u+rc_state[b+20u]*24u);if(fraction<1.0){rc_ccd_put(b+501u,fraction);rc_state[b+502u]=rc_state[b+4u];rc_state[b+14u]=2u;return;}rc_state[b+15u]++;rc_ccd_pre_next(b);}
 else if(phase==2u){let time=rc_ccd_f(b+704u);if(rc_state[b+10u]==0u||time<rc_ccd_f(b+9u)){rc_ccd_put(b+9u,time);rc_state[b+10u]=1u;}rc_state[b+15u]++;rc_ccd_pre_next(b);}
 else if(phase==3u){rc_ccd_select_pass_finish(b);rc_state[b+14u]=0u;}else{rc_ccd_fail(b,4u);}
}
fn rc_ccd_post_next(b:u32){
 loop{if(rc_state[b+15u]>=4u){rc_state[b+13u]=1u;rc_state[b+14u]=0u;return;}let body=rc_state[b+15u];let input=b+32u+body*80u;let sleeping=rc_state[input+71u];if(sleeping>1u){rc_ccd_fail(b,3u);return;}if(sleeping==0u){rc_state[input+36u]=rc_state[b+6u];if(!rc_ccd_body_begin(b,body,true,rc_state[b+18u],rc_state[b+19u])){return;}rc_state[b+14u]=4u;return;}let output=b+352u+body*24u;for(var i=0u;i<24u;i++){rc_state[output+i]=0u;}rc_ccd_put(output,1.0);rc_state[b+15u]++;}
}
fn rc_ccd_post_begin(b:u32,seed:u32,bvh:u32)->u32{if(rc_state[b]!=0u){return rc_state[b];}if(rc_state[b+1u]!=2u||rc_state[b+14u]!=0u){return rc_ccd_fail(b,4u);}rc_state[b+15u]=0u;rc_state[b+18u]=seed;rc_state[b+19u]=bvh;rc_ccd_post_next(b);return rc_state[b];}
fn rc_ccd_post_control(b:u32,scratch:u32,program:u32){if(rc_state[b]!=0u){return;}if(rc_state[b+14u]!=4u){rc_ccd_fail(b,4u);return;}rc_ccd_body_control(b,scratch,program);if(rc_state[b]!=0u||rc_state[b+976u]!=0u){return;}rc_state[b+15u]++;rc_ccd_post_next(b);}
fn rc_ccd_pre_pass(b:u32,seed:u32,bvh:u32,activeOrder:u32,activeCount:u32,scratch:u32,program:u32)->u32{
 if(rc_state[b]!=0u){return rc_state[b];}if(rc_state[b+1u]!=1u||activeCount>4u){return rc_ccd_fail(b,4u);}rc_state[b+9u]=0u;rc_state[b+10u]=0u;var seen=0u;
 for(var j=0u;j<activeCount;j++){let body=rc_state[activeOrder+j];if(body>=4u||(seen&(1u<<body))!=0u){return rc_ccd_fail(b,3u);}seen|=1u<<body;if(rc_state[b+32u+body*80u+71u]!=0u){return rc_ccd_fail(b,3u);}if(rc_state[b+3u]==1u){continue;}
  rc_state[b+32u+body*80u+36u]=rc_state[b+4u];if(rc_ccd_body(b,body,false,seed,bvh,scratch,program)!=0u){return rc_state[b];}let fraction=rc_ccd_f(b+352u+body*24u);
  if(fraction<1.0){rc_ccd_put(b+501u,fraction);rc_state[b+502u]=rc_state[b+4u];if(!rc_ccd_eval(b,b+448u,${id('multiply')}u,scratch,program)){return rc_state[b];}let time=rc_ccd_f(b+704u);if(rc_state[b+10u]==0u||time<rc_ccd_f(b+9u)){rc_ccd_put(b+9u,time);rc_state[b+10u]=1u;}}
 }
 return rc_ccd_select_pass(b,scratch,program);
}
fn rc_ccd_post_pass(b:u32,seed:u32,bvh:u32,scratch:u32,program:u32)->u32{
 if(rc_state[b]!=0u){return rc_state[b];}if(rc_state[b+1u]!=2u){return rc_ccd_fail(b,4u);}
 // Source post-clamp loop is ball-roster order, not active-set/parallel order.
 for(var body=0u;body<4u;body++){let input=b+32u+body*80u;if(rc_state[input+71u]>1u){return rc_ccd_fail(b,3u);}if(rc_state[input+71u]!=0u){let out=b+352u+body*24u;for(var i=0u;i<24u;i++){rc_state[out+i]=0u;}rc_ccd_put(out,1.0);continue;}rc_state[input+36u]=rc_state[b+6u];if(rc_ccd_body(b,body,true,seed,bvh,scratch,program)!=0u){return rc_state[b];}}
 rc_state[b+13u]=1u;return 0u;
}

`;
}
