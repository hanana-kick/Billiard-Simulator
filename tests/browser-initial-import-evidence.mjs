// Test-only exact transport/fingerprint. Distinguishes f64 -0, undefined, bigint
// and Uint8Array; never becomes a gameplay input or projection dependency.
export function pack(value){
 if(value===null)return ['null'];
 if(typeof value==='number'){const v=new DataView(new ArrayBuffer(8));v.setFloat64(0,value,false);return ['f64',Array.from(new Uint8Array(v.buffer),x=>x.toString(16).padStart(2,'0')).join('')];}
 if(value instanceof Uint8Array)return ['uint8',Array.from(value)];
 if(typeof value==='bigint')return ['bigint',value.toString()];
 if(typeof value==='undefined')return ['undefined'];
 if(typeof value==='string'||typeof value==='boolean')return [typeof value,value];
 if(Array.isArray(value))return ['array',value.map(pack)];
 if(typeof value!=='object')throw Error('Unsupported test evidence');
 return ['object',Object.keys(value).sort().map(k=>[k,pack(value[k])])];
}
export function unpack([kind,value]){
 if(kind==='null')return null;if(kind==='undefined')return undefined;
 if(kind==='f64'){const bytes=Uint8Array.from(value.match(/../g),x=>parseInt(x,16));return new DataView(bytes.buffer).getFloat64(0,false);}
 if(kind==='uint8')return Uint8Array.from(value);if(kind==='bigint')return BigInt(value);
 if(kind==='array')return value.map(unpack);if(kind==='object')return Object.fromEntries(value.map(([k,v])=>[k,unpack(v)]));
 if(kind==='string'||kind==='boolean')return value;throw Error('Unknown evidence type');
}
