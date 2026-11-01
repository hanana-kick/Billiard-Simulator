/** Build-time only. Exact declaration plus closed builtin type/function namespace. */
import {parseMicrocodeWGSL,tokenizeMicrocodeWGSL} from '../resident-candidate/microcode-parser.mjs';
import {EXACT_DIVIDE_SOURCE} from './exact-divide-source.mjs';
const expected=JSON.stringify(parseMicrocodeWGSL(EXACT_DIVIDE_SOURCE).functions[0]);
export function approveExactDivide(code,ast){
 const matches=ast.functions.filter(f=>f.name==='divideWide');if(!matches.length)return false;
 if(matches.length!==1||JSON.stringify(matches[0])!==expected)throw Error('Unapproved exact divideWide source closure');
 for(const x of [...ast.aliases,...ast.structs,...ast.globals,...ast.functions])if(['u32','i32','vec3'].includes(x.name))throw Error('Shadowed exact divideWide builtin closure');
 const t=tokenizeMicrocodeWGSL(code);let found=0;
 for(let i=0;i<t.length-1;i++)if(t[i].text==='fn'&&t[i+1].text==='divideWide'){
  let j=i;while(t[j].text!=='{')j++;let depth=1;j++;while(depth&&j<t.length){if(t[j].text==='{')depth++;if(t[j].text==='}')depth--;j++;}
  if(code.slice(t[i].at,t[j-1].at+1)!==EXACT_DIVIDE_SOURCE)throw Error('Nonliteral exact divideWide declaration');found++;
 }
 if(found!==1)throw Error('Missing literal exact divideWide declaration');return true;
}

// Explicitly known original non-pure helper: NEVER native-lowered.
const ORIGINAL_SCENE_DEPENDENT_DECLARATION='fn divideWide(lo:u32,hi:u32,d:u32)->vec3<u32>{\n if(d==0u||hi>=d){return vec3<u32>(0u);}var rem=hi;var quotient=0u;\n for(var bit=i32(scene[9u])-1;bit>=0;bit--){let carry=rem>>31u;rem=(rem<<1u)|((lo>>u32(bit))&1u);if(carry!=0u||rem>=d){rem-=d;quotient|=1u<<u32(bit);}}\n return vec3<u32>(quotient,rem,1u);\n}';
export function selectExactDivideCandidate(code,ast){
 const f=ast.functions.filter(x=>x.name==='divideWide');if(!f.length)return false;if(f.length!==1)throw Error('Duplicate divideWide');
 const tokens=tokenizeMicrocodeWGSL(code);let declaration;for(let i=0;i<tokens.length-1;i++)if(tokens[i].text==='fn'&&tokens[i+1].text==='divideWide'){let j=i;while(tokens[j].text!=='{')j++;let depth=1;j++;while(depth){if(tokens[j].text==='{')depth++;if(tokens[j].text==='}')depth--;j++;}declaration=code.slice(tokens[i].at,tokens[j-1].at+1);}
 if(declaration===ORIGINAL_SCENE_DEPENDENT_DECLARATION)return false;
 return approveExactDivide(code,ast);
}
