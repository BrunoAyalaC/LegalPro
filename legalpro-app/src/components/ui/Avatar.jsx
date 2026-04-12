/**
 * Avatar — Componente de avatar de usuario con iniciales y estados.
 * Variantes: image | initials | icon
 */

const sizes = {
  xs:  'w-6  h-6  text-[10px]',
  sm:  'w-8  h-8  text-xs',
  md:  'w-10 h-10 text-sm',
  lg:  'w-12 h-12 text-base',
  xl:  'w-14 h-14 text-lg',
  '2xl': 'w-20 h-20 text-2xl',
};

const ringColors = {
  default: 'ring-white/10',
  blue:    'ring-blue-500/50',
  gold:    'ring-amber-400/50',
  green:   'ring-emerald-500/50',
  red:     'ring-red-500/50',
};

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

function stringToColor(str = '') {
  const colors = [
    'bg-blue-600',   'bg-violet-600', 'bg-emerald-600',
    'bg-amber-600',  'bg-rose-600',   'bg-cyan-600',
    'bg-indigo-600', 'bg-pink-600',   'bg-teal-600',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function Avatar({
  src,
  name = '',
  size = 'md',
  ring = false,
  ringColor = 'default',
  online,
  className = '',
  onClick,
}) {
  const sizeClass  = sizes[size] ?? sizes.md;
  const ringClass  = ring ? `ring-2 ${ringColors[ringColor] ?? ringColors.default}` : '';
  const initials   = getInitials(name);
  const colorClass = stringToColor(name);

  return (
    <div
      className={`relative inline-flex flex-shrink-0 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div
        className={`
          ${sizeClass} ${ringClass} ${className}
          rounded-full overflow-hidden flex items-center justify-center
          font-semibold text-white select-none
          ${src ? '' : colorClass}
        `}
      >
        {src ? (
          <img src={src} alt={name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span>{initials || '?'}</span>
        )}
      </div>

      {/* Online dot */}
      {online !== undefined && (
        <span
          className={`
            absolute bottom-0 right-0 block rounded-full border-2 border-[#0F172A]
            ${size === 'xs' || size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'}
            ${online ? 'bg-emerald-400' : 'bg-slate-500'}
          `}
        />
      )}
    </div>
  );
}

/** Grupo de avatares apilados */
export function AvatarGroup({ users = [], max = 4, size = 'sm' }) {
  const visible  = users.slice(0, max);
  const overflow = users.length - max;

  return (
    <div className="flex -space-x-2">
      {visible.map((u, i) => (
        <Avatar
          key={u.id ?? i}
          src={u.avatar}
          name={u.name ?? u.nombreCompleto}
          size={size}
          ring
          ringColor="default"
        />
      ))}
      {overflow > 0 && (
        <div
          className={`
            ${sizes[size] ?? sizes.sm}
            rounded-full bg-slate-600 ring-2 ring-white/10
            flex items-center justify-center text-xs font-semibold text-slate-300
          `}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
