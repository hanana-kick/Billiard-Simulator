import * as React from 'react'
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
export function RoutePlanner({state:s,controller:c}:{state:any;controller:any}){
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
 const change=(key:string)=>(e:any)=>c.routeOption(key,['targetId','secondId','budget','horizon','minSpeed','maxSpeed','minElevation','maxElevation'].includes(key)?Number(e.target.value):e.target.value)
 const value=p?Math.min(100,(p.tested+(p.fraction||0))/Math.max(1,p.total)*100):0
 const diagnostics=result?.analyticDiagnostics||[]
 const failureLabels:Record<string,string>={'insufficient-cushions':'쿠션 수 부족','final-target-not-hit':'두 번째 공 미명중','first-target-not-hit':'첫 공 미명중','cue-obstruction':'큐 장애물 충돌','cue-tail-incomplete':'큐 동작 검증 미완료','four-ball-shot-incomplete':'4구 전체 정지 검증 미완료','four-ball-opponent-or-off-table':'상대 수구 접촉 또는 장외'}
 const diagnosticFailures=[...new Set(diagnostics.filter((d:any)=>!d.success).map((d:any)=>failureLabels[d.failureReason]||'접촉 순서·쿠션 조건 불충족'))]
 const nearest=Math.min(...(p?.methods||[]).map((m:any)=>m.nearestGap??Infinity))
 return <Card id="routePlanner" className="route-card">
  <CardHeader><CardTitle>{s.gameMode==='four'?'4구':'3구'} 경로 찾기</CardTitle><CardDescription>{o.mode==='three'?'3쿠션':o.fourBallThreeCushion?'두 적구 + 3쿠션':'두 공 맞히기'} · {(o.allowKiss??o.allowMovingTargets)!==false?'키스 허용':'키스 제외'} · {o.mode!=='three'||o.methods.includes('any')?'모든 경로':`${ids.length}가지 방법`}</CardDescription></CardHeader>
  <CardContent className="route-content">

   <div className="route-actions">
    {busy?<Button id="cancelRoute" variant="outline" onClick={()=>c.stopSearch()}>중단 · 찾은 경로 유지</Button>:<Button id="findRoute" disabled={!canSearch} onClick={()=>c.startSearch()}><Icon name="crosshair" data-icon="inline-start"/>{result?'다시 계산':'경로 계산'}</Button>}
    <span className="helper">{invalidRange?'최소값은 최대값보다 클 수 없습니다.':invalid?'서로 다른 목적구와 방법을 선택하세요.':!s.canAim&&!busy?'공이 멈춘 뒤 계산합니다.':o.mode==='direct'?'쿠션 없이 두 공 맞히기':o.mode==='carom'?(o.fourBallThreeCushion?'두 적구와 3쿠션 조건으로 탐색':'쿠션 수 제한 없이 두 공 맞히기'):o.methods.length===1&&o.methods[0]==='any'?'모든 3쿠션 경로를 계산 예산 안에서 탐색':`${ids.length}가지 방법 탐색`}</span>
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
    </FieldSet>:<p className="helper">{o.mode==='direct'?'두 공을 모두 맞힐 때까지 수구의 쿠션 접촉이 0회인 후보만 성공입니다.':o.fourBallThreeCushion?'두 적구 명중과 3쿠션 조건을 함께 검증합니다.':'두 공을 맞히는 경로를 쿠션 수와 유형 제한 없이 계산 예산 안에서 탐색합니다.'}</p>}
   </section>
   <section id="routeAdvanced" className="route-settings"><h3>입력과 검증 조건</h3><FieldGroup>
    <Field><div className="route-option-help"><FieldLabel htmlFor="routeInputStrategy">입력 계산 방식</FieldLabel><Popover><PopoverTrigger render={<Button variant="ghost" size="icon" aria-label="입력 계산 방식 설명"/>}><Icon name="info"/></PopoverTrigger><PopoverContent><PopoverHeader><PopoverTitle>직접식 입력 추정</PopoverTitle><PopoverDescription>제한된 이상조건에서 조준·큐 세기·타점을 직접 계산한 뒤 실제 물리엔진으로 검증하고, 필요한 경우 보완 탐색과 수치보정을 사용합니다. 실제 마찰·쿠션·큐 접촉 전체의 정확한 단일식 해는 아닙니다.</PopoverDescription></PopoverHeader><p>혼합 탐색은 기존 후보 배분을 유지합니다. 직접식 모드는 같은 계산 예산 안에서 후보 배분이 바뀌어 결과가 줄 수도 있습니다.</p></PopoverContent></Popover></div><SelectField id="routeInputStrategy" aria-label="입력 계산 방식" value={o.inputStrategy||'hybrid'} onChange={change('inputStrategy')}><option value="hybrid">혼합 탐색</option><option value="analytic">직접식 입력 추정</option></SelectField></Field>
    <Field><FieldLabel htmlFor="routeOrder">맞히는 순서</FieldLabel><SelectField id="routeOrder" aria-label="목적구 순서" value={o.order} onChange={change('order')}><option value="either">양쪽 순서 모두</option><option value="fixed">A → B 고정</option></SelectField></Field>
    <div className="route-form"><Field><FieldLabel htmlFor="routeBudget">계산 예산 · 방법별 후보</FieldLabel><SelectField id="routeBudget" aria-label="방법별 후보 수" value={o.budget} onChange={change('budget')}><option value={48}>빠르게 · 48</option><option value={128}>표준 · 128</option><option value={320}>넓게 · 320</option></SelectField></Field><Field><FieldLabel htmlFor="routeHorizon">계산 구간</FieldLabel><SelectField id="routeHorizon" aria-label="후보당 계산 시간" value={o.horizon} onChange={change('horizon')}><option value={8}>8초</option><option value={16}>16초</option><option value={30}>30초</option></SelectField></Field></div>
    <SwitchField id="routeSpin" checked={o.spin} onChange={v=>c.routeOption('spin',v)} label="타점도 함께 탐색"/>
    <div className="route-option-help"><SwitchField id="routeKiss" checked={(o.allowKiss??o.allowMovingTargets)!==false} onChange={v=>c.routeOption('allowKiss',v)} label="키스 허용"/><Popover><PopoverTrigger render={<Button variant="ghost" size="icon" aria-label="키스 허용 설명"/>}><Icon name="info"/></PopoverTrigger><PopoverContent><PopoverHeader><PopoverTitle>키스 허용</PopoverTitle><PopoverDescription>수구가 한 번 맞힌 목적구와 떨어진 뒤 다시 충돌하는 경로를 허용합니다. 목표 명중이 성립하기 전까지만 판단하며, 명중 후의 충돌은 결과를 바꾸지 않습니다.</PopoverDescription></PopoverHeader><p>움직이는 목적구를 처음 맞히는 것은 키스로 보지 않습니다. 끄면 명중 전에 키스가 생기는 후보만 제외합니다.</p></PopoverContent></Popover></div>
    <Field><FieldLabel htmlFor="routeElevation">수직 큐 들림</FieldLabel><SelectField id="routeElevation" aria-label="수직 큐 들림 탐색" value={o.elevationMode||'search'} onChange={change('elevationMode')}><option value="fixed">현재 {fmt(s.settings.elevation,1)}° 고정</option><option value="search">설정 범위 전체에서 탐색</option></SelectField></Field>
    {o.elevationMode==='search'?<div className="route-form">{[['minElevation','최소 들림'],['maxElevation','최대 들림']].map(([key,title])=><Field key={key}><FieldLabel htmlFor={'route'+key}>{title}</FieldLabel><SelectField id={'route'+key} aria-label={title} value={o[key]??(key==='minElevation'?0:85)} onChange={change(key)}>{[0,5,10,15,20,30,45,60,80,85].map(v=><option key={v} value={v}>{v}°</option>)}</SelectField></Field>)}</div>:null}
    <div className="route-form">{[['minSpeed','최소 큐 속도'],['maxSpeed','최대 큐 속도']].map(([key,title])=><Field key={key}><FieldLabel htmlFor={'route'+key}>{title}</FieldLabel><SelectField id={'route'+key} aria-label={title} value={o[key]??(key==='minSpeed'?.5:4.5)} onChange={change(key)}>{[.5,1,1.5,2,2.5,3,3.5,4,4.5].map(v=><option key={v} value={v}>{v} m/s</option>)}</SelectField></Field>)}</div>
    <FieldDescription>수평 조준 360°와 설정한 수직 들림 범위에서 후보를 만들고 수치보정합니다. 기본 들림은 0~85°이며, 85°는 현재 엔진의 입력 상한입니다. 유한 계산 예산으로 연속 범위의 모든 해를 보장하지 않습니다. 타점은 반지름 비율입니다.</FieldDescription>
   </FieldGroup></section>
   {(p?.methods?.length||0)>1?<section><h3>방법별 진행</h3><div className="method-status">{p.methods.map((m:any)=><div key={m.id}><span>{method(m.id)?.short}</span><span>{m.tested}/{m.total}</span><Badge variant="outline">{m.found?`${m.found}개`:'탐색'}</Badge></div>)}</div></section>:null}
   {result?.inputStrategy==='analytic'?<Alert id="analyticDiagnostics"><AlertTitle>직접식 추정 · 실제 물리 검증</AlertTitle><AlertDescription>직접식 후보 {result.analyticStats?.evaluated||0}개 시도 · 물리 조건 통과 {diagnostics.filter((d:any)=>d.success).length}개. {diagnosticFailures.length?`미통과: ${diagnosticFailures.join(', ')}.`:''} 기하 수식 잔차가 작아도 실제 명중은 보장하지 않습니다. 성공 목록에는 보완 탐색 결과도 포함됩니다.</AlertDescription>{!busy&&!result.analyticStats?.feasible?<p className="helper">현재 범위에서 직접식 입력을 만들지 못해 보완 탐색을 사용했습니다. 경로가 없다는 뜻은 아닙니다.</p>:null}</Alert>:null}
   {result?.workerPlan?<p className="helper" id="routeWorkerDiagnostics">자동 병렬 계산: 워커 {result.workerCount}개 · 감지된 논리 코어 {result.workerPlan.hardwareConcurrency}개 · 자원·작업량 기준 최대 {result.workerPlan.requestedWorkers}개</p>:null}
   {result?.retryOverhead?.tested>0?<p className="helper">계산 복구 중 기존 성공 후보를 보존했습니다. 재실행 전 추가 작업: 후보 {result.retryOverhead.tested}개 · 물리 스텝 {result.retryOverhead.physicsSteps}회.</p>:null}
   {result?.firstSuccessCost?<p className="helper">첫 성공: {result.firstSuccessCost.tested}번째 후보 · {fmt(result.firstSuccessCost.elapsedMs/1000,1)}초{result.firstSuccessCost.scope==='worker-local'?' (가장 먼저 찾은 워커 내부 기준)':''}</p>:null}

