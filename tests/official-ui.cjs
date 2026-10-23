'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
test('all 16 official shadcn Base UI sources retain verified original Git blob hashes and only import/icon transforms',()=>{
 const p=spawnSync(process.execPath,['tools/install-official-ui.cjs','--check'],{cwd:root,encoding:'utf8'});assert.equal(p.status,0,p.stdout+p.stderr);
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'vendor/shadcn/provenance.json')));assert.equal(manifest.files.length,16);assert.equal(manifest.base,'base');
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
