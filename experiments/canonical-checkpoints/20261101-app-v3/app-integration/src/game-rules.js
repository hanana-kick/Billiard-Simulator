/* Scoring observes real contacts; it never alters physical outcomes. */
(function(G){
'use strict';
class FourBallGame {
 constructor(cueIds=[1,2],redIds=[3,4],{threeCushion=false}={}){this.threeCushion=threeCushion;this.cueIds=cueIds;this.redIds=redIds;this.scores={[cueIds[0]]:0,[cueIds[1]]:0};this.activeCue=cueIds[0];this.pending=null;this.lastResult='적구 두 개를 맞히세요.';}
 begin(cueId,{threeCushion=this.threeCushion}={}){if(!this.cueIds.includes(cueId)||this.pending)return false;this.activeCue=cueId;this.pending={cueId,reds:[],foul:false,threeCushion,cushions:0,goalCushions:null};return true;}
 contact(e){const p=this.pending;if(!p||!e.a||!e.b)return;const other=e.a.id===p.cueId?e.b:e.b.id===p.cueId?e.a:null;if(!other)return;if(this.cueIds.includes(other.id)&&other.id!==p.cueId)p.foul=true;if(other.kind==='cushion')p.cushions++;if(this.redIds.includes(other.id)&&!p.reds.includes(other.id)){p.reds.push(other.id);if(p.reds.length===2)p.goalCushions=p.cushions;}if(other.kind==='floor')p.foul=true;}
 finish(){const p=this.pending;if(!p)return null;const delta=p.foul?-1:p.reds.length===2&&(!p.threeCushion||p.goalCushions>=3)?1:0;this.scores[p.cueId]+=delta;this.lastResult=p.foul?'파울 −1 · 상대 수구 접촉 또는 장외':delta?'득점 +1 · 두 적구 접촉':'득점 없음 · 차례 교대';if(delta!==1)this.activeCue=this.cueIds.find(id=>id!==p.cueId);this.pending=null;return{cueId:p.cueId,delta,nextCue:this.activeCue};}
 snapshot(){return JSON.parse(JSON.stringify({threeCushion:this.threeCushion,cueIds:this.cueIds,redIds:this.redIds,scores:this.scores,activeCue:this.activeCue,pending:this.pending,lastResult:this.lastResult}));}
 restore(s){Object.assign(this,JSON.parse(JSON.stringify(s)));}
}
class ThreeBallGame extends FourBallGame {
 constructor(cueIds=[1,2],objectIds=[1,2,3]){super(cueIds,[],{threeCushion:true});this.objectIds=objectIds;this.lastResult='3쿠션 후 나머지 두 공을 맞히세요.';}
 begin(cueId){const ok=super.begin(cueId,{threeCushion:true});if(ok)this.pending.targets=this.objectIds.filter(id=>id!==cueId);return ok;}
 contact(e){const p=this.pending;if(!p||!e.a||!e.b)return;const other=e.a.id===p.cueId?e.b:e.b.id===p.cueId?e.a:null;if(!other)return;if(other.kind==='cushion')p.cushions++;if(p.targets.includes(other.id)&&!p.reds.includes(other.id)){p.reds.push(other.id);if(p.reds.length===2)p.goalCushions=p.cushions;}if(other.kind==='floor')p.foul=true;}
 finish(){const p=this.pending;if(!p)return null;const delta=!p.foul&&p.reds.length===2&&p.goalCushions>=3?1:0;this.scores[p.cueId]+=delta;this.activeCue=delta?p.cueId:this.cueIds.find(id=>id!==p.cueId);this.lastResult=delta?'득점 +1 · 차례 유지':'득점 없음 · 차례 교대';this.pending=null;return{cueId:p.cueId,delta,nextCue:this.activeCue};}
 snapshot(){return{...super.snapshot(),objectIds:[...this.objectIds],kind:'three'};}
}
G.ThreeBallGame=ThreeBallGame;
G.FourBallGame=FourBallGame;
})(globalThis);
