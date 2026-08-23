import fs from 'fs';
const base='C:/Users/Pc/Desktop/Abogacia';
const glob=fs.readdirSync(base+'/LegalProBackend_Net/LegalPro.Application',{recursive:true});
let files=[];
for(const f of glob){
  if(f.endsWith('.cs')) files.push(base+'/LegalProBackend_Net/LegalPro.Application/'+f);
}
let fixed=0;
for(const p of files){
  let t=fs.readFileSync(p,'utf8');
  const orig=t;
  t=t.replace(/\r\n, ITenantRequest/g, ', ITenantRequest');
  t=t.replace(/\n, ITenantRequest/g, ', ITenantRequest');
  t=t.replace(/: IRequest<([^>]+)>\s*\n\s*, ITenantRequest/g, ': IRequest<$1>, ITenantRequest');
  // also for non-generic IRequest
  t=t.replace(/: IRequest\s*\n\s*, ITenantRequest/g, ': IRequest, ITenantRequest');
  // Fix duplicate newlines
  t=t.replace(/, ITenantRequest\s*\n\{/g, ', ITenantRequest\n{');
  if(t!==orig){ fs.writeFileSync(p,t,'utf8'); fixed++; console.log('merged '+p.replace(base+'/',''));}
}
console.log('merged files '+fixed);
