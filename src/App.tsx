import * as React from 'react'
import {Button} from '@/components/ui/button'
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from '@/components/ui/card'
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs'
import {Sidebar,SidebarContent,SidebarHeader,SidebarInset,SidebarProvider,SidebarTrigger,useSidebar} from '@/components/ui/sidebar'
import {Badge} from '@/components/ui/badge'
import {Input} from '@/components/ui/input'
import {Field,FieldGroup,FieldLabel,FieldDescription} from '@/components/ui/field'
import {SliderField,SwitchField,SelectField,OptionGroup,Separator} from '@/components/controls'
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter,DialogClose} from '@/components/ui/dialog'
import {createRoot} from 'react-dom/client'
import {Alert,AlertDescription} from '@/components/ui/alert'
import {RoutePlanner} from '@/components/route-planner'
import {CanonicalPracticeEntry} from '@/components/canonical-practice-entry'
import {CanonicalSearchGrid} from '@/components/canonical-search-grid'
import {canonicalSearchPhaseLabel} from '@/components/canonical-search-progress'
import {Icon} from '@/icons'
// A surrounding hit region forwards only clicks on its own empty padding.
// The official button, keyboard behavior and visible registry styles stay intact.
function HitTarget({children}:{children:React.ReactNode}){
 return <span className="hit-target" onClick={e=>{if(e.target===e.currentTarget){const button=e.currentTarget.querySelector('button');if(button&&!button.disabled)button.click()}}}>{children}</span>
}
const G=globalThis as any
const controller=new G.LabController()
const n=(x:number,p=2)=>Number(x||0).toFixed(p)

