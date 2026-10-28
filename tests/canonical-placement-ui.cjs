'use strict';
// Render the existing App controls without mounting a world. Not browser/drag QA.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');
const source=app.slice(0,app.indexOf('function HelpDialog('))+'\nexport {Placement,MaterialSettings,PositionInput,positionDraftChanged};';
const code=esbuild.buildSync({absWorkingDir:root,stdin:{contents:source,resolveDir:path.join(root,'src'),sourcefile:'App.tsx',loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic'}).outputFiles[0].text;
const compiled=new Module(path.join(__dirname,'.canonical-placement-ui.cjs'),module);compiled.filename=path.join(__dirname,'.canonical-placement-ui.cjs');compiled.paths=module.paths;
const old=globalThis.LabController;try{globalThis.LabController=class{};compiled._compile(code,compiled.filename);}finally{if(old===undefined)delete globalThis.LabController;else globalThis.LabController=old;}
const {Placement,MaterialSettings,PositionInput,positionDraftChanged}=compiled.exports;
const base={ready:true,canAim:true,selectedId:19,objects:[{id:19,label:'흰 공',pos:{x:.123456789,z:.5}}],height:0,params:Object.fromEntries(['clothFriction','cushionRestitution','cushionFriction','ballRestitution','ballFriction','tipFriction','gravity','rollingLength','spinLength'].map(key=>[key,0]))};
const render=(component,state)=>renderToStaticMarkup(React.createElement(component,{state:{...base,...state}}));
test('canonical placement reuses x/z with precision and explicitly excludes unsupported operations',()=>{
 const html=render(Placement,{canonicalPlayback:{}});for(const id of ['placementObject','posX','posZ'])assert.ok(html.includes('id="'+id+'"'));
 for(const id of ['posY','height','drop','putOnTable','remove','addBall','addBox'])assert.ok(!html.includes('id="'+id+'"'),id);
 for(const text of ['Q24','1/16,777,216 m','보수적으로','거부','탐색 후보를 무효화','드래그'])assert.ok(html.includes(text));
 assert.ok(html.includes('value="12.3456789"'));assert.ok(html.includes('step="any"'));
 assert.match(render(Placement,{canonicalPlayback:{},canAim:false}),/<input[^>]*id="posX"[^>]*disabled/);
});
test('default placement controls and numeric formatting remain unchanged',()=>{
 const html=render(Placement,{});for(const id of ['posY','height','drop','putOnTable','remove','addBall','addBox'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(html.includes('value="12.3"'));assert.ok(!html.includes('canonicalPlacementScope'));
});
test('canonical material/mode controls remain fixed and reset discloses its scope',()=>{
 const html=render(MaterialSettings,{canonicalPlayback:{}});assert.ok(html.includes('고정 재질'));assert.ok(!html.includes('id="p-'));
 assert.ok(render(MaterialSettings,{}).includes('id="p-clothFriction"'));
 assert.ok(app.includes("{s.canonicalPlayback?<p className=\"helper\">현재 게임 모드는 고정됩니다."));
 assert.ok(app.includes('id="reset" variant="outline" size="sm" disabled={!!s.canonicalPlayback?.deviceLost}'));assert.ok(app.includes('탐색 조합은 유지합니다'));assert.ok(app.includes('GPU 장치 손실은 복구하지 않습니다'));
});

test('unchanged precise focus/blur never writes or quantizes bootstrap/Q24 source coordinates',()=>{
 for(const meters of [-.38645598584933644, 1234567/16777216]){const display=String(meters*100);assert.equal(positionDraftChanged(display,display,true),false);assert.equal(positionDraftChanged(display+'1',display,true),true);}
 assert.equal(positionDraftChanged('12.3','12.3',false),true);
 assert.ok(app.includes('positionDraftChanged(draft,initialDraft.current,precise)&&'));assert.ok(app.includes('initialDraft.current=format(value);setDraft(initialDraft.current)'));assert.ok(app.includes('value={editing?draft:format(value)}'));
});
