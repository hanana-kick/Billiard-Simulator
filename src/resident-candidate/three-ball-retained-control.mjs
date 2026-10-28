// SPDX-License-Identifier: Apache-2.0
// Shared source ABI only. These fields do not themselves admit a physical
// state: the retained owner seals its authentic t0 plan, and emitted bootstrap
// / advance entry points produce and check every dynamic value below.
export const THREE_BALL_RETAINED_CONTROL=Object.freeze({
 words:64,magicValue:0x52335248,versionValue:1,
 magic:0,version:1,status:2,phase:3,publishedFrame:4,entryFrame:5,frame:6,
 entrySequence:7,sequence:8,entryEpoch:9,currentEpoch:10,
 publishedTime:12,entryTime:14,sourceH:16,sourceDt:18,cueStarted:20,outerSteps:22,
 advances:24,inAdvance:25,bootstrapCompleted:26,reason:27,stage:28,
 readyPhase:1,advancingPhase:2,okStatus:1,failedStatus:4,
});

// A source generator accepts an address, never a caller-supplied frame,
// sequence, epoch, clock or proof boolean. The runtime values come from the
// prior successful same-bank application and the original current lifecycle.
export function threeBallRetainedControlBase(base){
 if(!Number.isSafeInteger(base)||base<0||base>=0x10000000)
  throw new RangeError('Genuine-three retained control requires a bounded absolute base');
 return base;
}
