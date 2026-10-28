import * as React from 'react'
import {SelectField} from '@/components/controls'
import {Field,FieldLabel} from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { loadAndStartCanonicalPractice } from '@/components/canonical-practice-action.mjs'

/** Optional build only. Opening or dismissing the dialog does not request a GPU. */
export function CanonicalPracticeEntry({state:s,controller}:{state:any;controller:any}) {
 const [open,setOpen]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[profile,setProfile]=React.useState('mmq1-ball-ball')
 const pending=React.useRef<AbortController|null>(null)
 React.useEffect(()=>()=>{pending.current?.abort();pending.current=null},[])
 const available=(globalThis as any).CANONICAL_GPU_ENTRY_AVAILABLE===true
 const disabled=busy||!s.ready||!s.paused||!s.canAim||!!s.activeStroke||s.routeStatus==='searching'||!!s.canonicalPlayback
 const changeOpen=(value:boolean)=>{
  if(!value){pending.current?.abort();pending.current=null;setBusy(false)}
  else setError('')
  setOpen(value)
 }
 const start=async()=>{
  if(pending.current||disabled)return
  const request=new AbortController();pending.current=request;setBusy(true);setError('')
  try {
   await loadAndStartCanonicalPractice(controller,request.signal,undefined,profile)
   if(pending.current!==request||request.signal.aborted)return
   pending.current=null;setBusy(false);setOpen(false)
  } catch(cause) {
   if(pending.current!==request||request.signal.aborted)return
   setError(cause instanceof Error?cause.message:String(cause))
  } finally {
   if(pending.current===request){pending.current=null;setBusy(false)}
  }
 }
 if(!available)return null
 return <>
  <Button id="startCanonicalPractice" variant="outline" size="sm" disabled={disabled} onClick={()=>changeOpen(true)}>GPU 실험 새 게임</Button>
  <Dialog open={open} onOpenChange={changeOpen}><DialogContent>
   <DialogHeader><DialogTitle>GPU 실험 새 게임을 시작할까요?</DialogTitle>
    <DialogDescription>현재 배치와 점수를 새 4구 연습 배치로 교체합니다. 기존 기록은 옮기지 않습니다.</DialogDescription></DialogHeader>
   <p id="canonicalManualTestNotice">실험적 GPU 엔진 · 자동 GPU 검증 미완료 · 수동 테스트용입니다. 시작을 확인하기 전에는 GPU를 요청하지 않습니다.</p>
   <p>공이 멈추고 되돌리기·다시 실행 기록이 비어 있어야 합니다. 기록이 있으면 취소 후 기본 게임을 초기화하세요.</p>
   <Field><FieldLabel htmlFor="canonicalPracticeProfile">새 게임 물리 프로필</FieldLabel><SelectField id="canonicalPracticeProfile" value={profile} disabled={busy} onChange={(e:any)=>setProfile(e.target.value)}><option value="mmq1-ball-ball">MMQ1 · 공 충돌</option><option value="mmq2-cushion">MMQ2 · 제한된 쿠션 충돌</option></SelectField></Field>
   <p>초기 9개 타격 조합으로 시작하며 수동 탭에서 유한 조합을 편집할 수 있습니다. 최대 4096개를 대기열로 처리하며 초기 9개는 3개씩 GPU 배치로 평가합니다. {profile==='mmq1-ball-ball'?'MMQ1의 지원 조건을 만족하는 더 큰 조합은 최대 16개 배치를 사용하고, 조건에 맞지 않는 묶음과 나머지는 3개·1개 배치로 처리합니다.':'MMQ2의 최대 배치 폭은 3개이며 나머지는 1개씩 처리합니다.'} 전체 경로 탐색이나 수천 개 동시 처리의 완료 버전이 아닙니다.</p>
   <Alert><AlertTitle>지원 범위 제한</AlertTitle><AlertDescription>{profile==='mmq1-ball-ball'?'MMQ1 공 충돌 프로필입니다. 쿠션 충돌은 미지원이며 실패로 바꾸지 않습니다. GPU 저장 버퍼 바인딩 9개가 필요합니다.':'MMQ2는 제한된 쿠션 충돌을 지원합니다. 모든 쿠션 상황을 지원한다는 뜻은 아니며 미지원·미완료를 실패로 바꾸지 않습니다. GPU 저장 버퍼 바인딩 10개가 필요합니다.'} 프로필은 새 게임을 시작하기 전에만 선택할 수 있습니다. 정지한 공의 X/Z 이동은 Q24 격자와 보수적인 간격 검사 안에서 지원합니다. 높이·공 추가/삭제·재질·모드 변경은 지원하지 않습니다. 기본 모드로 돌아가려면 페이지를 새로 열어야 합니다.</AlertDescription></Alert>
   {busy?<p role="status" aria-live="polite">GPU 장치와 새 게임을 준비하고 있습니다. 취소하면 대기 중인 시작 요청을 중단합니다.</p>:null}
   {error?<Alert id="canonicalPracticeError" role="alert"><AlertTitle>시작하지 못했습니다</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>:null}
   <DialogFooter><Button id="cancelCanonicalPractice" variant="outline" onClick={()=>changeOpen(false)}>취소</Button><Button id="confirmCanonicalPractice" disabled={disabled} onClick={start}>{busy?'준비 중…':'배치·점수 교체 후 시작'}</Button></DialogFooter>
  </DialogContent></Dialog>
 </>
}
