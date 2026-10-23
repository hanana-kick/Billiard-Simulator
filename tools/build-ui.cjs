'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),online=process.argv.includes('--online');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?walk(path.join(dir,f.name)):/\.tsx?$/.test(f.name)?[path.join(dir,f.name)]:[]);
async function build(){
 const files=walk(path.join(root,'src')),source=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
 const ts=require('typescript'),tw=require('tailwindcss');
 const external=new Set();
 for(const f of files){const text=fs.readFileSync(f,'utf8');for(const m of text.matchAll(/from\s+['"]([^'"]+)['"]/g))if(!m[1].startsWith('@/'))external.add(m[1]);}
 external.add('react/jsx-runtime');external.add('react-dom/client');
 if(online){
  let code='(function(G){G.initializeCueUI=function(){const modules={},cache={};\n';
  for(const f of files){const text=fs.readFileSync(f,'utf8');const result=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:f,reportDiagnostics:true});const errors=result.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error)||[];if(errors.length)throw Error(errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));const name='@/'+path.relative(path.join(root,'src'),f).replaceAll(path.sep,'/').replace(/\.(tsx|ts)$/,'');code+=`modules[${JSON.stringify(name)}]=function(require,module,exports){\n${result.outputText}\n};\n`;}
  code+=`function require(name){if(G.CueUIExternal&&Object.hasOwn(G.CueUIExternal,name))return G.CueUIExternal[name];if(cache[name])return cache[name].exports;if(!modules[name])throw new Error('Unresolved real UI dependency: '+name);const module=cache[name]={exports:{}};modules[name](require,module,module.exports);return module.exports;}require('@/App');};})(globalThis);`;
  fs.writeFileSync(path.join(root,'src/ui.compiled.js'),code);
 }else{
  const esbuild=require('esbuild');
  const result=await esbuild.build({entryPoints:[path.join(root,'src/App.tsx')],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',jsx:'automatic',alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"production"'},metafile:true,minify:true});
  fs.writeFileSync(path.join(root,'src/ui.compiled.js'),result.outputFiles[0].contents);
  const inputs=Object.keys(result.metafile.inputs);if(!inputs.some(x=>x.includes('@base-ui/react/')))throw Error('Base UI did not enter the real bundle');
  fs.writeFileSync(path.join(root,'docs/ui-bundle-audit.json'),JSON.stringify({realBaseUIInputs:inputs.filter(x=>x.includes('@base-ui/')),totalModules:inputs.length,external:[]},null,2));
 }
 const twRoot=path.dirname(require.resolve('tailwindcss/package.json'));
 const theme=fs.readFileSync(path.join(twRoot,'theme.css'),'utf8'),preflight=fs.readFileSync(path.join(twRoot,'preflight.css'),'utf8'),style=fs.readFileSync(path.join(root,'src/styles.css'),'utf8'),nova=fs.readFileSync(path.join(root,'src/nova.css'),'utf8');
 const compiler=await tw.compile(`@layer theme,base,components,utilities;\n${theme}\n@layer base{${preflight}}\n@custom-variant dark (&:is(.dark *));\n${style}\n${nova}\n@layer utilities { @tailwind utilities; }`);
 const candidates=[...new Set(source.match(/[^\s"'\x60]+/g))];
 fs.writeFileSync(path.join(root,'src/styles.compiled.css'),compiler.build(candidates));
 fs.writeFileSync(path.join(root,'src/ui-externals.json'),JSON.stringify([...external].sort()));
 console.log(online?'Compiled official UI sources for real CDN modules.':'Bundled real Base UI, React and official shadcn components.');
}
build().catch(e=>{console.error(e);process.exitCode=1});
