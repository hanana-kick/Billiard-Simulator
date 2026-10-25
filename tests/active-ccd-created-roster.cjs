'use strict';
// SPDX-License-Identifier: Apache-2.0
// Initial-only original native CCD target/filter provenance; no later snapshot.
const fs=require('node:fs'),assert=require('node:assert/strict'),D=require('../tools/rapier-snapshot-decoder'),F=require('./active-ccd-original-fixture.cjs'),P=require('./active-ccd-source-capture.cjs');
function exportRoster(originalFile){const original=F.load(originalFile),raw=original.boundaries.created,decoded=D.decodeSnapshot(raw.snapshot,{binary:process.env.RAPIER_SNAPSHOT_DECODER,engineVersion:D.ENGINE_VERSION}),field=D.field;
 const bodies=field(field(field(decoded.state,'bodies'),'bodies'),'items').items.flatMap((e,index)=>e.variant==='Occupied'?[{handle:{index,generation:Number(field(e,'generation').value)},...P.plain(field(e,'value'))}]:[]);
 const colliders=field(field(field(decoded.state,'colliders'),'colliders'),'items').items.flatMap((e,index)=>e.variant==='Occupied'?[{handle:{index,generation:Number(field(e,'generation').value)},...P.plain(field(e,'value'))}]:[]);
 const nodes=field(field(field(decoded.state,'broad_phase'),'tree'),'nodes').value.items,proxies=new Map();for(const w of nodes)for(const side of['left','right']){const n=field(w,side),p=P.plain(n);if((p.data&0x3fffffff)===1)proxies.set(p.children,{min:p.mins,max:p.maxs});}
 const equal=(a,b)=>a.index===b.index&&a.generation===b.generation,body=h=>bodies.find(b=>equal(b.handle,h));
 const statics=original.registry.statics.map(s=>{const collider=colliders.find(c=>equal(c.handle,s.collider)),b=body(s.body),proxy=proxies.get(s.collider.index);assert.ok(collider&&b&&proxy);assert.equal(b.body_type,'Fixed');return{label:s.label,kind:s.kind,bodyHandle:s.body,bodyPose:b.pos.position,bodyType:b.body_type,collider,initialFatProxy:proxy};});assert.equal(statics.length,16);
 const dynamicBodies=bodies.filter(b=>b.body_type==='Dynamic').map(b=>({handle:b.handle,bodyType:b.body_type,position:b.pos.position,ccd:b.ccd,maxExtent:b.mprops.max_extent,colliders:colliders.filter(c=>c.parent&&equal(c.parent.handle,b.handle)),originalBall:original.registry.objects.find(o=>equal(o.body,b.handle))??null}));
 return{schema:'initial-only-original-active-ccd-target-roster-v1',sourceRevision:D.SOURCE_REVISION,engineSha256:D.ENGINE_SHA256,initialSnapshotSha256:raw.snapshotSha256,sourceBoundary:'original-source-strike-created-before-first-h',laterStateIncluded:false,input:F.input,integration:P.plain(field(decoded.state,'integration_parameters')),statics,dynamicBodies};
}
module.exports={exportRoster};if(require.main===module){const out=process.argv[3];assert.ok(out&&!fs.existsSync(out),'Explicit new roster output required');fs.writeFileSync(out,JSON.stringify(exportRoster(process.argv[2]),null,2)+'\n',{flag:'wx'});console.log(out);}
