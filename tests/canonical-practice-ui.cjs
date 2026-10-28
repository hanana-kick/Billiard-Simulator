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
 const value=await loadAndStartCanonicalPractice(controller,abort.signal,async()=>({startCanonicalPractice(c,options){calls++;assert.equal(c,controller);assert.equal(options.signal,abort.signal);assert.equal(options.selectedWorldProfile,'mmq1-ball-ball');return 'installed';}}));assert.equal(calls,1);assert.equal(value,'installed');
 await assert.rejects(()=>loadAndStartCanonicalPractice(controller,abort.signal,async()=>({})),/모듈/);
 await assert.rejects(()=>loadAndStartCanonicalPractice(controller,abort.signal,async()=>({startCanonicalPractice(){throw Error('GPU unavailable');}})),/GPU unavailable/);
});
test('real UI requires explicit confirm and aborts dismissal/unmount with accessible disclosure and errors',()=>{
 const source=fs.readFileSync(path.join(root,'src/components/canonical-practice-entry.tsx'),'utf8'),app=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');
 for(const text of ['DialogTitle','DialogDescription','기존 기록은 옮기지 않습니다','9개 타격 조합','쿠션 충돌은 미지원','id="canonicalPracticeError"','role="alert"','role="status"','pending.current?.abort()','pending.current!==request','onClick={start}','onOpenChange={changeOpen}'])assert.ok(source.includes(text),text);
 assert.ok(app.includes('<CanonicalPracticeEntry state={s} controller={controller}/>'));assert.ok(source.includes('onClick={()=>changeOpen(true)}'));assert.ok(!source.includes('useEffect(()=>{loadAndStart'));
});

test('fresh profile forwards exact MMQ2 and invalid profile never loads or requests a device',async()=>{
 const {loadAndStartCanonicalPractice}=await import('../src/components/canonical-practice-action.mjs');let loads=0;
 const load=async()=>{loads++;return {startCanonicalPractice(c,options){return options.selectedWorldProfile;}}};
 assert.equal(await loadAndStartCanonicalPractice({},undefined,load,'mmq2-cushion'),'mmq2-cushion');
 await assert.rejects(()=>loadAndStartCanonicalPractice({},undefined,load,'unknown'),/프로필/);assert.equal(loads,1);
 const source=fs.readFileSync(path.join(root,'src/components/canonical-practice-entry.tsx'),'utf8');for(const text of ['id="canonicalPracticeProfile"','disabled={busy}',"React.useState('mmq1-ball-ball')",'undefined,profile','바인딩 9개','바인딩 10개','미지원·미완료를 실패로 바꾸지 않습니다','초기 9개는 3개씩','최대 16개 배치','MMQ2의 최대 배치 폭은 3개','최대 4096개를 대기열로'])assert.ok(source.includes(text),text);
});
