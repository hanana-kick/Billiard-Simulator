/** Strict scalar-storage extension to the reviewed index lift. This is not a
 * general WGSL parser. Unsupported forms reject. Original OOB behavior is NOT
 * assumed to be zero: a guarded OOB sets a sticky candidate fault and callers
 * must replace the public result with unsupported. No physical OOB is executed. */
import {liftCandidatePhase} from './deterministic-recurring-batch-phases.mjs';
function noComments(s){let out='',i=0;while(i<s.length){if(s.startsWith('//',i)){const e=s.indexOf('\n',i);if(e<0)break;out+='\n';i=e+1;}else if(s.startsWith('/*',i)){let d=1;i+=2;while(i<s.length&&d){if(s.startsWith('/*',i)){d++;i+=2;}else if(s.startsWith('*/',i)){d--;i+=2;}else i++;}if(d)throw Error('Unclosed WGSL comment');out+=' ';}else out+=s[i++];}return out;}
function closing(s,start,open='[',close=']'){let depth=1;for(let i=start;i<s.length;i++){if(s[i]===open)depth++;else if(s[i]===close&&--depth===0)return i;}throw Error('Unbalanced guarded storage expression');}
const suffix={'+=':'add','-=':'sub','*=':'mul','/=':'div','%=':'mod','&=':'and','|=':'or','^=':'xor','<<=':'shl','>>=':'shr','++':'inc','--':'dec','=':'store'};
export function liftLiveCandidateStructure(source,ownership){
 const size16=/@workgroup_size\(16\)/.test(source);const code=liftCandidatePhase(size16?source.replace('@workgroup_size(16)','@workgroup_size(1)'):source,ownership);return size16?code.replace('@workgroup_size(1)','@workgroup_size(16)'):code;
}
export function liftGuardedCandidatePhase(source,ownership,viewLengths){
 source=noComments(source);if(/\bguardedBatch\w*\b/.test(source))throw Error('Reserved guarded lift identifier');
 const bindings=[...source.matchAll(/@group\(0\)\s*@binding\((\d+)\)\s*var<storage,\s*(read|read_write)>\s*(\w+)\s*:\s*array<(u32|i32)>\s*;/g)].map(m=>({binding:Number(m[1]),access:m[2],name:m[3],type:m[4]}));
 if(bindings.length!==ownership.length||!Array.isArray(viewLengths)||viewLengths.length!==bindings.length||viewLengths.some(x=>!Number.isInteger(x)||x<1))throw Error('Explicit original binding view lengths required');
 const lifted=liftLiveCandidateStructure(source,ownership),map=new Map(bindings.map((b,i)=>[b.name,{...b,shape:ownership[i]===null?null:typeof ownership[i]==='number'?{stride:ownership[i],base:0,length:ownership[i]}:{base:0,...ownership[i]},length:viewLengths[i],ops:new Set()}]));
 for(const b of map.values())if(b.shape&&b.shape.length!==b.length)throw Error('Original view length mismatch');
 for(const b of map.values()){const withoutLength=lifted.replace(new RegExp('arrayLength\\(\\s*&'+b.name+'\\s*\\)','g'),'0u');if(new RegExp('(?<!&)&(?!&)\\s*'+b.name+'\\b').test(withoutLength))throw Error('Storage pointer escape '+b.name);if(new RegExp('\\b(?:let|var|const)\\s+'+b.name+'\\b|\\bfn\\s+\\w+\\([^)]*\\b'+b.name+'\\s*:').test(lifted))throw Error('Storage name shadow '+b.name);}

 let temporary=0;
 function rewrite(s){let out='',pos=0;const re=/\b([A-Za-z_]\w*)\s*\[/g;let m;while((m=re.exec(s))){const b=map.get(m[1]);if(!b)continue;const end=closing(s,re.lastIndex);let index=s.slice(re.lastIndex,end);
  if(b.shape){const prefix=`batchCandidate*${b.shape.stride}u+${b.shape.base}u+u32(`;if(!index.startsWith(prefix)||!index.endsWith(')'))throw Error('Unexpected lifted index form');index=index.slice(prefix.length,-1);}
  // Pure index subset: avoid changing evaluation multiplicity or effects.
  for(const call of index.matchAll(/\b([A-Za-z_]\w*)\s*\(/g))if(!['u32','i32','min','max','select','bitcast'].includes(call[1]))throw Error('Unreviewed index function '+call[1]);
  index=rewrite(index);const arg=`u32(${index})`,tail=s.slice(end+1),op=tail.match(/^\s*(<<=|>>=|\+\+|--|[+\-*/%&|^]?=)(?!=)/);
  out+=s.slice(pos,m.index);
  if(op){if(b.access!=='read_write')throw Error('Write to read-only storage');const operation=op[1];b.ops.add(operation);let stop=end+1+op[0].length;
   if(operation==='++'||operation==='--'){out+=`guardedBatch_${b.name}_${suffix[operation]}(${arg})`;pos=stop;}
   else{const start=stop;let paren=0,bracket=0;for(;stop<s.length;stop++){const ch=s[stop];if(ch==='(')paren++;if(ch===')')paren--;if(ch==='[')bracket++;if(ch===']')bracket--;if(paren<0||bracket<0||ch==='{'||ch==='}')throw Error('Unsupported storage assignment context');if(ch===';'&&paren===0&&bracket===0)break;}if(stop===s.length)throw Error('Storage assignment needs statement terminator');const rhs=rewrite(s.slice(start,stop));if(operation==='='){out+=`guardedBatch_${b.name}_store(${arg},${rhs})`;pos=stop;}else{const name='guardedBatchTemporary'+temporary++,type=operation==='<<='||operation==='>>='?'u32':b.type;out+=`{let ${name}Index:u32=${arg};let ${name}Previous:${b.type}=guardedBatch_${b.name}_load(${name}Index);let ${name}Value:${type}=${rhs};guardedBatch_${b.name}_store(${name}Index,${name}Previous${operation.slice(0,-1)}${name}Value);}`;pos=stop+1;}}
  }else{out+=`guardedBatch_${b.name}_load(${arg})`;pos=end+1;}
  re.lastIndex=pos;
 }return out+s.slice(pos);}
 let code=rewrite(lifted);
 const withoutDeclarations=code.replace(/@group\(0\)\s*@binding\(\d+\)\s*var<storage,\s*(read|read_write)>\s*\w+\s*:\s*array<(u32|i32)>\s*;/g,'');
 for(const b of map.values()){const residual=withoutDeclarations.replace(new RegExp('arrayLength\\(\\s*&'+b.name+'\\s*\\)','g'),'0u');if(new RegExp('\\b'+b.name+'\\b').test(residual))throw Error('Unclassified storage identifier '+b.name);}
 let helpers=`\n@group(0) @binding(${bindings.length}) var<storage,read_write> guardedBatchFault:array<atomic<u32>>;\n`;
 for(const b of map.values()){
  const limit=b.shape?`${b.length}u`:`arrayLength(&${b.name})`,address=b.shape?`batchCandidate*${b.shape.stride}u+${b.shape.base}u+index`:'index',zero=b.type==='u32'?'0u':'0i',one=b.type==='u32'?'1u':'1i';
  helpers+=`fn guardedBatch_${b.name}_load(index:u32)->${b.type}{if(index>=${limit}){atomicOr(&guardedBatchFault[batchCandidate],1u);return ${zero};}return ${b.name}[${address}];}\n`;
  if(b.access==='read_write')helpers+=`fn guardedBatch_${b.name}_store(index:u32,value:${b.type}){if(index>=${limit}){atomicOr(&guardedBatchFault[batchCandidate],1u);return;}${b.name}[${address}]=value;}\n`;
  for(const op of b.ops){if(op==='='||!(op==='++'||op==='--'))continue;const increment=op==='++'||op==='--',symbol=increment?(op==='++'?'+':'-'):op.slice(0,-1),value=increment?one:'value',type=op==='<<='||op==='>>='?'u32':b.type;helpers+=`fn guardedBatch_${b.name}_${suffix[op]}(index:u32${increment?'':`,value:${type}`}){if(index>=${limit}){atomicOr(&guardedBatchFault[batchCandidate],1u);return;}let previous=${b.name}[${address}];${b.name}[${address}]=previous${symbol}${value};}\n`;}
 }
 code=code.replace(/(fn main\([^{}]*\)\{batchCandidate=\w+\.y;)/,'$1if(atomicLoad(&guardedBatchFault[batchCandidate])!=0u){return;}');
 return{code:code+helpers,faultBinding:bindings.length,storageBindingCount:bindings.length+1,proof:{policy:'no physical OOB; atomic sticky per-candidate fault; caller must gate final compact result',originalViewLengths:[...viewLengths],bindingNames:bindings.map(b=>b.name),guarded:true}};
}

/** Coalesce only fault publication; every original scalar bounds guard remains.
 * The wrapper catches normal and early body exits without rewriting returns. */
export function coalesceGuardedInvocationFault(guarded){
 let code=guarded.code;
 if(/\bguardedBatch(?:Body|PrivateFault)\b/.test(code)||(code.match(/\bmain\s*\(/g)??[]).length!==1)throw Error('Unclassified guarded entry call or reserved wrapper name');
 const entry=/@compute\s+@workgroup_size\((1|16|32)\)\s+fn main\(@builtin\(global_invocation_id\) (\w+):vec3<u32>\)\{/;
 const match=code.match(entry);if(!match)throw Error('Exact void guarded compute entry required');
 const [header,size,id]=match;
 const failure='atomicOr(&guardedBatchFault[batchCandidate],1u);';
 code=code.replaceAll(failure,'guardedBatchPrivateFault|=1u;');
 // Original source atomics were rejected by structural admission. Any extra
 // publication syntax indicates a new injection policy requiring separate audit.
 if(/atomicOr/.test(code))throw Error('Unclassified fault publication');
 code=code.replace(header,`fn guardedBatchBody(${id}:vec3<u32>){`);
 code+=`\nvar<private> guardedBatchPrivateFault:u32;\n@compute @workgroup_size(${size}) fn main(@builtin(global_invocation_id) ${id}:vec3<u32>){batchCandidate=${id}.y;guardedBatchPrivateFault=0u;if(atomicLoad(&guardedBatchFault[batchCandidate])!=0u){return;}guardedBatchBody(${id});atomicOr(&guardedBatchFault[batchCandidate],guardedBatchPrivateFault);}\n`;
 return{...guarded,code,proof:{...guarded.proof,publication:'private-per-invocation; wrapper publishes after every body exit'}};
}
