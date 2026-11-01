/* SPDX-License-Identifier: Apache-2.0
 * Fixed-layout pilot: authenticated integer-only original preparation closure.
 * Access instrumentation is transport, not substituted physics or arithmetic.
 */
import {createHash} from './source-sha256.mjs';
import {parseMicrocodeWGSL} from './microcode-parser.mjs';
import {GEOMETRY_PREPARATION_SOURCE_V1 as source} from './geometry-preparation-source-v1.mjs';
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export const PREPARATION_PROFILE='source-geometry-preparation-count2-v1';
const ast=parseMicrocodeWGSL(source),root=ast.functions.find(x=>x.name==='rc_geometry_numeric_prepare');
const bindings=Object.freeze({rc_state:0,rc_program:1,rc_geometry:2,rc_scratch:3});
const layout=Object.freeze({count:2,bankWords:62976,requestBase:127128,requestWords:24,scratchWords:13632,stateWords:127176,programWords:874992,geometryWords:25408,scratchBindingWords:27264,numericProfile:'source-f32-preserved-v1',numericProfileCode:2});
const dependencies=Object.freeze(Object.fromEntries(ast.functions.map(f=>[f.name,hash(f)]).sort()));
export const PREPARATION_DESCRIPTOR=Object.freeze({kind:'source-geometry-preparation-descriptor-v1',profile:PREPARATION_PROFILE,name:root.name,opcode:'GEOMETRY_NUMERIC_PREPARE',parameterWords:Object.freeze([1,1,1,1,1,1]),resultWords:1,family:'preparation',layout,
 sourceSha256:'5a18bbbbd646454f2e00f7b1422773b2851b64d5ff165626f2a9f835ff86c0e7',nativeSourceSha256:hash(source),signatureSha256:hash({params:root.params,returnType:root.returnType}),bodySha256:hash(root.body),dependencies,closureSha256:hash(dependencies),declarationsSha256:hash({aliases:ast.aliases,structs:ast.structs,globals:ast.globals}),layoutSha256:hash(layout),profileSha256:hash([PREPARATION_PROFILE,layout.numericProfile,layout.numericProfileCode]),storageBindingsSha256:hash(bindings)});
