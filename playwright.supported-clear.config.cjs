'use strict';
// Bounded test-only exact-kernel diagnostic, never application qualification.
const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests/browser-supported-clear',timeout:10*60*1000,workers:1,retries:0,
 expect:{timeout:15000},outputDir:'test-results-supported-clear',
 reporter:[['list'],['html',{open:'never',outputFolder:'playwright-supported-clear-report'}]],
 use:{baseURL:'http://127.0.0.1:8787',headless:true,channel:'chrome',trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{chromiumSandbox:true}},
 webServer:{command:'node server.cjs',url:'http://127.0.0.1:8787/__supported-clear/',timeout:20000,reuseExistingServer:false}
});
