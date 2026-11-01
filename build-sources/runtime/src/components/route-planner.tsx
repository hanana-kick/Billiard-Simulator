import * as React from 'react'
import { CanonicalRoutePlanner } from '@/components/canonical-route-planner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Field, FieldLabel, FieldGroup, FieldDescription, FieldSet, FieldLegend } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { SelectField, SwitchField } from '@/components/controls'
import { Icon } from '@/icons'
import { Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverTitle, PopoverDescription } from '@/components/ui/popover'
const G=globalThis as any
const resultPages=new WeakMap<object,number>()
const fmt=(v:number,n=2)=>Number(v||0).toFixed(n)
type Method={id:string;label:string;short:string;description:string;rule:string}
export function RoutePlanner(props:{state:any;controller:any}){
 return props.state.canonicalPlayback?<CanonicalRoutePlanner {...props}/>:<LegacyRoutePlanner {...props}/>
}
function LegacyRoutePlanner({state:s,controller:c}:{state:any;controller:any}){
 const o=s.routeOptions,busy=s.routeStatus==='searching',result=s.routeResult,p=s.routeProgress
 const [detailsOpen,setDetailsOpen]=React.useState(false)
 const detailsTrigger=React.useRef<HTMLButtonElement>(null)
 const [shown,setShown]=React.useState(()=>result?resultPages.get(result)||6:6)
 React.useEffect(()=>{if(result)resultPages.set(result,shown)},[result,shown])
 React.useEffect(()=>{if(busy)setShown(6)},[busy])
 const catalog:Method[]=G.LabRouteRules.catalog
 const balls=s.objects.filter((b:any)=>b.shape==='sphere'&&b.id!==s.selectedId)
 const ids:string[]=o.mode==='direct'?['direct']:o.mode==='carom'?['any']:o.methods
 const invalidRange=(o.minSpeed??.5)>(o.maxSpeed??4.5)||(o.elevationMode==='search'&&(o.minElevation??0)>(o.maxElevation??30))
 const invalid=invalidRange||balls.length<2||o.targetId===o.secondId||!balls.some((b:any)=>b.id===o.targetId)||!balls.some((b:any)=>b.id===o.secondId)||!ids.length
 const canSearch=s.ready&&s.canAim&&!busy&&!invalid&&!s.activeStroke
 const method=(id:string)=>G.LabRouteRules.byId.get(id) as Method
 const label=(id:number)=>s.objects.find((b:any)=>b.id===id)?.label||String(id)
 const change=(key:string)=>(e:any)=>c.routeOption(key,['targetId','secondId','maxCushions','maxKisses','solveTimeMs','horizon','minSpeed','maxSpeed','minElevation','maxElevation'].includes(key)?Number(e.target.value):e.target.value)
 const diagnostics=result?.analyticDiagnostics||[]
 const failureLabels:Record<string,string>={'insufficient-cushions':'쿠션 수 부족','final-target-not-hit':'두 번째 공 미명중','first-target-not-hit':'첫 공 미명중','cue-obstruction':'큐 장애물 충돌','cue-tail-incomplete':'큐 동작 검증 미완료','four-ball-shot-incomplete':'4구 전체 정지 검증 미완료','four-ball-opponent-or-off-table':'상대 수구 접촉 또는 장외'}
 const diagnosticFailures=[...new Set(diagnostics.filter((d:any)=>!d.success).map((d:any)=>failureLabels[d.failureReason]||'접촉 순서·쿠션 조건 불충족'))]
 const nearest=Math.min(...(p?.methods||[]).map((m:any)=>m.nearestGap??Infinity))
 return <Card id="routePlanner" className="route-card">
  <CardHeader><CardTitle>{s.gameMode==='four'?'4구':'3구'} 경로 찾기</CardTitle><CardDescription>{o.mode==='three'?'3쿠션':o.fourBallThreeCushion?'두 적구 + 3쿠션':'두 공 맞히기'} · {(o.allowKiss??o.allowMovingTargets)!==false?'키스 허용':'키스 제외'} · {o.mode!=='three'||o.methods.includes('any')?'모든 경로':`${ids.length}가지 방법`}</CardDescription></CardHeader>
  <CardContent className="route-content">

   <div className="route-actions">
    {busy?<Button id="cancelRoute" variant="outline" onClick={()=>c.stopSearch()}>중단 · 찾은 경로 유지</Button>:<Button id="findRoute" disabled={!canSearch} onClick={()=>c.startSearch()}><Icon name="crosshair" data-icon="inline-start"/>{result?'다시 계산':'경로 계산'}</Button>}
    <span className="helper">{invalidRange?'최소값은 최대값보다 클 수 없습니다.':invalid?'서로 다른 목적구와 방법을 선택하세요.':!s.canAim&&!busy?'공이 멈춘 뒤 계산합니다.':o.mode==='direct'?'쿠션 없이 두 공 맞히기':o.mode==='carom'?(o.fourBallThreeCushion?'두 적구와 3쿠션 조건으로 탐색':'설정한 경로 영역에서 두 적구 맞히기'):o.methods.length===1&&o.methods[0]==='any'?'접촉 순서의 제약식을 풀어 3쿠션 경로 계산':`${ids.length}가지 방법 탐색`}</span>
   </div>
   <Accordion value={detailsOpen?["details"]:[]} onValueChange={value=>setDetailsOpen(value.includes("details"))}><AccordionItem value="details">
    <AccordionTrigger id="routeDetails" ref={detailsTrigger}>상세보기</AccordionTrigger>
    <AccordionContent>
    <div className="route-details-heading"><h3>경로 상세 설정</h3><p className="helper">기본 프리셋의 조건을 세부 조정합니다. 변경값은 접어도 유지됩니다.</p></div>
    <div className="route-details-body" id="routeDetailsBody">
   {s.gameMode==='four'?<div><SwitchField id="fourBallThreeCushion" checked={!!o.fourBallThreeCushion} onChange={v=>c.routeOption('fourBallThreeCushion',v)} label="3쿠션 조건 추가"/><p className="helper">서로 다른 두 번째 적구를 처음 맞히기 전에 수구가 쿠션에 3회 이상 닿아야 합니다. 두 적구 명중 후의 쿠션은 소급 인정하지 않습니다.</p></div>:null}
   <FieldGroup>
    <div className="route-form">
     <Field><FieldLabel htmlFor="routeTarget">목적구 A</FieldLabel><SelectField id="routeTarget" aria-label="목적구 A" value={o.targetId} onChange={change('targetId')}>{balls.map((b:any)=><option key={b.id} value={b.id}>{b.label}</option>)}</SelectField></Field>
     <Field><FieldLabel htmlFor="routeSecond">목적구 B</FieldLabel><SelectField id="routeSecond" aria-label="목적구 B" value={o.secondId} onChange={change('secondId')}>{balls.filter((b:any)=>b.id!==o.targetId).map((b:any)=><option key={b.id} value={b.id}>{b.label}</option>)}</SelectField></Field>
    </div>
   </FieldGroup>
   <section id="routeMethods" className="route-settings"><h3>방법 선택</h3>
    {o.mode==='three'?<FieldSet><FieldLegend className="sr-only">계산할 방법</FieldLegend>
     <ToggleGroup multiple value={o.methods} onValueChange={v=>c.routeOption('methods',v)} aria-label="3쿠션 방법 다중 선택" variant="outline" size="default" spacing={2} className="method-picker">{catalog.map(m=><ToggleGroupItem key={m.id} value={m.id} title={m.rule}>{m.id==='any'?'모든 경로':m.short}</ToggleGroupItem>)}</ToggleGroup>
     <div className="method-definitions">{catalog.filter(m=>o.methods.includes(m.id)).map(m=><p key={m.id}><strong>{m.short}</strong><span>{m.description}</span></p>)}</div>
     <FieldDescription>이름보다 표시된 접촉 순서로 판정합니다. 돌리기는 앞·뒤·옆 계열을 묶은 3면 경로입니다.</FieldDescription>
    </FieldSet>:<p className="helper">{o.mode==='direct'?'두 공을 모두 맞힐 때까지 수구의 쿠션 접촉이 0회인 후보만 성공입니다.':o.fourBallThreeCushion?'두 적구 명중과 3쿠션 조건을 함께 검증합니다.':'두 공을 맞히는 경로를 선택한 경로 영역 안에서 접촉 조건을 풀어 계산합니다.'}</p>}
   </section>
   <section id="routeAdvanced" className="route-settings"><h3>입력과 검증 조건</h3><FieldGroup>
    <Alert id="inverseMethod"><AlertTitle>접촉 제약식으로 큐 입력 계산</AlertTitle><AlertDescription>쿠션과 공의 접촉 순서를 먼저 정하고, 그 조건을 만족하는 조준·들림·세기·타점을 연립 잔차로 풉니다. 실제 물리 재생을 통과한 해만 표시합니다. 입력값을 일정 횟수 표본 추출하는 방식으로 돌아가지 않습니다.</AlertDescription></Alert>
    <Field><FieldLabel htmlFor="routeOrder">맞히는 순서</FieldLabel><SelectField id="routeOrder" aria-label="목적구 순서" value={o.order} onChange={change('order')}><option value="either">양쪽 순서 모두</option><option value="fixed">A → B 고정</option></SelectField></Field>
    <div className="route-form"><Field><FieldLabel htmlFor="routeDepth">경로 영역 · 최대 쿠션 수</FieldLabel><SelectField id="routeDepth" aria-label="최대 쿠션 수" value={o.maxCushions??3} onChange={change('maxCushions')}>{[0,1,2,3,4,5,6,8,12].filter(v=>v>=(o.mode==='three'||o.fourBallThreeCushion?3:0)).map(v=><option key={v} value={v}>{v}회까지</option>)}</SelectField><FieldDescription>이 범위 안의 이산 접촉 순서를 다룹니다. 무한한 경로 전체를 푼다는 뜻은 아닙니다.</FieldDescription></Field><Field><FieldLabel htmlFor="routeHorizon">실제 샷 검증 구간</FieldLabel><SelectField id="routeHorizon" aria-label="물리 검증 시간" value={o.horizon} onChange={change('horizon')}><option value={8}>8초</option><option value={16}>16초</option><option value={30}>30초</option></SelectField></Field></div>
    <SwitchField id="routeSpin" checked={o.spin} onChange={v=>c.routeOption('spin',v)} label="타점도 함께 탐색"/>
    <div className="route-option-help"><SwitchField id="routeKiss" checked={(o.allowKiss??o.allowMovingTargets)!==false} onChange={v=>c.routeOption('allowKiss',v)} label="키스 허용"/><Popover><PopoverTrigger render={<Button variant="ghost" size="icon" aria-label="키스 허용 설명"/>}><Icon name="info"/></PopoverTrigger><PopoverContent><PopoverHeader><PopoverTitle>키스 허용</PopoverTitle><PopoverDescription>수구가 한 번 맞힌 목적구와 떨어진 뒤 다시 충돌하는 경로를 허용합니다. 목표 명중이 성립하기 전까지만 판단하며, 명중 후의 충돌은 결과를 바꾸지 않습니다.</PopoverDescription></PopoverHeader><p>움직이는 목적구를 처음 맞히는 것은 키스로 보지 않습니다. 끄면 명중 전에 키스가 생기는 후보만 제외합니다.</p></PopoverContent></Popover></div>
    {o.allowKiss!==false?<Field><FieldLabel htmlFor="routeKissDepth">명중 전 추가 키스 접촉 영역</FieldLabel><SelectField id="routeKissDepth" aria-label="추가 키스 접촉 수" value={o.maxKisses??1} onChange={change('maxKisses')}>{[0,1,2,3,4].map(v=><option key={v} value={v}>{v}회까지</option>)}</SelectField><FieldDescription>첫 목적구와 재접촉하는 순서를 별도 제약식으로 풉니다. 이 유한 범위 밖의 키스 경로는 아직 포함하지 않습니다.</FieldDescription></Field>:null}
    <Field><FieldLabel htmlFor="routeElevation">수직 큐 들림</FieldLabel><SelectField id="routeElevation" aria-label="수직 큐 들림 탐색" value={o.elevationMode||'search'} onChange={change('elevationMode')}><option value="fixed">현재 {fmt(s.settings.elevation,1)}° 고정</option><option value="search">설정 범위 전체에서 탐색</option></SelectField></Field>
    {o.elevationMode==='search'?<div className="route-form">{[['minElevation','최소 들림'],['maxElevation','최대 들림']].map(([key,title])=><Field key={key}><FieldLabel htmlFor={'route'+key}>{title}</FieldLabel><SelectField id={'route'+key} aria-label={title} value={o[key]??(key==='minElevation'?0:85)} onChange={change(key)}>{[0,5,10,15,20,30,45,60,80,85].map(v=><option key={v} value={v}>{v}°</option>)}</SelectField></Field>)}</div>:null}
    <div className="route-form">{[['minSpeed','최소 큐 속도'],['maxSpeed','최대 큐 속도']].map(([key,title])=><Field key={key}><FieldLabel htmlFor={'route'+key}>{title}</FieldLabel><SelectField id={'route'+key} aria-label={title} value={o[key]??(key==='minSpeed'?.5:4.5)} onChange={change(key)}>{[.5,1,1.5,2,2.5,3,3.5,4,4.5].map(v=><option key={v} value={v}>{v} m/s</option>)}</SelectField></Field>)}</div>
    <FieldDescription>수평 조준 360°와 설정한 수직 들림 범위에서 접촉 제약식을 수치적으로 풉니다. 기본 들림은 0~85°이며, 85°는 현재 엔진의 입력 상한입니다. 유한 시간과 수치 수렴의 한계 때문에 연속 범위의 모든 해를 보장하지 않습니다. 타점은 반지름 비율입니다.</FieldDescription>
   </FieldGroup></section>
   {(p?.methods?.length||0)>1?<section><h3>방법별 진행</h3><div className="method-status">{p.methods.map((m:any)=><div key={m.id}><span>{method(m.id)?.short}</span><span>{m.tested}/{m.total}</span><Badge variant="outline">{m.found?`${m.found}개`:'탐색'}</Badge></div>)}</div></section>:null}
   {result?.statusCounts?<Alert id="inverseDiagnostics"><AlertTitle>제약식 풀이 상태</AlertTitle><AlertDescription>검증 완료 {result.statusCounts.verified||0} · 미수렴 {result.statusCounts.unconverged||0} · 현재 모델 미지원 {result.statusCounts.unsupported||0} · 제약 모순 증명 {result.statusCounts.infeasible||0}. 미수렴이나 미지원은 경로가 없다는 판정이 아닙니다.</AlertDescription></Alert>:null}
   {result?.workerPlan?<p className="helper" id="routeWorkerDiagnostics">자동 병렬 계산: 워커 {result.workerCount}개 · 감지된 논리 코어 {result.workerPlan.hardwareConcurrency}개 · 자원·작업량 기준 최대 {result.workerPlan.requestedWorkers}개</p>:null}
   {result?.retryOverhead?.tested>0?<p className="helper">계산 복구 중 기존 성공 후보를 보존했습니다. 재실행 전 추가 작업: 물리 평가 {result.retryOverhead.tested}개 · 물리 스텝 {result.retryOverhead.physicsSteps}회.</p>:null}
   {result?.firstSuccessCost?<p className="helper">첫 검증 성공:  {fmt(result.firstSuccessCost.elapsedMs/1000,1)}초{result.firstSuccessCost.scope==='worker-local'?' (가장 먼저 찾은 워커 내부 기준)':''}</p>:null}

<p className="helper">이산 접촉 순서별로 역기하 초기해와 비선형 근풀이를 사용합니다. 기본 풀이가 이전 표본 탐색으로 전환되지 않습니다. 회전·마찰·쿠션을 모두 한 번에 정확히 푸는 폐쇄형 식은 아니며, 실제 물리 사건 잔차의 반복 수치해법입니다. 쿠션 수와 추가 키스 수로 경로 영역을 명시합니다. 영역 밖의 경로와 미수렴 분기는 아직 해결되지 않을 수 있습니다. 약 20초 계산 후 진행 중인 평가를 마치고 상태를 보존합니다. 이어서 계산할 수 있습니다.</p>
    <Button id="closeRouteDetails" variant="outline" onClick={()=>{setDetailsOpen(false);detailsTrigger.current?.focus()}}>상세 설정 접기</Button></div>
    </AccordionContent></AccordionItem></Accordion>
   {s.obstruction&&o.elevationMode!=='search'?<Alert><AlertTitle>현재 큐 자세가 장애물과 겹칩니다.</AlertTitle><AlertDescription>큐 들림을 고정하면 이 각도만 계산합니다. 들림도 함께 탐색하면 설정한 범위에서 큐가 겹치지 않는 자세를 찾고 실제 스트로크까지 검사합니다.</AlertDescription><Button variant="outline" onClick={()=>c.routeOption('elevationMode','search')}>큐 들림도 함께 탐색</Button></Alert>:null}
   {busy&&p?<div className="route-progress" role="status">
    <div className="progress-heading"><strong>{p.found?`검증 완료 경로 ${p.found}개`:'물리 월드에서 계산 중'}</strong><span>{p.topologiesResolved||0}개 분기 처리</span></div>
    <p className="helper">연립식 풀이 {p.rootIterations||0}회 · 실제 물리 평가 {p.evaluated||0}회. 이는 표본 후보 개수 제한이 아닙니다.</p>
    <div className="progress-heading helper"><span>진행 중인 접촉 분기 {p.activeTopologies||0}개</span><span>경과 {fmt((p.elapsedMs||0)/1000,1)}초</span></div>
    {result?.results.length?<p className="helper">끝까지 기다리지 않고 찾은 경로를 볼 수 있습니다.</p>:null}
   </div>:null}
   {['error','canceled','stale'].includes(s.routeStatus)?<Alert><AlertTitle>{s.routeStatus==='error'?'계산 오류':s.routeStatus==='stale'?'배치·조건이 바뀌었습니다':'탐색 취소'}</AlertTitle><AlertDescription>{s.routeError}</AlertDescription></Alert>:null}
   {s.routeStatus==='done'&&result&&!result.results.length?<Alert id="noRoute"><AlertTitle>현재까지 검증된 해가 없습니다.</AlertTitle><AlertDescription>미수렴·미지원 분기와 경로 영역 밖의 해가 남아 있을 수 있습니다. 경로가 없다는 증명이 아닙니다.</AlertDescription></Alert>:null}
   {!busy&&result?.continuable?<Button id="resumeSearch" variant="outline" onClick={()=>c.resumeSearch()}>보존된 제약식 계산 이어가기</Button>:null}
   {!busy&&result?.domainExhausted?<Button id="expandSearch" variant="outline" disabled={(o.maxCushions??3)>=12} onClick={()=>{c.routeOption('maxCushions',Math.min(12,(o.maxCushions??3)+1));c.startSearch()}}>쿠션 경로 영역 한 단계 확장</Button>:null}
   {result?.results?.length?<div className="route-results" aria-label="성공 경로"><p id="routeResultCount" role="status">{Number.isFinite(result.found??p?.found)?`성공한 시도 ${result.found??p?.found}회 · `:''}중복 제외 후보 {result.results.length}개</p><p className="helper">입력이 다르면 같은 이동 경로도 별도 후보입니다.</p><p id="routePageCount">{result.results.length}개 중 {Math.min(shown,result.results.length)}개 표시</p>
    {result.partial&&!busy?<p className="helper">중단 전 발견한 검증 완료 후보입니다.</p>:null}
    {result.results.slice(0,shown).map((r:any,i:number)=><Card key={r.id} size="sm" className="route-result" data-applied={s.routeApplied===r.id}>
     <CardHeader><div className="route-result-header"><CardTitle>{r.method==='any'?(method(r.matchedMethods?.find((m:string)=>m!=='any')||'any')?.short):method(r.method)?.short}</CardTitle><Badge variant="secondary">{r.cushions}쿠션</Badge></div><CardDescription>{label(r.firstId)} → {label(r.secondId)} · {fmt(r.distance)} m{result.inputStrategy==='analytic'?` · ${r.searchModel?.stage==='closed-form-input-estimate'?'직접식 추정':r.searchModel?.stage==='iterative-physical-correction'?'수치보정':r.searchModel?.stage==='current-user-settings'?'현재 입력':'보완 탐색'}${r.searchModel?.modified?' (입력 보정됨)':''}`:''}</CardDescription></CardHeader>
     <CardContent><dl className="route-values"><div><dt>수평 조준</dt><dd>{fmt(r.settings.angle,3)}°</dd></div><div><dt>수직 들림</dt><dd>{fmt(r.settings.elevation,1)}°</dd></div><div><dt>타점 X / Y</dt><dd>{fmt(r.settings.tipX)} / {fmt(r.settings.tipY)}</dd></div><div><dt>큐 속도</dt><dd>{fmt(r.settings.speed)} m/s</dd></div><div><dt>도달</dt><dd>{fmt(r.seconds)} s</dd></div></dl><p className="route-sequence">{r.contacts.map((e:any)=>e.label.replace('쪽 쿠션',' 쿠션')).join(' → ')}</p></CardContent>
     <CardFooter><Button id={'applyRoute'+r.id} disabled={!['done','searching'].includes(s.routeStatus)} variant={i===0?'default':'outline'} onClick={()=>c.applyRoute(r.id)}>{s.routeApplied===r.id?'적용됨':'경로 보기·적용'}</Button></CardFooter>
    </Card>)}
    {result.results.length>shown?<Button id="moreRoutes" variant="outline" onClick={()=>setShown(n=>n+6)}>더 보기 · 남은 후보 {result.results.length-shown}개</Button>:null}
   </div>:null}
  </CardContent>

 </Card>
}
