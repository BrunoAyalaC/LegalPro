import { useState, useEffect } from 'react';

/* ── Tooltip personalizado recharts ─────────────────────── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl">
      <p className="text-xs font-bold text-white mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-xs flex items-center gap-1.5" style={{ color: p.color }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: p.color }} />
          {p.name}: <span className="font-bold text-slate-100">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * ActivityAreaChart — carga recharts dinámicamente para reducir el bundle de Dashboard.
 * Solo importa la librería de ~389KB cuando el usuario realmente ve la gráfica.
 */
export default function ActivityAreaChart({ data }) {
  const [Recharts, setRecharts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    import('recharts').then((mod) => {
      if (mounted) {
        setRecharts(mod);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return <div className="w-full h-full bg-white/5 rounded-xl animate-pulse" />;
  }

  const {
    AreaChart, Area, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, BarChart, Bar,
  } = Recharts;

  if (!data?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-400">
        <BarChart width={60} height={40} data={[{ v: 1 }]}>
          <Bar dataKey="v" fill="rgba(59,130,246,0.2)" />
        </BarChart>
        <p className="text-sm font-semibold text-slate-300 mt-3">Aún no hay actividad registrada</p>
        <p className="text-xs text-slate-500 mt-1 text-center max-w-xs leading-relaxed">
          El historial mensual de expedientes creados y cerrados aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
        <defs>
          <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gAmber" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
        <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.05)', strokeWidth: 1 }} />
        <Area type="monotone" dataKey="nuevos" name="Nuevos" stroke="#3B82F6" strokeWidth={2} fill="url(#gBlue)" />
        <Area type="monotone" dataKey="resueltos" name="Resueltos" stroke="#10B981" strokeWidth={2} fill="url(#gGreen)" />
        <Area type="monotone" dataKey="proceso" name="En proceso" stroke="#F59E0B" strokeWidth={2} fill="url(#gAmber)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
