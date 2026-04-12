import { useState } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import { api } from '../api/client';

export default function PredictorJudicial() {
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

  const probabilidad = resultado?.probabilidadExito ?? 72;
  const dashOffset = (339.29 * (1 - probabilidad / 100)).toFixed(0);

  const factoresDefault = [
    { label: 'Precedentes Favorables', valor: 72, color: 'bg-emerald-500' },
    { label: 'Solidez Probatoria', valor: 65, color: 'bg-primary' },
    { label: 'Riesgo de Nulidad', valor: 18, color: 'bg-red-500' },
    { label: 'Consistencia Argumentativa', valor: 88, color: 'bg-amber-500' },
  ];

  return (
    <div className="page-enter">
      <Header title="Predictor Judicial" showBack rightAction={<span className="badge badge-primary">IA Predictiva</span>} />

      <div className="px-4 py-6 space-y-6">
        {/* Case Info */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><AppIcon name="gavel" size={20} /></div>
            <div>
              <p className="font-bold text-sm">Exp. 04532-2023-JR-PE</p>
              <p className="text-xs text-slate-400">Colusión Agravada</p>
            </div>
          </div>
          <div className="flex gap-2"><span className="badge badge-warning">Penal</span><span className="badge badge-danger">Urgente</span></div>
        </div>

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

        {/* Prediction Score */}
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
          <p className="text-sm font-semibold text-emerald-400">{resultado?.veredictoGeneral ?? 'Favorable con reservas'}</p>
          <p className="text-xs text-slate-400 mt-1">Basado en precedentes similares</p>
        </div>

        {/* Factores */}
        {resultado ? (
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
        ) : (
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Factores de Análisis</h3>
            {factoresDefault.map((f, i) => (
              <div key={i} className="anim-fade-in-up" style={{ animationDelay: `${i * 0.1}s`, opacity: 0 }}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium">{f.label}</span>
                  <span className="font-bold">{f.valor}%</span>
                </div>
                <div className="w-full h-2 bg-surface-dark rounded-full overflow-hidden">
                  <div className={`h-full ${f.color} rounded-full transition-all duration-1000`} style={{ width: `${f.valor}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Gemini Recommendation */}
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AppIcon name="psychology" size={20} />
            <span className="text-sm font-bold text-primary">Recomendación Gemini</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {resultado?.recomendacion ?? 'El caso tiene precedentes favorables en la Sala Penal Permanente (Casación 0432-2023). Se recomienda fortalecer la evidencia documental y preparar una estrategia sólida para la audiencia. Riesgo principal: posible nulidad en la cadena de custodia de pruebas digitales.'}
          </p>
        </div>
      </div>
    </div>
  );
}
