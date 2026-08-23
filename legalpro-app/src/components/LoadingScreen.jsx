/**
 * LoadingScreen — fallback de Suspense con branding (UX fluides).
 * FIX UX (2026-08-23): sustituye el "Cargando..." plano por skeleton
 * animado coherente con el dark theme (shimmer + logo pulse).
 */
export default function LoadingScreen() {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-6 px-6"
    >
      {/* Logo pulse */}
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl animate-pulse">
          <span className="text-white font-black text-xl">L</span>
        </div>
        <div className="absolute inset-0 rounded-2xl border border-violet-500/40 animate-ping opacity-30" aria-hidden="true" />
      </div>

      {/* Shimmer bars simulando contenido */}
      <div className="w-full max-w-md space-y-3" aria-hidden="true">
        {[100, 85, 92, 70].map((w, i) => (
          <div
            key={i}
            className="h-3.5 rounded-full bg-slate-800/80 overflow-hidden relative"
            style={{ width: `${w}%`, marginInline: w < 100 ? 'auto' : undefined }}
          >
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-linear-to-r from-transparent via-white/8 to-transparent" />
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 tracking-wide">Preparando tu espacio legal…</p>
    </div>
  );
}
