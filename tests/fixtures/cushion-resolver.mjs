// Fixture-only module: no node:test registration. Definitions moved verbatim.
import assert from 'node:assert/strict';
import {scene,hulls,wall} from './mixed-motion-query.mjs';
import {packVerifiedCushionRailMap} from '../../src/direct-candidate/deterministic-world-cushion-commit.mjs';
import {runCushionResolverCPU,createCushionResolverGPU,commitCushionDepartureCPU} from '../../src/direct-candidate/deterministic-cushion-resolver.mjs';
const material={mass:.21,restitution:.8,friction:.14,clothRestitution:0,clothFriction:.2,maxPointErrorQuanta:64,maxNormalErrorQuanta:4096},rails=packVerifiedCushionRailMap(hulls,Array.from(new Int32Array(scene.buffer).slice(4,8)));
function fixture(options={}){const state=wall.state.slice(),context=wall.context.slice(),rows=wall.packet.slice(),s=new Int32Array(state.buffer),c=new Int32Array(context.buffer);state[1]=7;state[2]=7;state[5]=state[8]=1234;state[6]=0xffffffff;context[24]=0x7fffffff;c.set(new Int32Array(rails.buffer).slice(10,14),9);c.set([2000,2000,20000,20000,20000,20000,20000],16);for(let i=0;i<state[3];i++){const a=64+48*i,b=80*i;state[a]=rows[b+3];state[a+22]=rows[b+4];state[a+23]=rows[b+17];state[a+40]=rows[b+1];state.set(rows.slice(b+8,b+17),a+24);rows[b+6]=1234;}return{current:{state,dense:new Uint32Array(256)},rows,context,options};}
const cases=[fixture({releaseTicks:16}),fixture({releaseTicks:64}),fixture({releaseTicks:512}),fixture({releaseTicks:4096}),fixture()];cases[4].rows[8]++;
const run=f=>runCushionResolverCPU(f.current,f.rows,scene,hulls,f.context,rails,material,f.options);
const deadline=fixture();deadline.context[24]=run(cases[0]).impact.state[5]+32;cases.push(deadline);for(const k of [48,49,50]){const f=fixture();f.rows[k]++;cases.push(f);}

export {material,rails,fixture,cases,run,deadline};