function TipSelector({state:s}:{state:any}){
 const moving=React.useRef(false)
 const set=(e:React.PointerEvent<HTMLDivElement>)=>{if(!s.canAim)return;const b=e.currentTarget.getBoundingClientRect();controller.changeSettings({tipX:(e.clientX-b.left-b.width/2)/(b.width/2),tipY:-(e.clientY-b.top-b.height/2)/(b.height/2)})}
 return <Card size="sm" className="inspector-section">
  <CardHeader><div className="section-heading"><CardTitle>타점</CardTitle><HitTarget><Button variant="ghost" size="sm" id="centerTip" onClick={()=>controller.changeSettings({tipX:0,tipY:0})}>중앙</Button></HitTarget></div><CardDescription>수구에서 큐가 닿는 위치를 조절합니다.</CardDescription></CardHeader>
  <CardContent className="tip-section">
   <div className="tip-wrapper"><span className="tip-up">상단</span><div id="tipDisc" role="group" aria-label="수구 타점: 좌우·상하 화살표로 조절" tabIndex={0} className="tip-disc"
    onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);moving.current=true;set(e)}} onPointerMove={e=>{if(moving.current)set(e)}} onPointerUp={()=>moving.current=false} onPointerCancel={()=>moving.current=false} onLostPointerCapture={()=>moving.current=false}
    onKeyDown={e=>{const delta=e.shiftKey?.08:.02;const a=s.settings;if(e.key==='ArrowLeft')controller.changeSettings({tipX:a.tipX-delta});else if(e.key==='ArrowRight')controller.changeSettings({tipX:a.tipX+delta});else if(e.key==='ArrowUp')controller.changeSettings({tipY:a.tipY+delta});else if(e.key==='ArrowDown')controller.changeSettings({tipY:a.tipY-delta});else return;e.preventDefault()}}>
    <div className="tip-safe"/><div className="tip-dot" style={{left:`${50+s.settings.tipX*50}%`,top:`${50-s.settings.tipY*50}%`}}/>
   </div><span className="tip-down">하단</span></div>
   <div className="tip-data"><div><span>좌우</span><strong>{s.settings.tipX<0?'좌':'우'} {n(Math.abs(s.settings.tipX)*30.75,1)} <small>mm</small></strong></div><div><span>상하</span><strong>{s.settings.tipY<0?'하':'상'} {n(Math.abs(s.settings.tipY)*30.75,1)} <small>mm</small></strong></div><span className="muted-caption">{Math.hypot(s.settings.tipX,s.settings.tipY)>.55?'가장자리 타점 · 미스큐 가능':'큐에서 바라본 공'}</span></div>
  </CardContent>
 </Card>
}
function AngleInput({id,label,value,kind,disabled}:{id:string,label:string,value:number,kind:'angle'|'elevation',disabled:boolean}){
 const [draft,setDraft]=React.useState(n(value)),[editing,setEditing]=React.useState(false),skipCommit=React.useRef(false)
 React.useEffect(()=>{if(!editing)setDraft(n(value))},[value,editing])
 const commit=()=>{if(skipCommit.current){skipCommit.current=false;setEditing(false);return;}const v=Number(draft);if(draft.trim()&&Number.isFinite(v))controller.changeSettings({[kind]:Math.round(v*100)/100});setEditing(false)}
 return <Field><div className="field-heading"><FieldLabel htmlFor={id}>{label}</FieldLabel><div className="number-with-unit"><Input id={id} aria-label={label+' 각도'} type="number" min={kind==='angle'?-180:0} max={kind==='angle'?180:85} step={.01} disabled={disabled} value={editing?draft:n(value)} onFocus={()=>{setDraft(n(value));setEditing(true)}} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){commit();e.currentTarget.blur()}else if(e.key==='Escape'){skipCommit.current=true;setDraft(n(value));setEditing(false);e.currentTarget.blur()}else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const delta=(e.key==='ArrowUp'?1:-1)*(e.shiftKey?.1:.01);const v=Number(draft);const target=(Number.isFinite(v)?v:value)+delta;controller.changeSettings({[kind]:target});setDraft(n(Math.max(kind==='angle'?-180:0,Math.min(kind==='angle'?180:85,target))))}}}/><span>°</span></div></div>
 <div className="angle-nudges">{[-.1,-.01,.01,.1].map(delta=><Button key={delta} size="sm" variant="outline" disabled={disabled} aria-label={label+' '+(delta>0?'+':'')+delta+'도'} onClick={()=>controller.adjustAngle(kind,delta)}>{delta>0?'+':'−'}{Math.abs(delta)}°</Button>)}</div></Field>
}
function PrecisionControls({state:s}:{state:any}){
 return <FieldGroup>
  <AngleInput id="elevationNumber" label="큐 기울기" value={s.settings.elevation} kind="elevation" disabled={s.activeStroke}/>
  <Field><SliderField label="큐 기울기" id="elevation" value={s.settings.elevation} min={0} max={85} step={.01} onChange={elevation=>controller.changeSettings({elevation})} disabled={s.activeStroke}/></Field>
  <Field><div className="field-heading"><FieldLabel htmlFor="cueSpeed">타격 세기</FieldLabel><output>{n(s.settings.speed)} m/s</output></div><SliderField label="큐 초기 속도" id="cueSpeed" value={s.settings.speed} min={.25} max={5} step={.05} onChange={speed=>controller.changeSettings({speed})} disabled={s.activeStroke}/><div className="scale"><span>부드럽게</span><span>{n(.27*s.settings.speed*s.settings.speed)} J</span><span>강하게</span></div></Field>
  <AngleInput id="angle" label="조준 방향" value={s.settings.angle} kind="angle" disabled={s.activeStroke}/>
  <FieldDescription>0.01° 단위 입력 · Alt + 드래그: 미세 조준</FieldDescription>
 </FieldGroup>
}
function positionDraftChanged(draft:string,initial:string,precise:boolean){return !precise||draft!==initial}
function PositionInput({id,label,value,onCommit,min,max,disabled,precise=false}:{id:string;label:string;value:number;onCommit:(value:number)=>void;min?:number;max?:number;disabled:boolean;precise?:boolean}){
 const format=(v:number)=>precise?String(v):n(v,1)
 const [draft,setDraft]=React.useState(format(value)),[editing,setEditing]=React.useState(false),skipCommit=React.useRef(false),initialDraft=React.useRef(format(value))
 const finish=()=>{if(skipCommit.current){skipCommit.current=false;setEditing(false);return;}const v=Number(draft);if(positionDraftChanged(draft,initialDraft.current,precise)&&draft.trim()&&Number.isFinite(v)&&(min===undefined||v>=min)&&(max===undefined||v<=max))onCommit(v);setEditing(false)}
 return <Field><FieldLabel htmlFor={id}>{label}</FieldLabel><Input id={id} type="number" inputMode="decimal" step={precise?'any':'.5'} min={min} max={max} disabled={disabled} value={editing?draft:format(value)}
  onFocus={()=>{skipCommit.current=false;initialDraft.current=format(value);setDraft(initialDraft.current);setEditing(true)}} onChange={e=>setDraft(e.target.value)} onBlur={finish}
  onKeyDown={e=>{if(e.key==='Enter'){e.currentTarget.blur()}else if(e.key==='Escape'){e.preventDefault();skipCommit.current=true;setDraft(format(value));setEditing(false);e.currentTarget.blur()}}}/></Field>
}
function Placement({state:s}:{state:any}){
 const o=s.objects.find((o:any)=>o.id===s.selectedId),canonical=!!s.canonicalPlayback
 if(!o)return null
 return <section className="settings-section" id="placement" tabIndex={-1} aria-labelledby="placement-title"><div className="section-heading"><h2 id="placement-title">배치·물체</h2><span>{o.label}</span></div><Field><FieldLabel htmlFor="placementObject">편집할 물체</FieldLabel><SelectField id="placementObject" aria-label="편집할 물체" value={s.selectedId} onChange={(e:any)=>controller.select(Number(e.target.value))}>{s.objects.map((item:any)=><option key={item.id} value={item.id}>{item.label}</option>)}</SelectField></Field><div className="advanced-body"><FieldGroup>
  <div className="coordinates">{[['X','x'],['Z','z']].map(([label,key])=><PositionInput key={key} id={'pos'+label} label={label+' · cm'} value={o.pos[key]*100} precise={canonical} disabled={!s.ready||s.activeStroke||(canonical&&!s.canAim)} onCommit={v=>controller.setPosition({[key]:v/100})}/>)}{!canonical?<PositionInput id="posY" label="높이 · cm" min={0} max={150} value={Math.max(0,s.height)} disabled={!s.ready||s.activeStroke} onCommit={v=>controller.setHeight(v)}/>:null}</div>
  {!canonical?<Field><FieldLabel htmlFor="height">들어 올리기</FieldLabel><SliderField label="물체 들어 올리기" id="height" min={0} max={70} step={.5} value={Math.max(0,Math.min(70,s.height))} onChange={h=>controller.setHeight(h)}/></Field>:null}
 </FieldGroup>{canonical?<p id="canonicalPlacementScope" className="helper">공을 드래그하거나 X/Z 좌표로 옮길 수 있습니다. 좌표는 Q24 (1/16,777,216 m) 격자로 반올림됩니다. 겹침·쿠션 경계 여유를 보수적으로 검사하며, 충분한 간격을 확인할 수 없는 배치는 거부합니다. 배치 변경은 이전 탐색 후보를 무효화합니다. 높이·공 추가/삭제·재질·게임 모드 변경은 지원하지 않습니다.</p>:<><div className="action-row"><Button size="sm" variant="outline" id="drop" onClick={()=>controller.pause(false)}>놓기</Button><Button size="sm" variant="outline" id="putOnTable" onClick={()=>controller.setHeight(0)}>천 위로</Button><Button size="sm" variant="ghost" id="remove" aria-label="선택 물체 삭제" disabled={s.objects.length<2} onClick={()=>controller.remove()}><Icon name="trash" data-icon="inline-start"/></Button></div><div className="action-row"><Button size="sm" variant="secondary" id="addBall" onClick={()=>controller.add('sphere')}><Icon name="plus" data-icon="inline-start"/>공 추가</Button><Button size="sm" variant="secondary" id="addBox" onClick={()=>controller.add('box')}>블록 추가</Button></div></>}</div></section>
}
const parameters=[['clothFriction','천 마찰',0,.6,.01,1],['cushionRestitution','쿠션 반발',0,1,.01,1],['cushionFriction','쿠션 마찰',0,.6,.01,1],['ballRestitution','공 반발',0,1,.01,1],['ballFriction','공 마찰',0,.3,.01,1],['tipFriction','팁 마찰',0,1,.01,1],['gravity','중력',0,20,.1,1],['rollingLength','구름 저항 · mm',0,2,.01,1000],['spinLength','회전 저항 · mm',0,2,.01,1000]] as const
function MaterialSettings({state:s}:{state:any}){
 if(s.canonicalPlayback)return <section className="settings-section" id="materials"><h2>물리 재질</h2><p className="helper">Canonical 모델의 고정 재질을 사용합니다. 이 모드에서 재질 변경은 지원하지 않습니다.</p></section>
 return <section className="settings-section" id="materials" tabIndex={-1} aria-labelledby="materials-title"><div className="section-heading"><h2 id="materials-title">물리 재질</h2><span>9개 항목</span></div><div className="advanced-body"><FieldGroup>{parameters.map(([key,label,min,max,step,factor])=><Field key={key}><div className="field-heading"><FieldLabel htmlFor={'p-'+key}>{label}</FieldLabel><output>{n(s.params[key]*factor)}</output></div><SliderField label={label} id={'p-'+key} min={min} max={max} step={step} value={s.params[key]*factor} onChange={v=>controller.params({[key]:v/factor})}/></Field>)}</FieldGroup></div></section>
}
function HelpDialog({open,onOpenChange}:{open:boolean;onOpenChange:(value:boolean)=>void}){
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="help-dialog"><DialogHeader><DialogTitle>큐를 직접 움직이세요</DialogTitle><DialogDescription>큐 조작, 경로 탐색, 물리 모델 안내</DialogDescription></DialogHeader><dl><dt>조준</dt><dd>공 앞쪽 조준선을 드래그해 조준합니다. 당구대의 빈 곳을 누르면 선택한 공에서 그 방향으로 조준합니다. 큐 자체를 잡아 움직이면 공 반대쪽에서 조준할 수 있습니다.</dd><dt>타격</dt><dd>수동 탭에서 세기와 타점을 정하고 당구대 아래 ‘타격’을 누릅니다. 큐 드래그는 조준만 바꾸며 공을 발사하지 않습니다.</dd><dt>기울기</dt><dd>수동 탭에서 큐 기울기를 조절합니다. Alt 또는 미세 조준을 사용하면 감도가 낮아집니다.</dd><dt>공 이동</dt><dd>별도 모드 선택 없이 공을 잡고 옮깁니다. 이동 도중 Esc, 이동 취소, 두 손가락 터치 또는 화면 이탈은 원래 위치로 돌립니다.</dd><dt>되돌리기</dt><dd>한 번의 드래그를 한 번에 되돌릴 수 있습니다. ‘다시 실행’은 되돌린 조작을 복원합니다. 새 조작을 하면 다시 실행 기록은 지워집니다. 키보드에서는 Ctrl/⌘+Z, Shift+Ctrl/⌘+Z를 사용합니다.</dd><dt>시점</dt><dd>당구대 바깥 바닥을 드래그하면 시점이 바뀝니다. 휠 또는 두 손가락 벌리기로 확대하고 화면 맞춤으로 복원합니다.</dd><dt>타격 후</dt><dd>공이 멈출 때까지 큐는 대기합니다. 4구 점수 판정 중에는 공을 옮길 수 없습니다. 되돌리기로 타격을 취소할 수 있습니다.</dd></dl><Separator/><p>실제 3D 강체 접촉으로 공의 속도와 회전을 계산합니다. 예상 궤적도 같은 물리 모델을 사용합니다.</p><p className="muted-caption">강체 근사 모델이며 실제 장비로 보정한 정밀 예측기는 아닙니다. 큐의 휨과 팁 탄성은 집중정수 근사이며 실측 보정하지 않았습니다. 천·쿠션의 세부 변형은 미모델링입니다. 원근 투영은 화면 표현만 변경합니다.</p><DialogFooter><DialogClose render={<Button />}>닫기</DialogClose></DialogFooter></DialogContent></Dialog>
}
function Workspace(){
 const s:any=React.useSyncExternalStore(controller.subscribe,controller.snapshot)
 const scene=React.useRef<HTMLCanvasElement>(null)
 const panelScroll=React.useRef<HTMLDivElement>(null)
 const {open:sidebarOpen,setOpen:setSidebarOpen,openMobile:mobileOpen,setOpenMobile:setMobileOpen,isMobile}=useSidebar()
 const [helpOpen,setHelpOpen]=React.useState(false)
 React.useEffect(()=>{const media=matchMedia('(max-width:1099px)');const changed=()=>{if(media.matches)setSidebarOpen(false)};media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed)},[setSidebarOpen])
 const scrollPositions=React.useRef<Record<string,number>>({shot:0,routes:0,settings:0})
 const changePanel=(value:unknown)=>{
  if(!['shot','routes','settings'].includes(String(value)))return
  if(panelScroll.current)scrollPositions.current[s.activePanel]=panelScroll.current.scrollTop
  controller.option('activePanel',String(value))
 }
 React.useEffect(()=>{controller.dirty=true},[sidebarOpen,mobileOpen])
 const attachPanelScroll=React.useCallback((element:HTMLDivElement|null)=>{panelScroll.current=element;if(element)element.scrollTop=scrollPositions.current[s.activePanel]||0},[s.activePanel])
 React.useEffect(()=>{if(scene.current)controller.mount(scene.current,null,{});return()=>controller.dispose()},[])
 React.useEffect(()=>{panelScroll.current?.scrollTo({top:scrollPositions.current[s.activePanel]||0});controller.dirty=true},[s.activePanel])
 const selected=s.objects.find((o:any)=>o.id===s.selectedId)
 const disabled=!s.ready||!s.canAim||!!s.activeStroke||!!s.obstruction||selected?.shape!=='sphere'
 return <div className="app-shell">
   <Sidebar className="toolbox" id="toolbox" aria-label="게임과 타격 설정" collapsible="offcanvas">
    <SidebarHeader className="toolbox-heading">
     <div className="section-heading"><div><span className="muted-caption">연습 메뉴</span></div><Button variant="ghost" size="icon" aria-label="설정 패널 닫기" onClick={()=>{setMobileOpen(false);setSidebarOpen(false)}}><Icon name="x"/></Button></div>
    </SidebarHeader>
    <Tabs className="toolbox-tabs" value={s.activePanel} onValueChange={changePanel}>
     <div className="toolbox-nav"><TabsList activateOnFocus id="panelGroup" aria-label="설정 패널" className="grid w-full grid-cols-3">
      <TabsTrigger value="routes" id="tab-routes">경로 탐색</TabsTrigger>
      <TabsTrigger value="shot" id="tab-shot">수동</TabsTrigger>
      <TabsTrigger value="settings" id="tab-settings">설정</TabsTrigger>
     </TabsList></div>
     <SidebarContent className="panel-scroll" id="panelScroll" ref={attachPanelScroll} onScroll={e=>{scrollPositions.current[s.activePanel]=e.currentTarget.scrollTop}}>
     <TabsContent value="shot" id="shotPanel" className="tool-panel" aria-label="수동 설정">


      {s.game?<Card size="sm" className="game-score" aria-label={s.gameMode==='four'?'4구 점수':'3구 점수'}><CardHeader><CardTitle>{s.gameMode==='four'?'4구 점수':'3구 점수'}</CardTitle><CardDescription>연습 규칙 · 현재 차례 {s.objects.find((o:any)=>o.id===s.game.activeCue)?.label}</CardDescription></CardHeader><CardContent><div className="score-row"><strong>흰 수구 {s.game.scores[s.game.cueIds[0]]}</strong><strong>노란 수구 {s.game.scores[s.game.cueIds[1]]}</strong></div><p role="status">{s.game.pending?'타격 판정 중':s.game.lastResult}</p><p className="helper">{s.gameMode==='four'?<>{(s.game.pending?.threeCushion??s.routeOptions.fourBallThreeCushion)?'두 번째 적구 명중 전 3쿠션 + 두 적구 +1':'두 적구 +1'} · 상대 수구 접촉/수구 장외 −1 · 실패 시 교대. 음수 허용, 종료 점수 없는 연습입니다. 수구는 직접 바꿀 수 있습니다. 규격은 기존 캐롬 실험 설정을 유지합니다.</>:<>두 번째 목적구 명중 전 3쿠션 + 나머지 두 공 접촉 +1. 득점 시 차례 유지, 실패·장외 시 차례 교대.</>}</p></CardContent></Card>:null}
      <FieldGroup><Field><FieldLabel>타격할 공</FieldLabel>
      <OptionGroup id="ballChoices" label="선택 물체" value={String(s.selectedId)} onChange={id=>controller.select(Number(id))} options={s.objects.filter((o:any)=>!s.game||s.game.cueIds.includes(o.id)).map((o:any)=>({value:String(o.id),label:<><i className="ball-dot" style={{background:o.color}}/>{o.label}</>}))}/></Field></FieldGroup>
      <TipSelector state={s}/><Separator/>
      <SwitchField id="fineAim" checked={s.fineAim} onChange={v=>controller.option('fineAim',v)} label="미세 조준"/><PrecisionControls state={s}/><CanonicalSearchGrid state={s} controller={controller}/>

      {s.obstruction?<Alert id="strikeWarning"><AlertDescription>큐가 {s.obstruction}에 닿습니다. 기울기나 조준을 바꾸세요.</AlertDescription></Alert>:null}
      <p className="helper">미세 조준을 켜면 드래그 감도가 낮아집니다. 숫자와 ± 버튼은 0.01° 단위입니다.</p><Separator/><Placement state={s}/>
     </TabsContent>
     <TabsContent value="routes" id="routesPanel" className="tool-panel route-panel" aria-label="경로 탐색">      {s.canonicalPlayback?<p className="helper">현재 게임 모드는 고정됩니다. 모드 변경은 지원하지 않습니다.</p>:<Field><FieldLabel>게임 모드</FieldLabel><OptionGroup id="gameMode" label="게임 모드" value={s.gameMode} onChange={mode=>controller.setGameMode(mode)} options={[{value:'free',label:'3구'},{value:'four',label:'4구'}]}/><FieldDescription>모드를 변경하면 배치와 점수가 초기화됩니다. 4구는 연습 규칙입니다.</FieldDescription></Field>}<RoutePlanner state={s} controller={controller}/></TabsContent>
     <TabsContent value="settings" id="settingsPanel" className="tool-panel" aria-label="시뮬레이션 설정">
      <section className="settings-section" id="preview-settings" tabIndex={-1} aria-labelledby="preview-settings-title">
      <div className="section-heading"><h2 id="preview-settings-title">표시·재생</h2></div><FieldGroup>
       <SwitchField id="predict" checked={s.predict} onChange={v=>controller.option('predict',v)} label="예상 궤적"/>
       <Field><FieldLabel htmlFor="horizon">예측할 시간</FieldLabel><SelectField aria-label="예측 시간" id="horizon" value={s.horizon} onChange={(e:any)=>controller.option('horizon',Number(e.target.value))}>{[4,8,16,30].map(v=><option value={v} key={v}>{v}초</option>)}</SelectField></Field>
       <Field><FieldLabel htmlFor="speed">재생 속도</FieldLabel><SelectField aria-label="재생 속도" id="speed" value={s.rate} onChange={(e:any)=>controller.option('rate',Number(e.target.value))}>{[.25,.5,1,2,4].map(v=><option key={v} value={v}>{v}×</option>)}</SelectField></Field>
       <SwitchField id="showCue" label="조준 큐 표시" checked={s.showCue} onChange={v=>controller.option('showCue',v)}/><SwitchField id="paths" label="실제 이동 궤적" checked={s.paths} onChange={v=>controller.option('paths',v)}/><SwitchField id="allPaths" label="모든 타격 경로 보기" checked={s.allPaths} onChange={v=>controller.option('allPaths',v)}/><FieldDescription>실제 이동 궤적은 기본적으로 숨겨집니다. 켜면 직전 타격의 경로를 표시합니다. 모든 경로 보기는 현재 보관된 이전 타격도 함께 표시합니다. 공별 최근 4,000개 경로 지점까지 보관합니다.</FieldDescription><SwitchField id="wire" label="충돌 형상" checked={s.debug} onChange={v=>controller.option('debug',v)}/><SwitchField id="vectors" label="속도 벡터" checked={s.vectors} onChange={v=>controller.option('vectors',v)}/>
       <dl className="live-state" aria-label="현재 물리 상태"><div><dt>속력</dt><dd id="statSpeed">{n(s.speed)} m/s</dd></div><div><dt>회전</dt><dd id="statSpin">{n(s.spin,0)} rpm</dd></div><div><dt>공 하단 높이</dt><dd id="statHeight">{n(s.height,1)} cm</dd></div><div><dt>누적 타격</dt><dd id="statShots">{s.shots}회</dd></div></dl><div className="action-row"><Button id="clearTrails" variant="outline" onClick={()=>controller.clearTrails()}>궤적 지우기</Button></div>
      </FieldGroup></section><Separator/><MaterialSettings state={s}/><Separator/>
      <section id="contacts" className="settings-section contact-log" tabIndex={-1} aria-labelledby="contacts-title"><div className="section-heading"><h2 id="contacts-title">접촉 기록</h2><span>{s.events.length}개</span></div><div>{s.events.length?s.events.map((e:any,i:number)=><p key={i}><time>{n(e.time)}s</time> {e.label}</p>):<p>타격 후 접촉을 기록합니다.</p>}</div></section>
      <p className="helper">동일한 물리 모델로 타격과 예상 경로를 계산합니다.<br/>실측 보정되지 않은 강체·접촉 근사 모델입니다.</p>
      <p className="helper"><a href="./guide.html" target="_blank" rel="noopener">3구·삼구·4구·사구·3쿠션 연습 안내 (새 탭)</a></p>
     </TabsContent>

     <span className="forecast-status" id="forecastStatus" title={s.forecastStatus} aria-live="polite">{s.routeStatus==='searching'?(s.canonicalPlayback?canonicalSearchPhaseLabel(s.routeProgress):`제약식 계산 · 물리 평가 ${s.routeProgress?.evaluated||0}회`):s.predictionBusy?'예측 중…':s.forecastStatus}</span>
     <section className="panel-utility" aria-label="기록 및 도움말"><Separator/><p className="muted-caption">기록 및 도움말</p><div className="action-row"><Button id="undo" variant="outline" size="sm" disabled={!s.undo} onClick={()=>controller.undo()}><Icon name="undo" data-icon="inline-start"/>되돌리기</Button><Button id="redo" variant="outline" size="sm" disabled={!s.redo} onClick={()=>controller.redo()}>다시 실행</Button><Button id="reset" variant="outline" size="sm" disabled={!!s.canonicalPlayback?.deviceLost} title={s.canonicalPlayback?'처음 GPU 게임 배치·점수·타격 설정으로 돌아가고 기록을 지웁니다. 탐색 조합은 유지합니다. GPU 장치 손실은 복구하지 않습니다.':undefined} onClick={()=>controller.reset()}><Icon name="reset" data-icon="inline-start"/>초기화</Button><Button variant="ghost" size="icon" aria-label="조작 도움말" onClick={()=>setHelpOpen(true)}><Icon name="info"/></Button></div></section>
     </SidebarContent>
    </Tabs>

   </Sidebar>
   <SidebarInset className="scene-inset">
    <header className="workspace-header"><div className="sidebar-opener"><HitTarget><SidebarTrigger id="sidebarTrigger" aria-label={(isMobile?mobileOpen:sidebarOpen)?"설정 패널 닫기":"설정 패널 열기"} aria-expanded={isMobile?mobileOpen:sidebarOpen}/></HitTarget><h1>당구 연습</h1></div></header>
    <section id="stagePreview" className="stage-region" aria-label="당구대와 직접 조작">
     <div className="stage-toolbar">
      <CanonicalPracticeEntry state={s} controller={controller}/>
      <div className="view-controls"><OptionGroup id="viewGroup" label="카메라 시점" value={s.view||'3d'} onChange={v=>controller.view(v)} options={[{value:'top',label:'상단'},{value:'3d',label:'3D'},{value:'side',label:'측면'}]}/></div>
      <div className="zoom-tools"><HitTarget><Button variant="outline" size="icon" aria-label="축소" onClick={()=>controller.zoom(1.12)}><Icon name="minus"/></Button></HitTarget><HitTarget><Button variant="outline" size="icon" id="fit" aria-label="화면 맞춤" onClick={()=>controller.fit()}><Icon name="frame"/></Button></HitTarget><HitTarget><Button variant="outline" size="icon" aria-label="확대" onClick={()=>controller.zoom(1/1.12)}><Icon name="plus"/></Button></HitTarget></div>

     </div>
      <div className="viewport" id="viewport">
       <canvas ref={scene} id="scene" tabIndex={0} aria-label="공 앞 조준선을 드래그해 조준 · 바닥을 드래그해 시점 회전 · 공을 드래그해 이동. 빈 당구대 클릭은 전방 조준, 큐 드래그는 반대쪽 조준, 두 손가락은 확대입니다."/>
       <div className="viewport-meta"><span className="path-legend"><i/>예상 궤적</span><Badge variant="secondary">{s.activeStroke?'타격 중':s.canAim?'준비':s.paused?'일시정지':'운동 중'}</Badge></div>
       <div className="viewport-guide">{s.gesture||'앞 조준선 드래그로 조준 · 바닥 드래그로 시점'}</div>
     {s.gesture==='공을 옮기는 중 · Esc 취소'?<div className="gesture-cancel"><Button variant="outline" id="cancelGesture" onPointerDown={e=>{e.preventDefault();controller.cancelGesture()}} onClick={()=>controller.cancelGesture()}>이동 취소</Button></div>:null}
       {!s.ready?<div className="loading"><Icon name="cube"/><strong>{s.engineError?'초기화 오류':'물리 월드 준비 중'}</strong><p>{s.engineError||'Rapier 3D'}</p></div>:null}
      </div>

     <div className="scene-action" aria-label="당구대 타격"><span className="shot-counter">{s.shots}회 · {n(s.time,1)}s</span><HitTarget><Button id="strike" disabled={disabled} onClick={()=>controller.fire()}><Icon name="arrow" data-icon="inline-start"/>타격</Button></HitTarget></div>

    </section>
   </SidebarInset>
  <HelpDialog open={helpOpen} onOpenChange={setHelpOpen}/>{s.notice?<div className="notice-wrap"><Alert role="status" aria-live="polite"><AlertDescription>{s.notice}</AlertDescription></Alert></div>:null}
 </div>
}
function App(){return <SidebarProvider defaultOpen={window.innerWidth>=1100} className="workspace-shell" style={{'--sidebar-width':'22rem'} as React.CSSProperties}><Workspace/></SidebarProvider>}
createRoot(document.getElementById('app')!).render(<App/>);
