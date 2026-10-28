// HOST portable identity compatibility; no source worlds, GPU, private artifact.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import * as C from '../src/resident-candidate/inverse-terminal-observation.mjs';
import {mapInverseLogicalViewSource} from '../src/resident-candidate/inverse-observation-storage.mjs';
import {nodeHashInverseModule} from './resident-candidate-inverse-portable-hash-support.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),input={sourceSha256:sha('source'),initialSnapshotSha256:sha('initial'),requestSha256:sha('request'),generationId:'portable-bitwise-host',gameMode:'four',mode:'carom',requiresFullRest:true,candidates:[{id:219,purpose:'residual',topologyId:'a',topologyLength:2,settings:{angle:-0,elevation:8,speed:2,tipX:Number.MIN_VALUE,tipY:-Number.MIN_VALUE}}]};
test('portable codec identity/bytes equal independent Node SHA for signed-zero/subnormal and nullable/nonfinite observations',async()=>{
 const old=await nodeHashInverseModule('inverse-terminal-observation'),c=C.createInverseTerminalContract(input),reference=old.createInverseTerminalContract(input);assert.deepEqual(c,reference);
 const values={residuals:[-0,Number.MIN_VALUE,-Number.MIN_VALUE],inequalities:[NaN,Infinity,-Infinity,-0,0,-1,-2,-3,-4],residualAvailable:true,residualStage:0,eventPrefix:0,contactCell:null,clearance:null,goalVerified:false,verified:false,unsupported:false,steps:2,purpose:'residual'},rows=[{id:219,status:'evaluated',reason:'none',boundary:'physical-stop',observation:values}],words=C.packInverseTerminalObservations(c,rows);assert.deepEqual(words,old.packInverseTerminalObservations(reference,rows));assert.deepEqual(C.decodeInverseTerminalObservations(c,words),old.decodeInverseTerminalObservations(reference,words));
 const buffer=globalThis.Buffer,sab=globalThis.SharedArrayBuffer,shared=new Uint32Array(new SharedArrayBuffer(words.byteLength));try{globalThis.Buffer=undefined;globalThis.SharedArrayBuffer=undefined;assert.deepEqual(C.createInverseTerminalContract(input),reference);assert.deepEqual(C.decodeInverseTerminalObservations(c,words),rows);assert.throws(()=>C.decodeInverseTerminalObservations(c,shared),/detached/);}finally{globalThis.Buffer=buffer;globalThis.SharedArrayBuffer=sab;}
});
test('logical-view source and every proof hash remain byte-identical under independent Node SHA',async()=>{
 const old=await nodeHashInverseModule('inverse-observation-storage'),code='@group(0) @binding(5) var<storage,read_write> rc_event_audit:array<u32>;fn main(){if(arrayLength(&rc_event_audit)==8u){rc_event_audit[2u]=rc_event_audit[1u];}}',view={name:'observer',offset:64,words:8,totalWords:72};assert.deepEqual(mapInverseLogicalViewSource({code,view}),old.mapInverseLogicalViewSource({code,view}));
});
test('delivered optional observation modules contain no Node imports or Buffer dependency',()=>{
 for(const name of ['inverse-terminal-observation','inverse-world-query-join','inverse-observation-storage','inverse-audited-query-join']){const source=readFileSync(new URL('../src/resident-candidate/'+name+'.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/from\s*['"]node:|\bBuffer\b/);assert.match(source,/from '\.\/source-sha256\.mjs'/);}
});
