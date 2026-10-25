import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {parseMicrocodeWGSL,tokenizeMicrocodeWGSL} from '../src/resident-candidate/microcode-parser.mjs';
import {generateSourceNumberWGSL} from '../src/resident-candidate/source-number.mjs';

test('authentic integer-backed binary64 source parses without rewriting equations or declarations',()=>{
 const source=generateSourceNumberWGSL(),ast=parseMicrocodeWGSL(source);
 assert.deepEqual(ast.aliases.map(a=>a.name),['RcF64','RcU128']);
 assert.deepEqual(ast.structs.map(s=>s.name),['RcDecoded64','RcDiv128']);
 assert.deepEqual(ast.functions.map(f=>f.name),[...source.matchAll(/\bfn\s+(\w+)\(/g)].map(x=>x[1]));
 assert.equal(ast.functions.length,30);
 const add=ast.functions.find(f=>f.name==='rc_f64_add');
 assert.deepEqual(add.params.map(p=>[p.name,p.type.name]),[['a','RcF64'],['b','RcF64']]);
 assert.equal(add.returnType.name,'RcF64');
 assert.equal(add.body.body.at(-1).value.callee.name,'rc_f64_pack');
 const div=ast.functions.find(f=>f.name==='rc_u128_div');
 assert.equal(div.body.body[2].kind,'for');
 assert.equal(div.body.body[2].update.op,'--');
});

test('syntax retains typed constructors, nested angles, storage qualifiers, attributes and expression precedence',()=>{
 const ast=parseMicrocodeWGSL(`
 const A:array<vec2<u32>,2>=array<vec2<u32>,2>(vec2<u32>(1u),vec2<u32>(2u));
 @group(0) @binding(2) var<storage,read_write> words:array<u32>;
 var<private> value:vec3<f32>;
 @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) gid:vec3<u32>){
  let x=(1u+2u)*3u<<4u; words[gid.x] += x; value.x=bitcast<f32>(words[0u]);
 }
 `);
 assert.equal(ast.globals[0].mode,'const');
 assert.equal(ast.globals[0].type.args[0].name,'vec2');
 assert.equal(ast.globals[0].type.args[1].text,'2');
 assert.equal(ast.globals[1].storage,'storage');
 assert.equal(ast.globals[1].access,'read_write');
 assert.deepEqual(ast.globals[1].attributes.map(x=>x.name),['group','binding']);
 assert.equal(ast.globals[2].storage,'private');
 const fn=ast.functions[0],statements=fn.body.body;
 assert.equal(fn.params[0].attributes[0].args[0].name,'global_invocation_id');
 assert.equal(statements[0].init.op,'<<');assert.equal(statements[0].init.left.op,'*');assert.equal(statements[0].init.left.left.op,'+');
 assert.equal(statements[1].op,'+=');assert.equal(statements[1].left.kind,'index');
 assert.equal(statements[2].right.callee.name,'bitcast');assert.equal(statements[2].right.typeArgs[0].name,'f32');
});

test('if/for/while/loop/continuing/switch and side-effect statement forms remain explicit AST nodes',()=>{
 const ast=parseMicrocodeWGSL(`fn f(a:u32)->u32{
 var n=0u;
 for(var i=0u;i<a;i++){if(i==1u){continue;}else if(i==2u){break;}else{n++;}}
 while n<a {n+=1u;}
 loop {n--;continuing {n+=1u;}}
 switch n {case 1u,2u:{return 3u;} default:{return n;}}
 }`),body=ast.functions[0].body.body;
 assert.deepEqual(body.map(s=>s.kind),['decl','for','while','loop','switch']);
 assert.equal(body[1].body.body[0].else.kind,'if');
 assert.equal(body[3].continuing.body[0].op,'+=');
 assert.deepEqual(body[4].cases[0].selectors.map(s=>s.text),['1u','2u']);
 assert.deepEqual(body[4].cases[1].selectors,['default']);
});

test('nested comments retain accurate offsets and unsupported/malformed syntax fails closed',()=>{
 const source='/* outer /* nested */ done */\nfn f(){\n  discard;\n}';
 assert.throws(()=>parseMicrocodeWGSL(source),error=>error instanceof SyntaxError&&error.line===3&&error.column===3&&error.offset===source.indexOf('discard'));
 assert.deepEqual(tokenizeMicrocodeWGSL('1e-3f 0xffu .5f 0x1.fp2').slice(0,-1).map(t=>t.text),['1e-3f','0xffu','.5f','0x1.fp2']);
 for(const s of['/* unclosed','enable f16;','fn f(){break if true;}','fn f(){let n;}','fn f(){a ??? b;}','fn f(){return 1u','struct S{@align(16) a:u32}'])assert.throws(()=>parseMicrocodeWGSL(s),SyntaxError,s);
});

test('all 36 accepted raw-six/two-h WGSL modules parse HOST ONLY from exact archived source bytes',t=>{
 const path='/tmp/resident-raw-pc-isolated-native-v2/runtime.v8';
 if(!existsSync(path))return t.skip('Pinned accepted source archive unavailable; no GPU execution requested');
 const bytes=readFileSync(path);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'4f2db833f116034d5ffe979b0d748418b4022f26c8906e0ed5cb13cf15b878dc');
 const p=deserialize(bytes),modules=[p.pc.begin,...p.pc.pipelines,...Object.values(p.init.stages)];
 assert.equal(modules.length,36);let functions=0;
 for(const module of modules){const ast=parseMicrocodeWGSL(module.code);assert.equal(ast.functions.filter(f=>f.name==='main').length,1,module.name);assert.equal(ast.functions.length,[...module.code.matchAll(/\bfn\s+(\w+)\(/g)].length,module.name);functions+=ast.functions.length;}
 t.diagnostic(JSON.stringify({scope:'syntax-only',modules:modules.length,functions,gpuExecution:false,physicsParityEstablished:false}));
});
