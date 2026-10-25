// Pure strict raw-six-row/two-h assertion. No file access, original CPU oracle,
// source creation, GPU execution or expected-state upload authority.
import {WORLD_DEVICE_PC as PC} from '../src/resident-candidate/world-device-pc.mjs';
import {STATUS} from '../src/resident-candidate/abi.mjs';
export function createRawWorldPcComparison({assert,worldComparison,onMismatch}={}){
 if(!assert||['ok','equal','deepEqual'].some(k=>typeof assert[k]!=='function')||!worldComparison||['compareWorldBank','projectWorldComparison','firstWorldMismatch'].some(k=>typeof worldComparison[k]!=='function')||typeof onMismatch!=='function')throw new TypeError('Strict assertion, world comparator and diagnostic sink required');
 const {compareWorldBank,projectWorldComparison,firstWorldMismatch}=worldComparison;
function compareRawWorldPcResult({fixture:f,plan,words,run=1,artifactPath='/tmp/resident-raw-world-pc-native-actual.bin',trace=()=>{}}){
 const{count,template,source,pc,sweeps}=plan,sourceMode=plan.sourceMode??'phases',FRAMES=2;
 assert.equal(count,6,'same strict six raw rows');assert.equal(f.results.length,count);assert.equal(f.frames,FRAMES,'independent original two-h expectations');assert.ok(words instanceof Uint32Array);assert.ok(pc.pipelines.length>0);
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

 return Object.freeze({compareRawWorldPcResult});
}
