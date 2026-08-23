// Conversor de Plazos — días naturales ↔ días hábiles (CPC Art. 144)
// Herramienta determinística (sin IA). Endpoint: POST /api/herramientas/plazos-naturales
// Contrato: { fecha_inicio, dias, direccion } → { fecha_vencimiento,
//   dias_habiles_computados, dias_naturales, feriados_encontrados[], base_legal }
import { useState } from 'react';
import { CalendarClock, AlertTriangle, Info, ArrowRightLeft, CalendarDays, Hash } from 'lucide-react';
import { nodeClient } from '../api/client';

const DIRECCIONES = [
  { value: 'naturales_a_habiles', label: 'Naturales → Hábiles', hint: 'Dado un plazo en días naturales, ¿cuántos hábiles contiene?' },
  { value: 'habiles_a_naturales', label: 'Hábiles → Naturales', hint: 'Dado un plazo en días hábiles, ¿qué fecha natural de vencimiento?' },
];

function formatFecha(str) {
  if (!str) return '—';
  const d = new Date(`${str}T00:00:00`);
  if (Number.isNaN(d.getTime())) return str;
  return d.toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

export default function ConversorPlazos() {
  const [fechaInicio, setFechaInicio] = useState('');
  const [dias, setDias] = useState('');
  const [direccion, setDireccion] = useState('habiles_a_naturales');
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function handleConvertir(e) {
    e.preventDefault();
    setError('');
    setResultado(null);

    // Validación en cliente (el backend revalida con zod)
    if (!fechaInicio) {
      setError('Seleccione la fecha de inicio del plazo.');
      return;
    }
    const diasNum = Number(dias);
    if (!dias || Number.isNaN(diasNum) || !Number.isInteger(diasNum) || diasNum <= 0) {
      setError('Ingrese un número entero de días mayor a 0.');
      return;
    }
    if (diasNum > 3650) {
      setError('El plazo máximo es de 3650 días.');
      return;
    }

    setCargando(true);
    try {
      const { data } = await nodeClient.post('/api/herramientas/plazos-naturales', {
        fecha_inicio: fechaInicio,
        dias: diasNum,
        direccion,
      });
      if (!data?.success || !data?.data) throw new Error(data?.error || 'Respuesta inválida del servidor.');
      setResultado(data.data);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Error al convertir el plazo.');
    } finally {
      setCargando(false);
    }
  }

  const direccionActual = DIRECCIONES.find((d) => d.value === direccion);

  return (
    <div className="min-h-screen bg-[#0b1120] text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-gradient-to-br from-sky-500/20 to-cyan-600/10 border border-sky-500/20">
            <CalendarClock className="w-7 h-7 text-sky-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Conversor de Plazos</h1>
            <p className="text-slate-400 text-sm">Conversión bidireccional días naturales ↔ hábiles — CPC Art. 144</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulario */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-sky-400" />
              Datos del Plazo
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

            <form onSubmit={handleConvertir} className="space-y-5">
              <div>
                <label htmlFor="cp-direccion" className="block text-sm font-medium text-slate-300 mb-2">
                  Dirección de conversión
                </label>
                <select
                  id="cp-direccion"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-sky-500/50"
                >
                  {DIRECCIONES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1.5">{direccionActual?.hint}</p>
              </div>

              <div>
                <label htmlFor="cp-inicio" className="block text-sm font-medium text-slate-300 mb-2">
                  Fecha de inicio
                </label>
                <input
                  id="cp-inicio"
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-sky-500/50"
                  required
                />
              </div>

              <div>
                <label htmlFor="cp-dias" className="block text-sm font-medium text-slate-300 mb-2">
                  Días del plazo
                </label>
                <input
                  id="cp-dias"
                  type="number"
                  min="1"
                  max="3650"
                  step="1"
                  inputMode="numeric"
                  value={dias}
                  onChange={(e) => setDias(e.target.value)}
                  placeholder="Ej.: 15"
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={cargando}
                className="w-full py-3 rounded-xl font-medium transition-all bg-gradient-to-r from-sky-500 to-cyan-600 hover:from-sky-400 hover:to-cyan-500 text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {cargando ? (
                  <>Convirtiendo...</>
                ) : (
                  <><ArrowRightLeft className="w-4 h-4" /> Convertir Plazo</>
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
              <div
                className="rounded-2xl p-6 border bg-emerald-500/10 border-emerald-500/30"
                aria-live="polite"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Resultado</h2>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                    CPC ART. 144
                  </span>
                </div>

                {/* Fecha de vencimiento destacada */}
                <div className="bg-slate-700/30 rounded-xl p-4 mb-4 text-center">
                  <p className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" /> Fecha de vencimiento
                  </p>
                  <p className="text-2xl lg:text-3xl font-bold text-emerald-400 capitalize leading-tight">
                    {formatFecha(resultado.fecha_vencimiento)}
                  </p>
                </div>

                {/* Días computados */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-slate-700/30 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <Hash className="w-3 h-3" /> Días hábiles computados
                    </p>
                    <p className="font-medium text-lg">{resultado.dias_habiles_computados}</p>
                  </div>
                  <div className="bg-slate-700/30 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" /> Días naturales
                    </p>
                    <p className="font-medium text-lg">{resultado.dias_naturales}</p>
                  </div>
                </div>

                {/* Chips de feriados encontrados */}
                <div>
                  <p className="text-xs text-slate-500 mb-2">
                    Feriados dentro del plazo ({resultado.feriados_encontrados?.length ?? 0})
                  </p>
                  {(resultado.feriados_encontrados?.length ?? 0) > 0 ? (
                    <ul className="flex flex-wrap gap-2" aria-label="Feriados encontrados en el plazo">
                      {resultado.feriados_encontrados.map((f) => (
                        <li
                          key={f}
                          className="px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium"
                        >
                          {f}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400">No se encontraron feriados en el rango del plazo.</p>
                  )}
                </div>

                {resultado.regla_calculo && (
                  <div className="mt-4 p-3 rounded-xl bg-slate-700/30 text-sm text-slate-300">
                    <p className="text-xs text-slate-500 mb-1">Regla de cálculo</p>
                    <p className="text-xs">{resultado.regla_calculo}</p>
                  </div>
                )}
              </div>
            ) : (
              /* Estado vacío */
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center h-full">
                <CalendarClock className="w-12 h-12 text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-400 mb-2">Convierta su plazo procesal</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Seleccione la dirección de conversión, la fecha de inicio y los días del plazo para obtener el
                  vencimiento considerando feriados y fines de semana.
                </p>
              </div>
            )}

            {/* Disclaimer referencial permanente */}
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400 flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
              <span>
                Resultado <strong className="text-slate-300">referencial</strong> según catálogo de feriados
                nacionales (CPC Art. 144). No considera feriados judiciales distritales ni suspensiones de labores
                específicas. Verifique contra el texto oficial (SPIJ). No constituye asesoría legal.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
