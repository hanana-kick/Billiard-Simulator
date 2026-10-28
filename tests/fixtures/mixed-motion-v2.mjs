// Fixture-only module: no node:test registration. Definitions moved verbatim.
import assert from 'node:assert/strict';
import {wall,scene} from './mixed-motion-query.mjs';
import {prepareMixedMotionV2CPU,validateMixedMotionV2,mixedRollingRecipeCPU,mixedMotionBoundsV2CPU,sampleMixedMotionV2CPU,runMixedWorldQueryV2CPU} from '../../src/direct-candidate/deterministic-mixed-motion-v2.mjs';
import {mixedMotionBoundsCPU,runMixedWorldQueryCPU} from '../../src/direct-candidate/deterministic-mixed-motion-query.mjs';
import {sampleMixedMotionCPU} from '../../src/direct-candidate/deterministic-mixed-pair-entry.mjs';
import {runRollingPartialCPU} from '../../src/direct-candidate/deterministic-rolling-partial.mjs';
const Q=2**24;
function fixture({h=64,speed=Q/8,K=Q/4,spin=Q/32,S=Q/8}={}){const state=wall.state.slice(),s=new Int32Array(state.buffer),context=wall.context.slice(),c=new Int32Array(context.buffer);state[4]=h;context[13]=1;c[6]=K;c[7]=S;c.set([2000,2000,20000,20000,20000,20000,20000],16);for(let i=0;i<state[3];i++){const a=64+i*48,b=i*80;state[a]=wall.packet[b+3];state[a+22]=wall.packet[b+4];state[a+23]=wall.packet[b+17];s.set(new Int32Array(wall.packet.buffer).subarray(b+8,b+11),a+24);s.fill(0,a+27,a+33);state[a+40]=0;}state[104]=3;s.set([0,c[8]+s[86],0,speed,0,0,0,spin,-speed],88);const rows=prepareMixedMotionV2CPU(state,new Uint32Array(256),new Uint32Array(256),context);return{rows,state,context};}
function capacityFixture(){const f=fixture(),s=new Int32Array(f.state.buffer),r=s[86],mass=s[87],c=new Int32Array(f.context.buffer);f.state[3]=4;for(let i=0;i<4;i++){const a=64+48*i;f.state[a]=100+i;s[a+22]=r;s[a+23]=mass;s.set([Math.round((-.4+.25*i)*Q),c[8]+r,Math.round(.2*Q),Math.round(.01*Q),0,0,0,0,-Math.round(.01*Q)],a+24);f.state[a+40]=3;}const rows=prepareMixedMotionV2CPU(f.state,new Uint32Array(256),new Uint32Array(256),f.context),sc=scene.slice(),ss=new Int32Array(sc.buffer);sc[1]=20;for(let i=4;i<20;i++){const b=16+8*i;ss.set([3*Q,Math.round(3.1*Q),3*Q,Math.round(3.1*Q),3*Q,Math.round(3.1*Q)],b);sc[b+6]=1000+i;sc[b+7]=2;}return{rows,scene:sc};}

export {Q,fixture,capacityFixture};
