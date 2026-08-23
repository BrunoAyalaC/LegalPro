export default function UsageMeter({ label, used, max, className = '' }) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;

  let barColor = 'bg-emerald-500';
  let textColor = 'text-emerald-400';
  if (pct >= 85) {
    barColor = 'bg-red-500';
    textColor = 'text-red-400';
  } else if (pct >= 60) {
    barColor = 'bg-amber-400';
    textColor = 'text-amber-400';
  }

  const isAtLimit = pct >= 100;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="text-slate-300">{label}</span>
        <span className={`${textColor} font-bold`}>
          {used}/{max}
        </span>
      </div>
      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isAtLimit && (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
          <span className="text-red-400 text-xs font-bold">⚠ Límite alcanzado — Upgrade necesario</span>
        </div>
      )}
    </div>
  );
}
