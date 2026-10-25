/* SPDX-License-Identifier: Apache-2.0
 * Links independently owned source WGSL phases without inlining interpreters
 * into physics loops. Only removes unreachable functions / duplicate identical
 * declarations; it never rewrites arithmetic, source order or loop bounds.
 */
function maskComments(text){let out='',i=0,block=0;while(i<text.length){if(block){if(text.startsWith('/*',i)){block++;out+='  ';i+=2;}else if(text.startsWith('*/',i)){block--;out+='  ';i+=2;}else{out+=text[i]==='\n'?'\n':' ';i++;}}else if(text.startsWith('/*',i)){block=1;out+='  ';i+=2;}else if(text.startsWith('//',i)){while(i<text.length&&text[i]!=='\n'){out+=' ';i++;}}else out+=text[i++];}if(block)throw new SyntaxError('Unclosed WGSL comment');return out;}
const normalized=text=>maskComments(text).replace(/\s+/g,'');
function declarations(text){
 const masked=maskComments(text),result=[];let cursor=0;
 while(cursor<masked.length){while(/\s/.test(masked[cursor]??'')&&cursor<masked.length)cursor++;if(cursor===masked.length)break;const start=cursor;
  // Declaration attributes contain no braces. Do not mistake annotation names
  // or arguments for functions; retain each exact original attribute prefix.
  const match=/\b(fn|struct|alias|const|var|enable|requires|diagnostic)\b/g;match.lastIndex=cursor;const m=match.exec(masked);if(!m)throw new SyntaxError('Unsupported WGSL top-level text');
  if(masked.slice(cursor,m.index).replace(/@[A-Za-z_]\w*(?:\([^{}]*?\))?/g,'').trim())throw new SyntaxError('Unexpected WGSL declaration prefix');
  const kind=m[1],tail=masked.slice(match.lastIndex),nameMatch=kind==='var'?/^\s*(?:<[^>]*>)?\s*([A-Za-z_]\w*)/.exec(tail):/^\s+([A-Za-z_]\w*)/.exec(tail);let end;
  if(kind==='fn'||kind==='struct'){const brace=masked.indexOf('{',match.lastIndex);if(brace<0)throw new SyntaxError('Missing WGSL body');let depth=1;end=brace+1;for(;depth&&end<masked.length;end++){if(masked[end]==='{')depth++;else if(masked[end]==='}')depth--;}if(depth)throw new SyntaxError('Unclosed WGSL body');if(masked[end]===';')end++;}
  else{end=masked.indexOf(';',match.lastIndex)+1;if(end===0)throw new SyntaxError('Missing WGSL declaration semicolon');}
  const code=text.slice(start,end),name=['enable','requires','diagnostic'].includes(kind)?normalized(code):nameMatch?.[1];if(!name)throw new SyntaxError('Missing WGSL declaration name');result.push({kind,name,code,masked:masked.slice(start,end)});cursor=end;
 }
 return result;
}
export function linkResidentWGSL(pieces,{entry='main'}={}){
 if(!Array.isArray(pieces)||pieces.some(x=>typeof x!=='string')||!/^\w+$/.test(entry))throw new TypeError('WGSL source pieces and entry required');
 const functions=new Map(),globals=new Map();for(const piece of pieces)for(const declaration of declarations(piece)){const map=declaration.kind==='fn'?functions:globals,key=declaration.kind==='fn'?declaration.name:declaration.kind+':'+declaration.name,rows=map.get(key)??[];rows.push(declaration);map.set(key,rows);}
 if(!functions.has(entry))throw new RangeError('Missing WGSL compute entry '+entry);const keep=new Set(),todo=[entry];
 while(todo.length){const name=todo.pop();if(keep.has(name))continue;const rows=functions.get(name);if(rows.some(x=>normalized(x.code)!==normalized(rows[0].code)))throw new RangeError('Conflicting reachable WGSL function '+name);keep.add(name);for(const m of rows[0].masked.matchAll(/\b([A-Za-z_]\w*)\s*\(/g))if(functions.has(m[1])&&!keep.has(m[1]))todo.push(m[1]);}
 const output=[];for(const[key,rows]of globals){if(rows.some(x=>normalized(x.code)!==normalized(rows[0].code)))throw new RangeError('Conflicting WGSL declaration '+key);output.push(rows[0].code);}for(const name of keep)output.push(functions.get(name)[0].code);
 return Object.freeze({code:output.join('\n'),functions:keep.size,removedFunctions:functions.size-keep.size,inputBytes:pieces.reduce((n,x)=>n+x.length,0)});
}
