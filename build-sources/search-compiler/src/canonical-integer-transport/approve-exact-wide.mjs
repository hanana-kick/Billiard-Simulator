/** Build-time only. Exact declaration plus closed builtin type/function namespace. */
import {parseMicrocodeWGSL,tokenizeMicrocodeWGSL} from '../resident-candidate/microcode-parser.mjs';
import {EXACT_WIDE_SOURCE} from './exact-wide-source.mjs';
const expected=JSON.stringify(parseMicrocodeWGSL(EXACT_WIDE_SOURCE).functions[0]);
export function approveExactWide(code,ast){
 const matches=ast.functions.filter(f=>f.name==='wide');if(!matches.length)return false;
 if(matches.length!==1||JSON.stringify(matches[0])!==expected)throw Error('Unapproved exact wide source closure');
 for(const x of [...ast.aliases,...ast.structs,...ast.globals,...ast.functions])if(['u32','vec2'].includes(x.name))throw Error('Shadowed exact wide builtin closure');
 const t=tokenizeMicrocodeWGSL(code);let found=0;
 for(let i=0;i<t.length-1;i++)if(t[i].text==='fn'&&t[i+1].text==='wide'){
  let j=i;while(t[j].text!=='{')j++;let depth=1;j++;while(depth&&j<t.length){if(t[j].text==='{')depth++;if(t[j].text==='}')depth--;j++;}
  if(code.slice(t[i].at,t[j-1].at+1)!==EXACT_WIDE_SOURCE)throw Error('Nonliteral exact wide declaration');found++;
 }
 if(found!==1)throw Error('Missing literal exact wide declaration');return true;
}
