'use strict';
// SPDX-License-Identifier: Apache-2.0
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),v8=require('node:v8');
const O=require('./elevated-flight-original-cuecloth-observer.cjs'),C=require('./elevated-flight-original-fixture.cjs'),F=require('./four-ball-created-fixture.cjs');
test('supplement observes the exact original cloth-tip and ball-neck collider pairs',()=>assert.deepEqual(O.PAIRS,[[0,25],[16,26]]));
test('original UI-accepted obstructed low-tip stroke has positive native cloth-tip constraint before flight',{skip:!process.env.ELEVATED_FLIGHT_CUECLOTH_ORACLE},()=>{
 const file=process.env.ELEVATED_FLIGHT_CUECLOTH_ORACLE,bytes=fs.readFileSync(file),m=JSON.parse(fs.readFileSync(file+'.json')),p=v8.deserialize(bytes);
 assert.equal(F.hash(bytes),m.sha256);assert.equal(bytes.length,m.bytes);assert.equal(F.hash(fs.readFileSync(require.resolve('./elevated-flight-original-cuecloth-observer.cjs'))),m.observerSha256);assert.deepEqual(p.identity,C.identity());
 assert.equal(p.summary.initialSnapshotSha256,'bade93c4b1021ffc1531057cbbf35e18fa368e586ec2654a01093e304a52ccfb');assert.equal(p.summary.status,'native-rest-complete');assert.equal(p.summary.hCount,5346);
 assert.deepEqual(p.history.map(x=>x.h),[248,388,389,464]);
 const pair=(h,k)=>p.history.find(r=>r.h===h).contacts[k];
 for(const k of[0,1]){assert.equal(pair(248,k).pair,true);assert.equal(pair(248,k).points,0);assert.equal(pair(248,k).solverContacts,0);assert.deepEqual(pair(248,k).manifolds[0].normal,[0,0,0]);}
 assert.equal(pair(388,0).points,1);assert.equal(pair(388,0).solverContacts,1);assert.equal(pair(388,0).positive,false);assert.equal(pair(389,0).positive,true);assert.equal(pair(389,0).manifolds[0].impulses[0],.02441287226974964);
 assert.ok(p.history.every(r=>r.contacts[1].points===0&&r.contacts[1].solverContacts===0&&!r.contacts[1].positive));
 const rows=h=>p.rows.filter(r=>r.hCount===h);for(const h of[247,248])assert.deepEqual(rows(h).map(r=>r.boundary.split('-').at(-1)),['preWorld','postWorld','postApplication']);
 for(const row of[p.initial,...p.rows]){assert.equal(row.candidateInput,row===p.initial);assert.equal(F.hash(row.snapshot),row.snapshotSha256);assert.deepEqual(F.D.encodeLosslessTree(row.typedState),Buffer.from(row.snapshot));}
 const after=h=>p.rows.find(r=>r.hCount===h&&r.boundary.endsWith('-postWorld')),native=(h,a,b)=>after(h).contactPairs.find(c=>c.collider1.index===a&&c.collider2.index===b);
 assert.equal(native(247,0,25),undefined);assert.equal(native(247,16,26),undefined);assert.ok(native(248,0,25));assert.ok(native(248,16,26));
 const c=native(388,0,25).contacts.value,mf=c.manifolds[0];assert.equal(c.solver_color,127);assert.deepEqual(c.solver_color_bodies,[21,4294967295]);assert.deepEqual(mf.data.solver_body_ids,[4294967295,1]);assert.equal(mf.data.graph_pos,532676609);assert.deepEqual(mf.data.normal,[0,1,0]);assert.equal(mf.data.relative_dominance,128);assert.equal(mf.data.friction,.14000000059604645);assert.equal(mf.data.restitution,.04000000283122063);
 const roles=p.roles.map(r=>[r.index,r.collider.shape.variant,r.body.handle.index,r.body.body_type,r.collider.flags.collision_groups.memberships,r.collider.flags.collision_groups.filter]);assert.deepEqual(roles,[[0,'Cuboid',0,'Fixed',2,21],[16,'Ball',16,'Dynamic',1,6],[25,'Ball',21,'Dynamic',16,3],[26,'Cylinder',21,'Dynamic',4,3]]);
 assert.equal(native(464,0,25),undefined);assert.equal(native(464,16,26),undefined);
});
