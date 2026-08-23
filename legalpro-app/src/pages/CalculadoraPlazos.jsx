import { useState } from 'react';
import { Calendar, Clock, AlertTriangle, CheckCircle, ChevronRight, Scale, Gavel, FileText, BookOpen, Info } from 'lucide-react';
import { dotnetClient } from '../api/client';

const RAMAS_DERECHO = [
  { value: 'penal', label: 'Penal', icon: Gavel },
  { value: 'civil', label: 'Civil', icon: Scale },
  { value: 'laboral', label: 'Laboral', icon: FileText },
  { value: 'familia', label: 'Familia', icon: BookOpen },
  { value: 'constitucional', label: 'Constitucional', icon: Scale },
  { value: 'administrativo', label: 'Administrativo', icon: FileText },
];

const TIPOS_ACTO = [
  { value: 'apelar_sentencia', label: 'Apelar Sentencia' },
  { value: 'apelar_auto', label: 'Apelar Auto' },
  { value: 'contestar_demanda', label: 'Contestar Demanda' },
  { value: 'interponer_recurso', label: 'Interponer Recurso' },
  { value: 'ofrecer_prueba', label: 'Ofrecer Prueba' },
  { value: 'deducir_excepcion', label: 'Deducir Excepción' },
  { value: 'formular_acusacion', label: 'Formular Acusación' },
  { value: 'aclarar_sentencia', label: 'Aclarar Sentencia' },
  { value: 'tachar_testigo', label: 'Tachar Testigo' },
  { value: 'interponer_accion', label: 'Interponer Acción Constitucional' },
  { value: 'apelar_resolucion', label: 'Apelar Resolución Administrativa' },
];

const TIPOS_PROCESO = [
  { value: 'ordinario', label: 'Ordinario' },
  { value: 'sumarisimo', label: 'Sumarísimo' },
  { value: 'abreviado', label: 'Abreviado' },
  { value: 'ejecutivo', label: 'Ejecutivo' },
];

