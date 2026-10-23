'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
test('all 24 official styled registry items retain verified snapshots and only import/icon transforms',()=>{
 const p=spawnSync(process.execPath,['tools/install-official-ui.cjs','--check'],{cwd:root,encoding:'utf8'});assert.equal(p.status,0,p.stdout+p.stderr);
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'vendor/shadcn/provenance.json')));assert.equal(manifest.files.length,24);assert.equal(manifest.base,'base-nova');
});
test('interactive controls delegate to real @base-ui/react, not local primitive reimplementations',()=>{
 for(const [file,name]of Object.entries({button:'button',slider:'slider',switch:'switch',select:'select',accordion:'accordion',dialog:'dialog',input:'input',progress:'progress',toggle:'toggle','toggle-group':'toggle-group',separator:'separator'})){
  const text=fs.readFileSync(path.join(root,'src/components/ui',file+'.tsx'),'utf8');assert.ok(text.includes(`@base-ui/react/${name}`),file);assert.ok(!text.includes('onPointerDown='),file+' contains custom pointer behavior');assert.ok(!text.includes('<details'),file);
 }
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json')));assert.equal(pkg.dependencies['@base-ui/react'],'1.9.0');assert.equal(pkg.dependencies['react'],pkg.dependencies['react-dom']);assert.ok(!Object.keys(pkg.dependencies).some(n=>n.includes('radix')));
});
test('Base UI array selection, real Select items/portal composition and real Dialog are used by the app',()=>{
 const t=fs.readFileSync(path.join(root,'src/components/controls.tsx'),'utf8');assert.ok(t.includes('value={[value]}'));assert.ok(!t.includes('type="single"'));assert.ok(t.includes('<Select items={items}'));assert.ok(t.includes('<SelectGroup>'));
 const app=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');assert.ok(app.includes('<Dialog open={open}'));assert.ok(!app.includes('<dialog'));
 const css=fs.readFileSync(path.join(root,'index.template.html'),'utf8');assert.ok(css.includes('class="style-nova"'));
});
test('worker uses the exact rules, sampler and physical evaluator that the main thread uses',()=>{
 const t=fs.readFileSync(path.join(root,'src/optimizer-service.js'),'utf8');for(const n of ['route-rules','route-sampler','optimizer-core'])assert.ok(t.includes("'"+n+"'"));
 const build=fs.readFileSync(path.join(root,'build.cjs'),'utf8');assert.ok(!build.includes('react-runtime.js'));assert.ok(build.includes('requiresNetwork:online'));
});

test('official styles are inline and official animation and variant CSS enter the build',()=>{const build=fs.readFileSync(path.join(root,'tools/build-ui.cjs'),'utf8');assert.ok(!build.includes("src/nova.css"));assert.ok(build.includes('shadcn/tailwind.css'));assert.ok(build.includes('tw-animate-css/dist/tw-animate.css'));for(const name of ['button','tabs','sidebar','sheet']){const code=fs.readFileSync(path.join(root,'src/components/ui',name+'.tsx'),'utf8');assert.ok(!code.includes('cn-button'));assert.ok(code.includes('data-slot='));}});
test('compiled styled registry preserves quoted complex SVG selectors and sidebar variants',()=>{
 const css=fs.readFileSync(path.join(root,'src/styles.compiled.css'),'utf8');
 assert.ok(css.includes("svg:not([class*='size-'])")||css.includes('svg:not([class*="size-"])'));
 assert.ok(css.includes('--sidebar-width'));assert.ok(css.includes('[data-state="open"]'));assert.ok(css.includes('@keyframes'));
 const appCss=fs.readFileSync(path.join(root,'src/styles.css'),'utf8');assert.ok(!appCss.includes('.cn-'));assert.ok(!appCss.includes('.pull-meter > div'));assert.ok(!appCss.includes('--control-size'));
});
