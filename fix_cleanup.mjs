import fs from 'fs';
const base='C:/Users/Pc/Desktop/Abogacia';
const fixes={
  'LegalProBackend_Net/LegalPro.Application/Documentos/Commands/CrearDocumentoCommand.cs': [
    ['public Guid ExpedienteId { get; set; } // placeholder\n    // ITenantRequest\n    public Guid OrganizationId { get; set; } { get; set; }','public Guid ExpedienteId { get; set; }\n    public Guid OrganizationId { get; set; }'],
    ['public class CrearDocumentoCommand : IRequest<DocumentoCreadoDto>\n, ITenantRequest','public class CrearDocumentoCommand : IRequest<DocumentoCreadoDto>, ITenantRequest']
  ],
  'LegalProBackend_Net/LegalPro.Application/Simulacion/Commands/IniciarSimulacionCommand.cs': null,
  'LegalProBackend_Net/LegalPro.Application/Documentos/Queries/GetDocumentosByExpedienteQuery.cs': null,
  'LegalProBackend_Net/LegalPro.Application/Simulacion/Queries/GetSimulacionesQuery.cs': null,
  'LegalProBackend_Net/LegalPro.Application/Simulacion/Queries/GetSimulacionBoardQuery.cs': [
    ['public class GetSimulacionBoardQuery : IRequest<SimulacionBoardDto>\n, ITenantRequest','public class GetSimulacionBoardQuery : IRequest<SimulacionBoardDto>, ITenantRequest']
  ],
  'LegalProBackend_Net/LegalPro.Application/Chat/Queries/GetSesionesChatQuery.cs': null,
  'LegalProBackend_Net/LegalPro.Application/Expedientes/Queries/GenerarResumenCasoQuery.cs': null,
  'LegalProBackend_Net/LegalPro.Application/Fiscal/Commands/GenerarRequerimientoFiscalCommand.cs': null,
  'LegalProBackend_Net/LegalPro.Application/Juez/Commands/GenerarResolucionJudicialCommand.cs': null,
  'LegalProBackend_Net/LegalPro.Application/Interrogatorio/Commands/GenerarInterrogatorioCommand.cs': null,
  'LegalProBackend_Net/LegalPro.Application/Notificaciones/Queries/GetNotificacionesQuery.cs': null,
};
for(const [file, reps] of Object.entries(fixes)){
  const p=base+'/'+file;
  let t=fs.readFileSync(p,'utf8');
  if(reps){
    for(const [from,to] of reps) t=t.replace(from,to);
  }
  // Generic cleanup: fix double , ITenantRequest handling
  t=t.replace(/: IRequest<([^>]+)>\n, ITenantRequest/g, ': IRequest<$1>, ITenantRequest');
  t=t.replace(/: IRequest\n, ITenantRequest/g, ': IRequest, ITenantRequest');
  // Fix duplicated property patterns like "public Guid OrganizationId { get; set; } { get; set; }"
  t=t.replace(/public Guid OrganizationId \{ get; set; \} \{ get; set; \}/g,'public Guid OrganizationId { get; set; }');
  // Fix placeholder injections
  // For CrearDocumento, check leftover "public Guid ExpedienteId { get; set; } // placeholder" already handled
  // For other class files where we inserted " { get; set; } // placeholder\n    // ITenantRequest\n    public Guid OrganizationId"
  t=t.replace(/ \{ get; set; \} \/\/ placeholder\n    \/\/ ITenantRequest\n    public Guid OrganizationId/g,' { get; set; }\n    public Guid OrganizationId');
  // Remove duplicate comma
  t=t.replace(/, ITenantRequest, ITenantRequest/g,', ITenantRequest');
  fs.writeFileSync(p,t,'utf8');
  console.log('clean '+file);
}
// Also fix CrearDocumento header
let p2=base+'/LegalProBackend_Net/LegalPro.Application/Documentos/Commands/CrearDocumentoCommand.cs';
let t2=fs.readFileSync(p2,'utf8');
console.log(t2.slice(0,600));
// Inspect other files for duplicate prop
for(const f of Object.keys(fixes)){
  const p=base+'/'+f;
  const t=fs.readFileSync(p,'utf8');
  if(t.includes('OrganizationId') && t.includes('ITenantRequest')){
    const cnt=(t.match(/OrganizationId/g)||[]).length;
    console.log(f+' cnt '+cnt);
  }
}
