import { useState, useEffect } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import IADisclaimerBanner from '../components/IADisclaimerBanner';
import { api } from '../api/client';
import { generateLegalPDF } from '../utils/documents';
import { getProviderLabel } from '../lib/iaProviders.js';

export default function ResumenEjecutivo() {
  const [expediente, setExpediente] = useState(null);
  const [analisis, setAnalisis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    // Cargar expediente y generar resumen ejecutivo con IA.
    // Migrado a Node POST /api/ai/consulta tipo 'analisis' (FIX @auditor-performance):
    // el .NET /api/analista/analizar usa contrato CQRS incompatible → 400.
    // Node devuelve `resultado` con { resumenGeneral, hechosClave[], inconsistencias[],
    // riesgosProcesales[], estrategiaRecomendada }.
    const cargar = async () => {
      try {
        const exp = await api.getExpediente?.();
        if (exp) {
          setExpediente(exp);
          setLoading(true);
          const prompt = `Genera un resumen ejecutivo del siguiente expediente legal peruano para un cliente o socio del estudio de abogados:

Expediente: ${exp.numero || 'Sin número'}
Título: ${exp.titulo || ''}
Tipo: ${exp.tipo || ''}
Estado: ${exp.estado || ''}
Materia: ${exp.materia || ''}

Identifica: hechos relevantes, puntos débiles o riesgos procesales del caso, y recomendaciones de acción.`;
          const res = await api.consulta?.(prompt, 'analisis');
          setAnalisis(res?.resultado ?? null);
        }
      } catch {
        // Sin expediente seleccionado: estado vacío
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  if (!expediente && !loading) {
    return (
      <div className="page-enter">
        <Header title="Resumen Ejecutivo AI" showBack rightAction={<span className="badge badge-success">{getProviderLabel('opencode')}</span>} />
        <div className="px-4 py-12 text-center text-slate-400">
          <AppIcon name="summarize" size={40} className="mx-auto mb-4 opacity-50" />
          <p className="text-sm">Selecciona un expediente para generar un resumen ejecutivo con IA.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <Header title="Resumen Ejecutivo AI" showBack rightAction={<span className="badge badge-success">DeepSeek V4 Flash</span>} />
      <div className="px-4 py-6 space-y-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><AppIcon name="summarize" size={20} /></div>
            <div>
              <p className="font-bold">{expediente?.numero ?? 'Sin número'}</p>
              <p className="text-xs text-slate-400">{expediente?.materia ?? ''}</p>
            </div>
          </div>
        </div>

        <div className="card bg-primary/5 border-primary/20 p-5 space-y-4">
          <IADisclaimerBanner compact className="mb-2" />
          <h3 className="text-sm font-bold flex items-center gap-2"><AppIcon name="auto_awesome" size={20} /> Resumen Generado por IA</h3>
          {loading ? (
            <p className="text-xs text-slate-400">Generando resumen...</p>
          ) : analisis ? (
            <>
              {analisis.resumenGeneral && (
                <div>
                  <h4 className="text-xs font-bold text-primary uppercase mb-1">Resumen General</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{analisis.resumenGeneral}</p>
                </div>
              )}
              <div>
                <h4 className="text-xs font-bold text-primary uppercase mb-1">Hechos Relevantes</h4>
                {Array.isArray(analisis.hechosClave) && analisis.hechosClave.length > 0 ? (
                  <ul className="text-xs text-slate-400 leading-relaxed space-y-1 list-disc pl-4">
                    {analisis.hechosClave.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 leading-relaxed">Sin datos.</p>
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-400 uppercase mb-1">Puntos Débiles / Riesgos</h4>
                {Array.isArray(analisis.inconsistencias) && analisis.inconsistencias.length > 0 ? (
                  <ul className="text-xs text-slate-400 leading-relaxed space-y-1 list-disc pl-4">
                    {analisis.inconsistencias.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                ) : Array.isArray(analisis.riesgosProcesales) && analisis.riesgosProcesales.length > 0 ? (
                  <ul className="text-xs text-slate-400 leading-relaxed space-y-1 list-disc pl-4">
                    {analisis.riesgosProcesales.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 leading-relaxed">Sin datos.</p>
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-400 uppercase mb-1">Recomendaciones</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{analisis.estrategiaRecomendada ?? 'Sin datos.'}</p>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400">No hay análisis disponible.</p>
          )}
        </div>

        {exportError && <p className="text-red-400 text-xs">{exportError}</p>}
        <div className="flex gap-2">
          <button 
            className="btn btn-secondary flex-1 text-xs"
            onClick={async () => {
              if (!analisis) return;
              setExportLoading(true);
              setExportError('');
              try {
                const today = new Date().toISOString().split('T')[0];
                const num = expediente?.numero?.replace(/[^a-zA-Z0-9_-]/g, '') || 'SIN_NUM';
                const hechosClave = Array.isArray(analisis.hechosClave) ? analisis.hechosClave.join('\n') : (analisis.hechosClave || 'Sin datos.');
                const inconsistencias = Array.isArray(analisis.inconsistencias) ? analisis.inconsistencias.join('\n') : (analisis.inconsistencias || 'Sin datos.');
                const content = [
                  'RESUMEN GENERAL',
                  analisis.resumenGeneral || 'Sin datos.',
                  '',
                  'HECHOS RELEVANTES',
                  hechosClave,
                  '',
                  'PUNTOS DÉBILES / RIESGOS',
                  inconsistencias,
                  '',
                  'RECOMENDACIONES',
                  analisis.estrategiaRecomendada || 'Sin datos.'
                ].join('\n');
                await generateLegalPDF({
                  title: 'Resumen Ejecutivo',
                  content,
                  metadata: { expediente: expediente?.numero, caso: expediente?.materia },
                  filename: `Resumen_${num}_${today}.pdf`
                });
              } catch {
                setExportError('Error al generar el PDF. Intenta de nuevo.');
              } finally {
                setExportLoading(false);
              }
            }}
            disabled={exportLoading || !analisis}
          >
            <AppIcon name="picture_as_pdf" size={20} /> {exportLoading ? 'Generando...' : 'Exportar PDF'}
          </button>
          <button className="btn btn-primary flex-1 text-xs"><AppIcon name="share" size={20} /> Compartir</button>
        </div>
      </div>
    </div>
  );
}
