import { useState, useEffect } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import { api } from '../api/client';
import { generateLegalPDF } from '../utils/documents';

export default function ReporteRetroalimentacion() {
  const [reporte, setReporte] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true);
        const data = await api.getReporte?.();
        if (data) setReporte(data);
      } catch {
        // Sin reporte: estado vacío
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  if (!reporte && !loading) {
    return (
      <div className="page-enter">
        <Header title="Retroalimentación IA" showBack />
        <div className="px-4 py-12 text-center text-slate-400">
          <AppIcon name="rate_review" size={40} className="mx-auto mb-4 opacity-50" />
          <p className="text-sm">Los reportes de retroalimentación aparecerán después de que uses las herramientas de IA.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <Header title="Retroalimentación IA" showBack />
      <div className="px-4 py-6 space-y-6">
        <div className="card text-center p-6">
          <AppIcon name="rate_review" size={20} />
          <h2 className="text-lg font-bold">Tu Desempeño Legal</h2>
          <p className="text-xs text-slate-400 mt-1">Análisis basado en tus consultas</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">{reporte?.precision ?? '-'}%</p>
            <p className="text-[10px] text-slate-400 uppercase">Precisión Legal</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-primary">{reporte?.consultasMes ?? '-'}</p>
            <p className="text-[10px] text-slate-400 uppercase">Consultas/Mes</p>
          </div>
        </div>

        {exportError && <p className="text-red-400 text-xs">{exportError}</p>}
        <button
          className="btn btn-secondary w-full text-xs"
          onClick={async () => {
            setExportLoading(true);
            setExportError('');
            try {
              const today = new Date().toISOString().split('T')[0];
              const areasText = (reporte?.areasMejora || []).map(a => `- ${a.area}: ${a.score}%\n  Tip: ${a.tip}`).join('\n\n');
              const content = [
                `Precisión Legal: ${reporte?.precision ?? '-'}%`,
                `Consultas este mes: ${reporte?.consultasMes ?? '-'}`,
                '',
                'ÁREAS DE MEJORA',
                areasText || 'Sin áreas registradas.'
              ].join('\n');
              await generateLegalPDF({
                title: 'Reporte de Retroalimentación LegalPro',
                content,
                filename: `Reporte_Desempeno_${today}.pdf`
              });
            } catch {
              setExportError('Error al generar el PDF. Intenta de nuevo.');
            } finally {
              setExportLoading(false);
            }
          }}
          disabled={exportLoading}
        >
          <AppIcon name="picture_as_pdf" size={20} /> {exportLoading ? 'Generando...' : 'Exportar PDF'}
        </button>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Áreas de Mejora</h3>
          {(reporte?.areasMejora ?? []).map((m, i) => (
            <div key={i} className="card anim-fade-in-up" style={{ animationDelay: `${i * 0.1}s`, opacity: 0 }}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-sm">{m.area}</span>
                <span className="font-bold text-sm">{m.score}%</span>
              </div>
              <div className="w-full h-1.5 bg-surface-dark rounded-full overflow-hidden mb-2">
                <div className="h-full bg-primary rounded-full" style={{ width: `${m.score}%` }}></div>
              </div>
              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                <AppIcon name="lightbulb" size={20} /> {m.tip}
              </p>
            </div>
          ))}
          {(reporte?.areasMejora ?? []).length === 0 && (
            <p className="text-xs text-slate-500">No hay áreas de mejora registradas aún.</p>
          )}
        </div>
      </div>
    </div>
  );
}
