import { SPRITE_URL, SPRITE_ICONS } from '../../data/sprite-icons';

/**
 * Ícono desde sprite.png (mismo sistema que la landing LexIA).
 */
export default function SpriteIcon({ name, size = 28, className = '', gold = false }) {
  const cfg = SPRITE_ICONS[name];
  if (!cfg) return null;

  const scale = size / cfg.height;
  const w = Math.round(cfg.width * scale);
  const h = size;

  return (
    <span
      role="img"
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
      style={{
        width: w,
        height: h,
        backgroundImage: `url('${SPRITE_URL}')`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: cfg.backgroundSize,
        backgroundPosition: cfg.backgroundPosition,
        imageRendering: 'crisp-edges',
        filter: gold
          ? 'drop-shadow(0 0 4px rgba(201,168,76,0.45))'
          : 'drop-shadow(0 0 4px rgba(6,182,212,0.35)',
      }}
    />
  );
}
