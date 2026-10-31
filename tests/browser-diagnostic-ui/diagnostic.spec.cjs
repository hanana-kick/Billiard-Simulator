'use strict';
const {test,expect}=require('@playwright/test');
const loss=require('../fixtures/diagnostic-ui/loss.json');
async function open(page){
 await page.goto('/');await expect(page.getByRole('heading',{name:'Synthetic diagnostic UI fixture — not a GPU reproduction'})).toBeVisible();
 await expect(page.locator('#canonicalDeviceLoss')).toContainText('finish-map-pending');
 await expect(page.locator('#canonicalDeviceLoss')).toContainText('완료 확인 명령 53751 / 제출 53751');
 await expect(page.locator('#canonicalDeviceLoss')).toContainText('완료 확인 fence 211 / 제출 211');
 await expect(page.locator('#canonicalDeviceLoss')).toContainText('손실 통지 수신 시 탐색 경과: 18000 ms');
 await expect(page.locator('#canonicalDeviceLoss')).toContainText('마지막 진행 표시 이후 5101 ms');
 await expect(page.locator('#canonicalDeviceLoss')).toContainText('Synthetic Chrome fixture');
 await expect(page.locator('#canonicalDeviceLoss')).toContainText('Synthetic adapter label');
}
async function evidence(page,info){
 // Browser DOM/font check only, not a GPU capability probe.
 const fonts=await page.evaluate(async()=>{await document.fonts.load('16px "Pretendard Variable"','GPU 오류 진단 복사 손실 통지 수신');return [...document.fonts].filter(x=>x.family.includes('Pretendard')&&x.status==='loaded').length;});
 expect(fonts,'Actual Korean font face must load before fixture screenshot').toBeGreaterThan(0);
 await page.screenshot({path:info.outputPath('synthetic-ui-only.png'),fullPage:true});
 await info.attach('qualification',{body:JSON.stringify({syntheticProps:true,realReactComponent:true,realBrowserDOM:true,nativeGPUReproduction:false,loadedPretendardFaces:fonts}),contentType:'application/json'});
}
test('synthetic UI: real clipboard contains exact rendered diagnostic JSON after repeated clicks',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
 for(let n=0;n<2;n++){
  await page.getByRole('button',{name:'GPU 오류 진단 복사',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('진단 정보를 복사했습니다.');
  const copied=await page.evaluate(()=>navigator.clipboard.readText());expect(JSON.parse(copied)).toEqual(loss);
 }
 await page.getByText('진단 정보 보기 · 자동 전송 없음',{exact:true}).click();
 await expect(page.locator('#canonicalDeviceLoss pre')).toBeVisible();
 expect(JSON.parse(await page.locator('#canonicalDeviceLoss pre').innerText())).toEqual(loss);
 expect(errors).toEqual([]);await evidence(page,info);
});
test('synthetic UI: explicit clipboard rejection leaves readable manual-copy fallback',async({page},info)=>{
 // This test intentionally simulates only the clipboard failure, never a GPU result.
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new DOMException('Synthetic clipboard rejection','NotAllowedError'))}});});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
 await page.getByRole('button',{name:'GPU 오류 진단 복사',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('복사하지 못했습니다. 아래 진단 정보를 직접 선택해 복사하세요.');
 await page.getByText('진단 정보 보기 · 자동 전송 없음',{exact:true}).click();
 expect(JSON.parse(await page.locator('#canonicalDeviceLoss pre').innerText())).toEqual(loss);
 expect(errors).toEqual([]);await evidence(page,info);
});