export function assertPreparationDescriptor(d,{count=2}={}){if(count!==2||!d||typeof d!=='object'||hash(d)!==hash(PREPARATION_DESCRIPTOR))throw new TypeError('Exact count2 preparation descriptor/source/layout/profile required');return PREPARATION_DESCRIPTOR;}
export function preparationSourceWGSL(){return source;}
export function approvePreparationSource(code,{storageBindings=bindings}={}){
 const got=parseMicrocodeWGSL(code),functions=new Map(got.functions.map(f=>[f.name,f]));
 for(const f of ast.functions)if(!functions.has(f.name)||hash(functions.get(f.name))!==hash(f))throw new TypeError('Exact preparation source signature/body/dependency required: '+f.name);
 for(const[name,id]of Object.entries(bindings)){
  const g=got.globals.find(x=>x.name===name),b=g?.attributes.find(x=>x.name==='binding'),group=g?.attributes.find(x=>x.name==='group');
  if(storageBindings[name]!==id||g?.storage!=='storage'||g.access!==([0,3].includes(id)?'read_write':'read')||g.type?.name!=='array'||g.type.args.length!==1||g.type.args[0].name!=='u32'||g.type.args[0].args.length||b?.args.length!==1||Number(b.args[0].text)!==id||group?.args.length!==1||Number(group.args[0].text)!==0)throw new TypeError('Exact preparation storage binding required: '+name);
 }
 return PREPARATION_DESCRIPTOR;
}
export function preparationSpans(bank){if(bank!==0&&bank!==layout.bankWords)throw new RangeError('Preparation candidate bank admission');return{0:[[bank,layout.bankWords],[layout.requestBase+bank/layout.bankWords*layout.requestWords,layout.requestWords]],3:[[bank/layout.bankWords*layout.scratchWords,layout.scratchWords]]};}
export function assertPreparationInputs(args,arrays,{lane}={}){
 if(!Array.isArray(args)||args.length!==6||args.some(x=>!Number.isInteger(x)||x<0||x>0xffffffff))throw new TypeError('Six original u32 preparation arguments required');
 preparationSpans(args[0]);
 if(lane!==undefined&&(!Number.isInteger(lane)||lane<0||lane>=layout.count||args[0]!==lane*layout.bankWords))throw new RangeError('Preparation executing lane must own candidate bank');
 for(const[id,n]of [[0,layout.stateWords],[1,layout.programWords],[2,layout.geometryWords],[3,layout.scratchBindingWords]])if(!(arrays[id] instanceof Uint32Array)||arrays[id].length!==n)throw new RangeError('Exact preparation binding length '+id);
}
// Re-emit ONLY this approved scalar subset. Integer expressions/branches/call
// order are unchanged; storage indexing becomes checked access with a sticky
// first error. No later write occurs after failure, including nested callees.
function expr(n){switch(n.kind){
 case'literal':return n.text;case'name':return n.name;
 case'unary':return'('+n.op+expr(n.arg)+')';
 case'binary':return'('+expr(n.left)+n.op+expr(n.right)+')';
 case'call':if(n.typeArgs?.length)throw Error('No templated preparation calls');return expr(n.callee)+'('+n.args.map(expr).join(',')+')';
 case'index':if(n.object.kind!=='name'||bindings[n.object.name]===undefined)throw Error('Exact preparation storage access required');return'rc_gp_read('+bindings[n.object.name]+'u,'+expr(n.index)+')';
 default:throw Error('Unapproved preparation expression '+n.kind);
}}
function stmt(s,inline=false){const end=inline?'':';';switch(s.kind){
 case'block':return'{'+s.body.map(x=>stmt(x)).join('')+'}';
 case'decl':return s.mode+' '+s.name+(s.type?':'+s.type.name:'')+(s.init?'='+expr(s.init):'')+end;
 case'assign':if(s.left.kind==='index'){if(s.op!=='='||s.left.object.kind!=='name'||![0,3].includes(bindings[s.left.object.name]))throw Error('Exact preparation storage store required');return'rc_gp_write('+bindings[s.left.object.name]+'u,'+expr(s.left.index)+','+expr(s.right)+')'+end;}return expr(s.left)+s.op+expr(s.right)+end;
 case'update':return expr(s.arg)+s.op+end;case'expr':return expr(s.expr)+end;case'return':return'return'+(s.value?' '+expr(s.value):'')+';';
 case'if':return'if('+expr(s.test)+')'+stmt(s.then)+(s.else?'else '+stmt(s.else):'');
 case'for':return'for('+stmt(s.init,true)+';'+expr(s.test)+';'+stmt(s.update,true)+')'+stmt(s.body);
 case'switch':return'switch '+expr(s.value)+'{'+s.cases.map(c=>(c.selectors[0]==='default'?'default':'case '+c.selectors.map(expr).join(','))+':'+stmt(c.body)).join('')+'}';
 default:throw Error('Unapproved preparation statement '+s.kind);
}}
export function preparationNativeWGSL(){
 const bodies=ast.functions.map(f=>'fn '+f.name+'('+f.params.map(p=>p.name+':'+p.type.name).join(',')+')'+(f.returnType?'->'+f.returnType.name:'')+stmt(f.body)).join('\n');
 return `var<private> rc_gp_error:u32;var<private> rc_gp_bank:u32;
fn rc_gp_span(address:u32,base:u32,n:u32)->bool{return address>=base&&address-base<n;}
fn rc_gp_length(binding:u32)->u32{switch binding{case 0u:{return arrayLength(&rc_state);}case 1u:{return arrayLength(&rc_program);}case 2u:{return arrayLength(&rc_geometry);}default:{return arrayLength(&rc_scratch);}}}
fn rc_gp_valid(binding:u32,address:u32)->bool{
 if(rc_gp_error!=0u){return false;}if(address>=rc_gp_length(binding)){rc_gp_error=5u;return false;}
 if(binding==0u&&!rc_gp_span(address,rc_gp_bank,62976u)&&!rc_gp_span(address,127128u+(rc_gp_bank/62976u)*24u,24u)){rc_gp_error=5u;return false;}
 if(binding==3u&&!rc_gp_span(address,(rc_gp_bank/62976u)*13632u,13632u)){rc_gp_error=5u;return false;}return true;
}
fn rc_gp_read(binding:u32,address:u32)->u32{if(!rc_gp_valid(binding,address)){return 0u;}switch binding{case 0u:{return rc_state[address];}case 1u:{return rc_program[address];}case 2u:{return rc_geometry[address];}default:{return rc_scratch[address];}}}
fn rc_gp_write(binding:u32,address:u32,value:u32){if(!rc_gp_valid(binding,address)){return;}if(binding==0u){rc_state[address]=value;}else if(binding==3u){rc_scratch[address]=value;}else{rc_gp_error=6u;}}
fn rc_gp_begin(bank:u32)->bool{rc_gp_error=0u;rc_gp_bank=bank;if((bank!=0u&&bank!=62976u)||arrayLength(&rc_state)!=127176u||arrayLength(&rc_program)!=874992u||arrayLength(&rc_geometry)!=25408u||arrayLength(&rc_scratch)!=27264u){rc_gp_error=8u;return false;}return true;}
`+bodies;
}
