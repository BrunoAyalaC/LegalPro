import { useState, useEffect } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import IADisclaimerBanner from '../components/IADisclaimerBanner';
import { api } from '../api/client';

export default function ResumenEjecutivo() {
  const [expediente, setExpediente] = useState(null);
  const [analisis, setAnalisis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Ejemplo: cargar expediente seleccionado
    const cargar = async () => {
      try {
        const exp = await api.getExpediente?.();
        if (exp) {
          setExpediente(exp);
          setLoading(true);
          const res = await api.analizar?.(exp.id);
          setAnalisis(res);
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
        <Header title="Resumen Ejecutivo AI" showBack rightAction={<span className="badge badge-success">Gemini</span>} />
        <div className="px-4 py-12 text-center text-slate-400">
          <AppIcon name="summarize" size={40} className="mx-auto mb-4 opacity-50" />
          <p className="text-sm">Selecciona un expediente para generar un resumen ejecutivo con IA.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <Header title="Resumen Ejecutivo AI" showBack rightAction={<span className="badge badge-success">Gemini</span>} />
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
              <div>
                <h4 className="text-xs font-bold text-primary uppercase mb-1">Hechos Relevantes</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{analisis.hechosRelevantes ?? 'Sin datos.'}</p>
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-400 uppercase mb-1">Puntos Débiles</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{analisis.puntosDebiles ?? 'Sin datos.'}</p>
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-400 uppercase mb-1">Recomendaciones</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{analisis.recomendaciones ?? 'Sin datos.'}</p>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400">No hay análisis disponible.</p>
          )}
        </div>

        <div className="flex gap-2">
          <button className="btn btn-secondary flex-1 text-xs"><AppIcon name="picture_as_pdf" size={20} /> Exportar PDF</button>
          <button className="btn btn-primary flex-1 text-xs"><AppIcon name="share" size={20} /> Compartir</button>
        </div>
      </div>
    </div>
  );
}
