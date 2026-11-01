// SPDX-License-Identifier: Apache-2.0
// Pure initial projection; source lineage and supported boundary are documented
// in docs/browser-initial-four-ball-import.md. No world restore or physics step.
const copy=x=>structuredClone(x), f=Math.fround, SOURCE='b716d375efc0201003f0cd9ef7168eee0b62c177';
function validate(input){
 const s=copy(input);
 const fresh=s.kind==='source-created-four-ball-body-initialization'&&s.role==='freshBall';
 if((!fresh&&s.kind!=='source-created-cue-body-initialization')||s.sourceRevision!==SOURCE||s.phase!=='post-source-strike-pre-first-h'||s.additionalLocalMass!==null||s.initialMaxExtent!==0||s.initialLocalMassWasDefault!==true||s.lockedAxes!==0||s.enabled!==true)throw RangeError('Unchanged original creation boundary required');
 const specs={shaft:[['Cylinder',f((1.35-.12)/2),f(.011),f(.54-.012),[0,f(-.006-.12-(1.35-.12)/2),0]]],head:[['Ball',0,f(.006),f(.012),[0,0,0]],['Cylinder',f(.12/2),f(.0058),0,[0,f(-.006-.12/2),0]]],guide:[],...(fresh?{freshBall:[['Ball',0,f(.03075),f(.21),[0,0,0]],['Ball',0,f(.03075),0,[0,0,0]]]}:{})};
 if(!Object.hasOwn(specs,s.role)||s.bodyType!==(s.role==='guide'?'Fixed':'Dynamic'))throw RangeError('Actual original creation role required');
 const vec=(a,n,k)=>{if(!Array.isArray(a)||a.length!==n||a.some(v=>typeof v!=='number'||!Number.isFinite(v)||v!==f(v)))throw TypeError('Exact finite f32 '+k+' required');};
 for(const[k,n]of Object.entries({translation:3,rotation:4,localCom:3,invPrincipalInertia:3,principalFrame:4}))vec(s[k],n,k);
 if(s.translation.some(x=>Math.abs(x)>10)||s.localCom.some(x=>Math.abs(x)>2)||s.invPrincipalInertia.some(x=>x<0||x>1e8)||typeof s.localInvMass!=='number'||s.localInvMass!==f(s.localInvMass)||s.localInvMass<0||s.localInvMass>1000)throw RangeError('Bounded actual cue numeric domain required');
 for(const q of[s.rotation,s.principalFrame])if(Math.abs(q.reduce((a,x)=>a+x*x,0)-1)>2e-5)throw RangeError('Source unit quaternion required');
 if(!Array.isArray(s.colliders)||s.colliders.length!==specs[s.role].length||JSON.stringify(s.colliders)!==JSON.stringify(s.creationColliders))throw RangeError('Unchanged source attachment order and descriptors required');
 s.colliders.forEach((c,i)=>{const[k,hh,r,m,p]=specs[s.role][i];if(c.shape!==k||c.halfHeight!==hh||c.radius!==r||c.massMode!=='Mass'||c.mass!==m||c.enabled!==true||c.localTranslation.some((x,j)=>x!==p[j])||c.localRotation.some((x,j)=>x!==[0,0,0,1][j]))throw RangeError('Original enabled collider geometry/mass/local pose required');vec(c.localTranslation,3,'collider translation');vec(c.localRotation,4,'collider rotation');});
 if(s.role==='guide'&&(s.localInvMass!==0||s.invPrincipalInertia.some(x=>x!==0)||s.localCom.some(x=>x!==0)))throw RangeError('Original colliderless fixed guide required');
 // These are retained attachment-fold results, not a sphere formula or values
 // copied from first h. The original two concentric Ball attachments already
 // initialize local/world mass and CCD thickness before the first world step.
 if(fresh&&(s.localInvMass!==4.761904716491699||s.invPrincipalInertia.some(x=>x!==12590.1357421875)||s.localCom.some(x=>x!==0)||s.principalFrame.some((x,i)=>x!==[0,0,0,1][i])))throw RangeError('Exact original fresh-ball attachment mass identity required');
 return s;
}
export {validate};
