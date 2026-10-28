/* SPDX-License-Identifier: Apache-2.0
 * HOST-ONLY source lowering. Original WGSL functions become scalar instructions;
 * arithmetic is not evaluated here and no physics result is synthesized. The
 * compact GPU runtime consumes the result without importing this compiler.
 * Unknown constructs/types/builtins reject rather than select an approximation.
 */
import {createHash} from './source-sha256.mjs';
import {parseMicrocodeWGSL} from './microcode-parser.mjs';
import {MICROCODE_ISA as ISA} from './microcode-isa.mjs';
import {approveSourceIntrinsics,MICROCODE_SOURCE_INTRINSICS,sourceIntrinsicProfileAllows} from './microcode-source-intrinsics.mjs';
import {approveSourceMacros} from './microcode-source-macros.mjs';
const SCALARS=new Set(['u32','i32','f32','bool']);
const scalar=name=>({kind:'scalar',name,scalar:name,words:1});
const VOID=Object.freeze({kind:'void',name:'void',words:0});
const vector=(element,count)=>({kind:'vector',name:`vec${count}<${element.name}>`,element,scalar:element.name,count,words:count});
const fbits=n=>new Uint32Array(Float32Array.of(n).buffer)[0];
const fail=m=>{throw new TypeError('WGSL microcode compiler: '+m);};
const same=(a,b)=>a?.name===b?.name;
const walk=(node,fn)=>{if(!node||typeof node!=='object')return;fn(node);for(const value of Object.values(node)){if(Array.isArray(value))for(const x of value)walk(x,fn);else if(value&&typeof value==='object')walk(value,fn);}};
function literal(text,expected){
 if(text==='true'||text==='false')return{type:scalar('bool'),word:text==='true'?1:0};
 const hex=/^0x/i.test(text),floating=hex?/\.|p/i.test(text):/[.e]/i.test(text);let suffix='';
 if(/[ui]$/.test(text)||(!hex||floating)&&/[fh]$/.test(text)){suffix=text.at(-1);text=text.slice(0,-1);}if(suffix==='h')fail('f16 literal unsupported');
 let number;
 if(hex&&floating){const m=/^0x([0-9a-f]*)(?:\.([0-9a-f]*))?p([+-]?\d+)$/i.exec(text);if(!m)fail('Unsupported hexadecimal float '+text);number=(parseInt(m[1]||'0',16)+Array.from(m[2]??'').reduce((n,x,i)=>n+parseInt(x,16)*16**(-i-1),0))*2**Number(m[3]);}
 else number=Number(text);
 if(!Number.isFinite(number))fail('Nonfinite literal '+text);
 const name=suffix==='u'?'u32':suffix==='i'?'i32':suffix==='f'?'f32':floating?'f32':expected?.kind==='scalar'&&['i32','u32','f32'].includes(expected.name)?expected.name:'i32';
 if(name!=='f32'&&!Number.isInteger(number))fail('Nonintegral integer literal');
 return{type:scalar(name),word:name==='f32'?fbits(number):number>>>0};
}
const abstractNumeric=e=>e?.kind==='literal'&&!['true','false'].includes(e.text)&&!(/[ui]$/.test(e.text)||(!/^0x/i.test(e.text)||/[.p]/i.test(e.text))&&/[fh]$/.test(e.text))||e?.kind==='unary'&&['-','+'].includes(e.op)&&abstractNumeric(e.arg);
const absLiteral=e=>e?.kind==='literal'||e?.kind==='unary'&&['-','+'].includes(e.op)&&absLiteral(e.arg);
/** Canonical instructions are [opcode,dst,a,b,c,d,e,f]. Calls retain original
 * control order and use distinct static function slots; recursive call graphs
 * are rejected. Intermediate scalar results are written before subsequent ops.
 */
