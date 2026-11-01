/** Repository-relative source rebuild. No network, deployment, pin updates or fallback. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]),here=path.dirname(fileURLToPath(import.meta.url));
assert.equal(process.argv.length,4);assert.ok(out.startsWith(root+path.sep),'Output must belong to this checkout');
const workParent=path.join(root,'.compiled-build');fs.mkdirSync(workParent,{recursive:true});const work=fs.mkdtempSync(path.join(workParent,'release-'));
const layout={originalRoot:root,integrationRoot:path.join(root,'build-sources/runtime'),searchCompilerRoot:path.join(root,'build-sources/search-compiler'),selectedCompilerRoot:path.join(root,'build-sources/selected-compiler'),dependencyDirectory:path.join(root,'node_modules'),outputRoot:path.join(work,'generated')};
const layoutFile=path.join(work,'layout.json');fs.writeFileSync(layoutFile,JSON.stringify(layout));
function run(argv,label){const r=spawnSync(argv[0],argv.slice(1),{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});fs.writeFileSync(path.join(work,label+'.log'),(r.stdout??'')+(r.stderr??''));if(r.error||r.status!==0)throw Error(label+' failed: '+(r.error??r.signal??r.status)+'; '+(r.stderr??'').slice(-4000));return r.stdout;}
run([process.execPath,path.join(here,'prepare-reproduction-configs.mjs'),layoutFile],'configure');
const recipe=JSON.parse(fs.readFileSync(path.join(layout.outputRoot,'steps.json')));assert.equal(recipe.steps.length,9);
for(const [i,s]of recipe.steps.slice(0,8).entries())run(s.argv,'step-'+(i+1));
const cfile=path.join(layout.outputRoot,'app-build.json'),c=JSON.parse(fs.readFileSync(cfile));c.assetsOutputDirectory=path.join(work,'assets');fs.writeFileSync(cfile,JSON.stringify(c));
const manifest=JSON.parse(run([process.execPath,path.join(here,'build-compiled-assets.mjs'),cfile],'compiled-assets'));
// Only replace the build output after complete compilation and source/pin admission.
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(path.dirname(out),{recursive:true});fs.renameSync(c.assetsOutputDirectory,out);
fs.writeFileSync(path.join(work,'receipt.json'),JSON.stringify({success:true,output:out,manifest},null,2));
process.stdout.write(JSON.stringify(manifest));
