/* SPDX-License-Identifier: Apache-2.0
 * Fail-closed syntax reader for source WGSL -> resident microcode lowering.
 * This is not a WGSL validator or a physics implementation. Unsupported syntax
 * is rejected with its source position; no statement is silently omitted.
 */
const BINARY = Object.freeze({'||':1,'&&':2,'|':3,'^':4,'&':5,'==':6,'!=':6,'<':7,'<=':7,'>':7,'>=':7,'<<':8,'>>':8,'+':9,'-':9,'*':10,'/':10,'%':10});
const ASSIGN = new Set(['=','+=','-=','*=','/=','%=','&=','|=','^=','<<=','>>=']);
const TEMPLATE_CALL = /^(?:array|vec[234]|mat[234]x[234]|bitcast|atomic|ptr)$/;
const IDENT = /^[A-Za-z_][A-Za-z_0-9]*$/;
function syntax(source, at, message) {
  const before=source.slice(0,at), line=before.split('\n').length, column=at-(before.lastIndexOf('\n')+1)+1;
  const error=new SyntaxError(`WGSL parser ${line}:${column} (offset ${at}): ${message}`);
  error.offset=at;error.line=line;error.column=column;throw error;
}
export function tokenizeMicrocodeWGSL(source) {
  if(typeof source!=='string')throw new TypeError('WGSL source string required');
  const tokens=[];let at=0;
  while(at<source.length){
    if(/\s/.test(source[at])){at++;continue;}
    if(source.startsWith('//',at)){const next=source.indexOf('\n',at+2);at=next<0?source.length:next;continue;}
    if(source.startsWith('/*',at)){const start=at;let depth=1;at+=2;while(at<source.length&&depth){if(source.startsWith('/*',at)){depth++;at+=2;}else if(source.startsWith('*/',at)){depth--;at+=2;}else at++;}if(depth)syntax(source,start,'Unterminated block comment');continue;}
    const tail=source.slice(at);
    const number=/^(?:0[xX](?:[0-9a-fA-F]+(?:\.[0-9a-fA-F]*)?|\.[0-9a-fA-F]+)(?:[pP][+-]?\d+)?[uifh]?|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?[uifh]?)/.exec(tail);
    if(number){const text=number[0];tokens.push({text,kind:'number',at});at+=text.length;continue;}
    const id=/^[A-Za-z_][A-Za-z_0-9]*/.exec(tail);
    if(id){tokens.push({text:id[0],kind:'identifier',at});at+=id[0].length;continue;}
    const op=/^(?:>>=|<<=|->|==|!=|<=|>=|&&|\|\||<<|>>|\+\+|--|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|[{}()[\],;:.@+\-*/%&|^!~<>=])/.exec(tail);
    if(!op)syntax(source,at,'Unsupported character '+JSON.stringify(source[at]));
    tokens.push({text:op[0],kind:'operator',at});at+=op[0].length;
  }
  tokens.push({text:'<eof>',kind:'eof',at:source.length});return tokens;
}
class Parser {
  constructor(source){this.source=source;this.tokens=tokenizeMicrocodeWGSL(source);this.at=0;}
  token(){return this.tokens[this.at];}
  is(text){return this.token().text===text;}
  take(text){if(this.is(text)){this.at++;return true;}return false;}
  error(message){syntax(this.source,this.token().at,message);}
  expect(text){if(!this.take(text))this.error('Expected '+JSON.stringify(text)+', got '+JSON.stringify(this.token().text));}
  name(){const t=this.token();if(t.kind!=='identifier')this.error('Identifier required');this.at++;return t.text;}
  angle(){const t=this.token();if(t.text==='>'){this.at++;return;}if(t.text.startsWith('>')){this.tokens[this.at]={...t,text:t.text.slice(1),at:t.at+1};return;}this.error('Expected closing type angle');}
  attributes(){const result=[];while(this.take('@')){const name=this.name(),args=[];if(this.take('(')){if(!this.is(')')){do{args.push(this.expression());}while(this.take(',')&&!this.is(')'));}this.expect(')');}result.push({name,args});}return result;}
  type(){const name=this.name(),args=[];if(this.take('<')){let i=0;do{if(name==='array'&&i===1)args.push(this.expression(0,new Set([',','>','>>','>=','>>='])));else args.push(this.type());i++;}while(this.take(','));this.angle();}return{name,args};}
  typeArguments(name){this.expect('<');const args=[];let i=0;do{if(name==='array'&&i===1)args.push(this.expression(0,new Set([',','>','>>','>=','>>='])));else args.push(this.type());i++;}while(this.take(','));this.angle();return args;}
  expression(min=0,stops=null){
    let value=this.prefix(stops);
    while(true){const op=this.token().text;if(stops?.has(op))break;const precedence=BINARY[op];if(precedence===undefined||precedence<min)break;this.at++;const right=this.expression(precedence+1,stops);value={kind:'binary',op,left:value,right};}
    return value;
  }
  prefix(stops){
    const token=this.token();let value;
    if(['!','~','-','+','&','*'].includes(token.text)){this.at++;return{kind:'unary',op:token.text,arg:this.prefix(stops)};}
    if(this.take('(')){value=this.expression();this.expect(')');}
    else if(token.kind==='number'||token.text==='true'||token.text==='false'){this.at++;value={kind:'literal',text:token.text};}
    else if(token.kind==='identifier'){this.at++;value={kind:'name',name:token.text};}
    else this.error('Expression required, got '+JSON.stringify(token.text));
    while(true){
      let typeArgs=[];
      if(this.is('<')&&value.kind==='name'&&TEMPLATE_CALL.test(value.name))typeArgs=this.typeArguments(value.name);
      if(this.take('(')){const args=[];if(!this.is(')')){do{args.push(this.expression());}while(this.take(',')&&!this.is(')'));}this.expect(')');value={kind:'call',callee:value,args,typeArgs};}
      else if(typeArgs.length)this.error('Templated expression must be a constructor/call');
      else if(this.take('[')){const index=this.expression();this.expect(']');value={kind:'index',object:value,index};}
      else if(this.take('.'))value={kind:'member',object:value,member:this.name()};
      else break;
    }
    return value;
  }
  declaration(semicolon=true){
    const mode=this.name();if(!['let','var','const'].includes(mode))this.error('Unsupported declaration '+mode);
    if(this.is('<'))this.error('Function-local address-space qualifier is not supported');
    const name=this.name(),type=this.take(':')?this.type():null,init=this.take('=')?this.expression():null;
    if(mode!=='var'&&!init)this.error(mode+' requires an initializer');if(!type&&!init)this.error('Declaration requires a type or initializer');
    if(semicolon)this.expect(';');return{kind:'decl',mode,name,type,init};
  }
  simple(semicolon=true){
    if(['var','let','const'].includes(this.token().text))return this.declaration(semicolon);
    const left=this.expression();let result;
    if(ASSIGN.has(this.token().text)){const op=this.token().text;this.at++;result={kind:'assign',op,left,right:this.expression()};}
    else if(this.is('++')||this.is('--')){const op=this.token().text;this.at++;result={kind:'update',op,arg:left};}
    else result={kind:'expr',expr:left};
    if(semicolon)this.expect(';');return result;
  }
  block(){this.expect('{');const body=[];while(!this.is('}')){if(this.is('<eof>'))this.error('Unterminated statement block');body.push(this.statement());}this.expect('}');return{kind:'block',body};}
  conditional(){this.expect('if');const test=this.expression(),then=this.block();let otherwise=null;if(this.take('else'))otherwise=this.is('if')?this.conditional():this.block();return{kind:'if',test,then,else:otherwise};}
  statement(){
    if(this.is('{'))return this.block();
    if(this.take(';'))return{kind:'block',body:[]};
    if(this.is('if'))return this.conditional();
    if(this.take('for')){this.expect('(');const init=this.is(';')?null:this.simple(false);this.expect(';');const test=this.is(';')?null:this.expression();this.expect(';');const update=this.is(')')?null:this.simple(false);this.expect(')');return{kind:'for',init,test,update,body:this.block()};}
    if(this.take('while')){const test=this.expression();return{kind:'while',test,body:this.block()};}
    if(this.take('loop')){this.expect('{');const body=[];let continuing=null;while(!this.is('}')){if(this.take('continuing')){continuing=this.block();if(!this.is('}'))this.error('continuing must be the last loop item');break;}body.push(this.statement());}this.expect('}');return{kind:'loop',body:{kind:'block',body},continuing};}
    if(this.take('switch')){const value=this.expression();this.expect('{');const cases=[];while(!this.is('}')){const selectors=[];if(this.take('default'))selectors.push('default');else{this.expect('case');do{selectors.push(this.take('default')?'default':this.expression());}while(this.take(',')&&!this.is(':')&&!this.is('{'));}this.take(':');cases.push({selectors,body:this.block()});}this.expect('}');return{kind:'switch',value,cases};}
    if(this.take('return')){const value=this.is(';')?null:this.expression();this.expect(';');return{kind:'return',value};}
    if(this.take('break')){if(this.is('if'))this.error('break if requires explicit lowerer support');this.expect(';');return{kind:'break'};}
    if(this.take('continue')){this.expect(';');return{kind:'continue'};}
    if(['discard','fallthrough','continuing','const_assert','enable','requires','diagnostic'].includes(this.token().text))this.error('Unsupported statement '+this.token().text);
    return this.simple();
  }
  module(){
    const result={aliases:[],structs:[],globals:[],functions:[]};
    while(!this.is('<eof>')){
      if(this.take(';'))continue;
      const attributes=this.attributes(),kind=this.token().text;
      if(this.take('alias')){if(attributes.length)this.error('Alias attributes unsupported');const name=this.name();this.expect('=');const type=this.type();this.expect(';');result.aliases.push({name,type});}
      else if(this.take('struct')){if(attributes.length)this.error('Struct attributes unsupported');const name=this.name();this.expect('{');const fields=[];while(!this.is('}')){const attrs=this.attributes();if(attrs.length)this.error('Struct member layout attributes require explicit lowerer support');const field=this.name();this.expect(':');const type=this.type();fields.push({name:field,type});if(!this.take(',')&&!this.is('}'))this.error('Struct fields require commas');}this.expect('}');this.take(';');result.structs.push({name,fields});}
      else if(this.take('fn')){const name=this.name();this.expect('(');const params=[];if(!this.is(')')){do{const attrs=this.attributes(),param=this.name();this.expect(':');params.push({name:param,type:this.type(),attributes:attrs});}while(this.take(',')&&!this.is(')'));}this.expect(')');const returnType=this.take('->')?this.type():null;result.functions.push({name,params,returnType,body:this.block(),attributes});}
      else if(['var','const','let'].includes(kind)){this.at++;let storage=null,access=null;if(this.take('<')){storage=this.name();if(this.take(','))access=this.name();this.angle();}const name=this.name(),type=this.take(':')?this.type():null,init=this.take('=')?this.expression():null;this.expect(';');if(!type&&!init)this.error('Global declaration needs a type or initializer');if(kind!=='var'&&!init)this.error('Global '+kind+' requires initializer');result.globals.push({name,type,storage,access,init,attributes,mode:kind});}
      else this.error('Unsupported module declaration '+JSON.stringify(kind));
    }
    return result;
  }
}
export function parseMicrocodeWGSL(source){return new Parser(source).module();}
