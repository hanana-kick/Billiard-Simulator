'use strict';
const fs=require('node:fs'),path=require('node:path');
const source=require.resolve('@dimforge/rapier3d-compat');
fs.mkdirSync(path.join(__dirname,'../vendor'),{recursive:true});
fs.copyFileSync(source,path.join(__dirname,'../vendor/rapier.cjs'));
console.log('Pinned Rapier compatibility engine installed.');
