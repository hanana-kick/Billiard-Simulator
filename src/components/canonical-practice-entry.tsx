import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { canonicalSearchPhaseLabel } from '@/components/canonical-search-progress'
import { loadAndStartCanonicalPractice } from '@/components/canonical-practice-action.mjs'

const count=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>=0?String(value):'—'
const playbackPhases:Record<string,string>={ready:'준비 완료',forecast:'타격 예측',calculating:'수동 타격 계산',playing:'타격 재생',rest:'정지 완료',refused:'계산 거부','forecast-unavailable':'예측 불가','source-changed':'소스 변경','stale-source':'소스 무효'}


export function canonicalPreparationLabel(progress:any){
 const names:Record<string,string>={manifest:'파일 목록',selected:'선택 타격','search-N3':'3개 후보 배치','search-N1':'1개 후보 배치',all:'전체 프로그램'}
 const name=names[progress?.program]??'GPU 장치와 새 게임'
 if(progress?.phase==='loading')return `${name} 불러오는 중`
 if(progress?.stage==='compile-start'||progress?.stage==='compile'){
  const completed=progress.stage==='compile-start'?Math.max(0,Number(progress.pipelineIndex)-1):progress.completedPipelines
  return `${name} · GPU 프로그램 준비 ${count(completed)} / ${count(progress.totalPipelines)}${progress.stage==='compile-start'?` · 현재 ${count(progress.pipelineIndex)}번 처리 중`:''}`
 }
 if(progress?.stage==='allocate')return `${name} · 계산 버퍼 준비 ${count(progress.allocatedBuffers)} / ${count(progress.totalBuffers)}`
 return `${name} 준비 중`
}