<p className="helper">접점과 쿠션 반사 수식으로 후보를 만들고 같은 물리엔진으로 검증합니다. 3쿠션 자유 경로는 첫 공 전·후의 쿠션 조합을 제한하지 않고, 계산 예산 안에서 경로 깊이를 점진적으로 늘립니다. 비선형 운동은 반복 수치보정과 실제 물리 검증을 사용하므로 단일식의 정확한 해가 아닙니다. 계산 예산 안의 유한 탐색이며 모든 해를 빠짐없이 찾는 것은 아닙니다. 찾은 후보 중 최선이며, 전역 최적해·실물 명중 보장은 아닙니다.</p>
    <Button id="closeRouteDetails" variant="outline" onClick={()=>{setDetailsOpen(false);detailsTrigger.current?.focus()}}>상세 설정 접기</Button></div>
    </AccordionContent></AccordionItem></Accordion>
   {s.obstruction&&o.elevationMode!=='search'?<Alert><AlertTitle>현재 큐 자세가 장애물과 겹칩니다.</AlertTitle><AlertDescription>큐 들림을 고정하면 이 각도만 계산합니다. 들림도 함께 탐색하면 설정한 범위에서 큐가 겹치지 않는 자세를 찾고 실제 스트로크까지 검사합니다.</AlertDescription><Button variant="outline" onClick={()=>c.routeOption('elevationMode','search')}>큐 들림도 함께 탐색</Button></Alert>:null}
   {busy&&p?<div className="route-progress" role="status">
    <div className="progress-heading"><strong>{p.found?`물리 검증 통과 ${p.found}회 · 중복 포함`:'물리 월드에서 계산 중'}</strong><span>{fmt(value,0)}%</span></div>
    <Progress value={value} aria-label="경로 계산 진행률"/>
    <div className="progress-heading helper"><span>{p.tested}/{p.total}개 · {method(p.activeMethod)?.short||'준비'}</span><span>경과 {fmt((p.elapsedMs||0)/1000,1)}초</span></div>
    {result?.results.length?<p className="helper">끝까지 기다리지 않고 찾은 경로를 볼 수 있습니다.</p>:null}
   </div>:null}
   {['error','canceled','stale'].includes(s.routeStatus)?<Alert><AlertTitle>{s.routeStatus==='error'?'계산 오류':s.routeStatus==='stale'?'배치·조건이 바뀌었습니다':'탐색 취소'}</AlertTitle><AlertDescription>{s.routeError}</AlertDescription></Alert>:null}
   {s.routeStatus==='done'&&result&&!result.results.length?<Alert id="noRoute"><AlertTitle>{result.partial?'중단 전까지 성공 경로를 찾지 못했습니다.':'이번 탐색에서 성공 경로를 찾지 못했습니다.'}</AlertTitle><AlertDescription>‘더 넓게’를 눌러 후보 수를 늘리거나 방법을 바꿔보세요. 경로가 없다는 뜻은 아닙니다.{result.failureReasons?.['four-ball-shot-incomplete']?` 계산 구간 안에 모든 공의 정지까지 확인하지 못한 후보 ${result.failureReasons['four-ball-shot-incomplete']}개가 있습니다. 상세보기에서 계산 구간을 늘릴 수 있지만 성공을 보장하지는 않습니다.`:''}{Number.isFinite(nearest)?` 조건을 충족한 후보의 최근접 간격: ${fmt(nearest*100,1)} cm.`:''}</AlertDescription><Button id="expandSearch" variant="outline" onClick={()=>{c.routeOption('budget',o.budget===48?128:320);c.startSearch()}}>더 넓게 탐색</Button></Alert>:null}
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
