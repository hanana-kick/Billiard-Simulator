const base=require('@playwright/test');
const test=base.test.extend({browser:[async({playwright,browserName},use)=>{
 if(browserName!=='chromium')throw Error('Chromium required');const endpoint=process.env.BILLIARD_CDP_ENDPOINT;if(!endpoint)throw Error('No fallback launch');const u=new URL(endpoint);if(!['http:','ws:'].includes(u.protocol)||u.hostname!=='127.0.0.1'||u.username||u.password)throw Error('Owned loopback required');
 const browser=await playwright.chromium.connectOverCDP(endpoint,{timeout:30000});try{await use(browser)}finally{await browser.close()}
},{scope:'worker',timeout:30000}]});module.exports={test,expect:base.expect};
