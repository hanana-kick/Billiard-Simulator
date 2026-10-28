// TEST ONLY closed8/9 comparator. Historical strict-six helper stays unchanged.
// Entry artifact hashes are checked by scale-assertions before this count/source
// admission. Per-row/all11/control/mismatch/tail checks below are byte-identical
// to the historical comparator; only the separately pinned admission differs.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {WORLD_DEVICE_PC as PC} from '../src/resident-candidate/world-device-pc.mjs';
import {STATUS,isOwnedUint32Array} from '../src/resident-candidate/abi.mjs';
import {scaleContract} from './resident-candidate-scale-native-contract.mjs';
import {assertScaleReferenceBinding} from './resident-candidate-macro-scale-bind.mjs';
import {compareWorldBank,projectWorldComparison,firstWorldMismatch} from './resident-candidate-whole-h-fixture.mjs';
const roster=JSON.parse(readFileSync(new URL('./fixtures/resident-macro-scale-roster-v1.json',import.meta.url))).rows;
export function assertScaleComparisonInput({runtime:r,expected:e,words}){
 const p=r.original,count=p.count,c=scaleContract(count),rows=roster.slice(0,count);
 assert.equal(r.identity.sourceSha256,c.sourceSha256,'exact count-specialized source');
 assert.equal(r.identity.bytecodeSha256,c.bytecodeSha256);assert.equal(r.identity.vmShaderSha256,c.coreShaderSha256);
 for(const k of['generationIdentity','sourceIdentity','preStrikeIdentity'])assert.equal(p.identity[k],c[k],k);
 assert.equal(e.count,count);assert.equal(e.results.length,count,'no missing/extra expected row');
 assert.deepEqual(p.identity.rawRows,rows,'full original ordered settings');assert.deepEqual(e.rawRows,rows);
 assert.deepEqual(e.results.map(x=>x.row),rows,'every expected row identity/settings');
 const ids=e.results.map(x=>x.row.id);assert.equal(new Set(ids).size,count,'no duplicate IDs');assert.deepEqual(ids,c.orderedIds);
 assert.deepEqual(e.results.filter(x=>x.status===STATUS.REJECTED).map(x=>x.row.id),c.rejectedRows,'exact rejected roster');
 assert.deepEqual(e.results.filter(x=>x.status!==STATUS.REJECTED).map(x=>x.row.id),c.acceptedRows,'exact admitted roster');
 assert.equal(c.rejectedRows.length,2);assert.equal(c.acceptedRows.length,count-2);
 for(const x of e.results)assert.equal(x.kind==='clear',x.status!==STATUS.REJECTED,'original admission kind/status');
 assertScaleReferenceBinding(r,e,rows,count);
 assert.ok(isOwnedUint32Array(words),'owned complete diagnostic words');assert.equal(words.length,c.requirements.buffers.worldState.words,'no missing/extra diagnostic row');
 assert.equal(p.pc.totalStateWords,words.length);assert.equal(p.pc.stateWords,e.template.state.length);assert.ok(p.pc.pipelines.length>0);
 return{fixture:{frames:e.frames,results:e.results,plan:{preStrikeIdentity:e.preStrikeIdentity}},plan:{count,template:e.template,pc:p.pc,sweeps:p.sweeps,source:{transport:p.transport},sourceMode:'owners'}};
}
export function compareScaleRawWorldPcResult({runtime,expected,words,run=1,artifactPath='/tmp/resident-scale-world-pc-native-actual.bin',trace=()=>{}}){
 const{fixture:f,plan}=assertScaleComparisonInput({runtime,expected,words});
 const{count,template,source,pc,sweeps}=plan,sourceMode=plan.sourceMode,FRAMES=2;
 const onMismatch=({path,words,diagnostic})=>{writeFileSync(path,new Uint8Array(words.buffer,words.byteOffset,words.byteLength));writeFileSync(path+'.json',JSON.stringify(diagnostic,null,2));};
  const controls=[];
  for(const[i,r]of f.results.entries()){
   const base=i*template.state.length,cb=pc.controlTailBase+i*pc.controlWords,control=Array.from(words.slice(cb,cb+PC.headerWords));controls.push(control);
   trace({gate:'raw-device-pc',stage:'boundary',run,sourceMode,candidate:r.row.id,kind:r.kind,status:words[base+2],reason:words[base+3],hSequence:words[base+5],control,lastNeededSweep:Math.ceil(control[PC.header.dispatchVisits]/pc.pipelines.length)});
   try{
    assert.equal(words[base+4],r.row.id);assert.equal(words[base+2],r.status,'unsupported/incomplete is not an ordinary physics miss');assert.equal(words[base+3],r.reason);assert.equal(control[PC.header.magic],PC.magic);assert.equal(control[PC.header.version],PC.version);assert.equal(control[PC.header.initialH],0);assert.equal(control[PC.header.requestedH],FRAMES);assert.equal(control[PC.header.error],0);
    if(r.status===STATUS.REJECTED){assert.equal(words[base+5],0,'rejected candidate never advances h');assert.equal(words[base+template.segments.rawCreation.offset+4],0);assert.equal(control[PC.header.status],PC.status.worldTerminal);assert.equal(control[PC.header.completedH],0);assert.equal(control[PC.header.calls],0);assert.equal(control[PC.header.dispatchVisits],0);}
    else{assert.equal(control[PC.header.status],PC.status.complete,'fixed sweeps insufficient/invalid must fail this gate, never publish MISS');assert.equal(control[PC.header.completedH],FRAMES);assert.equal(words[base+5],FRAMES);assert.equal(words[base+template.segments.rawCreation.offset+4],1);compareWorldBank({words,base,template,seed:r.seed,expected:r.final.snapshot,scoring:r.final.scoring});}
   }catch(error){
    let differences=[];if(r.final)try{const p=projectWorldComparison({words,base,template,seed:r.seed,expected:r.final.snapshot,scoring:r.final.scoring});differences=Object.keys(p.expected).map(name=>({owner:name,mismatch:firstWorldMismatch(p.actual[name],p.expected[name],'$.'+name)}));}catch(e){differences=[{projectionError:e.message}];}
    const path=artifactPath;onMismatch({path,words,diagnostic:{rawInput:true,run,sourceMode,frames:FRAMES,candidate:r.row.id,kind:r.kind,count,sweeps,transport:source.transport,preStrikeIdentity:f.plan.preStrikeIdentity,sourceIdentity:template.sourceIdentity,stateWords:template.state.length,segments:template.segments,controlTailBase:pc.controlTailBase,controlWords:pc.controlWords,control,differences,error:error.message}});trace({gate:'raw-device-pc',stage:'mismatch',path,differences});throw error;
   }
  }
  assert.deepEqual(words.slice(count*template.state.length,pc.controlTailBase),template.fixedCcd,'shared immutable CCD tail unchanged');
 return{controls,lastNeededSweeps:controls.map(c=>Math.ceil(c[PC.header.dispatchVisits]/pc.pipelines.length))};
}
