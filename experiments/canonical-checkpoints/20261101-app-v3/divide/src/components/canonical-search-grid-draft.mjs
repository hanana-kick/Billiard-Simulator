import {CANONICAL_SEARCH_AXES, canonicalSearchPopulation} from '../direct-candidate/canonical-search-domain.mjs';
export function canonicalGridDraft(parameterGrid){return Object.fromEntries(CANONICAL_SEARCH_AXES.map(([key])=>[key,(parameterGrid?.[key]??[]).join(', ')]));}
/** Parse tokens without Number('') coercion, clipping, rounding, or deduplication. */
export function parseCanonicalGridDraft(draft,maximumCandidates=4096){
 const parameterGrid={};
 const names={angles:'수평 조준',speeds:'큐 속도',elevations:'수직 들림',tipXs:'타점 X',tipYs:'타점 Y'};
 for(const [key]of CANONICAL_SEARCH_AXES){
  const text=String(draft[key]??'');if(text.length>131072)throw Error(names[key]+': 입력이 너무 깁니다.');
  const tokens=text.split(',').map(token=>token.trim());
  if(tokens.some(token=>!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(token)))throw Error(names[key]+': 쉼표로 구분한 숫자를 빠짐없이 입력하세요.');
  parameterGrid[key]=tokens.map(Number);
 }
 try{return canonicalSearchPopulation({parameterGrid,maximumCandidates}).domain;}catch(error){
  if(/candidate limit/.test(error.message))throw Error('전체 조합은 최대 '+maximumCandidates+'개까지 입력할 수 있습니다.');
  const axis=CANONICAL_SEARCH_AXES.find(([key])=>error.message.includes(key))?.[0];
  throw Error((names[axis]??'입력 조합')+': 표시된 범위 안의 유한한 숫자를 중복 없이 입력하세요. 값은 자동 보정하지 않습니다.');
 }
}
