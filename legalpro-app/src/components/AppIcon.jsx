// Auto-import all icon PNGs from assets/icons/
const iconModules = import.meta.glob('../assets/icons/*.png', { eager: true });

// Build lookup: "gavel" → "/src/assets/icons/gavel.png"
const icons = {};
for (const [path, mod] of Object.entries(iconModules)) {
  const name = path.split('/').pop().replace('.png', '');
  icons[name] = mod.default;
}

/**
 * AppIcon — Renders a custom PNG icon from the IconosLegalPro collection.
 *
 * @param {string} name - Icon name without extension (e.g., "gavel", "analytics")
 * @param {number} size - Icon size in px (default: 24)
 * @param {string} className - Optional extra CSS classes
 * @param {string} alt - Alt text (default: icon name)
 */
export default function AppIcon({ name, size = 24, className = '', alt, style = {} }) {
  const src = icons[name];

  if (!src) {
    // Fallback to Material Symbol if icon PNG not found
    return (
      <span
        className={`material-symbols-outlined ${className}`}
        style={{ fontSize: `${size}px`, ...style }}
      >
        {name}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt || name}
      className={`app-icon ${className}`}
      style={{ 
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        objectFit: 'contain', 
        ...style 
      }}
      loading="lazy"
    />
  );
}

