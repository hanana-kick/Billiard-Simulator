'use strict';
// Test-only access to unchanged production ownership functions. This does not
// alter production exports or replace any numerical phase with another solver.
const fs=require('node:fs'),Module=require('node:module'),file=require.resolve('../src/experimental-three-ball-world'),source=fs.readFileSync(file,'utf8'),marker='const api=Object.freeze({CAPABILITY,validate,createReferenceStepper:';
if(!source.includes(marker))throw Error('Ownership test hook must match the exact production export');
const m=new Module(file,module);m.filename=file;m.paths=module.paths;
m._compile(source.replace(marker,'const api=Object.freeze({controller,prepareSharedContacts,validatePairBindings,CAPABILITY,validate,createReferenceStepper:'),file);
module.exports=m.exports;
