'use strict';
// Unit tests only. Not browser/WASM, physics, or GPU-world evidence.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../tools/rapier-snapshot-decoder/codec.js'),D=require('../tools/rapier-snapshot-decoder/candidate.cjs');
const hex=value=>Buffer.from(value).toString('hex');
test('one browser-safe typed encoder preserves every bincode serde shape',()=>{
 const scalar=[{kind:'integer',width:'u128',value:'340282366920938463463374607431768211455'},{kind:'integer',width:'i128',value:'-170141183460469231731687303715884105728'},{kind:'float',width:'f32',bits:'80000000'},{kind:'float',width:'f32',bits:'7fa12345'},{kind:'float',width:'f64',bits:'8000000000000000'},{kind:'char',value:'🦀'},{kind:'some',value:{kind:'bool',value:true}},{kind:'unit_variant',name:'Mode',variant:'Third',index:2}];
 const tree={kind:'tuple',items:scalar},expected='ff'.repeat(16)+'00'.repeat(15)+'80'+'00000080'+'4523a17f'+'0000000000000080'+'f09fa680'+'0101'+'02000000';
 assert.equal(hex(C.encodeLosslessTree(tree)),expected);assert.equal(D.encodeLosslessTree(tree).toString('hex'),expected);assert.ok(Buffer.isBuffer(D.encodeLosslessTree(tree)),'Node API compatibility');assert.equal(C.encodeLosslessTree(tree).constructor,Uint8Array);
 assert.ok(Object.is(C.floatValue(scalar[2]),-0));assert.ok(Number.isNaN(C.floatValue(scalar[3])));
 const bool={kind:'bool',value:true},shapes=[{kind:'unit'},{kind:'unit_struct',name:'Unit'},{kind:'none'},{kind:'newtype_struct',name:'N',value:bool},{kind:'newtype_variant',name:'N',index:4,value:bool},{kind:'tuple_struct',name:'T',items:[bool]},{kind:'tuple_variant',name:'T',index:3,items:[bool]},{kind:'struct',name:'S',fields:[['b',bool]]},{kind:'struct_variant',name:'S',index:2,fields:[['b',bool]]},{kind:'seq',items:[bool]},{kind:'map',entries:[[{kind:'string',value:'é'},bool]]},{kind:'bytes',hex:'ff01'}];
 assert.equal(hex(C.encodeLosslessTree({kind:'tuple',items:shapes})),'0001040000000101030000000101020000000101000000000000000101000000000000000200000000000000c3a9010200000000000000ff01');
});
test('codec executes with no Node globals in a browser-style realm',()=>{
 const context=vm.createContext({TextEncoder,Uint8Array,DataView});vm.runInContext(fs.readFileSync(require.resolve('../tools/rapier-snapshot-decoder/codec.js'),'utf8'),context);
 assert.equal(hex(context.RapierSnapshotCodec.encodeLosslessTree({kind:'float',width:'f64',bits:'7ff8000000001234'})),'341200000000f87f');
 for(const name of ['Buffer','process','require'])assert.equal(context[name],undefined);
});
test('invalid widths, malformed types, size, node and depth bounds fail closed',()=>{
 for(const n of [{kind:'integer',width:'u8',value:'256'},{kind:'float',width:'f32',bits:'xyz'},{kind:'char',value:'\ud800'},{kind:'bool',value:1},{kind:'bytes',hex:'f'},{kind:'map',entries:[[1]]},{kind:'struct',fields:[['broken']]},{kind:'guessed_layout'}])assert.throws(()=>C.encodeLosslessTree(n));
 const root={kind:'some'};root.value=root;assert.throws(()=>C.encodeLosslessTree(root),e=>e.code==='invalid-tree');
 assert.throws(()=>C.encodeLosslessTree({kind:'string',value:'a'.repeat(C.MAX_BYTES+1)}),e=>e.code==='snapshot-size');
 assert.throws(()=>C.encodeLosslessTree({kind:'seq',items:new Array(2000001).fill({kind:'unit'})}),e=>e.code==='invalid-tree');
});
test('legacy wrapper and exporter references remain byte-for-byte frozen',()=>{
 const crypto=require('node:crypto'),path=require('node:path');
 const expected={
  'tools/rapier-snapshot-exporter/src/main.rs':'7a714208a34c6dfd1fd1a38682df2a56763bd84efeb3fbf10cd44fcbb1f3aa9b',
  'tools/rapier-snapshot-exporter/Cargo.toml':'73026dd1d75cf04c0c2580b702e7fdfff9f9f0a036eb229146296ef5629816d3',
  'tools/rapier-snapshot-exporter/Cargo.lock':'679905a40ec583de3c72ca7e120c30f227b868315ce2e47ffaad34d8ba17b1bb',
  'tools/rapier-snapshot-decoder/index.cjs':'c0be6bd93871c14e0c1971d7671c33a26bb16ab5b35ab2d63c7ebaf6d9197ed5',
  'tools/rapier-snapshot-decoder/build-native.cjs':'39b9a0a0bc34f52517373aabcd338e8d61ed7a021eeff7b01a2d6e7d635d5ec3',
  'tools/rapier-snapshot-batch-decoder/index.cjs':'4bb81de5ef83a12668d263677e07fcbf94823ae0f33c8896add47755da5cb3e2',
  'tools/rapier-snapshot-batch-decoder/build-native.cjs':'068c7274641a7811e1deb69096cd5f6b807405c1cbe11af927ffb13d46e1131f',
  'tools/rapier-snapshot-exporter/src/bin/rapier-snapshot-decoder-batch.rs':'dcc0e7500d982c93360381e9e38f35675b05b6d4d5853fe408d872ba7d6e1756',
 };
 for(const [file,sha]of Object.entries(expected))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',file))).digest('hex'),sha,file);
});
