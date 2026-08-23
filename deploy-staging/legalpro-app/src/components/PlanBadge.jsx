import { useNavigate } from 'react-router-dom';
import AppIcon from './AppIcon';

const PLAN_CONFIG = {
  FREE: {
    label: 'FREE',
    bg: 'bg-slate-700/60',
    border: 'border-slate-600/40',
    text: 'text-slate-300',
    icon: null,
  },
  PRO: {
    label: 'PRO',
    bg: 'bg-indigo-600/30',
    border: 'border-indigo-500/50',
    text: 'text-indigo-300',
    icon: 'star',
  },
  ENTERPRISE: {
    label: 'ENTERPRISE',
    bg: 'bg-amber-500/20',
    border: 'border-amber-400/50',
    text: 'text-amber-300',
    icon: 'diamond',
  },
};

const SIZE_CLASSES = {
  sm: 'text-[10px] px-2 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
  lg: 'text-sm px-3 py-1.5 gap-2',
};

const ICON_SIZE = { sm: 12, md: 14, lg: 16 };

export default function PlanBadge({ plan = 'FREE', size = 'md', showUpgrade = false }) {
  const navigate = useNavigate();
  const config = PLAN_CONFIG[plan] ?? PLAN_CONFIG.FREE;
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;
  const iconSize = ICON_SIZE[size] ?? 14;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-flex items-center font-bold rounded-full border ${config.bg} ${config.border} ${config.text} ${sizeClass}`}>
        {config.icon && <AppIcon name={config.icon} size={iconSize} className="opacity-90" />}
        {config.label}
      </span>
      {showUpgrade && plan === 'FREE' && (
        <button
          onClick={() => navigate('/organizacion')}
          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30 transition-colors"
        >
          <AppIcon name="upgrade" size={12} />
          Upgrade
        </button>
      )}
    </span>
  );
}
