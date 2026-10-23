const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const origin='https://dangoo.hananakick.cc';
const read=name=>fs.readFileSync(path.join(__dirname,'../../dist',name),'utf8');

test('deployed HTML exposes Korean metadata before JavaScript runs',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false});
 try{
  const page=await context.newPage();
  await page.goto(process.env.LOCAL_HTML?pathToFileURL(path.join(__dirname,'../../dist/index.html')).href:'./');
  await expect(page.locator('html')).toHaveAttribute('lang','ko');
  await expect(page).toHaveTitle(/당구 연습.*3구·삼구·4구·사구·3쿠션.*Cue Lab/);
  for(const term of ['당구 연습','3구','삼구','4구','사구','3쿠션']){
   await expect(page.locator('meta[name=description]')).toHaveAttribute('content',new RegExp(term));
  }
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href',origin+'/');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content',origin+'/');
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content','ko_KR');
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content','summary');
  await expect(page.locator('link[rel=alternate][type="text/plain"]')).toHaveAttribute('href','./llms.txt');
  const data=JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  expect(data['@type']).toBe('WebApplication');
  expect(data.url).toBe(origin+'/');
  expect(data.inLanguage).toBe('ko');
  expect(data.subjectOf.url).toBe(origin+'/guide.html');
  expect(data.description).toContain('공식 경기 채점이나 실물 명중을 보장하지 않습니다');
  expect(data.featureList).toContain('3쿠션 경로 탐색');
  await expect(page.locator('noscript p')).toBeVisible();
  await expect(page.locator('noscript p')).toContainText('JavaScript');
  await expect(page.getByRole('link',{name:'당구 연습 사용 안내',exact:true})).toBeVisible();
 }finally{await context.close();}
});

test('crawler documents are bundled with consistent canonical URLs',async({request})=>{
 const robots=read('robots.txt'),sitemap=read('sitemap.xml'),llms=read('llms.txt');
 expect(robots).toContain('User-agent: *\nAllow: /');
 expect(robots).toContain('Sitemap: '+origin+'/sitemap.xml');
 expect([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1])).toEqual([origin+'/',origin+'/guide.html']);
 expect(llms).toContain(origin+'/guide.html');
 expect(llms).toContain('Four-ball practice has simplified scoring');
 expect(llms).not.toContain('no official 3구/4구 match modes');
 expect(read('guide.html')).toContain('한국 4구 연습');
 expect(read('CNAME').trim()).toBe(new URL(origin).hostname);
 for(const name of ['guide.html','llms.txt','robots.txt','sitemap.xml','CNAME']){
  expect(read(name)).toBe(fs.readFileSync(path.join(__dirname,'../../public',name),'utf8'));
 }
 if(!process.env.LOCAL_HTML){
  for(const [name,type]of [['guide.html','text/html'],['llms.txt','text/plain'],['robots.txt','text/plain'],['sitemap.xml','application/xml']]){
   const response=await request.get('./'+name);
   expect(response.status()).toBe(200);
   expect(response.headers()['content-type']).toContain(type);
   expect(await response.text()).toBe(read(name));
  }
 }
});

test('static Korean guide is readable without scripts on narrow and wide screens',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false});
 try{
  const page=await context.newPage();
  await page.goto(process.env.LOCAL_HTML?pathToFileURL(path.join(__dirname,'../../dist/guide.html')).href:'./guide.html');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href',origin+'/guide.html');
  await expect(page.getByRole('heading',{level:1})).toContainText('3구·삼구·4구·사구·3쿠션');
  await expect(page.locator('main')).toContainText('공식 경기 진행·채점 도구가 아니라');
  for(const width of [320,390,1440]){
   await page.setViewportSize({width,height:844});
   await expect(page.getByRole('link',{name:'Cue Lab · 당구 연습 시작',exact:true})).toBeVisible();
   const bounds=await page.locator('body').boundingBox();
   expect(bounds.x).toBeGreaterThanOrEqual(0);
   expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);
  }
  await expect(page.locator('script')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'당구 연습 시뮬레이터 열기',exact:true})).toHaveAttribute('href','./');
 }finally{await context.close();}
});
