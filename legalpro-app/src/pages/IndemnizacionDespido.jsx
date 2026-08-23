// Indemnización por Despido Arbitrario — herramienta determinística (sin IA)
// Endpoint: POST /api/herramientas/indemnizacion-despido
// Contrato: { fecha_ingreso, fecha_cese, remuneracion_mensual } → {
//   anios_servicio, anios_completos, meses_fraccion, indemnizacion_bruta,
//   tope_aplicado, indemnizacion_final, base_legal }
import { useState } from 'react';
import { BriefcaseBusiness, AlertTriangle, Info, Calculator, Scale } from 'lucide-react';
import { nodeClient } from '../api/client';

const fmtPEN = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 });

export default function IndemnizacionDespido() {
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [fechaCese, setFechaCese] = useState('');
  const [remuneracion, setRemuneracion] = useState('');
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function handleCalcular(e) {
    e.preventDefault();
    setError('');
    setResultado(null);

    // Validación en cliente (el backend revalida con zod)
    if (!fechaIngreso || !fechaCese) {
      setError('Seleccione ambas fechas (ingreso y cese).');
      return;
    }
    if (new Date(`${fechaCese}T00:00:00`) <= new Date(`${fechaIngreso}T00:00:00`)) {
      setError('La fecha de cese debe ser posterior a la fecha de ingreso.');
      return;
    }
    const remNum = Number(remuneracion);
    if (!remuneracion || Number.isNaN(remNum) || remNum <= 0) {
      setError('Ingrese una remuneración mensual mayor a 0.');
      return;
    }

    setCargando(true);
    try {
      const { data } = await nodeClient.post('/api/herramientas/indemnizacion-despido', {
        fecha_ingreso: fechaIngreso,
        fecha_cese: fechaCese,
        remuneracion_mensual: remNum,
      });
      if (!data?.success || !data?.data) throw new Error(data?.error || 'Respuesta inválida del servidor.');
      setResultado(data.data);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Error al calcular la indemnización.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/10 border border-emerald-500/20">
            <BriefcaseBusiness className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Indemnización por Despido</h1>
            <p className="text-slate-400 text-sm">Despido arbitrario — D.S. N° 001-97-TR (LPC), Arts. 34 y 38</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulario */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-400" />
              Datos del Trabajador
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="id-ingreso" className="block text-sm font-medium text-slate-300 mb-2">
                    Fecha de ingreso
                  </label>
                  <input
                    id="id-ingreso"
                    type="date"
                    value={fechaIngreso}
                    onChange={(e) => setFechaIngreso(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500/50"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="id-cese" className="block text-sm font-medium text-slate-300 mb-2">
                    Fecha de cese
                  </label>
                  <input
                    id="id-cese"
                    type="date"
                    value={fechaCese}
                    onChange={(e) => setFechaCese(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500/50"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="id-remuneracion" className="block text-sm font-medium text-slate-300 mb-2">
                  Remuneración mensual bruta (S/)
                </label>
                <input
                  id="id-remuneracion"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={remuneracion}
                  onChange={(e) => setRemuneracion(e.target.value)}
                  placeholder="Ej.: 2500.00"
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={cargando}
                className="w-full py-3 rounded-xl font-medium transition-all bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {cargando ? (
                  <>Calculando...</>
                ) : (
                  <><Calculator className="w-4 h-4" /> Calcular Indemnización</>
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
                  className="rounded-2xl p-6 border bg-emerald-500/10 border-emerald-500/30"
                  aria-live="polite"
                >
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <h2 className="text-lg font-semibold">Resultado</h2>
                    {/* Badge ámbar si el tope legal de 12 remuneraciones fue aplicado */}
                    {resultado.tope_aplicado && (
                      <span
                        className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30"
                        title="Art. 34 in fine: la indemnización no puede exceder de 12 remuneraciones."
                      >
                        ⚠ Tope 12 remuneraciones aplicado
                      </span>
                    )}
                  </div>

                  {/* Monto final GRANDE */}
                  <div className="bg-slate-700/30 rounded-xl p-5 mb-4 text-center">
                    <p className="text-xs text-slate-400 mb-1">Indemnización final</p>
                    <p className="text-4xl lg:text-5xl font-extrabold text-emerald-400 leading-tight">
                      {fmtPEN.format(resultado.indemnizacion_final)}
                    </p>
                  </div>

                  {/* Desglose */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                    <div className="bg-slate-700/30 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">Años completos</p>
                      <p className="font-medium text-lg">{resultado.anios_completos}</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">Meses (fracción)</p>
                      <p className="font-medium text-lg">{resultado.meses_fraccion}</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-xl p-3 col-span-2 sm:col-span-1">
                      <p className="text-xs text-slate-500 mb-1">Tiempo de servicio</p>
                      <p className="font-medium text-lg">{resultado.anios_servicio} años</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-slate-700/30 text-sm text-slate-300">
                      <p className="text-xs text-slate-500 mb-1">Indemnización bruta (sin tope)</p>
                      <p className="font-mono text-sm">{fmtPEN.format(resultado.indemnizacion_bruta)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-700/30 text-sm text-slate-300">
                      <p className="text-xs text-slate-500 mb-1">Base legal</p>
                      <p className="font-mono text-xs">{resultado.base_legal}</p>
                    </div>
                  </div>
                </div>

                {/* Fórmula visible */}
                <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400 flex items-start gap-2">
                  <Scale className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
                  <span>
                    Fórmula (Art. 34): <strong className="text-slate-300">1.5 remuneraciones por año completo</strong>{' '}
                    + fracción proporcional por meses. Tope legal (Art. 34 in fine): máximo{' '}
                    <strong className="text-slate-300">12 remuneraciones</strong>.
                  </span>
                </div>
              </>
            ) : (
              /* Estado vacío */
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center h-full">
                <BriefcaseBusiness className="w-12 h-12 text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-400 mb-2">Calcule la indemnización</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Ingrese las fechas de ingreso y cese, y la remuneración mensual bruta para obtener la
                  indemnización por despido arbitrario según D.S. 001-97-TR.
                </p>
              </div>
            )}

            {/* Disclaimer referencial permanente */}
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400 flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
              <span>
                Resultado <strong className="text-slate-300">referencial</strong>. No incluye beneficios sociales,
                trunca de vacaciones ni otros conceptos. La calificación del despido (arbitrario vs. nulo) puede
                variar el régimen aplicable. No constituye asesoría legal ni liquidación oficial.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
