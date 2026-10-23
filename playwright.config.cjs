// GitHub Ubuntu runner includes stable Chrome with its supported AppArmor profile.
// Keep Chromium sandbox enabled; never weaken host security for downloaded headless-shell.
const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests/e2e',timeout:180000,expect:{timeout:15000},workers:1,retries:0,
 reporter:[['list'],['html',{open:'never'}]],
 use:{baseURL:process.env.APP_URL||'http://127.0.0.1:8787',headless:true,channel:process.env.GITHUB_ACTIONS==='true'&&!process.env.BROWSER_EXECUTABLE?'chrome':undefined,actionTimeout:15000,navigationTimeout:30000,viewport:{width:1440,height:900},screenshot:'only-on-failure',trace:'retain-on-failure',launchOptions:process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE,chromiumSandbox:true}:{chromiumSandbox:true}},
 webServer:(process.env.APP_URL||process.env.LOCAL_HTML)?undefined:{command:'node server.cjs',url:'http://127.0.0.1:8787',timeout:20000,reuseExistingServer:!process.env.CI}
});