export default function CalculadoraPlazos() {
  const [tipoActo, setTipoActo] = useState('');
  const [ramaDerecho, setRamaDerecho] = useState('');
  const [tipoProceso, setTipoProceso] = useState('ordinario');
  const [fechaNotificacion, setFechaNotificacion] = useState(new Date().toISOString().split('T')[0]);
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function handleCalcular(e) {
    e.preventDefault();
    setCargando(true);
    setError('');
    setResultado(null);

    try {
      const { data } = await dotnetClient.post('/api/plazos/calcular', {
        tipoActo,
        ramaDerecho,
        tipoProceso: tipoProceso || 'ordinario',
        fechaNotificacion: new Date(fechaNotificacion).toISOString(),
      });
      setResultado(data);
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.title || 'Error al calcular plazos. Verifique los datos.');
    } finally {
      setCargando(false);
    }
  }

  // Obtener el icono de la rama seleccionada
  const RamaIcon = RAMAS_DERECHO.find(r => r.value === ramaDerecho)?.icon || Scale;

  return (
    <div className="min-h-screen bg-[#0b1120] text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20">
            <Calendar className="w-7 h-7 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Calculadora de Plazos Procesales</h1>
            <p className="text-slate-400 text-sm">Cómputo exacto según CPC, NCPP, NLPT y LPAG</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulario */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
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
              {/* Rama del Derecho */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Rama del Derecho</label>
                <div className="grid grid-cols-2 gap-2">
                  {RAMAS_DERECHO.map(rama => (
                    <button
                      key={rama.value}
                      type="button"
                      onClick={() => setRamaDerecho(rama.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all ${
                        ramaDerecho === rama.value
                          ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                          : 'bg-slate-700/50 border border-slate-600/50 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      <rama.icon className="w-4 h-4" />
                      {rama.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipo de Acto */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Acto Procesal</label>
                <select
                  value={tipoActo}
                  onChange={e => setTipoActo(e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500/50"
                  required
                >
                  <option value="">Seleccionar acto...</option>
                  {TIPOS_ACTO.map(acto => (
                    <option key={acto.value} value={acto.value}>{acto.label}</option>
                  ))}
                </select>
              </div>

              {/* Tipo de Proceso */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Proceso</label>
                <select
                  value={tipoProceso}
                  onChange={e => setTipoProceso(e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500/50"
                >
                  {TIPOS_PROCESO.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Fecha de Notificación */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Fecha de Notificación</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="date"
                    value={fechaNotificacion}
                    onChange={e => setFechaNotificacion(e.target.value)}
                    className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-amber-500/50"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={cargando || !tipoActo || !ramaDerecho}
                className="w-full py-3 rounded-xl font-medium transition-all bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {cargando ? (
                  <>Calculando...</>
                ) : (
                  <><Calendar className="w-4 h-4" /> Calcular Plazo</>
                )}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Resultado */}
          <div className="space-y-4">
            {resultado ? (
              <>
                {/* Card principal */}
                <div className={`rounded-2xl p-6 border ${
                  resultado.advertencia?.includes('VENCIDO')
                    ? 'bg-red-500/10 border-red-500/30'
                    : resultado.esUrgente
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-emerald-500/10 border-emerald-500/30'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Resultado</h2>
                    {resultado.esUrgente ? (
                      <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">URGENTE</span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">EN PLAZO</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-slate-700/30 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">Notificación</p>
                      <p className="font-medium">{new Date(resultado.fechaNotificacion).toLocaleDateString('es-PE')}</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">Vencimiento</p>
                      <p className="font-medium">{new Date(resultado.fechaVencimiento).toLocaleDateString('es-PE')}</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">Días Hábiles</p>
                      <p className="font-medium text-amber-400">{resultado.diasHabiles}</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">Días Corridos</p>
                      <p className="font-medium text-slate-300">{resultado.diasCorridos}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-700/30 text-sm text-slate-300">
                    <p className="text-xs text-slate-500 mb-1">Fundamento Legal</p>
                    <p>{resultado.fundamentoLegal}</p>
                  </div>

                  <div className="mt-3 p-3 rounded-xl bg-slate-700/30 text-sm flex items-start gap-2">
                    <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      resultado.advertencia?.includes('VENCIDO') ? 'text-red-400' :
                      resultado.esUrgente ? 'text-amber-400' : 'text-emerald-400'
                    }`} />
                    <span className="text-slate-300">{resultado.advertencia}</span>
                  </div>
                </div>

                {/* Hitos procesales */}
                {resultado.hitos?.length > 0 && (
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
                      Hitos Procesales
                    </h3>
                    <div className="space-y-3">
                      {resultado.hitos.map((hito, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className={`mt-1 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                            hito.esObligatorio
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-slate-700/50 text-slate-500'
                          }`}>
                            <ChevronRight className="w-3 h-3" />
                          </div>
                          <div>
                            <p className={`text-sm ${hito.esObligatorio ? 'text-white font-medium' : 'text-slate-400'}`}>
                              {hito.descripcion}
                            </p>
                            <p className="text-xs text-slate-500">
                              {new Date(hito.fecha).toLocaleDateString('es-PE', {
                                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Estado vacío */
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                <Calendar className="w-12 h-12 text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-400 mb-2">Calcule un plazo procesal</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Seleccione la rama del derecho, el tipo de acto procesal y la fecha de notificación para obtener el cómputo exacto según la legislación peruana.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tabla de referencia rápida */}
        <div className="mt-8 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Referencia Rápida — Plazos Legales Peruanos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { rama: 'Penal', acto: 'Apelar sentencia', plazo: '5 días', base: 'NCPP art. 414' },
              { rama: 'Civil', acto: 'Apelar sentencia', plazo: '15 días (ordinario)', base: 'CPC art. 373' },
              { rama: 'Civil', acto: 'Contestar demanda', plazo: '30 días', base: 'CPC art. 478' },
              { rama: 'Civil', acto: 'Contestar demanda (sumarísimo)', plazo: '5 días', base: 'CPC art. 554' },
              { rama: 'Laboral', acto: 'Apelar sentencia', plazo: '5 días', base: 'NLPT art. 32' },
              { rama: 'Laboral', acto: 'Contestar demanda', plazo: '10 días', base: 'NLPT art. 22' },
              { rama: 'Constitucional', acto: 'Apelar hábeas corpus', plazo: '2 días', base: 'CPConst. art. 57' },
              { rama: 'Administrativo', acto: 'Recursos', plazo: '15 días', base: 'LPAG art. 218' },
              { rama: 'Penal', acto: 'Apelar auto', plazo: '3 días', base: 'NCPP art. 414' },
              { rama: 'Civil', acto: 'Aclarar sentencia', plazo: '3 días', base: 'CPC art. 406' },
              { rama: 'Penal', acto: 'Ofrecer prueba', plazo: '10 días', base: 'NCPP art. 352' },
              { rama: 'Penal', acto: 'Casación', plazo: '5 días', base: 'NCPP art. 432' },
            ].map((ref, i) => (
              <div key={i} className="bg-slate-700/30 rounded-xl p-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    ref.rama === 'Penal' ? 'bg-red-500/20 text-red-400' :
                    ref.rama === 'Civil' ? 'bg-blue-500/20 text-blue-400' :
                    ref.rama === 'Laboral' ? 'bg-emerald-500/20 text-emerald-400' :
                    ref.rama === 'Constitucional' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>{ref.rama}</span>
                  <span className="text-xs text-slate-500">{ref.base}</span>
                </div>
                <p className="text-slate-300">{ref.acto}</p>
                <p className="text-amber-400 font-medium text-xs mt-1">{ref.plazo}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
