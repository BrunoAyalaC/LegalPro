import fs from 'fs';
const base='C:/Users/Pc/Desktop/Abogacia';
const allFiles=[
 'LegalProBackend_Net/LegalPro.Application/Documentos/Commands/CrearDocumentoCommand.cs',
 'LegalProBackend_Net/LegalPro.Application/Simulacion/Commands/IniciarSimulacionCommand.cs',
 'LegalProBackend_Net/LegalPro.Application/Documentos/Queries/GetDocumentosByExpedienteQuery.cs',
 'LegalProBackend_Net/LegalPro.Application/Simulacion/Queries/GetSimulacionesQuery.cs',
 'LegalProBackend_Net/LegalPro.Application/Simulacion/Queries/GetSimulacionBoardQuery.cs',
 'LegalProBackend_Net/LegalPro.Application/Chat/Queries/GetSesionesChatQuery.cs',
 'LegalProBackend_Net/LegalPro.Application/Expedientes/Queries/GenerarResumenCasoQuery.cs',
 'LegalProBackend_Net/LegalPro.Application/Fiscal/Commands/GenerarRequerimientoFiscalCommand.cs',
 'LegalProBackend_Net/LegalPro.Application/Juez/Commands/GenerarResolucionJudicialCommand.cs',
 'LegalProBackend_Net/LegalPro.Application/Interrogatorio/Commands/GenerarInterrogatorioCommand.cs',
 'LegalProBackend_Net/LegalPro.Application/Notificaciones/Queries/GetNotificacionesQuery.cs',
];
for(const f of allFiles){
  const p=base+'/'+f;
  let t=fs.readFileSync(p,'utf8');
  t=t.replace(/: IRequest<([^>]+)>\s*\n\s*, ITenantRequest/g, ': IRequest<$1>, ITenantRequest');
  t=t.replace(/: IRequest\s*\n\s*, ITenantRequest/g, ': IRequest, ITenantRequest');
  t=t.replace(/public Guid OrganizationId \{ get; set; \} = string\.Empty;/g,'public Guid OrganizationId { get; set; }');
  t=t.replace(/public Guid OrganizationId \{ get; set; \} = Guid\.Empty;/g,'public Guid OrganizationId { get; set; }');
  // fix multiline class line break
  t=t.replace(/public class (\w+) : IRequest<([^>]+)>\n, ITenantRequest/g,'public class $1 : IRequest<$2>, ITenantRequest');
  t=t.replace(/public class (\w+) : IRequest\n, ITenantRequest/g,'public class $1 : IRequest, ITenantRequest');
  // also for record
  // ensure encoding not broken - leave as is
  fs.writeFileSync(p,t,'utf8');
  console.log('fixed '+f);
}
// Also verify counts
import { execSync } from 'child_process';
let cnt=0;
for(const f of allFiles){
  const t=fs.readFileSync(base+'/'+f,'utf8');
  if(t.includes('ITenantRequest')) cnt++;
}
console.log('tenant impl count among these: '+cnt);
// Check all previous
const checkFiles=[
 'LegalProBackend_Net/LegalPro.Application/Expedientes/Commands/CrearExpedienteCommand.cs',
 'LegalProBackend_Net/LegalPro.Application/Expedientes/Queries/GetExpedientesQuery.cs',
 'LegalProBackend_Net/LegalPro.Application/Expedientes/Queries/GetExpedienteByIdQuery.cs',
 'LegalProBackend_Net/LegalPro.Application/Expedientes/Commands/ActualizarExpedienteCommand.cs',
 'LegalProBackend_Net/LegalPro.Application/Expedientes/Commands/EliminarExpedienteCommand.cs',
 'LegalProBackend_Net/LegalPro.Application/Chat/Commands/EnviarMensajeChatCommand.cs',
 'LegalProBackend_Net/LegalPro.Application/Chat/Queries/GetHistorialChatQuery.cs',
 'LegalProBackend_Net/LegalPro.Application/Documentos/Commands/CrearDocumentoCommand.cs',
 'LegalProBackend_Net/LegalPro.Application/Simulacion/Commands/IniciarSimulacionCommand.cs',
 'LegalProBackend_Net/LegalPro.Application/Redactor/Commands/GenerarBorradorCommand.cs',
 'LegalProBackend_Net/LegalPro.Application/Alegato/Commands/GenerarAlegatoCommand.cs',
 'LegalProBackend_Net/LegalPro.Application/Analisis/Commands/AnalizarExpedienteCommand.cs',
];
let total=0;
for(const f of [...allFiles, ...checkFiles]){
  const t=fs.readFileSync(base+'/'+f,'utf8');
  if(t.includes('ITenantRequest')) total++;
}
console.log('total unique tenant impl: '+new Set([...allFiles, ...checkFiles]).size+' impl count approx '+total);
