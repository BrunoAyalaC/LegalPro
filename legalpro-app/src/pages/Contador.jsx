import { useState, useMemo } from 'react';
import {
  Calculator, FileText, DollarSign, TrendingUp,
  AlertTriangle, CheckCircle, Briefcase, Calendar, User,
  Sparkles, FileSpreadsheet, BookOpen, Info, ChevronRight,
} from 'lucide-react';
import { dotnetClient } from '../api/client';

const MOTIVOS_CESE = [
  { value: 'despido_arbitrario', label: 'Despido Arbitrario (D.Leg. 728 art. 38)' },
  { value: 'renuncia',           label: 'Renuncia Voluntaria' },
  { value: 'mutuo_acuerdo',      label: 'Mutuo Disenso / Acuerdo Mutuo' },
  { value: 'no_renovacion',      label: 'Vencimiento de Contrato / No Renovación' },
  { value: 'despido_nulo',       label: 'Despido Nulo (reincorporación + remuneraciones)' },
  { value: 'jubilacion',         label: 'Jubilación' },
];

const TIPOS_PERICIA = [
  { value: 'laboral',          label: 'Laboral' },
  { value: 'societario',       label: 'Societario' },
  { value: 'tributario',       label: 'Tributario' },
  { value: 'bancario',         label: 'Bancario / Financiero' },
  { value: 'patrimonial',      label: 'Patrimonial' },
  { value: 'danos_perjuicios', label: 'Daños y Perjuicios' },
];

