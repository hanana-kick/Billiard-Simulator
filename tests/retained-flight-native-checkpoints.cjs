'use strict';
// Reuse the established assertion functions verbatim without loading their
// native oracle/import dependencies into the candidate process. No arithmetic,
// tolerance, field selection, or source comparison function is rewritten.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const sources=['four-ball-broad-graph-seed.cjs','four-ball-active-ccd-native-compare.cjs','elevated-flight-world-replay.cjs','goal-four-broad-graph-seed.cjs'];
const text=Object.fromEntries(sources.map(f=>[f,fs.readFileSync(path.join(__dirname,f),'utf8')]));
function section(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
const same=(a,b)=>a?.index===b?.index&&a?.generation===b?.generation,copy=x=>structuredClone(x),U=0xffffffff;
const Graph=new Function('assert','same','copy','U',section(text[sources[0]],'function graphView(','function exportInitialSeeds(')+';return{graphView};')(assert,same,copy,U);
const GoalGraph=new Function('assert','same','copy','U',section(text[sources[3]],'function graphView(','function exportInitialSeeds(')+';return{graphView};')(assert,same,copy,U);
const file=path.join(__dirname,sources[1]),native=new Module(file);native.filename=file;native.require=id=>{if(id==='node:assert/strict')return assert;if(id==='./four-ball-broad-graph-seed.cjs')return Graph;throw Error('Unexpected native comparison dependency '+id);};native._compile(text[sources[1]],file);
const source=text[sources[2]],constants=section(source,'const TOLERANCES=','function sourceHashes('),checks=section(source,'function sourceSolverRoster(','function compareFrame(');
const api=new Function('assert','Graph','Native','CueClothNative','same','copy',constants+checks+';return{checkpoint,TOLERANCES};')(assert,GoalGraph,native.exports,require('./cue-cloth-cache-native-compare.cjs'),same,copy);
module.exports={...api,sourceHashes:Object.fromEntries(sources.map(f=>[f,crypto.createHash('sha256').update(text[f]).digest('hex')]))};
