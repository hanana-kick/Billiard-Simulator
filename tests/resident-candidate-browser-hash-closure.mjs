/* SPDX-License-Identifier: Apache-2.0
 * Static ESM inventory only. Dynamic require/global loading is intentionally
 * reported separately; this is not proof that the whole closure browser-loads.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const SHA_ROOTS=Object.freeze(['world-initialization','world-h','world-device-pc','world-owners','world-microcode-source','raw-microcode-source','microcode-compiler','microcode-allocation','microcode-vm','microcode-source-macros','macro-launch-profile']);
export const SHA_CALLERS=Object.freeze(['raw-microcode-source','microcode-compiler','microcode-source-intrinsics','microcode-preparation','microcode-source-macros','microcode-allocation','macro-launch-profile','macro-launch-data']);
export function residentHashImportInventory(){
 const todo=SHA_ROOTS.map(name=>resolve(root,'src/resident-candidate',name+'.mjs')),edges={},external=[],classic=[];
 while(todo.length){const path=todo.pop(),name=relative(root,path);if(name in edges)continue;const source=readFileSync(path,'utf8'),imports=[...source.matchAll(/(?:\bimport\s+(?:[^;]*?\s+from\s*)?|\bexport\s+[^;]*?\s+from\s*)['"]([^'"]+)['"]/g)].map(m=>m[1]);edges[name]=imports;for(const value of imports)if(value.startsWith('.'))todo.push(resolve(dirname(path),value));else external.push({file:name,specifier:value});if(/\brequire\s*\(|\bmodule\.exports|\bprocess\./.test(source))classic.push(name);}
 return{roots:SHA_ROOTS,staticModuleCount:Object.keys(edges).length,externalImports:external,classicCommonJsOrProcessModules:classic.sort(),edges};
}
test('approved eight SHA callers have no direct Node dependency; static ESM closure has no external import',()=>{
 for(const name of SHA_CALLERS){const source=readFileSync(resolve(root,'src/resident-candidate',name+'.mjs'),'utf8');assert.match(source,/import\s*\{createHash\}\s*from\s*'\.\/source-sha256\.mjs'/);assert.doesNotMatch(source,/['"]node:/);}
 const graph=residentHashImportInventory();assert.deepEqual(graph.externalImports,[]);assert.ok(graph.edges['src/resident-candidate/source-sha256.mjs']);assert.ok(graph.edges['src/resident-candidate/macro-launch-data.mjs']);assert.ok(graph.classicCommonJsOrProcessModules.includes('src/experimental-cue-convex-topology.js'),'Node-only export remains an explicit next adapter boundary');assert.ok(graph.classicCommonJsOrProcessModules.includes('src/experimental-ccd-proxy-distance-kernel.js'),'CLI branch not silently rewritten');
});
