/** Shared Q24 contact arithmetic. Exact CPU/WGSL formulas; callers own range admission. */
import {multiplyWide} from './deterministic-axial.mjs';
import {divideWide,CONTACT_DIVISION_WGSL} from './deterministic-contact.mjs';
const Q=2**24,NONE=0xffffffff;
export const CONTACT_MATH_VERSION=0x43334d01;
export function createContactMath(){const c={bad:false,muls:0,divs:0,norms:0};
 c.add=(a,b)=>{const sum=a+b;if(!Number.isSafeInteger(sum)||sum< -0x7fffffff||sum>0x7fffffff){c.bad=true;return 0;}return sum;};
 c.mul=(a,b)=>{c.muls++;const [lo,hi]=multiplyWide(Math.abs(a),Math.abs(b));if(hi>=0x800000){c.bad=true;return 0;}const v=hi*256+(lo>>>24)+((lo&0xffffff)>=0x800000?1:0);if(v>0x7fffffff){c.bad=true;return 0;}return (a<0)!==(b<0)?-v:v;};
 c.div=(a,b,floor=false)=>{c.divs++;if(b<=0){c.bad=true;return 0;}const [lo,hi]=multiplyWide(Math.abs(a),Q),d=divideWide(lo,hi,b);if(!d.valid){c.bad=true;return 0;}const v=d.quotient+(!floor&&d.remainder>=Math.ceil(b/2)?1:0);if(v>0x7fffffff){c.bad=true;return 0;}return a<0?-v:v;};
 c.norm=a=>{c.norms++;let lo=0,hi=0;for(const x of a){const p=multiplyWide(Math.abs(x),Math.abs(x)),sum=lo+p[0];lo=sum>>>0;hi+=p[1]+(sum>NONE?1:0);}if(hi>=0x40000000){c.bad=true;return 0;}let l=0,h=0x7fffffff;while(l<h){const m=l+Math.ceil((h-l)/2),p=multiplyWide(m,m);if(p[1]<hi||(p[1]===hi&&p[0]<=lo))l=m;else h=m-1;}const p=multiplyWide(l,l);const result=l+(p[0]!==lo||p[1]!==hi?1:0);if(result>0x7fffffff){c.bad=true;return 0;}return result;};
 c.equalSquare=(a,n)=>{let lo=0,hi=0;for(const x of a){const p=multiplyWide(Math.abs(x),Math.abs(x)),sum=lo+p[0];lo=sum>>>0;hi+=p[1]+(sum>NONE?1:0);}const p=multiplyWide(n,n);return lo===p[0]&&hi===p[1];};
 c.dot=(a,b)=>a.reduce((s,x,i)=>s+c.mul(x,b[i]),0);
 c.cross=(a,b)=>[c.mul(a[1],b[2])-c.mul(a[2],b[1]),c.mul(a[2],b[0])-c.mul(a[0],b[2]),c.mul(a[0],b[1])-c.mul(a[1],b[0])];
 c.unit=a=>{a=a.slice();let largest=Math.max(...a.map(Math.abs));if(largest===0||largest>=0x40000000){c.bad=true;return [0,0,0];}while(largest<0x20000000){a=a.map(x=>x*2);largest*=2;}const n=c.norm(a);if(n<1){c.bad=true;return [0,0,0];}return a.map(x=>c.div(x,n));};
 c.scale=(a,s)=>a.map(x=>c.mul(x,s));
 c.disk=(a,limit)=>{const n=c.norm(a);if(n<=limit)return a.slice();const scale=c.div(limit,n,true);return a.map(x=>{const [lo,hi]=multiplyWide(Math.abs(x),scale);const v=hi*256+(lo>>>24);return x<0?-v:v;});};
 c.cone=(mu,n)=>{const [lo,hi]=multiplyWide(mu,n);return hi*256+(lo>>>24);};return c;
}
export const CONTACT_MATH_WGSL=`
const Q:i32=16777216;
var<private> bad:bool;var<private> muls:u32;var<private> divs:u32;var<private> norms:u32;
${CONTACT_DIVISION_WGSL}
fn safeAdd(a:i32,b:i32)->i32{if((b>0&&a>2147483647-b)||(b<0&&a< -2147483647-b)){bad=true;return 0;}return a+b;}
fn mul(a:i32,b:i32)->i32{muls++;let w=wide(u32(abs(a)),u32(abs(b)));if(w.y>=0x800000u){bad=true;return 0;}let value=(w.y<<8u)+(w.x>>24u)+select(0u,1u,(w.x&0xffffffu)>=0x800000u);if(value>0x7fffffffu){bad=true;return 0;}return select(i32(value),-i32(value),(a<0)!=(b<0));}
fn divide(a:i32,b:i32,floorResult:bool)->i32{divs++;if(b<=0){bad=true;return 0;}let w=wide(u32(abs(a)),16777216u);let d=divideWide(w.x,w.y,u32(b));if(d.z==0u){bad=true;return 0;}let value=d.x+select(0u,1u,!floorResult&&d.y>=((u32(b)>>1u)+(u32(b)&1u)));if(value>0x7fffffffu){bad=true;return 0;}return select(i32(value),-i32(value),a<0);}
fn norm(a:vec3<i32>)->i32{norms++;var low=0u;var high=0u;for(var j=0u;j<3u;j++){let p=wide(u32(abs(a[j])),u32(abs(a[j])));let sum=low+p.x;high+=p.y+select(0u,1u,sum<low);low=sum;}if(high>=0x40000000u){bad=true;return 0;}var l=0u;var h=0x7fffffffu;loop{if(l>=h){break;}let m=l+((h-l)>>1u)+((h-l)&1u);let p=wide(m,m);if(p.y<high||(p.y==high&&p.x<=low)){l=m;}else{h=m-1u;}}let p=wide(l,l);let result=l+select(0u,1u,p.x!=low||p.y!=high);if(result>0x7fffffffu){bad=true;return 0;}return i32(result);}
fn equalSquare(a:vec3<i32>,n:i32)->bool{var low=0u;var high=0u;for(var j=0u;j<3u;j++){let p=wide(u32(abs(a[j])),u32(abs(a[j])));let sum=low+p.x;high+=p.y+select(0u,1u,sum<low);low=sum;}let p=wide(u32(n),u32(n));return p.x==low&&p.y==high;}
fn crossq(a:vec3<i32>,b:vec3<i32>)->vec3<i32>{return vec3<i32>(mul(a.y,b.z)-mul(a.z,b.y),mul(a.z,b.x)-mul(a.x,b.z),mul(a.x,b.y)-mul(a.y,b.x));}
fn unit(input:vec3<i32>)->vec3<i32>{var a=input;var largest=max(abs(a.x),max(abs(a.y),abs(a.z)));if(largest==0||largest>=0x40000000){bad=true;return vec3<i32>(0);}loop{if(largest>=0x20000000){break;}a*=2;largest*=2;}let n=norm(a);if(n<1){bad=true;return vec3<i32>(0);}return vec3<i32>(divide(a.x,n,false),divide(a.y,n,false),divide(a.z,n,false));}
fn disk(a:vec2<i32>,limit:i32)->vec2<i32>{let n=norm(vec3<i32>(a,0));if(n<=limit){return a;}let scale=divide(limit,n,true);var out:vec2<i32>;for(var j=0u;j<2u;j++){let w=wide(u32(abs(a[j])),u32(scale));let value=i32((w.y<<8u)+(w.x>>24u));out[j]=select(value,-value,a[j]<0);}return out;}
fn cone(mu:i32,n:i32)->i32{let w=wide(u32(mu),u32(n));return i32((w.y<<8u)+(w.x>>24u));}
`;
