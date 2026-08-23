// Pensión de Alimentos — herramienta determinística (sin IA)
// Endpoint: POST /api/herramientas/pension-alimentos
// Contrato: { ingresos_demandado, otros_ingresos?, numero_hijos } → {
//   numero_hijos, base_imponible, porcentaje_aplicado, pension_total_mensual,
//   pension_por_hijo, base_legal, nota }
import { useState } from 'react';
import { Scale, AlertTriangle, Info, Users, Minus, Plus } from 'lucide-react';
import { nodeClient } from '../api/client';

const fmtPEN = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 });

export default function PensionAlimentos() {
  const [ingresos, setIngresos] = useState('');
  const [otrosIngresos, setOtrosIngresos] = useState('');
  const [hijos, setHijos] = useState(1);
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  function cambiarHijos(delta) {
    setHijos((h) => Math.min(10, Math.max(1, Number(h) + delta)));
  }

  async function handleCalcular(e) {
    e.preventDefault();
    setError('');
    setResultado(null);

    // Validación en cliente (el backend revalida con zod)
    const ingNum = Number(ingresos);
    const otrosNum = otrosIngresos === '' ? 0 : Number(otrosIngresos);
    if (!ingresos || Number.isNaN(ingNum) || ingNum < 0) {
      setError('Ingrese los ingresos del demandado (mayores o iguales a 0).');
      return;
    }
    if (Number.isNaN(otrosNum) || otrosNum < 0) {
      setError('Los otros ingresos deben ser un monto válido mayor o igual a 0.');
      return;
    }
    if (ingNum + otrosNum <= 0) {
      setError('La suma de ingresos debe ser mayor a 0.');
      return;
    }
    const nHijos = Number(hijos);
    if (!Number.isInteger(nHijos) || nHijos < 1 || nHijos > 10) {
      setError('El número de hijos debe estar entre 1 y 10.');
      return;
    }

    setCargando(true);
    try {
      const { data } = await nodeClient.post('/api/herramientas/pension-alimentos', {
        ingresos_demandado: ingNum,
        otros_ingresos: otrosNum,
        numero_hijos: nHijos,
      });
      if (!data?.success || !data?.data) throw new Error(data?.error || 'Respuesta inválida del servidor.');
      setResultado(data.data);
    } catch (err) {
      const apiErr = err?.response?.data;
      const detalle = Array.isArray(apiErr?.details) && apiErr.details[0]?.message;
      setError([apiErr?.error || err?.message || 'Error al calcular la pensión.', detalle].filter(Boolean).join(' — '));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/10 border border-sky-500/20">
            <Scale className="w-7 h-7 text-sky-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Pensión de Alimentos</h1>
            <p className="text-slate-400 text-sm">Rangos referenciales — Ley 28720 + jurisprudencia suprema</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulario */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-400" />
              Datos del Demandado
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
                (SPIJ, El Peruano) antes de usar profesionalmente.
              </span>
            </div>

            <form onSubmit={handleCalcular} className="space-y-5">
              <div>
                <label htmlFor="pa-ingresos" className="block text-sm font-medium text-slate-300 mb-2">
                  Ingresos mensuales del demandado (S/)
                </label>
                <input
                  id="pa-ingresos"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={ingresos}
                  onChange={(e) => setIngresos(e.target.value)}
                  placeholder="Ej.: 3000.00"
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
                  required
                />
              </div>

              <div>
                <label htmlFor="pa-otros" className="block text-sm font-medium text-slate-300 mb-2">
                  Otros ingresos (opcional)
                </label>
                <input
                  id="pa-otros"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={otrosIngresos}
                  onChange={(e) => setOtrosIngresos(e.target.value)}
                  placeholder="Ej.: 500.00"
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
                />
              </div>

              {/* Stepper número de hijos (1-10) */}
              <div>
                <label htmlFor="pa-hijos" className="block text-sm font-medium text-slate-300 mb-2">
                  Número de hijos
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => cambiarHijos(-1)}
                    disabled={Number(hijos) <= 1}
                    aria-label="Quitar un hijo"
                    className="w-11 h-11 rounded-xl bg-slate-700/50 border border-slate-600/50 flex items-center justify-center text-white hover:bg-slate-600/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    id="pa-hijos"
                    type="number"
                    min="1"
                    max="10"
                    step="1"
                    value={hijos}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setHijos(Number.isNaN(v) ? '' : v);
                    }}
                    onBlur={() => setHijos((h) => (Number(h) >= 1 && Number(h) <= 10 ? h : 1))}
                    aria-describedby="pa-hijos-help"
                    className="w-24 text-center bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-sky-500/50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => cambiarHijos(1)}
                    disabled={Number(hijos) >= 10}
                    aria-label="Agregar un hijo"
                    className="w-11 h-11 rounded-xl bg-slate-700/50 border border-slate-600/50 flex items-center justify-center text-white hover:bg-slate-600/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <p id="pa-hijos-help" className="mt-1.5 text-xs text-slate-500">
                  Entre 1 y 10 hijos.
                </p>
              </div>

              <button
                type="submit"
                disabled={cargando}
                className="w-full py-3 rounded-xl font-medium transition-all bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {cargando ? (
                  <>Calculando...</>
                ) : (
                  <><Scale className="w-4 h-4" /> Calcular Pensión Referencial</>
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

          {/* Resultado */}
          <div className="space-y-4">
            {resultado ? (
              <>
                <div
                  className="rounded-2xl p-6 border bg-sky-500/10 border-sky-500/30"
                  aria-live="polite"
                >
                  <h2 className="text-lg font-semibold mb-4">Resultado</h2>

                  {/* % aplicado GRANDE */}
                  <div className="bg-slate-700/30 rounded-xl p-5 mb-4 text-center">
                    <p className="text-xs text-slate-400 mb-1">Porcentaje aplicado sobre la base imponible</p>
                    <p className="text-4xl lg:text-5xl font-extrabold text-sky-400 leading-tight">
                      {resultado.porcentaje_aplicado}%
                    </p>
                  </div>

                  {/* Pensión total mensual */}
                  <div className="bg-slate-700/30 rounded-xl p-5 mb-4 text-center">
                    <p className="text-xs text-slate-400 mb-1">Pensión total mensual</p>
                    <p className="text-3xl lg:text-4xl font-extrabold text-emerald-400 leading-tight">
                      {fmtPEN.format(resultado.pension_total_mensual)}
                    </p>
                  </div>

                  {/* Base imponible + base legal */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="p-3 rounded-xl bg-slate-700/30 text-sm text-slate-300">
                      <p className="text-xs text-slate-500 mb-1">Base imponible</p>
                      <p className="font-mono">{fmtPEN.format(resultado.base_imponible)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-700/30 text-sm text-slate-300">
                      <p className="text-xs text-slate-500 mb-1">Base legal</p>
                      <p className="font-mono text-xs">{resultado.base_legal}</p>
                    </div>
                  </div>

                  {/* Pensión por hijo — grid de cards si >1 */}
                  <div>
                    <p className="text-xs text-slate-400 mb-2">
                      Pensión por hijo ({fmtPEN.format(resultado.pension_por_hijo)} c/u)
                    </p>
                    <div
                      className={`grid gap-3 ${resultado.numero_hijos > 1 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1'}`}
                    >
                      {Array.from({ length: resultado.numero_hijos }, (_, i) => (
                        <div key={i} className="rounded-xl p-3 bg-slate-700/30 border border-slate-600/30 text-center">
                          <p className="text-xs text-slate-500 mb-1">Hijo {i + 1}</p>
                          <p className="font-mono text-sm font-semibold text-sky-300">
                            {fmtPEN.format(resultado.pension_por_hijo)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Nota del backend visible */}
                {resultado.nota && (
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400 flex items-start gap-2">
                    <Scale className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
                    <span>{resultado.nota}</span>
                  </div>
                )}
              </>
            ) : (
              /* Estado vacío */
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center h-full">
                <Scale className="w-12 h-12 text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-400 mb-2">Calcule la pensión referencial</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Ingrese los ingresos del demandado y el número de hijos para obtener un rango referencial según
                  Ley 28720 y jurisprudencia suprema (25% · 40% · 50%).
                </p>
              </div>
            )}

            {/* Disclaimer referencial permanente */}
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400 flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
              <span>
                Resultado <strong className="text-slate-300">referencial</strong>. El juez fija la pensión según las
                pruebas de ingresos aportadas (Ley 28720), no por tabla automática. No constituye asesoría legal.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
