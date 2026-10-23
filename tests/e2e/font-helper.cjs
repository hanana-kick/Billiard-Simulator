'use strict';
const {expect}=require('@playwright/test');

const PRETENDARD_FAMILY='Pretendard Variable';
const PRETENDARD_CDN_BASE='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/';
const PRETENDARD_CSS_URL=PRETENDARD_CDN_BASE+'dist/web/variable/pretendardvariable-dynamic-subset.min.css';
const KOREAN_FONT_PROBE='당구 연습 삼구 사구 쿠션 경로 탐색 수동 설정 큐 회전 충돌 사용 안내';
const FONT_LOAD_TIMEOUT=60000;

// FontFaceSet.check() alone can succeed for a missing family through fallback.
// Require registered faces, non-empty load() results, Korean subset coverage,
// and the intended first-choice body family before taking a screenshot.
async function waitForPretendard(page,{timeout=FONT_LOAD_TIMEOUT}={}){
 const deadline=Date.now()+timeout;
 try{
  await page.waitForFunction(family=>document.body&&document.fonts&&Array.from(document.fonts).some(face=>face.family.replace(/["']/g,'').trim()===family),PRETENDARD_FAMILY,{timeout});
  const remaining=Math.max(1,deadline-Date.now());
  const result=await page.evaluate(async({family,probe,timeout})=>{
   let timer;
   const load=async()=>{
    // Also load every visible Korean character, not just a Latin-only probe or
    // a fixed title that would miss later tabs and expanded settings panels.
    const korean=/[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\uac00-\ud7ff]/u;
    const text=Array.from(new Set(probe+(document.body.innerText||''))).filter(character=>korean.test(character)).join('');
    const weights=await Promise.all([400,500,600].map(async weight=>{
     const request=`${weight} 16px "${family}"`;
     const faces=await document.fonts.load(request,text);
     return {weight,request,loadedCount:faces.length,check:document.fonts.check(request,text),faces:faces.map(face=>({family:face.family.replace(/["']/g,'').trim(),status:face.status,weight:face.weight,unicodeRange:face.unicodeRange}))};
    }));
    await document.fonts.ready;
    const covers=(unicodeRange,point)=>unicodeRange.split(',').some(range=>{
     const match=/^\s*U\+([0-9a-f?]+)(?:-([0-9a-f]+))?\s*$/i.exec(range);
     if(!match)return false;
     const low=parseInt(match[1].replace(/\?/g,'0'),16);
     const high=parseInt(match[2]||match[1].replace(/\?/g,'F'),16);
     return point>=low&&point<=high;
    });
    for(const entry of weights){
     entry.missingKorean=Array.from(text).filter(character=>!entry.faces.some(face=>covers(face.unicodeRange,character.codePointAt(0))));
    }
    const bodyFamily=getComputedStyle(document.body).fontFamily;
    return {family,text,bodyFamily,firstBodyFamily:bodyFamily.split(',')[0].replace(/["']/g,'').trim(),weights,stylesheetURLs:Array.from(document.styleSheets,sheet=>sheet.href).filter(Boolean)};
   };
   try{
    return await Promise.race([load(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`Pretendard Variable Korean font loading exceeded ${timeout} ms`)),timeout);})]);
   }finally{clearTimeout(timer);}
  },{family:PRETENDARD_FAMILY,probe:KOREAN_FONT_PROBE,timeout:remaining});
  expect(result.firstBodyFamily,'body must prefer Pretendard Variable, not a system fallback').toBe(PRETENDARD_FAMILY);
  expect(result.text.length,'the font load probe must contain actual Korean characters').toBeGreaterThan(0);
  for(const entry of result.weights){
   expect(entry.loadedCount,`${entry.weight}: load() must return real Korean FontFace objects`).toBeGreaterThan(0);
   expect(entry.check,`${entry.weight}: FontFaceSet reports the Korean request loaded`).toBe(true);
   expect(entry.missingKorean,`${entry.weight}: loaded unicode subsets must cover every Korean probe character`).toEqual([]);
   for(const face of entry.faces){
    expect(face.family,`${entry.weight}: loaded font family`).toBe(PRETENDARD_FAMILY);
    expect(face.status,`${entry.weight}: font face status`).toBe('loaded');
   }
  }
  return result;
 }catch(error){
  throw new Error(`Pretendard Variable Korean font verification failed on ${page.url()} (budget ${timeout} ms): ${error.message}`,{cause:error});
 }
}

module.exports={waitForPretendard,PRETENDARD_FAMILY,PRETENDARD_CDN_BASE,PRETENDARD_CSS_URL,KOREAN_FONT_PROBE,FONT_LOAD_TIMEOUT};
