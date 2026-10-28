// Diagnostic-only exact constant-relative-pair experiment; never imported by runtime.
import assert from 'node:assert/strict';
export function withConstantPairMask(source){
 const changes=[
  [
    "   let a=b+8u+i*10u;let c=b+8u+j*10u;let radius=value(a+9u)+value(c+9u);\n",
    "   if((activePairs&(1u<<(i*4u+j)))==0u){continue;} // EXACT_CONSTANT_PAIR_MASK\n   let a=b+8u+i*10u;let c=b+8u+j*10u;let radius=value(a+9u)+value(c+9u);\n"
  ],
  [
    " }}}\n",
    "  if(value(b+9u+i*10u)!=value(b+9u+j*10u)||value(b+10u+i*10u)!=value(b+10u+j*10u)){activePairs|=1u<<(i*4u+j);} // EXACT_CONSTANT_PAIR_MASK\n }}}\n"
  ],
  [
    " if(!invalid){for(var i=0u;i<n;i++){for(var j=i+1u;j<n;j++){\n",
    " var activePairs=0u; // EXACT_CONSTANT_PAIR_MASK\n if(!invalid){for(var i=0u;i<n;i++){for(var j=i+1u;j<n;j++){\n"
  ],
  [
    "    const a=b+8+i*10,c=b+8+j*10,r=s[a+9]+s[c+9],range=interval(s[c]-s[a],s[c+1]-s[a+1],s[c+2]-s[a+2],l,u);\n",
    "    if((activePairs&(1<<(i*4+j)))===0)continue; // EXACT_CONSTANT_PAIR_MASK\n    const a=b+8+i*10,c=b+8+j*10,r=s[a+9]+s[c+9],range=interval(s[c]-s[a],s[c+1]-s[a+1],s[c+2]-s[a+2],l,u);\n"
  ],
  [
    "  if(!invalid)for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(Math.abs(s[b+8+i*10]-s[b+8+j*10])<=s[b+17+i*10]+s[b+17+j*10])invalid=true;\n",
    "  // Constant relative position cannot collide after the initial separation check.\n  let activePairs=0; // EXACT_CONSTANT_PAIR_MASK\n  if(!invalid)for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){\n   if(Math.abs(s[b+8+i*10]-s[b+8+j*10])<=s[b+17+i*10]+s[b+17+j*10])invalid=true;\n   if(s[b+9+i*10]!==s[b+9+j*10]||s[b+10+i*10]!==s[b+10+j*10])activePairs|=1<<(i*4+j); // EXACT_CONSTANT_PAIR_MASK\n  }\n"
  ]
];
 for(const [before,after] of changes){assert.equal(source.split(before).length,2,'Baseline fixture changed; re-review mask');source=source.replace(before,after);}
 return source;
}
