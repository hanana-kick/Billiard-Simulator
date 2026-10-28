import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('world factory releases compiled shader wrappers before downstream factories',()=>{
 const r=spawnSync(process.execPath,['--expose-gc',fileURLToPath(new URL('./fixtures/world-shader-module-lifetime.mjs',import.meta.url))],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/0 retained/);
});
