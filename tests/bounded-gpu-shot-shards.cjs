// Pure expected-data verifier. Reads every shard without any physics/GPU work.
const {test}=require('node:test'),assert=require('node:assert/strict');
test('pinned expected-only reader preserves all original h and checkpoint coverage with bounded live data',
 {skip:!process.env.BOUNDED_EXPECTED_SHARDS||!process.env.BOUNDED_EXPECTED_SHARDS_SHA256},async()=>{
  const source=await import('./bounded-gpu-shot-source.mjs'),restore=source.forbidNativeContinuation();
  try{const {loadExpectedShards}=await import('./bounded-gpu-shot-shards.mjs'),oracle=await loadExpectedShards();
    const Graph=require('./four-ball-broad-graph-seed.cjs');let checkpoints=0;
    for(let i=0;i<oracle.hCount;i++){const frame=oracle.frame(i);assert.equal(frame.hCount,i+1);
      if(frame.outerSubstep===0&&oracle.hasCheckpoint(frame.outerStep)){
        const row=oracle.checkpoint(frame.outerStep);assert.ok(row.state.islands);assert.ok(row.bodies.length>=20);
        const graph=Graph.graphView(row);assert.ok(graph.edges.length>=4);checkpoints++;
      }
    }
    assert.equal(checkpoints,132);assert.equal(checkpoints,oracle.checkpointCount);assert.equal(oracle.hCount,5845);
    assert.deepEqual(oracle.frame(oracle.hCount-1).game,oracle.lastGame);
    console.log(JSON.stringify({scope:'all-expected-shards-no-compute',h:oracle.hCount,checkpoints,
      manifestSha256:oracle.manifestSha256,memory:process.memoryUsage(),processMaxRSSKiB:process.resourceUsage().maxRSS}));
  }finally{restore();}
});
