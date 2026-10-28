// Defense in depth for the maintained HOST suite, not an OS security sandbox.
// No GPU binding/helper may load even if a future test accidentally enables it.
import {registerHooks,syncBuiltinESMExports} from 'node:module';
import fs from 'node:fs';import cp from 'node:child_process';import path from 'node:path';import {fileURLToPath} from 'node:url';
const fail=message=>{throw new Error('RESIDENT_HOST_ONLY: '+message);};
const root=process.env.RESIDENT_HOST_GUARD_ROOT,temp=process.env.RESIDENT_HOST_GUARD_TEMP,inputSetting=process.env.RESIDENT_HOST_GUARD_INPUTS;
const inputs=inputSetting?JSON.parse(inputSetting):[];if(!Array.isArray(inputs)||inputs.some(p=>typeof p!=='string'||!path.isAbsolute(p)||path.resolve(p)===path.parse(p).root))fail('explicit bounded input paths required');
if(!root||!temp)fail('runner-owned root/temp required');
const blocked=x=>/resident-candidate-gpu-support\.mjs|(?:^|[/\\])(?:webgpu|dawn)(?:[/\\.]|$)|\.node(?:$|[?#])/i.test(x);
registerHooks({resolve(specifier,context,next){if(blocked(specifier))fail('GPU/native binding import refused: '+specifier);const result=next(specifier,context);if(blocked(result.url))fail('GPU/native binding import refused: '+result.url);return result;}});
process.dlopen=()=>fail('native addon loading refused');
if(globalThis.navigator&&!Object.hasOwn(globalThis.navigator,'gpu'))Object.defineProperty(globalThis.navigator,'gpu',{get(){fail('navigator.gpu unavailable in HOST qualification');},configurable:false});
// Reject historical/private temp reads; only this run's freshly owned temp area
// and repository are allowed by default. Explicit source-suite paths are the
// only additional read authority; GPU restrictions remain identical.
const within=(p,b)=>p===b||p.startsWith(b+path.sep);
function checkRead(value){
 if(typeof value==='number')return;
 let p;try{p=path.resolve(value instanceof URL?fileURLToPath(value):String(value));}catch{return;}
 if((p==='/tmp'||p.startsWith('/tmp/'))&&!within(p,path.resolve(root))&&!within(p,path.resolve(temp))&&!inputs.some(base=>within(p,path.resolve(base))))fail('private /tmp input refused: '+p);
}
for(const key of ['readFileSync','readFile','createReadStream','statSync','lstatSync','existsSync']){const original=fs[key];fs[key]=function(p,...args){checkRead(p);return original.call(this,p,...args);};}
const readFile=fs.promises.readFile.bind(fs.promises);fs.promises.readFile=(p,...a)=>{checkRead(p);return readFile(p,...a);};
// The identity fixture spawns a fresh Node child. Preserve the same guard in
// that child; no shell, external executable, or opaque preload can be used.
function child(command,args,options={}){
 if(path.resolve(command)!==path.resolve(process.execPath)||options?.shell)fail('non-Node or shell child refused');
 if(Array.isArray(args)&&args.some(a=>typeof a==='string'&&/(?:^|[/\\])(?:run-resident-native-qualification\.cjs|resident-candidate-(?:tip-impact-isolated|microcode-world-isolated|microcode-recurrence-isolated|small-strike-isolated|raw-world-pc-isolated|[^/\\]*-native)\.mjs)$/.test(a)))fail('native qualification runner child refused');
 const e=options?.env??process.env;if(e.NODE_OPTIONS!==process.env.NODE_OPTIONS||e.RESIDENT_HOST_GUARD_ROOT!==root||e.RESIDENT_HOST_GUARD_TEMP!==temp||e.RESIDENT_HOST_GUARD_INPUTS!==inputSetting)fail('child must retain HOST guard');
}
for(const key of ['spawn','spawnSync','execFile','execFileSync']){const original=cp[key];cp[key]=function(command,args,options,...rest){child(command,args,Array.isArray(args)?options:args);return original.call(this,command,args,options,...rest);};}
for(const key of ['exec','execSync','fork'])cp[key]=()=>fail('shell/fork child refused; use guarded explicit Node executable');
syncBuiltinESMExports();
