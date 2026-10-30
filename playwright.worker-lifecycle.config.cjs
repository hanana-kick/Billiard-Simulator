'use strict';
// Explicit diagnostic only. Standard sandboxed Chrome, no GPU/security flags.
const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests/browser-worker-lifecycle',timeout:35*60*1000,workers:1,retries:0,
 expect:{timeout:15000},outputDir:'test-results-worker-lifecycle',
 reporter:[['list'],['html',{open:'never',outputFolder:'playwright-worker-lifecycle-report'}]],
 use:{baseURL:'http://127.0.0.1:8787',headless:true,channel:'chrome',viewport:{width:1440,height:900},
  actionTimeout:15000,navigationTimeout:60000,trace:'retain-on-failure',screenshot:'only-on-failure',
  launchOptions:{chromiumSandbox:true}},
 webServer:{command:'node server.cjs',url:'http://127.0.0.1:8787',timeout:20000,reuseExistingServer:false}
});
