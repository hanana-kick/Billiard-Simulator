/** Host-only analyzer. Never interprets snapshots before full baseline parity. */
const equal=(a,b)=>a&&b&&a.length===b.length&&Array.from(a).every((v,i)=>v===b[i]);
export function analyzeSelectedDiagnostic({plan,words,baseline,observed}){
 if(!baseline||!observed||baseline.world?.length!==2916||baseline.trace?.length!==1048592||!equal(baseline.world,observed.world)||!equal(baseline.trace,observed.trace))throw Error('Full baseline world+trace parity required; changed output is observer effect only');
 if(words?.length*4!==plan.diagnosticBytes)throw Error('Complete diagnostic readback required');
 const groups=new Map();for(const r of plan.rows){const key=[r.iteration,r.stage,r.when].join(':');const g=groups.get(key)??{iteration:r.iteration,stage:r.stage,when:r.when,commandIndex:r.commandIndex,fields:{}};g.fields[r.name]=Array.from(words.slice(r.destinationOffset/4,(r.destinationOffset+r.size)/4));groups.set(key,g);}
 const states=[],ownerChecks=[],microChecks=[];
 for(const g of [...groups.values()].sort((a,b)=>a.commandIndex-b.commandIndex||(a.when==='before'?-1:1))){
  for(const[name,v]of Object.entries(g.fields))if(['state','source','previous','impact','result'].includes(name)&&[64,256].includes(v.length))states.push({iteration:g.iteration,stage:g.stage,when:g.when,commandIndex:g.commandIndex,name,header:v.slice(0,64),modes:v.length===256?[0,1,2,3].map(i=>v[104+48*i]):null});
  if(g.stage==='cushion-owner'&&g.when==='before'){
   const s=g.fields.source,r=g.fields.rows,c=g.fields.ctx,mismatches=[];
   const check=(name,actual,expected)=>{if(actual!==expected)mismatches.push({name,actual,expected});};
   const active=c[13]===1&&s[1]===7&&[6,7].includes(s[2]);
   if(active){check('source.unresolvedPair',s[6],0xffffffff);check('source.anchor',s[8],s[5]);check('rows.length',r.length,s[3]*80);check('rows.horizon',r[2],s[4]);
    for(let i=0;i<s[3];i++){const a=64+48*i,b=80*i,p=`body${i}.`;const expected={0:0x4d4d5102,1:s[a+40],2:s[4],3:s[a],4:s[a+22],5:1,6:s[5],17:s[a+23],48:c[4],49:c[8],50:c[7]};for(let j=0;j<9;j++)expected[8+j]=s[a+24+j];
     if(r[b+1]>3)mismatches.push({name:p+'mode-domain',actual:r[b+1],expected:'0..3'});
     if(r[b+1]===3){if(c[5]>268435456||c[6]>67108864||2*c[6]>7*c[5])mismatches.push({name:p+'rolling-context-domain',actual:[c[5],c[6]],expected:'audited bounds'});Object.assign(expected,{24:c[6],25:0,26:0,27:0,28:0,29:c[16],30:c[17],31:Math.min(c[18],c[19]),32:Math.min(c[20],c[21]),33:c[22],34:0x52545001});}
     for(const[j,v]of Object.entries(expected))check(p+'rows['+j+']',r[b+Number(j)],v);
    }
   }ownerChecks.push({iteration:g.iteration,commandIndex:g.commandIndex,active,mismatches});
  }
  if(g.stage==='micro-merge'&&g.when==='before'){
   const s=g.fields.state,p=g.fields.previous,r=g.fields.rows,h=s[4],slot=r[385],failures=[];
   if(s[1]===0)for(let i=0;i<s[3];i++)if(i!==slot){const mode=p[104+48*i],b=64*i,t=128*i;if(mode===1&&(g.fields.segments[b+1]!==1||g.fields.segments[b+5]!==h))failures.push({body:i,kind:'smooth97',status:g.fields.segments[b+1],h:g.fields.segments[b+5],expectedH:h});if(mode===3&&(g.fields.rolling[t+1]!==1||g.fields.rolling[t+10]!==1))failures.push({body:i,kind:'rolling97',status:g.fields.rolling[t+1],certificate:g.fields.rolling[t+10]});}
   microChecks.push({iteration:g.iteration,active:s[1]===0,slot,h,failures});
  }
 }
 const firstFailureIteration=states.find(x=>x.stage==='iteration-end'&&x.header[1]===7&&x.header[2]===97)?.iteration??null;
 return {baselineParity:true,diagnosticBytes:plan.diagnosticBytes,firstFailureIteration,detailedWindowCoversFailure:firstFailureIteration===null?null:firstFailureIteration<plan.firstIterations,firstObserved97:states.find(x=>x.header[1]===7&&x.header[2]===97)??null,states,ownerChecks,microChecks};
}
