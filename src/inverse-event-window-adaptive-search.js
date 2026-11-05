/* Public entry for the isolated CPU prototype. A cue near a cushion requires
 * larger geometric lookahead because clearance restoration can force a steep
 * cue pose and make the nearest ideal roots poor initializers. This changes
 * admission priority only. The fresh frontier stays eight, with at most one
 * extra carried continuation; no branch is cut.
 */
(function(G){
'use strict';
const base=G.LabEventTailSearchWindow;
function create(R,req,options={}){
 const cue=req.snapshot?.objects?.find(o=>o.id===req.selectedId),r=cue?.radius;
 const gap=cue?Math.min(G.LabDimensions.width/2-Math.abs(cue.pos.x)-r,G.LabDimensions.depth/2-Math.abs(cue.pos.z)-r):NaN;
 const nearCushion=Number.isFinite(gap)&&gap<r;
 const lookahead=options.lookahead??(nearCushion?128:64);
 const s=base.create(R,req,{frontierStepBudget:49152,compensateElevationSpeed:true,carryBest:true,maxConsecutiveRetentions:1,preserveFreshFrontier:true,...options,lookahead});
 s.eventConditioning={cueRailGap:Number.isFinite(gap)?gap:null,nearCushion,lookahead};return s;
}
function result(s){return {...base.result(s),conditioning:{...s.eventConditioning}};}
G.LabCPUEventSearchWindow={...base,create,result};
})(globalThis);
