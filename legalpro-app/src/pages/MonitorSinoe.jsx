import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import { nodeClient } from '../api/client';

/**
 * Monitor SINOE IA — conectado al backend real.
 * GET /api/notificaciones (server/routes/notificaciones.js)
 *   Response: { data: [...], total, noLeidas }
 *   Cada fila: { id, expediente_numero, tipo_notificacion, titulo, contenido,
 *                fecha_notificacion, leida, analisis_ia, urgencia ('alta'|'media'|'baja'), creado_en }
 * PATCH /api/notificaciones/:id/leida → marca leída (idempotente).
 */

function formatearFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// urgencia (alta/media/baja) → borde izquierdo (mantiene el diseño del mock)
const URGENCIA_BORDE = {
  alta: 'border-l-4 border-red-500',
  media: 'border-l-4 border-amber-500',
  baja: 'border-l-4 border-slate-600',
};

export default function MonitorSinoe() {
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [marcando, setMarcando] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const res = await nodeClient.get('/api/notificaciones');
      // Normalización robusta del shape: { data: [...] } | { items: [...] } | [...]
      const lista = res.data?.data ?? res.data?.items ?? res.data ?? [];
      setNotificaciones(Array.isArray(lista) ? lista : []);
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudieron cargar las notificaciones SINOE.');
      setNotificaciones([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const marcarLeida = async (id) => {
    if (marcando) return;
    setMarcando(id);
    try {
      await nodeClient.patch(`/api/notificaciones/${id}/leida`);
      setNotificaciones((prev) =>
        prev.map((n) => (String(n.id) === String(id) ? { ...n, leida: true } : n))
      );
    } catch {
      setError('No se pudo marcar la notificación como leída.');
    } finally {
      setMarcando(null);
    }
  };

  const nuevas = notificaciones.filter((n) => !n.leida).length;
  const urgentes = notificaciones.filter((n) => n.urgencia === 'alta').length;
  const conectado = !error;

  return (
    <div className="page-enter">
      <Header
        title="Monitor SINOE IA"
        showBack
        rightAction={
          <div className="flex gap-1 items-center">
            <span
              className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full border shrink-0 ${
                conectado
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                  : 'bg-red-500/15 text-red-400 border-red-500/25'
              }`}
            >
              {conectado ? 'Online' : 'Offline'}
            </span>
            <button
              onClick={cargar}
              aria-label="Actualizar notificaciones"
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"
            >
              <AppIcon name="refresh" size={20} />
            </button>
          </div>
        }
      />
      <div className="px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-primary">{nuevas}</p>
            <p className="text-[10px] text-slate-400 uppercase">Nuevas</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{urgentes}</p>
            <p className="text-[10px] text-slate-400 uppercase">Urgentes</p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Notificaciones Recientes</h3>

          {cargando ? (
            <div className="flex items-center justify-center py-10">
              <div
                className="w-6 h-6 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin"
                aria-hidden="true"
              />
              <span className="ml-2 text-xs text-slate-400">Cargando notificaciones...</span>
            </div>
          ) : error ? (
            <div role="alert" className="card p-4 border-l-4 border-red-500 text-sm text-red-400">
              {error}
            </div>
          ) : notificaciones.length === 0 ? (
            <div className="card p-10 text-center text-sm text-slate-400">
              No hay notificaciones SINOE
            </div>
          ) : (
            notificaciones.map((n, i) => (
              <div
                key={n.id}
                className={`card ${URGENCIA_BORDE[n.urgencia] || ''} ${n.leida ? 'opacity-60' : ''} anim-fade-in-up`}
                style={{ animationDelay: `${i * 0.08}s`, opacity: 0 }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="badge badge-primary text-xs">{n.tipo_notificacion}</span>
                  <span className="text-xs text-slate-400">{formatearFecha(n.fecha_notificacion)}</span>
                </div>
                <p className="font-semibold text-sm">{n.titulo}</p>
                <p className="text-xs text-slate-500 mt-1">Exp. {n.expediente_numero}</p>
                {!n.leida && (
                  <button
                    onClick={() => marcarLeida(n.id)}
                    disabled={marcando === n.id}
                    className="mt-2 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
                  >
                    {marcando === n.id ? 'Marcando...' : 'Marcar como leída'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
