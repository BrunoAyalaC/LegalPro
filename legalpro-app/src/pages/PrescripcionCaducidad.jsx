// Prescripción y Caducidad Penal — herramienta determinística (sin IA)
// Endpoint: POST /api/herramientas/prescripcion (Node)
// Contrato: { pena_anios, fecha_hecho, interruptores }
//   → { plazo_anios, fecha_prescripcion, dias_restantes, prescrito, base_legal }
// Base legal: CP Art. 85 (plazo = pena máx + mitad, mín. 2 años) + CP Art. 88 (interrupción)
import { useState } from 'react';
import { Hourglass, AlertTriangle, CheckCircle2, XCircle, Scale, Info } from 'lucide-react';
import { nodeClient } from '../api/client';

export default function PrescripcionCaducidad() {
  const [penaAnios, setPenaAnios] = useState('');
  const [fechaHecho, setFechaHecho] = useState('');
  const [interruptores, setInterruptores] = useState('0');
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function handleCalcular(e) {
    e.preventDefault();
    setError('');
    setResultado(null);

    // Validación en cliente (el backend revalida con zod)
    const penaNum = Number(penaAnios);
    const interruptoresNum = Number(interruptores || 0);
    if (!penaAnios || Number.isNaN(penaNum) || penaNum <= 0) {
      setError('Ingrese los años de pena máxima (mayor a 0).');
      return;
    }
    if (!fechaHecho) {
      setError('Seleccione la fecha del hecho.');
      return;
    }
    if (!Number.isInteger(interruptoresNum) || interruptoresNum < 0) {
      setError('El número de interruptores debe ser un entero mayor o igual a 0.');
      return;
    }

    setCargando(true);
    try {
      const { data } = await nodeClient.post('/api/herramientas/prescripcion', {
        pena_anios: penaNum,
        fecha_hecho: fechaHecho,
        interruptores: interruptoresNum,
      });
      if (!data?.success || !data?.data) throw new Error(data?.error || 'Respuesta inválida del servidor.');
      setResultado(data.data);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Error al calcular la prescripción.');
    } finally {
      setCargando(false);
    }
  }

  const prescrito = resultado?.prescrito === true;

  return (
    <div className="min-h-screen bg-[#0b1120] text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-600/10 border border-cyan-500/20">
            <Hourglass className="w-7 h-7 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Prescripción de la Acción Penal</h1>
            <p className="text-slate-400 text-sm">Cómputo según CP Arts. 85 y 88</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulario */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Scale className="w-5 h-5 text-cyan-400" />
              Datos del Cómputo
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
                <label htmlFor="pc-pena" className="block text-sm font-medium text-slate-300 mb-2">
                  Pena máxima prevista (años)
                </label>
                <input
                  id="pc-pena"
                  type="number"
                  min="0.5"
                  step="0.5"
                  inputMode="decimal"
                  value={penaAnios}
                  onChange={(e) => setPenaAnios(e.target.value)}
                  placeholder="Ej.: 4 (hurto simple), 15 (coima pasiva)"
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                  required
                />
                <p className="mt-1 text-xs text-slate-500">Pena máxima del tipo penal según el Código Penal.</p>
              </div>

              <div>
                <label htmlFor="pc-fecha" className="block text-sm font-medium text-slate-300 mb-2">
                  Fecha del hecho
                </label>
                <input
                  id="pc-fecha"
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  value={fechaHecho}
                  onChange={(e) => setFechaHecho(e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500/50"
                  required
                />
              </div>

              <div>
                <label htmlFor="pc-interruptores" className="block text-sm font-medium text-slate-300 mb-2">
                  Actos interruptivos (CP Art. 88)
                </label>
                <input
                  id="pc-interruptores"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={interruptores}
                  onChange={(e) => setInterruptores(e.target.value)}
                  placeholder="Ej.: 0"
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Cada acto interruptivo (diligencias, citación al imputado, etc.) reinicia el plazo.
                </p>
              </div>

              <button
                type="submit"
                disabled={cargando}
                className="w-full py-3 rounded-xl font-medium transition-all bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-400 hover:to-teal-500 text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {cargando ? (
                  <>Calculando...</>
                ) : (
                  <><Hourglass className="w-4 h-4" /> Calcular Prescripción</>
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

            {/* Base legal visible */}
            <div className="mt-6 p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 text-xs text-slate-400 space-y-2">
              <p className="font-semibold text-slate-300 uppercase tracking-wide text-[10px]">Base legal</p>
              <p>
                <strong className="text-slate-300">CP Art. 85:</strong> el plazo de prescripción de la acción penal es
                igual al máximo de la pena privativa de libertad prevista + la mitad, con un mínimo de 2 años.
              </p>
              <p>
                <strong className="text-slate-300">CP Art. 88:</strong> la prescripción se interrumpe con las
                diligencias de investigación y otras actuaciones procesales; cada interrupción hace correr un nuevo
                plazo.
              </p>
            </div>
          </div>

          {/* Resultado */}
          <div className="space-y-4">
            {resultado ? (
              <>
                <div
                  aria-live="polite"
                  className={`rounded-2xl p-6 border ${
                    prescrito ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Resultado</h2>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                        prescrito ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {prescrito ? (
                        <>
                          <XCircle className="w-3.5 h-3.5" /> PRESCRITO
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> NO PRESCRITO
                        </>
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="bg-slate-700/30 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">Plazo total</p>
                      <p className="font-medium">{resultado.plazo_anios} años</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">Vence / venció el</p>
                      <p className="font-medium">
                        {new Date(`${resultado.fecha_prescripcion}T00:00:00`).toLocaleDateString('es-PE')}
                      </p>
                    </div>
                    <div className="bg-slate-700/30 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">{prescrito ? 'Días transcurridos' : 'Días restantes'}</p>
                      <p className={`font-medium ${prescrito ? 'text-red-400' : 'text-emerald-400'}`}>
                        {Math.abs(resultado.dias_restantes)}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-700/30 text-sm text-slate-300 flex items-start gap-2">
                    {prescrito ? (
                      <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" />
                    )}
                    <span>
                      {prescrito
                        ? `La acción penal habría prescrito hace ${Math.abs(resultado.dias_restantes)} días, según el cómputo indicado.`
                        : `Faltan ${resultado.dias_restantes} días (${(resultado.dias_restantes / 365).toFixed(1)} años) para que opere la prescripción.`}
                    </span>
                  </div>

                  <div className="mt-3 p-3 rounded-xl bg-slate-700/30 text-xs text-slate-400">
                    <p className="mb-1 text-slate-500">Base legal aplicada</p>
                    <p>{resultado.base_legal}</p>
                  </div>
                </div>

                {/* Disclaimer referencial */}
                <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400 flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
                  <span>
                    Resultado <strong className="text-slate-300">referencial</strong>. El cómputo real depende de la
                    pena efectivamente impuesta, la naturaleza de cada acto interruptivo, causales de suspensión
                    (CP Art. 89) y reglas especiales. No constituye asesoría legal.
                  </span>
                </div>
              </>
            ) : (
              /* Estado vacío */
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center h-full">
                <Hourglass className="w-12 h-12 text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-400 mb-2">Calcule la prescripción penal</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Ingrese la pena máxima del tipo penal, la fecha del hecho y los actos interruptivos para verificar
                  si la acción penal está prescrita según CP Arts. 85 y 88.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
