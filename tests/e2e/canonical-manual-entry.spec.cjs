const {test,expect}=require('@playwright/test');
const {createHash}=require('node:crypto');

// Packaging/UI coverage only: never confirm entry or execute GPU work.
test('packaged experimental GPU entry opens and cancels without requesting an adapter',async({page})=>{
 await page.addInitScript(()=>{
  globalThis.__manualEntryAdapterRequests=0;
  if(navigator.gpu){
   navigator.gpu.requestAdapter=(...args)=>{globalThis.__manualEntryAdapterRequests++;throw Error('GPU request forbidden in non-GPU entry test');};
  }
 });
 await page.goto('./');await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);
 const available=await page.evaluate(()=>globalThis.CANONICAL_GPU_ENTRY_AVAILABLE===true);
 // Plain developer builds remain supported; publication workflows require packaging.
 if(process.env.CANONICAL_ASSETS_REQUIRED==='1')expect(available,'Release must include the actual canonical GPU engine').toBe(true);
 if(!available){await expect(page.locator('#startCanonicalPractice')).toHaveCount(0);return;}
 const manifestResponse=await page.request.get('./canonical-controller-assets/manifest.json');expect(manifestResponse.ok()).toBe(true);
 const manifest=await manifestResponse.json();expect(manifest.activation).toBe(false);expect(manifest.automaticDeviceRequest).toBe(false);
 const bundleResponse=await page.request.get('./canonical-controller-assets/'+manifest.entrypoint);expect(bundleResponse.ok()).toBe(true);
 expect(createHash('sha256').update(await bundleResponse.body()).digest('hex')).toBe(manifest.sha256);
 await page.evaluate(()=>{globalThis.__manualEntryOriginalLab=cueLab.lab;globalThis.__manualEntryOriginalGame=cueLab.game;});
 const entry=page.locator('#startCanonicalPractice');await expect(entry).toBeVisible();await expect(entry).toBeEnabled();
 await entry.click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await expect(page.locator('#canonicalManualTestNotice')).toContainText('자동 GPU 검증 미완료');
 await expect(dialog).toContainText('수동 테스트용');
 await expect(dialog.locator('#canonicalPracticeProfile')).toHaveCount(0);
 await expect(dialog.getByRole('combobox')).toHaveCount(0);
 await expect(dialog).not.toContainText(/MMQ[12]|새 게임 물리 프로필|최대 16개/);
 await expect(dialog).toContainText('공 충돌과 제한된 쿠션 충돌');
 await expect(dialog).toContainText('최대 배치 폭은 3개');
 await expect(dialog).toContainText('바인딩 10개');
 await expect(dialog).toContainText('미지원·미완료를 실패로 바꾸지 않습니다');
 await page.locator('#cancelCanonicalPractice').click();await expect(dialog).not.toBeVisible();
 expect(await page.evaluate(()=>({requests:__manualEntryAdapterRequests,active:!!cueLab.canonicalPlayback,sameLab:cueLab.lab===__manualEntryOriginalLab,sameGame:cueLab.game===__manualEntryOriginalGame})))
  .toEqual({requests:0,active:false,sameLab:true,sameGame:true});
});
