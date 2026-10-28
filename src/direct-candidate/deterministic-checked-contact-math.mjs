/** Checked variants for widened canonical consumers. The raw-strike compiler
 * path intentionally retains its separately owned arithmetic module/flags. */
import {createContactMath as baseMath,CONTACT_MATH_WGSL as BASE_WGSL} from './deterministic-contact-math.mjs';
import {multiplyWide} from './deterministic-axial.mjs';
const valid=x=>Number.isInteger(x)&&x>=-0x7fffffff&&x<=0x7fffffff;
export function createContactMath(){const c=baseMath(),add=c.add,mul=c.mul,div=c.div,norm=c.norm,equal=c.equalSquare,unit=c.unit;
 c.add=(a,b)=>{if(!valid(a)||!valid(b)){c.bad=true;return 0;}return add(a,b);};
 c.mul=(a,b)=>{if(!valid(a)||!valid(b)){c.muls++;c.bad=true;return 0;}return mul(a,b);};
 c.div=(a,b,floor=false)=>{if(!valid(a)||!valid(b)){c.divs++;c.bad=true;return 0;}return div(a,b,floor);};
 c.norm=a=>{if(a.length>3||a.some(x=>!valid(x))){c.norms++;c.bad=true;return 0;}return norm(a);};
 c.equalSquare=(a,n)=>{if(a.length>3||!valid(n)||a.some(x=>!valid(x))){c.bad=true;return false;}return equal(a,n);};
 c.dot=(a,b)=>a.reduce((sum,x,i)=>c.add(sum,c.mul(x,b[i])),0);
 c.cross=(a,b)=>[c.add(c.mul(a[1],b[2]),-c.mul(a[2],b[1])),c.add(c.mul(a[2],b[0]),-c.mul(a[0],b[2])),c.add(c.mul(a[0],b[1]),-c.mul(a[1],b[0]))];
 c.unit=a=>{if(a.some(x=>!valid(x))){c.bad=true;return [0,0,0];}return unit(a);};
 c.cone=(mu,n)=>{if(!valid(mu)||!valid(n)||mu<0||n<0){c.bad=true;return 0;}const [lo,hi]=multiplyWide(mu,n);if(hi>=0x800000){c.bad=true;return 0;}return hi*256+(lo>>>24);};
 return c;
}
export const CONTACT_MATH_WGSL=BASE_WGSL
 .replace('fn safeAdd(a:i32,b:i32)->i32{if((b>0&&a>2147483647-b)||(b<0&&a< -2147483647-b)){bad=true;return 0;}return a+b;}', 'fn safeAdd(a:i32,b:i32)->i32{let upper=2147483647-max(b,0);let lower= -2147483647-min(b,0);let invalid=any(vec4<bool>(a>upper,a<lower,a==(-2147483647-1),b==(-2147483647-1)));bad=select(bad,true,invalid);return select(a+b,0,invalid);}')
 .replace('muls++;let w=wide', 'muls++;let invalid=any(vec2<bool>(a==(-2147483647-1),b==(-2147483647-1)));bad=select(bad,true,invalid);let w=wide')
 .replace('return select(i32(value),-i32(value),(a<0)!=(b<0));', 'return select(select(i32(value),-i32(value),(a<0)!=(b<0)),0,invalid);')
 .replace('divs++;if(b<=0)', 'divs++;if(a==(-2147483647-1)||b<=0)')
 .replace('fn equalSquare(a:vec3<i32>,n:i32)->bool{var low=0u;', 'fn equalSquare(a:vec3<i32>,n:i32)->bool{if(any(a==vec3<i32>(-2147483647-1))||n==(-2147483647-1)){bad=true;return false;}var low=0u;')
 .replace('mul(a.y,b.z)-mul(a.z,b.y),mul(a.z,b.x)-mul(a.x,b.z),mul(a.x,b.y)-mul(a.y,b.x)', 'safeAdd(mul(a.y,b.z),-mul(a.z,b.y)),safeAdd(mul(a.z,b.x),-mul(a.x,b.z)),safeAdd(mul(a.x,b.y),-mul(a.y,b.x))')
 .replace('fn unit(input:vec3<i32>)->vec3<i32>{var a=input;', 'fn unit(input:vec3<i32>)->vec3<i32>{if(any(input==vec3<i32>(-2147483647-1))){bad=true;return vec3<i32>(0);}var a=input;')
 .replace('fn cone(mu:i32,n:i32)->i32{let w=wide(u32(mu),u32(n));return', 'fn cone(mu:i32,n:i32)->i32{if(mu<0||n<0){bad=true;return 0;}let w=wide(u32(mu),u32(n));if(w.y>=0x800000u){bad=true;return 0;}return');
