import * as React from 'react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { canonicalSearchPhaseLabel } from '@/components/canonical-search-progress'
import { loadAndStartCanonicalPractice, setCanonicalManualPreparation } from '@/components/canonical-practice-action.mjs'

const count=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>=0?String(value):'—'
const playbackPhases:Record<string,string>={ready:'준비 완료',forecast:'타격 예측',calculating:'수동 타격 계산',preparing:'GPU 프로그램 준비',canceling:'GPU 중단 확인 중','presentation-preparing':'타격 화면 배치 준비',playing:'타격 재생',buffering:'GPU 다음 구간 대기',rest:'정지 완료',refused:'계산 거부','forecast-unavailable':'예측 불가','source-changed':'소스 변경','stale-source':'소스 무효'}


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
 const [copyStatus,setCopyStatus]=React.useState('')
 const [idlePrecompute,setIdlePrecompute]=React.useState(true)
 const pending=React.useRef<AbortController|null>(null)
 React.useEffect(()=>()=>{pending.current?.abort();pending.current=null},[])
 const loss=s.canonicalPlayback?.deviceLoss,lossProgress=loss?.searchProgress,gpu=loss?.gpuDiagnostics
 const copyLoss=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(loss,null,2));setCopyStatus('진단 정보를 복사했습니다.')}catch{setCopyStatus('복사하지 못했습니다. 아래 진단 정보를 직접 선택해 복사하세요.')}}
 const lossPhase=loss?.routeStatus==='searching'?canonicalSearchPhaseLabel(lossProgress):(playbackPhases[loss?.phase]??loss?.phase)
 const available=(globalThis as any).CANONICAL_GPU_ENTRY_AVAILABLE===true
 const disabled=busy||!s.ready||!s.paused||!s.canAim||!!s.activeStroke||s.routeStatus==='searching'||!!s.canonicalPlayback
 const changeOpen=(value:boolean)=>{
  if(!value){pending.current?.abort();pending.current=null;setBusy(false);setProgress(null)}
  else {setError('');setProgress(null);setInterrupted(false);setIdlePrecompute(true)}
  setOpen(value)
 }
 const start=async()=>{
  if(pending.current||disabled)return
  const request=new AbortController();pending.current=request;setBusy(true);setError('');setProgress(null);setInterrupted(false)
  try {
   await loadAndStartCanonicalPractice(controller,request.signal,undefined,undefined,(detail:any)=>{
    if(pending.current!==request||request.signal.aborted)return
    setProgress({...detail})
   },idlePrecompute)
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
 const phase=s.canonicalPlayback?.phase
 const manualPreparation=s.canonicalPlayback?.manualPreparation
 const manualToggleDisabled=busy||!s.paused||!!s.activeStroke||s.routeStatus==='searching'||!!s.canonicalPlayback?.deviceLost||['preparing','calculating','presentation-preparing','playing','buffering','canceling'].includes(phase)||manualPreparation?.state==='settling'||manualPreparation?.state==='failed'||phase==='stale-source'
 const presentationToken=s.canonicalPlayback?.presentationToken
 React.useLayoutEffect(()=>{if(phase==='presentation-preparing')controller.canonicalPlayback?.acknowledgePresentationReady?.(presentationToken)},[controller,phase,presentationToken])
 const restCommitRevision=s.canonicalPlayback?.commitRevision
 const restLayoutSequence=s.canonicalPlayback?.restPresentation?.layoutSequence
 React.useLayoutEffect(()=>{if(phase==='rest')controller.canonicalPlayback?.acknowledgeRestLayout?.(restCommitRevision)},[controller,phase,restCommitRevision,restLayoutSequence])
 const statusProps=(active:boolean,id:string)=>({id:active?id:undefined,'data-active':active?'true':'false','aria-hidden':!active,role:active?'status' as const:undefined,'aria-live':active?'polite' as const:undefined,className:'canonical-shot-message'})
 if(!available)return null
 return <>
  <Button id="startCanonicalPractice" variant="outline" size="sm" disabled={disabled} onClick={()=>changeOpen(true)}>GPU 실험 새 게임</Button>
  {s.canonicalPlayback?<div id="canonicalIdlePrecomputeControl" className="space-y-1" title="정지 중에도 GPU를 사용합니다. 입력 변경이나 준비 전 타격에는 계산 대기가 남습니다.">
   <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1"><Switch id="canonicalIdlePrecompute" aria-label="유휴 GPU 타격 미리 계산" aria-describedby="canonicalIdlePrecomputeHelp" checked={manualPreparation?.enabled===true} disabled={manualToggleDisabled} onCheckedChange={value=>{try{if(!setCanonicalManualPreparation(controller,value))controller.announce('현재 작업이 끝난 뒤 유휴 타격 준비 설정을 바꿀 수 있습니다.')}catch(cause){controller.announce('유휴 타격 준비 설정 실패: '+(cause instanceof Error?cause.message:String(cause)))}}}/><label htmlFor="canonicalIdlePrecompute">유휴 GPU 미리 계산</label><span id="canonicalIdlePrecomputeStatus" role="status" className="col-start-2 block h-5 whitespace-nowrap text-sm">{manualPreparation?.state==='settling'?'중단 확인 중':!manualPreparation?.enabled?'꺼짐':manualPreparation?.state==='ready'?'현재 입력 준비됨':manualPreparation?.state==='pending'?'계산 중':manualPreparation?.state==='failed'?'준비 실패':'대기 중'}</span></div>
   <p id="canonicalIdlePrecomputeHelp" className="sr-only">정지 중에도 GPU를 사용합니다. 같은 입력의 계산이 끝난 경우에만 즉시 재생할 수 있으며, 입력을 바꾸거나 바로 타격하면 계산·표시 대기가 남습니다.</p>
  </div>:null}
  {loss?<Alert id="canonicalDeviceLoss" role="alert"><AlertTitle>GPU 장치를 사용할 수 없습니다</AlertTitle><AlertDescription>
   <p>{loss.message||loss.reason}</p>
   <p>마지막 단계: {lossPhase} · 이유: {loss.reason} · 발생 시각: {loss.timestamp}</p>
   {lossProgress?.phase==='compiling'?<p>셰이더 준비 {count(lossProgress.compileCompleted)} / {count(lossProgress.compileTotal)}</p>:null}
   {lossProgress?.executionStage?<p>실행 구간: {lossProgress.executionStage} · 청크 {count(lossProgress.chunkIndex)} / {count(lossProgress.chunkCount)}</p>:null}
   {lossProgress?.submittedCommands!=null?<p>제출 명령 {count(lossProgress.submittedCommands)} / {count(lossProgress.totalCommands)} · GPU 완료 수가 아닙니다.</p>:null}
   {lossProgress?.cachedDeviceOwnedBytes!=null?<p>엔진 소유 버퍼 {count(lossProgress.cachedDeviceOwnedBytes)} bytes · 드라이버 전체 메모리 사용량은 아닙니다.</p>:null}
   {lossProgress?<p>검색 진행: {count(lossProgress.tested)} / {count(lossProgress.total)}개</p>:null}
   {gpu?<><p>GPU 대기: {gpu.nativeStage??'확인 불가'} · 완료 확인 명령 {count(gpu.confirmedCommands)} / 제출 {count(gpu.submittedCommands)} · 완료 확인 fence {count(gpu.fulfilledFences)} / 제출 {count(gpu.submittedFences)}</p><p>현재 GPU 실행 경과: {Number.isFinite(gpu.runElapsedMs)?Math.round(gpu.runElapsedMs):'—'} ms · {gpu.userAgent??'브라우저 정보 없음'} · {gpu.description||gpu.architecture||gpu.vendor||'GPU 정보 없음'}</p></>:null}
   {Number.isFinite(loss.searchElapsedAtLossMs)?<p>손실 통지 수신 시 탐색 경과: {Math.round(loss.searchElapsedAtLossMs)} ms · 마지막 진행 표시 이후 {Math.round(loss.lastProgressAgeMs??0)} ms</p>:null}
   <Button variant="outline" size="sm" onClick={copyLoss}>GPU 오류 진단 복사</Button>
   {copyStatus?<p role="status">{copyStatus}</p>:null}
   <details><summary>진단 정보 보기 · 자동 전송 없음</summary><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(loss,null,2)}</pre></details>
   <p>GPU 작업을 중단했습니다. 이 오류와 브라우저 이름·버전, 직전 동작을 알려 주세요. 새로고침하면 기본 모드에서 다시 시작할 수 있지만 현재 게임 기록은 사라집니다.</p>
  </AlertDescription></Alert>:null}
  {phase==='rest'&&s.canonicalPlayback?.restPresentation?.failed?<Alert id="canonicalRestPresentationWarning" role="status"><AlertTitle>자동 타격 준비를 보류했습니다</AlertTitle><AlertDescription>현재 크기의 정지 화면 표시를 확인하지 못했습니다. 완료된 점수와 기록은 유지되며 직접 타격할 수 있습니다. 화면 표시를 확인하기 전에는 다음 GPU 타격을 미리 계산하지 않습니다.</AlertDescription></Alert>:null}
  {['preparing','calculating','presentation-preparing','playing','buffering','canceling'].includes(phase)?<div id="canonicalShotStatusRegion" className="canonical-shot-status-region">
   <div className="canonical-shot-status-messages">
    <p {...statusProps(phase==='presentation-preparing','canonicalPresentationPreparationStatus')}>확인된 타격을 표시할 화면 배치를 준비하고 있습니다. 아직 재생 시계를 시작하지 않았으며 GPU 계산이나 새 화면 표시가 완료됐다는 뜻은 아닙니다.</p>
    <p {...statusProps(phase==='preparing','canonicalRepreparationStatus')}>GPU 프로그램을 다시 준비하고 있습니다 · <span className="canonical-shot-count">{count(s.canonicalPlayback.nativePreparation?.completedPipelines)}</span> / <span className="canonical-shot-count">{count(s.canonicalPlayback.nativePreparation?.totalPipelines)}</span>. 소프트웨어 GPU 준비는 최대 5분까지 기다리며, 넘으면 실패로 중단합니다. 진행 표시와 취소 요청을 사용할 수 있습니다. 아직 타격 계산·재생이 아닙니다.</p>
    <p {...statusProps(phase==='calculating','canonicalLongGpuNotice')}>GPU 타격 계산 중입니다. 소프트웨어 GPU 등 느린 장치에서는 오래 걸릴 수 있습니다. 완료 청크의 진행이 10분 동안 없거나 전체 계산이 30분을 넘으면 중단합니다. 아래 버튼으로 취소할 수 있으며 CPU 계산으로 전환하지 않습니다.</p>
    <p {...statusProps(phase==='playing','canonicalPlayingStatus')}>GPU에서 확인한 움직임만 표시합니다. 타격을 취소할 수 있습니다.</p>
    <p {...statusProps(phase==='buffering'&&s.canonicalPlayback.bufferingReason==='source-sample-unavailable','canonicalBufferingStatus')}>현재 구간에 정확히 표시할 물리 표본이 없어 마지막 확인 위치를 유지합니다. 재생 시계는 선택한 속도로 진행하며 위치를 임의로 보간하지 않습니다. 타격을 취소할 수 있습니다.</p>
    <p {...statusProps(phase==='buffering'&&s.canonicalPlayback.bufferingReason!=='source-sample-unavailable','canonicalBufferingStatus')}>GPU가 다음 움직임 구간을 계산하고 있습니다. 확인된 구간 끝에서 화면 재생을 잠시 멈췄으며 재생 속도나 물리 시간을 임의로 바꾸지 않습니다. 타격을 취소할 수 있습니다.</p>
    <p {...statusProps(phase==='canceling','canonicalCancelStatus')}>취소 요청을 보냈습니다. GPU 작업 종료를 확인하는 동안 새 타격을 막습니다.</p>
   </div>
   <p id={s.canonicalPlayback.streaming&&!s.canonicalPlayback.scoreAndTurnCommitted&&phase!=='canceling'?'canonicalPendingScoreStatus':undefined} className="canonical-shot-pending text-sm text-muted-foreground" data-active={s.canonicalPlayback.streaming&&!s.canonicalPlayback.scoreAndTurnCommitted&&phase!=='canceling'?'true':'false'} aria-hidden={!(s.canonicalPlayback.streaming&&!s.canonicalPlayback.scoreAndTurnCommitted&&phase!=='canceling')}>GPU에서 확인한 움직임만 표시합니다. 전체 계산과 공의 정지가 확인되기 전에는 점수와 차례를 확정하지 않습니다.</p>
   <Button id="cancelCanonicalShot" variant="outline" size="sm" disabled={s.canonicalPlayback.phase==='canceling'||(typeof controller.canonicalPlayback?.cancelAndReset!=='function'&&typeof controller.canonicalPlayback?.cancelAndDrain!=='function')} onClick={()=>{const owner=controller.canonicalPlayback;const cancel=typeof owner?.cancelAndReset==='function'?owner.cancelAndReset:owner?.cancelAndDrain;if(typeof cancel!=='function')return;void cancel.call(owner).catch((cause:unknown)=>controller.announce('GPU 타격 취소 실패: '+(cause instanceof Error?cause.message:String(cause))))}}><span className="canonical-shot-button-label"><span data-active={phase!=='canceling'?'true':'false'} aria-hidden={phase==='canceling'}>타격 취소</span><span data-active={phase==='canceling'?'true':'false'} aria-hidden={phase!=='canceling'}>GPU 중단 확인 중…</span></span></Button>
  </div>:null}
  {s.canonicalPlayback?.phase==='ready'&&s.canonicalPlayback?.cancellationCleanup==='reusable-reset'&&s.canonicalPlayback?.nativePreparation?.phase==='ready'?<p id="canonicalReusablePreparationNotice" role="status">취소한 GPU 작업의 종료와 계산 버퍼 초기화를 확인했습니다. 준비된 GPU 프로그램은 유지했으며 다음 타격은 새 입력으로 계산합니다. 취소한 결과를 재생하지 않습니다.</p>:null}
  {s.canonicalPlayback?.phase==='ready'&&s.canonicalPlayback?.nativePreparation?.phase==='unprepared'?<p id="canonicalRepreparationNotice" role="status">이전 GPU 작업은 종료됐습니다. 다음 타격을 누르면 GPU 프로그램을 다시 준비하며, 준비 중에도 취소할 수 있습니다. 소프트웨어 GPU 준비 제한은 최대 5분이며 초과하면 중단합니다.</p>:null}
  {s.canonicalPlayback?.entryWarning?<Alert role="alert"><AlertTitle>화면 갱신 경고</AlertTitle><AlertDescription>{s.canonicalPlayback.entryWarning}</AlertDescription></Alert>:null}
  <Dialog open={open} onOpenChange={changeOpen}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
   <DialogHeader><DialogTitle>GPU 실험 새 게임을 시작할까요?</DialogTitle>
    <DialogDescription>현재 배치와 점수를 새 4구 연습 배치로 교체합니다. 기존 기록은 옮기지 않습니다.</DialogDescription></DialogHeader>
   <div className="flex items-center gap-2"><Switch id="canonicalStartIdlePrecompute" aria-label="시작 후 유휴 GPU 타격 미리 계산" checked={idlePrecompute} disabled={busy} onCheckedChange={setIdlePrecompute}/><label htmlFor="canonicalStartIdlePrecompute">시작 후 유휴 시간에 현재 타격 미리 계산 (기본 켜짐)</label></div>
   <p id="canonicalIdlePrecomputeDisclosure">켜 두면 GPU 새 게임 준비가 끝난 뒤 정지 중에도 현재 입력의 타격 전체를 계산해 한 결과만 보관합니다. 타격 전에는 움직임·점수·기록을 반영하지 않습니다. 준비 완료 전 타격하거나 입력을 바꾸면 대기가 남고, 소프트웨어 GPU에서는 초기 준비에 몇 분, 변경한 타격에 수초가 걸릴 수 있습니다. 최초 준비와 재준비는 최대 5분으로 제한하며, 진행 표시와 취소 요청을 제공합니다. 모든 타격의 즉각 반응을 보장하지 않습니다. 시작 후 정지 상태에서 끄거나 켤 수 있습니다.</p>
   <p id="canonicalManualTestNotice">실험적 GPU 엔진 · 자동 GPU 검증 미완료 · 수동 테스트용입니다. 시작을 확인하기 전에는 GPU를 요청하지 않습니다.</p>
   <p>공이 멈추고 되돌리기·다시 실행 기록이 비어 있어야 합니다. 기록이 있으면 취소 후 기본 게임을 초기화하세요.</p>
   <p>초기 9개 타격 조합으로 시작하며 수동 탭에서 유한 조합을 편집할 수 있습니다. 최대 4096개를 대기열로 처리하며 초기 9개는 3개씩 GPU 배치로 평가합니다. 최대 배치 폭은 3개이며 나머지는 1개씩 처리합니다. 전체 경로 탐색이나 수천 개 동시 처리의 완료 버전이 아닙니다.</p>
   <Alert><AlertTitle>지원 범위 제한</AlertTitle><AlertDescription>공 충돌과 제한된 쿠션 충돌을 하나의 GPU 모드로 처리합니다. 모든 쿠션 상황을 지원한다는 뜻은 아니며 미지원·미완료를 실패로 바꾸지 않습니다. GPU 저장 버퍼 바인딩 10개가 필요합니다. 정지한 공의 X/Z 이동은 Q24 격자와 보수적인 간격 검사 안에서 지원합니다. 높이·공 추가/삭제·재질·모드 변경은 지원하지 않습니다. 기본 모드로 돌아가려면 페이지를 새로 열어야 합니다.</AlertDescription></Alert>
   {busy?<div className="space-y-2"><p id="canonicalPreparationStatus" role="status" aria-live="polite">{canonicalPreparationLabel(progress)}. 취소하면 대기 중인 시작 요청을 중단합니다.</p><p id="canonicalColdPreparationNotice" className="text-sm text-muted-foreground">처음에는 GPU 프로그램을 준비합니다. 소프트웨어 GPU에서는 몇 분이 걸릴 수 있어 최초 준비·재준비를 최대 5분까지 기다립니다. 제한을 넘으면 실패로 중단하며 취소 요청도 가능합니다. 준비 완료 전에는 타격하지 않고 CPU 물리 계산으로 전환하지 않습니다.</p></div>:null}
   {error?<Alert id="canonicalPracticeError" role="alert"><AlertTitle>{interrupted?'GPU 준비 중단':'시작하지 못했습니다'}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>:null}
   <DialogFooter><Button id="cancelCanonicalPractice" variant="outline" onClick={()=>changeOpen(false)}>취소</Button><Button id="confirmCanonicalPractice" disabled={disabled} onClick={start}>{busy?'준비 중…':'배치·점수 교체 후 시작'}</Button></DialogFooter>
  </DialogContent></Dialog>
 </>
}
