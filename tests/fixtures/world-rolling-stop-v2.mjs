// Fixture-only source: importing this module cannot register native tests.
import {fixture} from './mixed-motion-v2.mjs';
import {scene} from './mixed-motion-query.mjs';
const Q=2**24;
export function stopFixture(options={}){const f=fixture({h:64,speed:1,K:Q/4,spin:Q/32,...options});f.state[1]=7;f.state[2]=6;f.state[6]=0xffffffff;f.state[8]=f.state[5];f.state[21]=3;f.state[45]=2;f.state[56]=4;f.state[61]=1;f.state[62]=1000;f.state[63]=9;f.context[24]=0x7fffffff;f.context.set(scene.slice(4,8),9);f.dense=new Uint32Array(256);for(let i=0;i<256;i++)f.dense[i]=i;return{current:{state:f.state,dense:f.dense},rows:f.rows,context:f.context,scene};}
