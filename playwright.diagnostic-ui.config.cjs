'use strict';
const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'./tests/browser-diagnostic-ui',timeout:90000,workers:1,retries:0,fullyParallel:false,
 expect:{timeout:15000},outputDir:'test-results-diagnostic-ui',reporter:[['list'],['html',{open:'never',outputFolder:'playwright-diagnostic-ui-report'}]],
 webServer:{command:'node tools/build-diagnostic-ui-fixture.mjs --serve',url:'http://127.0.0.1:8792',reuseExistingServer:false,timeout:60000},
 use:{baseURL:'http://127.0.0.1:8792',channel:'chrome',headless:false,viewport:{width:1100,height:900},permissions:['clipboard-read','clipboard-write'],trace:'retain-on-failure',launchOptions:{chromiumSandbox:true}}});
