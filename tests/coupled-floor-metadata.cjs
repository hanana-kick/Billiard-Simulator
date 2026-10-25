'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {floorGeometryMetadata}=require('../src/experimental-coupled-contact-owner');
const row=(refresh,pair,active)=>({metadata:{geometryRefreshed:refresh},state:{topology:{pairPresent:pair,active}}});
test('recycled and skipped floor geometry preserves native zero/one manifold shape',()=>{
 for(const manifolds of [[],[{solverFlags:3,activeContactCount:1,graphPos:0xffffffff}]]){
  const prior={manifolds};for(const p of [row(false,true,false),{state:{topology:{pairPresent:true,active:true}}}])
   assert.deepEqual(floorGeometryMetadata(prior,p),{refreshed:false,manifolds:manifolds.map(({solverFlags,activeContactCount})=>({solverFlags,activeContactCount}))});
 }
});
test('full floor refresh preserves empty manifold during flight and recreates active point on landing',()=>{
 const prior={manifolds:[{solverFlags:1,activeContactCount:1}]};
 for(const [pair,active,count]of [[true,false,0],[true,true,1],[false,false,null]])
  assert.deepEqual(floorGeometryMetadata(prior,row(true,pair,active)),{refreshed:true,manifolds:count===null?[]:[{solverFlags:1,activeContactCount:count}]});
 assert.deepEqual(prior,{manifolds:[{solverFlags:1,activeContactCount:1}]});
});
