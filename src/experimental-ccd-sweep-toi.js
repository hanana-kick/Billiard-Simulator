/* SPDX-License-Identifier: Apache-2.0
 * Parry 0.31.1 query/sweep_toi/{sweep_toi,separation,sweep}.rs translated in source order.
 * Copyright 2020 Sébastien Crozet. Modified 2026. See vendor/RAPIER-LICENSE.txt.
 * Only native static convex proxy A and a single local-zero sphere proxy B.
 * Discrete control stays on host; selected backend performs every numerical stage.
 */
(function(G){'use strict';
const common=typeof module!=='undefined'&&module.exports,MathStage=common?require('./experimental-ccd-sweep-math'):G.LabCcdSweepMathExperimental,f=Math.fround,copy=x=>structuredClone(x);
function proxyModule(){return common?require('./experimental-ccd-proxy-distance'):G.LabCcdProxyDistanceExperimental;}
function scalar(x,label){if(typeof x!=='number'||!Number.isFinite(x)||f(x)!==x)throw TypeError('Native finite f32 '+label+' required');}
function vec(x,n,label){if(!Array.isArray(x)||x.length!==n)throw TypeError(label);x.forEach(a=>scalar(a,label));}
function validate(input){const s=copy(input);if(!s||Object.keys(s).some(k=>!['pointsA','radiusA','radiusB','a','b','maxFraction','linearSlop'].includes(k)))throw TypeError('Exact sphere/convex sweep fields required');if(!Array.isArray(s.pointsA)||s.pointsA.length<1||s.pointsA.length>64)throw RangeError('Bounded native proxy vertex roster required');s.pointsA.forEach(p=>vec(p,3,'pointsA'));for(const k of['radiusA','radiusB','maxFraction','linearSlop'])scalar(s[k],k);if(s.radiusA<0||s.radiusB<=0||s.maxFraction<=0||s.maxFraction>1||s.linearSlop<=0)throw RangeError('Positive sphere/slop and fraction range required');for(const k of['a','b']){const q=s[k];if(!q||Object.keys(q).some(k=>!['localCenter','c1','c2','q1','q2'].includes(k)))throw TypeError('Exact source sweep required');for(const v of['localCenter','c1','c2'])vec(q[v],3,k+'.'+v);for(const v of['q1','q2']){vec(q[v],4,k+'.'+v);if(Math.abs(q[v].reduce((sum,x)=>sum+x*x,0)-1)>2e-5)throw RangeError('Source unit rotation required');}}if(s.a.c1.some((v,i)=>v!==s.a.c2[i])||s.a.q1.some((v,i)=>v!==s.a.q2[i]))throw RangeError('Only fixed target sweep supported');if(s.b.localCenter.some(v=>v!==0))throw RangeError('Only source local-zero sphere COM supported');return s;}
function unique(indices,count){return new Set(indices.slice(0,count)).size;}
async function solve(s,math,distance){
 const shifted=await math('shift',{a:s.a,b:s.b}),a={...s.a,c1:shifted.aC1,c2:shifted.aC2},b={...s.b,c1:shifted.bC1,c2:shifted.bC2},origin=shifted.origin;
 const {target,tolerance,plus,minus}=await math('target',{radiusA:s.radiusA,radiusB:s.radiusB,slop:s.linearSlop});
 const output={status:'Separated',fraction:s.maxFraction,point:[0,0,0],normal:[0,0,0]},diagnostics={distanceQueries:0,rootIterations:0,pushBacks:0};
 let t1=0,cache={count:0,metric:0,indexA:[0,0,0],indexB:[0,0,0]};
 while(true){
  const relative=await math('relative',{a,b,t:t1});
  const d=await distance({pos12:{translation:relative.translation,rotation:relative.rotation},cache,useRadii:false});cache=copy(d.cache);diagnostics.distanceQueries++;
  const hit=await math('worldDistance',{a,t:t1,normal:d.normal,pointA:d.pointA,pointB:d.pointB,radiusA:s.radiusA,radiusB:s.radiusB,origin});
  if(d.distance<=0){output.status='Overlapped';output.fraction=0;break;}
  if(d.distance<=plus){Object.assign(output,{status:'Hit',fraction:t1,point:hit.point,normal:hit.normal});break;}
  if(diagnostics.distanceQueries===25){Object.assign(output,{status:'Failed',fraction:t1,point:hit.point,normal:hit.normal});break;}
  if(!Number.isInteger(cache.count)||cache.count<1||cache.count>3||cache.indexB.slice(0,cache.count).some(i=>i!==0))throw Error('Invalid source sphere simplex cache');
  let separation={type:'Vertices',witness1:hit.normal,witness2:[0,0,0]};
  if(cache.count===3){if(unique(cache.indexA,cache.count)!==3)throw RangeError('Unreachable sphere separation simplex');const face=await math('face',{a,b,t:t1,points:cache.indexA.slice(0,3).map(i=>s.pointsA[i])});separation={type:'FaceA',...face};}
  let done=false,t2=s.maxFraction,pushBacks=0;
  while(true){
   const found=await math('find',{a,b,t:t2,pointsA:s.pointsA,...separation});let s2=found.separation;const indexA=found.indexA;
   if((await math('difference',{a:s2,b:target})).value>tolerance){output.status='Separated';output.fraction=s.maxFraction;done=true;break;}
   if(s2>=minus){t1=t2;break;}
   let s1=(await math('evaluate',{a,b,t:t1,pointsA:s.pointsA,indexA,...separation})).separation;
   if(s1<minus){output.status='Failed';output.fraction=t1;done=true;break;}
   if(s1<=plus){Object.assign(output,{status:'Hit',fraction:t1,point:hit.point,normal:hit.normal});done=true;break;}
   let count=0,a1=t1,a2=t2;
   while(true){
    const t=(await math('root',{method:count%2===1?'false-position':'bisect',a1,a2,s1,s2,target})).t;count++;diagnostics.rootIterations++;
    const value=(await math('evaluate',{a,b,t,pointsA:s.pointsA,indexA,...separation})).separation;
    if(Math.abs((await math('difference',{a:value,b:target})).value)<=tolerance){t2=t;break;}
    if(value>target){a1=t;s1=value;}else{a2=t;s2=value;}
    if(count===50)break;
   }
   pushBacks++;diagnostics.pushBacks++;if(pushBacks===s.pointsA.length+1)break;
  }
  if(done)break;
 }
 return {...output,diagnostics};
}
async function reference(input){const s=validate(input),P=proxyModule();return solve(s,(kind,args)=>MathStage.reference(kind,args),q=>P.reference({pointsA:s.pointsA,...q}));}
async function createGpuQuery(device,{pointsA}){const points=copy(pointsA),P=proxyModule();let numeric,proxy,busy=false,disposed=false;try{numeric=await MathStage.createGpuStage(device);proxy=await P.createGpuStage(device,{pointsA:points});}catch(e){numeric?.dispose();proxy?.dispose();throw e;}return Object.freeze({async query(input){if(disposed||busy)throw Error('CCD sweep query unavailable');const s=validate({...input,pointsA:points});busy=true;try{return await solve(s,(kind,args)=>numeric.step(kind,args),q=>proxy.step(q));}finally{busy=false;}},dispose(){if(busy)throw Error('CCD sweep busy');if(disposed)return;disposed=true;numeric.dispose();proxy.dispose();}});}
const api=Object.freeze({CAPABILITY:Object.freeze({fixedConvexSphere:true,sourceRootIterations:true,worldIntegration:false}),validate,reference,createGpuQuery});G.LabCcdSweepToiExperimental=api;if(common)module.exports=api;
})(globalThis);
