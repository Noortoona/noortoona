// The JSON manifest is the only authored source of V2 template metadata.
// Browser and native projections are checked in so neither needs a runtime fetch.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const manifest=JSON.parse(read('shared/wedding-templates.json'));
if(manifest.length!==12||new Set(manifest.map(t=>t.slug)).size!==12||new Set(manifest.map(t=>t.name)).size!==12)throw Error('Expected twelve unique wedding designs');
const templates=manifest.map(t=>({
  ...t,id:'wedding-v2-'+t.slug,group:'wedding',version:2,position:'center',
  background:'/assets/templates/wedding-v2/'+t.slug+'.webp',
  mobile:'/assets/templates/wedding-v2/'+t.slug+'-mobile.webp',
  fallback:'/assets/templates/wedding-v2/'+t.slug+'.jpg',
  thumbnail:'/assets/templates/wedding-v2/'+t.slug+'-thumb.webp',
  thumbnailFallback:'/assets/templates/wedding-v2/'+t.slug+'-thumb.jpg',
}));
const browser='  // BEGIN GENERATED WEDDING V2\n  const weddingTemplates = '+JSON.stringify(templates)+';\n  // END GENERATED WEDDING V2';
const renderer=read('invitation-renderer.js').replace(/  \/\/ BEGIN GENERATED WEDDING V2[\s\S]*?  \/\/ END GENERATED WEDDING V2/,browser);
const outputs=new Map([
 ['invitation-renderer.js',renderer],
 ['mobile/src/weddingTemplates.ts','// Generated from shared/wedding-templates.json. Run node scripts/sync-wedding-templates.mjs.\nexport const weddingTemplates = '+JSON.stringify(templates,null,2)+';\n'],
 ['mobile/src/weddingAssets.ts','// Generated native thumbnails; metadata remains in the shared manifest.\nexport const weddingAssets: Record<string, number> = {\n'+templates.map(t=>`  '${t.id}': require('../assets/templates/wedding-v2/${t.slug}-thumb.jpg'),`).join('\n')+'\n};\n'],
]);
const check=process.argv.includes('--check');
for(const [path,content]of outputs){if(check){if(read(path)!==content)throw Error('Stale template projection: '+path)}else writeFileSync(new URL(path,root),content);}
for(const t of templates){
 const source=new URL('assets/templates/wedding-v2/'+t.slug+'-thumb.jpg',root),target=new URL('mobile/assets/templates/wedding-v2/'+t.slug+'-thumb.jpg',root);
 if(check){if(!readFileSync(source).equals(readFileSync(target)))throw Error('Stale native thumbnail: '+t.slug)}
 else{mkdirSync(new URL('mobile/assets/templates/wedding-v2/',root),{recursive:true});copyFileSync(source,target);}
}
console.log('Wedding V2: 12 shared template projections '+(check?'verified':'updated'));