const fmtSoles = (n) =>
  `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtFecha = (f) => {
  if (!f) return '—';
  const d = typeof f === 'string' ? new Date(f) : f;
  if (Number.isNaN(d?.getTime?.())) return '—';
  return d.toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' });
};

export default function Contador() {
  const [tab, setTab] = useState('liquidacion'); // 'liquidacion' | 'informe'

  // ── Estado Liquidación ────────────────────────────────────────────────────
  const [form, setForm] = useState({
    empleado:           '',
    fechaIngreso:       '',
    fechaCese:          '',
    remuneracionBasica: '',
    asignacionFamiliar: false,
    horasExtras:        '',
    comisiones:         '',
    bonificaciones:     '',
    motivoCese:         'despido_arbitrario',
  });
  const [cargando, setCargando]   = useState(false);
  const [error,    setError]      = useState('');
  const [resultado, setResultado] = useState(null);

  // ── Estado Informe Pericial ───────────────────────────────────────────────
  const [informe, setInforme] = useState({
    tipoPericia: 'laboral',
    objeto:      '',
    hallazgos:   '',
    monto:       '',
  });
  const [informeCargando, setInformeCargando] = useState(false);
  const [informeError,    setInformeError]    = useState('');
  const [informeResultado, setInformeResultado] = useState(null);

  const updateForm = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  // ── Cálculos derivados en el cliente (referencia rápida) ──────────────────
  const refLocal = useMemo(() => {
    const sueldo  = parseFloat(form.remuneracionBasica) || 0;
    const meses   = mesesEntre(form.fechaIngreso, form.fechaCese);
    const anios   = Math.floor(meses / 12);
    const asign   = form.asignacionFamiliar ? 102.50 : 0;
    const cts     = ((sueldo + asign) / 360) * meses;
    const gratif  = ((sueldo + asign) / 360) * 6;
    const vacaciones = ((sueldo + asign) / 360) * Math.min(meses, 30);
    return { meses, anios, asign, cts, gratif, vacaciones, sueldoTotal: sueldo + asign };
  }, [form]);

  async function handleCalcular(e) {
    e.preventDefault();
    setCargando(true);
    setError('');
    setResultado(null);

    const datosEmpleado = {
      empleado:           form.empleado,
      fechaIngreso:       form.fechaIngreso,
      fechaCese:          form.fechaCese,
      sueldoBase:         parseFloat(form.remuneracionBasica) || 0,
      asignacionFamiliar: form.asignacionFamiliar ? 102.50 : 0,
      horasExtra:         parseFloat(form.horasExtras) || 0,
      comisiones:         parseFloat(form.comisiones) || 0,
      bonos:              parseFloat(form.bonificaciones) || 0,
      motivoCese:         form.motivoCese,
    };

    try {
      const { data } = await dotnetClient.post('/api/contador/liquidacion-laboral', {
        DatosEmpleadoJson: JSON.stringify(datosEmpleado),
        MotivoCese:        form.motivoCese,
      });
      // El backend envuelve en ApiResponse<T> — extraer data.data si existe
      const payload = data?.data ?? data?.result ?? data;
      setResultado(payload);
    } catch (err) {
      setError(
        err?.response?.data?.error
        || err?.response?.data?.title
        || err?.response?.data?.message
        || 'Error al calcular la liquidación. Verifique los datos e intente nuevamente.'
      );
    } finally {
      setCargando(false);
    }
  }

  async function handleGenerarInforme(e) {
    e.preventDefault();
    setInformeCargando(true);
    setInformeError('');
    setInformeResultado(null);

    const hallazgos = {
      tipoPericia: informe.tipoPericia,
      objeto:      informe.objeto,
      hallazgos:   informe.hallazgos,
      monto:       parseFloat(informe.monto) || 0,
    };

    try {
      const { data } = await dotnetClient.post('/api/contador/informe-pericial', {
        TipoPericia:   informe.tipoPericia,
        HallazgosJson: JSON.stringify(hallazgos),
      });
      const payload = data?.data ?? data?.result ?? data;
      setInformeResultado(payload);
    } catch (err) {
      setInformeError(
        err?.response?.data?.error
        || err?.response?.data?.title
        || err?.response?.data?.message
        || 'Error al generar el informe pericial.'
      );
    } finally {
      setInformeCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20">
            <Calculator className="w-7 h-7 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Contador Laboral Peruano
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                PERÚ
              </span>
            </h1>
            <p className="text-slate-400 text-sm">
              Cálculo de CTS, gratificaciones, vacaciones truncas, indemnización e informes periciales contables.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-slate-800/40 border border-slate-700/50 rounded-xl p-1 w-fit">
          <TabButton
            active={tab === 'liquidacion'}
            onClick={() => setTab('liquidacion')}
            icon={DollarSign}
            label="Liquidación Laboral"
          />
          <TabButton
            active={tab === 'informe'}
            onClick={() => setTab('informe')}
            icon={FileText}
            label="Informe Pericial"
          />
        </div>

        {tab === 'liquidacion' ? (
          <LiquidacionTab
            form={form}
            updateForm={updateForm}
            refLocal={refLocal}
            cargando={cargando}
            error={error}
            resultado={resultado}
            onSubmit={handleCalcular}
          />
        ) : (
          <InformeTab
            informe={informe}
            setInforme={setInforme}
            cargando={informeCargando}
            error={informeError}
            resultado={informeResultado}
            onSubmit={handleGenerarInforme}
          />
        )}
      </div>
    </div>
  );
}

// ═══ Subcomponentes ═══════════════════════════════════════════════════════

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 border border-transparent'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

const inputCls =
  'w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white ' +
  'placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30';

function LiquidacionTab({ form, updateForm, refLocal, cargando, error, resultado, onSubmit }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Formulario ── */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-emerald-400" />
          Datos del Trabajador
        </h2>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Nombre del Empleado">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                required
                value={form.empleado}
                onChange={(e) => updateForm('empleado', e.target.value)}
                placeholder="Ej: Juan Pérez García"
                className={`${inputCls} pl-10`}
              />
            </div>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Fecha de Ingreso">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="date"
                  required
                  value={form.fechaIngreso}
                  onChange={(e) => updateForm('fechaIngreso', e.target.value)}
                  className={`${inputCls} pl-10`}
                />
              </div>
            </Field>
            <Field label="Fecha de Cese">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="date"
                  required
                  value={form.fechaCese}
                  onChange={(e) => updateForm('fechaCese', e.target.value)}
                  className={`${inputCls} pl-10`}
                />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Remuneración Básica (S/)" hint="Sueldo bruto mensual">
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.remuneracionBasica}
                  onChange={(e) => updateForm('remuneracionBasica', e.target.value)}
                  placeholder="2500.00"
                  className={`${inputCls} pl-10`}
                />
              </div>
            </Field>

            <Field label="Motivo de Cese">
              <select
                value={form.motivoCese}
                onChange={(e) => updateForm('motivoCese', e.target.value)}
                className={inputCls}
              >
                {MOTIVOS_CESE.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/30 border border-slate-600/40 cursor-pointer hover:border-emerald-500/40 transition-colors">
            <input
              type="checkbox"
              checked={form.asignacionFamiliar}
              onChange={(e) => updateForm('asignacionFamiliar', e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-500"
            />
            <div>
              <p className="text-sm font-medium text-slate-200">Asignación Familiar</p>
              <p className="text-xs text-slate-500">S/ 102.50 si tiene hijos menores o cónyuge</p>
            </div>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Horas Extras (S/)" hint="Total mensual promedio">
              <input
                type="number" step="0.01" min="0"
                value={form.horasExtras}
                onChange={(e) => updateForm('horasExtras', e.target.value)}
                placeholder="0.00" className={inputCls}
              />
            </Field>
            <Field label="Comisiones (S/)">
              <input
                type="number" step="0.01" min="0"
                value={form.comisiones}
                onChange={(e) => updateForm('comisiones', e.target.value)}
                placeholder="0.00" className={inputCls}
              />
            </Field>
            <Field label="Bonificaciones (S/)">
              <input
                type="number" step="0.01" min="0"
                value={form.bonificaciones}
                onChange={(e) => updateForm('bonificaciones', e.target.value)}
                placeholder="0.00" className={inputCls}
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3 rounded-xl font-medium transition-all
                       bg-gradient-to-r from-emerald-500 to-emerald-600
                       hover:from-emerald-400 hover:to-emerald-500
                       text-black disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            {cargando ? (
              <>
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Calculando con IA...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Calcular Liquidación
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Referencia rápida */}
        <div className="mt-5 pt-5 border-t border-slate-700/50">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1">
            <Info className="w-3 h-3" /> Pre-cálculo referencial (cliente)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <RefCell label="Tiempo" value={`${refLocal.anios}a ${refLocal.meses % 12}m`} />
            <RefCell label="CTS ref." value={fmtSoles(refLocal.cts)} />
            <RefCell label="Gratif. ref." value={fmtSoles(refLocal.gratif)} />
            <RefCell label="Vac. truncas" value={fmtSoles(refLocal.vacaciones)} />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            * Cálculo referencial. El valor oficial lo determina el backend con todos los beneficios sociales.
          </p>
        </div>
      </div>

      {/* ── Resultado ── */}
      <div className="space-y-4">
        {resultado ? (
          <ResultadoLiquidacion resultado={resultado} />
        ) : (
          <EmptyState
            icon={FileSpreadsheet}
            title="Calcule la liquidación"
            description="Complete los datos del trabajador (sueldo, fechas, motivo de cese) y presione «Calcular Liquidación» para obtener el desglose de CTS, gratificaciones, vacaciones truncas, indemnización por despido arbitrario y descuentos de ley (AFP/ONP)."
          />
        )}
      </div>
    </div>
  );
}

function RefCell({ label, value }) {
  return (
    <div className="bg-slate-700/30 rounded-lg p-2">
      <p className="text-slate-500 text-[10px] uppercase tracking-wide">{label}</p>
      <p className="text-emerald-300 font-bold text-sm">{value}</p>
    </div>
  );
}

function ResultadoLiquidacion({ resultado }) {
  const conceptos = Array.isArray(resultado?.conceptos) ? resultado.conceptos : [];
  return (
    <>
      {/* Card principal */}
      <div className="rounded-2xl p-6 border bg-emerald-500/10 border-emerald-500/30">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            Liquidación Calculada
          </h2>
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium">
            {resultado?.motivoCese?.replaceAll('_', ' ').toUpperCase() || '—'}
          </span>
        </div>

        {/* Datos del empleado */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Cell label="Empleado" value={resultado?.empleado || '—'} />
          <Cell label="Período" value={`${fmtFecha(resultado?.fechaIngreso)} → ${fmtFecha(resultado?.fechaCese)}`} />
          <Cell label="Años de Servicio" value={`${resultado?.aniosServicio ?? '—'} a ${resultado?.mesesServicio ?? '—'} m`} />
          <Cell label="Sueldo Base" value={fmtSoles(resultado?.sueldoBase)} />
        </div>

        {/* Totales */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-700/50">
            <p className="text-xs text-slate-400 mb-1">Total Bruto</p>
            <p className="font-bold text-lg text-white">{fmtSoles(resultado?.totalBruto)}</p>
          </div>
          <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-700/50">
            <p className="text-xs text-slate-400 mb-1">Descuentos</p>
            <p className="font-bold text-lg text-red-400">
              - {fmtSoles((resultado?.descuentoAfp || 0) + (resultado?.descuentoOnp || 0))}
            </p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl p-3 border border-emerald-500/40">
            <p className="text-xs text-emerald-300 mb-1">Total Neto</p>
            <p className="font-bold text-lg text-emerald-300">{fmtSoles(resultado?.totalNeto)}</p>
          </div>
        </div>

        {resultado?.advertenciasLegales && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-200 flex items-start gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-xs uppercase tracking-wide mb-1">Advertencias legales</p>
              {resultado.advertenciasLegales}
            </div>
          </div>
        )}
      </div>

      {/* Desglose */}
      {conceptos.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Desglose de Conceptos
          </h3>
          <div className="space-y-3">
            {conceptos.map((c, i) => (
              <div key={i} className="bg-slate-700/30 rounded-xl p-3 border border-slate-600/30">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="font-semibold text-white text-sm">{c.concepto}</p>
                  <p className="font-bold text-emerald-300 whitespace-nowrap">{fmtSoles(c.montoCalculado)}</p>
                </div>
                {c.baseCalculo && (
                  <p className="text-xs text-slate-400 mb-1">
                    <span className="text-slate-500">Cálculo:</span> {c.baseCalculo}
                  </p>
                )}
                {c.fundamentoLegal && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> {c.fundamentoLegal}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recomendación del perito */}
      {resultado?.recomendacionPeritoContable && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Recomendación del Perito Contable
          </h3>
          <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
            {resultado.recomendacionPeritoContable}
          </p>
        </div>
      )}
    </>
  );
}

function Cell({ label, value }) {
  return (
    <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-700/50">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-medium text-white truncate">{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center min-h-[300px]">
      <Icon className="w-12 h-12 text-slate-600 mb-4" />
      <h3 className="text-lg font-medium text-slate-400 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm">{description}</p>
    </div>
  );
}

// ═══ Informe Pericial ═════════════════════════════════════════════════════

function InformeTab({ informe, setInforme, cargando, error, resultado, onSubmit }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-400" />
          Informe Pericial Contable
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Estructura oficial del Poder Judicial peruano · Conforme al Reglamento de Peritos Judiciales.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Tipo de Pericia">
            <select
              value={informe.tipoPericia}
              onChange={(e) => setInforme({ ...informe, tipoPericia: e.target.value })}
              className={inputCls}
            >
              {TIPOS_PERICIA.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Objeto de la Pericia" hint="Qué se pretende esclarecer con la pericia contable">
            <textarea
              required
              rows={3}
              value={informe.objeto}
              onChange={(e) => setInforme({ ...informe, objeto: e.target.value })}
              placeholder="Ej: Determinar la existencia de créditos impagos laborales entre las partes..."
              className={`${inputCls} resize-none`}
            />
          </Field>

          <Field label="Hallazgos Contables / Financieros" hint="Datos, cifras, documentos y antecedentes encontrados">
            <textarea
              required
              rows={6}
              value={informe.hallazgos}
              onChange={(e) => setInforme({ ...informe, hallazgos: e.target.value })}
              placeholder="Detalle los hallazgos: planillas, recibos, contratos, asientos contables, etc."
              className={`${inputCls} resize-none`}
            />
          </Field>

          <Field label="Monto en Controversia (S/)" hint="Opcional · 0 si no aplica">
            <input
              type="number" step="0.01" min="0"
              value={informe.monto}
              onChange={(e) => setInforme({ ...informe, monto: e.target.value })}
              placeholder="0.00" className={inputCls}
            />
          </Field>

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3 rounded-xl font-medium transition-all
                       bg-gradient-to-r from-emerald-500 to-emerald-600
                       hover:from-emerald-400 hover:to-emerald-500
                       text-black disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            {cargando ? (
              <>
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Generando informe con IA...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" /> Generar Informe Pericial
              </>
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

      {/* Resultado / placeholder */}
      <div className="space-y-4">
        {resultado ? (
          <ResultadoInforme resultado={resultado} />
        ) : (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center min-h-[300px]">
            <FileText className="w-12 h-12 text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-400 mb-2">Informe Pericial</h3>
            <p className="text-sm text-slate-500 max-w-sm mb-4">
              Complete el tipo de pericia, objeto y hallazgos contables para generar un informe con
              conclusiones numeradas, sustento normativo y anexos sugeridos.
            </p>
            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs font-medium border border-amber-500/30">
              Genera un informe pericial contable con sustento normativo peruano
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultadoInforme({ resultado }) {
  const conclusiones = Array.isArray(resultado?.conclusiones) ? resultado.conclusiones : [];
  const anexos = Array.isArray(resultado?.anexosSugeridos) ? resultado.anexosSugeridos : [];
  return (
    <>
      <div className="rounded-2xl p-6 border bg-emerald-500/10 border-emerald-500/30">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            Informe Pericial Generado
          </h2>
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium">
            {fmtFecha(resultado?.generadoEn)}
          </span>
        </div>

        {resultado?.objetoPericia && (
          <Section title="Objeto de la Pericia" body={resultado.objetoPericia} />
        )}
        {resultado?.metodologia && (
          <Section title="Metodología" body={resultado.metodologia} />
        )}
        {resultado?.analisis && (
          <Section title="Análisis" body={resultado.analisis} />
        )}

        {Number(resultado?.montoTotal) > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between">
            <span className="text-sm text-emerald-200 font-medium">Monto Total Determinado</span>
            <span className="font-bold text-emerald-300 text-lg">{fmtSoles(resultado.montoTotal)}</span>
          </div>
        )}
      </div>

      {conclusiones.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
            <ChevronRight className="w-4 h-4" />
            Conclusiones Numeradas
          </h3>
          <ol className="space-y-3">
            {conclusiones.map((c) => (
              <li key={c.numero} className="bg-slate-700/30 rounded-xl p-3 border border-slate-600/30">
                <div className="flex items-start gap-3">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-sm">
                    {c.numero}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-white">{c.conclusion}</p>
                    {c.sustento && (
                      <p className="text-xs text-slate-400 mt-1 flex items-start gap-1">
                        <BookOpen className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        {c.sustento}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {resultado?.observaciones && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Observaciones</h3>
          <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{resultado.observaciones}</p>
        </div>
      )}

      {anexos.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Anexos Sugeridos</h3>
          <ul className="space-y-1.5">
            {anexos.map((a, i) => (
              <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                <ChevronRight className="w-4 h-4 mt-0.5 text-emerald-400 flex-shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function Section({ title, body }) {
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300 mb-1">{title}</p>
      <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{body}</p>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function mesesEntre(desde, hasta) {
  if (!desde || !hasta) return 0;
  const d = new Date(desde);
  const h = new Date(hasta);
  if (Number.isNaN(d.getTime()) || Number.isNaN(h.getTime())) return 0;
  const months = (h.getFullYear() - d.getFullYear()) * 12 + (h.getMonth() - d.getMonth());
  return Math.max(0, months);
}
