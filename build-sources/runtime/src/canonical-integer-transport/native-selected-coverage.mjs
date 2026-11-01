/** Exact source-goal planner. Native GPU phases, never a CPU dynamics fallback. */
export function nextNativeOperation(program,cursor,goal,{rawTerminal=false}={}){
 if(!Number.isSafeInteger(cursor)||!Number.isSafeInteger(goal)||cursor<0||goal<=cursor||goal>program.commandCount)throw Error('Exact increasing native source goal required');
 if(rawTerminal&&cursor>=program.rawIdentity.start&&cursor<program.rawIdentity.end)return{kind:'identity',start:cursor,end:Math.min(goal,program.rawIdentity.end)};
 const g=program.fusionGroups.find(g=>g.start<=cursor&&cursor<g.end);
 if(g&&(cursor-g.start)%5===0&&cursor+5<=goal){const iterations=cursor===g.start&&g.iterations===16&&g.end<=goal?16:1;return{kind:'fused',start:cursor,end:cursor+iterations*5,iterations,entries:g.entries};}
 return{kind:'original',start:cursor,end:cursor+1,command:program.dictionary[program.indices[cursor]]};
}
