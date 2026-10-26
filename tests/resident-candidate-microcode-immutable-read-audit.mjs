// TEST-only source-copy instrumentation. This enables NO optimization and changes
// NO shared compiler source. It verifies exact bytecode equality before using
// the already measured per-PC counts. Do not run during GPU timing windows.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileMicrocodeWGSL} from '../src/resident-candidate/microcode-compiler.mjs';
import {allocateMicrocodeLocals} from '../src/resident-candidate/microcode-allocation.mjs';
import {MICROCODE_ISA} from '../src/resident-candidate/microcode-isa.mjs';
import {parseMicrocodeWGSL} from '../src/resident-candidate/microcode-parser.mjs';
const compilerUrl=new URL('../src/resident-candidate/microcode-compiler.mjs',import.meta.url);
const sha=x=>createHash('sha256').update(x).digest('hex');
function replaceOnce(source,old,replacement){assert.equal(source.split(old).length,2,'exact diagnostic compiler hook: '+old.slice(0,70));return source.replace(old,replacement);}
export async function instrumentNameReads(){
 let source=readFileSync(compilerUrl,'utf8');
 source=replaceOnce(source,' function expr(n,hint){',' const __nameReads=[],__addressedSlots=[];\n function expr(n,hint){');
 source=replaceOnce(source,"case'name':{const v=lookup(n.name);if(v.storage)fail('Storage array requires indexing/address');const out=alloc(v.type);copy(out,v);return out;}","case'name':{const v=lookup(n.name);if(v.storage)fail('Storage array requires indexing/address');const out=alloc(v.type),pc=rows.length;copy(out,v);__nameReads.push({pc,name:n.name,function:current?.name??'$module',sourceSlot:v.slot,destinationSlot:out.slot,words:v.words,kind:v.type.kind,type:v.type.name,mode:v.mode??null,global:!!v.global,parameter:!!current?.params.some(p=>p.slot===v.slot)});return out;}");
 source=replaceOnce(source,' function address(slot){',' function address(slot){__addressedSlots.push(slot);');
 source=replaceOnce(source,"return Object.freeze({kind:'resident-wgsl-microcode-v1'","return Object.freeze({readAudit:{nameReads:__nameReads,addressedSlots:__addressedSlots},kind:'resident-wgsl-microcode-v1'");
 source=source.replace(/from '(\.[^']+)'/g,(_,relative)=>"from '"+new URL(relative,compilerUrl).href+"'");
 return (await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).compileMicrocodeWGSL;
}
export async function auditImmutableScalarReads(trace,profile){
 assert.equal(trace.kind,'host-only-microcode-cost-trace-v1');assert.equal(profile.sourceParity,'all11-source-groups-exact');
 assert.equal(sha(trace.sourceCode),trace.sourceSha256);assert.equal(sha(trace.instructions),trace.bytecodeSha256);
 const options={entry:'rc_micro_host_created_run',intrinsics:profile.intrinsics,intrinsicFunctions:profile.intrinsicFunctions??undefined,externalFunctions:profile.externalFunctions,allocationMetadata:true},instrumented=await instrumentNameReads(),normal=compileMicrocodeWGSL(trace.sourceCode,options),observed=instrumented(trace.sourceCode,options);
 assert.deepEqual(observed.instructions,normal.instructions,'instrumentation changes no instruction');assert.deepEqual(observed.allocationMetadata,normal.allocationMetadata,'instrumentation changes no allocation');
 const packed=allocateMicrocodeLocals(observed,{mode:'call-frames-v1'});assert.deepEqual(packed.instructions,trace.instructions,'instrumented source exactly matches counted packed bytecode');
 const addressed=new Set(observed.readAudit.addressedSlots),categories={},functionCosts={},bindings=new Map();let all=0,eligible=0,eligibleStatic=0;
 for(const row of observed.readAudit.nameReads){let dynamic=0;for(let i=0;i<row.words;i++){const pc=row.pc+i;assert.equal(normal.instructions[pc*8],MICROCODE_ISA.opcodes.MOV);assert.equal(normal.instructions[pc*8+1],row.destinationSlot+i);assert.equal(normal.instructions[pc*8+2],row.sourceSlot+i);dynamic+=trace.pcCounters[pc];}all+=dynamic;
  const reason=row.kind!=='scalar'||row.words!==1?'non-scalar-or-aggregate':!['let','const'].includes(row.mode)?'mutable-or-unknown':addressed.has(row.sourceSlot)?'address-taken':'eligible';
  const c=categories[reason]??={staticReads:0,dynamicCopies:0};c.staticReads++;c.dynamicCopies+=dynamic;if(reason!=='eligible')continue;
  eligible+=dynamic;eligibleStatic++;const kind=row.parameter?'parameter':row.global?'module-'+row.mode:'local-'+row.mode,key=row.function+'|'+kind+'|'+row.name,b=bindings.get(key)??{function:row.function,kind,name:row.name,type:row.type,staticReads:0,dynamicCopies:0};b.staticReads++;b.dynamicCopies+=dynamic;bindings.set(key,b);functionCosts[row.function]=(functionCosts[row.function]??0)+dynamic;
 }
 const total=trace.pcCounters.reduce((n,x)=>n+x,0);assert.equal(total,Number(profile.scalarInstructions));
 const ast=parseMicrocodeWGSL(trace.sourceCode),sourceFunctions=new Map(ast.functions.map(f=>[f.name,f])),broadClosure=new Set();
 const visitNode=node=>{if(!node||typeof node!=='object')return;if(node.kind==='call'&&node.callee.kind==='name'&&sourceFunctions.has(node.callee.name))visitFunction(node.callee.name);for(const value of Object.values(node)){if(Array.isArray(value)){for(const child of value)visitNode(child);}else if(value&&typeof value==='object')visitNode(value);}};
 const visitFunction=name=>{if(broadClosure.has(name))return;broadClosure.add(name);visitNode(sourceFunctions.get(name).body);};visitFunction('rc_world_broad_commit_collision');
 const definitelyOutsideBroad=Object.entries(functionCosts).filter(([name])=>!broadClosure.has(name)).reduce((n,[,copies])=>n+copies,0);
 return {kind:'host-only-immutable-scalar-read-copy-audit-v1',status:'pass',optimizationEnabled:false,sourceCompilerUnchanged:true,emittedBytecodeExactlyUnchanged:true,sourceSha256:trace.sourceSha256,bytecodeSha256:trace.bytecodeSha256,frames:profile.frames,totalCoreInstructions:total,allNameReadCopies:all,eligibleDynamicCopies:eligible,eligibleStaticReads:eligibleStatic,eligibleShare:eligible/total,broadOverlap:{closureFunctions:broadClosure.size,eligibleCopiesInOutsideFunctions:definitelyOutsideBroad,conservativeMarginalLowerBoundAfterBroad:definitelyOutsideBroad,upperBoundAfterBroad:eligible,note:'Copies in functions shared with broad cannot be separated by aggregate PC counters. Do not add the full immutable-read estimate to broad savings.'},categories,rankedFunctions:Object.entries(functionCosts).map(([name,copies])=>({name,copies,share:copies/total})).sort((a,b)=>b.copies-a.copies),unexecutedEligibleBindings:[...bindings.values()].filter(x=>!x.dynamicCopies).length,rankedBindings:[...bindings.values()].filter(x=>x.dynamicCopies>0).sort((a,b)=>b.dynamicCopies-a.dynamicCopies),addressCreatedTargets:addressed.size,exclusions:['mutable var/private globals','vectors/arrays/structs/pointers','any scalar slot with a compiler-created local address'],assumptions:['Function parameters and let/const slots remain owned, not aliases of initializer temporaries.','No declaration/argument/return copy elimination is counted.','Original compiler rejects recursion; ancestor and descendant packed frames cannot overlap.','Any future direct-read lowering must preserve all calls, guards, numeric operations, mutable value snapshots and source caps.','A new bytecode layout requires fresh buffers or matching-layout checkpoints; no old VM checkpoint conversion.'],scope:'Two-h prestrike measured core copy count only; not GPU timing, source-native admission, contact/full-rest parity or 1024-row throughput.'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [tracePath='/tmp/resident-microcode-world-host-costs.v8',profilePath='/tmp/resident-microcode-world-host-actual.bin.json',out='/tmp/resident-microcode-immutable-read-audit.json']=process.argv.slice(2),report=await auditImmutableScalarReads(deserialize(readFileSync(tracePath)),JSON.parse(readFileSync(profilePath,'utf8')));writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,rankedBindings:report.rankedBindings.slice(0,15),rankedFunctions:report.rankedFunctions.slice(0,15)}));
}
