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
 assert.ok(routes.includes('접촉 제약식으로 큐 입력 계산'));assert.ok(app.includes('canonicalSearchPhaseLabel(s.routeProgress)'));assert.ok(app.includes('제약식 계산 · 물리 평가'));
});

test('actual completed batch widths render from receipts and never from candidate totals',()=>{
 const s=state();s.routeResult.batchWidths=[16,16,3,1];const html=render(s);assert.ok(html.includes('실제 완료 배치: 16개 × 2회 · 3개 × 1회 · 1개 × 1회'));
 assert.ok(!render(state()).includes('canonicalActualBatchWidths'));s.routeResult.batchWidths=[NaN];assert.ok(!render(s).includes('canonicalActualBatchWidths'));
});


test('GPU preparation phases are distinct from completed candidate counts without invented percentages',()=>{
 const labels={preparing:'GPU 계산 준비 중',queued:'이전 GPU 작업 종료 대기 중',compiling:'GPU 셰이더 컴파일 중',running:'GPU 파라미터 평가 중',encoding:'GPU 명령 준비 중',submitted:'GPU 명령 제출 중',uploading:'GPU 입력 업로드 중',readback:'GPU 최종 작업 완료·결과 수신 대기 중'};
 for(const [phase,label] of Object.entries(labels)){
  const s=state();s.routeStatus='searching';s.routeResult=null;s.routeProgress={phase,total:3,tested:0,evaluated:0,found:0,compileCompleted:2,compileTotal:17,chunkIndex:2,chunkCount:4,submittedCommands:256,totalCommands:1024,elapsedMs:12345};
  const html=render(s);assert.ok(html.includes(label),phase);assert.ok(html.includes('경과 12초'));assert.ok(html.includes('처리 0 / 3'));assert.ok(html.includes('남은 시간은 알 수 없습니다'));assert.ok(!html.includes('aria-valuenow'));assert.ok(!html.includes('%'));
  assert.ok(html.includes('이미 제출한 GPU 작업은 즉시 취소되지 않으며'));
  if(phase==='compiling')assert.ok(html.includes('셰이더 준비 2 / 17'));
  else assert.ok(!html.includes('셰이더 준비 2 / 17'));
  if(['encoding','submitted','readback'].includes(phase)){
   for(const text of ['청크 2 / 4','제출 명령 256 / 1024','GPU 완료 수가 아닙니다.'])assert.ok(html.includes(text),text);
   assert.ok(!html.includes('명령 준비 256 / 1024'));
  }
  if(phase==='submitted')assert.ok(html.includes('결과 수신 전에는 후보 처리 수가 늘지 않습니다'));
  if(phase==='queued')assert.ok(html.includes('아직 새 후보를 계산하지 않습니다'));
 }
});
test('stop without any completed batch stays visible and explains restart drain',()=>{
 const s=state();s.routeResult=null;s.routeProgress={phase:'stopped',elapsedMs:2000};const html=render(s);
 assert.ok(html.includes('GPU 후보 계산 중단'));assert.ok(html.includes('다시 계산은 종료를 기다립니다'));assert.ok(html.includes('id="findRoute"'));assert.ok(!html.includes('id="cancelRoute"'));assert.ok(!html.includes('평가한 조합에서 성공 후보를 찾지 못했습니다'));
});
test('missing progress does not fabricate candidate work or elapsed time',()=>{
 const s=state();s.routeStatus='searching';s.routeProgress={phase:'compiling'};const html=render(s);
 assert.ok(html.includes('셰이더 준비 — / —'));assert.ok(!html.includes('경과 '));assert.ok(!html.includes('NaN'));assert.ok(!html.includes('undefined'));
});

test('stopped partial empty results do not announce completed unsuccessful search',()=>{
 const s=state();s.routeProgress={phase:'stopped',elapsedMs:2000};s.routeResult={...s.routeResult,partial:true,results:[],found:0};
 const html=render(s);assert.ok(html.includes('GPU 후보 계산 중단'));assert.ok(!html.includes('id="noRoute"'));
});

test('all incomplete output reports zero verdicts and actual broad reason instead of unsuccessful evaluated search',()=>{
 const s=state();s.routeResult={...s.routeResult,total:9,tested:9,evaluated:0,found:0,miss:0,incomplete:9,results:[],reasonCounts:{incomplete:{11:9},unsupported:{}}};
 const html=render(s);assert.ok(html.includes('판정 완료된 조합이 없습니다.'));assert.ok(html.includes('미완료 사유: 미해결 물리 이벤트 (코드 11) 9개'));assert.ok(!html.includes('평가한 조합에서 성공 후보를 찾지 못했습니다'));assert.ok(!html.includes('계산 예산 소진'));
});
test('mixed reason counts render from partial progress and final results including unknown code fallback',()=>{
 const s=state();s.routeResult.reasonCounts={incomplete:{3:2,8:1,9:1,10:1,11:2,99:1},unsupported:{4:1,5:1,6:1,12:1}};
 for(const busy of [false,true]){s.routeStatus=busy?'searching':'done';s.routeProgress=s.routeResult;const html=render(s);for(const text of ['계산 예산 소진 (코드 3) 2개','계산 취소 (코드 8) 1개','시간 범위 도달 (코드 9) 1개','수치 계산 문제 (코드 10) 1개','미해결 물리 이벤트 (코드 11) 2개','알 수 없는 사유 (코드 99) 1개','물리 처리 미지원 (코드 4) 1개','탐색 조건 미지원 (코드 5) 1개','게임 규칙 미지원 (코드 6) 1개','미구현 (코드 12) 1개'])assert.ok(html.includes(text),text);}
});
test('missing or malformed reason counts never invent causes and evaluated misses keep honest no-success wording',()=>{
 const s=state();s.routeResult.results=[];s.routeResult.found=0;
 for(const reasons of [undefined,{incomplete:null,unsupported:[]},{incomplete:{11:NaN,3:-1,9:0,bogus:2},unsupported:{4:'1'}}]){s.routeResult.reasonCounts=reasons;const html=render(s);assert.ok(!html.includes('canonicalIncompleteReasons'));assert.ok(!html.includes('canonicalUnsupportedReasons'));assert.ok(!html.includes('NaN'));assert.ok(html.includes('평가한 조합에서 성공 후보를 찾지 못했습니다.'));}
});
