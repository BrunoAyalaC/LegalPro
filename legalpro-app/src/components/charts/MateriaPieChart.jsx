import { useState, useEffect } from 'react';

/**
 * MateriaPieChart — carga recharts dinámicamente para reducir el bundle de Dashboard.
 * Solo importa la librería de ~389KB cuando el usuario realmente ve la gráfica de torta.
 */
export default function MateriaPieChart({ data }) {
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
    return <div className="w-24 h-24 rounded-full border-4 border-white/5 border-t-blue-500 animate-spin mx-auto mt-4" />;
  }

  const { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } = Recharts;

  if (!data?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-slate-400">
        <Recharts.PieChart width={80} height={80}>
          <Pie data={[{ value: 1 }]} cx="50%" cy="50%" innerRadius={30} outerRadius={38} dataKey="value" fill="rgba(59,130,246,0.15)" strokeWidth={0} />
        </Recharts.PieChart>
        <p className="text-sm font-semibold text-slate-300 mt-2">Sin datos de materias</p>
        <p className="text-xs text-slate-500 mt-1 text-center max-w-xs leading-relaxed">
          Las estadísticas por materia penal, civil, etc. se calcularán dinámicamente.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%" cy="50%"
          innerRadius={42}
          outerRadius={65}
          paddingAngle={4}
          dataKey="value"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} strokeWidth={0} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            fontSize: 11,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
