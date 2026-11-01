const {defineConfig}=require('@playwright/test');
if(!process.env.APP_URL)throw Error('APP_URL must identify the already running application');
module.exports=defineConfig({
 testDir:'.',testMatch:'visible-shot-verification.spec.cjs',
 timeout:180000,expect:{timeout:15000},workers:1,retries:0,reporter:[['list']],
 use:{browserName:'chromium',baseURL:process.env.APP_URL,actionTimeout:15000,navigationTimeout:30000,viewport:{width:1440,height:900},screenshot:'only-on-failure',trace:'off'}
});
