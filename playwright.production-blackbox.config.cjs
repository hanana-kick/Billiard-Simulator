'use strict';
const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'./tests/browser-production-blackbox',timeout:12*60*1000,workers:1,retries:0,fullyParallel:false,
 expect:{timeout:20000},outputDir:'test-results-production-blackbox',reporter:[['list'],['html',{open:'never',outputFolder:'playwright-production-blackbox-report'}]],
 use:{baseURL:'https://dangoo.hananakick.cc/',channel:'chrome',headless:false,viewport:{width:1440,height:900},actionTimeout:20000,navigationTimeout:60000,
 trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{chromiumSandbox:true}}});
