// TEST-ONLY independent legacy Node SHA implementation of the same module.
// Never imported by production/browser modules and never executes a GPU.
import {readFile} from 'node:fs/promises';
export async function nodeHashInverseModule(name){
 const url=new URL('../src/resident-candidate/'+name+'.mjs',import.meta.url);
 const source=(await readFile(url,'utf8')).replace("from './source-sha256.mjs'","from 'node:crypto'").replace(/(from|import)\s*['"](\.[^'"]+)['"]/g,(_,kind,path)=>kind+' '+JSON.stringify(new URL(path,url).href));
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
