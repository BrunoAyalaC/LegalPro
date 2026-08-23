import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

const FERIADOS_2026 = new Set([
  '2026-01-01', '2026-05-01', '2026-06-29', '2026-07-28', '2026-07-29',
  '2026-08-06', '2026-08-30', '2026-10-08', '2026-11-01',
  '2026-12-08', '2026-12-09', '2026-12-25',
]);

function esHabil(fechaStr) {
  const d = new Date(fechaStr + 'T00:00:00');
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  return !FERIADOS_2026.has(fechaStr);
}

function diasDelMes(mes) {
  const year = mes.getFullYear();
  const month = mes.getMonth();
  const primerDia = new Date(year, month, 1);
  const ultimoDia = new Date(year, month + 1, 0);
  const dias = [];
  for (let i = 0; i < primerDia.getDay(); i++) dias.push(null);
  for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push(d);
  return dias;
}

export default function CalendarioPlazos() {
  const [mes, setMes] = useState(new Date());
  const cambiarMes = (delta) => {
    setMes(prev => {
      const m = new Date(prev);
      m.setMonth(m.getMonth() + delta);
      return m;
    });
  };
  const nombreMes = mes.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <Calendar className="w-7 h-7 text-cyan-400" />
          Calendario de Plazos
        </h1>
        <p className="text-sm text-slate-400 mt-1">Días hábiles y feriados peruanos (CPC Art. 144)</p>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={() => cambiarMes(-1)} className="p-2 bg-white/5 border border-white/10 rounded">
          <ChevronLeft className="w-4 h-4 text-white" />
        </button>
        <h2 className="text-xl font-semibold text-white capitalize flex-1 text-center">{nombreMes}</h2>
        <button onClick={() => cambiarMes(1)} className="p-2 bg-white/5 border border-white/10 rounded">
          <ChevronRight className="w-4 h-4 text-white" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
          <div key={d} className="text-center text-xs text-slate-400 font-medium py-2">{d}</div>
        ))}
        {diasDelMes(mes).map((dia, i) => {
          if (dia === null) return <div key={i} className="h-20 bg-white/[0.02] rounded" />;
          const fechaStr = new Date(mes.getFullYear(), mes.getMonth(), dia).toISOString().slice(0, 10);
          const habil = esHabil(fechaStr);
          const esFeriado = FERIADOS_2026.has(fechaStr);
          return (
            <div key={i} className={`h-20 rounded border p-1 ${habil ? 'bg-white/5 border-white/10' : esFeriado ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-700/30 border-slate-600/30'}`}>
              <div className={`text-sm font-medium ${habil ? 'text-white' : 'text-slate-500'}`}>{dia}</div>
              {esFeriado && <div className="text-[10px] text-red-400 mt-1">Feriado</div>}
              {!habil && !esFeriado && <div className="text-[10px] text-slate-500 mt-1">Fin de semana</div>}
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-white/5 border border-white/10 rounded" /><span>Día hábil</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500/10 border border-red-500/30 rounded" /><span>Feriado</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-slate-700/30 border border-slate-600/30 rounded" /><span>Fin de semana</span></div>
      </div>
    </div>
  );
}
