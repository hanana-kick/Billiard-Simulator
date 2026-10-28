// Bundled twice: frozen CPU graph and independently pinned GPU graph.
import {encodeCanonicalScene,createCanonicalRequest,createCanonicalCandidate} from 'CONTRACT';
import {prepareRawWorldBinding,prepareRawWorldBatch,snapshotRawWorldBatch} from 'RAW';
export function context(fixture){
 const admission=encodeCanonicalScene(fixture.snapshot,{objectIds:fixture.snapshot.objects.map(x=>x.id),staticCount:fixture.snapshot.statics.length});
 if(!admission.admitted)throw Error('Fixture rejected');
 const request=createCanonicalRequest({scene:admission.scene,...fixture.request});
 const raw=prepareRawWorldBinding(request,{absoluteTick:1234,sceneKey:11,requestKey:23});
 const candidates=fixture.candidates.map(c=>createCanonicalCandidate(request,c.id,c.settings));
 return {request,raw,candidates,batch:cs=>prepareRawWorldBatch(raw,cs,{maximumSteps:2048}),snapshotRawWorldBatch};
}
export const options=Object.freeze({sceneKey:11,requestKey:23,durationTicks:65535,budgets:[2000,2000,20000,20000,20000,20000,20000],maxWorldSteps:64});
