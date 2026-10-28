/* SPDX-License-Identifier: Apache-2.0
 * Initial-only packing of the authenticated original registered four-ball
 * geometry/cache roster. No native stepping and no future/oracle states.
 */
import * as importedWorld from '../experimental-four-ball-world.js';
const World=importedWorld.default??globalThis.LabFourBallWorldExperimental;
import * as importedPairContact from '../experimental-pair-contact-stage.js';
const PairContact=importedPairContact.default??globalThis.LabPairContactStageExperimental;
import * as importedCushionContact from '../experimental-cushion-contact-stage.js';
const CushionContact=importedCushionContact.default??globalThis.LabCushionContactStageExperimental;
import {packFloorNarrow,packPairNarrow,packConvexNarrow,NARROW_LAYOUT} from './narrowphase.mjs';
import {packSharedConvexHull,CONVEX_POINT_LAYOUT} from './convex-point.mjs';
import {COUPLED_BODY_OFFSETS} from './coupled-solver.mjs';

export const GEOMETRY_CATALOG=Object.freeze({stride:16,kind:0,collider1:1,generation1:2,collider2:3,generation2:4,body1:5,body2:6,cache:7,cacheWords:8,hull:9,material:10,normal:11,impulse:12,point:13,status:14,reserved:15,kinds:Object.freeze({cloth:0,pair:1,convex:2}),none:0xffffffff});
const U=0xffffffff,f=Math.fround,key=h=>h.index+':'+h.generation,same=(a,b)=>key(a)===key(b);
const bits=a=>new Uint32Array(a.buffer,a.byteOffset,a.length).slice();
const vectors={linear:3,angular:3,translation:3,rotation:4,invMass:3,invInertia:9,principalInertia:3,invPrincipalInertia:3,principalFrame:4,userForce:3,userTorque:3};
export function packCanonicalBallBody(body){
 const out=new Float32Array(64);for(const[k,length]of Object.entries(vectors)){if(!Array.isArray(body[k])||body[k].length!==length||body[k].some(v=>!Number.isFinite(v)||!Object.is(f(v),v)))throw new RangeError('Exact original f32 body field required: '+k);out.set(body[k],COUPLED_BODY_OFFSETS[k]);}
 for(const k of['gravityScale','linearDamping','angularDamping','gyroscopic','allowFastRotation','radius']){const v=Number(body[k]);if(!Number.isFinite(v))throw new RangeError('Exact original body scalar required: '+k);out[COUPLED_BODY_OFFSETS[k]]=v;}
 if(body.force)out.set(body.force,COUPLED_BODY_OFFSETS.force);return bits(out);
}
export function packCreatedGeometry(initial){
 const seed=World.validate(initial);if(seed.kind!=='original-live-registered-four-ball-created-world')throw new RangeError('Actual registered-four live origin required');
 const parts=[],rows=[],hulls=[],hullOffsets=new Map(),bodyWords=new Uint32Array(4*64),descriptors=new Uint32Array(4*12);let cacheWords=0;
 seed.balls.forEach((b,i)=>{bodyWords.set(packCanonicalBallBody(b.state),i*64);descriptors.set([b.id,b.body.index,b.body.generation,b.collider.index,b.collider.generation,b.pairCollider.index,b.pairCollider.generation,0,0,0,0,0],i*12);});
 const add=(kind,c1,c2,b1,b2,data,hull=U,material=0)=>{
  const layouts=kind===0?{normal:55,impulse:70,point:130,status:137}:kind===1?{normal:148,impulse:167,point:201,status:323}:{normal:272,impulse:291,point:317,status:387};
  rows.push([kind,c1.index,c1.generation,c2.index,c2.generation,b1,b2,cacheWords,data.length,hull,material,cacheWords+layouts.normal,cacheWords+layouts.impulse,cacheWords+layouts.point,cacheWords+layouts.status,0]);parts.push(data);cacheWords+=data.length;
 };
 for(const[i,b]of seed.balls.entries())add(0,seed.pairSeed.floorCollider,b.collider,U,i,packFloorNarrow(b.state),U,1);
 for(const binding of seed.pairSeeds){const[i,j]=binding.ballIndices,a=seed.balls[i].state,b=seed.balls[j].state,p=PairContact.validate(binding.seed);
  const s={...a,...p.pair,bodies:[a,b],floorContacts:[a,b],friction:f(p.bodies[0].pairMaterial.friction*p.bodies[1].pairMaterial.friction),restitution:f(p.bodies[0].pairMaterial.restitution*p.bodies[1].pairMaterial.restitution),fatMin1:a.topology.ballMin,fatMax1:a.topology.ballMax,fatMin2:b.topology.ballMin,fatMax2:b.topology.ballMax};
  add(1,p.bodies[0].pairCollider,p.bodies[1].pairCollider,i,j,packPairNarrow(s));
 }
 // The original owner validates/normalizes EACH cushion seed before its first
 // snapshot. In particular an absent pair has identity recycle rotation, not
 // an all-zero quaternion. Use that unchanged validator, not invented defaults.
 for(const[i,rawSource]of seed.cushionSeeds.entries())for(let j=0;j<rawSource.cushions.length;j++){
  const source=CushionContact.validate(rawSource);
  const q=source.cushions[j],body=seed.balls[i].state,hk=key(q.colliderHandle);let hull=hullOffsets.get(hk);
  if(hull===undefined){hull=hulls.length*CONVEX_POINT_LAYOUT.hullWords;hullOffsets.set(hk,hull);hulls.push(packSharedConvexHull(q.hull));}
  // The unchanged numerical source query adapter places selected cushion first
  // and one dormant neighbor second; the second cache is not this row's owner.
  const cs=[q,source.cushions[(j+1)%source.cushions.length]],caches=cs.map(c=>({...c.cache,friction:c.friction,restitution:c.restitution,proxy:c.proxy}));
  const state={...body,body,floor:body,cushions:caches,queryIndex:0,hulls:cs.map(c=>c.hull),hullBounds:cs.map(c=>({min:[0,1,2].map(k=>Math.min(...c.hull.points.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...c.hull.points.map(p=>p[k])))}))};
  add(2,q.colliderHandle,seed.balls[i].collider,U,i,packConvexNarrow(state),hull,2);
 }
 const catalog=Uint32Array.from(rows.flat()),caches=new Uint32Array(cacheWords),geometry=new Uint32Array(hulls.length*CONVEX_POINT_LAYOUT.hullWords);let offset=0;for(const p of parts){caches.set(p,offset);offset+=p.length;}hulls.forEach((h,i)=>geometry.set(h,i*CONVEX_POINT_LAYOUT.hullWords));
 if(new Set(rows.map(r=>r.slice(1,5).join(':'))).size!==rows.length)throw new RangeError('Duplicate original cache owner');
 return Object.freeze({sourceIdentity:seed.initialSnapshotSha256,bodyWords,descriptors,catalog,caches,geometry,counts:Object.freeze({balls:4,floors:4,pairs:6,convex:rows.length-10,sharedHulls:hulls.length}),completeCueCacheRoster:false});
}
