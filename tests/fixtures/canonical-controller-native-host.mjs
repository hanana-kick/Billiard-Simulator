/** Actual controller + physics classes, with presentation scheduling disabled.
 * No physics/selected/search backend is replaced. Not a DOM/browser fixture. */
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),R=require('../../vendor/rapier.cjs');await R.init();
export function createNativeControllerHost(){
 globalThis.RAPIER=R;
 for(const name of ['math','physics','game-rules','render-cadence','controller'])require('../../src/'+name+'.js');
 const c=new globalThis.LabController();c.lab=new globalThis.PhysicsLab(R);c.game=new globalThis.ThreeBallGame();c.state.gameMode='free';c.state.ready=true;
 c.scheduleFrame=c.renderSide=c.updateHandles=()=>{};c.renderer={render(){},isFallback:false,dispose(){}};
 // There is no canvas/window in this native host. Preserve the actual owner
 // lifecycle while replacing only DOM listener teardown of the pre-install host.
 c.dispose=function(){this.disposed=true;clearTimeout(this.predictionTimer);clearTimeout(this.noticeTimer);this.lab?.dispose();};
 return c;
}
