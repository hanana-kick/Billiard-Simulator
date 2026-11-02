import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const source=await fs.readFile(new URL('./native-original-assets.mjs',import.meta.url));
async function isolated(fn){const root=await fs.mkdtemp(path.join(os.tmpdir(),'native-original-assets-'));const previous=process.env.NATIVE_TERMINAL_ORIGINAL_ASSETS;delete process.env.NATIVE_TERMINAL_ORIGINAL_ASSETS;try{await fs.mkdir(path.join(root,'tests'));await fs.writeFile(path.join(root,'tests/resolver.mjs'),source);const {resolveNativeOriginalAssets}=await import(pathToFileURL(path.join(root,'tests/resolver.mjs')));await fn(root,resolveNativeOriginalAssets);}finally{if(previous===undefined)delete process.env.NATIVE_TERMINAL_ORIGINAL_ASSETS;else process.env.NATIVE_TERMINAL_ORIGINAL_ASSETS=previous;await fs.rm(root,{recursive:true,force:true});}}
test('missing own build fails explicitly',()=>isolated(async(root,resolve)=>{await assert.rejects(resolve(),/Run npm run build:release first/);}));
test('unsuccessful own build cannot supply original assets',()=>isolated(async(root,resolve)=>{const d=path.join(root,'.compiled-build/release-failed');await fs.mkdir(d,{recursive:true});await fs.writeFile(path.join(d,'receipt.json'),JSON.stringify({success:false}));await assert.rejects(resolve(),/No successful own-checkout/);}));
test('successful receipt cannot point outside own build',()=>isolated(async(root,resolve)=>{const d=path.join(root,'.compiled-build/release-external');await fs.mkdir(path.join(d,'generated'),{recursive:true});await fs.mkdir(path.join(root,'outside'));await fs.writeFile(path.join(d,'receipt.json'),JSON.stringify({success:true}));await fs.writeFile(path.join(d,'generated/app-build.json'),JSON.stringify({programDirectory:path.join(root,'outside')}));await assert.rejects(resolve(),/Original assets must belong to this checkout build/);}));
test('explicit assets still require exact original manifest',()=>isolated(async(root,resolve)=>{const d=path.join(root,'wrong');await fs.mkdir(d);await fs.writeFile(path.join(d,'manifest.json'),'{}');process.env.NATIVE_TERMINAL_ORIGINAL_ASSETS=d;await assert.rejects(resolve(),/Exact original manifest required/);}));
