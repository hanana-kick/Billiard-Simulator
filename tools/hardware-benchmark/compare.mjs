// Paired local reports only. No inferred or universal hardware factor.
import {readFileSync} from 'node:fs';
export function compareReports(a,b){
 for(const report of [a,b])if(report.schema!=='billiard-local-benchmark-v1'||report.status!=='complete')throw Error('Two complete benchmark reports required');
 for(const key of ['pipelineRevision'])if(a[key]!==b[key])throw Error(`Different ${key}`);
 for(const key of ['workerSHA256','fixtureSHA256','referenceSHA256'])if(!a.manifest?.[key]||a.manifest[key]!==b.manifest?.[key])throw Error(`Different or missing ${key}`);
 const comparisons=[];
 for(const row of a.runs){const other=b.runs.find(r=>r.n===row.n);if(!other)continue;
  for(const key of ['candidateSHA256','resultSHA256'])if(!row[key]||row[key]!==other[key])throw Error(`N${row.n}: different ${key}`);
  const x=row.summary.gpuMs.median,y=other.summary.gpuMs.median;if(!Number.isFinite(x)||!Number.isFinite(y)||x<=0||y<=0)throw Error('Invalid paired timing');
  comparisons.push({n:row.n,reportAWebGPUms:x,reportBWebGPUms:y,ratioAoverB:x/y});
 }
 if(!comparisons.length)throw Error('No identical measured N');
 return {pipelineRevision:a.pipelineRevision,comparisons,adapterA:a.adapter,adapterB:b.adapter,physicalHardwareVerified:false,meaning:'Observed WebGPU A/B ratios for each identical N only. Adapter labels do not prove physical hardware. Do not apply to other workloads, revisions or cloud timings.'};
}
if(process.argv[1]?.endsWith('/compare.mjs')){if(process.argv.length!==4)throw Error('Usage: node tools/hardware-benchmark/compare.mjs report-A.json report-B.json');console.log(JSON.stringify(compareReports(...process.argv.slice(2).map(p=>JSON.parse(readFileSync(p)))),null,2));}
