import fs from 'fs';
const base = 'C:/Users/Pc/Desktop/Abogacia';
const files = [
  { file: 'LegalProBackend_Net/LegalPro.Application/Documentos/Commands/CrearDocumentoCommand.cs', type: 'class', className: 'CrearDocumentoCommand', iface: 'IRequest<DocumentoCreadoDto>', propAfter: 'public Guid ExpedienteId' },
  { file: 'LegalProBackend_Net/LegalPro.Application/Simulacion/Commands/IniciarSimulacionCommand.cs', type: 'class', className: 'IniciarSimulacionCommand', iface: 'IRequest<IniciarSimulacionResult>', propAfter: 'public string DescripcionCaso' },
  { file: 'LegalProBackend_Net/LegalPro.Application/Redactor/Commands/GenerarBorradorCommand.cs', type: 'record3', iface: 'IRequest<BorradorResult>' },
  { file: 'LegalProBackend_Net/LegalPro.Application/Analisis/Commands/AnalizarExpedienteCommand.cs', type: 'record1', iface: 'IRequest<AnalizarExpedienteResult>' },
  { file: 'LegalProBackend_Net/LegalPro.Application/Documentos/Queries/GetDocumentosByExpedienteQuery.cs', type: 'class', className: 'GetDocumentosByExpedienteQuery', iface: 'IRequest<IReadOnlyList<DocumentoDto>>', propAfter: 'public Guid ExpedienteId' },
  { file: 'LegalProBackend_Net/LegalPro.Application/Simulacion/Queries/GetSimulacionesQuery.cs', type: 'class', className: 'GetSimulacionesQuery', iface: 'IRequest<GetSimulacionesResult>', propAfter: 'public int Limit' },
  { file: 'LegalProBackend_Net/LegalPro.Application/Simulacion/Queries/GetSimulacionBoardQuery.cs', type: 'class', className: 'GetSimulacionBoardQuery' },
  { file: 'LegalProBackend_Net/LegalPro.Application/Chat/Queries/GetSesionesChatQuery.cs', type: 'class', className: 'GetSesionesChatQuery' },
  { file: 'LegalProBackend_Net/LegalPro.Application/Expedientes/Queries/GenerarResumenCasoQuery.cs', type: 'class', className: 'GenerarResumenCasoQuery' },
  { file: 'LegalProBackend_Net/LegalPro.Application/Expedientes/Queries/GetExpedientesStatsQuery.cs', type: 'recordStats' },
  { file: 'LegalProBackend_Net/LegalPro.Application/Fiscal/Commands/GenerarRequerimientoFiscalCommand.cs', type: 'class', className: 'GenerarRequerimientoFiscalCommand' },
  { file: 'LegalProBackend_Net/LegalPro.Application/Juez/Commands/GenerarResolucionJudicialCommand.cs', type: 'class', className: 'GenerarResolucionJudicialCommand' },
  { file: 'LegalProBackend_Net/LegalPro.Application/Interrogatorio/Commands/GenerarInterrogatorioCommand.cs', type: 'class', className: 'GenerarInterrogatorioCommand' },
  { file: 'LegalProBackend_Net/LegalPro.Application/Notificaciones/Queries/GetNotificacionesQuery.cs', type: 'class', className: 'GetNotificacionesQuery' },
  { file: 'LegalProBackend_Net/LegalPro.Application/Alegato/Commands/GenerarAlegatoCommand.cs', type: 'recordAlegato' },
];

for (const e of files) {
  const p = base + '/' + e.file;
  let t = fs.readFileSync(p, 'utf8');
  if (t.includes('ITenantRequest')) { console.log('skip ' + e.file); continue; }
  if (!t.includes('LegalPro.Application.Common.Behaviours')) {
    t = t.replace('using MediatR;', 'using MediatR;\nusing LegalPro.Application.Common.Behaviours;');
    if (!t.includes('using LegalPro.Application.Common.Behaviours')) t = 'using LegalPro.Application.Common.Behaviours;\n' + t;
  }
  if (e.type === 'class') {
    // add interface
    const re = new RegExp(`(public\\s+class\\s+${e.className}[^\\n]*?:\\s*IRequest[^\\n]*)(\\n)`);
    // fallback simpler
    let replaced = false;
    t = t.replace(/:\s*IRequest[^\n{]*/, (m) => {
      if (!replaced && m.includes('IRequest')) { replaced = true; return m + ', ITenantRequest'; }
      return m;
    });
    // If not replaced (record case), do generic
    if (!t.includes(', ITenantRequest')) {
      t = t.replace(': IRequest', ': IRequest');
      // manually find first IRequest
      const idx = t.indexOf('IRequest');
      if (idx !== -1) {
        const end = t.indexOf('\n', idx);
        const line = t.substring(idx, end);
        // find closing > or without
      }
    }
    if (!t.includes('public Guid OrganizationId')) {
      if (e.propAfter) {
        t = t.replace(e.propAfter, e.propAfter + ' { get; set; } // placeholder\n    // ITenantRequest\n    public Guid OrganizationId { get; set; }');
        // the above double, clean: we added set to original prop, need fix
        // Actually propAfter is like 'public Guid ExpedienteId' -> we want to insert new prop after that line
        // Simpler: replace the line with itself plus new line
      } else {
        // find first { after class declaration
        t = t.replace(/(public\s+class\s+[^\n]*ITenantRequest[^\n]*\n\{)/, `$1\n    public Guid OrganizationId { get; set; }`);
      }
    }
  } else if (e.type === 'record1') {
    t = t.replace('public record AnalizarExpedienteCommand(string TextoExpediente) : IRequest<AnalizarExpedienteResult>;', 'public record AnalizarExpedienteCommand(string TextoExpediente) : IRequest<AnalizarExpedienteResult>, ITenantRequest\n{\n    public Guid OrganizationId => Guid.Empty;\n}');
  } else if (e.type === 'record3') {
    // GenerarBorradorCommand is record with 3 params multi-line
    t = t.replace(') : IRequest<BorradorResult>;', ') : IRequest<BorradorResult>, ITenantRequest\n{\n    public Guid OrganizationId => Guid.Empty;\n}');
  } else if (e.type === 'recordStats') {
    t = t.replace('public record GetExpedientesStatsQuery : IRequest<ExpedientesStatsDto>;', 'public record GetExpedientesStatsQuery : IRequest<ExpedientesStatsDto>, ITenantRequest\n{\n    public Guid OrganizationId => Guid.Empty;\n}');
  } else if (e.type === 'recordAlegato') {
    t = t.replace(') : IRequest<AlegatoDto>;', ') : IRequest<AlegatoDto>, ITenantRequest\n{\n    public Guid OrganizationId => Guid.Empty;\n}');
  } else {
    // generic class fallback
    t = t.replace(/:\s*IRequest[^\n{]*/, (m) => m + ', ITenantRequest');
    if (!t.includes('public Guid OrganizationId')) {
      t = t.replace(/(public\s+class[^\n]*ITenantRequest[^\n]*\n\{)/, `$1\n    public Guid OrganizationId { get; set; }`);
    }
  }
  fs.writeFileSync(p, t, 'utf8');
  console.log('ok ' + e.file);
}
console.log('done');
