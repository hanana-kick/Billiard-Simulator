import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const root=fileURLToPath(new URL('../',import.meta.url));
const scripts=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8')).scripts;
const suiteNames=['test:deterministic-event','test:canonical-state-domain','test:canonical-components'];
const supplemental=JSON.parse(readFileSync(path.join(root,'tools/canonical-integration-cpu-suites.json'),'utf8'));
const roots=[...new Set([...suiteNames.flatMap(name=>scripts[name].match(/tests\/[^\s]+\.(?:mjs|cjs)/g)??[]),...supplemental])];
function imports(source){
 const file=ts.createSourceFile('fixture.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),specs=[];
 function visit(node){
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))specs.push(node.moduleSpecifier.text);
  if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(node.expression)&&node.expression.text==='require'))){const arg=node.arguments[0];
   if(arg&&ts.isStringLiteral(arg))specs.push(arg.text);
   else if(arg&&ts.isBinaryExpression(arg)&&arg.operatorToken.kind===ts.SyntaxKind.PlusToken&&ts.isIdentifier(arg.left)&&arg.left.text==='root'&&ts.isStringLiteral(arg.right))specs.push('#root:'+arg.right.text);
  }
  ts.forEachChild(node,visit);
 }
 visit(file);return specs;
}
function isTest(source){return imports(source).includes('node:test');}

test('canonical aggregate suites never import executable test modules as fixture helpers',()=>{
 const visited=new Set();
 function inspect(file){if(visited.has(file))return;visited.add(file);const source=readFileSync(file,'utf8');
  for(const spec of imports(source)){if(!spec.startsWith('.')&&!spec.startsWith('#root:'))continue;const target=spec.startsWith('#root:')?path.resolve(root,spec.slice(6)):path.resolve(path.dirname(file),spec);if(!target.startsWith(path.join(root,'tests')+path.sep)||!/[.](?:mjs|cjs)$/.test(target))continue;
   const body=readFileSync(target,'utf8');assert.equal(isTest(body),false,`${path.relative(root,file)} imports executable suite ${path.relative(root,target)}; extract a fixture-only module`);inspect(target);
  }
 }
 for(const name of roots)inspect(path.join(root,name));
});

test('mixed-motion fixture dependency closure registers no CPU or native test cases',()=>{
 const visited=new Set();
 function inspect(file){if(visited.has(file))return;visited.add(file);const source=readFileSync(file,'utf8');assert.equal(isTest(source),false,`${file} registers tests`);
  for(const spec of imports(source)){if(!spec.startsWith('.')&&!spec.startsWith('#root:'))continue;const target=spec.startsWith('#root:')?path.resolve(root,spec.slice(6)):path.resolve(path.dirname(file),spec);if(target.endsWith('.mjs'))inspect(target);}
 }
 for(const name of ['mixed-motion-query','mixed-motion-v2','mixed-cushion-v2','cushion-resolver','world-rolling-stop-v2'])inspect(path.join(root,'tests','fixtures',name+'.mjs'));
 assert.ok(visited.size>=4);
});

test('fixture import guard recognizes root-concatenated dynamic fixture paths',()=>{assert.deepEqual(imports("await import(root+'tests/executable.mjs')"),['#root:tests/executable.mjs']);});

test('fixture import guard recognizes CommonJS executable suite imports',()=>{assert.deepEqual(imports("require('./executable.cjs')"),['./executable.cjs']);});
