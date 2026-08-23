// Liquidación Laboral — herramienta determinística (sin IA)
// Endpoint: POST /api/herramientas/liquidacion-laboral
// Contrato: { fecha_ingreso, fecha_cese, remuneracion_mensual, motivo } → {
//   tiempo_servicio: {anios, meses, dias}, cts, vacaciones_truncas,
//   gratificacion_trunca, indemnizacion|null ({monto_bruto, tope_aplicado,
//   monto, ...}), total, base_legal, nota }
// NOTA: el backend solo acepta motivo 'despido_arbitrario'|'otro' (zod).
// La UI ofrece 'renuncia' y la mapea a 'otro' (mismo tratamiento: sin indemnización).
import { useState } from 'react';
import { Wallet, AlertTriangle, Info, Calculator, Scale } from 'lucide-react';
import { nodeClient } from '../api/client';

const fmtPEN = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 });

export default function LiquidacionLaboral() {
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [fechaCese, setFechaCese] = useState('');
  const [remuneracion, setRemuneracion] = useState('');
  const [motivo, setMotivo] = useState('renuncia');
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
      const { data } = await nodeClient.post('/api/herramientas/liquidacion-laboral', {
        fecha_ingreso: fechaIngreso,
        fecha_cese: fechaCese,
        remuneracion_mensual: remNum,
        // 'renuncia' no existe en el schema del backend → se envía como 'otro'
        motivo: motivo === 'despido_arbitrario' ? 'despido_arbitrario' : 'otro',
      });
      if (!data?.success || !data?.data) throw new Error(data?.error || 'Respuesta inválida del servidor.');
      setResultado(data.data);
    } catch (err) {
      const apiErr = err?.response?.data;
      const detalle = Array.isArray(apiErr?.details) && apiErr.details[0]?.message;
      setError([apiErr?.error || err?.message || 'Error al calcular la liquidación.', detalle].filter(Boolean).join(' — '));
    } finally {
      setCargando(false);
    }
  }

  const t = resultado?.tiempo_servicio;

  return (
    <div className="min-h-screen bg-[#0b1120] text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/10 border border-emerald-500/20">
            <Wallet className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Liquidación Laboral</h1>
            <p className="text-slate-400 text-sm">Beneficios sociales — LPCL + D.S. N° 001-97-TR</p>
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
                  <label htmlFor="ll-ingreso" className="block text-sm font-medium text-slate-300 mb-2">
                    Fecha de ingreso
                  </label>
                  <input
                    id="ll-ingreso"
                    type="date"
                    value={fechaIngreso}
                    onChange={(e) => setFechaIngreso(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500/50"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="ll-cese" className="block text-sm font-medium text-slate-300 mb-2">
                    Fecha de cese
                  </label>
                  <input
                    id="ll-cese"
                    type="date"
                    value={fechaCese}
                    onChange={(e) => setFechaCese(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500/50"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ll-remuneracion" className="block text-sm font-medium text-slate-300 mb-2">
                  Remuneración mensual bruta (S/)
                </label>
                <input
                  id="ll-remuneracion"
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

              <div>
                <label htmlFor="ll-motivo" className="block text-sm font-medium text-slate-300 mb-2">
                  Motivo de cese
                </label>
                <select
                  id="ll-motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="renuncia">Renuncia</option>
                  <option value="despido_arbitrario">Despido arbitrario</option>
                  <option value="otro">Otro</option>
                </select>
                <p className="mt-1.5 text-xs text-slate-500">
                  Solo el despido arbitrario genera indemnización (D.S. 001-97-TR, Arts. 34 y 38).
                </p>
              </div>

              <button
                type="submit"
                disabled={cargando}
                className="w-full py-3 rounded-xl font-medium transition-all bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {cargando ? (
                  <>Calculando...</>
                ) : (
                  <><Calculator className="w-4 h-4" /> Calcular Liquidación</>
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
                  <h2 className="text-lg font-semibold mb-4">Resultado</h2>

                  {/* TOTAL GRANDE */}
                  <div className="bg-slate-700/30 rounded-xl p-5 mb-4 text-center">
                    <p className="text-xs text-slate-400 mb-1">Total liquidación</p>
                    <p className="text-4xl lg:text-5xl font-extrabold text-emerald-400 leading-tight">
                      {fmtPEN.format(resultado.total)}
                    </p>
                  </div>

                  {/* Desglose en cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="p-3 rounded-xl bg-slate-700/30 text-sm text-slate-300">
                      <p className="text-xs text-slate-500 mb-1">Tiempo de servicio</p>
                      <p className="font-medium">{t.anios}a {t.meses}m {t.dias}d</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-700/30 text-sm text-slate-300">
                      <p className="text-xs text-slate-500 mb-1">CTS</p>
                      <p className="font-mono">{fmtPEN.format(resultado.cts)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-700/30 text-sm text-slate-300">
                      <p className="text-xs text-slate-500 mb-1">Vacaciones truncas</p>
                      <p className="font-mono">{fmtPEN.format(resultado.vacaciones_truncas)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-700/30 text-sm text-slate-300">
                      <p className="text-xs text-slate-500 mb-1">Gratificación trunca</p>
                      <p className="font-mono">{fmtPEN.format(resultado.gratificacion_trunca)}</p>
                    </div>

                    {/* Indemnización — solo si aplica (despido arbitrario) */}
                    {resultado.indemnizacion != null && (
                      <div className="p-3 rounded-xl bg-slate-700/30 text-sm text-slate-300 sm:col-span-2">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                          <p className="text-xs text-slate-500">Indemnización por despido arbitrario</p>
                          {resultado.indemnizacion.tope_aplicado && (
                            <span
                              className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30"
                              title="Art. 34 in fine: la indemnización no puede exceder de 12 remuneraciones."
                            >
                              ⚠ Tope 12 remuneraciones
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-base text-emerald-300">{fmtPEN.format(resultado.indemnizacion.monto)}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Bruto: {fmtPEN.format(resultado.indemnizacion.monto_bruto)} ·{' '}
                          {resultado.indemnizacion.anios_completos}a + {resultado.indemnizacion.meses_fraccion}m
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-slate-700/30 text-sm text-slate-300">
                    <p className="text-xs text-slate-500 mb-1">Base legal</p>
                    <p className="font-mono text-xs">{resultado.base_legal}</p>
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
                <Wallet className="w-12 h-12 text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-400 mb-2">Calcule la liquidación</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Ingrese las fechas de ingreso y cese, la remuneración mensual bruta y el motivo de cese para
                  obtener CTS, vacaciones truncas, gratificación trunca e indemnización según LPCL y D.S. 001-97-TR.
                </p>
              </div>
            )}

            {/* Disclaimer referencial permanente */}
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400 flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
              <span>
                Resultado <strong className="text-slate-300">referencial</strong> con cálculo simplificado (CTS
                días/360; truncas por mes completo). No incluye períodos vencidos no cobrados ni remuneración
                variable. No constituye asesoría legal ni liquidación oficial.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
