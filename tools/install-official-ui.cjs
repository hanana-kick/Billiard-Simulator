'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const transform=s=>{const icons=new Set();let t=s.replace(/from "cn"/g,'from "@/lib/utils"').replaceAll('@/registry/bases/base/ui/','@/components/ui/');t=t.replace(/<IconPlaceholder([\s\S]*?)\/>/g,(_,attrs)=>{const icon=attrs.match(/lucide="([^"]+)"/);if(!icon)throw Error('Icon lacks lucide mapping');icons.add(icon[1]);return '<'+icon[1]+attrs.replace(/\s+(lucide|tabler|hugeicons|phosphor|remixicon)="[^"]+"/g,'')+'/>'});return t.replace('import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder"',icons.size?`import { ${[...icons].join(', ')} } from "lucide-react"`:'');};
const manifest=JSON.parse(fs.readFileSync(path.join(root,'vendor/shadcn/provenance.json')));
for(const item of manifest.files){
 const file=path.join(root,'vendor/shadcn/base-nova',item.name+'.json'),raw=fs.readFileSync(file);
 if(crypto.createHash('sha256').update(raw).digest('hex')!==item.sha256)throw Error('Registry snapshot mismatch '+item.name);
 const original=JSON.parse(raw).files[0].content,generated=transform(original).replaceAll('@/registry/base-nova/ui/','@/components/ui/').replaceAll('@/registry/base-nova/hooks/','@/hooks/');
 const dest=path.join(root,item.target);fs.mkdirSync(path.dirname(dest),{recursive:true});
 if(process.argv.includes('--check')){if(fs.readFileSync(dest,'utf8')!==generated)throw Error('Modified styled registry component '+item.name)}else fs.writeFileSync(dest,generated);
}
console.log(`${manifest.files.length} official styled base-nova registry components verified, including tabs.`);
