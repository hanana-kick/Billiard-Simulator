/* SPDX-License-Identifier: Apache-2.0
 * Bounded compensated arithmetic for the application's JS Number -> native f32
 * cue-tip boundary. Two f32 components carry about 48 significant bits, not
 * IEEE binary64. Source JS reference remains separate; overflow fails closed.
 * Error-free transforms use independently rounded scalar graph nodes (no FMA).
 */
(function(G){'use strict';
function attach({op,c,add,sub,mul,div,choose}){const zero=c(0),one=c(1),minus=c(-1),split=c(4097),half=c(.5),neg=x=>mul(x,minus),quick=(a,b)=>{const h=add(a,b);return[h,sub(b,sub(h,a))];},twoSum=(a,b)=>{const h=add(a,b),v=sub(h,a),l=add(sub(a,sub(h,v)),sub(b,v));return[h,l];},twoProduct=(a,b)=>{const h=mul(a,b),sa=mul(split,a),ah=sub(sa,sub(sa,a)),al=sub(a,ah),sb=mul(split,b),bh=sub(sb,sub(sb,b)),bl=sub(b,bh),l=add(add(add(sub(mul(ah,bh),h),mul(ah,bl)),mul(al,bh)),mul(al,bl));return[h,l];};
 const of=x=>[x,zero],constant=x=>[c(Math.fround(x)),c(Math.fround(x-Math.fround(x)))],plus=(a,b)=>{const s=twoSum(a[0],b[0]),t=add(s[1],add(a[1],b[1]));return quick(s[0],t);},negative=a=>a.map(neg),minusPair=(a,b)=>plus(a,negative(b)),times=(a,b)=>{const p=twoProduct(a[0],b[0]),tail=add(add(add(p[1],mul(a[0],b[1])),mul(a[1],b[0])),mul(a[1],b[1]));return quick(p[0],tail);},quotient=(a,b)=>{const q=div(a[0],b[0]),r=minusPair(a,times(b,of(q))),q2=div(add(r[0],r[1]),b[0]);return quick(q,q2);},select=(condition,a,b)=>[choose(condition,a[0],b[0]),choose(condition,a[1],b[1])],lt=(a,b)=>{const d=minusPair(a,b);return choose(d[0],op('lt',d[0],zero),op('lt',d[1],zero));},gt=(a,b)=>lt(b,a),max=(a,b)=>select(gt(a,b),a,b),sqrt=a=>{const safe=op('max',a[0],zero),s=op('sqrt',safe),nonzero=op('gt',s,zero),r=minusPair(a,times(of(s),of(s))),correction=quotient(r,of(choose(nonzero,mul(c(2),s),one)));return select(nonzero,plus(of(s),correction),of(zero));};
 return{of,constant,add:plus,sub:minusPair,mul:times,div:quotient,neg:negative,select,lt,gt,max,sqrt,round:a=>add(a[0],a[1]),zero:of(zero),one:of(one)};
}
const api=Object.freeze({attach});G.LabDoubleSingleExperimental=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
