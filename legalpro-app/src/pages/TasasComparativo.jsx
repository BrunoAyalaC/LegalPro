// Comparador de Tasas de Interés — herramienta determinística (sin IA)
// Endpoint: GET /api/herramientas/tasas-comparativo?monto=&dias=
// Contrato: → { success, data: [{ tipo, tasa_pct, interes, total }], nota }
//   tipos: 'moratorio_bcrp' | 'remunerativo' | 'legal_cc_1985a'
//   El flag `stale` de la tasa BCRP llega embebido en `nota` (fallback).
import { useState } from 'react';
import { Percent, AlertTriangle, Info, BarChart3, Landmark, TrendingUp, Scale } from 'lucide-react';
import { nodeClient } from '../api/client';

const fmtPEN = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 });

const TARJETAS = {
  moratorio_bcrp: {
    label: 'Moratoria BCRP',
    icon: Landmark,
    accentText: 'text-yellow-400',
    accentBg: 'bg-yellow-500/15',
    border: 'border-yellow-500/30',
  },
  remunerativo: {
    label: 'Remunerativa',
    icon: TrendingUp,
    accentText: 'text-emerald-400',
    accentBg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
  },
  legal_cc_1985a: {
    label: 'Legal CC Art. 1985-A',
    icon: Scale,
    accentText: 'text-sky-400',
    accentBg: 'bg-sky-500/15',
    border: 'border-sky-500/30',
  },
};

