/**
 * Facturacion.jsx — /facturacion
 *
 * Facturación de Honorarios multi-tenant (recibos RHE-YYYY-NNNN):
 *   - Form nuevo recibo con vista previa en vivo del cálculo IGV 18% / total.
 *   - Lista de recibos con badge de estado y acciones [Ver PDF] / [Marcar pagado].
 *   - Resumen del mes: total facturado e IGV por pagar.
 *
 * Endpoints (server/routes/facturacion.js):
 *   GET   /api/facturacion              [{ id, numero, cliente_nombre, concepto,
 *                                          monto_base, igv, total, fecha_emision, estado }]
 *   POST  /api/facturacion              { cliente_nombre, cliente_ruc?, concepto,
 *                                          monto_base, expediente_id? }
 *   PATCH /api/facturacion/:id/estado   { estado }
 *   GET   /api/facturacion/:id/pdf      → HTML imprimible (nueva pestaña + window.print())
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ReceiptText, Plus, FileDown, CheckCircle2, Coins, Landmark, Loader2 } from 'lucide-react';
import { nodeClient } from '../api/client';
import { useSeo } from '../hooks/useSeo';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const IGV_RATE = 0.18;
const round2 = (n) => Math.round(n * 100) / 100;

/** 1234.5 → "1,234.50" */
const fmtSoles = (n) =>
  Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Base URL del backend Node para abrir el PDF en pestaña nueva.
 *  '' → relativo (Vite proxy en dev / mismo origen en prod). La cookie httpOnly
 *  de sesión viaja en la navegación top-level GET (SameSite=Lax) y authMiddleware
 *  la acepta como fallback del header Bearer. */
const NODE_BASE = import.meta.env.VITE_NODE_API_URL || '';

