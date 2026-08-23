import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coins,
  History,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  TrendingUp,
  Zap,
  ChevronRight,
} from 'lucide-react';
import Header from '../components/Header';
import { useUI } from '../context/UIContext';
import { nodeClient } from '../api/client';
import { logger } from '../utils/logger';
import { useSeo } from '../hooks/useSeo';

export default function PanelCreditos() {
  const { toast } = useUI();

  // SEO Dinámico
  useSeo({
    title: 'Mis Créditos y Consumos | LegalPro',
    description: 'Administra tus créditos y gemas de LegalPro. Recarga tu saldo, revisa el historial de transacciones y optimiza el consumo de la IA.',
  });

  // ─── Estados ───────────────────────────────────────────────────────────────
  const [creditos, setCreditos] = useState(0);
  const [planes, setPlanes] = useState([]);
  const [transacciones, setTransacciones] = useState([]);
  const [planSeleccionado, setPlanSeleccionado] = useState(null);
  const [mostrarModalPago, setMostrarModalPago] = useState(false);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [pagoCompletado, setPagoCompletado] = useState(false);
  const [errorPago, setErrorPago] = useState('');

  // Estados de carga
  const [loadingSaldo, setLoadingSaldo] = useState(true);
  const [loadingPlanes, setLoadingPlanes] = useState(true);
  const [loadingTransacciones, setLoadingTransacciones] = useState(true);
  const [errorSaldo, setErrorSaldo] = useState('');
  const [errorPlanes, setErrorPlanes] = useState('');
  const [errorTransacciones, setErrorTransacciones] = useState('');

  // Datos del formulario de pago
  const [numeroTarjeta, setNumeroTarjeta] = useState('');
  const [expiracion, setExpiracion] = useState('');
  const [cvc, setCvc] = useState('');
  const [titular, setTitular] = useState('');

  // ─── Carga inicial de datos ────────────────────────────────────────────────
  const cargarSaldo = useCallback(async (signal) => {
    try {
      const res = await nodeClient.get('/api/organizaciones/me', { signal });
      const org = res.data?.data ?? res.data;
      if (org?.creditosDisponibles != null) setCreditos(org.creditosDisponibles);
    } catch (err) {
      if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;
      logger.error('[PanelCreditos] Error al cargar saldo:', err);
      setErrorSaldo('No se pudo cargar el saldo.');
    } finally {
      if (!signal?.aborted) setLoadingSaldo(false);
    }
  }, []);

  const cargarPlanes = useCallback(async (signal) => {
    try {
      const res = await nodeClient.get('/api/creditos/planes', { signal });
      const data = res.data?.planes ?? res.data?.data ?? [];
      setPlanes(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;
      logger.error('[PanelCreditos] Error al cargar planes:', err);
      setErrorPlanes('No se pudieron cargar los planes de crédito.');
    } finally {
      if (!signal?.aborted) setLoadingPlanes(false);
    }
  }, []);

  const cargarTransacciones = useCallback(async (signal) => {
    try {
      const res = await nodeClient.get('/api/creditos/transacciones', { signal });
      const data = res.data?.transacciones ?? res.data?.data ?? [];
      setTransacciones(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;
      logger.error('[PanelCreditos] Error al cargar transacciones:', err);
      setErrorTransacciones('No se pudo cargar el historial.');
    } finally {
      if (!signal?.aborted) setLoadingTransacciones(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    cargarSaldo(controller.signal);
    cargarPlanes(controller.signal);
    cargarTransacciones(controller.signal);
    return () => controller.abort();
  }, [cargarSaldo, cargarPlanes, cargarTransacciones]);

  // ─── Abrir pasarela de pago ────────────────────────────────────────────────
  const abrirPasarela = (plan) => {
    setPlanSeleccionado(plan);
    setNumeroTarjeta('');
    setExpiracion('');
    setCvc('');
    setTitular('');
    setPagoCompletado(false);
    setErrorPago('');
    setMostrarModalPago(true);
  };

  // ─── Procesar recarga (POST real al backend) ──────────────────────────────
  const handleRecarga = async (e) => {
    e.preventDefault();
    if (!planSeleccionado) return;

    setProcesandoPago(true);
    setErrorPago('');

    try {
      const res = await nodeClient.post('/api/creditos/comprar', {
        planId: planSeleccionado.id,
        metodoPago: 'culqi',
      });

      const data = res.data;
      if (data?.exito) {
        setPagoCompletado(true);
        setCreditos(data.creditosRestantes);

        // Agregar la nueva transacción al inicio del historial
        if (data.transaccion) {
          const hora = data.transaccion.fecha
            ? new Date(data.transaccion.fecha).toLocaleTimeString('es-PE', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              })
            : '';
          const fecha = data.transaccion.fecha
            ? new Date(data.transaccion.fecha).toISOString().split('T')[0]
            : '';

          setTransacciones((prev) => [
            {
              id: data.transaccion.id,
              fecha,
              hora,
              tipo: 'recarga',
              descripcion: data.transaccion.descripcion,
              cantidad: data.creditosAgregados,
              detalle: 'Recarga de Saldo',
            },
            ...prev,
          ]);
        }

        if (toast?.success) {
          toast.success(
            `¡Recarga exitosa! Se han añadido ${data.creditosAgregados} créditos a tu cuenta.`
          );
        }

        // Cerrar modal automáticamente después de 2 segundos
        setTimeout(() => {
          setMostrarModalPago(false);
          setPlanSeleccionado(null);
          setPagoCompletado(false);
        }, 2000);
      } else {
        throw new Error(data?.error || 'Error al procesar la compra.');
      }
    } catch (err) {
      const msg =
        err.response?.data?.error || err.message || 'Error al procesar el pago.';
      setErrorPago(msg);
      if (toast?.error) {
        toast.error(msg);
      }
      setProcesandoPago(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="page-enter flex flex-col h-[calc(100dvh-148px)] lg:h-[calc(100dvh-64px)] overflow-hidden bg-[#0a0a0f] text-slate-100">
      <Header
        title="Gestión de Créditos"
        showBack
        rightAction={
          <span className="badge bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 text-xs font-bold py-1 px-2.5 rounded-full flex items-center gap-1">
            <Coins size={13} className="animate-pulse" /> Facturación IA
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:py-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Fila superior: Tarjeta de Saldo y Resumen de consumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Tarjeta Gigante de Saldo */}
          <div className="md:col-span-2 relative overflow-hidden backdrop-blur-xl bg-gradient-to-br from-indigo-900/40 via-slate-900/60 to-slate-900/40 border border-white/8 rounded-3xl p-6 flex flex-col justify-between shadow-2xl">
            <div className="absolute -top-16 -right-16 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl opacity-60 pointer-events-none" />
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">
                  Saldo de tu Organización
                </span>
                <h1 className="text-3xl lg:text-4xl font-extrabold text-white mt-1 flex items-center gap-2.5">
                  <Coins size={28} className="text-indigo-400" />
                  {loadingSaldo ? (
                    <Loader2 size={24} className="animate-spin text-indigo-400" />
                  ) : (
                    creditos
                  )}
                  <span className="text-xs text-indigo-300 font-semibold px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/20 rounded-md">
                    Gemas/Créditos
                  </span>
                </h1>
                {errorSaldo && (
                  <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle size={10} /> {errorSaldo}
                  </p>
                )}
              </div>
              <div className="p-3 bg-indigo-500/15 border border-indigo-500/20 rounded-2xl">
                <Zap size={22} className="text-indigo-400 animate-pulse" />
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 flex flex-col sm:flex-row justify-between gap-3 text-xs text-slate-400">
              <p>
                Tu organización consume créditos para procesar resúmenes,
                predicciones, análisis y redacción.
              </p>
              <div className="flex items-center gap-1.5 shrink-0 text-emerald-400 font-semibold">
                <TrendingUp size={14} />
                <span>Plan Profesional Activo</span>
              </div>
            </div>
          </div>

          {/* Consumos del Mes */}
          <div className="relative overflow-hidden backdrop-blur-xl bg-slate-900/40 border border-white/5 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Costo Estimado
              </span>
              <p className="text-sm font-semibold text-slate-300 mt-2">
                Consumo Promedio
              </p>
              <p className="text-xs text-slate-500 mt-1">
                1 gema equivale a 1 análisis o chat IA básico en la plataforma.
              </p>
            </div>
            <div className="mt-4 flex items-baseline gap-1 text-slate-200">
              <span className="text-2xl font-black">~15</span>
              <span className="text-xs text-slate-400">gemas / día</span>
            </div>
          </div>
        </div>

        {/* Sección de Recargas */}
        <section aria-labelledby="planes-titulo" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              id="planes-titulo"
              className="text-sm font-bold text-white uppercase tracking-wider text-slate-300"
            >
              Comprar Paquetes de Créditos
            </h2>
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-400" />{' '}
              Transacción encriptada SSL
            </span>
          </div>

          {loadingPlanes ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 size={24} className="animate-spin mr-2" />
              <span className="text-sm">Cargando planes...</span>
            </div>
          ) : errorPlanes ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <AlertCircle size={24} className="text-red-400" />
              <p className="text-sm text-red-400">{errorPlanes}</p>
              <button
                type="button"
                onClick={cargarPlanes}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {planes.map((plan) => (
                <motion.div
                  key={plan.id}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className={`relative overflow-hidden rounded-3xl border ${plan.borderColor} p-6 flex flex-col justify-between h-full bg-linear-to-br ${plan.color} transition-all duration-300 shadow-xl`}
                >
                  {plan.popular && (
                    <span className="absolute top-3 right-3 bg-indigo-500 text-white text-[9px] font-black tracking-widest px-2.5 py-1 rounded-full uppercase shadow-lg">
                      Más Popular
                    </span>
                  )}

                  <div
                    className={`absolute -top-12 -right-12 w-28 h-28 ${plan.glowColor} rounded-full blur-2xl opacity-50`}
                  />

                  <div>
                    <h3 className="text-sm font-extrabold text-white mb-1">
                      {plan.nombre}
                    </h3>
                    <div className="flex items-baseline gap-1 mt-3">
                      <span className="text-3xl font-black text-white">
                        {plan.creditos}
                      </span>
                      <span className="text-xs text-slate-300 font-bold">
                        créditos
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                      Ideal para el procesamiento de escritos de baja o mediana
                      complejidad legal en el Perú.
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                        Precio
                      </span>
                      <span className="text-lg font-black text-white">
                        S/ {plan.precio}
                      </span>
                    </div>
                    <button
                      type="button"
                      id={`btn-recargar-${plan.id}`}
                      onClick={() => abrirPasarela(plan)}
                      className="py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/10 transition-colors flex items-center gap-1"
                    >
                      <span>Comprar</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Planes de Suscripción Mensual */}
        <section aria-labelledby="suscripcion-titulo" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              id="suscripcion-titulo"
              className="text-sm font-bold text-white uppercase tracking-wider text-slate-300"
            >
              Planes de Suscripción Mensual
            </h2>
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-400" /> Sin
              contrato mínimo
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Plan FREE */}
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              className="relative overflow-hidden rounded-3xl border border-white/10 p-6 flex flex-col justify-between h-full bg-linear-to-br from-slate-800/20 to-slate-900/20 transition-all duration-300 shadow-xl"
            >
              <div>
                <h3 className="text-sm font-extrabold text-white mb-1">
                  FREE
                </h3>
                <span className="text-[10px] text-slate-400 font-semibold">
                  Para empezar a explorar
                </span>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-3xl font-black text-white">S/ 0</span>
                  <span className="text-xs text-slate-300 font-bold">
                    /mes
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                  2 consultas por mes. Ideal para probar LexIA sin compromiso.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5">
                <ul className="space-y-2 text-xs text-slate-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                    <span>2 consultas/mes a la IA</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                    <span>Acceso a chat básico</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                    <span>Sin tarjeta requerida</span>
                  </li>
                </ul>
                <button
                  type="button"
                  className="mt-4 w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  Comenzar Gratis
                </button>
              </div>
            </motion.div>

            {/* Plan PRO */}
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              className="relative overflow-hidden rounded-3xl border border-indigo-500/40 p-6 flex flex-col justify-between h-full bg-linear-to-br from-indigo-600/30 via-violet-600/25 to-indigo-500/10 transition-all duration-300 shadow-xl"
            >
              <span className="absolute top-3 right-3 bg-indigo-500 text-white text-[9px] font-black tracking-widest px-2.5 py-1 rounded-full uppercase shadow-lg">
                Más Popular
              </span>
              <div className="absolute -top-12 -right-12 w-28 h-28 bg-indigo-500/20 rounded-full blur-2xl opacity-50" />
              <div>
                <h3 className="text-sm font-extrabold text-white mb-1">
                  PRO
                </h3>
                <span className="text-[10px] text-indigo-300 font-semibold">
                  Para uso profesional continuo
                </span>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-3xl font-black text-white">
                    S/ 99
                  </span>
                  <span className="text-xs text-slate-300 font-bold">
                    /mes
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                  40 consultas por mes. Perfecto para abogados litigantes.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5">
                <ul className="space-y-2 text-xs text-slate-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                    <span>40 consultas/mes a la IA</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                    <span>Todas las herramientas IA</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                    <span>Predictor judicial completo</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                    <span>Soporte prioritario</span>
                  </li>
                </ul>
                <button
                  type="button"
                  className="mt-4 w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition-colors"
                >
                  Elegir PRO
                </button>
              </div>
            </motion.div>

            {/* Plan ESTUDIO */}
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              className="relative overflow-hidden rounded-3xl border border-purple-500/20 hover:border-purple-500/50 p-6 flex flex-col justify-between h-full bg-linear-to-br from-purple-500/20 to-pink-500/10 transition-all duration-300 shadow-xl"
            >
              <div>
                <h3 className="text-sm font-extrabold text-white mb-1">
                  ESTUDIO
                </h3>
                <span className="text-[10px] text-purple-300 font-semibold">
                  Para despachos y equipos
                </span>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-3xl font-black text-white">
                    S/ 299
                  </span>
                  <span className="text-xs text-slate-300 font-bold">
                    /mes
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                  400 consultas por mes. Ideal para estudios jurídicos completos.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5">
                <ul className="space-y-2 text-xs text-slate-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                    <span>400 consultas/mes a la IA</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                    <span>Hasta 10 usuarios del estudio</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                    <span>API access completo</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                    <span>Gerente de cuenta dedicado</span>
                  </li>
                </ul>
                <button
                  type="button"
                  className="mt-4 w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-600/20 transition-colors"
                >
                  Elegir ESTUDIO
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Historial de Transacciones */}
        <section aria-labelledby="historial-titulo" className="space-y-4">
          <div className="flex items-center gap-2">
            <History size={16} className="text-slate-400" />
            <h2
              id="historial-titulo"
              className="text-sm font-bold text-white uppercase tracking-wider text-slate-300"
            >
              Historial de Transacciones
            </h2>
          </div>

          <div className="backdrop-blur-xl bg-slate-900/40 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
            {loadingTransacciones ? (
              <div className="flex items-center justify-center py-10 text-slate-400">
                <Loader2 size={20} className="animate-spin mr-2" />
                <span className="text-xs">Cargando historial...</span>
              </div>
            ) : errorTransacciones ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                <AlertCircle size={20} className="text-red-400" />
                <p className="text-xs text-red-400">{errorTransacciones}</p>
                <button
                  type="button"
                  onClick={cargarTransacciones}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 underline"
                >
                  Reintentar
                </button>
              </div>
            ) : transacciones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-500 gap-2">
                <History size={24} className="opacity-50" />
                <p className="text-xs">Aún no hay transacciones registradas.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-white/2">
                      <th className="py-3 px-5">ID / Fecha</th>
                      <th className="py-3 px-5">Detalle / Servicio</th>
                      <th className="py-3 px-5">Descripción</th>
                      <th className="py-3 px-5 text-right">Monto Créditos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {transacciones.map((tx) => {
                      const esRecarga = tx.tipo === 'recarga';
                      return (
                        <tr
                          key={tx.id}
                          className="text-xs hover:bg-white/2 transition-colors"
                        >
                          <td className="py-4 px-5">
                            <span className="font-mono text-[10px] text-slate-500 block">
                              #{typeof tx.id === 'string' ? tx.id.slice(0, 8) : tx.id}
                            </span>
                            <span className="text-slate-400">
                              {tx.fecha} {tx.hora}
                            </span>
                          </td>
                          <td className="py-4 px-5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold border inline-block
                                ${
                                  esRecarga
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                }`}
                            >
                              {tx.detalle}
                            </span>
                          </td>
                          <td className="py-4 px-5 font-medium text-slate-200">
                            {tx.descripcion}
                          </td>
                          <td
                            className={`py-4 px-5 text-right font-bold text-sm ${
                              esRecarga ? 'text-emerald-400' : 'text-slate-300'
                            }`}
                          >
                            <span className="flex items-center justify-end gap-1">
                              {esRecarga ? (
                                <ArrowUpRight size={13} />
                              ) : (
                                <ArrowDownLeft size={13} />
                              )}
                              {esRecarga ? '+' : ''}
                              {tx.cantidad}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Modal Pasarela de Pago */}
      <AnimatePresence>
        {mostrarModalPago && planSeleccionado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0F172A] border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-6 relative"
            >
              {/* Header Modal */}
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400">
                  <CreditCard size={22} />
                </div>
                <h3 className="text-lg font-bold text-white">
                  Pasarela de Pago Segura
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Estás adquiriendo el{' '}
                  <span className="text-indigo-300 font-bold">
                    {planSeleccionado.nombre}
                  </span>{' '}
                  por{' '}
                  <span className="text-white font-bold">
                    S/ {planSeleccionado.precio}
                  </span>{' '}
                  (Acreditando {planSeleccionado.creditos} gemas).
                </p>
              </div>

              <AnimatePresence mode="wait">
                {procesandoPago ? (
                  <motion.div
                    key="procesando"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-10 flex flex-col items-center justify-center gap-3 text-sm text-slate-400"
                  >
                    <Loader2 className="animate-spin text-indigo-400" size={32} />
                    <p className="animate-pulse">
                      Procesando pago seguro con encriptación bancaria...
                    </p>
                  </motion.div>
                ) : pagoCompletado ? (
                  <motion.div
                    key="exito"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-10 flex flex-col items-center justify-center gap-3 text-sm text-emerald-400 text-center"
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle2 size={32} />
                    </div>
                    <p className="font-bold text-white text-base">
                      ¡Transacción Aprobada!
                    </p>
                    <p className="text-xs text-slate-400">
                      Tus créditos han sido cargados exitosamente.
                    </p>
                  </motion.div>
                ) : (
                  <motion.form
                    key="formulario"
                    onSubmit={handleRecarga}
                    className="space-y-4"
                  >
                    {/* Campos de pago */}
                    {errorPago && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                        <AlertCircle size={14} />
                        <span>{errorPago}</span>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label
                        htmlFor="pago-titular"
                        className="text-[10px] text-slate-400 font-bold uppercase"
                      >
                        Titular de la tarjeta
                      </label>
                      <input
                        type="text"
                        id="pago-titular"
                        required
                        placeholder="Dr. Bruno Ayala"
                        value={titular}
                        onChange={(e) => setTitular(e.target.value)}
                        className="w-full bg-[#050508]/60 border border-white/10 rounded-xl p-3 text-xs placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="pago-numero"
                        className="text-[10px] text-slate-400 font-bold uppercase"
                      >
                        Número de Tarjeta
                      </label>
                      <input
                        type="text"
                        id="pago-numero"
                        required
                        maxLength={19}
                        placeholder="4557 8890 1234 5678"
                        value={numeroTarjeta}
                        onChange={(e) => {
                          const v = e.target.value
                            .replace(/\s+/g, '')
                            .replace(/[^0-9]/gi, '');
                          const matches = v.match(/\d{4,16}/g);
                          const match = (matches && matches[0]) || '';
                          const parts = [];
                          for (let i = 0, len = match.length; i < len; i += 4) {
                            parts.push(match.substring(i, i + 4));
                          }
                          if (parts.length > 0) {
                            setNumeroTarjeta(parts.join(' '));
                          } else {
                            setNumeroTarjeta(v);
                          }
                        }}
                        className="w-full bg-[#050508]/60 border border-white/10 rounded-xl p-3 text-xs placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label
                          htmlFor="pago-exp"
                          className="text-[10px] text-slate-400 font-bold uppercase"
                        >
                          Expiración
                        </label>
                        <input
                          type="text"
                          id="pago-exp"
                          required
                          maxLength={5}
                          placeholder="MM/AA"
                          value={expiracion}
                          onChange={(e) => {
                            const v = e.target.value
                              .replace(/\s+/g, '')
                              .replace(/[^0-9]/gi, '');
                            if (v.length >= 2) {
                              setExpiracion(v.slice(0, 2) + '/' + v.slice(2, 4));
                            } else {
                              setExpiracion(v);
                            }
                          }}
                          className="w-full bg-[#050508]/60 border border-white/10 rounded-xl p-3 text-xs placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="pago-cvc"
                          className="text-[10px] text-slate-400 font-bold uppercase"
                        >
                          CVC
                        </label>
                        <input
                          type="password"
                          id="pago-cvc"
                          required
                          maxLength={3}
                          placeholder="•••"
                          value={cvc}
                          onChange={(e) =>
                            setCvc(e.target.value.replace(/[^0-9]/gi, ''))
                          }
                          className="w-full bg-[#050508]/60 border border-white/10 rounded-xl p-3 text-xs placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-white"
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                      <button
                        type="button"
                        id="btn-cancelar-pago"
                        onClick={() => {
                          setMostrarModalPago(false);
                          setPlanSeleccionado(null);
                        }}
                        className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/8 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        id="btn-procesar-recarga"
                        className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5"
                      >
                        <ShieldCheck size={14} />
                        <span>Pagar Seguro</span>
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
