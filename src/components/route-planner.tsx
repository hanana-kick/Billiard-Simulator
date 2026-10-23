import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Field, FieldLabel, FieldGroup, FieldDescription, FieldSet, FieldLegend } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { InspectorSection } from '@/components/inspector-section'
import { SelectField, SwitchField, OptionGroup } from '@/components/controls'
import { Icon } from '@/icons'
const G=globalThis as any
const fmt=(v:number,n=2)=>Number(v||0).toFixed(n)
type Method={id:string;label:string;short:string;description:string;rule:string}
export function RoutePlanner({state:s,controller:c}:{state:any;controller:any}){
 const o=s.routeOptions,busy=s.routeStatus==='searching',result=s.routeResult,p=s.routeProgress
 const catalog:Method[]=G.LabRouteRules.catalog
 const balls=s.objects.filter((b:any)=>b.shape==='sphere'&&b.id!==s.selectedId)
 const ids:string[]=o.mode==='direct'?['direct']:o.methods
 const invalid=balls.length<2||o.targetId===o.secondId||!balls.some((b:any)=>b.id===o.targetId)||!balls.some((b:any)=>b.id===o.secondId)||!ids.length
 const canSearch=s.ready&&s.canAim&&!busy&&!invalid&&!s.activeStroke
 const method=(id:string)=>G.LabRouteRules.byId.get(id) as Method
 const label=(id:number)=>s.objects.find((b:any)=>b.id===id)?.label||String(id)
 const change=(key:string)=>(e:any)=>c.routeOption(key,['targetId','secondId','budget','horizon'].includes(key)?Number(e.target.value):e.target.value)
 const value=p?Math.min(100,(p.tested+(p.fraction||0))/Math.max(1,p.total)*100):0
 const nearest=Math.min(...(p?.methods||[]).map((m:any)=>m.nearestGap??Infinity))
 return <Card id="routePlanner" className="route-card">
  <CardHeader><CardTitle>경로 찾기</CardTitle><CardDescription>현재 배치에서 가능한 타격을 탐색합니다.</CardDescription></CardHeader>
  <CardContent className="route-content">
   <FieldGroup>
    <Field><FieldLabel className="sr-only">타격 목표</FieldLabel><OptionGroup id="routeMode" label="타격 목표" value={o.mode} onChange={v=>c.routeOption('mode',v)} options={[{value:'direct',label:'두 공 직접'},{value:'three',label:'3쿠션'}]}/></Field>
    <div className="route-form">
     <Field><FieldLabel htmlFor="routeTarget">목적구 A</FieldLabel><SelectField id="routeTarget" aria-label="목적구 A" value={o.targetId} onChange={change('targetId')}>{balls.map((b:any)=><option key={b.id} value={b.id}>{b.label}</option>)}</SelectField></Field>
     <Field><FieldLabel htmlFor="routeSecond">목적구 B</FieldLabel><SelectField id="routeSecond" aria-label="목적구 B" value={o.secondId} onChange={change('secondId')}>{balls.filter((b:any)=>b.id!==o.targetId).map((b:any)=><option key={b.id} value={b.id}>{b.label}</option>)}</SelectField></Field>
    </div>
   </FieldGroup>
   <div className="route-actions">
    {busy?<Button id="cancelRoute" variant="outline" onClick={()=>c.stopSearch()}>중단 · 찾은 경로 유지</Button>:<Button id="findRoute" disabled={!canSearch} onClick={()=>c.startSearch()}><Icon name="crosshair" data-icon="inline-start"/>{result?'다시 계산':'경로 계산'}</Button>}
    <span className="helper">{invalid?'서로 다른 목적구와 방법을 선택하세요.':!s.canAim&&!busy?'공이 멈춘 뒤 계산합니다.':o.mode==='direct'?'쿠션 없이 두 공 맞히기':o.methods.length===1&&o.methods[0]==='any'?'빠른 3쿠션 탐색':`${ids.length}가지 방법 탐색`}</span>
   </div>
   {busy&&p?<div className="route-progress" role="status">
    <div className="progress-heading"><strong>{p.found?`성공 후보 ${p.found}개 발견`:'물리 월드에서 계산 중'}</strong><span>{fmt(value,0)}%</span></div>
    <Progress value={value} aria-label="경로 계산 진행률"/>
    <div className="progress-heading helper"><span>{p.tested}/{p.total}개 · {method(p.activeMethod)?.short||'준비'}</span><span>경과 {fmt((p.elapsedMs||0)/1000,1)}초</span></div>
    {result?.results.length?<p className="helper">끝까지 기다리지 않고 찾은 경로를 볼 수 있습니다.</p>:null}
   </div>:null}
   {['error','canceled','stale'].includes(s.routeStatus)?<Alert><AlertTitle>{s.routeStatus==='error'?'계산 오류':s.routeStatus==='stale'?'배치·조건이 바뀌었습니다':'탐색 취소'}</AlertTitle><AlertDescription>{s.routeError}</AlertDescription></Alert>:null}
   {s.routeStatus==='done'&&result&&!result.results.length?<Alert id="noRoute"><AlertTitle>{result.partial?'중단 전까지 성공 경로를 찾지 못했습니다.':'이번 탐색에서 성공 경로를 찾지 못했습니다.'}</AlertTitle><AlertDescription>‘더 넓게’를 눌러 후보 수를 늘리거나 방법을 바꿔보세요. 경로가 없다는 뜻은 아닙니다.{Number.isFinite(nearest)?` 조건을 충족한 후보의 최근접 간격: ${fmt(nearest*100,1)} cm.`:''}</AlertDescription><Button id="expandSearch" variant="outline" onClick={()=>{c.routeOption('budget',o.budget===48?128:320);c.startSearch()}}>더 넓게 탐색</Button></Alert>:null}
   {result?.results?.length?<div className="route-results" aria-label="성공 경로">
    {result.partial&&!busy?<p className="helper">중단 전 발견한 검증 완료 후보입니다.</p>:null}
    {result.results.map((r:any,i:number)=><Card key={r.id} size="sm" className="route-result" data-applied={s.routeApplied===r.id}>
     <CardHeader><div className="route-result-header"><CardTitle>{r.method==='any'?(method(r.matchedMethods?.find((m:string)=>m!=='any')||'any')?.short):method(r.method)?.short}</CardTitle><Badge variant="secondary">{r.cushions}쿠션</Badge></div><CardDescription>{label(r.firstId)} → {label(r.secondId)} · {fmt(r.distance)} m</CardDescription></CardHeader>
     <CardContent><dl className="route-values"><div><dt>조준</dt><dd>{fmt(r.settings.angle,3)}°</dd></div><div><dt>큐 속도</dt><dd>{fmt(r.settings.speed)} m/s</dd></div><div><dt>도달</dt><dd>{fmt(r.seconds)} s</dd></div></dl><p className="route-sequence">{r.contacts.map((e:any)=>e.label.replace('쪽 쿠션',' 쿠션')).join(' → ')}</p></CardContent>
     <CardFooter><Button id={'applyRoute'+r.id} disabled={!['done','searching'].includes(s.routeStatus)} variant={i===0?'default':'outline'} onClick={()=>c.applyRoute(r.id)}>{s.routeApplied===r.id?'적용됨':'경로 보기·적용'}</Button></CardFooter>
    </Card>)}
   </div>:null}
   <InspectorSection id="routeMethods" title={o.mode==='three'?`방법 선택 · ${ids.length}개`:'직접 맞히기 조건'} className="route-settings">
    {o.mode==='three'?<FieldSet><FieldLegend className="sr-only">계산할 방법</FieldLegend>
     <ToggleGroup multiple value={o.methods} onValueChange={v=>c.routeOption('methods',v)} aria-label="3쿠션 방법 다중 선택" variant="outline" size="default" spacing={2} className="method-picker">{catalog.map(m=><ToggleGroupItem key={m.id} value={m.id} title={m.rule}>{m.id==='any'?'자유 경로':m.short}</ToggleGroupItem>)}</ToggleGroup>
     <div className="method-definitions">{catalog.filter(m=>o.methods.includes(m.id)).map(m=><p key={m.id}><strong>{m.short}</strong><span>{m.description}</span></p>)}</div>
     <FieldDescription>이름보다 표시된 접촉 순서로 판정합니다. 돌리기는 앞·뒤·옆 계열을 묶은 3면 경로입니다.</FieldDescription>
    </FieldSet>:<p className="helper">두 공을 모두 맞힐 때까지 수구의 쿠션 접촉이 0회인 후보만 성공입니다.</p>}
   </InspectorSection>
   <InspectorSection id="routeAdvanced" title="탐색 설정" className="route-settings"><FieldGroup>
    <Field><FieldLabel htmlFor="routeOrder">맞히는 순서</FieldLabel><SelectField id="routeOrder" aria-label="목적구 순서" value={o.order} onChange={change('order')}><option value="either">양쪽 순서 모두</option><option value="fixed">A → B 고정</option></SelectField></Field>
    <div className="route-form"><Field><FieldLabel htmlFor="routeBudget">방법별 후보</FieldLabel><SelectField id="routeBudget" aria-label="방법별 후보 수" value={o.budget} onChange={change('budget')}><option value={48}>빠르게 · 48</option><option value={128}>표준 · 128</option><option value={320}>넓게 · 320</option></SelectField></Field><Field><FieldLabel htmlFor="routeHorizon">계산 구간</FieldLabel><SelectField id="routeHorizon" aria-label="후보당 계산 시간" value={o.horizon} onChange={change('horizon')}><option value={8}>8초</option><option value={16}>16초</option><option value={30}>30초</option></SelectField></Field></div>
    <Field><FieldLabel htmlFor="routeObjective">추천 기준</FieldLabel><SelectField id="routeObjective" aria-label="추천 기준" value={o.objective} onChange={change('objective')}><option value="shortest">짧은 이동거리</option><option value="gentle">낮은 타격 세기</option></SelectField></Field>
    <SwitchField id="routeSpin" checked={o.spin} onChange={v=>c.routeOption('spin',v)} label="타점도 함께 탐색"/>
    <FieldDescription>큐 기울기는 현재 {fmt(s.settings.elevation)}°로 고정합니다. 양쪽 순서를 선택하면 후보를 나눠 계산합니다.</FieldDescription>
   </FieldGroup></InspectorSection>
   {(p?.methods?.length||0)>1?<InspectorSection title="방법별 진행"><div className="method-status">{p.methods.map((m:any)=><div key={m.id}><span>{method(m.id)?.short}</span><span>{m.tested}/{m.total}</span><Badge variant="outline">{m.found?`${m.found}개`:'탐색'}</Badge></div>)}</div></InspectorSection>:null}
  </CardContent>
  <CardFooter><p className="helper">모든 후보는 같은 물리엔진으로 확인합니다. 찾은 후보 중 최선이며, 전역 최적해·실물 명중 보장은 아닙니다.</p></CardFooter>
 </Card>
}
