/** Lightweight immutable input domain. No physics or GPU imports. */
export const CANONICAL_SEARCH_AXES=Object.freeze([['angles','angle'],['speeds','speed'],['elevations','elevation'],['tipXs','tipX'],['tipYs','tipY']].map(Object.freeze));
const axes=CANONICAL_SEARCH_AXES;
export const CANONICAL_SEARCH_MAXIMUM_CANDIDATES=4096;
export const CANONICAL_SEARCH_RANGES=Object.freeze({angles:Object.freeze([-180,180]),speeds:Object.freeze([.5,4.5]),elevations:Object.freeze([0,85]),tipXs:Object.freeze([-.6,.6]),tipYs:Object.freeze([-.6,.6])});
export function canonicalSearchPopulation({parameterGrid,maximumCandidates=4096}={}){
 if(!Number.isSafeInteger(maximumCandidates)||maximumCandidates<1||maximumCandidates>4096)throw RangeError('Explicit candidate limit1..4096');
 if(!parameterGrid||Object.keys(parameterGrid).sort().join(',')!==axes.map(x=>x[0]).sort().join(','))throw TypeError('Exact five-axis parameter grid required');
 let total=1;const grid={};for(const [key]of axes){const a=parameterGrid[key];if(!Array.isArray(a)||!a.length||a.some(v=>!Number.isFinite(v))||new Set(a).size!==a.length)throw TypeError('Nonempty distinct finite grid axis '+key);total*=a.length;if(!Number.isSafeInteger(total)||total>maximumCandidates)throw RangeError('Explicit grid exceeds candidate limit');const [min,max]=CANONICAL_SEARCH_RANGES[key];if(a.some(v=>v<min||v>max))throw RangeError('Grid axis '+key+' must be within['+min+','+max+']; no silent clamp or normalization');grid[key]=a.slice();}
 const population=[];function visit(i,settings){if(i===axes.length){population.push(Object.freeze({candidateId:population.length+1,settings:Object.freeze({...settings})}));return;}const [key,field]=axes[i];for(const value of grid[key])visit(i+1,{...settings,[field]:value});}visit(0,{});
 const unsupportedTipCombinations=grid.tipXs.reduce((n,x)=>n+grid.tipYs.filter(y=>Math.hypot(x,y)>.6).length,0)*grid.angles.length*grid.speeds.length*grid.elevations.length;
 return Object.freeze({population:Object.freeze(population),domain:Object.freeze({kind:'finite-explicit-grid',total,maximumCandidates,parallelWidth:3,unsupportedTipCombinations,counts:Object.freeze(Object.fromEntries(axes.map(([k])=>[k,grid[k].length]))),parameterGrid:Object.freeze(Object.fromEntries(Object.entries(grid).map(([k,v])=>[k,Object.freeze(v)])))})});
}
