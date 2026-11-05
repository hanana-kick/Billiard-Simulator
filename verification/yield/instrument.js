(()=>{
 const NativeBlob=globalThis.Blob;
 const helper=`\nconst __yd={events:[],seq:0};
function __ym(s,type,extra={}){__yd.events.push({type,t:performance.now(),bg:s.background,version:s.version,suspended:s.suspended,deadline:s.search?.core?.deadline,evaluations:s.search?.core?.evaluations,...extra});}
function __yf(s,extra={}){__ym(s,'flush',extra);self.postMessage({type:'yield-diagnostic',value:{origin:performance.timeOrigin,seq:__yd.seq++,events:__yd.events}});__yd.events=[];}
async function __yy(s,kind){const start=performance.now(),delay=s.background?4:0,bg=s.background;await new Promise(r=>setTimeout(r,delay));__ym(s,'yield',{start,end:performance.now(),delay,bgAtStart:bg,kind});}
`;
 globalThis.Blob=class extends NativeBlob{constructor(parts,options){
  if(Array.isArray(parts)&&parts.every(x=>typeof x==='string')&&parts.join('').includes('function coordinatorBootstrap()')){
   let code=parts.join('');let count=0;
   const replace=(a,b)=>{if(!code.includes(a))throw Error('Missing diagnostic anchor: '+a);code=code.replace(a,b);count++;};
   replace('class OptimizerService{',helper+'\nclass OptimizerService{');
   replace('const until=performance.now()+(this.background?8:this.coordinator?32:8)', 'const __ys=performance.now();const until=performance.now()+(this.background?8:this.coordinator?32:8)');
   replace('if(performance.now()-lastReport>160)', "__ym(this,'slice',{start:__ys,end:performance.now(),done,job:job.id});if(performance.now()-lastReport>160)");
   replace('if(!done)await new Promise(r=>setTimeout(r,this.background?4:0));', "if(!done)await __yy(this,'slice');");
   replace("if(['inverse-constraints','cpu-event-inverse','cpu-event-window-inverse'].includes(req.options.searchAlgorithm))await new Promise(r=>setTimeout(r,this.background?4:0));", "if(['inverse-constraints','cpu-event-inverse','cpu-event-window-inverse'].includes(req.options.searchAlgorithm))await __yy(this,'wave');");
   replace('if(final)this.onResult(decorated);', "if(final)__yf(this,{reason:decorated.terminationReason,physicsSteps:decorated.physicsSteps,evaluations:decorated.evaluations});if(final)this.onResult(decorated);");
   replace('G.OptimizerService=OptimizerService;',`for(const name of ['request','suspend','resumeBackground','resume','promoteToForeground','cancel']){const original=OptimizerService.prototype[name];OptimizerService.prototype[name]=function(...args){__ym(this,name+'-enter');const v=original.apply(this,args);__ym(this,name+'-exit',{returned:typeof v==='boolean'?v:null});return v;};}G.OptimizerService=OptimizerService;`);
   parts=[code];
  }
  super(parts,options);
 }};
})();
