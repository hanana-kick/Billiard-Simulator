'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),v8=require('node:v8');
const {input,sourcePointSpeed}=require('./live-cue-ui-domain-capture.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),root=path.resolve(__dirname,'..');
test('fixed input is inside actual manual UI, not merely the broader strike validator',()=>{
  assert.deepEqual(input.settings,{angle:0,elevation:35,speed:5,tipX:.92,tipY:0});
  assert.ok(input.settings.speed<=5);assert.ok(Math.hypot(input.settings.tipX,input.settings.tipY)<=.92);
  assert.equal(input.noAutomaticAlternativeInputs,true);assert.deepEqual(input.placements,[]);assert.equal(input.extraSettlingSteps,0);
  const controller=fs.readFileSync(path.join(root,'src/controller.js'),'utf8');assert.match(controller,/speed:\[\.25,5\]/);assert.match(controller,/if\(r>\.92\)/);assert.match(controller,/this\.changeSettings\(result\.settings\)/);
});
test('point speed includes angular contribution instead of treating input speed as head speed',()=>{
  assert.equal(sourcePointSpeed({linear:[3,4,0],angular:[0,0,0]},.5),5);
  assert.equal(sourcePointSpeed({linear:[3,4,0],angular:[0,0,2]},.5),6);
});
test('sealed original fixed-shot artifact validates without replaying physics',{skip:!process.env.LIVE_CUE_UI_REPORT},()=>{
  const reportPath=path.resolve(process.env.LIVE_CUE_UI_REPORT),dir=path.dirname(reportPath),r=JSON.parse(fs.readFileSync(reportPath));
  assert.deepEqual(r.input,input);assert.equal(r.sourceOnly,true);assert.equal(r.originalFilesUnchanged,true);assert.equal(r.nativeSourcePreComparisonsExact,true);
  assert.equal(r.clearance.clear,true);assert.equal(r.accepted.ok,true);assert.equal(r.frameCount,174);assert.equal(r.totalPreChecks,348);assert.equal(r.activePreChecks,0);assert.equal(r.firstActive,null);
  for(const k of ['positiveTOIMeasured','positiveClampMeasured','postSolveActivationCoverage','universalUIExclusion'])assert.equal(r[k],false);
  for(const [file,sha]of Object.entries(r.identities.sources)){const full=file==='externalPinnedVendor'?r.identities.vendor:path.join(root,file);assert.equal(hash(fs.readFileSync(full)),sha,file);}
  for(const s of Object.values(r.snapshots)){const b=fs.readFileSync(path.join(dir,s.file));assert.equal(b.length,s.bytes);assert.equal(hash(b),s.sha256);}
  const raw=fs.readFileSync(path.join(dir,'original-capture.v8'));assert.equal(hash(raw),fs.readFileSync(path.join(dir,'original-capture.sha256'),'utf8').trim());
  const sealed=v8.deserialize(raw);assert.equal(sealed.frames.length,174);assert.equal(sealed.setters.length,2);assert.ok(sealed.setters.every(s=>s.method==='setLinvel'&&s.h===0));
  const bytes=fs.readFileSync(path.join(dir,r.trace.file));assert.equal(bytes.length,r.trace.bytes);assert.equal(hash(bytes),r.trace.sha256);const trace=v8.deserialize(bytes);assert.equal(trace.frames.length,r.frameCount);
  for(const role of ['shaft','head']){let peak=null;for(const frame of trace.frames){const b=frame[role],speed=sourcePointSpeed(b,r.bootstrap[role].maxExtent);assert.equal(speed,b.sourcePre.pointSpeed);assert.equal(b.sourcePre.active,false);if(!peak||speed>peak.pointSpeed)peak={h:frame.h,pointSpeed:speed};}
    assert.equal(peak.h,r.peak[role].h);assert.equal(peak.pointSpeed,r.peak[role].pointSpeed);
    const native=r.nativeChecks['peak-'+role].roles[role];assert.equal(native.maxExtent,r.bootstrap[role].maxExtent);assert.equal(native.ccdThickness,r.bootstrap[role].ccdThickness);
  }
});
