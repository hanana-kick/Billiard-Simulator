/* Render deadlines are independent from Rapier's fixed integration step. */
(function(G){'use strict';class RenderCadence{
 constructor(){this.last=-Infinity;this.hidden=false;this.frames=0;}
 allow(now,fps){if(this.hidden||!Number.isFinite(now)||!Number.isFinite(fps)||fps<=0)return false;if(now-this.last+1e-7<1000/fps)return false;this.last=now;this.frames++;return true;}
 suspend(){this.hidden=true;}
 resume(){this.hidden=false;}
}G.RenderCadence=RenderCadence;})(globalThis);
