import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

const fmt=(value:number,digits=2)=>Number.isFinite(value)?value.toFixed(digits):'—'
const count=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>=0?String(value):'—'

function batchWidthsSummary(widths:unknown){
 if(!Array.isArray(widths)||!widths.length||widths.some(n=>!Number.isSafeInteger(n)||n<1))return null
 const counts=new Map<number,number>();for(const width of widths)counts.set(width,(counts.get(width)??0)+1)
 return Array.from(counts).map(([width,runs])=>`${width}개 × ${runs}회`).join(' · ')
}

/** Compact search does not carry a trajectory, distance, contact list or arrival time. */
export function CanonicalRoutePlanner({state:s,controller:c}:{state:any;controller:any}) {
 const busy=s.routeStatus==='searching',enabled=s.canonicalPlayback?.searchEnabled===true
 const result=s.routeResult?.kind==='canonical-compact-search-v1'?s.routeResult:null
 const progress=busy?s.routeProgress:result,domain=s.canonicalPlayback?.searchDomain
 const rows=result?.results||[],[shown,setShown]=React.useState(6)
 React.useEffect(()=>{if(busy)setShown(6)},[busy])
 const canSearch=enabled&&s.ready&&s.canAim&&!busy&&!s.activeStroke
 const executedWidths=batchWidthsSummary(progress?.batchWidths)
 const game=s.game,threeCushion=game?.kind==='three'||game?.threeCushion===true
 return <Card id="routePlanner" className="route-card">
  <CardHeader><CardTitle>{s.gameMode==='four'?'4구':'3구'} GPU 파라미터 탐색</CardTitle>
   <CardDescription>실험적 canonical 엔진 · 현재 게임과 같은 득점 규칙</CardDescription></CardHeader>
  <CardContent className="route-content">
   <Alert id="canonicalSearchScope"><AlertTitle>명시된 유한 입력 조합만 평가합니다</AlertTitle>
    <AlertDescription>각 타격 파라미터를 GPU 배치로 평가하고 최종 판정만 읽습니다. 연속 범위의 모든 해나 모든 경로를 찾는다는 뜻이 아닙니다. 적용한 후보도 같은 canonical 엔진으로 타격합니다.</AlertDescription></Alert>
   <p className="helper">{threeCushion?'두 번째 목적구 명중 전 3쿠션 조건 · ':''}키스 허용{s.gameMode==='four'?' · 정지할 때까지 상대 수구 접촉 반칙 검사':''}. 목적구 순서·경로 종류·키스 제외 등 별도 탐색 필터는 이 모드에서 제공하지 않습니다.</p>
   {domain?<dl className="route-values" aria-label="명시된 파라미터 조합">
    <div><dt>수평 조준</dt><dd>{count(domain.counts?.angles)}개</dd></div>
    <div><dt>큐 속도</dt><dd>{count(domain.counts?.speeds)}개</dd></div>
    <div><dt>수직 들림</dt><dd>{count(domain.counts?.elevations)}개</dd></div>
    <div><dt>타점 X / Y</dt><dd>{count(domain.counts?.tipXs)} / {count(domain.counts?.tipYs)}개</dd></div>
    <div><dt>전체 조합</dt><dd>{count(domain.total)}개</dd></div>
   </dl>:null}
   {domain?.parameterGrid?<Button id="editCanonicalGrid" variant="outline" onClick={()=>c.option('activePanel','shot')}>수동 탭에서 탐색 조합 편집</Button>:null}
   {!enabled?<Alert><AlertTitle>GPU 탐색 서비스 미연결</AlertTitle><AlertDescription>명시적 파라미터 범위와 호환되는 GPU 배치 서비스가 필요합니다. 기존 CPU 탐색으로 대체하지 않습니다.</AlertDescription></Alert>:null}
   <div className="route-actions">{busy?<Button id="cancelRoute" variant="outline" onClick={()=>c.stopSearch()}>중단 · 찾은 후보 유지</Button>:<Button id="findRoute" disabled={!canSearch} onClick={()=>c.startSearch()}>{result?'다시 계산':'GPU 후보 계산'}</Button>}</div>
   {progress?<div className="route-progress" role="status">
    <p>처리 {count(progress.tested)} / {count(progress.total)} · 판정 완료 {count(progress.evaluated)} · 성공 {count(progress.found)}</p>
    {executedWidths?<p id="canonicalActualBatchWidths" className="helper">실제 완료 배치: {executedWidths}</p>:null}
    <p className="helper">실패 {count(progress.miss)} · 미완료 {count(progress.incomplete)} · 미지원 {count(progress.unsupported)}</p>
    <p className="helper">미완료·미지원은 실패나 경로가 없다는 판정이 아닙니다.</p>
   </div>:null}
   {['error','canceled','stale','unavailable'].includes(s.routeStatus)?<Alert><AlertTitle>{s.routeStatus==='stale'?'배치·조건이 바뀌었습니다':s.routeStatus==='canceled'?'탐색 취소':'탐색을 완료하지 못했습니다'}</AlertTitle><AlertDescription>{s.routeError}</AlertDescription></Alert>:null}
   {s.routeStatus==='done'&&result&&!rows.length?<Alert id="noRoute"><AlertTitle>평가한 조합에서 성공 후보를 찾지 못했습니다.</AlertTitle><AlertDescription>미완료·미지원 입력과 탐색하지 않은 조합이 있을 수 있습니다. 경로가 없다는 증명이 아닙니다.</AlertDescription></Alert>:null}
   {rows.length?<div className="route-results" aria-label="GPU 성공 후보">
    <p id="routeResultCount" role="status">성공 후보 {rows.length}개</p>
    <p id="routePageCount">{rows.length}개 중 {Math.min(shown,rows.length)}개 표시</p>
    {result.partial&&!busy?<p className="helper">중단 전 판정이 완료된 후보입니다.</p>:null}
    {rows.slice(0,shown).map((r:any)=><Card key={r.id} size="sm" className="route-result" data-applied={s.routeApplied===r.id}>
     <CardHeader><div className="route-result-header"><CardTitle>후보 {r.id}</CardTitle><Badge variant="secondary">GPU 성공 판정</Badge></div><CardDescription>최종 점수 {fmt(r.score,0)} · 미리보기는 제공되는 원본 표본만 표시</CardDescription></CardHeader>
     <CardContent><dl className="route-values">
      <div><dt>수평 조준</dt><dd>{fmt(r.settings.angle,3)}°</dd></div>
      <div><dt>수직 들림</dt><dd>{fmt(r.settings.elevation,1)}°</dd></div>
      <div><dt>타점 X / Y</dt><dd>{fmt(r.settings.tipX)} / {fmt(r.settings.tipY)}</dd></div>
      <div><dt>큐 속도</dt><dd>{fmt(r.settings.speed)} m/s</dd></div>
     </dl><p className="helper">이 결과에는 거리·도달 시간·쿠션 횟수·접촉 순서가 포함되지 않습니다.</p></CardContent>
     <CardFooter><Button id={'applyRoute'+r.id} disabled={!['done','searching'].includes(s.routeStatus)} onClick={()=>c.applyRoute(r.id)}>{s.routeApplied===r.id?'적용됨':'타격 설정 적용'}</Button></CardFooter>
    </Card>)}
    {rows.length>shown?<Button id="moreRoutes" variant="outline" onClick={()=>setShown(n=>n+6)}>더 보기 · 남은 후보 {rows.length-shown}개</Button>:null}
   </div>:null}
  </CardContent>
 </Card>
}