export function compileMicrocodeWGSL(code,{entry='main',storageBindings=ISA.bindings,intrinsics='none',intrinsicFunctions,externalFunctions=[],allocationMetadata=false}={}){
 if(typeof allocationMetadata!=='boolean')fail('Explicit allocationMetadata boolean required');
 if(intrinsicFunctions!==undefined){
  if(!Array.isArray(intrinsicFunctions)||intrinsicFunctions.some(x=>typeof x!=='string')||new Set(intrinsicFunctions).size!==intrinsicFunctions.length)fail('Explicit unique intrinsicFunctions source-name array required');
  const allowed=new Set(MICROCODE_SOURCE_INTRINSICS.filter(x=>sourceIntrinsicProfileAllows(intrinsics,x)).map(x=>x.name));
  for(const name of intrinsicFunctions)if(!allowed.has(name))fail('Intrinsic function outside explicit profile: '+name);
 }
 const intrinsicApproval=approveSourceIntrinsics(code,{profile:intrinsics,storageBindings,functionNames:intrinsicFunctions}),intrinsicEntries=new Map(intrinsicApproval.entries.map(x=>[x.name,x]));
 if(intrinsicFunctions!==undefined)for(const name of intrinsicFunctions)if(!intrinsicEntries.has(name))fail('Explicit intrinsic function absent from source: '+name);
 if(!Array.isArray(externalFunctions)||externalFunctions.some(x=>typeof x!=='string')||new Set(externalFunctions).size!==externalFunctions.length)fail('Explicit unique externalFunctions source-name array required');
 const externalApproval=externalFunctions.length?approveSourceMacros(code,{functionNames:externalFunctions,storageBindings}):null,externalEntries=new Map(externalApproval?.entries.map(x=>[x.name,x])??[]);
 for(const name of externalEntries.keys())if(intrinsicEntries.has(name))fail('Function cannot be both intrinsic and external: '+name);
 const ast=parseMicrocodeWGSL(code),aliases=new Map(),structs=new Map(),types=new Map(),fnAst=new Map(),globals=new Map(),functions=new Map();
 for(const t of SCALARS)types.set(t,scalar(t));
 for(const x of ast.aliases){if(aliases.has(x.name)||types.has(x.name))fail('Duplicate type '+x.name);aliases.set(x.name,x.type);}
 for(const x of ast.structs){if(structs.has(x.name)||types.has(x.name)||aliases.has(x.name))fail('Duplicate type '+x.name);structs.set(x.name,x);}
 for(const f of ast.functions){if(fnAst.has(f.name))fail('Duplicate function '+f.name);fnAst.set(f.name,f);}
 if(!fnAst.has(entry))fail('Missing entry '+entry);
 const typePending=new Set();
 function constant(e){if(e?.kind==='literal'){const n=literal(e.text).word;return n;}if(e?.kind==='name'){const g=ast.globals.find(x=>x.name===e.name);if(!g||g.mode==='var')fail('Array extent requires immutable integer '+e.name);return constant(g.init);}if(e?.kind==='unary'&&e.op==='-')return-constant(e.arg);if(e?.kind==='binary'){const a=constant(e.left),b=constant(e.right);switch(e.op){case'+':return a+b;case'-':return a-b;case'*':return a*b;case'/':return Math.trunc(a/b);case'%':return a%b;case'<<':return a<<b;case'>>':return a>>>b;}}fail('Unsupported immutable integer expression');}
 function type(t){
  if(!t)return VOID;if(types.has(t.name)&&!t.args?.length)return types.get(t.name);
  if(aliases.has(t.name)){if(typePending.has(t.name))fail('Recursive alias '+t.name);typePending.add(t.name);const v=type(aliases.get(t.name));typePending.delete(t.name);types.set(t.name,v);return v;}
  if(structs.has(t.name)){if(typePending.has(t.name))fail('Recursive struct '+t.name);typePending.add(t.name);let words=0;const fields=structs.get(t.name).fields.map(f=>{const ft=type(f.type),r={name:f.name,type:ft,offset:words};if(ft.kind==='array'&&ft.count===null)fail('Runtime local struct array');words+=ft.words;return r;});const v={kind:'struct',name:t.name,fields,words};types.set(t.name,v);typePending.delete(t.name);return v;}
  if(/^vec[234]$/.test(t.name)){if(t.args?.length!==1)fail('Explicit scalar vector type required');const e=type(t.args[0]);if(e.kind!=='scalar')fail('Vector element scalar required');return vector(e,Number(t.name.at(-1)));}
  if(t.name==='ptr'){if(t.args?.length!==2||t.args[0].name!=='function')fail('Only explicit function-local pointers admitted');const target=type(t.args[1]);return{kind:'pointer',name:'ptr<function,'+target.name+'>',target,words:1};}
  if(t.name==='array'){if(!t.args?.length||t.args.length>2)fail('Explicit array element/extent required');const e=type(t.args[0]),count=t.args.length===2?constant(t.args[1]):null;if(count!==null&&(!Number.isSafeInteger(count)||count<1||count>1048576))fail('Bounded positive local array extent');return{kind:'array',name:`array<${e.name},${count??'runtime'}>`,element:e,count,words:count===null?0:count*e.words};}
  fail('Unsupported type '+t.name);
 }
 const isType=name=>SCALARS.has(name)||types.has(name)||aliases.has(name)||structs.has(name)||/^vec[234]$/.test(name)||name==='array';
 const used=new Set(),visiting=new Set(),depths=new Map();
 function reach(name){if(intrinsicEntries.has(name)||externalEntries.has(name)){used.add(name);depths.set(name,1);return 1;}if(visiting.has(name))fail('Recursive function '+name);if(used.has(name))return depths.get(name);visiting.add(name);let depth=1;walk(fnAst.get(name).body,n=>{if(n.kind==='call'&&n.callee.kind==='name'&&fnAst.has(n.callee.name))depth=Math.max(depth,1+reach(n.callee.name));});visiting.delete(name);used.add(name);depths.set(name,depth);return depth;}
 if(fnAst.get(entry).params.some(p=>type(p.type).kind==='pointer'))fail('External entry pointer authority is unsupported');
 const callDepth=reach(entry),rows=[],labels=new Map(),patches=[],allocations=[],addressConstants=[],foreignMoves=[],pointerEscapes=[];let localWords=0,current=null,allocationOwner=null;
 const containsPointer=t=>t.kind==='pointer'||t.kind==='array'&&containsPointer(t.element)||t.kind==='struct'&&t.fields.some(f=>containsPointer(f.type));
 const alloc=t=>{if(!Number.isSafeInteger(t.words)||t.words<0||t.words>1048576)fail('Unsupported local type allocation '+t.name);const slot=localWords;localWords+=t.words;if(allocationMetadata&&t.words)allocations.push({slot,words:t.words,owner:allocationOwner??current?.name??'$pinned',containsPointer:containsPointer(t)});if(localWords>0xffffff)fail('Local scalar capacity exceeded');return{type:t,slot,words:t.words};};
 const emit=(op,dst=0,a=0,b=0,c=0,d=0,e=0,f=0)=>{if(ISA.opcodes[op]===undefined)fail('Missing scalar primitive '+op);const row=[ISA.opcodes[op],dst,a,b,c,d,e,f];if(!row.every(x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff))fail('Invalid instruction operands '+op);rows.push(row);return rows.length-1;};
 let nextLabel=0;const label=()=>`L${nextLabel++}`,mark=l=>{if(labels.has(l))fail('Duplicate control label');labels.set(l,rows.length);},target=(op,args,fields)=>{const i=rows.length;emit(op,...args);for(const[k,l]of fields)patches.push([i,k,l]);};
 const jump=l=>target('JUMP',[0,0],[[2,l]]),branch=(v,yes,no)=>{if(allocationMetadata&&containsPointer(v.type))pointerEscapes.push('pointer-condition:'+(current?.name??'$pinned'));return target('BRANCH',[0,v.slot,0,0],[[3,yes],[4,no]]);};
 const set=(t,word)=>{const v=alloc(t);emit('SET',v.slot,word>>>0);return v;},zero=t=>{if(allocationMetadata&&containsPointer(t))pointerEscapes.push('zero-initialized-pointer:'+(current?.name??'$pinned'));const v=alloc(t);for(let i=0;i<t.words;i++)emit('SET',v.slot+i,0);return v;};
 const scopes=[];const lookup=name=>{for(let i=scopes.length-1;i>=0;i--)if(scopes[i].has(name))return scopes[i].get(name);if(globals.has(name))return globals.get(name);fail('Unknown value '+name+' in '+(current?.name??'module'));};
 const bind=(name,v)=>{const scope=scopes.at(-1);if(scope.has(name))fail('Duplicate local '+name);scope.set(name,v);};
 function compatible(a,b,what){if(!same(a,b))fail(`${what}: ${a?.name} vs ${b?.name}`);}
 const copy=(dst,src)=>{compatible(dst.type,src.type,'Assignment type');for(let i=0;i<dst.words;i++)emit('MOV',dst.slot+i,src.slot+i);};
 function constructorType(n){const name=n.callee.name;if(/^vec[234]$/.test(name)&&!n.typeArgs?.length){const inferred=n.args.length?infer(n.args[0]):null,e=inferred?.kind==='vector'?inferred.element:inferred;if(!e||e.kind!=='scalar')fail('Vector inference requires first scalar');return vector(e,Number(name.at(-1)));}return type({name,args:n.typeArgs??[]});}
 function infer(n,hint){
  if(!n)fail('Missing expression');switch(n.kind){
   case'literal':return literal(n.text,hint).type;
   case'name':return lookup(n.name).type;
   case'unary':{const a=infer(n.arg,hint);if(n.op==='&')return{kind:'pointer',name:'ptr<function,'+a.name+'>',target:a,words:1};if(n.op==='*'){if(a.kind!=='pointer')fail('Dereference requires local pointer');return a.target;}return n.op==='!'?scalar('bool'):a;}
   case'member':{const t=infer(n.object);if(t.kind==='struct'){const f=t.fields.find(f=>f.name===n.member);if(!f)fail('Unknown struct field '+n.member);return f.type;}if(t.kind==='vector'&&/^[xyzwrgba]{1,4}$/.test(n.member)){if(n.member.length===1)return t.element;return vector(t.element,n.member.length);}fail('Unsupported member '+n.member);}
   case'index':{const t=infer(n.object);if(t.kind!=='vector'&&t.kind!=='array')fail('Indexed value is not array/vector');return t.element;}
   case'binary':{if(['&&','||'].includes(n.op))return scalar('bool');let a=infer(n.left,hint),b=infer(n.right,hint);if(absLiteral(n.left)&&!absLiteral(n.right))a=infer(n.left,b.kind==='vector'?b.element:b);if(absLiteral(n.right))b=infer(n.right,a.kind==='vector'?a.element:a);const t=a.kind==='vector'?a:b.kind==='vector'?b:a;if(['==','!=','<','<=','>','>='].includes(n.op))return t.kind==='vector'?vector(scalar('bool'),t.count):scalar('bool');return t;}
   case'call':{if(n.callee.kind!=='name')fail('Non-name call');const name=n.callee.name;if(isType(name))return constructorType(n);if(fnAst.has(name))return type(fnAst.get(name).returnType);if(name==='bitcast'){if(n.typeArgs.length!==1)fail('Explicit bitcast target');return type(n.typeArgs[0]);}if(['all','any'].includes(name))return scalar('bool');if(['arrayLength','countLeadingZeros','countTrailingZeros','countOneBits','extractBits','insertBits'].includes(name)){if(name==='arrayLength')return scalar('u32');return infer(n.args[0]);}if(name==='select')return infer(n.args[0],hint);if(['min','max','clamp','abs','sqrt','inverseSqrt','floor','ceil','trunc','round','sign','normalize'].includes(name))return infer(n.args[0],hint);if(['dot','length','distance'].includes(name))return scalar('f32');if(name==='cross')return infer(n.args[0]);fail('Unsupported builtin '+name);}
   default:fail('Unsupported expression '+n.kind);
  }
 }
 // Globals precede function frames; runtime arrays remain external storage.
 for(const g of ast.globals){if(globals.has(g.name))fail('Duplicate global '+g.name);const t=g.type?type(g.type):infer(g.init);if(g.storage==='storage'){if(t.kind!=='array'||t.element.name!=='u32')fail('Only exact array<u32> external bindings admitted: '+g.name);const binding=storageBindings[g.name];if(!Number.isInteger(binding)||binding<0||binding>4&&!(g.name===ISA.optionalBindings?.eventAudit.sourceName&&binding===ISA.optionalBindings.eventAudit.sourceId))fail('Explicit immutable storage identity required '+g.name);if(g.access==='read_write'&&!ISA.writableBindings.includes(binding)&&!(g.name===ISA.optionalBindings?.eventAudit.sourceName&&binding===ISA.optionalBindings.eventAudit.sourceId))fail('Readonly storage mismatch '+g.name);globals.set(g.name,{name:g.name,type:t,binding,storage:true,access:g.access??'read',writable:g.access==='read_write'});}else{if(g.storage&&g.storage!=='private')fail('Unsupported global address space '+g.storage);globals.set(g.name,{name:g.name,...alloc(t),mode:g.mode,global:true,init:g.init});}}
 for(const f of ast.functions)if(used.has(f.name)){allocationOwner=f.name;const params=f.params.map(p=>({name:p.name,...alloc(type(p.type)),attributes:p.attributes??[]})),returnType=type(f.returnType),ret=alloc(returnType);functions.set(f.name,{name:f.name,label:label(),params,returnType,returnSlot:ret.slot,returnWords:ret.words,ast:f,intrinsic:intrinsicEntries.get(f.name)??null,external:externalEntries.get(f.name)??null});allocationOwner=null;}
 function valueAt(v,offset,t){return{type:t,slot:v.slot+offset,words:t.words};}
 function extract(v,member){if(v.type.kind==='struct'){const f=v.type.fields.find(f=>f.name===member);if(!f)fail('Unknown struct field '+member);return valueAt(v,f.offset,f.type);}if(v.type.kind==='vector'){const map={x:0,y:1,z:2,w:3,r:0,g:1,b:2,a:3},indices=Array.from(member,x=>map[x]);if(!indices.length||indices.some(x=>x===undefined||x>=v.type.count))fail('Invalid vector swizzle '+member);if(indices.length===1)return valueAt(v,indices[0],v.type.element);const out=alloc(vector(v.type.element,indices.length));indices.forEach((x,i)=>emit('MOV',out.slot+i,v.slot+x));return out;}fail('Member value is not vector/struct');}
 function arithmetic(op,a,b,resultType){
  if(allocationMetadata&&(containsPointer(a.type)||containsPointer(b.type))&&!['==','!='].includes(op))pointerEscapes.push('pointer-arithmetic:'+(current?.name??'$pinned'));
  const t=resultType??(a.type.kind==='vector'?a.type:b.type.kind==='vector'?b.type:a.type),out=alloc(t),as=a.type.kind==='vector'?a.type.element:a.type,bs=b.type.kind==='vector'?b.type.element:b.type;compatible(as,bs,'Scalar operands '+op);
  const kind=as.name,prefix=kind==='f32'?'F':kind==='i32'?'I':'U';let name;
  if(['==','!='].includes(op))name=(kind==='f32'?'F':'')+(op==='=='?'EQ':'NE');
  else if(['<','<=','>','>='].includes(op))name=prefix+({'<':'LT','<=':'LE','>':'GT','>=':'GE'}[op]);
  else if(['&','|','^','<<','>>'].includes(op)){if(kind==='f32'||kind==='bool')fail('Bit operator requires integer');name=({'&':'AND','|':'OR','^':'XOR','<<':'SHL','>>':kind==='i32'?'ISHR':'USHR'})[op];}
  else name=prefix+({'+':'ADD','-':'SUB','*':'MUL','/':'DIV','%':'REM'}[op]??'UNKNOWN');
  if(a.words!==1&&a.words!==out.words||b.words!==1&&b.words!==out.words)fail('Vector operand shape');
  for(let i=0;i<out.words;i++)emit(name,out.slot+i,a.slot+(a.words===1?0:i),b.slot+(b.words===1?0:i));return out;
 }
 function expr(n,hint){
  switch(n.kind){
   case'literal':{const x=literal(n.text,hint);return set(x.type,x.word);}
   case'name':{const v=lookup(n.name);if(v.storage)fail('Storage array requires indexing/address');const out=alloc(v.type);copy(out,v);return out;}
   case'member':return extract(expr(n.object),n.member);
   case'index':{const lv=lvalue(n),out=alloc(lv.type);read(lv,out);return out;}
   case'unary':{if(n.op==='&'){const lv=lvalue(n.arg);if(lv.storage)fail('Storage pointers only admitted as direct arrayLength');const a=lv.address??address(lv.slot);return{type:infer(n),slot:a.slot,words:1};}if(n.op==='*'){const lv=lvalue(n),out=alloc(lv.type);read(lv,out);return out;}const a=expr(n.arg,hint);if(allocationMetadata&&containsPointer(a.type))pointerEscapes.push('pointer-unary:'+(current?.name??'$pinned'));if(n.op==='+')return a;const out=alloc(a.type),k=a.type.kind==='vector'?a.type.element.name:a.type.name;const op=n.op==='!'?'LNOT':n.op==='~'?'NOT':n.op==='-'?k==='f32'?'FNEG':'INEG':null;if(!op)fail('Unsupported unary '+n.op);for(let i=0;i<a.words;i++)emit(op,out.slot+i,a.slot+i);return out;}
   case'binary':{
    if(abstractNumeric(n.left)&&abstractNumeric(n.right))fail('Abstract constant arithmetic requires explicit source materialization');
    if(n.op==='&&'||n.op==='||'){const out=alloc(scalar('bool')),a=expr(n.left,scalar('bool'));compatible(a.type,scalar('bool'),'Short-circuit predicate');emit('MOV',out.slot,a.slot);const rhs=label(),end=label();if(n.op==='&&')branch(a,rhs,end);else branch(a,end,rhs);mark(rhs);const b=expr(n.right,scalar('bool'));compatible(b.type,a.type,'Short-circuit RHS');emit('MOV',out.slot,b.slot);mark(end);return out;}
    let at=infer(n.left,hint),bt=infer(n.right,hint);if(absLiteral(n.left)&&!absLiteral(n.right))at=bt.kind==='vector'?bt.element:bt;if(absLiteral(n.right))bt=at.kind==='vector'?at.element:at;
    const a=expr(n.left,at),b=expr(n.right,bt);return arithmetic(n.op,a,b,infer(n,hint));
   }
   case'call':return call(n,hint);
   default:fail('Unsupported expression '+n.kind);
  }
 }
 function address(slot){const pc=rows.length,value=set(scalar('u32'),slot);if(allocationMetadata)addressConstants.push({pc,slot});return value;}
 function plusAddress(a,n){if(n===0)return a;return arithmetic('+',a,set(scalar('u32'),n));}
 function lvalue(n){
  if(n.kind==='unary'&&n.op==='*'){const pointer=expr(n.arg);if(pointer.type.kind!=='pointer')fail('Dereference requires function-local pointer');return{type:pointer.type.target,words:pointer.type.target.words,address:{...pointer,type:scalar('u32')}};}
  if(n.kind==='name'){const v=lookup(n.name);if(v.storage)return{type:v.type,binding:v.binding,storage:true,readonly:v.access!=='read_write'};if(v.mode==='const'||v.mode==='let')return{...v,readonly:true};return{...v};}
  if(n.kind==='member'){const base=lvalue(n.object),t=base.type;let offset,field;if(t.kind==='struct'){const f=t.fields.find(f=>f.name===n.member);if(!f)fail('Unknown lvalue member');offset=f.offset;field=f.type;}else if(t.kind==='vector'&&n.member.length===1){offset={x:0,y:1,z:2,w:3,r:0,g:1,b:2,a:3}[n.member];if(offset===undefined||offset>=t.count)fail('Invalid vector lvalue');field=t.element;}else fail('Only scalar vector swizzle assignment admitted');return{...base,type:field,words:field.words,...(base.address?{address:plusAddress(base.address,offset)}:{slot:base.slot+offset})};}
  if(n.kind==='index'){
   let base;
   // Indexing an rvalue aggregate (e.g. function()[i]) is legal and receives
   // an owned temporary first. Names/fields preserve their actual lvalue.
   if(['name','member','index'].includes(n.object.kind)||n.object.kind==='unary'&&n.object.op==='*')base=lvalue(n.object);else base=expr(n.object);
   const t=base.type;if(!['array','vector'].includes(t.kind))fail('Index target requires array/vector');const index=expr(n.index,scalar('u32'));if(!['u32','i32'].includes(index.type.name))fail('Integer index required');if(t.count!==null&&t.count!==undefined){const inRange=arithmetic('<',{...index,type:scalar('u32')},set(scalar('u32'),t.count),scalar('bool'));emit('GUARD',0,inRange.slot);}let offset=index;if(t.element.words!==1)offset=arithmetic('*',{...index,type:scalar('u32')},set(scalar('u32'),t.element.words));
   const addr=base.storage?offset:arithmetic('+',base.address??address(base.slot),{...offset,type:scalar('u32')});
   return{type:t.element,words:t.element.words,address:addr,...(base.storage?{storage:true,binding:base.binding}:{}),readonly:base.readonly};
  }
  fail('Unsupported assignment target '+n.kind);
 }
 function read(lv,out){for(let i=0;i<out.words;i++){if(lv.storage)emit('LOAD',out.slot+i,lv.binding,plusAddress(lv.address,i).slot);else if(lv.address)emit('LOCAL_LOAD',out.slot+i,plusAddress(lv.address,i).slot);else emit('MOV',out.slot+i,lv.slot+i);}}
 function write(lv,value){if(lv.readonly)fail(lv.storage?'Write to readonly external storage':'Write to immutable source variable');compatible(lv.type,value.type,'Store type');for(let i=0;i<value.words;i++){if(lv.storage){if(!ISA.writableBindings.includes(lv.binding)&&lv.binding!==ISA.optionalBindings?.eventAudit.sourceId)fail('Write to readonly external storage');emit('STORE',0,lv.binding,plusAddress(lv.address,i).slot,value.slot+i);}else if(lv.address)emit('LOCAL_STORE',0,plusAddress(lv.address,i).slot,value.slot+i);else emit('MOV',lv.slot+i,value.slot+i);}}
 function cast(value,t){if(allocationMetadata&&(containsPointer(value.type)||containsPointer(t)))pointerEscapes.push('pointer-cast:'+(current?.name??'$pinned'));if(value.words!==t.words)fail('Cast shape mismatch');const from=value.type.kind==='vector'?value.type.element.name:value.type.name,to=t.kind==='vector'?t.element.name:t.name,out=alloc(t);let op='MOV';if(to==='bool'&&from!=='bool'){const z=set(scalar(from),0);for(let i=0;i<t.words;i++)emit(from==='f32'?'FNE':'NE',out.slot+i,value.slot+i,z.slot);return out;}if(from!==to){if(to==='f32')op=from==='u32'||from==='bool'?'UTOF':from==='i32'?'ITOF':null;else if(from==='f32')op=to==='u32'?'FTOU':to==='i32'?'FTOI':null;else if(!['u32','i32','bool'].includes(from)||!['u32','i32','bool'].includes(to))op=null;}if(!op)fail('Unsupported scalar cast '+from+' -> '+to);for(let i=0;i<t.words;i++)emit(op,out.slot+i,value.slot+i);return out;}
 function intrinsicCall(fn,out,values){const d=fn.intrinsic;if(!d||values.length!==d.parameterWords.length||values.some((v,i)=>v.words!==d.parameterWords[i])||out.words!==d.resultWords)fail('Exact source intrinsic scalar signature '+fn.name);emit(d.opcode,out.slot,...values.map(v=>v.slot));}
 function call(n,hint){
  const name=n.callee.name;if(n.callee.kind!=='name')fail('Indirect function call');
  if(isType(name)){
   const t=constructorType(n);if(t.kind==='scalar'){if(n.args.length===0)return zero(t);if(n.args.length!==1)fail('Scalar constructor arity');return cast(expr(n.args[0],t),t);}const out=alloc(t);if(n.args.length===0){for(let i=0;i<t.words;i++)emit('SET',out.slot+i,0);return out;}
   let values;if(t.kind==='struct'){if(n.args.length!==t.fields.length)fail('Struct constructor arity');values=n.args.map((a,i)=>expr(a,t.fields[i].type));values.forEach((v,i)=>compatible(v.type,t.fields[i].type,'Struct member constructor'));}
   else{values=n.args.map(a=>expr(a,t.element));if(t.kind==='vector'&&values.length===1&&values[0].words===1){for(let i=0;i<t.words;i++){const v=cast(values[0],t.element);emit('MOV',out.slot+i,v.slot);}return out;}for(const v of values){const e=t.kind==='array'?v.type:v.type.kind==='vector'?v.type.element:v.type;compatible(e,t.element,'Aggregate constructor element');}}
   if(values.reduce((n,v)=>n+v.words,0)!==t.words)fail('Aggregate constructor shape');let at=0;for(const v of values)for(let i=0;i<v.words;i++)emit('MOV',out.slot+at++,v.slot+i);return out;
  }
  if(functions.has(name)){const fn=functions.get(name);if(n.args.length!==fn.params.length)fail('Function argument count '+name);const values=n.args.map((a,i)=>expr(a,fn.params[i].type));if(fn.intrinsic){values.forEach((v,i)=>compatible(v.type,fn.params[i].type,'Intrinsic source parameter'));const out=alloc(fn.returnType);intrinsicCall(fn,out,values);return out;}const argumentStart=rows.length;values.forEach((v,i)=>copy(fn.params[i],v));const callPc=rows.length;target('CALL',[0,0],[[2,fn.label]]);if(allocationMetadata)for(let pc=argumentStart;pc<callPc;pc++)foreignMoves.push({pc,field:1,callee:fn.name,callPc,kind:'argument'});const out=alloc(fn.returnType);for(let i=0;i<out.words;i++){const pc=emit('MOV',out.slot+i,fn.returnSlot+i);if(allocationMetadata)foreignMoves.push({pc,field:2,callee:fn.name,callPc,kind:'return'});}return out;}
  if(name==='bitcast'){if(n.args.length!==1||n.typeArgs.length!==1)fail('Bitcast arity');const value=expr(n.args[0]),t=type(n.typeArgs[0]);if(value.words!==t.words)fail('Bitcast word shape');if(allocationMetadata&&(containsPointer(value.type)||containsPointer(t)))pointerEscapes.push('bitcast:'+(current?.name??'$pinned'));const out=alloc(t);for(let i=0;i<out.words;i++)emit('MOV',out.slot+i,value.slot+i);return out;}
  if(name==='arrayLength'){const arg=n.args[0];if(n.args.length!==1||arg?.kind!=='unary'||arg.op!=='&'||arg.arg.kind!=='name')fail('arrayLength requires direct storage address');const v=lookup(arg.arg.name);if(!v.storage)fail('arrayLength requires runtime storage');const out=alloc(scalar('u32'));emit('LENGTH',out.slot,v.binding);return out;}
  if(name==='all'||name==='any'){if(n.args.length!==1)fail('Boolean reduction arity');const a=expr(n.args[0]),out=set(scalar('bool'),name==='all'?1:0);if((a.type.kind==='vector'?a.type.element.name:a.type.name)!=='bool')fail('Boolean reduction requires bool');for(let i=0;i<a.words;i++)emit(name==='all'?'AND':'OR',out.slot,out.slot,a.slot+i);return out;}
  if(name==='select'){if(n.args.length!==3)fail('select arity');let t=infer(n.args[0],hint);if(absLiteral(n.args[0])&&!absLiteral(n.args[1]))t=infer(n.args[1],hint);const a=expr(n.args[0],t),b=expr(n.args[1],t),c=expr(n.args[2]),out=alloc(a.type);if(allocationMetadata&&[a,b,c].some(v=>containsPointer(v.type)))pointerEscapes.push('pointer-select:'+(current?.name??'$pinned'));compatible(a.type,b.type,'select arms');if(c.words!==1&&c.words!==out.words)fail('select predicate shape');for(let i=0;i<out.words;i++)emit('SELECT',out.slot+i,a.slot+i,b.slot+i,c.slot+(c.words===1?0:i));return out;}
  if(['min','max','clamp'].includes(name)){if(n.args.length!==(name==='clamp'?3:2))fail('min/max/clamp arity');let t=infer(n.args[0],hint);if(absLiteral(n.args[0])&&!absLiteral(n.args[1]))t=infer(n.args[1],hint);const args=n.args.map(x=>expr(x,t));const pick=(a,b,min)=>{compatible(a.type,b.type,'min/max operands');const k=a.type.kind==='vector'?a.type.element.name:a.type.name;if(k==='f32'){const out=alloc(a.type);for(let i=0;i<out.words;i++)emit(min?'FMIN':'FMAX',out.slot+i,a.slot+i,b.slot+i);return out;}const p=arithmetic(min?'<':'>',a,b,a.type.kind==='vector'?vector(scalar('bool'),a.words):scalar('bool')),out=alloc(a.type);for(let i=0;i<out.words;i++)emit('SELECT',out.slot+i,b.slot+i,a.slot+i,p.slot+i);return out;};return name==='clamp'?pick(pick(args[0],args[1],false),args[2],true):pick(args[0],args[1],name==='min');}
  const unary={countLeadingZeros:'UCLZ',countTrailingZeros:'UCTZ',countOneBits:'POPCOUNT',sqrt:'FSQRT',floor:'FLOOR',ceil:'CEIL',trunc:'TRUNC',round:'ROUND'};
  if(unary[name]){if(n.args.length!==1)fail('Unary builtin arity');const a=expr(n.args[0],hint),out=alloc(a.type);for(let i=0;i<out.words;i++)emit(unary[name],out.slot+i,a.slot+i);return out;}
  if(name==='abs'){const a=expr(n.args[0],hint),k=a.type.kind==='vector'?a.type.element.name:a.type.name;if(k==='f32'){const out=alloc(a.type);for(let i=0;i<out.words;i++)emit('FABS',out.slot+i,a.slot+i);return out;}if(k==='u32')return a;if(k!=='i32')fail('abs scalar type');const out=alloc(a.type),z=set(scalar('i32'),0);for(let i=0;i<out.words;i++){const p=alloc(scalar('bool')),neg=alloc(scalar('i32'));emit('ILT',p.slot,a.slot+i,z.slot);emit('INEG',neg.slot,a.slot+i);emit('SELECT',out.slot+i,a.slot+i,neg.slot,p.slot);}return out;}
  fail('Unsupported builtin lowering '+name);
 }
 const flow=[];
 function statement(s){switch(s.kind){
  case'block':scopes.push(new Map());for(const row of s.body)statement(row);scopes.pop();break;
  case'decl':{const t=s.type?type(s.type):infer(s.init),value=s.init?expr(s.init,t):zero(t),v={...alloc(t),mode:s.mode};copy(v,value);bind(s.name,v);break;}
  case'assign':{const lv=lvalue(s.left);let v;if(s.op==='=')v=expr(s.right,lv.type);else{const a=alloc(lv.type);read(lv,a);v=arithmetic(s.op.slice(0,-1),a,expr(s.right,lv.type));}write(lv,v);break;}
  case'update':{const lv=lvalue(s.arg),a=alloc(lv.type);read(lv,a);const one=set(lv.type,lv.type.name==='f32'?fbits(1):1);write(lv,arithmetic(s.op==='++'?'+':'-',a,one));break;}
  case'expr':expr(s.expr);break;
  case'return':{if(s.value){const v=expr(s.value,current.returnType);copy({type:current.returnType,slot:current.returnSlot,words:current.returnWords},v);}else if(current.returnWords)fail('Missing return value '+current.name);emit('RET');break;}
  case'if':{const yes=label(),no=label(),end=label();branch(expr(s.test,scalar('bool')),yes,no);mark(yes);statement(s.then);jump(end);mark(no);if(s.else)statement(s.else);mark(end);break;}
  case'for':case'while':case'loop':{scopes.push(new Map());const head=label(),body=label(),update=label(),end=label();if(s.init)statement(s.init);mark(head);if(s.test)branch(expr(s.test,scalar('bool')),body,end);else jump(body);mark(body);flow.push({break:end,continue:update});statement(s.body);flow.pop();mark(update);if(s.update)statement(s.update);if(s.continuing)statement(s.continuing);jump(head);mark(end);scopes.pop();break;}
  case'break':{const ctx=flow.at(-1);if(!ctx)fail('break outside loop/switch');jump(ctx.break);break;}
  case'continue':{const ctx=[...flow].reverse().find(x=>x.continue);if(!ctx)fail('continue outside loop');jump(ctx.continue);break;}
  case'switch':{const value=expr(s.value),end=label(),cases=s.cases.map(c=>({...c,label:label()}));let fallback=end;for(const c of cases){if(c.selectors.includes('default')){if(fallback!==end)fail('Duplicate switch default');fallback=c.label;}for(const selector of c.selectors){if(selector==='default')continue;const next=label(),v=expr(selector,value.type),p=arithmetic('==',value,v,scalar('bool'));branch(p,c.label,next);mark(next);}}jump(fallback);flow.push({break:end});for(const c of cases){mark(c.label);statement(c.body);jump(end);}flow.pop();mark(end);break;}
  default:fail('Unsupported statement '+s.kind);
 }}
 // One explicit entry trampoline owns module-private initialization. Caller sets
 // only entry parameter slots (e.g. invocation ID), never any future state.
 const entryPc=0;scopes.push(new Map());for(const g of globals.values())if(!g.storage){const value=g.init?expr(g.init,g.type):zero(g.type);copy(g,value);}target('CALL',[0,0],[[2,functions.get(entry).label]]);emit('HALT');scopes.pop();
 for(const f of functions.values()){current=f;mark(f.label);f.entryPc=rows.length;scopes.push(new Map());for(const p of f.params)bind(p.name,{...p,mode:'let'});if(f.external){if(f.params.length!==f.external.parameterWords.length||f.params.some((p,i)=>p.words!==f.external.parameterWords[i])||f.returnWords!==f.external.resultWords)fail('Exact external scalar signature '+f.name);emit('EXTERNAL_CALL',0,f.external.id);}else if(f.intrinsic)intrinsicCall(f,{type:f.returnType,slot:f.returnSlot,words:f.returnWords},f.params);else statement(f.ast.body);emit('RET');scopes.pop();}current=null;
 for(const[i,field,l]of patches){if(!labels.has(l))fail('Unresolved source label');rows[i][field]=labels.get(l);}
 const instructions=Uint32Array.from(rows.flat()),describe=t=>t.name;
 return Object.freeze({kind:'resident-wgsl-microcode-v1',version:ISA.version,instructionWords:ISA.instructionWords,instructions,words:instructions,entryPc,localWords,callDepth,entryFunction:entry,intrinsicProfile:intrinsics,intrinsicFunctions:intrinsicFunctions===undefined?null:Object.freeze([...intrinsicFunctions]),intrinsicApproval,externalApproval,externalFunctions:Object.freeze([...functions.values()].filter(f=>f.external).map(f=>Object.freeze({id:f.external.id,name:f.name,entryPc:f.entryPc,params:Object.freeze(f.params.map(p=>({name:p.name,type:describe(p.type),slot:p.slot,offset:p.slot,words:p.words,attributes:p.attributes}))),returnSlot:f.returnWords?f.returnSlot:0,returnWords:f.returnWords,approval:f.external}))),functions:Object.freeze([...functions.values()].map(f=>Object.freeze({name:f.name,entryPc:f.entryPc,params:Object.freeze(f.params.map(p=>({name:p.name,type:describe(p.type),slot:p.slot,offset:p.slot,words:p.words,attributes:p.attributes}))),returnSlot:f.returnWords?f.returnSlot:0,returnWords:f.returnWords,returnType:describe(f.returnType),...(f.intrinsic?{intrinsic:f.intrinsic.opcode}:{}),...(f.external?{external:f.external.id}:{})}))),globals:Object.freeze([...globals.values()].map(g=>({name:g.name,type:g.type.name,...(g.storage?{binding:g.binding,storage:true}:{slot:g.slot,words:g.words,mode:g.mode})}))),sourceSha256:createHash('sha256').update(code).digest('hex'),...(allocationMetadata?{allocationMetadata:Object.freeze({kind:'resident-microcode-allocation-metadata-v1',version:1,localWords,bytecodeSha256:createHash('sha256').update(instructions).digest('hex'),allocations:Object.freeze(allocations.map(Object.freeze)),addressConstants:Object.freeze(addressConstants.map(Object.freeze)),foreignMoves:Object.freeze(foreignMoves.map(Object.freeze)),escapingPointers:Object.freeze(pointerEscapes.concat([...globals.values()].filter(g=>!g.storage&&containsPointer(g.type)).map(g=>'global:'+g.name).concat([...functions.values()].filter(f=>containsPointer(f.returnType)).map(f=>'return:'+f.name))))})}:{}),capability:Object.freeze({sourceLowering:true,unknownConstructsReject:true,recursiveCalls:false,nativeQualified:false,fullRestQualified:false,hardwarePerformance:false})});
}
