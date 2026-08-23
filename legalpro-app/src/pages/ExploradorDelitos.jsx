// Explorador de Delitos — búsqueda en catálogos determinísticos (sin IA)
// Endpoint: GET /api/herramientas/delitos?q= (Node)
// Contrato: { success, data: [{ fuente, articulo, nombre, pena, prescripcion }], total }
import { useEffect, useRef, useState } from 'react';
import { Search, Gavel, AlertTriangle, BookOpen, Loader2, Info } from 'lucide-react';
import { nodeClient } from '../api/client';

const FUENTE_LABEL = {
  'tipos-penales': 'Tipos Penales',
  'delitos-economicos': 'Delitos Económicos',
};

export default function ExploradorDelitos() {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  async function buscar(termino) {
    // Cancela la búsqueda anterior si sigue en vuelo (evita respuestas desordenadas)
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCargando(true);
    setError('');
    try {
      const { data } = await nodeClient.get('/api/herramientas/delitos', {
        params: { q: termino },
        signal: controller.signal,
      });
      if (!data?.success) throw new Error(data?.error || 'Respuesta inválida del servidor.');
      setResultados(Array.isArray(data.data) ? data.data : []);
      setTotal(data.total ?? 0);
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return; // petición reemplazada
      setError(err?.response?.data?.error || err?.message || 'Error al buscar delitos.');
      setResultados([]);
      setTotal(0);
    } finally {
      if (abortRef.current === controller) setCargando(false);
    }
  }

  // Carga inicial: sin q el backend devuelve los primeros 10 de cada catálogo
  useEffect(() => {
    buscar('');
    return () => abortRef.current?.abort();
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    buscar(q.trim());
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-600/10 border border-red-500/20">
            <Gavel className="w-7 h-7 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Explorador de Delitos</h1>
            <p className="text-slate-400 text-sm">Catálogo de tipos penales y delitos económicos — CP y leyes especiales</p>
          </div>
        </div>

        {/* Disclaimer permanente — Ley 29571 (consumidor) / herramienta referencial */}
        <div
          role="note"
          aria-label="Aviso: herramienta referencial"
          className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-[11px] text-amber-200/90 flex gap-2 mb-4"
        >
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>
            Herramienta referencial. Los cálculos no constituyen asesoría legal. Verifique fuentes oficiales
            (SPIJ, BCRP, El Peruano) antes de usar profesionalmente.
          </span>
        </div>

        {/* Búsqueda */}
        <form onSubmit={handleSubmit} role="search" className="mb-6">
          <label htmlFor="ed-q" className="sr-only">
            Buscar delito por nombre o artículo
          </label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" aria-hidden="true" />
            <input
              id="ed-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o artículo… Ej.: lavado, hurto, coima"
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-12 pr-28 py-3.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/50"
            />
            <button
              type="submit"
              disabled={cargando}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-400 hover:to-orange-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cargando ? 'Buscando…' : 'Buscar'}
            </button>
          </div>
        </form>

        {/* Estados */}
        {error && (
          <div
            role="alert"
            className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {cargando ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500" role="status" aria-live="polite">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm">Buscando delitos…</p>
          </div>
        ) : (
          <>
            {!error && (
              <p className="text-xs text-slate-500 mb-4" aria-live="polite">
                {total} resultado{total === 1 ? '' : 's'}
                {q.trim() ? ` para "${q.trim()}"` : ' — catálogos iniciales'}
              </p>
            )}

            {resultados.length === 0 ? (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                <BookOpen className="w-12 h-12 text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-400 mb-2">Sin resultados</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  No se encontraron delitos que coincidan con la búsqueda. Intente con otro término o artículo del
                  Código Penal.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resultados.map((d, i) => (
                  <article
                    key={`${d.articulo ?? 'sin-art'}-${i}`}
                    className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 hover:border-slate-600/60 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      {d.articulo ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400 whitespace-nowrap">
                          {d.articulo}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-700/50 text-slate-400 uppercase tracking-wide whitespace-nowrap">
                        {FUENTE_LABEL[d.fuente] ?? d.fuente}
                      </span>
                    </div>

                    <h2 className="font-bold text-white leading-tight mb-3">{d.nombre}</h2>

                    <dl className="space-y-1.5 text-sm">
                      {d.pena && (
                        <div className="flex gap-2">
                          <dt className="text-slate-500 flex-shrink-0">Pena:</dt>
                          <dd className="text-slate-300">{d.pena}</dd>
                        </div>
                      )}
                      {d.prescripcion && (
                        <div className="flex gap-2">
                          <dt className="text-slate-500 flex-shrink-0">Prescripción:</dt>
                          <dd className="text-slate-300">{d.prescripcion}</dd>
                        </div>
                      )}
                    </dl>
                  </article>
                ))}
              </div>
            )}

            {/* Disclaimer referencial */}
            <div className="mt-6 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
              <span>
                Información <strong className="text-slate-300">referencial</strong> extraída de catálogos internos.
                La prescripción mostrada es una estimación según CP Art. 85 (pena máxima + mitad). Verifique siempre
                contra el texto oficial del Código Penal y leyes modificatorias vigentes.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
