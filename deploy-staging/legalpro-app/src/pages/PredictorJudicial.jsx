import { useState, useEffect } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import IADisclaimerBanner from '../components/IADisclaimerBanner';
import { api } from '../api/client';

export default function PredictorJudicial() {
  useEffect(() => {
    document.title = 'Predictor Judicial IA | LegalPro';
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', 'Utiliza inteligencia artificial para predecir probabilidades de éxito, evaluar riesgos procesales y analizar factores favorables y desfavorables de tus casos legales.');
  }, []);

  const [hechos, setHechos] = useState('');
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePredecir = async () => {
    if (!hechos.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.consulta(hechos, 'predictor');
      setResultado(data.resultado);
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const probabilidad = resultado?.probabilidadExito ?? 0;
  const dashOffset = (339.29 * (1 - probabilidad / 100)).toFixed(0);

  return (
    <div className="page-enter">
      <Header title="Predictor Judicial" showBack rightAction={<span className="badge badge-primary">IA Predictiva</span>} />

      <div className="px-4 py-6 space-y-6">
        {/* Input de hechos */}
        <label className="block">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Hechos del Caso</span>
          <textarea
            className="input min-h-[100px] resize-none"
            placeholder="Describe los hechos del caso para predecir el resultado judicial..."
            value={hechos}
            onChange={e => setHechos(e.target.value)}
          />
        </label>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          className="btn btn-primary w-full"
          onClick={handlePredecir}
          disabled={loading || !hechos.trim()}
        >
          <AppIcon name="psychology" size={20} />
          {loading ? ' Analizando con Gemini...' : ' Predecir Resultado'}
        </button>

        {resultado && (
          <>
            <IADisclaimerBanner className="mb-4" compact />
            <div className="card text-center">
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Probabilidad de Éxito</p>
              <div className="relative w-32 h-32 mx-auto mb-4">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" stroke="currentColor" strokeWidth="8" fill="none" className="text-border-dark" />
                  <circle cx="60" cy="60" r="54" stroke="url(#gradient)" strokeWidth="8" fill="none" strokeDasharray="339.29" strokeDashoffset={dashOffset} strokeLinecap="round" />
                  <defs><linearGradient id="gradient"><stop stopColor="#135bec" /><stop offset="1" stopColor="#10b981" /></linearGradient></defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold gradient-text">{probabilidad}%</span>
                </div>
              </div>
              {resultado.veredictoGeneral && (
                <p className="text-sm font-semibold text-emerald-400">{resultado.veredictoGeneral}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">Basado en precedentes similares</p>
            </div>

            {/* Factores */}
            <div className="space-y-4">
              {resultado.factoresFavorables?.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">Factores Favorables</h3>
                  <ul className="space-y-2">
                    {resultado.factoresFavorables.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <span className="text-emerald-500 shrink-0"><AppIcon name="check_circle" size={16} /></span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {resultado.factoresDesfavorables?.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">Factores Desfavorables</h3>
                  <ul className="space-y-2">
                    {resultado.factoresDesfavorables.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <span className="text-red-400 shrink-0"><AppIcon name="warning" size={16} /></span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Recomendación */}
            {resultado.recomendacion && (
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AppIcon name="psychology" size={20} />
                  <span className="text-sm font-bold text-primary">Recomendación Gemini</span>
                </div>
                <IADisclaimerBanner compact className="mb-2" />
                <p className="text-xs text-slate-400 leading-relaxed">{resultado.recomendacion}</p>
              </div>
            )}
          </>
        )}

        {!resultado && !loading && (
          <div className="card text-center py-8">
            <AppIcon name="psychology" size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm text-slate-400">Ingresa los hechos del caso para obtener un análisis predictivo.</p>
          </div>
        )}
      </div>
    </div>
  );
}
