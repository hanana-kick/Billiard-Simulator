'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {waitForPretendard,PRETENDARD_CDN_BASE,PRETENDARD_CSS_URL}=require('./font-helper.cjs');

for(const target of [
 {name:'application',url:'./',heading:'.workspace-header h1',viewport:{width:1440,height:900}},
 {name:'guide',url:'./guide.html',heading:'h1',viewport:{width:390,height:844}},
])test(`${target.name}: official Pretendard Variable CDN renders Korean text`,async({page},testInfo)=>{
 const responses=[],failedRequests=[];
 let fontEvidence,platformFonts;
 page.on('response',response=>{
  if(response.url().startsWith(PRETENDARD_CDN_BASE))responses.push({url:response.url(),status:response.status(),type:response.request().resourceType()});
 });
 page.on('requestfailed',request=>{
  if(request.url().startsWith(PRETENDARD_CDN_BASE))failedRequests.push({url:request.url(),error:request.failure()?.errorText});
 });
 try{
  await page.setViewportSize(target.viewport);
  if(process.env.LOCAL_HTML&&target.name==='application')await page.setContent(fs.readFileSync(process.env.LOCAL_HTML,'utf8'));
  else await page.goto(process.env.LOCAL_HTML?pathToFileURL(path.join(__dirname,'../../dist/guide.html')).href:target.url);
  if(target.name==='application')await page.waitForFunction(()=>globalThis.__LAB_READY__&&cueLab.state.ready);
  await expect(page.locator(target.heading)).toBeVisible();
  await expect(page.locator(`link[rel="stylesheet"][href="${PRETENDARD_CSS_URL}"]`)).toHaveCount(1);
  fontEvidence=await waitForPretendard(page);
  expect(fontEvidence.stylesheetURLs).toContain(PRETENDARD_CSS_URL);
  expect(responses.some(response=>response.url===PRETENDARD_CSS_URL&&response.status===200),'the pinned official CDN stylesheet was received').toBe(true);
  expect(responses.some(response=>response.type==='font'&&response.status===200&&/\/woff2-dynamic-subset\/PretendardVariable\.subset\.\d+\.woff2$/.test(response.url)),'real Pretendard Variable WOFF2 subsets were received from the pinned CDN').toBe(true);
  expect(failedRequests,'no Pretendard CDN request failed').toEqual([]);

  // Chrome's rendered-font inspection proves the heading used downloaded font
  // glyphs, rather than only checking a declared CSS family or ready promise.
  const client=await page.context().newCDPSession(page);
  try{
   await client.send('DOM.enable');
   await client.send('CSS.enable');
   const {root}=await client.send('DOM.getDocument');
   const {nodeId}=await client.send('DOM.querySelector',{nodeId:root.nodeId,selector:target.heading});
   expect(nodeId,'the real Korean heading exists').toBeGreaterThan(0);
   ({fonts:platformFonts}=await client.send('CSS.getPlatformFontsForNode',{nodeId}));
   const used=platformFonts.filter(font=>font.glyphCount>0);
   expect(used.length,'Chrome reports actually rendered heading glyphs').toBeGreaterThan(0);
   expect(used.every(font=>font.isCustomFont&&/Pretendard/.test(font.familyName)),'all heading glyphs use the downloaded Pretendard font, not fallback').toBe(true);
  }finally{await client.detach();}
  await page.screenshot({path:testInfo.outputPath(`${target.name}-pretendard-korean.png`),fullPage:true});
 }finally{
  await testInfo.attach('pretendard-font-evidence',{body:Buffer.from(JSON.stringify({target:target.name,fontEvidence,platformFonts,responses,failedRequests},null,2)),contentType:'application/json'});
 }
});