/** Optional build only. Opening or dismissing the dialog does not request a GPU. */
export function CanonicalPracticeEntry({state:s,controller}:{state:any;controller:any}) {
 const [open,setOpen]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[progress,setProgress]=React.useState<any>(null),[interrupted,setInterrupted]=React.useState(false)
 const pending=React.useRef<AbortController|null>(null)
 React.useEffect(()=>()=>{pending.current?.abort();pending.current=null},[])
 const loss=s.canonicalPlayback?.deviceLoss,lossProgress=loss?.searchProgress
 const lossPhase=loss?.routeStatus==='searching'?canonicalSearchPhaseLabel(lossProgress):(playbackPhases[loss?.phase]??loss?.phase)
 const available=(globalThis as any).CANONICAL_GPU_ENTRY_AVAILABLE===true
 const disabled=busy||!s.ready||!s.paused||!s.canAim||!!s.activeStroke||s.routeStatus==='searching'||!!s.canonicalPlayback
 const changeOpen=(value:boolean)=>{
  if(!value){pending.current?.abort();pending.current=null;setBusy(false);setProgress(null)}
  else {setError('');setProgress(null);setInterrupted(false)}
  setOpen(value)
 }
 const start=async()=>{
  if(pending.current||disabled)return
  const request=new AbortController();pending.current=request;setBusy(true);setError('');setProgress(null);setInterrupted(false)
  try {
   await loadAndStartCanonicalPractice(controller,request.signal,undefined,undefined,(detail:any)=>{
    if(pending.current!==request||request.signal.aborted)return
    setProgress({...detail})
   })
   if(pending.current!==request||request.signal.aborted)return
   pending.current=null;setBusy(false);setProgress(null);setOpen(false)
  } catch(cause) {
   if(pending.current!==request||request.signal.aborted)return
   setInterrupted(cause instanceof Error&&cause.name==='AbortError')
   setError(cause instanceof Error?cause.message:String(cause))
  } finally {
   if(pending.current===request){pending.current=null;setBusy(false);setProgress(null)}
  }
 }
 if(!available)return null
 return <>
  <Button id="startCanonicalPractice" variant="outline" size="sm" disabled={disabled} onClick={()=>changeOpen(true)}>GPU 실험 새 게임</Button>
  {loss?<Alert id="canonicalDeviceLoss" role="alert"><AlertTitle>GPU 장치를 사용할 수 없습니다</AlertTitle><AlertDescription>
   <p>{loss.message||loss.reason}</p>
   <p>마지막 단계: {lossPhase} · 이유: {loss.reason} · 발생 시각: {loss.timestamp}</p>
   {lossProgress?.phase==='compiling'?<p>셰이더 준비 {count(lossProgress.compileCompleted)} / {count(lossProgress.compileTotal)}</p>:null}
   {['encoding','submitted'].includes(lossProgress?.phase)&&(lossProgress?.encodedCommands!=null||lossProgress?.totalCommands!=null)?<p>명령 준비 {count(lossProgress.encodedCommands)} / {count(lossProgress.totalCommands)}</p>:null}
   {lossProgress?<p>검색 진행: {count(lossProgress.tested)} / {count(lossProgress.total)}개</p>:null}
   <p>GPU 작업을 중단했습니다. 이 오류와 브라우저 이름·버전, 직전 동작을 알려 주세요. 새로고침하면 기본 모드에서 다시 시작할 수 있지만 현재 게임 기록은 사라집니다.</p>
  </AlertDescription></Alert>:null}
  {s.canonicalPlayback?.entryWarning?<Alert role="alert"><AlertTitle>화면 갱신 경고</AlertTitle><AlertDescription>{s.canonicalPlayback.entryWarning}</AlertDescription></Alert>:null}
  <Dialog open={open} onOpenChange={changeOpen}><DialogContent>
   <DialogHeader><DialogTitle>GPU 실험 새 게임을 시작할까요?</DialogTitle>
    <DialogDescription>현재 배치와 점수를 새 4구 연습 배치로 교체합니다. 기존 기록은 옮기지 않습니다.</DialogDescription></DialogHeader>
   <p id="canonicalManualTestNotice">실험적 GPU 엔진 · 자동 GPU 검증 미완료 · 수동 테스트용입니다. 시작을 확인하기 전에는 GPU를 요청하지 않습니다.</p>
   <p>공이 멈추고 되돌리기·다시 실행 기록이 비어 있어야 합니다. 기록이 있으면 취소 후 기본 게임을 초기화하세요.</p>
   <p>초기 9개 타격 조합으로 시작하며 수동 탭에서 유한 조합을 편집할 수 있습니다. 최대 4096개를 대기열로 처리하며 초기 9개는 3개씩 GPU 배치로 평가합니다. 최대 배치 폭은 3개이며 나머지는 1개씩 처리합니다. 전체 경로 탐색이나 수천 개 동시 처리의 완료 버전이 아닙니다.</p>
   <Alert><AlertTitle>지원 범위 제한</AlertTitle><AlertDescription>공 충돌과 제한된 쿠션 충돌을 하나의 GPU 모드로 처리합니다. 모든 쿠션 상황을 지원한다는 뜻은 아니며 미지원·미완료를 실패로 바꾸지 않습니다. GPU 저장 버퍼 바인딩 10개가 필요합니다. 정지한 공의 X/Z 이동은 Q24 격자와 보수적인 간격 검사 안에서 지원합니다. 높이·공 추가/삭제·재질·모드 변경은 지원하지 않습니다. 기본 모드로 돌아가려면 페이지를 새로 열어야 합니다.</AlertDescription></Alert>
   {busy?<p role="status" aria-live="polite">{canonicalPreparationLabel(progress)}. 취소하면 대기 중인 시작 요청을 중단합니다.</p>:null}
   {error?<Alert id="canonicalPracticeError" role="alert"><AlertTitle>{interrupted?'GPU 준비 중단':'시작하지 못했습니다'}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>:null}
   <DialogFooter><Button id="cancelCanonicalPractice" variant="outline" onClick={()=>changeOpen(false)}>취소</Button><Button id="confirmCanonicalPractice" disabled={disabled} onClick={start}>{busy?'준비 중…':'배치·점수 교체 후 시작'}</Button></DialogFooter>
  </DialogContent></Dialog>
 </>
}
