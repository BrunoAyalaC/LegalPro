import fs from 'fs';
let files=['LegalProBackend_Net/LegalPro.Api/LegalPro.Api.csproj','LegalProBackend_Net/LegalPro.Application/LegalPro.Application.csproj','LegalProBackend_Net/LegalPro.Domain/LegalPro.Domain.csproj','LegalProBackend_Net/LegalPro.Infrastructure/LegalPro.Infrastructure.csproj','LegalProBackend_Net/LegalPro.IntegrationTests/LegalPro.IntegrationTests.csproj','LegalProBackend_Net/LegalPro.UnitTests/LegalPro.UnitTests.csproj'];
for(let f of files){
  let p='C:/Users/Pc/Desktop/Abogacia/'+f;
  let t=fs.readFileSync(p,'utf8');
  t=t.replace(/<TargetFramework>net9\.0<\/TargetFramework>/g,'<TargetFramework>net8.0</TargetFramework>');
  t=t.replace(/Version="9\.0\.1"/g,'Version="8.0.8"');
  t=t.replace(/Version="9\.0\.2"/g,'Version="8.0.8"');
  t=t.replace(/Version="9\.0\.[^"]+"/g,'Version="8.0.8"');
  fs.writeFileSync(p,t,'utf8');
  console.log('fixed '+f);
}
