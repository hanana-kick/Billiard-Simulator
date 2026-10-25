// Source-only gate. Imports fresh live bytes, not archived initialization; no GPU.
const {test}=require('node:test'),assert=require('node:assert/strict');
test('fresh browser download and full-rest expected-only oracle retain strict source/byte identity',
 {skip:!process.env.LIVE_FOUR_BALL_INPUT||!process.env.FOUR_BALL_FULL_REPLAY},async()=>{
  const S=await import('./bounded-gpu-shot-source.mjs'),restore=S.forbidNativeContinuation();
  try{const live=await S.loadLiveInput(),oracle=S.loadExpectedOracle();assert.equal(S.hash(live.input.snapshot),oracle.initialSnapshotSha256);
    assert.equal(oracle.status,'native-rest-complete');assert.equal(oracle.frames.length,5845);
    const M=await import('../src/browser-initial-import/four-ball.mjs'),seed=await M.importInitialFourBall(live.decoder,live.input);
    require('../src/experimental-four-ball-world').validate(seed);
    console.log(JSON.stringify({scope:'source-only-no-compute',liveArtifactSha256:live.liveArtifactSha256,
      snapshotSha256:oracle.initialSnapshotSha256,expectedH:oracle.frames.length,noNativeContinuation:true}));
  }finally{restore();}
});
