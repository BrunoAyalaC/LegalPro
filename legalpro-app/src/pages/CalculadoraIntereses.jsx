// Calculadora de Interés Legal — herramienta determinística (sin IA)
// Endpoint: POST /api/herramientas/interes-legal (Node)
// Contrato: { capital, tasa_anual_pct, desde, hasta } → { interes, dias, total, formula }
import { useState } from 'react';
import { Percent, CalendarDays, AlertTriangle, Calculator, Info, Clock3 } from 'lucide-react';
import { nodeClient } from '../api/client';

const fmtPEN = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 });

export default function CalculadoraIntereses() {
  const [capital, setCapital] = useState('');
  const [tasa, setTasa] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [resultado, setResultado] = useState(null);
  const [tasaStale, setTasaStale] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function handleCalcular(e) {
    e.preventDefault();
    setError('');
    setResultado(null);
    setTasaStale(false);

    // Validación en cliente (el backend revalida con zod)
    const capitalNum = Number(capital);
    const tasaNum = Number(tasa);
    if (!capital || Number.isNaN(capitalNum) || capitalNum <= 0) {
      setError('Ingrese un capital mayor a 0.');
      return;
    }
    if (!tasa || Number.isNaN(tasaNum) || tasaNum <= 0) {
      setError('Ingrese una tasa anual (%) mayor a 0.');
      return;
    }
    if (!desde || !hasta) {
      setError('Seleccione ambas fechas (desde y hasta).');
      return;
    }
    if (new Date(`${hasta}T00:00:00`) <= new Date(`${desde}T00:00:00`)) {
      setError('La fecha "hasta" debe ser posterior a la fecha "desde".');
      return;
    }

    setCargando(true);
    try {
      const { data } = await nodeClient.post('/api/herramientas/interes-legal', {
        capital: capitalNum,
        tasa_anual_pct: tasaNum,
        desde,
        hasta,
      });
      if (!data?.success || !data?.data) throw new Error(data?.error || 'Respuesta inválida del servidor.');
      setResultado(data.data);
      // Banner BCRP stale: el backend marca `stale: true` cuando cae al fallback
      setTasaStale(Boolean(data.data.stale ?? data.stale));
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Error al calcular el interés legal.');
      setTasaStale(false);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-600/10 border border-yellow-500/20">
            <Percent className="w-7 h-7 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Calculadora de Interés Legal</h1>
            <p className="text-slate-400 text-sm">Interés moratorio simple sobre capital — día calendario</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulario */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-yellow-400" />
              Datos del Cálculo
            </h2>

            {/* Disclaimer permanente — Ley 29571 (consumidor) / herramienta referencial */}
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

            <form onSubmit={handleCalcular} className="space-y-5">
              <div>
                <label htmlFor="ci-capital" className="block text-sm font-medium text-slate-300 mb-2">
                  Capital (S/)
                </label>
                <input
                  id="ci-capital"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={capital}
                  onChange={(e) => setCapital(e.target.value)}
                  placeholder="Ej.: 15000.00"
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-500/50"
                  required
                />
              </div>

              <div>
                <label htmlFor="ci-tasa" className="block text-sm font-medium text-slate-300 mb-2">
                  Tasa de interés anual (%)
                </label>
                <input
                  id="ci-tasa"
                  type="number"
                  min="0"
                  step="0.001"
                  inputMode="decimal"
                  value={tasa}
                  onChange={(e) => setTasa(e.target.value)}
                  placeholder="Ej.: 7.6661 (tasa moratoria BCRP)"
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-500/50"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ci-desde" className="block text-sm font-medium text-slate-300 mb-2">
                    Desde
                  </label>
                  <input
                    id="ci-desde"
                    type="date"
                    value={desde}
                    onChange={(e) => setDesde(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500/50"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="ci-hasta" className="block text-sm font-medium text-slate-300 mb-2">
                    Hasta
                  </label>
                  <input
                    id="ci-hasta"
                    type="date"
                    value={hasta}
                    onChange={(e) => setHasta(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500/50"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={cargando}
                className="w-full py-3 rounded-xl font-medium transition-all bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {cargando ? (
                  <>Calculando...</>
                ) : (
                  <><Percent className="w-4 h-4" /> Calcular Interés</>
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

            {/* Banner BCRP stale — tasa de fallback desactualizada */}
            {tasaStale && (
              <div
                role="alert"
                className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  ⚠ Tasa moratoria desactualizada (fallback). Verifica la tasa vigente en bcrp.gob.pe antes de
                  calcular.
                </span>
              </div>
            )}
          </div>

          {/* Resultado */}
          <div className="space-y-4">
            {resultado ? (
              <>
                <div className="rounded-2xl p-6 border bg-emerald-500/10 border-emerald-500/30" aria-live="polite">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Resultado</h2>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                      INTERÉS SIMPLE
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="bg-slate-700/30 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                        <Clock3 className="w-3 h-3" /> Días
                      </p>
                      <p className="font-medium text-lg">{resultado.dias}</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                        <Percent className="w-3 h-3" /> Interés
                      </p>
                      <p className="font-medium text-lg text-yellow-400">{fmtPEN.format(resultado.interes)}</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">Total (capital + interés)</p>
                      <p className="font-medium text-lg text-emerald-400">{fmtPEN.format(resultado.total)}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-700/30 text-sm text-slate-300">
                    <p className="text-xs text-slate-500 mb-1">Fórmula aplicada</p>
                    <p className="font-mono text-xs">{resultado.formula}</p>
                  </div>
                </div>

                {/* Disclaimer referencial */}
                <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400 flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
                  <span>
                    Resultado <strong className="text-slate-300">referencial</strong>. El interés legal se fija
                    periódicamente por el BCRP y puede variar según el período, la moneda o lo que acuerden las
                    partes. No constituye asesoría legal ni liquidación oficial.
                  </span>
                </div>
              </>
            ) : (
              /* Estado vacío */
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center h-full">
                <CalendarDays className="w-12 h-12 text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-400 mb-2">Calcule el interés moratorio</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Ingrese el capital, la tasa anual y el rango de fechas para obtener el interés simple devengado
                  según día calendario.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
