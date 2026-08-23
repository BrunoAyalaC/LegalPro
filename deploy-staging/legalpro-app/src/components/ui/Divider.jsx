/** Divider — Separador horizontal o vertical con label opcional. */
export default function Divider({ label, orientation = 'horizontal', className = '' }) {
  if (orientation === 'vertical') {
    return <div className={`w-px self-stretch bg-white/10 mx-2 ${className}`} />;
  }

  if (label) {
    return (
      <div className={`flex items-center gap-3 my-4 ${className}`}>
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs text-slate-500 font-medium tracking-wider uppercase">{label}</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>
    );
  }

  return <hr className={`border-0 h-px bg-white/10 my-4 ${className}`} />;
}
