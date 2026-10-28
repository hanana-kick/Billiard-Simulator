// Explicit qualification only: never selected by the default application suite.
// Build with `node build.cjs --canonical-controller-assets` before invoking.
const base=require('./playwright.config.cjs');
module.exports={...base,testDir:'./tests/browser-canonical',timeout:360000,
 reporter:[['list'],['html',{open:'never',outputFolder:'playwright-canonical-report'}]],
 outputDir:'test-results-canonical'};
