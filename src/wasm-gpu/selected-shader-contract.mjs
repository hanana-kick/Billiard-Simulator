/** Narrow recognizer for the captured native selected-program WGSL dialect.
 * Not a general WGSL parser: every relevant token must belong to a recognized
 * declaration, including whitespace variants. No source is rewritten for GPU. */
export function recognizeSelectedShader(code){
 if(typeof code!=='string')throw TypeError('Selected WGSL source required');
 let source='',depth=0;
 for(let i=0;i<code.length;){
  if(code.slice(i,i+2)==='/*'){depth++;i+=2;source+=' ';continue;}
  if(depth){if(code.slice(i,i+2)==='*/'){depth--;i+=2;}else i++;continue;}
  if(code.slice(i,i+2)==='//'){while(i<code.length&&code[i]!=='\n')i++;source+='\n';continue;}
  source+=code[i++];
 }
 if(depth)throw Error('Unterminated selected WGSL comment');
 if(/\bvar\s*<\s*workgroup\b|\b(?:workgroupBarrier|storageBarrier|textureBarrier|workgroupUniformLoad)\b/.test(source))throw Error('Selected workgroup storage/barriers forbidden');
 const declarations=[...source.matchAll(/@\s*group\s*\(\s*(\d+)\s*\)\s*@\s*binding\s*\(\s*(\d+)\s*\)\s*var\s*<\s*storage\s*,\s*(read|read_write)\s*>\s+[A-Za-z_]\w*\s*:/g)];
 const count=re=>(source.match(re)??[]).length;
 if(count(/@\s*group\b/g)!==declarations.length||count(/@\s*binding\b/g)!==declarations.length||count(/\bvar\s*<\s*storage\b/g)!==declarations.length)throw Error('Unclassified selected storage/binding declaration');
 const entries=declarations.map((m,i)=>{if(+m[1]!==0||+m[2]!==i)throw Error('Selected contiguous group0 bindings required');return Object.freeze({binding:+m[2],access:m[3]});});
 const groups=[...source.matchAll(/@\s*workgroup_size\s*\(\s*(1|16|32)\s*\)/g)];
 if(!groups.length||count(/@\s*workgroup_size\b/g)!==groups.length)throw Error('Selected scalar workgroup contract');
 return Object.freeze({entries:Object.freeze(entries),workgroupSize:Math.max(...groups.map(m=>+m[1]))});
}
