import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const variants = {
  primary:   'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 border border-blue-500/30',
  secondary: 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 backdrop-blur-sm',
  ghost:     'hover:bg-white/8 text-slate-300 border border-transparent',
  danger:    'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30',
  gold:      'bg-linear-to-r from-[#C9A84C] to-[#92750F] text-white shadow-lg shadow-amber-600/20 border border-amber-500/30',
  outline:   'border border-blue-500/50 text-blue-400 hover:bg-blue-500/10',
  success:   'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30',
};

const sizes = {
  xs: 'h-7  px-2.5 text-xs  rounded-lg  gap-1',
  sm: 'h-8  px-3   text-sm  rounded-lg  gap-1.5',
  md: 'h-10 px-4   text-sm  rounded-xl  gap-2',
  lg: 'h-12 px-6   text-base rounded-xl gap-2',
  xl: 'h-14 px-8   text-lg  rounded-2xl gap-2.5',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  children,
  className = '',
  onClick,
  type = 'button',
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      whileHover={isDisabled ? {} : { scale: 1.02 }}
      whileTap={isDisabled ? {} : { scale: 0.97 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={`
        inline-flex items-center justify-center font-semibold
        transition-all duration-200 cursor-pointer select-none
        disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none
        ${variants[variant] ?? variants.primary}
        ${sizes[size] ?? sizes.md}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={size === 'xs' ? 12 : size === 'sm' ? 14 : 16} />
      ) : Icon ? (
        <Icon size={size === 'xs' ? 12 : size === 'sm' ? 14 : 16} />
      ) : null}
      {children}
      {!loading && IconRight && (
        <IconRight size={size === 'xs' ? 12 : size === 'sm' ? 14 : 16} />
      )}
    </motion.button>
  );
}
