// TEST ONLY. Independent scalar source-AST execution for preparation closure
// comparisons. No microcode compiler, bytecode, VM, GPU, or physics fallback.
// Creation validates every source branch in the supported scalar subset.
// Reads/writes contain completed accesses only. Faulting accesses stop execution
// before mutation; earlier writes are intentionally retained. Logical spans do
// not change arrayLength. A zero divisor or one-million-step safety exhaustion
// is explicit invalid, never a physics miss or a claim about broader WGSL.
// The two observed private guard scalars reset once per execute. An optional
// before invocation shares those globals with the selected entry. complete
// means source return only: callers must inspect generated-helper guard globals.
import {parseMicrocodeWGSL} from '../src/resident-candidate/microcode-parser.mjs';

const BINDINGS=Object.freeze({rc_state:0,rc_program:1,rc_geometry:2,rc_scratch:3,rc_inputs:4,rc_event_audit:5});
const READ_ONLY=new Set([1,2,4]);
const PRIVATE_GLOBALS=new Set(['rc_gp_error','rc_gp_bank']);
const ENTRY='rc_geometry_numeric_prepare';
const U32=value=>Number.isInteger(value)&&value>=0&&value<=0xffffffff;
const unsupported=message=>{throw new TypeError('Preparation source subset: '+message);};
const requireSubset=(ok,message)=>{if(!ok)unsupported(message);};
const scalar=type=>{if(type===null)return'void';requireSubset(type&&['u32','bool'].includes(type.name)&&type.args.length===0,'only scalar u32/bool types are supported');return type.name;};
function literal(text){if(text==='true'||text==='false')return{type:'bool',value:text==='true'};requireSubset(/^(?:0x[\da-f]+|\d+)u$/i.test(text),'only explicit u32 or bool literals are supported: '+text);const value=Number(text.slice(0,-1));requireSubset(U32(value),'u32 literal range');return{type:'u32',value};}
class Scope {
 constructor(parent=null){this.parent=parent;this.values=new Map();}
 add(name,value){requireSubset(!this.values.has(name),'duplicate local '+name);this.values.set(name,value);}
 get(name){if(this.values.has(name))return this.values.get(name);if(this.parent)return this.parent.get(name);unsupported('unknown local '+name);}
}
function validate(ast){
 requireSubset(!ast.aliases.length&&!ast.structs.length,'no aliases or structs in the extracted closure');
 const globals=new Map();
 for(const global of ast.globals){requireSubset(PRIVATE_GLOBALS.has(global.name)&&!globals.has(global.name)&&global.mode==='var'&&global.storage==='private'&&global.access===null&&global.init===null&&!global.attributes.length&&scalar(global.type)==='u32','only observed zero-initialized private u32 guard globals are supported');globals.set(global.name,{type:'u32',mutable:true});}
 const functions=new Map(),calls=new Map();
 for(const fn of ast.functions){requireSubset(!functions.has(fn.name),'duplicate function '+fn.name);requireSubset(!fn.attributes.length,'function attributes are unsupported');fn.params.forEach(p=>{scalar(p.type);requireSubset(!p.attributes.length,'parameter attributes are unsupported');});scalar(fn.returnType);functions.set(fn.name,fn);calls.set(fn.name,new Set());}
 const root=functions.get(ENTRY);requireSubset(root&&root.params.length===6&&root.params.every(p=>scalar(p.type)==='u32')&&scalar(root.returnType)==='u32','six-u32 -> u32 root signature required');
 for(const fn of functions.values()){
  const globalScope=new Scope();for(const[name,value]of globals)globalScope.add(name,value);
  const rootScope=new Scope(globalScope);for(const p of fn.params)rootScope.add(p.name,{type:scalar(p.type),mutable:false});
  const expression=(node,scope)=>{
   requireSubset(!!node,'missing expression');
   switch(node.kind){
    case'literal':return literal(node.text).type;
    case'name':return scope.get(node.name).type;
    case'index':requireSubset(node.object.kind==='name'&&Object.hasOwn(BINDINGS,node.object.name),'only known storage arrays can be indexed');requireSubset(expression(node.index,scope)==='u32','storage index must be u32');return'u32';
    case'unary':{const type=expression(node.arg,scope);requireSubset(node.op==='!'&&type==='bool'||node.op==='~'&&type==='u32','unsupported scalar unary operation '+node.op);return type;}
    case'binary':{const a=expression(node.left,scope),b=expression(node.right,scope);requireSubset(a===b,'mixed scalar binary operands');if(['&&','||'].includes(node.op)){requireSubset(a==='bool','logical operands must be bool');return'bool';}if(['==','!='].includes(node.op))return'bool';requireSubset(a==='u32','integer binary operands required');requireSubset(['+','-','*','/','%','&','|','^','<<','>>','<','<=','>','>='].includes(node.op),'unknown binary operation '+node.op);return['<','<=','>','>='].includes(node.op)?'bool':'u32';}
    case'call':{
     requireSubset(node.callee.kind==='name'&&!node.typeArgs.length,'only named non-templated calls supported');const name=node.callee.name;
     if(name==='arrayLength'){requireSubset(node.args.length===1&&node.args[0].kind==='unary'&&node.args[0].op==='&'&&node.args[0].arg.kind==='name'&&Object.hasOwn(BINDINGS,node.args[0].arg.name),'arrayLength needs a known storage address');return'u32';}
     const types=node.args.map(arg=>expression(arg,scope));
     if(name==='u32'){requireSubset(types.length===1&&['u32','bool'].includes(types[0]),'u32 conversion takes one scalar');return'u32';}
     if(name==='select'){requireSubset(types.length===3&&types[0]===types[1]&&types[0]!=='void'&&types[2]==='bool','select requires equal scalar values and bool condition');return types[0];}
     const target=functions.get(name);requireSubset(!!target,'unknown function '+name);requireSubset(types.length===target.params.length&&types.every((type,i)=>type===scalar(target.params[i].type)),'function argument types for '+name);calls.get(fn.name).add(name);return scalar(target.returnType);
    }
    default:unsupported('unsupported expression '+node.kind);
   }
  };
  const destination=(node,scope)=>{if(node.kind==='name'){const local=scope.get(node.name);requireSubset(local.mutable,'write to immutable local '+node.name);return local.type;}requireSubset(node.kind==='index','assignment destination must be local/storage');return expression(node,scope);};
  const statement=(node,scope)=>{
   switch(node.kind){
    case'block':{const child=new Scope(scope);node.body.forEach(s=>statement(s,child));return;}
    case'decl':{requireSubset(['let','var'].includes(node.mode)&&node.init!==null,'initialized let/var declarations only');const type=expression(node.init,scope);requireSubset(type!=='void','void initializer');if(node.type)requireSubset(type===scalar(node.type),'initializer type mismatch');scope.add(node.name,{type,mutable:node.mode==='var'});return;}
    case'assign':{const type=destination(node.left,scope);requireSubset(type===expression(node.right,scope),'assignment type mismatch');requireSubset(node.op==='='||type==='u32'&&['+=','-=','*=','/=','%=','&=','|=','^=','<<=','>>='].includes(node.op),'unsupported assignment '+node.op);return;}
    case'update':requireSubset(destination(node.arg,scope)==='u32'&&['++','--'].includes(node.op),'u32 update required');return;
    case'expr':requireSubset(node.expr.kind==='call','only call expression statements supported');expression(node.expr,scope);return;
    case'return':requireSubset((node.value?expression(node.value,scope):'void')===scalar(fn.returnType),'return type mismatch in '+fn.name);return;
    case'if':requireSubset(expression(node.test,scope)==='bool','if condition must be bool');statement(node.then,scope);if(node.else)statement(node.else,scope);return;
    case'for':{requireSubset(node.init&&node.test&&node.update,'only explicit bounded-source for forms supported');const loop=new Scope(scope);statement(node.init,loop);requireSubset(expression(node.test,loop)==='bool','for condition must be bool');statement(node.update,loop);statement(node.body,loop);return;}
    case'switch':{requireSubset(expression(node.value,scope)==='u32','switch value must be u32');const selectors=new Set();for(const c of node.cases){for(const s of c.selectors){const key=s==='default'?'default':(requireSubset(s.kind==='literal'&&literal(s.text).type==='u32','literal u32 case selectors only'),literal(s.text).value);requireSubset(!selectors.has(key),'duplicate switch selector');selectors.add(key);}statement(c.body,scope);}return;}
    default:unsupported('unsupported statement '+node.kind);
   }
  };
  statement(fn.body,rootScope);
 }
 const active=new Set(),done=new Set();const visit=name=>{requireSubset(!active.has(name),'recursive function call '+name);if(done.has(name))return;active.add(name);for(const next of calls.get(name))visit(next);active.delete(name);done.add(name);};for(const name of functions.keys())visit(name);
 return {functions,globals};
}
class SourceFault extends Error{constructor(code){super(code);this.code=code;}}
class ReturnValue{constructor(value){this.value=value;}}
const fault=code=>{throw new SourceFault(code);};
function arithmetic(op,a,b){
 switch(op){
  case'+':return(a+b)>>>0;case'-':return(a-b)>>>0;case'*':return Math.imul(a,b)>>>0;
  case'/':if(b===0)fault('arithmeticDomain');return Math.floor(a/b)>>>0;
  case'%':if(b===0)fault('arithmeticDomain');return(a%b)>>>0;
  case'&':return(a&b)>>>0;case'|':return(a|b)>>>0;case'^':return(a^b)>>>0;case'<<':return(a<<(b&31))>>>0;case'>>':return a>>>(b&31);
  case'==':return a===b;case'!=':return a!==b;case'<':return a<b;case'<=':return a<=b;case'>':return a>b;case'>=':return a>=b;
  default:unsupported('unexpected validated binary '+op);
 }
}
export function createPreparationSourceReference({testOnly=false,code}={}){
 if(testOnly!==true)throw new TypeError('Explicit testOnly:true required for preparation source reference');
 const {functions,globals:globalDefinitions}=validate(parseMicrocodeWGSL(code));
 return Object.freeze({execute(args,{bindings,spans,entry=ENTRY,before}={}){
  const invocation=(name,values)=>{const target=functions.get(name);if(!target||!target.params.every(p=>scalar(p.type)==='u32')||!Array.isArray(values)&&!(values instanceof Uint32Array)||values.length!==target.params.length||!Array.from(values).every(U32))throw new TypeError(name===ENTRY?'Six u32 arguments required':'Known entry with exact u32 arguments required');return Array.from(values);};
  args=invocation(entry,args);
  if(before!==undefined){if(!before||typeof before!=='object')throw new TypeError('Explicit before entry/args required');before={entry:before.entry,args:invocation(before.entry,before.args)};}
  if(!Array.isArray(bindings)||bindings.length!==6||bindings.some(b=>!(b instanceof Uint32Array)))throw new TypeError('Six explicit Uint32Array storage bindings required');
  const allowed=new Map();
  if(spans!==undefined){
   if(!spans||typeof spans!=='object'||Array.isArray(spans))throw new TypeError('Optional spans must map binding 0/3 to [base,length] arrays');
   for(const[key,rows]of Object.entries(spans)){
    if(!['0','3'].includes(key)||!Array.isArray(rows))throw new TypeError('Only mutable candidate state/scratch may have logical spans');
    const binding=Number(key),copy=rows.map(row=>{if(!Array.isArray(row)||row.length!==2||!row.every(U32)||row[0]+row[1]>bindings[binding].length)throw new TypeError('Logical spans must lie within their exact storage binding');return [...row];});
    allowed.set(binding,copy);
   }
  }
  const privateScope=new Scope();for(const name of globalDefinitions.keys())privateScope.add(name,{value:0});
  const snapshotGlobals=()=>Object.fromEntries([...privateScope.values].map(([name,local])=>[name,local.value]));
  const reads=[],writes=[];let steps=0,beforeResult;const step=()=>{if(++steps>1000000)fault('executionBudget');};
  const access=(name,index,write,value)=>{
   const binding=BINDINGS[name],array=bindings[binding];
   if(!U32(index)||index>=array.length)fault('storageRange');
   if(allowed.has(binding)&&!allowed.get(binding).some(([base,length])=>index>=base&&index-base<length))fault('storageRange');
   if(write){if(READ_ONLY.has(binding))fault('readonlyBinding');array[index]=value;writes.push({binding,index,value:value>>>0});return;}
   const result=array[index];reads.push({binding,index,value:result});return result;
  };
  const expression=(node,scope)=>{step();switch(node.kind){
   case'literal':return literal(node.text).value;
   case'name':return scope.get(node.name).value;
   case'index':return access(node.object.name,expression(node.index,scope),false);
   case'unary':{const value=expression(node.arg,scope);return node.op==='!'?!value:(~value)>>>0;}
   case'binary':{const a=expression(node.left,scope);if(node.op==='&&')return a&&expression(node.right,scope);if(node.op==='||')return a||expression(node.right,scope);return arithmetic(node.op,a,expression(node.right,scope));}
   case'call':{const name=node.callee.name;if(name==='arrayLength')return bindings[BINDINGS[node.args[0].arg.name]].length;const args=node.args.map(arg=>expression(arg,scope));if(name==='u32')return Number(args[0])>>>0;if(name==='select')return args[2]?args[1]:args[0];return call(name,args);}
   default:unsupported('unexpected validated expression '+node.kind);
  }};
  const destination=(node,scope)=>node.kind==='name'?{local:scope.get(node.name)}:{name:node.object.name,index:expression(node.index,scope)};
  const get=where=>where.local?where.local.value:access(where.name,where.index,false);
  const set=(where,value)=>{if(where.local)where.local.value=value;else access(where.name,where.index,true,value);};
  const statement=(node,scope)=>{step();switch(node.kind){
   case'block':{const child=new Scope(scope);for(const s of node.body)statement(s,child);return;}
   case'decl':scope.add(node.name,{value:expression(node.init,scope)});return;
   case'assign':{const where=destination(node.left,scope);if(node.op==='=')set(where,expression(node.right,scope));else{const prior=get(where),rhs=expression(node.right,scope);set(where,arithmetic(node.op.slice(0,-1),prior,rhs));}return;}
   case'update':{const where=destination(node.arg,scope);set(where,arithmetic(node.op==='++'?'+':'-',get(where),1));return;}
   case'expr':expression(node.expr,scope);return;
   case'return':throw new ReturnValue(node.value?expression(node.value,scope):undefined);
   case'if':if(expression(node.test,scope))statement(node.then,scope);else if(node.else)statement(node.else,scope);return;
   case'for':{const loop=new Scope(scope);statement(node.init,loop);while(expression(node.test,loop)){statement(node.body,loop);statement(node.update,loop);}return;}
   case'switch':{const value=expression(node.value,scope),selected=node.cases.find(c=>c.selectors.some(s=>s!=='default'&&literal(s.text).value===value))??node.cases.find(c=>c.selectors.includes('default'));if(selected)statement(selected.body,scope);return;}
   default:unsupported('unexpected validated statement '+node.kind);
  }};
  const call=(name,args)=>{step();const fn=functions.get(name),scope=new Scope(privateScope);fn.params.forEach((p,i)=>scope.add(p.name,{value:args[i]}));let value;try{statement(fn.body,scope);}catch(error){if(!(error instanceof ReturnValue))throw error;value=error.value;}const type=scalar(fn.returnType);if(type==='u32'&&!U32(value)||type==='bool'&&typeof value!=='boolean'||type==='void'&&value!==undefined)fault('returnType');return value;};
  try{if(before)beforeResult=call(before.entry,before.args);const result=call(entry,args);return{status:'complete',result,reads,writes,globals:snapshotGlobals(),...(before?{beforeResult}:{})};}
  catch(error){if(!(error instanceof SourceFault))throw error;return{status:'invalid',result:null,reads,writes,error:error.code,globals:snapshotGlobals(),...(before?{beforeResult}:{})};}
 }});
}
