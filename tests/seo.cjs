'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..'),origin='https://dangoo.hananakick.cc';
const read=name=>fs.readFileSync(path.join(root,'dist',name),'utf8');

test('built HTML contains crawlable Korean metadata and accurate application schema',()=>{
 const html=read('index.html');
 assert.match(html,/<html lang="ko"/);
 assert.match(html,/<title>당구 연습 시뮬레이터 \| 3구·삼구·4구·사구·3쿠션 \| Cue Lab<\/title>/);
 assert.ok(html.includes(`<link rel="canonical" href="${origin}/">`));
 assert.ok(html.includes(`<meta property="og:url" content="${origin}/">`));
 assert.match(html,/<meta name="twitter:card" content="summary">/);
 const data=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(data['@type'],'WebApplication');
 assert.equal(data.url,origin+'/');
 assert.equal(data.subjectOf.url,origin+'/guide.html');
 assert.ok(data.featureList.includes('한국 4구 연습과 간단한 점수·차례 표시'));
 assert.match(data.description,/공식 경기 채점이나 실물 명중을 보장하지 않습니다/);
 assert.match(html,/<noscript><p>.*JavaScript.*guide\.html/);
 assert.match(html,/<h1>Cue Lab · 당구 연습 시뮬레이터<\/h1>/);
});

test('SEO assets are copied without alteration and share the verified custom domain',()=>{
 for(const name of ['CNAME','guide.html','llms.txt','robots.txt','sitemap.xml']){
  assert.equal(read(name),fs.readFileSync(path.join(root,'public',name),'utf8'));
 }
 assert.equal(read('CNAME').trim(),new URL(origin).hostname);
 assert.match(read('robots.txt'),/User-agent: \*\nAllow: \//);
 assert.ok(read('robots.txt').includes('Sitemap: '+origin+'/sitemap.xml'));
 assert.deepEqual([...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]),[origin+'/',origin+'/guide.html']);
 assert.ok(read('guide.html').includes(`href="${origin}/guide.html"`));
 assert.doesNotMatch(read('guide.html'),/<script/);
 assert.match(read('guide.html'),/한국 4구 연습/);
 assert.match(read('llms.txt'),/Four-ball practice has simplified scoring/);
 assert.doesNotMatch(read('llms.txt'),/no official 3구\/4구 match modes/);
});
