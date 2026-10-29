'use strict';
// Component server rendering and async handoff checks, not browser interaction QA.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),Module=require('node:module');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..');
const code=esbuild.buildSync({absWorkingDir:root,entryPoints:['src/components/canonical-practice-entry.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic'}).outputFiles[0].text;
const compiled=new Module(path.join(__dirname,'.canonical-practice-ui.cjs'),module);compiled.filename=path.join(__dirname,'.canonical-practice-ui.cjs');compiled.paths=module.paths;compiled._compile(code,compiled.filename);
const {CanonicalPracticeEntry}=compiled.exports;
const render=(s={})=>renderToStaticMarkup(React.createElement(CanonicalPracticeEntry,{state:{ready:true,paused:true,canAim:true,...s},controller:{}}));
test('default build has no entry and optional entry disables busy or already active game',()=>{
 const old=globalThis.CANONICAL_GPU_ENTRY_AVAILABLE;try{delete globalThis.CANONICAL_GPU_ENTRY_AVAILABLE;assert.equal(render(),'');globalThis.CANONICAL_GPU_ENTRY_AVAILABLE=true;
 assert.ok(render().includes('GPU 실험 새 게임'));assert.doesNotMatch(render(),/\sdisabled(?:=|>)/);
 for(const state of [{ready:false},{paused:false},{canAim:false},{activeStroke:true},{routeStatus:'searching'},{canonicalPlayback:{}}])assert.match(render(state),/\sdisabled(?:=|>)/);
 }finally{if(old===undefined)delete globalThis.CANONICAL_GPU_ENTRY_AVAILABLE;else globalThis.CANONICAL_GPU_ENTRY_AVAILABLE=old;}
});
test('cancel before load or during async import never starts the replacement game',async()=>{
 const {loadAndStartCanonicalPractice}=await import('../src/components/canonical-practice-action.mjs');let loads=0,starts=0;
 const first=new AbortController();first.abort();await assert.rejects(()=>loadAndStartCanonicalPractice({},first.signal,async()=>{loads++;}),{name:'AbortError'});assert.equal(loads,0);
 let resolve;const loaded=new Promise(r=>resolve=r),second=new AbortController();const pending=loadAndStartCanonicalPractice({},second.signal,()=>loaded);second.abort();resolve({startCanonicalPractice(){starts++;}});await assert.rejects(()=>pending,{name:'AbortError'});assert.equal(starts,0);
});
test('confirmed handoff forwards exact controller and cancellation signal and preserves failure',async()=>{
 const {loadAndStartCanonicalPractice}=await import('../src/components/canonical-practice-action.mjs'),controller={},abort=new AbortController();let calls=0;
 const value=await loadAndStartCanonicalPractice(controller,abort.signal,async()=>({startCanonicalPractice(c,options){calls++;assert.equal(c,controller);assert.equal(options.signal,abort.signal);assert.equal(options.selectedWorldProfile,'mmq2-cushion');return 'installed';}}));assert.equal(calls,1);assert.equal(value,'installed');
 await assert.rejects(()=>loadAndStartCanonicalPractice(controller,abort.signal,async()=>({})),/모듈/);
 await assert.rejects(()=>loadAndStartCanonicalPractice(controller,abort.signal,async()=>({startCanonicalPractice(){throw Error('GPU unavailable');}})),/GPU unavailable/);
});
test('real UI requires explicit confirm and aborts dismissal/unmount with accessible disclosure and errors',()=>{
 const source=fs.readFileSync(path.join(root,'src/components/canonical-practice-entry.tsx'),'utf8'),app=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');
 for(const text of ['DialogTitle','DialogDescription','기존 기록은 옮기지 않습니다','9개 타격 조합','공 충돌과 제한된 쿠션 충돌을 하나의 GPU 모드로 처리합니다','id="canonicalPracticeError"','role="alert"','role="status"','pending.current?.abort()','pending.current!==request','onClick={start}','onOpenChange={changeOpen}'])assert.ok(source.includes(text),text);
 assert.ok(app.includes('<CanonicalPracticeEntry state={s} controller={controller}/>'));assert.ok(source.includes('onClick={()=>changeOpen(true)}'));assert.ok(!source.includes('useEffect(()=>{loadAndStart'));
});

test('one public GPU mode defaults to ball and cushion; legacy choice cannot load a device',async()=>{
 const {loadAndStartCanonicalPractice}=await import('../src/components/canonical-practice-action.mjs');let loads=0;
 const load=async()=>{loads++;return {startCanonicalPractice(c,options){return options.selectedWorldProfile;}}};
 assert.equal(await loadAndStartCanonicalPractice({},undefined,load),'mmq2-cushion');
 for(const profile of ['mmq1-ball-ball','unknown'])await assert.rejects(()=>loadAndStartCanonicalPractice({},undefined,load,profile),/통합 모드/);assert.equal(loads,1);
 const source=fs.readFileSync(path.join(root,'src/components/canonical-practice-entry.tsx'),'utf8');for(const text of ['바인딩 10개','미지원·미완료를 실패로 바꾸지 않습니다','초기 9개는 3개씩','최대 배치 폭은 3개','최대 4096개를 대기열로','자동 GPU 검증 미완료','수동 테스트용'])assert.ok(source.includes(text),text);
 assert.doesNotMatch(source,/canonicalPracticeProfile|MMQ[12]|mmq[12]|최대 16개/);
});

test('durable device-loss alert renders localized stage and original compile/command progress independently of route error',()=>{
 const old=globalThis.CANONICAL_GPU_ENTRY_AVAILABLE;globalThis.CANONICAL_GPU_ENTRY_AVAILABLE=true;
 try{
  for(const [phase,label,detail] of [['compiling','GPU 셰이더 컴파일 중','셰이더 준비 2 / 17'],['encoding','GPU 명령 준비 중','명령 준비 256 / 1024'],['submitted','제출한 GPU 배치 완료 대기 중','명령 준비 256 / 1024']]){
   const html=render({routeStatus:'idle',routeError:'overwritten',routeProgress:null,canonicalPlayback:{deviceLost:true,deviceLoss:{reason:'unknown',message:'A valid external Instance reference no longer exists.',timestamp:'2026-10-29T02:00:00.000Z',phase:'ready',routeStatus:'searching',searchProgress:{phase,compileCompleted:2,compileTotal:17,encodedCommands:256,totalCommands:1024,tested:0,total:9}}}});
   for(const text of ['canonicalDeviceLoss','role="alert"',label,detail,'검색 진행: 0 / 9개','A valid external Instance reference no longer exists.','2026-10-29T02:00:00.000Z','브라우저 이름·버전','현재 게임 기록은 사라집니다'])assert.ok(html.includes(text),text);
   assert.ok(!html.includes('overwritten'));
  }
 }finally{if(old===undefined)delete globalThis.CANONICAL_GPU_ENTRY_AVAILABLE;else globalThis.CANONICAL_GPU_ENTRY_AVAILABLE=old;}
});


test('preparation forwarding drops late progress after cancel, failure and completed handoff',async()=>{
 const {loadAndStartCanonicalPractice}=await import('../src/components/canonical-practice-action.mjs');
 for(const ending of ['cancel','failure','success']){
  const abort=new AbortController(),seen=[];let callback,resolve,reject,entered;
  const started=new Promise(r=>entered=r),wait=new Promise((a,b)=>{resolve=a;reject=b;});
  const result=loadAndStartCanonicalPractice({},abort.signal,async()=>({startCanonicalPractice(c,o){callback=o.onProgress;entered();return wait;}}),undefined,p=>seen.push(p));
  await started;callback({stage:'compile-start',pipelineIndex:1});assert.equal(seen.length,1);
  if(ending==='cancel'){abort.abort();callback({pipelineIndex:2});resolve();await result;}
  else if(ending==='failure'){const rejected=assert.rejects(result,/failed/);reject(Error('failed'));await rejected;}
  else {resolve();await result;}
  callback({pipelineIndex:3});assert.equal(seen.length,1);
 }
});
test('preparation status describes program slots rather than claiming fresh native compilations',()=>{
 const label=compiled.exports.canonicalPreparationLabel;
 assert.match(label({phase:'loading',program:'manifest'}),/파일 목록 불러오는 중/);
 assert.equal(label({program:'search-N3',stage:'compile-start',pipelineIndex:7,totalPipelines:112}),'3개 후보 배치 · GPU 프로그램 준비 6 / 112 · 현재 7번 처리 중');
 assert.equal(label({program:'selected',stage:'compile',completedPipelines:115,totalPipelines:115}),'선택 타격 · GPU 프로그램 준비 115 / 115');
 assert.match(label({program:'selected',stage:'allocate',allocatedBuffers:3,totalBuffers:226}),/계산 버퍼 준비 3 \/ 226/);
 const source=fs.readFileSync(path.join(root,'src/components/canonical-practice-entry.tsx'),'utf8');
 assert.match(source,/if\(pending.current!==request\|\|request.signal.aborted\)return\s+setProgress/);assert.ok(source.includes('setProgress(null)'));
});
