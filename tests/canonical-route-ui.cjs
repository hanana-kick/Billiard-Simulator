'use strict';
// Real React server rendering checks. These do not replace actual browser QA.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..');
const bundled=esbuild.buildSync({absWorkingDir:root,entryPoints:['src/components/canonical-route-planner.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic'}).outputFiles[0].text;
const compiled=new Module(path.join(__dirname,'.canonical-route-ui-compiled.cjs'),module);compiled.filename=path.join(__dirname,'.canonical-route-ui-compiled.cjs');compiled.paths=module.paths;compiled._compile(bundled,compiled.filename);
const {CanonicalRoutePlanner}=compiled.exports;
const settings={angle:12.345,elevation:25,speed:.5,tipX:0,tipY:.2};
function state(){return {ready:true,canAim:true,activeStroke:false,gameMode:'four',game:{threeCushion:false},routeStatus:'done',routeApplied:null,canonicalPlayback:{searchEnabled:true,searchDomain:{counts:{angles:3,speeds:1,elevations:1,tipXs:1,tipYs:1},total:3}},routeResult:{kind:'canonical-compact-search-v1',total:3,tested:3,evaluated:2,found:1,miss:1,incomplete:1,unsupported:0,results:[{id:4294967294,settings,score:1,compact:[4294967294,1,0,1]}]}};}
const render=s=>renderToStaticMarkup(React.createElement(CanonicalRoutePlanner,{state:s,controller:{}}));
test('compact candidates render actual settings and score without invented geometric fields',()=>{
 const html=render(state());for(const text of ['후보 4294967294','12.345','25.0','0.50','최종 점수 1','GPU 성공 판정','미완료 1','미지원 0'])assert.ok(html.includes(text),text);
 for(const text of ['NaN','undefined','연립식','제약식','0.00 m','도달</dt>','쿠션</span>'])assert.ok(!html.includes(text),text);
 assert.ok(html.includes('거리·도달 시간·쿠션 횟수·접촉 순서가 포함되지 않습니다'));
 assert.ok(html.includes('id="applyRoute4294967294"'));
});
test('canonical panel is explicit finite domain and contains no legacy filter controls',()=>{
 const html=render(state());assert.ok(html.includes('명시된 유한 입력 조합'));assert.ok(html.includes('전체 조합'));assert.ok(html.includes('키스 허용'));
 for(const id of ['routeTarget','routeSecond','routeMethods','routeOrder','routeDepth','routeKiss','routeElevation','inverseMethod','expandSearch','resumeSearch'])assert.ok(!html.includes('id="'+id+'"'),id);
});
test('unconnected service, stale results and unresolved-only results are honest states',()=>{
 const absent=state();absent.canonicalPlayback.searchEnabled=false;const html=render(absent);assert.match(html,/<button[^>]*id="findRoute"[^>]*disabled/);assert.ok(html.includes('GPU 탐색 서비스 미연결'));
 const stale=state();stale.routeStatus='stale';stale.routeError='source changed';const staleHTML=render(stale);assert.match(staleHTML,/<button[^>]*id="applyRoute4294967294"[^>]*disabled/);assert.ok(staleHTML.includes('source changed'));
 const unresolved=state();unresolved.routeResult.results=[];unresolved.routeResult.found=0;const empty=render(unresolved);assert.ok(empty.includes('경로가 없다는 증명이 아닙니다'));assert.ok(!empty.includes('GPU 성공 판정'));
});
test('canonical progress reports batch evaluations while preserving the default legacy branch',()=>{
 const busy=state();busy.routeStatus='searching';busy.routeProgress={...busy.routeResult,tested:2,evaluated:1};const html=render(busy);assert.ok(html.includes('id="cancelRoute"'));assert.ok(html.includes('처리 2 / 3'));assert.ok(!html.includes('제약식'));
 const routes=fs.readFileSync(path.join(root,'src/components/route-planner.tsx'),'utf8'),app=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');
 assert.ok(routes.includes('props.state.canonicalPlayback?<CanonicalRoutePlanner {...props}/>:<LegacyRoutePlanner {...props}/>'));
 assert.ok(routes.includes('접촉 제약식으로 큐 입력 계산'));assert.ok(app.includes('GPU 파라미터 평가'));assert.ok(app.includes('제약식 계산 · 물리 평가'));
});

test('actual completed batch widths render from receipts and never from candidate totals',()=>{
 const s=state();s.routeResult.batchWidths=[16,16,3,1];const html=render(s);assert.ok(html.includes('실제 완료 배치: 16개 × 2회 · 3개 × 1회 · 1개 × 1회'));
 assert.ok(!render(state()).includes('canonicalActualBatchWidths'));s.routeResult.batchWidths=[NaN];assert.ok(!render(s).includes('canonicalActualBatchWidths'));
});
