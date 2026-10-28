import * as React from 'react'
import {Button} from '@/components/ui/button'
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from '@/components/ui/card'
import {Field,FieldGroup,FieldLabel,FieldDescription} from '@/components/ui/field'
import {Input} from '@/components/ui/input'
import {Alert,AlertDescription} from '@/components/ui/alert'
import {CANONICAL_SEARCH_AXES,CANONICAL_SEARCH_RANGES} from '@/direct-candidate/canonical-search-domain.mjs'
import {canonicalGridDraft,parseCanonicalGridDraft} from './canonical-search-grid-draft.mjs'
const axes=CANONICAL_SEARCH_AXES as readonly (readonly string[])[]
const labels={angles:'수평 조준 (°)',speeds:'큐 속도 (m/s)',elevations:'수직 들림 (°)',tipXs:'타점 X',tipYs:'타점 Y'}

export function CanonicalSearchGrid({state,controller}:{state:any;controller:any}){
 if(!state.canonicalPlayback?.searchDomain?.parameterGrid)return null
 return <GridEditor state={state} controller={controller}/>
}
function GridEditor({state:s,controller:c}:{state:any;controller:any}){
 const domain=s.canonicalPlayback.searchDomain,current=canonicalGridDraft(domain.parameterGrid),key=JSON.stringify(current)
 const [draft,setDraft]=React.useState(current),[error,setError]=React.useState(''),[notice,setNotice]=React.useState('')
 React.useEffect(()=>{setDraft(current);setError('');setNotice('')},[key])
 const validation=React.useMemo(()=>{try{return {domain:parseCanonicalGridDraft(draft,domain.maximumCandidates??4096),error:''}}catch(e){return {domain:null,error:e.message}}},[draft,domain.maximumCandidates])
 const dirty=JSON.stringify(draft)!==key,blocked=!s.ready||!s.canAim||!s.paused||!!s.activeStroke
 const apply=()=>{if(blocked||!dirty||!validation.domain)return;try{c.updateCanonicalSearchGrid({parameterGrid:validation.domain.parameterGrid});setError('');setNotice('탐색 조합을 적용했습니다. 경로 탐색 탭에서 계산하세요.')}catch(e){setError(e.message??String(e))}}
 const cancel=()=>{setDraft(current);setError('');setNotice('')}
 return <Card id="canonicalSearchGrid" size="sm">
  <CardHeader><CardTitle>GPU 탐색 입력 조합</CardTitle><CardDescription>쉼표로 구분한 각 축의 값으로 유한 조합을 만듭니다. 입력만으로 공이나 타격 설정은 바뀌지 않습니다.</CardDescription></CardHeader>
  <CardContent><FieldGroup>{axes.map(([axis])=><Field key={axis}>
   <FieldLabel htmlFor={'canonicalGrid-'+axis}>{labels[axis]}</FieldLabel>
   <Input id={'canonicalGrid-'+axis} type="text" maxLength={131072} value={draft[axis]} disabled={blocked} aria-invalid={!!validation.error} aria-describedby="canonicalGridCount canonicalGridValidation" onChange={e=>{setDraft(previous=>({...previous,[axis]:e.target.value}));setError('');setNotice('')}}/>
   <FieldDescription>{CANONICAL_SEARCH_RANGES[axis][0]} ~ {CANONICAL_SEARCH_RANGES[axis][1]} · 중복 없이 입력</FieldDescription>
  </Field>)}</FieldGroup>
  <p id="canonicalGridCount" role="status">{validation.domain?`입력 조합 ${validation.domain.counts.angles} × ${validation.domain.counts.speeds} × ${validation.domain.counts.elevations} × ${validation.domain.counts.tipXs} × ${validation.domain.counts.tipYs} = ${validation.domain.total}개`:'입력 조합: 유효한 값을 모두 입력해야 계산할 수 있습니다.'}</p>
  <p className="helper">최대 {domain.maximumCandidates??4096}개를 대기열로 처리합니다. {domain.parallelWidthKind==='maximum-eligible'?<>현재 적용된 조합에서 사용 가능한 최대 배치 폭은 {domain.parallelWidth}개입니다. 지원 배치 폭: {(domain.supportedWidths??[]).join(', ')}개. 이는 모든 배치가 최대 폭으로 실행된다는 뜻이 아닙니다.</>:<>현재 조합의 GPU 배치 폭은 아직 확인되지 않았습니다.</>} 입력 중인 초안이 아니라 적용된 조합의 실행 조건입니다. 실제 사용한 배치 폭은 탐색 결과에 표시합니다. 전체 조합을 동시에 실행하는 것은 아닙니다.</p>
  {validation.domain?.unsupportedTipCombinations>0?<p className="helper">타점 반경 0.6 초과 조합 {validation.domain.unsupportedTipCombinations}개: 지원 범위 밖의 조합입니다. 목록에서 제거하지 않으며 실제 결과의 미지원·미완료를 구분해 표시합니다.</p>:null}
  <p className="helper">범위 안의 값도 현재 물리 모델에서 미지원·미완료가 될 수 있습니다. {s.canonicalPlayback.selectedWorldProfile==='mmq1-ball-ball'?'쿠션 충돌은 미지원입니다. ':''}적용하면 진행 중 탐색과 이전 후보를 무효화하며 자동으로 계산하거나 타격하지 않습니다.</p>
  <div id="canonicalGridValidation">{validation.error||error?<Alert role="alert"><AlertDescription>{error||validation.error}</AlertDescription></Alert>:null}</div>
  {notice?<p role="status">{notice}</p>:null}
  <div className="route-actions"><Button id="applyCanonicalGrid" disabled={blocked||!dirty||!validation.domain} onClick={apply}>탐색 조합 적용</Button><Button id="cancelCanonicalGrid" variant="outline" disabled={!dirty&&!error} onClick={cancel}>편집 취소</Button></div>
 </CardContent></Card>
}
