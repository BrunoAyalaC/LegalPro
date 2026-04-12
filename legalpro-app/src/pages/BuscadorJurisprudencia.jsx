import { useState } from 'react';
import AppIcon from '../components/AppIcon';
import Header from '../components/Header';
import EmptyState from '../components/EmptyState';
import sinResultadosImg from '../assets/empty-states/sin_resultados.png';
import { api } from '../api/client';

export default function BuscadorJurisprudencia() {
  const [buscar, setBuscar] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState(null);
  const [error, setError] = useState('');

  const handleBuscar = async () => {
    if (!buscar.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.consulta(buscar, 'jurisprudencia');
      setResultados(data.resultado);
    } catch {
      setError('Error al conectar con el servidor');
      setResultados(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = e => { if (e.key === 'Enter') handleBuscar(); };

  const resultadosArray = Array.isArray(resultados) ? resultados : null;
  const resultadoTexto = typeof resultados === 'string' ? resultados : null;

  return (
    <div className="page-enter">
      <Header title="Buscador Jurisprudencial" showBack rightAction={<AppIcon name="gavel" size={20} />} />

      <div className="px-4 py-3 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <AppIcon name="search" size={20} />
            <input
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input pl-10 shadow-sm"
              placeholder="Palabra clave o N° de expediente..."
            />
          </div>
          <button
            onClick={handleBuscar}
            disabled={loading || !buscar.trim()}
            className="btn btn-primary px-4 text-sm whitespace-nowrap"
          >
            {loading ? <AppIcon name="sync" size={20} /> : 'Buscar'}
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {['Año', 'Recurso', 'Sala', 'Ponente'].map((f, i) => (
            <button key={f} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border transition-colors ${i === 1 ? 'bg-primary/10 text-primary border-primary/20 font-semibold' : 'bg-surface-dark text-slate-400 border-border-dark'}`}>
              {f} <AppIcon name="expand_more" size={20} />
            </button>
          ))}
        </div>
      </div>

      {error && <p className="px-4 text-red-400 text-xs">{error}</p>}

      {/* Skeletons de carga */}
      {loading && (
        <main className="px-4 space-y-3 pb-28">
          {[1, 2, 3].map(i => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-surface-dark rounded w-1/3 mb-2" />
              <div className="h-5 bg-surface-dark rounded w-full mb-2" />
              <div className="h-3 bg-surface-dark rounded w-1/2 mb-4" />
              <div className="h-8 bg-surface-dark rounded" />
            </div>
          ))}
        </main>
      )}

      {/* Sin resultados */}
      {!loading && resultados !== null && !resultadosArray && !resultadoTexto && (
        <EmptyState
          image={sinResultadosImg}
          title="Sin resultados"
          description={`No se encontraron resultados para "${buscar}". Intenta con otros términos.`}
        />
      )}

      {/* Resultados como array */}
      {!loading && resultadosArray && resultadosArray.length > 0 && (
        <main className="px-4 space-y-3 pb-28">
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">Resultados ({resultadosArray.length})</span>
            <button className="text-xs font-medium text-primary flex items-center gap-1"><AppIcon name="tune" size={20} /> Ordenar</button>
          </div>
          {resultadosArray.map((r, i) => (
            <article key={i} className="card hover:border-primary/50 anim-fade-in-up" style={{ animationDelay: `${i * 0.08}s`, opacity: 0 }}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-primary text-white rounded uppercase tracking-widest">{r.tipo || 'Jurisprudencia'}</span>
                <span className="text-xs text-slate-500 font-medium">{r.numero || ''}</span>
              </div>
              <h3 className="font-bold text-base leading-tight mb-2">{r.titulo || r}</h3>
              <div className="grid grid-cols-2 gap-y-2 mb-4 text-[11px] text-slate-400 uppercase tracking-tighter">
                {r.fecha && <div className="flex items-center gap-1"><AppIcon name="calendar_today" size={20} /> {r.fecha}</div>}
                {r.sala && <div className="flex items-center gap-1"><AppIcon name="balance" size={20} /> {r.sala}</div>}
              </div>
              <div className="flex gap-2">
                <button className="flex-1 py-2 bg-primary text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors">
                  <AppIcon name="auto_awesome" size={20} /> Resumen IA
                </button>
                <button className="p-2 bg-surface-dark rounded-lg text-slate-400 border border-border-dark">
                  <AppIcon name="bookmark" size={20} />
                </button>
              </div>
            </article>
          ))}
        </main>
      )}

      {/* Resultado como texto libre */}
      {!loading && resultadoTexto && (
        <main className="px-4 space-y-3 pb-28 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">Resultados</span>
          </div>
          <article className="card hover:border-primary/50">
            <div className="flex items-center gap-2 mb-3">
              <AppIcon name="auto_awesome" size={20} />
              <span className="text-xs font-bold text-primary">Análisis Gemini</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{resultadoTexto}</p>
          </article>
        </main>
      )}

      {/* Estado inicial */}
      {!loading && resultados === null && (
        <EmptyState
          image={sinResultadosImg}
          title="Busca jurisprudencia"
          description="Ingresa una palabra clave o número de expediente para buscar."
        />
      )}
    </div>
  );
}
