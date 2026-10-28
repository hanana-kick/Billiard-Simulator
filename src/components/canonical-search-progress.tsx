import * as React from 'react'

const phases:Record<string,string>={
 'source-binding':'GPU 엔진 연결 중',preparing:'GPU 계산 준비 중',queued:'이전 GPU 작업 종료 대기 중',
 compiling:'GPU 셰이더 컴파일 중',running:'GPU 파라미터 평가 중',encoding:'GPU 명령 준비 중',
 submitted:'제출한 GPU 배치 완료 대기 중',done:'GPU 후보 계산 완료',stopped:'GPU 후보 계산 중단',
}
export function canonicalSearchPhaseLabel(progress:any){
 return phases[progress?.phase]??'GPU 계산 진행 중'
}
const count=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>=0?String(value):'—'

/** Wall-clock waiting time is not a claim of GPU progress or a completion estimate. */
export function CanonicalSearchProgress({progress:p,busy}:{progress:any;busy:boolean}){
 const [waitingMs,setWaitingMs]=React.useState(0)
 React.useEffect(()=>{
  setWaitingMs(0)
  if(!busy)return
  const since=performance.now(),timer=setInterval(()=>setWaitingMs(performance.now()-since),1000)
  return ()=>clearInterval(timer)
 },[busy,p?.elapsedMs,p?.phase])
 const elapsed=typeof p?.elapsedMs==='number'&&Number.isFinite(p.elapsedMs)&&p.elapsedMs>=0?p.elapsedMs:null
 return <div id="canonicalSearchPhase" data-phase={p?.phase??'unknown'}>
  <p role="status" aria-live="polite">{canonicalSearchPhaseLabel(p)}</p>
  {elapsed!==null?<p className="helper" aria-live="off">경과 {Math.floor((elapsed+(busy?waitingMs:0))/1000)}초 · 남은 시간은 알 수 없습니다.</p>:null}
  {p?.phase==='compiling'?<p className="helper">셰이더 준비 {count(p.compileCompleted)} / {count(p.compileTotal)} · 후보 판정 수와 별개입니다.</p>:null}
  {p?.phase==='encoding'?<p className="helper">명령 준비 {count(p.encodedCommands)} / {count(p.totalCommands)} · GPU 판정 완료 전입니다.</p>:null}
  {p?.phase==='queued'?<p className="helper">이전 컴파일·제출 작업이 끝나면 시작합니다. 아직 새 후보를 계산하지 않습니다.</p>:null}
  {p?.phase==='submitted'?<p className="helper">GPU 결과를 기다립니다. 결과 수신 전에는 후보 처리 수가 늘지 않습니다.</p>:null}
  {busy||p?.phase==='stopped'?<p className="helper">중단은 추가 후보 계산을 막습니다. 진행 중인 컴파일·이미 제출한 GPU 작업은 즉시 취소되지 않으며, 다시 계산은 종료를 기다립니다.</p>:null}
 </div>
}
