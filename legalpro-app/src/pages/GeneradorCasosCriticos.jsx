import { useState } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import casosCriticosFondo from '../assets/backgrounds/casos_criticos_fondo.jpeg';
import { api } from '../api/client';

export default function GeneradorCasosCriticos() {
  const [situacion, setSituacion] = useState('');
  const [escenarios, setEscenarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerar = async () => {
    if (!situacion.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.consulta?.(situacion, 'casos-criticos');
      const res = data?.resultado;
      if (Array.isArray(res)) {
        setEscenarios(res);
      } else if (res) {
        setEscenarios([{ titulo: 'Escenario crítico', riesgo: 'Alto', desc: typeof res === 'string' ? res : JSON.stringify(res), icon: 'dangerous', color: 'badge-danger' }]);
      }
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter">
      {/* ─── FULL SCREEN BACKGROUND ─── */}
      <div className="fixed inset-0 z-[-1] pointer-events-none">
        <img src={casosCriticosFondo} alt="Fondo" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-b from-[#0f131a]/80 via-[#0f131a]/95 to-[#0f131a]"></div>
      </div>

      <Header title="Casos Críticos" subtitle="Generador de Escenarios" showBack rightAction={<span className="badge badge-danger">IA</span>} />
      
      <div className="px-4 py-6 space-y-6">
        {/* Intro */}
        <div className="text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-[0_8px_32px_rgba(249,115,22,0.4)] mx-auto mb-4 border border-white/20">
            <AppIcon name="dangerous" size={32} className="icon-raw" style={{ filter: 'brightness(0) invert(1)' }} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Escenarios Críticos</h2>
          <p className="text-sm text-slate-400 leading-relaxed">Anticipa los peores escenarios posibles en tus expedientes y prepara planes de contingencia estratégicos apoyados por IA.</p>
        </div>

        {/* Input */}
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Situación Procesal</span>
            <textarea
              className="input min-h-[80px] resize-none"
              placeholder="Describe la situación procesal para identificar escenarios críticos..."
              value={situacion}
              onChange={e => setSituacion(e.target.value)}
            />
          </label>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            className="btn btn-primary w-full"
            onClick={handleGenerar}
            disabled={loading || !situacion.trim()}
          >
            <AppIcon name="auto_awesome" size={20} />
            {loading ? ' Analizando...' : ' Generar Escenarios'}
          </button>
        </div>

        {/* Scenarios List */}
        {escenarios.length > 0 && (
          <div className="space-y-3 pt-2">
            {escenarios.map((c, i) => (
              <div key={i} className="glass p-4 rounded-xl border border-white/5 shadow-lg relative overflow-hidden anim-fade-in-up group" style={{ animationDelay: `${i * 0.1}s`, opacity: 0 }}>
                {c.riesgo === 'Alto' && <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl -z-10 group-hover:bg-red-500/20 transition-colors"></div>}
                
                <div className="flex items-start gap-3 mb-3">
                  <div className={`mt-0.5 ${c.riesgo === 'Alto' ? 'text-red-400' : 'text-amber-400'}`}>
                     <AppIcon name={c.icon || 'warning'} size={22} className="icon-raw" style={{ filter: 'brightness(0) saturate(100%) invert(56%) sepia(97%) saturate(2000%) hue-rotate(220deg) brightness(100%)' }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">{c.titulo}</span>
                      <span className={`badge ${c.color || 'badge-warning'}`}>{c.riesgo}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{c.desc}</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex gap-2">
                  <button className="flex-1 py-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5">
                    <AppIcon name="auto_awesome" size={16} className="icon-indigo" /> 
                    Plan Contingencia
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {escenarios.length === 0 && !loading && (
          <div className="text-center py-8 text-slate-400">
            <AppIcon name="dangerous" size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Describe la situación procesal para identificar escenarios críticos.</p>
          </div>
        )}
      </div>
    </div>
  );
}