const ESTADO_BADGE = {
  emitido: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  pagado: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  anulado: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

/* ── Componente ───────────────────────────────────────────────────────────── */

export default function Facturacion() {
  useSeo({
    title: 'Facturación de Honorarios | LegalPro',
    description: 'Emite recibos por honorarios electrónicos con IGV desglosado.',
  });

  // ── Datos ──
  const [recibos, setRecibos] = useState([]);
  const [expedientes, setExpedientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // ── Form nuevo recibo ──
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteRuc, setClienteRuc] = useState('');
  const [concepto, setConcepto] = useState('');
  const [montoBase, setMontoBase] = useState('');
  const [expedienteId, setExpedienteId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formOk, setFormOk] = useState(null);

  /* ── Carga de recibos ── */
  const cargarRecibos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await nodeClient.get('/api/facturacion');
      setRecibos(Array.isArray(r.data?.data) ? r.data.data : []);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Error al cargar recibos');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarRecibos(); }, [cargarRecibos]);

  // Expedientes para el select opcional (una sola vez, patrón ControlHoras)
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

  /* ── Vista previa en vivo del cálculo ── */
  const montoNum = Number(montoBase);
  const previewValido = Number.isFinite(montoNum) && montoNum >= 1 && montoNum <= 1000000;
  const previewIgv = previewValido ? round2(montoNum * IGV_RATE) : 0;
  const previewTotal = previewValido ? round2(montoNum + previewIgv) : 0;

  /* ── Crear recibo ── */
  const crearRecibo = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormOk(null);

    if (clienteNombre.trim().length < 3) return setFormError('Nombre del cliente: mínimo 3 caracteres.');
    if (clienteRuc && !/^(10|20)\d{9}$/.test(clienteRuc.trim())) {
      return setFormError('RUC inválido: debe tener 11 dígitos e iniciar en 10 o 20.');
    }
    if (concepto.trim().length < 5) return setFormError('Concepto: mínimo 5 caracteres.');
    if (!previewValido) return setFormError('Monto base debe estar entre S/ 1.00 y S/ 1,000,000.00.');

    setGuardando(true);
    try {
      const { data } = await nodeClient.post('/api/facturacion', {
        cliente_nombre: clienteNombre.trim(),
        cliente_ruc: clienteRuc.trim() || undefined,
        concepto: concepto.trim(),
        monto_base: montoNum,
        expediente_id: expedienteId || undefined,
      });
      setFormOk(`Recibo ${data?.data?.numero} emitido por S/ ${fmtSoles(data?.data?.total)}`);
      setClienteNombre('');
      setClienteRuc('');
      setConcepto('');
      setMontoBase('');
      setExpedienteId('');
      await cargarRecibos();
    } catch (err) {
      const det = err.response?.data?.details?.map((d) => d.message).join('. ');
      setFormError(err.response?.data?.error === 'Datos de entrada inválidos.'
        ? det || 'Datos inválidos.'
        : err.response?.data?.error || err.message || 'Error al emitir el recibo');
    } finally {
      setGuardando(false);
    }
  };

  /* ── Acciones de lista ── */
  const marcarPagado = async (id) => {
    try {
      await nodeClient.patch(`/api/facturacion/${id}/estado`, { estado: 'pagado' });
      await cargarRecibos();
    } catch (err) {
      alert('Error al actualizar: ' + (err.response?.data?.error || err.message));
    }
  };

  const verPdf = (id) => {
    window.open(`${NODE_BASE}/api/facturacion/${id}/pdf`, '_blank', 'noopener');
  };

  /* ── Resumen del mes (desde la lista ya cargada) ── */
  const resumenMes = useMemo(() => {
    const mes = mesActual();
    let facturado = 0;
    let igvPorPagar = 0;
    for (const r of recibos) {
      if (!r.fecha_emision?.startsWith(mes) || r.estado === 'anulado') continue;
      facturado += Number(r.total ?? 0);
      if (r.estado === 'emitido') igvPorPagar += Number(r.igv ?? 0);
    }
    return { facturado: round2(facturado), igvPorPagar: round2(igvPorPagar) };
  }, [recibos]);

  /* ── Render ── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-4 lg:p-6 max-w-5xl mx-auto pb-24 lg:pb-8 space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-extrabold text-white flex items-center gap-2">
          <ReceiptText size={24} className="text-emerald-400" /> Facturación de Honorarios
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Recibos electrónicos RHE con IGV 18% desglosado
        </p>
      </div>

      {/* Resumen del mes */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <Coins size={22} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Facturado este mes</p>
            <p className="text-2xl font-extrabold text-white tabular-nums">
              S/ {fmtSoles(resumenMes.facturado)}
            </p>
          </div>
        </div>
        <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
            <Landmark size={22} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">IGV por pagar</p>
            <p className="text-2xl font-extrabold text-white tabular-nums">
              S/ {fmtSoles(resumenMes.igvPorPagar)}
            </p>
          </div>
        </div>
      </section>

      {/* Form nuevo recibo */}
      <section className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-5 lg:p-6">
        <h2 className="font-bold text-white mb-4 flex items-center gap-2">
          <Plus size={18} className="text-emerald-400" /> Nuevo recibo
        </h2>
        <form onSubmit={crearRecibo} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="fac-nombre" className="block text-xs font-medium text-slate-300 mb-1">Cliente *</label>
            <input
              id="fac-nombre"
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              maxLength={200}
              placeholder="Ej: Constructora Andina S.A.C."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
            />
          </div>
          <div>
            <label htmlFor="fac-ruc" className="block text-xs font-medium text-slate-300 mb-1">RUC (opcional)</label>
            <input
              id="fac-ruc"
              value={clienteRuc}
              onChange={(e) => setClienteRuc(e.target.value.replace(/\D/g, '').slice(0, 11))}
              inputMode="numeric"
              placeholder="10 o 20 + 9 dígitos"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="fac-concepto" className="block text-xs font-medium text-slate-300 mb-1">Concepto *</label>
            <input
              id="fac-concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              maxLength={500}
              placeholder="Ej: Asesoría legal permanente — marzo 2026"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
            />
          </div>
          <div>
            <label htmlFor="fac-monto" className="block text-xs font-medium text-slate-300 mb-1">Monto base (S/) *</label>
            <input
              id="fac-monto"
              type="number"
              min={1}
              max={1000000}
              step="0.01"
              value={montoBase}
              onChange={(e) => setMontoBase(e.target.value)}
              placeholder="0.00"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
            />
          </div>
          <div>
            <label htmlFor="fac-exp" className="block text-xs font-medium text-slate-300 mb-1">Expediente (opcional)</label>
            <select
              id="fac-exp"
              value={expedienteId}
              onChange={(e) => setExpedienteId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white min-h-[44px]"
            >
              <option value="">— Sin vincular —</option>
              {expedientes.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.numero ? `${ex.numero} · ` : ''}{ex.titulo}</option>
              ))}
            </select>
          </div>

          {/* Vista previa cálculo en vivo */}
          <div className="sm:col-span-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Base</p>
              <p className="text-sm font-bold text-slate-200 tabular-nums">
                {previewValido ? `S/ ${fmtSoles(montoNum)}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">IGV 18%</p>
              <p className="text-sm font-bold text-amber-400 tabular-nums">
                {previewValido ? `S/ ${fmtSoles(previewIgv)}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Total</p>
              <p className="text-base font-extrabold text-emerald-400 tabular-nums">
                {previewValido ? `S/ ${fmtSoles(previewTotal)}` : '—'}
              </p>
            </div>
          </div>

          {formError && <p role="alert" className="sm:col-span-2 text-xs text-red-400">{formError}</p>}
          {formOk && !formError && (
            <p role="status" className="sm:col-span-2 text-xs text-emerald-400">{formOk}</p>
          )}
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={guardando}
              className="min-h-[44px] px-6 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold inline-flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-colors"
            >
              {guardando ? <Loader2 size={16} className="animate-spin" /> : <ReceiptText size={16} />}
              {guardando ? 'Emitiendo…' : 'Emitir recibo'}
            </button>
          </div>
        </form>
      </section>

      {/* Lista de recibos */}
      <section className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-5">
        <h2 className="font-bold text-white mb-3 flex items-center gap-2">
          <ReceiptText size={18} className="text-blue-400" /> Recibos emitidos
        </h2>

        {cargando ? (
          <p className="text-sm text-slate-400 py-4 text-center">Cargando recibos…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-red-400 py-4 text-center">{error}</p>
        ) : recibos.length === 0 ? (
          <div className="py-8 text-center">
            <ReceiptText size={32} className="mx-auto text-slate-600 mb-2" />
            <p className="text-sm text-slate-400">Aún no hay recibos emitidos.</p>
            <p className="text-xs text-slate-500 mt-1">Emite tu primer recibo con el formulario superior.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {recibos.map((r) => (
              <li key={r.id} className="flex items-start justify-between py-3 gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{r.numero}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${ESTADO_BADGE[r.estado] || ESTADO_BADGE.anulado}`}>
                      {r.estado}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">{r.cliente_nombre} · {r.concepto}</p>
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    {r.fecha_emision} · Base S/ {fmtSoles(r.monto_base)} + IGV S/ {fmtSoles(r.igv)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-extrabold text-emerald-400 tabular-nums hidden sm:block">
                    S/ {fmtSoles(r.total)}
                  </span>
                  <button
                    onClick={() => verPdf(r.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                    aria-label={`Ver PDF del recibo ${r.numero}`}
                    title="Ver PDF"
                  >
                    <FileDown size={16} />
                  </button>
                  {r.estado === 'emitido' && (
                    <button
                      onClick={() => marcarPagado(r.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      aria-label={`Marcar pagado el recibo ${r.numero}`}
                      title="Marcar pagado"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </motion.div>
  );
}