export default function TasasComparativo() {
  const [monto, setMonto] = useState('');
  const [dias, setDias] = useState('');
  const [resultados, setResultados] = useState(null);
  const [nota, setNota] = useState('');
  const [stale, setStale] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function handleComparar(e) {
    e.preventDefault();
    setError('');
    setResultados(null);
    setNota('');
    setStale(false);

    // Validación en cliente (el backend revalida con zod)
    const montoNum = Number(monto);
    const diasNum = Number(dias);
    if (!monto || Number.isNaN(montoNum) || montoNum <= 0) {
      setError('Ingrese un monto mayor a 0.');
      return;
    }
    if (!dias || Number.isNaN(diasNum) || !Number.isInteger(diasNum) || diasNum <= 0) {
      setError('Ingrese un número entero de días mayor a 0.');
      return;
    }

    setCargando(true);
    try {
      const { data } = await nodeClient.get('/api/herramientas/tasas-comparativo', {
        params: { monto: montoNum, dias: diasNum },
      });
      if (!data?.success || !Array.isArray(data?.data)) throw new Error(data?.error || 'Respuesta inválida del servidor.');
      setResultados(data.data);
      setNota(typeof data.nota === 'string' ? data.nota : '');
      // El backend marca el fallback BCRP dentro de `nota` ("(fallback, dato stale)");
      // también aceptamos un campo `stale` explícito por si el contrato evoluciona.
      setStale(Boolean(data.stale) || /stale/i.test(data.nota || ''));
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Error al comparar las tasas.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/10 border border-violet-500/20">
            <Percent className="w-7 h-7 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Comparador de Tasas</h1>
            <p className="text-slate-400 text-sm">Interés simple /360 — Moratoria BCRP · Remunerativa · Legal CC Art. 1985-A</p>
          </div>
        </div>

        {/* Formulario */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-400" />
            Datos de la Comparación
          </h2>

          {/* Disclaimer permanente — herramienta referencial */}
          <div
            role="note"
            aria-label="Aviso: herramienta referencial"
            className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-[11px] text-amber-200/90 flex gap-2 mb-5"
          >
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>
              Herramienta referencial. Los cálculos no constituyen asesoría legal. Verifique fuentes oficiales
              (SPIJ, BCRP, El Peruano) antes de usar profesionalmente.
            </span>
          </div>

          <form onSubmit={handleComparar} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-4 items-end">
            <div>
              <label htmlFor="tc-monto" className="block text-sm font-medium text-slate-300 mb-2">
                Monto (S/)
              </label>
              <input
                id="tc-monto"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="Ej.: 15000.00"
                className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50"
                required
              />
            </div>

            <div>
              <label htmlFor="tc-dias" className="block text-sm font-medium text-slate-300 mb-2">
                Días de atraso
              </label>
              <input
                id="tc-dias"
                type="number"
                min="1"
                max="3650"
                step="1"
                inputMode="numeric"
                value={dias}
                onChange={(e) => setDias(e.target.value)}
                placeholder="Ej.: 90"
                className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50"
                required
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full sm:w-auto px-8 py-2.5 rounded-xl font-medium transition-all bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {cargando ? (
                <>Comparando...</>
              ) : (
                <><BarChart3 className="w-4 h-4" /> Comparar Tasas</>
              )}
            </button>
          </form>

          {error && (
            <div
              role="alert"
              className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Resultado: 3 cards lado a lado */}
        {resultados ? (
          <div aria-live="polite">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {resultados.map((r) => {
                const cfg = TARJETAS[r.tipo] || {
                  label: r.tipo,
                  icon: Percent,
                  accentText: 'text-slate-300',
                  accentBg: 'bg-slate-500/15',
                  border: 'border-slate-500/30',
                };
                const Icon = cfg.icon;
                const esMoratoria = r.tipo === 'moratorio_bcrp';
                return (
                  <div
                    key={r.tipo}
                    className={`rounded-2xl p-5 border bg-slate-800/50 ${cfg.border} ${esMoratoria ? 'md:col-span-1 ring-1 ring-inset ring-white/5' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                      <div className={`w-10 h-10 rounded-xl ${cfg.accentBg} flex items-center justify-center border border-white/10`}>
                        <Icon size={20} className={cfg.accentText} />
                      </div>
                      {esMoratoria && (
                        stale ? (
                          <span
                            className="px-2.5 py-1 rounded-full bg-red-500/15 text-red-300 text-[10px] font-bold border border-red-500/30"
                            title="El backend cayó al fallback: la tasa puede estar desactualizada."
                          >
                            ⚠ Tasa desactualizada (fallback)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-300 text-[10px] font-bold border border-yellow-500/30">
                            BCRP oficial
                          </span>
                        )
                      )}
                    </div>

                    <h3 className="font-bold text-sm text-slate-200 mb-3">{cfg.label}</h3>

                    <p className="text-xs text-slate-500 mb-0.5">Tasa anual</p>
                    <p className={`text-2xl font-extrabold mb-3 ${cfg.accentText}`}>
                      {r.tasa_pct}%
                    </p>

                    <dl className="space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-slate-500 text-xs">Interés ({dias} días)</dt>
                        <dd className="font-medium">{fmtPEN.format(r.interes)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                        <dt className="text-slate-500 text-xs">Total (monto + interés)</dt>
                        <dd className="font-bold text-white">{fmtPEN.format(r.total)}</dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>

            {/* Warning stale global (además del badge en la card moratoria) */}
            {stale && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  ⚠ Tasa moratoria desactualizada (fallback). Verifica la tasa vigente en bcrp.gob.pe antes de
                  calcular.
                </span>
              </div>
            )}

            {/* Nota referencial del backend */}
            {nota && (
              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
                <span>{nota}</span>
              </div>
            )}
          </div>
        ) : (
          !cargando && (
            /* Estado vacío */
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
              <BarChart3 className="w-12 h-12 text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-slate-400 mb-2">Compare los tres regímenes de interés</h3>
              <p className="text-sm text-slate-500 max-w-md">
                Ingrese el monto y los días de atraso para comparar el interés moratorio BCRP, la tasa remunerativa
                referencial y el interés legal del Código Civil (Art. 1985-A).
              </p>
            </div>
          )
        )}

        {/* Disclaimer referencial permanente */}
        <div className="mt-6 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
          <span>
            Resultado <strong className="text-slate-300">referencial</strong>. La tasa remunerativa es un valor de
            mercado editable, no oficial; el interés legal se fija periódicamente y puede variar según período,
            moneda o acuerdo de partes. No constituye asesoría legal ni liquidación oficial.
          </span>
        </div>
      </div>
    </div>
  );
}
