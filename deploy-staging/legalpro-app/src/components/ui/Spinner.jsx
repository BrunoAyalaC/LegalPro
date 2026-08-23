/** Spinner — Indicador de carga animado. */
const sizes = {
  xs:  'w-3 h-3 border',
  sm:  'w-4 h-4 border-2',
  md:  'w-6 h-6 border-2',
  lg:  'w-8 h-8 border-2',
  xl:  'w-12 h-12 border-[3px]',
};

const colors = {
  blue:   'border-blue-500/30 border-t-blue-500',
  white:  'border-white/30 border-t-white',
  gold:   'border-amber-500/30 border-t-amber-500',
  green:  'border-emerald-500/30 border-t-emerald-500',
  violet: 'border-violet-500/30 border-t-violet-500',
};

export default function Spinner({ size = 'md', color = 'blue', className = '', label = 'Cargando...' }) {
  return (
    <span role="status" aria-label={label} className={`inline-flex items-center justify-center ${className}`}>
      <span
        className={`
          ${sizes[size] ?? sizes.md}
          ${colors[color] ?? colors.blue}
          rounded-full animate-spin
        `}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** SkeletonBox — Placeholder de carga por forma. */
export function SkeletonBox({ className = '' }) {
  return <div className={`animate-pulse bg-white/8 rounded-xl ${className}`} />;
}

/** SkeletonText — Placeholder de texto. */
export function SkeletonText({ lines = 3, className = '' }) {
  const widths = ['w-full', 'w-4/5', 'w-3/5', 'w-2/3', 'w-3/4'];
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse bg-white/8 h-4 rounded-full ${widths[i % widths.length]}`}
        />
      ))}
    </div>
  );
}

/** SkeletonCard — Placeholder de card completo. */
export function SkeletonCard({ className = '' }) {
  return (
    <div className={`backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="animate-pulse bg-white/8 w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="animate-pulse bg-white/8 h-4 w-1/2 rounded-full" />
          <div className="animate-pulse bg-white/8 h-3 w-1/3 rounded-full" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}
