/**
 * ControlHoras.jsx — /control-horas
 *
 * Control de Horas del abogado (datos propios, multi-tenant vía JWT):
 *   - Timer visual Iniciar/Detener → mini-form para guardar el registro.
 *   - Lista del mes agrupada por expediente con total horas.
 *   - Resumen anual en barras simples (div width%, sin recharts).
 *
 * Endpoints (server/routes/horas.js):
 *   GET    /api/horas?mes=YYYY-MM         [{ expedienteId, titulo, minutos, registros }]
 *   GET    /api/horas/detalle?mes=YYYY-MM [{ id, titulo, descripcion, minutos, fecha }]
 *   POST   /api/horas/registro            { expediente_id, descripcion, minutos, fecha }
 *   DELETE /api/horas/registro/:id
 *   GET    /api/horas/resumen?anio=YYYY   [{ mes, minutos, registros }]
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Timer, Play, Square, Trash2, Clock, CalendarDays, BarChart3, FolderOpen } from 'lucide-react';
import { nodeClient } from '../api/client';
import { useSeo } from '../hooks/useSeo';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mesActual() {
  return hoyISO().slice(0, 7);
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** 547 → "9h 7m" · 45 → "45m" */
function formatHoras(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** segundos → "mm:ss" */
function mmss(segundos) {
  const s = Math.max(0, Math.floor(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const NOMBRE_MES = {
  Ene: 'Enero', Feb: 'Febrero', Mar: 'Marzo', Abr: 'Abril', May: 'Mayo', Jun: 'Junio',
  Jul: 'Julio', Ago: 'Agosto', Sep: 'Septiembre', Oct: 'Octubre', Nov: 'Noviembre', Dic: 'Diciembre',
};

/* ── Componente ───────────────────────────────────────────────────────────── */

export default function ControlHoras() {
  useSeo({
    title: 'Control de Horas | LegalPro',
    description: 'Registra y visualiza las horas trabajadas por expediente.',
  });

  // ── Timer ──
  const [corriendo, setCorriendo] = useState(false);
  const startTimeRef = useRef(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  // ── Mini-form post-detención ──
  const [formAbierto, setFormAbierto] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [expedienteId, setExpedienteId] = useState('');
  const [minutos, setMinutos] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState(null);

  // ── Datos ──
  const [expedientes, setExpedientes] = useState([]);
  const [grupos, setGrupos] = useState([]);      // agrupado por expediente
  const [detalle, setDetalle] = useState([]);    // registros individuales del mes
  const [resumen, setResumen] = useState([]);    // [{ mes: 1..12, minutos }]
  const [mes, setMes] = useState(mesActual());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const anio = useMemo(() => Number(mes.slice(0, 4)), [mes]);
  const nombreMes = useMemo(() => NOMBRE_MES[MESES[Number(mes.slice(5, 7)) - 1]] ?? mes, [mes]);

  /* ── Carga de datos ── */
  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [gRes, dRes, rRes] = await Promise.all([
        nodeClient.get('/api/horas', { params: { mes } }),
        nodeClient.get('/api/horas/detalle', { params: { mes } }),
        nodeClient.get('/api/horas/resumen', { params: { anio } }),
      ]);
      setGrupos(Array.isArray(gRes.data?.data) ? gRes.data.data : []);
      setDetalle(Array.isArray(dRes.data?.data) ? dRes.data.data : []);
      setResumen(Array.isArray(rRes.data?.data) ? rRes.data.data : []);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Error al cargar horas');
    } finally {
      setCargando(false);
    }
  }, [mes, anio]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  // Expedientes para el select (una sola vez)
  useEffect(() => {
    let cancelled = false;
    nodeClient.get('/api/expedientes', { params: { page: 1, pageSize: 100 } })
      .then((r) => {
        if (cancelled) return;
        setExpedientes(r.data?.data?.expedientes ?? r.data?.expedientes ?? []);
      })
      .catch(() => { if (!cancelled) setExpedientes([]); });
    return () => { cancelled = true; };
  }, []);

  /* ── Timer: tick cada 30s (spec) — el total siempre se recalcula al detener ── */
  useEffect(() => {
    if (!corriendo) return undefined;
    const id = setInterval(() => {
      setElapsedSec((Date.now() - startTimeRef.current) / 1000);
    }, 30_000);
    return () => clearInterval(id);
  }, [corriendo]);

  const iniciar = () => {
    startTimeRef.current = Date.now();
    setElapsedSec(0);
    setCorriendo(true);
  };

  const detener = () => {
    const seg = Math.round((Date.now() - startTimeRef.current) / 1000);
    setElapsedSec(seg);
    setCorriendo(false);
    // Minutos prellenados redondeados (mínimo 1)
    setMinutos(String(Math.max(1, Math.round(seg / 60))));
    setFecha(hoyISO());
    setFormError(null);
    setFormAbierto(true);
  };

  const cancelarForm = () => {
    setFormAbierto(false);
    setDescripcion('');
    setExpedienteId('');
    setMinutos('');
    setElapsedSec(0);
  };

  const guardarRegistro = async (e) => {
    e.preventDefault();
    setFormError(null);

    const minNum = Number(minutos);
    if (!expedienteId) return setFormError('Selecciona un expediente.');
    if (!descripcion.trim() || descripcion.trim().length < 3) return setFormError('Descripción mínima de 3 caracteres.');
    if (!Number.isInteger(minNum) || minNum < 1 || minNum > 1440) return setFormError('Minutos debe estar entre 1 y 1440.');

    setGuardando(true);
    try {
      await nodeClient.post('/api/horas/registro', {
        expediente_id: expedienteId,
        descripcion: descripcion.trim(),
        minutos: minNum,
        fecha,
      });
      cancelarForm();
      await cargarDatos();
    } catch (err) {
      setFormError(err.response?.data?.error || err.message || 'Error al guardar el registro');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarRegistro = async (id) => {
    if (!confirm('¿Eliminar este registro de horas?')) return;
    try {
      await nodeClient.delete(`/api/horas/registro/${id}`);
      await cargarDatos();
    } catch (err) {
      alert('Error al eliminar: ' + (err.response?.data?.error || err.message));
    }
  };

  /* ── Derivados ── */
  const totalMes = grupos.reduce((acc, g) => acc + (g.minutos || 0), 0);
  const maxResumen = Math.max(1, ...resumen.map((r) => r.minutos || 0));

  const barrasAnuales = useMemo(
    () => MESES.map((label, i) => {
      const fila = resumen.find((r) => Number(r.mes) === i + 1);
      return { label, mes: i + 1, minutos: fila?.minutos ?? 0, registros: fila?.registros ?? 0 };
    }),
    [resumen]
  );

  /* ── Render ── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-4 lg:p-6 max-w-5xl mx-auto pb-24 lg:pb-8 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-white flex items-center gap-2">
            <Timer size={24} className="text-emerald-400" /> Control de Horas
          </h1>
          <p className="text-sm text-slate-400 mt-1">Registra tu tiempo trabajado por expediente</p>
        </div>
        <input
          type="month"
          value={mes}
          onChange={(e) => e.target.value && setMes(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white min-h-[44px]"
          aria-label="Mes a consultar"
        />
      </div>

      {/* Timer */}
      <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-5 lg:p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Tiempo de la sesión</p>
            <p
              className={`text-4xl lg:text-5xl font-extrabold tabular-nums ${corriendo ? 'text-emerald-400' : 'text-slate-300'}`}
              aria-live="polite"
            >
              {mmss(elapsedSec)}
            </p>
            {corriendo && <p className="text-xs text-emerald-400/70 mt-1 animate-pulse">● grabando…</p>}
          </div>
          {!corriendo && !formAbierto && (
            <button
              onClick={iniciar}
              className="min-h-[48px] px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 transition-colors shadow-lg shadow-emerald-600/25"
            >
              <Play size={18} /> Iniciar
            </button>
          )}
          {corriendo && (
            <button
              onClick={detener}
              className="min-h-[48px] px-6 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-2 transition-colors shadow-lg shadow-red-600/25"
            >
              <Square size={18} /> Detener
            </button>
          )}
        </div>

        {/* Mini-form al detener */}
        {formAbierto && (
          <form onSubmit={guardarRegistro} className="mt-5 pt-5 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="ch-desc" className="block text-xs font-medium text-slate-300 mb-1">Descripción</label>
              <input
                id="ch-desc"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={300}
                placeholder="Ej: Redacción de demanda de alimentos"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="ch-exp" className="block text-xs font-medium text-slate-300 mb-1">Expediente</label>
              <select
                id="ch-exp"
                value={expedienteId}
                onChange={(e) => setExpedienteId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white min-h-[44px]"
              >
                <option value="">— Selecciona —</option>
                {expedientes.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.numero ? `${ex.numero} · ` : ''}{ex.titulo}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ch-min" className="block text-xs font-medium text-slate-300 mb-1">Minutos</label>
                <input
                  id="ch-min"
                  type="number"
                  min={1}
                  max={1440}
                  value={minutos}
                  onChange={(e) => setMinutos(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white min-h-[44px]"
                />
              </div>
              <div>
                <label htmlFor="ch-fecha" className="block text-xs font-medium text-slate-300 mb-1">Fecha</label>
                <input
                  id="ch-fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white min-h-[44px]"
                />
              </div>
            </div>
            {formError && <p className="sm:col-span-2 text-xs text-red-400">{formError}</p>}
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <button
                type="button"
                onClick={cancelarForm}
                className="min-h-[44px] px-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-sm font-semibold"
              >
                Descartar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="min-h-[44px] px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold"
              >
                {guardando ? 'Guardando…' : 'Guardar registro'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Lista del mes agrupada por expediente */}
      <section className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-white flex items-center gap-2">
            <FolderOpen size={18} className="text-blue-400" /> {nombreMes} por expediente
          </h2>
          <span className="text-sm font-bold text-emerald-400 tabular-nums">{formatHoras(totalMes)}</span>
        </div>

        {cargando ? (
          <p className="text-sm text-slate-400 py-4 text-center">Cargando registros…</p>
        ) : error ? (
          <p className="text-sm text-red-400 py-4 text-center">{error}</p>
        ) : grupos.length === 0 ? (
          <div className="py-8 text-center">
            <Clock size={32} className="mx-auto text-slate-600 mb-2" />
            <p className="text-sm text-slate-400">Sin horas registradas en {nombreMes.toLowerCase()}.</p>
            <p className="text-xs text-slate-500 mt-1">Inicia el timer y deténlo al terminar tu tarea.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {grupos.map((g) => (
              <li key={g.expedienteId} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{g.titulo}</p>
                  <p className="text-xs text-slate-500">{g.registros} registro{g.registros !== 1 ? 's' : ''}</p>
                </div>
                <span className="text-sm font-bold text-slate-200 tabular-nums shrink-0">{formatHoras(g.minutos)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Registros individuales del mes (con eliminar) */}
      {!cargando && !error && detalle.length > 0 && (
        <section className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-5">
          <h2 className="font-bold text-white mb-3 flex items-center gap-2">
            <CalendarDays size={18} className="text-violet-400" /> Registros de {nombreMes.toLowerCase()}
          </h2>
          <ul className="divide-y divide-white/5">
            {detalle.map((d) => (
              <li key={d.id} className="flex items-start justify-between py-2.5 gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{d.descripcion}</p>
                  <p className="text-xs text-slate-500 truncate">{d.titulo} · {d.fecha}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-slate-300 tabular-nums">{formatHoras(d.minutos)}</span>
                  <button
                    onClick={() => eliminarRegistro(d.id)}
                    className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    aria-label={`Eliminar registro: ${d.descripcion}`}
                    title="Eliminar registro"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Resumen anual — barras simples div width% */}
      <section className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-5">
        <h2 className="font-bold text-white mb-4 flex items-center gap-2">
          <BarChart3 size={18} className="text-cyan-400" /> Resumen anual {anio}
        </h2>
        {!cargando && resumen.length === 0 ? (
          <div className="py-6 text-center">
            <BarChart3 size={28} className="mx-auto text-slate-600 mb-2" />
            <p className="text-sm text-slate-400">Sin datos para {anio}. Los meses con registros aparecerán aquí.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {barrasAnuales.map((b) => (
              <div key={b.mes} className="flex items-center gap-3">
                <span className="w-8 text-xs text-slate-400 shrink-0">{b.label}</span>
                <div className="flex-1 h-5 bg-white/5 rounded-md overflow-hidden" role="img"
                  aria-label={`${NOMBRE_MES[b.label]}: ${formatHoras(b.minutos)}`}>
                  <div
                    className={`h-full rounded-md transition-all duration-500 ${b.minutos > 0 ? 'bg-linear-to-r from-cyan-600 to-emerald-500' : ''}`}
                    style={{ width: `${Math.max(b.minutos > 0 ? 4 : 0, (b.minutos / maxResumen) * 100)}%` }}
                  />
                </div>
                <span className="w-16 text-right text-xs text-slate-300 tabular-nums shrink-0">
                  {b.minutos > 0 ? formatHoras(b.minutos) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
}
