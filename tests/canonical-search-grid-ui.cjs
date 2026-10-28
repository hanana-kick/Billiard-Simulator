'use strict';
// Pure draft parsing and real component SSR; not browser interaction coverage.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),Module=require('node:module');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..');
const code=esbuild.buildSync({absWorkingDir:root,entryPoints:['src/components/canonical-search-grid.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic'}).outputFiles[0].text;
const compiled=new Module(path.join(__dirname,'.canonical-search-grid-ui.cjs'),module);compiled.filename=path.join(__dirname,'.canonical-search-grid-ui.cjs');compiled.paths=module.paths;compiled._compile(code,compiled.filename);
const {CanonicalSearchGrid}=compiled.exports;
const grid={angles:[-2,0,2],speeds:[.5,.6,.7],elevations:[25],tipXs:[0],tipYs:[.2]};
const render=s=>renderToStaticMarkup(React.createElement(CanonicalSearchGrid,{state:{ready:true,paused:true,canAim:true,...s},controller:{}}));
test('draft preserves exact values and counts Cartesian population before application',async()=>{
 const {canonicalGridDraft,parseCanonicalGridDraft}=await import('../src/components/canonical-search-grid-draft.mjs');
 const draft=canonicalGridDraft(grid),result=parseCanonicalGridDraft(draft);assert.equal(result.total,9);assert.deepEqual(result.parameterGrid,grid);assert.equal(result.unsupportedTipCombinations,0);
 const changed={...draft,angles:'-1.00001, 1e-5, +2.5'};assert.deepEqual(parseCanonicalGridDraft(changed).parameterGrid.angles,[-1.00001,.00001,2.5]);assert.deepEqual(grid.angles,[-2,0,2]);
 const unsupported=parseCanonicalGridDraft({...draft,tipXs:'0.6',tipYs:'0.6'});assert.equal(unsupported.total,9);assert.equal(unsupported.unsupportedTipCombinations,9);
});
test('blank, duplicate, nonfinite, out-of-range and oversized drafts never silently normalize',async()=>{
 const {canonicalGridDraft,parseCanonicalGridDraft}=await import('../src/components/canonical-search-grid-draft.mjs'),draft=canonicalGridDraft(grid);
 for(const angles of ['',',','0,','0,,1','NaN','Infinity','1e999','0,0','-0,0','181','-180.001','0x10'])assert.throws(()=>parseCanonicalGridDraft({...draft,angles}),angles);
 for(const [axis,bad]of [['speeds','.49'],['speeds','4.51'],['elevations','-1'],['elevations','85.1'],['tipXs','.601'],['tipYs','-.601']])assert.throws(()=>parseCanonicalGridDraft({...draft,[axis]:bad}),axis+bad);
 const large={...draft,angles:Array.from({length:65},(_,i)=>i).join(','),speeds:Array.from({length:65},(_,i)=>.5+i/100).join(',')};assert.throws(()=>parseCanonicalGridDraft(large),/limit|4096/i);
 assert.throws(()=>parseCanonicalGridDraft(draft,8));
 const exact={...draft,angles:Array.from({length:16},(_,i)=>i).join(','),speeds:Array.from({length:16},(_,i)=>.5+i/100).join(','),elevations:Array.from({length:16},(_,i)=>i).join(',')};assert.equal(parseCanonicalGridDraft(exact).total,4096);
});
test('default absent, canonical fields labelled and actual parallelism is disclosed',async()=>{
 assert.equal(render({}),'');const {canonicalSearchPopulation}=await import('../src/direct-candidate/canonical-search-domain.mjs');const {domain}=canonicalSearchPopulation({parameterGrid:grid});
 const html=render({canonicalPlayback:{searchDomain:domain}});for(const axis of Object.keys(grid)){assert.ok(html.includes('id="canonicalGrid-'+axis+'"'));assert.ok(html.includes('for="canonicalGrid-'+axis+'"'));}
 for(const text of ['입력 조합 3 × 3 × 1 × 1 × 1 = 9개','4096','아직 확인되지 않았습니다','미지원','무효화'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('쿠션 충돌은 미지원입니다'));const mmq1=render({canonicalPlayback:{searchDomain:domain,selectedWorldProfile:'mmq1-ball-ball'}});assert.ok(mmq1.includes('쿠션 충돌은 미지원입니다'));
 assert.match(html,/<button[^>]*id="applyCanonicalGrid"[^>]*disabled/);
 const busy=render({activeStroke:true,canonicalPlayback:{searchDomain:domain}});assert.match(busy,/<input[^>]*id="canonicalGrid-angles"[^>]*disabled/);
});
test('all numeric grid controls are in Manual; apply and cancel use only explicit draft lifecycle',()=>{
 const app=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8'),ui=fs.readFileSync(path.join(root,'src/components/canonical-search-grid.tsx'),'utf8'),route=fs.readFileSync(path.join(root,'src/components/canonical-route-planner.tsx'),'utf8');
 const shot=app.slice(app.indexOf('<TabsContent value="shot"'),app.indexOf('<TabsContent value="routes"'));assert.ok(shot.includes('<CanonicalSearchGrid state={s} controller={controller}/>'));
 assert.ok(ui.includes('c.updateCanonicalSearchGrid({parameterGrid:validation.domain.parameterGrid})'));assert.ok(ui.includes('const cancel=()=>{setDraft(current)'));
 for(const forbidden of ['c.strike(', 'c.changeSettings(', 'c.startSearch(', 'c.setPosition('])assert.ok(!ui.includes(forbidden));assert.ok(route.includes('id="editCanonicalGrid"'));assert.ok(!route.includes('<Input'));
});

test('maximum eligible width comes from applied runtime domain, not draft parser guesses',async()=>{
 const {canonicalSearchPopulation}=await import('../src/direct-candidate/canonical-search-domain.mjs');const {domain}=canonicalSearchPopulation({parameterGrid:grid});
 const html=render({canonicalPlayback:{searchDomain:{...domain,parallelWidth:16,parallelWidthKind:'maximum-eligible',supportedWidths:[16,3,1]}}});
 for(const text of ['최대 배치 폭은 16개','지원 배치 폭: 16, 3, 1개','모든 배치가 최대 폭으로 실행된다는 뜻이 아닙니다','입력 중인 초안이 아니라 적용된 조합'])assert.ok(html.includes(text),text);
 const small=render({canonicalPlayback:{searchDomain:{...domain,parallelWidth:3,parallelWidthKind:'maximum-eligible',supportedWidths:[3,1]}}});assert.ok(small.includes('최대 배치 폭은 3개'));assert.ok(!small.includes('최대 배치 폭은 16개'));
});
